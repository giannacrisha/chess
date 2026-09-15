/**
 * gichess — the board you touch.
 *
 * This draws a position and lets a person move a piece, with mouse, finger or
 * keyboard-driven clicks. It does NOT decide anything about chess: it asks
 * rules.js what is legal and offers exactly that, which is why an illegal move
 * here is not "rejected" but simply unavailable. There is no path through this
 * file that produces a move `rules.js` did not hand it.
 */

import {
  legalMoves, FLAG, algebraic, fileOf, rankOf, SQUARES, colourOf, typeOf,
  QUEEN, ROOK, BISHOP, KNIGHT,
} from './rules.js';
import { installPieceDefs, pieceSVGFromValue, pieceSVG } from './pieces.js';

const DRAG_THRESHOLD = 5;   // pixels of movement before a click becomes a drag

export class Board {
  /**
   * @param {HTMLElement} frame  the element to build the board inside
   * @param {object} options
   *   onMove(from, to, promotion) — called with algebraic squares when the
   *     person completes a legal move. Nothing has been applied yet; the owner
   *     decides what to do with it.
   */
  constructor(frame, { onMove = () => {} } = {}) {
    installPieceDefs();
    this.frame = frame;
    this.onMove = onMove;

    this.position = null;
    this.lastMove = null;
    this.flipped = false;
    this.movable = 'both';      // 'both' | 'w' | 'b' | null (nothing movable)
    this.frozen = false;

    this.selected = -1;         // 0x88 square, or -1
    this.targets = new Map();   // target square → the move(s) that reach it
    this.drag = null;

    this.el = document.createElement('div');
    this.el.className = 'board';
    this.el.setAttribute('role', 'grid');
    this.el.setAttribute('aria-label', 'Chess board');
    this.frame.appendChild(this.el);

    this.squares = new Map();   // 0x88 square → element
    this._buildSquares();

    this.el.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    window.addEventListener('pointermove', (e) => this._onPointerMove(e));
    window.addEventListener('pointerup', (e) => this._onPointerUp(e));
    window.addEventListener('pointercancel', () => this._cancelDrag());
  }

  /* ---------------------------------------------------------------- *
   * Building and drawing
   * ---------------------------------------------------------------- */

  _buildSquares() {
    for (const sq of SQUARES) {
      const el = document.createElement('div');
      el.className = 'square';
      el.dataset.square = String(sq);
      el.setAttribute('role', 'gridcell');
      this.squares.set(sq, el);
    }
    this._layout();
  }

  /** Put the squares into the grid in the right reading order. */
  _layout() {
    const ranks = this.flipped ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const files = this.flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
    const order = [];
    for (const rank of ranks) for (const file of files) order.push(rank * 16 + file);

    for (const [index, sq] of order.entries()) {
      const el = this.squares.get(sq);
      const light = (fileOf(sq) + rankOf(sq)) % 2 === 1;
      el.classList.toggle('light', light);
      el.classList.toggle('dark', !light);

      // Coordinates engraved into the edge squares, as on a real board.
      const onBottomRow = index >= 56;
      const onLeftColumn = index % 8 === 0;
      el.dataset.file = onBottomRow ? 'abcdefgh'[fileOf(sq)] : '';
      el.dataset.rank = onLeftColumn ? String(rankOf(sq) + 1) : '';
      // Force render() to rebuild this square's contents: the piece on it may
      // be unchanged, but which coordinates it carries has just moved.
      delete el.dataset.value;

      this.el.appendChild(el);
    }
  }

  setFlipped(flipped) {
    if (this.flipped === flipped) return;
    this.flipped = flipped;
    this._layout();
    this.render();
  }

  /** Which colour this person is allowed to pick up. */
  setMovable(colour) {
    this.movable = colour;
    if (this.selected >= 0) this._deselect();
  }

  /** Freeze the board — the game is over, or it is the computer's turn. */
  setFrozen(frozen) {
    this.frozen = frozen;
    if (frozen && this.selected >= 0) this._deselect();
  }

  /**
   * Show a position. Pass the move that produced it and the piece slides into
   * place rather than teleporting.
   */
  setPosition(position, { lastMove = null, animate = true } = {}) {
    const previous = this.position;
    this.position = position;
    this.lastMove = lastMove;
    this._deselect();

    // Remember where the moving piece is on screen before we redraw, so we can
    // start it there and let CSS carry it to its new square.
    let slide = null;
    if (animate && lastMove && previous) {
      const fromEl = this.squares.get(lastMove.from);
      const toEl = this.squares.get(lastMove.to);
      if (fromEl && toEl) {
        const a = fromEl.getBoundingClientRect();
        const b = toEl.getBoundingClientRect();
        slide = { to: lastMove.to, dx: a.left - b.left, dy: a.top - b.top };
      }
    }

    this.render();

    if (slide && (slide.dx || slide.dy)) {
      const piece = this.squares.get(slide.to)?.querySelector('.piece');
      if (piece) {
        piece.style.transition = 'none';
        piece.style.transform = `translate(${slide.dx}px, ${slide.dy}px)`;
        requestAnimationFrame(() => {
          piece.style.transition = '';
          piece.style.transform = '';
        });
      }
    }
  }

  render() {
    if (!this.position) return;
    const { board, turn, kings } = this.position;
    const inCheckSquare = this._checkedKingSquare();

    for (const [sq, el] of this.squares) {
      const value = board[sq];
      const wanted = value === 0 ? '' : pieceSVGFromValue(value);

      // Only touch the DOM when something actually changed — this keeps the
      // slide animation from being wiped out by a needless redraw.
      if (el.dataset.value !== String(value)) {
        el.dataset.value = String(value);
        const coords =
          (el.dataset.file ? `<span class="coord file">${el.dataset.file}</span>` : '') +
          (el.dataset.rank ? `<span class="coord rank">${el.dataset.rank}</span>` : '');
        el.innerHTML = coords + wanted;
      }

      el.classList.toggle('last-move',
        !!this.lastMove && (sq === this.lastMove.from || sq === this.lastMove.to));
      el.classList.toggle('selected', sq === this.selected);
      el.classList.toggle('in-check', sq === inCheckSquare);
      el.classList.toggle('grabbable', this._canPickUp(value));

      const dot = el.querySelector('.dot');
      if (dot) dot.remove();
    }

    for (const [sq, moves] of this.targets) {
      const el = this.squares.get(sq);
      if (!el) continue;
      const isCapture = moves.some((m) => m.flags & (FLAG.CAPTURE | FLAG.EP_CAPTURE));
      const dot = document.createElement('span');
      dot.className = isCapture ? 'dot capture' : 'dot';
      el.appendChild(dot);
    }
  }

  _checkedKingSquare() {
    if (!this.position) return -1;
    const { turn, kings } = this.position;
    // Cheap: only ever true for the side to move.
    return this._inCheck ? kings[turn] : -1;
  }

  /** Told by the owner, so the board doesn't have to recompute it. */
  setCheck(inCheck) {
    this._inCheck = inCheck;
  }

  /* ---------------------------------------------------------------- *
   * Picking pieces up and putting them down
   * ---------------------------------------------------------------- */

  _canPickUp(value) {
    if (!this.position || this.frozen || value === 0) return false;
    const colour = colourOf(value);
    if (colour !== this.position.turn) return false;      // not your turn
    if (this.movable === null) return false;              // watching
    if (this.movable !== 'both' && this.movable !== colour) return false;
    return true;
  }

  _squareFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    const square = el?.closest?.('.square');
    return square ? Number(square.dataset.square) : -1;
  }

  _select(sq) {
    this.selected = sq;
    this.targets = new Map();
    for (const m of legalMoves(this.position, sq)) {
      if (!this.targets.has(m.to)) this.targets.set(m.to, []);
      this.targets.get(m.to).push(m);
    }
    this.render();
  }

  _deselect() {
    this.selected = -1;
    this.targets = new Map();
  }

  _onPointerDown(event) {
    if (event.button !== undefined && event.button > 0) return;
    const sq = this._squareFromPoint(event.clientX, event.clientY);
    if (sq < 0 || !this.position) return;

    // Putting a held piece down on one of its legal squares.
    if (this.selected >= 0 && this.targets.has(sq)) {
      event.preventDefault();
      this._commit(this.selected, sq);
      return;
    }

    const value = this.position.board[sq];
    if (!this._canPickUp(value)) {
      if (this.selected >= 0) { this._deselect(); this.render(); }
      return;
    }

    event.preventDefault();

    // Tapping the held piece again puts it back down.
    if (this.selected === sq) { this._deselect(); this.render(); return; }

    this._select(sq);

    // Stand ready to drag, without committing to it yet.
    this.drag = {
      from: sq,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      ghost: null,
      origin: this.squares.get(sq)?.querySelector('.piece') ?? null,
      value,
    };
  }

  _onPointerMove(event) {
    const drag = this.drag;
    if (!drag) return;

    if (!drag.active) {
      const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (moved < DRAG_THRESHOLD) return;
      drag.active = true;

      // Lift a copy of the piece out of the grid and carry it with the pointer.
      const size = this.squares.get(drag.from).getBoundingClientRect().width;
      const holder = document.createElement('div');
      holder.innerHTML = pieceSVGFromValue(drag.value);
      drag.ghost = holder.firstElementChild;
      drag.ghost.classList.add('dragging');
      drag.ghost.style.width = `${size}px`;
      drag.ghost.style.height = `${size}px`;
      document.body.appendChild(drag.ghost);
      if (drag.origin) drag.origin.style.opacity = '0.25';
    }

    drag.ghost.style.left = `${event.clientX}px`;
    drag.ghost.style.top = `${event.clientY}px`;

    const over = this._squareFromPoint(event.clientX, event.clientY);
    for (const [sq, el] of this.squares) {
      el.classList.toggle('hover-target', sq === over && this.targets.has(sq));
    }
  }

  _onPointerUp(event) {
    const drag = this.drag;
    if (!drag) return;

    if (!drag.active) { this.drag = null; return; }   // it was a click after all

    const target = this._squareFromPoint(event.clientX, event.clientY);
    this._cancelDrag();

    if (this.targets.has(target)) {
      this._commit(drag.from, target);
    } else {
      // Anywhere illegal, and the piece simply goes home. No error, because
      // nothing wrong has happened — that square was never on offer.
      this._deselect();
      this.render();
    }
  }

  _cancelDrag() {
    const drag = this.drag;
    if (!drag) return;
    drag.ghost?.remove();
    if (drag.origin) drag.origin.style.opacity = '';
    for (const el of this.squares.values()) el.classList.remove('hover-target');
    this.drag = null;
  }

  /** The person has chosen a legal destination. Ask about promotion if needed. */
  async _commit(from, to) {
    const moves = this.targets.get(to) ?? [];
    this._deselect();
    this.render();
    if (!moves.length) return;

    let promotion = null;
    if (moves[0].flags & FLAG.PROMOTION) {
      promotion = await this.askPromotion(colourOf(moves[0].piece));
      if (!promotion) return;      // dismissed: the move is cancelled entirely
    }

    this.onMove(algebraic(from), algebraic(to), promotion);
  }

  /* ---------------------------------------------------------------- *
   * The promotion chooser
   * ---------------------------------------------------------------- */

  /**
   * Show four gold pieces and wait. Resolves to 'q', 'r', 'b' or 'n', or to
   * null if the person dismissed it — in which case the move never happened.
   */
  askPromotion(colour) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'overlay';
      overlay.innerHTML = `
        <div class="promotion" role="dialog" aria-modal="true" aria-label="Choose a piece">
          <span class="promotion-title">Promote to</span>
          <div class="promotion-choices">
            ${[[QUEEN, 'q', 'Queen'], [ROOK, 'r', 'Rook'],
               [BISHOP, 'b', 'Bishop'], [KNIGHT, 'n', 'Knight']]
              .map(([type, letter, name]) => `
                <button class="promotion-choice" data-choice="${letter}"
                        aria-label="${name}">${pieceSVG(type, colour)}</button>`)
              .join('')}
          </div>
          <button class="btn btn-quiet" data-choice="">Cancel</button>
        </div>`;

      const finish = (choice) => {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
        resolve(choice || null);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') finish(null);
        const key = e.key.toLowerCase();
        if ('qrbn'.includes(key) && key.length === 1) finish(key);
      };

      overlay.addEventListener('click', (e) => {
        const button = e.target.closest('[data-choice]');
        if (button) finish(button.dataset.choice);
        else if (e.target === overlay) finish(null);
      });
      document.addEventListener('keydown', onKey);

      this.frame.appendChild(overlay);
      overlay.querySelector('.promotion-choice')?.focus();
    });
  }
}
