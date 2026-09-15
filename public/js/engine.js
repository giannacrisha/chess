/**
 * gichess — the computer opponent.
 *
 * It runs entirely in the visitor's browser. Nothing is sent anywhere, it
 * costs nothing to run, and it keeps working with the network off.
 *
 * HOW IT THINKS
 *
 * Minimax: assume I play my best move, then assume you play your best reply,
 * and judge the position that leaves. Written here as "negamax", which is the
 * same idea stated once instead of twice — because a position that is good for
 * me by some amount is bad for you by exactly that amount, one piece of code
 * can play both sides by flipping the sign at each turn.
 *
 * Alpha–beta pruning: while searching, keep track of the best I am already
 * guaranteed (alpha) and the best the opponent is already guaranteed (beta).
 * The moment a branch proves worse for the opponent than something they can
 * already get, they would never allow it, so the rest of that branch cannot
 * change the answer and is abandoned unexamined. The result is identical to
 * searching everything; it is simply far less work. engine.test.js proves that
 * equivalence rather than assuming it.
 *
 * It cannot produce an illegal move, because it never constructs a move: every
 * move it considers came from rules.legalMoves().
 */

import {
  legalMoves, makeMove, isInCheck, fileOf, rankOf, typeOf, colourOf,
  PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, WHITE, SQUARES, FLAG,
} from './rules.js';

/* ------------------------------------------------------------------ *
 * What a position is worth
 * ------------------------------------------------------------------ */

/** Material, in hundredths of a pawn. The usual values. */
export const VALUE = {
  [PAWN]: 100, [KNIGHT]: 320, [BISHOP]: 330,
  [ROOK]: 500, [QUEEN]: 900, [KING]: 20000,
};

/**
 * Piece-square tables: a small bonus or penalty for each square, per piece.
 * Written from White's point of view with rank 8 on the first row, the way a
 * board looks on screen. Black reads the same table upside down.
 *
 * This is what stops it shuffling aimlessly when nothing is hanging. Knights
 * are worth more in the middle than on the rim; pawns gain value as they
 * advance; the king would rather be tucked behind its own pawns.
 */
const TABLES = {
  [PAWN]: [
      0,  0,  0,  0,  0,  0,  0,  0,
     50, 50, 50, 50, 50, 50, 50, 50,
     10, 10, 20, 30, 30, 20, 10, 10,
      5,  5, 10, 25, 25, 10,  5,  5,
      0,  0,  0, 20, 20,  0,  0,  0,
      5, -5,-10,  0,  0,-10, -5,  5,
      5, 10, 10,-20,-20, 10, 10,  5,
      0,  0,  0,  0,  0,  0,  0,  0,
  ],
  [KNIGHT]: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  [BISHOP]: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  [ROOK]: [
      0,  0,  0,  0,  0,  0,  0,  0,
      5, 10, 10, 10, 10, 10, 10,  5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
      0,  0,  0,  5,  5,  0,  0,  0,
  ],
  [QUEEN]: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  [KING]: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ],
};

/**
 * What the position is worth to White. Positive is good for White, negative is
 * good for Black, and a symmetrical position scores exactly zero.
 */
export function evaluate(position) {
  const { board } = position;
  let score = 0;
  for (const sq of SQUARES) {
    const piece = board[sq];
    if (piece === 0) continue;
    const type = typeOf(piece);
    const file = fileOf(sq);
    const rank = rankOf(sq);
    // White reads the table top-down; Black reads the same table flipped.
    const index = piece > 0 ? (7 - rank) * 8 + file : rank * 8 + file;
    const worth = VALUE[type] + TABLES[type][index];
    score += piece > 0 ? worth : -worth;
  }
  return score;
}

/** The same number, but from the point of view of whoever is to move. */
function evaluateToMove(position) {
  return position.turn === WHITE ? evaluate(position) : -evaluate(position);
}

/* ------------------------------------------------------------------ *
 * Searching
 * ------------------------------------------------------------------ */

const MATE = 1_000_000;

/**
 * Look at the most promising moves first. Pruning works far better when the
 * best move is examined early, because a good alpha cuts off more. Captures of
 * valuable pieces by cheap ones come first — a pawn taking a queen is the most
 * interesting thing on any board.
 */
function ordered(moves) {
  return moves
    .map((m) => {
      let rank = 0;
      if (m.flags & (FLAG.CAPTURE | FLAG.EP_CAPTURE)) {
        rank += 10 * VALUE[typeOf(m.captured)] - VALUE[typeOf(m.piece)];
      }
      if (m.flags & FLAG.PROMOTION) rank += VALUE[m.promotion];
      return { m, rank };
    })
    .sort((a, b) => b.rank - a.rank)
    .map((entry) => entry.m);
}

/**
 * The value of this position to the side to move, looking `depth` turns ahead.
 * `prune` exists so the tests can run the same search without alpha–beta and
 * confirm the two agree.
 */
function negamax(position, depth, alpha, beta, ply, counter, prune) {
  const moves = legalMoves(position);

  if (moves.length === 0) {
    // No legal moves: either checkmate, or stalemate which is a draw.
    return isInCheck(position) ? -(MATE - ply) : 0;
  }
  if (depth === 0) {
    counter.nodes++;
    return evaluateToMove(position);
  }

  let best = -Infinity;
  for (const move of ordered(moves)) {
    const score = -negamax(
      makeMove(position, move), depth - 1, -beta, -alpha, ply + 1, counter, prune,
    );
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (prune && alpha >= beta) break;   // the opponent would never allow this
  }
  return best;
}

/** Fisher-Yates, so that equally good moves are not always played in the same
 * order and two games against the computer are not identical. */
function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Choose a move.
 *
 * Each move after the first is searched against the best score found so far.
 * That is what gives alpha-beta something to prune: once a reply proves this
 * branch is worse than one we can already reach, the rest of the branch cannot
 * change the answer and is abandoned.
 *
 * @param {object} position
 * @param {object} options
 *   depth  - how many turns ahead. 2 means: my move, then your best reply.
 *   prune  - alpha-beta on or off. Only the tests ever turn it off.
 *   random - shuffle first, so ties are broken differently each game.
 * @returns {{move, score, nodes, ms}|null} null only when there are no moves.
 */
export function search(position, { depth = 2, prune = true, random = true } = {}) {
  const started = Date.now();
  const counter = { nodes: 0 };

  let moves = legalMoves(position);
  if (moves.length === 0) return null;
  if (random) shuffle(moves);
  // A stable sort, so equally interesting moves keep their shuffled order.
  moves = ordered(moves);

  let best = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;

  for (const move of moves) {
    const score = -negamax(
      makeMove(position, move), depth - 1,
      -Infinity, prune ? -alpha : Infinity,
      1, counter, prune,
    );
    if (score > bestScore) {
      bestScore = score;
      best = move;
      alpha = score;
    }
  }

  return { move: best, score: bestScore, nodes: counter.nodes, ms: Date.now() - started };
}

/**
 * The exact value of every move at the root, with no pruning anywhere.
 *
 * This is the slow, obviously-correct reference the tests measure the real
 * search against. Nothing in the game uses it.
 */
export function rootScores(position, depth = 2) {
  const counter = { nodes: 0 };
  const scores = new Map();
  for (const move of legalMoves(position)) {
    scores.set(move.uci, -negamax(
      makeMove(position, move), depth - 1, -Infinity, Infinity, 1, counter, false,
    ));
  }
  return { scores, nodes: counter.nodes };
}

/** The move only. Always legal, or null if the game is already over. */
export function chooseMove(position, depth = 2) {
  return search(position, { depth })?.move ?? null;
}
