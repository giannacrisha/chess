/**
 * gichess — menus, modes and glue.
 *
 * This file owns the position and decides what the screen says. It never
 * decides what is legal: every move goes through rules.findMove, which returns
 * null for anything that is not a legal move in the current position. That is
 * the single gate, and it is the same gate the server uses.
 */

import * as Rules from './rules.js';
import { Board } from './board.js';

/* ------------------------------------------------------------------ *
 * The bits of the page we talk to
 * ------------------------------------------------------------------ */

const ui = {
  menu: document.getElementById('menu'),
  game: document.getElementById('game'),
  status: document.getElementById('status'),
  boardFrame: document.getElementById('board-frame'),
  newGame: document.getElementById('new-game'),
  resign: document.getElementById('resign'),
  soundToggle: document.getElementById('sound-toggle'),
  toMenu: document.getElementById('to-menu'),
  themeToggle: document.getElementById('theme-toggle'),
  computerOptions: document.getElementById('computer-options'),
  onlineOptions: document.getElementById('online-options'),
  startComputer: document.getElementById('start-computer'),
  startOnline: document.getElementById('start-online'),
  roomCode: document.getElementById('room-code'),
  trayTop: document.getElementById('tray-top'),
  trayBottom: document.getElementById('tray-bottom'),
};

/* ------------------------------------------------------------------ *
 * The game in progress
 * ------------------------------------------------------------------ */

const game = {
  mode: null,              // 'hotseat' | 'computer' | 'online'
  position: null,
  lastMove: null,
  playerColour: Rules.WHITE,   // which colour this person plays
  resigned: null,              // the colour that resigned, if any
  thinking: false,
};

let board;

/* ------------------------------------------------------------------ *
 * Theme
 * ------------------------------------------------------------------ */

function currentTheme() {
  const set = document.documentElement.getAttribute('data-theme');
  if (set) return set;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

ui.themeToggle.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('gichess-theme', next); } catch (e) { /* fine */ }
});

/* ------------------------------------------------------------------ *
 * Saying what is happening
 * ------------------------------------------------------------------ */

const COLOUR_NAME = { w: 'White', b: 'Black' };

/** The one place the game speaks. Returns { text, tone }. */
function describe() {
  const { position, resigned, thinking, mode } = game;
  if (!position) return { text: '', tone: '' };

  if (resigned) {
    return {
      text: `${COLOUR_NAME[resigned]} resigned — ${COLOUR_NAME[Rules.opposite(resigned)]} wins`,
      tone: 'is-over',
    };
  }

  const state = Rules.status(position);
  const turn = position.turn;

  if (state === 'checkmate') {
    return {
      text: `Checkmate — ${COLOUR_NAME[Rules.opposite(turn)]} wins`,
      tone: 'is-over',
    };
  }
  if (state === 'stalemate') {
    return { text: "Stalemate — it's a draw", tone: 'is-over' };
  }

  if (thinking) return { text: 'Thinking…', tone: '' };

  if (state === 'check') {
    return { text: `${COLOUR_NAME[turn]} is in check`, tone: 'is-check' };
  }

  if (mode === 'online' && game.online) {
    return { text: game.online.statusText(turn), tone: '' };
  }

  return { text: `${COLOUR_NAME[turn]} to move`, tone: '' };
}

function isOver() {
  if (game.resigned) return true;
  const state = Rules.status(game.position);
  return state === 'checkmate' || state === 'stalemate';
}

/** Redraw the status line, the board, and which controls make sense. */
function refresh({ animate = true } = {}) {
  const { text, tone } = describe();
  ui.status.className = `status ${tone}`.trim();

  const inCheck = !!game.position && Rules.isInCheck(game.position);
  board.setCheck(inCheck && !isOver());

  // A small gold or bronze disc, so whose turn it is reads at a glance.
  const showDot = !isOver() && !game.thinking;
  ui.status.innerHTML =
    (showDot ? `<span class="turn-dot" data-colour="${game.position.turn}"></span>` : '') +
    `<span>${text}</span>`;

  board.setPosition(game.position, { lastMove: game.lastMove, animate });
  board.setFrozen(isOver() || game.thinking);

  ui.resign.hidden = !game.resignable || isOver();
  updateTrays();
}

/* ------------------------------------------------------------------ *
 * Playing a move
 * ------------------------------------------------------------------ */

/**
 * The single door every move in this browser goes through.
 * Returns the move that was played, or null if it was not legal.
 */
function play(from, to, promotion) {
  if (isOver()) return null;
  const move = Rules.findMove(game.position, from, to, promotion);
  if (!move) return null;                       // not legal: nothing happens

  game.position = Rules.makeMove(game.position, move);
  game.lastMove = move;
  return move;
}

/** What happens when the person on this screen moves a piece. */
function onPersonMoved(from, to, promotion) {
  if (game.mode === 'online') { game.online.sendMove(from, to, promotion); return; }

  const move = play(from, to, promotion);
  if (!move) return;
  sound?.forMove(move, game.position);
  refresh();

  if (game.mode === 'computer' && !isOver()) takeComputerTurn();
}

/* ------------------------------------------------------------------ *
 * Starting and stopping
 * ------------------------------------------------------------------ */

function startGame(mode, options = {}) {
  game.online?.close?.();
  game.mode = mode;
  game.position = Rules.newGame();
  game.lastMove = null;
  game.resigned = null;
  game.thinking = false;
  game.online = null;
  game.playerColour = options.colour ?? Rules.WHITE;
  game.resignable = mode !== null;

  ui.menu.hidden = true;
  ui.game.hidden = false;

  board.setFlipped(mode !== 'hotseat' && game.playerColour === Rules.BLACK);
  board.setMovable(mode === 'hotseat' ? 'both' : game.playerColour);

  refresh({ animate: false });

  if (mode === 'computer' && game.playerColour === Rules.BLACK) takeComputerTurn();
}

function toMenu() {
  game.online?.close?.();
  game.online = null;
  game.mode = null;
  ui.game.hidden = true;
  ui.menu.hidden = false;
  closeAllOptions();
}

function newGame() {
  if (game.mode === 'online') { game.online.sendNewGame(); return; }
  startGame(game.mode, { colour: game.playerColour });
}

function resign() {
  if (isOver()) return;
  const who = game.mode === 'hotseat' ? game.position.turn : game.playerColour;
  if (!confirm(`Resign the game for ${COLOUR_NAME[who]}?`)) return;
  if (game.mode === 'online') { game.online.sendResign(); return; }
  game.resigned = who;
  refresh({ animate: false });
}

/* ------------------------------------------------------------------ *
 * Filled in by later phases
 * ------------------------------------------------------------------ */

let engine = null;     // the computer opponent
let sound = null;      // move sounds

async function takeComputerTurn() { /* wired up in Phase 2 */ }
function updateTrays() { /* wired up in Phase 4 */ }

/* ------------------------------------------------------------------ *
 * The menu
 * ------------------------------------------------------------------ */

const OPTION_PANELS = {
  computer: ui.computerOptions,
  online: ui.onlineOptions,
};

function closeAllOptions() {
  for (const panel of Object.values(OPTION_PANELS)) panel.hidden = true;
  for (const b of document.querySelectorAll('.mode')) b.setAttribute('aria-expanded', 'false');
}

for (const button of document.querySelectorAll('.mode')) {
  button.addEventListener('click', () => {
    const mode = button.dataset.mode;
    if (mode === 'hotseat') { startGame('hotseat'); return; }

    const panel = OPTION_PANELS[mode];
    const wasOpen = !panel.hidden;
    closeAllOptions();
    if (!wasOpen) {
      panel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      if (mode === 'online') ui.roomCode.focus();
    }
  });
}

// White / Black for the computer game.
let chosenColour = Rules.WHITE;
for (const choice of ui.computerOptions.querySelectorAll('.choice')) {
  choice.addEventListener('click', () => {
    chosenColour = choice.dataset.colour;
    for (const other of ui.computerOptions.querySelectorAll('.choice')) {
      other.setAttribute('aria-pressed', String(other === choice));
    }
  });
}

ui.startComputer.addEventListener('click', () => startGame('computer', { colour: chosenColour }));
ui.newGame.addEventListener('click', newGame);
ui.resign.addEventListener('click', resign);
ui.toMenu.addEventListener('click', toMenu);

/* ------------------------------------------------------------------ *
 * Room codes — four letters, none of them easily mistaken for another
 * ------------------------------------------------------------------ */

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // no I, no O

export function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export function tidyCode(text) {
  return String(text || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
}

ui.roomCode.value = randomCode();
ui.roomCode.addEventListener('input', () => {
  ui.roomCode.value = tidyCode(ui.roomCode.value);
});

/* ------------------------------------------------------------------ *
 * Go
 * ------------------------------------------------------------------ */

board = new Board(ui.boardFrame, { onMove: onPersonMoved });
game.position = Rules.newGame();
board.setPosition(game.position, { animate: false });

// Handy for poking at things from the browser console.
window.gichess = { game, board, Rules, play, refresh };
