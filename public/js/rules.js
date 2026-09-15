/**
 * gichess — the rules of chess.
 *
 * This is the ONLY place chess rules are written in this project. The browser
 * imports it for every mode; the Cloudflare Worker imports this same file to
 * referee online games. It has no dependencies and nothing browser-specific,
 * so it runs unchanged in both places.
 *
 * HOW THE BOARD IS STORED — the "0x88" trick
 * ------------------------------------------
 * The board is an array of 128 squares: the real 8x8 board occupying the left
 * half of each 16-wide row, and a phantom 8 squares of padding to its right.
 *
 *   rank 8  →  112 113 114 115 116 117 118 119 | 120 ... 127   (padding)
 *   ...
 *   rank 1  →    0   1   2   3   4   5   6   7 |   8 ...  15   (padding)
 *
 * The point of the padding is one arithmetic test. A square number is off the
 * board exactly when `square & 0x88` is not zero — one operation instead of
 * four comparisons against the edges. Sliding a bishop off the corner lands in
 * the padding and stops immediately. This is what makes the whole thing fast
 * enough to prove itself correct in under a second.
 *
 * A piece is a signed number: white is positive, black is negative, and the
 * size says which piece. So 5 is a white queen, -5 a black queen, 0 an empty
 * square. Colour is therefore `Math.sign(piece)`, which is free.
 *
 * Positions are values, never mutated. `makeMove` returns a NEW position and
 * leaves the old one untouched. That is what lets the server store a position,
 * send it, and compare it without anything changing behind its back.
 */

/* ------------------------------------------------------------------ *
 * Pieces and colours
 * ------------------------------------------------------------------ */

export const EMPTY = 0;
export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;

export const WHITE = 'w';
export const BLACK = 'b';

/** The sign a colour's pieces carry on the board. */
const sign = (colour) => (colour === WHITE ? 1 : -1);
/** The colour of a piece value. */
export const colourOf = (piece) => (piece > 0 ? WHITE : piece < 0 ? BLACK : null);
export const typeOf = (piece) => Math.abs(piece);
export const opposite = (colour) => (colour === WHITE ? BLACK : WHITE);

/* ------------------------------------------------------------------ *
 * Squares
 * ------------------------------------------------------------------ */

const OFF_BOARD = 0x88;
export const isOffBoard = (sq) => (sq & OFF_BOARD) !== 0;

export const fileOf = (sq) => sq & 15;   // 0 = a-file
export const rankOf = (sq) => sq >> 4;   // 0 = rank 1

const A1 = 0, H1 = 7, A8 = 112, H8 = 119;
const E1 = 4, E8 = 116;

/** 0x88 square number → "e4" */
export function algebraic(sq) {
  return 'abcdefgh'[fileOf(sq)] + (rankOf(sq) + 1);
}

/** "e4" → 0x88 square number, or -1 if it isn't a square. */
export function squareOf(name) {
  if (typeof name !== 'string' || name.length !== 2) return -1;
  const f = name.charCodeAt(0) - 97;          // 'a'
  const r = name.charCodeAt(1) - 49;          // '1'
  if (f < 0 || f > 7 || r < 0 || r > 7) return -1;
  return r * 16 + f;
}

/** Every real square, a1 first, in reading order along each rank. */
export const SQUARES = (() => {
  const out = [];
  for (let sq = 0; sq < 128; sq++) if (!isOffBoard(sq)) out.push(sq);
  return out;
})();

/* ------------------------------------------------------------------ *
 * Castling rights, stored as four bits
 * ------------------------------------------------------------------ */

const WK = 1, WQ = 2, BK = 4, BQ = 8;

/* ------------------------------------------------------------------ *
 * What each move is allowed to be
 * ------------------------------------------------------------------ */

export const FLAG = {
  NORMAL: 1,
  CAPTURE: 2,
  BIG_PAWN: 4,      // a pawn's opening two-square advance
  EP_CAPTURE: 8,    // en passant
  PROMOTION: 16,
  KING_CASTLE: 32,
  QUEEN_CASTLE: 64,
};

/* ------------------------------------------------------------------ *
 * How each piece moves, as square-number offsets
 * ------------------------------------------------------------------ */

const KNIGHT_OFFSETS = [-33, -31, -18, -14, 14, 18, 31, 33];
const KING_OFFSETS   = [-17, -16, -15, -1, 1, 15, 16, 17];
const BISHOP_DIRS    = [-17, -15, 15, 17];   // the diagonals
const ROOK_DIRS      = [-16, -1, 1, 16];     // the straight lines
const QUEEN_DIRS     = [...BISHOP_DIRS, ...ROOK_DIRS];

const SLIDING_DIRS = {
  [BISHOP]: BISHOP_DIRS,
  [ROOK]: ROOK_DIRS,
  [QUEEN]: QUEEN_DIRS,
};

/* ------------------------------------------------------------------ *
 * Positions
 * ------------------------------------------------------------------ */

export const START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** The opening position. */
export function newGame() {
  return fromFEN(START_FEN);
}

const FEN_PIECES = {
  p: -PAWN, n: -KNIGHT, b: -BISHOP, r: -ROOK, q: -QUEEN, k: -KING,
  P: PAWN, N: KNIGHT, B: BISHOP, R: ROOK, Q: QUEEN, K: KING,
};
const PIECE_LETTERS = { [PAWN]: 'p', [KNIGHT]: 'n', [BISHOP]: 'b', [ROOK]: 'r', [QUEEN]: 'q', [KING]: 'k' };

/**
 * Read a position from FEN — the one-line text form of a chessboard.
 * Throws if the text isn't a position, so bad input can never become a
 * half-valid game.
 */
export function fromFEN(fen) {
  const parts = String(fen).trim().split(/\s+/);
  if (parts.length < 4) throw new Error(`Not a FEN: ${fen}`);
  const [placement, turnText, castlingText, epText] = parts;

  const board = new Int8Array(128);
  let sq = A8;                                 // FEN starts at a8
  for (const ch of placement) {
    if (ch === '/') {
      sq -= 24;                                // down a rank, back to the a-file
    } else if (ch >= '1' && ch <= '8') {
      sq += Number(ch);                        // that many empty squares
    } else {
      const piece = FEN_PIECES[ch];
      if (piece === undefined) throw new Error(`Bad piece '${ch}' in FEN`);
      if (isOffBoard(sq)) throw new Error('FEN describes too many squares');
      board[sq++] = piece;
    }
  }

  let castling = 0;
  if (castlingText.includes('K')) castling |= WK;
  if (castlingText.includes('Q')) castling |= WQ;
  if (castlingText.includes('k')) castling |= BK;
  if (castlingText.includes('q')) castling |= BQ;

  const kings = { [WHITE]: -1, [BLACK]: -1 };
  for (const s of SQUARES) {
    if (board[s] === KING) kings[WHITE] = s;
    else if (board[s] === -KING) kings[BLACK] = s;
  }

  return {
    board,
    turn: turnText === 'b' ? BLACK : WHITE,
    castling,
    ep: epText === '-' ? -1 : squareOf(epText),
    halfmove: Number(parts[4] ?? 0),
    fullmove: Number(parts[5] ?? 1),
    kings,
  };
}

/** Write a position out as FEN. */
export function toFEN(position) {
  const { board } = position;
  let placement = '';
  for (let rank = 7; rank >= 0; rank--) {
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = board[rank * 16 + file];
      if (piece === EMPTY) {
        empty++;
      } else {
        if (empty) { placement += empty; empty = 0; }
        const letter = PIECE_LETTERS[typeOf(piece)];
        placement += piece > 0 ? letter.toUpperCase() : letter;
      }
    }
    if (empty) placement += empty;
    if (rank > 0) placement += '/';
  }

  let castling = '';
  if (position.castling & WK) castling += 'K';
  if (position.castling & WQ) castling += 'Q';
  if (position.castling & BK) castling += 'k';
  if (position.castling & BQ) castling += 'q';

  return [
    placement,
    position.turn,
    castling || '-',
    position.ep >= 0 ? algebraic(position.ep) : '-',
    position.halfmove,
    position.fullmove,
  ].join(' ');
}

/* ------------------------------------------------------------------ *
 * Attack detection
 * ------------------------------------------------------------------ */

/**
 * Is `target` attacked by `attacker`'s pieces?
 *
 * Rather than asking every enemy piece where it can go, this looks outward
 * from the target square: are there knights a knight's move away, is there a
 * bishop or queen along a diagonal, and so on. That makes it a handful of
 * short walks rather than a full move generation, which matters because this
 * is the single most-called function in the whole project.
 */
export function isAttacked(board, target, attacker) {
  const s = sign(attacker);

  // Pawns. A white pawn on target-17 or target-15 attacks target.
  const pawn = s * PAWN;
  const pawnFrom = attacker === WHITE ? [-17, -15] : [17, 15];
  for (const d of pawnFrom) {
    const from = target + d;
    if (!isOffBoard(from) && board[from] === pawn) return true;
  }

  // Knights.
  const knight = s * KNIGHT;
  for (const d of KNIGHT_OFFSETS) {
    const from = target + d;
    if (!isOffBoard(from) && board[from] === knight) return true;
  }

  // Kings (they defend squares too, which matters for castling).
  const king = s * KING;
  for (const d of KING_OFFSETS) {
    const from = target + d;
    if (!isOffBoard(from) && board[from] === king) return true;
  }

  // Sliding pieces: walk each line until something blocks it.
  const bishop = s * BISHOP, rook = s * ROOK, queen = s * QUEEN;
  for (const d of BISHOP_DIRS) {
    for (let from = target + d; !isOffBoard(from); from += d) {
      const piece = board[from];
      if (piece !== EMPTY) {
        if (piece === bishop || piece === queen) return true;
        break;
      }
    }
  }
  for (const d of ROOK_DIRS) {
    for (let from = target + d; !isOffBoard(from); from += d) {
      const piece = board[from];
      if (piece !== EMPTY) {
        if (piece === rook || piece === queen) return true;
        break;
      }
    }
  }

  return false;
}

/** Is `colour`'s king currently attacked? */
export function isInCheck(position, colour = position.turn) {
  const king = position.kings[colour];
  if (king < 0) return false;                  // no king: only in test positions
  return isAttacked(position.board, king, opposite(colour));
}

/* ------------------------------------------------------------------ *
 * Generating moves
 * ------------------------------------------------------------------ */

function move(from, to, piece, captured, flags, promotion = 0) {
  const m = { from, to, piece, captured, flags, promotion };
  m.uci = algebraic(from) + algebraic(to) +
    (promotion ? PIECE_LETTERS[promotion] : '');
  return m;
}

const PROMOTION_CHOICES = [QUEEN, ROOK, BISHOP, KNIGHT];

function addPawnMove(out, from, to, piece, captured, flags) {
  const lastRank = piece > 0 ? 7 : 0;
  if (rankOf(to) === lastRank) {
    for (const choice of PROMOTION_CHOICES) {
      out.push(move(from, to, piece, captured, flags | FLAG.PROMOTION, choice));
    }
  } else {
    out.push(move(from, to, piece, captured, flags));
  }
}

/**
 * Every move the pieces could physically make, ignoring for the moment whether
 * it would leave our own king in check. `legalMoves` filters those out.
 */
function pseudoLegalMoves(position, onlyFrom = -1) {
  const { board, turn } = position;
  const us = sign(turn);
  const out = [];

  for (const from of SQUARES) {
    if (onlyFrom >= 0 && from !== onlyFrom) continue;
    const piece = board[from];
    if (piece === EMPTY || Math.sign(piece) !== us) continue;
    const type = typeOf(piece);

    if (type === PAWN) {
      const forward = us * 16;
      const startRank = turn === WHITE ? 1 : 6;

      const one = from + forward;
      if (!isOffBoard(one) && board[one] === EMPTY) {
        addPawnMove(out, from, one, piece, EMPTY, FLAG.NORMAL);

        const two = from + forward * 2;
        if (rankOf(from) === startRank && board[two] === EMPTY) {
          out.push(move(from, two, piece, EMPTY, FLAG.BIG_PAWN));
        }
      }

      for (const d of [forward - 1, forward + 1]) {
        const to = from + d;
        if (isOffBoard(to)) continue;
        const target = board[to];
        if (target !== EMPTY && Math.sign(target) !== us) {
          addPawnMove(out, from, to, piece, target, FLAG.CAPTURE);
        } else if (target === EMPTY && to === position.ep) {
          // En passant: the captured pawn is beside us, not on the target square.
          out.push(move(from, to, piece, -us * PAWN, FLAG.EP_CAPTURE));
        }
      }
      continue;
    }

    if (type === KNIGHT || type === KING) {
      const offsets = type === KNIGHT ? KNIGHT_OFFSETS : KING_OFFSETS;
      for (const d of offsets) {
        const to = from + d;
        if (isOffBoard(to)) continue;
        const target = board[to];
        if (target === EMPTY) {
          out.push(move(from, to, piece, EMPTY, FLAG.NORMAL));
        } else if (Math.sign(target) !== us) {
          out.push(move(from, to, piece, target, FLAG.CAPTURE));
        }
      }
      continue;
    }

    // Bishop, rook, queen: slide until blocked or off the edge.
    for (const d of SLIDING_DIRS[type]) {
      for (let to = from + d; !isOffBoard(to); to += d) {
        const target = board[to];
        if (target === EMPTY) {
          out.push(move(from, to, piece, EMPTY, FLAG.NORMAL));
          continue;
        }
        if (Math.sign(target) !== us) {
          out.push(move(from, to, piece, target, FLAG.CAPTURE));
        }
        break;                                  // blocked either way
      }
    }
  }

  // Castling. Four conditions, all of which must hold:
  //   1. the right still exists (neither the king nor that rook has moved)
  //   2. the squares between king and rook are empty
  //   3. the king is not currently in check
  //   4. the king passes through, and lands on, no attacked square
  const kingHome = turn === WHITE ? E1 : E8;
  if ((onlyFrom < 0 || onlyFrom === kingHome) && position.kings[turn] === kingHome) {
    const them = opposite(turn);
    const kingSide = turn === WHITE ? WK : BK;
    const queenSide = turn === WHITE ? WQ : BQ;
    const king = us * KING;

    if ((position.castling & kingSide) &&
        board[kingHome + 1] === EMPTY && board[kingHome + 2] === EMPTY &&
        !isAttacked(board, kingHome, them) &&
        !isAttacked(board, kingHome + 1, them) &&
        !isAttacked(board, kingHome + 2, them)) {
      out.push(move(kingHome, kingHome + 2, king, EMPTY, FLAG.KING_CASTLE));
    }

    if ((position.castling & queenSide) &&
        board[kingHome - 1] === EMPTY && board[kingHome - 2] === EMPTY &&
        board[kingHome - 3] === EMPTY &&
        !isAttacked(board, kingHome, them) &&
        !isAttacked(board, kingHome - 1, them) &&
        !isAttacked(board, kingHome - 2, them)) {
      out.push(move(kingHome, kingHome - 2, king, EMPTY, FLAG.QUEEN_CASTLE));
    }
  }

  return out;
}

/**
 * Every LEGAL move: the physically possible ones, minus any that would leave
 * our own king attacked. Pass a square name or number to get only that piece's
 * moves — which is what the board does when you pick a piece up.
 */
export function legalMoves(position, from = null) {
  const onlyFrom = from === null ? -1
    : typeof from === 'string' ? squareOf(from) : from;

  const us = position.turn;
  const them = opposite(us);
  const out = [];

  for (const m of pseudoLegalMoves(position, onlyFrom)) {
    const next = makeMove(position, m);
    if (!isAttacked(next.board, next.kings[us], them)) out.push(m);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Playing a move
 * ------------------------------------------------------------------ */

/**
 * Apply a move and return the NEW position. The position passed in is not
 * touched.
 */
export function makeMove(position, m) {
  const board = Int8Array.prototype.slice.call(position.board);
  const turn = position.turn;
  const us = sign(turn);
  const kings = { [WHITE]: position.kings[WHITE], [BLACK]: position.kings[BLACK] };

  const piece = board[m.from];
  const type = typeOf(piece);

  board[m.to] = piece;
  board[m.from] = EMPTY;

  if (m.flags & FLAG.EP_CAPTURE) {
    // The pawn we take is beside the square we land on, not under it.
    board[m.to - us * 16] = EMPTY;
  }
  if (m.flags & FLAG.PROMOTION) {
    board[m.to] = us * m.promotion;
  }
  if (m.flags & FLAG.KING_CASTLE) {
    board[m.to - 1] = board[m.to + 1];
    board[m.to + 1] = EMPTY;
  }
  if (m.flags & FLAG.QUEEN_CASTLE) {
    board[m.to + 1] = board[m.to - 2];
    board[m.to - 2] = EMPTY;
  }

  // Castling rights, once lost, are never regained.
  let castling = position.castling;
  if (type === KING) {
    kings[turn] = m.to;
    castling &= turn === WHITE ? ~(WK | WQ) : ~(BK | BQ);
  }
  // A rook leaving home, or being captured at home, ends that side's right.
  for (const sq of [m.from, m.to]) {
    if (sq === H1) castling &= ~WK;
    else if (sq === A1) castling &= ~WQ;
    else if (sq === H8) castling &= ~BK;
    else if (sq === A8) castling &= ~BQ;
  }

  // The chance to capture en passant lasts exactly one move.
  const ep = (m.flags & FLAG.BIG_PAWN) ? m.to - us * 16 : -1;

  const captured = (m.flags & (FLAG.CAPTURE | FLAG.EP_CAPTURE)) !== 0;

  return {
    board,
    turn: opposite(turn),
    castling,
    ep,
    halfmove: (type === PAWN || captured) ? 0 : position.halfmove + 1,
    fullmove: position.fullmove + (turn === BLACK ? 1 : 0),
    kings,
  };
}

/**
 * Find the legal move matching a from/to square pair, or null if there isn't
 * one. This is the gate every mode and the server go through: a move that
 * isn't in this list cannot be played, by anyone, by any route.
 */
export function findMove(position, from, to, promotion = null) {
  const fromSq = typeof from === 'string' ? squareOf(from) : from;
  const toSq = typeof to === 'string' ? squareOf(to) : to;
  const wanted = typeof promotion === 'string'
    ? { q: QUEEN, r: ROOK, b: BISHOP, n: KNIGHT }[promotion.toLowerCase()] ?? 0
    : promotion || 0;

  for (const m of legalMoves(position, fromSq)) {
    if (m.to !== toSq) continue;
    if (m.flags & FLAG.PROMOTION) {
      if (wanted && m.promotion !== wanted) continue;
      if (!wanted && m.promotion !== QUEEN) continue;   // default to a queen
    }
    return m;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * How the game stands
 * ------------------------------------------------------------------ */

/** One of: 'playing' · 'check' · 'checkmate' · 'stalemate'. */
export function status(position) {
  const hasMoves = legalMoves(position).length > 0;
  const inCheck = isInCheck(position);
  if (!hasMoves) return inCheck ? 'checkmate' : 'stalemate';
  return inCheck ? 'check' : 'playing';
}

export function isGameOver(position) {
  const s = status(position);
  return s === 'checkmate' || s === 'stalemate';
}

/* ------------------------------------------------------------------ *
 * The proof
 * ------------------------------------------------------------------ */

/**
 * Count every legal sequence of moves to a given depth.
 *
 * Chess has published answers for these counts. If ours match, the rules are
 * right — not "look right", right. This is the project's correctness gate and
 * it runs before any of the game is built on top.
 */
export function perft(position, depth) {
  if (depth <= 0) return 1;
  const moves = legalMoves(position);
  if (depth === 1) return moves.length;
  let total = 0;
  for (const m of moves) total += perft(makeMove(position, m), depth - 1);
  return total;
}

/** Perft broken down by first move — the tool you use when a count is wrong. */
export function perftDivide(position, depth) {
  const out = {};
  for (const m of legalMoves(position)) {
    out[m.uci] = perft(makeMove(position, m), depth - 1);
  }
  return out;
}
