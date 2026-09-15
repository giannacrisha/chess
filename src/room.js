/**
 * gichess — one online game room.
 *
 * A Durable Object: a single object, existing exactly once in the world for a
 * given room code, with its own small SQLite database attached. Both players'
 * browsers open a WebSocket to this one object, which is what lets two phones
 * agree on a single chessboard.
 *
 * THIS OBJECT IS THE REFEREE. It owns the position. A browser asks to make a
 * move; it does not make one. Every move is checked against the same
 * rules.js the browsers use — one rulebook, no second opinion — so a modified
 * browser cannot cheat: it will simply be told no and sent the true position.
 *
 * THERE ARE NO TIMERS IN THIS FILE, by design. Cloudflare is free to put the
 * room to sleep between moves; the position is written to the database after
 * every single change, and read back when the next message arrives. Nothing is
 * held in memory that matters, so nothing is lost by being evicted.
 */

import { DurableObject } from 'cloudflare:workers';
import * as Rules from '../public/js/rules.js';

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;

    // One row for the game. One row per seated player.
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS game (
        id        INTEGER PRIMARY KEY CHECK (id = 1),
        fen       TEXT NOT NULL,
        outcome   TEXT,            -- null while playing, else how it ended
        winner    TEXT,            -- 'w' | 'b' | null
        last_from TEXT,
        last_to   TEXT
      )`);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS seats (
        token  TEXT PRIMARY KEY,   -- the browser's coat-check ticket
        role   TEXT NOT NULL,      -- 'w' | 'b'
        joined INTEGER NOT NULL
      )`);
  }

  /* ---------------------------------------------------------------- *
   * Opening the phone line
   * ---------------------------------------------------------------- */

  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // acceptWebSocket, rather than server.accept(), is what lets Cloudflare
    // hibernate this room between moves without dropping the connection.
    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  /* ---------------------------------------------------------------- *
   * Reading and writing the game
   * ---------------------------------------------------------------- */

  loadGame() {
    const rows = this.sql.exec('SELECT * FROM game WHERE id = 1').toArray();
    if (rows.length) return rows[0];

    const fresh = {
      fen: Rules.START_FEN, outcome: null, winner: null,
      last_from: null, last_to: null,
    };
    this.sql.exec('INSERT INTO game (id, fen) VALUES (1, ?)', fresh.fen);
    return fresh;
  }

  /** Written after every single change. This is instead of a timer. */
  saveGame(game) {
    this.sql.exec(
      `INSERT INTO game (id, fen, outcome, winner, last_from, last_to)
       VALUES (1, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         fen = excluded.fen, outcome = excluded.outcome,
         winner = excluded.winner,
         last_from = excluded.last_from, last_to = excluded.last_to`,
      game.fen, game.outcome ?? null, game.winner ?? null,
      game.last_from ?? null, game.last_to ?? null,
    );
  }

  /**
   * Which seat this browser holds. The token is a random string the browser
   * generated once and keeps: reload the page and you come back with the same
   * ticket, and get the same seat. It is not an account.
   */
  seatFor(token) {
    const mine = this.sql
      .exec('SELECT role FROM seats WHERE token = ?', token).toArray();
    if (mine.length) return mine[0].role;

    const taken = new Set(
      this.sql.exec('SELECT role FROM seats').toArray().map((r) => r.role));

    // First in plays White, second plays Black, everyone after that watches.
    const role = !taken.has('w') ? 'w' : !taken.has('b') ? 'b' : 'spectator';
    if (role !== 'spectator') {
      this.sql.exec(
        'INSERT INTO seats (token, role, joined) VALUES (?, ?, ?)',
        token, role, Date.now());
    }
    return role;
  }

  /* ---------------------------------------------------------------- *
   * What everyone is told
   * ---------------------------------------------------------------- */

  /**
   * The whole truth about the game, in one message.
   *
   * Browsers are sent the entire position, never a move to apply themselves.
   * That is deliberate: two browsers applying moves independently can drift
   * apart, whereas two browsers drawing a position they were handed cannot.
   */
  publicState() {
    const game = this.loadGame();
    const position = Rules.fromFEN(game.fen);

    let outcome = game.outcome;
    let winner = game.winner;
    if (!outcome) {
      const state = Rules.status(position);
      if (state === 'checkmate') {
        outcome = 'checkmate';
        winner = Rules.opposite(position.turn);
      } else if (state === 'stalemate') {
        outcome = 'stalemate';
        winner = null;
      }
    }

    // Who is actually on the line right now, so we can say "waiting for an
    // opponent" truthfully.
    const present = { w: false, b: false, watching: 0 };
    for (const ws of this.ctx.getWebSockets()) {
      const who = ws.deserializeAttachment();
      if (!who) continue;
      if (who.role === 'w' || who.role === 'b') present[who.role] = true;
      else present.watching++;
    }

    return {
      fen: game.fen,
      turn: position.turn,
      outcome: outcome ?? null,
      winner: winner ?? null,
      lastMove: game.last_from ? { from: game.last_from, to: game.last_to } : null,
      present,
    };
  }

  send(ws, type, payload) {
    try { ws.send(JSON.stringify({ type, payload })); } catch (e) { /* gone */ }
  }

  broadcastState() {
    const message = JSON.stringify({ type: 'state', payload: this.publicState() });
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(message); } catch (e) { /* that one has gone away */ }
    }
  }

  /** Say no, and immediately re-send the truth so the browser snaps back. */
  refuse(ws, reason) {
    this.send(ws, 'rejected', { reason });
    this.send(ws, 'state', this.publicState());
  }

  /* ---------------------------------------------------------------- *
   * Messages
   * ---------------------------------------------------------------- */

  async webSocketMessage(ws, raw) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch (e) {
      return this.send(ws, 'rejected', { reason: 'That was not a message.' });
    }

    const { type, payload } = message ?? {};
    const who = ws.deserializeAttachment();

    // Everything except the introduction requires having introduced yourself.
    if (type !== 'hello' && !who) {
      return this.send(ws, 'rejected', { reason: 'Say hello first.' });
    }

    switch (type) {
      case 'hello':     return this.onHello(ws, payload);
      case 'move':      return this.onMove(ws, who, payload);
      case 'newgame':   return this.onNewGame(ws, who);
      case 'resign':    return this.onResign(ws, who);
      default:
        return this.send(ws, 'rejected', { reason: `Unknown message: ${type}` });
    }
  }

  onHello(ws, payload) {
    const token = String(payload?.token ?? '').slice(0, 64);
    if (!token) return this.send(ws, 'rejected', { reason: 'No ticket.' });

    const role = this.seatFor(token);

    // Attach the identity to the socket itself, so that if Cloudflare puts
    // this room to sleep and wakes it later, it still knows who this is.
    ws.serializeAttachment({ token, role });

    this.send(ws, 'seated', { role });
    this.broadcastState();          // everyone learns someone arrived
  }

  onMove(ws, who, payload) {
    const game = this.loadGame();
    if (game.outcome) return this.refuse(ws, 'The game is already over.');

    if (who.role !== 'w' && who.role !== 'b') {
      return this.refuse(ws, 'You are watching this game.');
    }

    const position = Rules.fromFEN(game.fen);
    if (position.turn !== who.role) {
      return this.refuse(ws, "It is not your turn.");
    }

    // THE GATE. The same findMove every mode in the browser goes through.
    const move = Rules.findMove(
      position, payload?.from, payload?.to, payload?.promotion ?? null);
    if (!move) return this.refuse(ws, 'That is not a legal move.');

    const next = Rules.makeMove(position, move);
    this.saveGame({
      fen: Rules.toFEN(next),
      outcome: null,
      winner: null,
      last_from: Rules.algebraic(move.from),
      last_to: Rules.algebraic(move.to),
    });

    this.broadcastState();
  }

  onNewGame(ws, who) {
    if (who.role !== 'w' && who.role !== 'b') {
      return this.refuse(ws, 'Only the players can start a new game.');
    }
    this.saveGame({
      fen: Rules.START_FEN, outcome: null, winner: null,
      last_from: null, last_to: null,
    });
    this.broadcastState();          // the board resets for everyone at once
  }

  onResign(ws, who) {
    if (who.role !== 'w' && who.role !== 'b') {
      return this.refuse(ws, 'You are watching this game.');
    }
    const game = this.loadGame();
    if (game.outcome) return this.refuse(ws, 'The game is already over.');

    // The winner is enough: whoever resigned is the other one.
    this.saveGame({ ...game, outcome: 'resigned', winner: Rules.opposite(who.role) });
    this.broadcastState();
  }

  /** Someone closed their tab. Their seat is kept — they may come back. */
  async webSocketClose(ws) {
    this.broadcastState();
  }

  async webSocketError(ws) {
    this.broadcastState();
  }
}
