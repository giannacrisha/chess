/**
 * gichess — talking to the room.
 *
 * This browser asks; it never decides. It sends a move it believes is legal and
 * then draws whatever position comes back. It does not apply its own move
 * hopefully and wait to be corrected, because two browsers doing that can drift
 * apart. Being handed the whole position every time makes drift impossible
 * rather than merely unlikely.
 */

/**
 * This browser's coat-check ticket.
 *
 * A random string, generated once and kept. It is how the room recognises you
 * after a refresh and gives you your seat back. It is not an account, it says
 * nothing about who you are, and it never leaves this room.
 */
function ticket() {
  const KEY = 'gichess-ticket';
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
    const fresh = crypto.randomUUID();
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch (e) {
    // Private browsing, or storage turned off. A ticket that lasts as long as
    // the page does still works; it just will not survive a refresh.
    return (ticket.fallback ??= crypto.randomUUID());
  }
}

/** How long to wait before trying to reconnect, growing up to ten seconds. */
const RECONNECT_STEPS = [300, 800, 1500, 3000, 6000, 10000];

export class OnlineGame {
  /**
   * @param {string} code  the four-letter room code
   * @param {object} handlers
   *   onSeated(role)   — 'w', 'b' or 'spectator'
   *   onState(state)   — the whole truth; draw this
   *   onRejected(why)  — the room said no
   *   onConnection(up) — whether the line is currently open
   */
  constructor(code, { onSeated, onState, onRejected, onConnection }) {
    this.code = code;
    this.handlers = { onSeated, onState, onRejected, onConnection };
    this.role = null;
    this.closedByUs = false;
    this.attempt = 0;
    this.retry = null;
    this.open();
  }

  open() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${location.host}/ws/${this.code}`);

    this.ws.addEventListener('open', () => {
      this.attempt = 0;
      this.handlers.onConnection?.(true);
      this.send('hello', { token: ticket() });
    });

    this.ws.addEventListener('message', (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch (e) { return; }
      const { type, payload } = message ?? {};

      if (type === 'seated') {
        this.role = payload.role;
        this.handlers.onSeated?.(payload.role);
      } else if (type === 'state') {
        this.handlers.onState?.(payload);
      } else if (type === 'rejected') {
        this.handlers.onRejected?.(payload?.reason ?? 'No.');
      }
    });

    this.ws.addEventListener('close', () => {
      this.handlers.onConnection?.(false);
      if (this.closedByUs) return;

      // The room keeps our seat, so reconnecting simply picks up where we
      // left off. (This delay is in the browser; there are no timers at all
      // on the server, which saves after every move instead.)
      const wait = RECONNECT_STEPS[Math.min(this.attempt++, RECONNECT_STEPS.length - 1)];
      this.retry = setTimeout(() => this.open(), wait);
    });
  }

  send(type, payload = {}) {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ type, payload }));
    return true;
  }

  sendMove(from, to, promotion) { return this.send('move', { from, to, promotion }); }
  sendNewGame() { return this.send('newgame'); }
  sendResign() { return this.send('resign'); }

  close() {
    this.closedByUs = true;
    clearTimeout(this.retry);
    try { this.ws?.close(); } catch (e) { /* already gone */ }
  }
}
