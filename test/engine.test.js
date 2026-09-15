/**
 * Tests for the computer opponent.
 *
 * Three things matter here: that it judges positions sensibly, that alpha-beta
 * pruning gives exactly the same answer as searching everything, and that it is
 * comfortably inside the two-second budget.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, fromFEN, legalMoves, makeMove, findMove, status, algebraic }
  from '../public/js/rules.js';
import { evaluate, search, rootScores, chooseMove, VALUE } from '../public/js/engine.js';

/* ---------------------------------------------------------------- *
 * T2.1 — judging a position
 * ---------------------------------------------------------------- */

test('evaluation: the opening position is exactly level', () => {
  assert.equal(evaluate(newGame()), 0);
});

test('evaluation: a queen up is worth about a queen', () => {
  // The same position, once with Black's queen and once without.
  const withQueen = fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const without = fromFEN('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const gain = evaluate(without) - evaluate(withQueen);
  assert.ok(Math.abs(gain - VALUE[5]) < 60, `expected roughly 900, got ${gain}`);
});

test('evaluation: a knight is worth more in the centre than in the corner', () => {
  const centre = evaluate(fromFEN('4k3/8/8/3N4/8/8/8/4K3 w - - 0 1'));
  const corner = evaluate(fromFEN('4k3/8/8/8/8/8/8/N3K3 w - - 0 1'));
  assert.ok(centre > corner, `centre ${centre} should beat corner ${corner}`);
});

/* ---------------------------------------------------------------- *
 * T2.2 — the search
 * ---------------------------------------------------------------- */

/** Twenty varied positions to search. */
const POSITIONS = [
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4',
  'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
  '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
  'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
  'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
  'r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1',
  '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1',
  '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1',
  '2kr3r/pp1q1ppp/5n2/1Nb5/2Pp1B2/7Q/P4PPP/1R3RK1 w - - 0 1',
  'r1b1k2r/ppppnppp/2n2q2/2b5/3NP3/2P1B3/PP3PPP/RN1QKB1R w KQkq - 0 1',
  '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
  '8/5k2/8/8/8/8/3Q1K2/8 w - - 0 1',
  'rnbqkb1r/pp1p1pPp/8/2p1pP2/1P1P4/3P1Q2/P1P1P3/RNB1KBNR w KQkq e6 0 1',
  '3r1rk1/p3qppp/2bb4/2p5/3p4/1P1B1N2/PBPPQPPP/R4RK1 w - - 0 1',
  'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 1',
  '8/8/8/8/5k2/6p1/8/6K1 w - - 0 1',
  'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 1',
  'k7/8/8/8/8/8/8/K6R w - - 0 1',
];

test('the search always returns a move rules.js considers legal', () => {
  for (const fen of POSITIONS) {
    const position = fromFEN(fen);
    const result = search(position, { depth: 2 });
    assert.ok(result, `no move found for ${fen}`);
    const legal = legalMoves(position).map((m) => m.uci);
    assert.ok(legal.includes(result.move.uci),
      `${result.move.uci} is not legal in ${fen}`);
  }
});

test('alpha-beta finds the same best move as searching everything, for less work', () => {
  let prunedTotal = 0;
  let fullTotal = 0;

  for (const fen of POSITIONS) {
    const position = fromFEN(fen);
    const pruned = search(position, { depth: 2, prune: true, random: false });
    const reference = rootScores(position, 2);
    const bestPossible = Math.max(...reference.scores.values());

    assert.equal(pruned.score, bestPossible,
      `pruning changed the value of the position in ${fen}`);
    assert.equal(reference.scores.get(pruned.move.uci), bestPossible,
      `${pruned.move.uci} is not actually a best move in ${fen}`);

    prunedTotal += pruned.nodes;
    fullTotal += reference.nodes;
  }

  // Same answers, meaningfully less work.
  assert.ok(prunedTotal < fullTotal * 0.9,
    `pruning examined ${prunedTotal} positions against ${fullTotal} unpruned`);
});

test('every search finishes far inside the two-second budget', () => {
  let slowest = 0;
  let slowestFen = '';
  for (const fen of POSITIONS) {
    const result = search(fromFEN(fen), { depth: 2 });
    if (result.ms > slowest) { slowest = result.ms; slowestFen = fen; }
  }
  assert.ok(slowest < 200,
    `slowest search was ${slowest}ms (${slowestFen}); budget for this test is 200ms`);
});

/* ---------------------------------------------------------------- *
 * Does it actually play chess?
 * ---------------------------------------------------------------- */

test('it takes a free queen', () => {
  // Black's queen on d5 is defended by nothing; White's bishop on g2 sees it.
  const position = fromFEN('4k3/8/8/3q4/8/8/6B1/4K3 w - - 0 1');
  const move = chooseMove(position, 2);
  assert.equal(algebraic(move.to), 'd5', 'it should take the queen');
});

test('it does not hand its own queen away for nothing', () => {
  // Qd1 can go to d5, where a pawn on c6 would simply take it.
  const position = fromFEN('4k3/8/2p5/8/8/8/8/3QK3 w - - 0 1');
  for (let attempt = 0; attempt < 12; attempt++) {
    const move = chooseMove(position, 2);
    assert.notEqual(algebraic(move.to), 'd5', 'it walked into the pawn');
  }
});

test('it finds mate in one', () => {
  // Rook and king against a bare king in the corner: Rh8 is mate.
  const position = fromFEN('k7/8/1K6/8/8/8/8/7R w - - 0 1');
  const move = chooseMove(position, 2);
  const after = makeMove(position, move);
  assert.equal(status(after), 'checkmate', `${move.uci} was not mate`);
});

test('it never loses its head: 50 games play to a proper finish', () => {
  let finished = 0;
  const outcomes = { checkmate: 0, stalemate: 0, longGame: 0 };

  for (let game = 0; game < 50; game++) {
    let position = newGame();
    // The computer plays White; the "player" plays random legal moves.
    for (let ply = 0; ply < 160; ply++) {
      const moves = legalMoves(position);
      if (moves.length === 0) break;

      if (position.turn === 'w') {
        const move = chooseMove(position, 2);
        assert.ok(move, 'the computer returned no move with moves available');
        assert.ok(legalMoves(position).some((m) => m.uci === move.uci),
          `illegal move ${move.uci}`);
        position = makeMove(position, move);
      } else {
        position = makeMove(position, moves[Math.floor(Math.random() * moves.length)]);
      }
    }
    const final = status(position);
    if (final === 'checkmate') outcomes.checkmate++;
    else if (final === 'stalemate') outcomes.stalemate++;
    else outcomes.longGame++;
    finished++;
  }

  assert.equal(finished, 50);
  // It plays White against random moves, so it should win the vast majority.
  assert.ok(outcomes.checkmate >= 35,
    `expected at least 35 checkmates, got ${JSON.stringify(outcomes)}`);
});
