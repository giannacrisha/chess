/**
 * The proof that gichess's rules are right.
 *
 * `perft` counts every legal sequence of moves to a given depth. Chess has
 * published, agreed answers for these counts. If our numbers match theirs,
 * our rules are correct — not plausible, correct.
 *
 * WHY FIVE POSITIONS AND NOT ONE
 *
 * The obvious test is the opening position: 20, 400, 8902. It is necessary,
 * and it is nowhere near sufficient. Starting from the opening position you
 * cannot reach a castling move, an en passant capture, or a promotion within
 * three moves — they are all too far away. An implementation could match all
 * three numbers exactly while getting every special rule completely wrong.
 *
 * So four further positions follow, each chosen because it is dense in exactly
 * the cases the opening position cannot reach. They are the standard published
 * test positions used for this purpose.
 *
 * Run with: npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, fromFEN, perft, perftDivide, toFEN, START_FEN } from '../public/js/rules.js';

/** The counts required by the specification, from the opening position. */
const REQUIRED = [
  { depth: 1, expected: 20 },
  { depth: 2, expected: 400 },
  { depth: 3, expected: 8_902 },
  { depth: 4, expected: 197_281 },
];

/**
 * Standard positions that actually exercise the special rules.
 * Each entry: name, position, what it is here to catch, and the counts.
 */
const POSITIONS = [
  {
    name: 'Kiwipete',
    fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    exercises: 'castling both sides for both colours, pins, en passant',
    counts: [48, 2_039, 97_862],
  },
  {
    name: 'Endgame',
    fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    exercises: 'en passant, promotion races, discovered check',
    counts: [14, 191, 2_812],
  },
  {
    name: 'Promotion',
    fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    exercises: 'under-promotion, promotion with check, castling rights',
    counts: [6, 264, 9_467],
  },
  {
    name: 'Tactical',
    fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    exercises: 'promotion by capture, castling while under pressure',
    counts: [44, 1_486, 62_379],
  },
];

test('FEN survives a round trip', () => {
  assert.equal(toFEN(newGame()), START_FEN);
  for (const { name, fen } of POSITIONS) {
    assert.equal(toFEN(fromFEN(fen)), fen, `${name} did not survive FEN round trip`);
  }
});

test('opening position: the required move counts', async (t) => {
  for (const { depth, expected } of REQUIRED) {
    await t.test(`depth ${depth} = ${expected.toLocaleString('en-US')}`, () => {
      const actual = perft(newGame(), depth);
      if (actual !== expected && depth > 1) {
        // A wrong count is useless on its own. Show which first move is wrong.
        console.error('  breakdown by first move:', perftDivide(newGame(), depth));
      }
      assert.equal(actual, expected);
    });
  }
});

for (const { name, fen, exercises, counts } of POSITIONS) {
  test(`${name} — ${exercises}`, async (t) => {
    const position = fromFEN(fen);
    for (const [index, expected] of counts.entries()) {
      const depth = index + 1;
      await t.test(`depth ${depth} = ${expected.toLocaleString('en-US')}`, () => {
        const actual = perft(position, depth);
        if (actual !== expected && depth > 1) {
          console.error('  breakdown by first move:', perftDivide(position, depth));
        }
        assert.equal(actual, expected);
      });
    }
  });
}
