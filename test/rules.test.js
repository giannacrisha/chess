/**
 * Behaviour tests for the rules.
 *
 * perft.test.js proves the move counts are right. This file proves the rules
 * SAY the right things — that a checkmate is reported as a checkmate, that
 * castling is withheld when it should be, and above all that `findMove`, the
 * single gate every mode and the server go through, refuses anything illegal.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, fromFEN, toFEN, status, isInCheck, legalMoves, makeMove, findMove,
  algebraic, squareOf, QUEEN, KNIGHT, FLAG,
} from '../public/js/rules.js';

/* ---------------------------------------------------------------- *
 * How the game stands
 * ---------------------------------------------------------------- */

test('status: a fresh game is simply being played', () => {
  assert.equal(status(newGame()), 'playing');
  assert.equal(isInCheck(newGame()), false);
});

test("status: fool's mate is checkmate", () => {
  const p = fromFEN('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
  assert.equal(status(p), 'checkmate');
  assert.equal(legalMoves(p).length, 0);
});

test('status: a back-rank mate is checkmate', () => {
  const p = fromFEN('R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1');
  assert.equal(status(p), 'checkmate');
});

test('status: stalemate is a draw, not a mate', () => {
  const p = fromFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  assert.equal(isInCheck(p), false, 'stalemate means NOT in check');
  assert.equal(legalMoves(p).length, 0, 'stalemate means no legal moves');
  assert.equal(status(p), 'stalemate');
});

test('status: in check with a way out is check, not mate', () => {
  const p = fromFEN('rnbqkbnr/ppp2ppp/8/1B1pp3/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 3');
  assert.equal(isInCheck(p), true);
  assert.equal(status(p), 'check');
  assert.ok(legalMoves(p).length > 0);
});

test('a pinned piece may not move out of the pin', () => {
  // Black king e8, white rook e1, black knight e5 in between: the knight is
  // the only thing stopping the check, so it may not step aside.
  const p = fromFEN('4k3/8/8/4n3/8/8/8/4R1K1 b - - 0 1');
  assert.equal(isInCheck(p), false, 'the knight is shielding the king');
  assert.equal(legalMoves(p, 'e5').length, 0, 'the pinned knight cannot legally move');
  // The king itself is free to step off the file, or along it behind the shield.
  const kingMoves = legalMoves(p, 'e8').map((m) => algebraic(m.to));
  assert.ok(kingMoves.includes('d8') && kingMoves.includes('f8'));
});

test('a king may never move into check', () => {
  // Same rook, nothing in between. The king is in check on the open file.
  const p = fromFEN('4k3/8/8/8/8/8/8/4R1K1 b - - 0 1');
  assert.equal(isInCheck(p), true);
  const kingMoves = legalMoves(p, 'e8').map((m) => algebraic(m.to));
  assert.ok(!kingMoves.includes('e7'), 'the king may not stay on the attacked file');
  assert.deepEqual(kingMoves.sort(), ['d7', 'd8', 'f7', 'f8']);
});

/* ---------------------------------------------------------------- *
 * Castling
 * ---------------------------------------------------------------- */

test('castling: offered on both sides when everything is in order', () => {
  const p = fromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  const kingSide = findMove(p, 'e1', 'g1');
  const queenSide = findMove(p, 'e1', 'c1');
  assert.ok(kingSide, 'kingside castling should be available');
  assert.ok(queenSide, 'queenside castling should be available');
  assert.ok(kingSide.flags & FLAG.KING_CASTLE);

  // And the rook actually moves with the king.
  const after = makeMove(p, kingSide);
  assert.equal(toFEN(after).split(' ')[0].split('/').pop(), 'R4RK1');
});

test('castling: withheld while the king is in check', () => {
  const p = fromFEN('r3k2r/8/8/8/8/8/4r3/R3K2R w KQkq - 0 1');
  assert.equal(isInCheck(p), true);
  assert.equal(findMove(p, 'e1', 'g1'), null);
  assert.equal(findMove(p, 'e1', 'c1'), null);
});

test('castling: withheld when the king would pass through an attacked square', () => {
  // A black rook on f8 attacks f1, the square the king would cross going short.
  const p = fromFEN('5r2/8/8/8/8/8/8/R3K2R w KQ - 0 1');
  assert.equal(findMove(p, 'e1', 'g1'), null, 'may not cross an attacked square');
  assert.ok(findMove(p, 'e1', 'c1'), 'the other side is unaffected');
});

test('castling: withheld when a piece is in the way', () => {
  const p = fromFEN('r3k2r/8/8/8/8/8/8/R2QK1NR w KQkq - 0 1');
  assert.equal(findMove(p, 'e1', 'g1'), null, 'a knight blocks the kingside');
  assert.equal(findMove(p, 'e1', 'c1'), null, 'a queen blocks the queenside');
});

test('castling: the right is lost once the king or rook moves', () => {
  const p = fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const afterRook = makeMove(p, findMove(p, 'h1', 'h2'));
  assert.ok(!toFEN(afterRook).includes('KQkq'), 'moving the h1 rook ends kingside rights');
  assert.ok(toFEN(afterRook).split(' ')[2].includes('Q'), 'queenside survives');

  const afterKing = makeMove(p, findMove(p, 'e1', 'f1'));
  const rights = toFEN(afterKing).split(' ')[2];
  assert.ok(!rights.includes('K') && !rights.includes('Q'), 'moving the king ends both');
});

test('castling: capturing a rook on its home square ends that right', () => {
  const p = fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const capture = findMove(p, 'a1', 'a8');
  assert.ok(capture);
  const rights = toFEN(makeMove(p, capture)).split(' ')[2];
  assert.ok(!rights.includes('q'), "black's queenside right dies with the rook");
  assert.ok(rights.includes('k'), "black's kingside right survives");
});

/* ---------------------------------------------------------------- *
 * En passant
 * ---------------------------------------------------------------- */

test('en passant: offered on the very next move, and never again', () => {
  const p = fromFEN('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
  const ep = findMove(p, 'e5', 'f6');
  assert.ok(ep, 'en passant should be available immediately');
  assert.ok(ep.flags & FLAG.EP_CAPTURE);

  // It really does remove the pawn beside us, not the empty square we land on.
  const after = makeMove(p, ep);
  assert.equal(after.board[squareOf('f5')], 0, 'the captured pawn is gone');
  assert.equal(after.board[squareOf('f6')] > 0, true, 'our pawn is on f6');

  // Let a move pass, and the chance is gone for good.
  const laterFEN = 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3';
  assert.equal(findMove(fromFEN(laterFEN), 'e5', 'f6'), null, 'the chance expires');
});

test('en passant: a double pawn push sets the square, a single push does not', () => {
  const p = newGame();
  assert.equal(toFEN(makeMove(p, findMove(p, 'e2', 'e4'))).split(' ')[3], 'e3');
  assert.equal(toFEN(makeMove(p, findMove(p, 'e2', 'e3'))).split(' ')[3], '-');
});

/* ---------------------------------------------------------------- *
 * Promotion
 * ---------------------------------------------------------------- */

test('promotion: four choices, and you really get the one you picked', () => {
  const p = fromFEN('8/4P3/8/8/8/8/8/K6k w - - 0 1');
  const toEighth = legalMoves(p, 'e7').filter((m) => algebraic(m.to) === 'e8');
  assert.equal(toEighth.length, 4, 'queen, rook, bishop and knight');

  const asKnight = findMove(p, 'e7', 'e8', 'n');
  assert.equal(asKnight.promotion, KNIGHT);
  assert.ok(toFEN(makeMove(p, asKnight)).startsWith('4N3/'), 'a knight appears on e8');

  const asQueen = findMove(p, 'e7', 'e8', 'q');
  assert.equal(asQueen.promotion, QUEEN);
  assert.ok(toFEN(makeMove(p, asQueen)).startsWith('4Q3/'));

  // Asking for nothing in particular gives a queen.
  assert.equal(findMove(p, 'e7', 'e8').promotion, QUEEN);
});

/* ---------------------------------------------------------------- *
 * The gate: illegal moves are not merely rejected, they are unavailable
 * ---------------------------------------------------------------- */

test('findMove refuses every illegal move, from every square to every square', () => {
  const positions = [
    newGame(),
    fromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'),
    fromFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1'),
    fromFEN('rnbqkbnr/ppp2ppp/8/1B1pp3/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 3'),
  ];

  for (const position of positions) {
    // The set of moves that SHOULD be accepted.
    const legal = new Set(
      legalMoves(position).map((m) => `${algebraic(m.from)}${algebraic(m.to)}`)
    );

    // Try every square to every other square — 4,032 attempts per position.
    let accepted = 0;
    for (let from = 0; from < 128; from++) {
      if (from & 0x88) continue;
      for (let to = 0; to < 128; to++) {
        if (to & 0x88 || to === from) continue;
        const found = findMove(position, from, to);
        const key = `${algebraic(from)}${algebraic(to)}`;
        if (found) {
          accepted++;
          assert.ok(legal.has(key), `${key} was accepted but is not legal`);
        } else {
          assert.ok(!legal.has(key), `${key} is legal but was refused`);
        }
      }
    }
    assert.ok(accepted > 0, 'something should have been accepted');
  }
});

test('a position is a value: makeMove never alters the one it was given', () => {
  const before = newGame();
  const snapshot = toFEN(before);
  const after = makeMove(before, findMove(before, 'e2', 'e4'));
  assert.equal(toFEN(before), snapshot, 'the original position is untouched');
  assert.notEqual(toFEN(after), snapshot, 'the new one has moved on');
});
