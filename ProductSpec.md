# gichess — Product Specification

**Owner:** giannacrisha · **Status:** approved for build · **Date:** 2026-09-15

This document says precisely what gichess is, what it looks like, and how each
piece of it must behave. Terms are defined once in the glossary in
[README.md](README.md) and are not re-explained here.

---

## 1. What this is, and who it is for

gichess is a chess game that lives at a web address. You open the link and you
are playing within one click. There is nothing to install, no account to make,
and no email to give.

It exists for three situations:

1. Two people in the same room with one laptop between them.
2. One person alone, who wants an opponent.
3. Two people in different places who want to play right now, with nothing more
   than a word they both agree on.

Anyone who gets the link can play. That is the whole product.

---

## 2. Design language

The look is taken from [giannacrisha.com](https://giannacrisha.com). These are
that site's real values, not approximations, and they are the source of truth
for every colour and typeface in the game.

### 2.1 Colour

The site ships a light and a dark theme, switched by a `data-theme` attribute on
the page. gichess carries both across and follows the visitor's system setting,
with a toggle in the corner exactly as the site has.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--color-bg` | `#fffdfa` | `#1a1a1a` | Page ground |
| `--color-fg` | `#3d2f1f` | `#e8e0d0` | Body text |
| `--color-heading` | `#90642f` | `#d8af78` | Headings, the wordmark, the active-turn marker |
| `--color-card` | `#ffffff` | `#242424` | Panels — the status bar, the captured tray, the menu card |
| `--color-muted` | `#6B5234` | `#b8aa97` | Secondary text |
| `--color-accent` | `#9C8B6E` | `#b5a07a` | Lines, quiet emphasis |
| `--color-accent-light` | `#EDE5D8` | `#2a2820` | **Light board squares** |
| `--color-border` | `#E8DCC8` | `#333333` | Hairlines |
| `--color-pill-bg` | `#E8DDD0` | `#242424` | Buttons at rest |
| `--color-pill-text` | `#6B5C47` | `#c8b898` | Button labels |
| `--color-accent-border` | `#C4B49A` | `#4a4840` | **Dark board squares**, button outlines |
| `--color-danger` | `#e5534b` | `#e5534b` | Checkmate, resign |

Two derived values the game adds, in keeping with the above:

- `--square-light: var(--color-accent-light)` and
  `--square-dark: var(--color-accent-border)` — the board is a cream/sand
  chequer, never black-and-white.
- `--square-selected`, `--square-last-move`: a translucent wash of
  `--color-heading` at 22% and 14% opacity respectively.

### 2.2 The gold

The single most important visual token is the site's gold gradient, used there
on cards and taken here for the pieces:

```css
--card-grad: linear-gradient(145deg,
  #3E2710 0%, #82592B 25%, #90642F 30%, #CA9F57 60%, #82592B 100%);
```

and its companion shadow:

```css
--shadow-gold: 0 4px 16px rgba(144, 100, 47, .25);
```

### 2.3 Type

| Token | Face | Used for |
|---|---|---|
| `--font-display` | **Jacquard 12** | The `gichess` wordmark only. A blackletter display face — this is where "royal" comes from. |
| `--font-serif` | **Lora** | Turn and game-status messages, mode names. |
| `--font-body` | **Atkinson Hyperlegible Next** | Buttons, labels, the room code field, all UI. |
| `--font-mono` | **Iosevka** | The room code itself, where character-by-character clarity matters. |

Shape tokens, also from the site: `--radius-card: 12px`,
`--radius-pill: 20px`, `--radius-input: 12px`, `--radius-lg: 30px`.

### 2.4 The pieces — "royal, gold, 3D"

The pieces are hand-drawn **SVG** shapes — vector line art, drawn with maths
rather than pixels, so they stay perfectly sharp at any size — filled with the
gold gradient above. They read as sculpted metal, not as flat symbols, through
four stacked layers per piece:

1. **The body**, filled with `--card-grad` rotated to light from the upper left.
2. **A specular highlight** — a soft light shape along the upper-left edge,
   which is what makes metal look like metal.
3. **A contact shadow** beneath the piece, sitting on the square, which is what
   makes it look like it is *on* the board rather than printed into it.
4. **A dark rim** at the silhouette edge, for separation against light squares.

Black's pieces use the same sculpted forms in a darkened, cooler variant of the
same gradient (`#2b1d0d → #6b4a22 → #8a6a3a`), so both armies read as cast
metal from the same foundry — antique gold against dark bronze. Two golds, not
gold against plastic.

No 3D library, no WebGL, no downloaded models. The depth is drawn.

**Motion.** A piece slides to its destination over 180ms. Captured pieces fade.
Nothing bounces. All motion is disabled when the visitor's system asks for
reduced motion.

### 2.5 Layout

One screen, centre-weighted, working from 360px wide (a phone held upright) to a
large desktop display.

```
        gichess                        [theme]
  ─────────────────────────────────────────────
        White to move
  ┌───────────────────────────────┐
  │                               │
  │         the board             │   ← square, max min(92vw, 640px)
  │                               │
  └───────────────────────────────┘
   captured pieces · black
   captured pieces · white
  ─────────────────────────────────────────────
     [ New game ]      [ Resign ]     [ Menu ]
```

On a phone the board keeps its full width and the trays stack beneath it. The
board never scrolls sideways and is never cropped.

---

## 3. Screens

### 3.1 Menu

The landing state. The `gichess` wordmark in Jacquard 12, and three choices:

- **Hot-seat** — "Two players, one screen."
- **Vs computer** — "Play the machine." Reveals a White / Black choice, with
  White preselected.
- **Online** — "Play someone anywhere." Reveals a room-code field with a
  four-letter code already generated and filled in, plus a *Join* button for
  typing someone else's code.

Room codes are four letters from an alphabet with no visually confusable
characters, shown in Iosevka, uppercase, and accepted case-insensitively.

### 3.2 Game

Board, status line, controls. The status line is the only place the game speaks,
and it says exactly one of:

| Situation | Text |
|---|---|
| Normal | "White to move" / "Black to move" |
| In check | "White is in check" |
| Checkmate | "Checkmate — Black wins" |
| Stalemate | "Stalemate — it's a draw" |
| Computer thinking | "Thinking…" |
| Online, waiting | "Waiting for an opponent — share the code GOLD" |
| Online, watching | "You're watching. White to move." |
| Resigned | "White resigned — Black wins" |

Checkmate and stalemate also freeze the board and surface **New game**.

---

## 4. The rules — `public/js/rules.js`

### 4.1 The rule of one rulebook

There is exactly one chess implementation in this project. The browser imports
it; the Cloudflare Worker imports the same file by relative path. It takes no
dependencies, uses nothing browser-specific and nothing server-specific, and is
never copied or forked. If the rules are ever wrong, they are wrong in exactly
one place.

### 4.2 What it must implement

All six pieces with their full movement. Captures. Check. Checkmate. Stalemate.
Castling on both sides for both colours, with all four of its conditions (the
king and that rook unmoved; the squares between them empty; the king not
currently in check; and the king passing through no attacked square). En
passant, including the fact that the right to it expires after exactly one move.
Promotion on reaching the last rank, with the player choosing queen, rook,
bishop or knight.

Deliberately excluded, per scope: threefold repetition and the fifty-move rule.
The half-move counter is still tracked and stored, so either could be added
later without touching anything else.

### 4.3 The shape of it

A position is a plain object — no classes, no hidden state:

```js
{ board, turn, castling, ep, halfmove, fullmove }
```

The board is a 128-square array using the **0x88** layout: a standard chess
technique where the board is stored as two side-by-side 8-wide halves, so that
"is this square off the edge?" is answered by a single arithmetic test rather
than four comparisons. It is the reason move generation is fast enough to run
the proof test in under a second.

Public functions:

| Function | Does |
|---|---|
| `newGame()` | The starting position |
| `legalMoves(position)` | Every legal move, as objects |
| `makeMove(position, move)` | A **new** position. The input is never modified. |
| `isInCheck(position, colour)` | True or false |
| `status(position)` | `playing` · `check` · `checkmate` · `stalemate` |
| `toFEN(position)` / `fromFEN(text)` | Convert to and from the one-line text form |
| `perft(position, depth)` | Count legal move sequences — the proof |

Positions are treated as immutable — `makeMove` returns a new one rather than
editing the old one. This is what makes "refresh and rejoin" and undo-free
server logic simple: a position is a value you can store, send, and compare,
never a thing that changes behind your back.

### 4.4 The proof

The required counts from the starting position:

| Depth | Legal sequences |
|---|---|
| 1 | 20 |
| 2 | 400 |
| 3 | 8,902 |

**These three numbers are necessary but not sufficient**, and it matters:
starting from the opening position, no castling, en passant, or promotion is
reachable within three moves. A rulebook could pass all three and still get
every special rule wrong.

So the test also runs four standard published positions chosen precisely because
they are dense in the special cases:

| Position | Exercises | Depths 1 / 2 / 3 |
|---|---|---|
| Start | Baseline | 20 / 400 / 8,902 |
| "Kiwipete" | Castling both sides, pins, en passant | 48 / 2,039 / 97,862 |
| Endgame | En passant, promotion races | 14 / 191 / 2,812 |
| Promotion | Under-promotion, checks | 6 / 264 / 9,467 |
| Tactical | Promotion with capture | 44 / 1,486 / 62,379 |

The starting position also runs to depth 4 (197,281).

**This test passing is a gate.** No board is drawn, no screen is styled, and no
mode is built until it is green. If the rules are wrong, everything built on
them is wrong in ways that are miserable to find later.

---

## 5. Mode 1 — Hot-seat

Two people, one screen. The board turns over between them.

- Both players use the same board. The board does **not** flip between turns
  (flipping is disorienting for two people sitting side by side); instead the
  active colour is marked clearly in the status line.
- A player may only touch pieces of the colour whose turn it is.
- **Illegal moves are impossible.** Selecting a piece shows its legal
  destinations as gold dots; those are the only squares that will accept the
  piece. Dragging anywhere else returns it home. There is no error message
  because there is no error to report.
- Both click-then-click and drag-and-drop work. Touch is treated as a first-class
  input, not an afterthought.
- Promotion opens a small panel of four gold pieces. The move is not committed
  until one is chosen; dismissing it cancels the move entirely.
- **New game** returns to the starting position.

---

## 6. Mode 2 — Vs computer

The player chooses White or Black at the start; White is preselected. The
browser plays the other colour.

- **Where it runs.** Entirely in the visitor's browser. Nothing is sent
  anywhere. This costs nothing to run and works offline once loaded.
- **How it thinks.** Minimax with alpha–beta pruning, searching to **depth 2**
  (its move, then the player's best reply).
- **How it judges a position.** Material value first — pawn 100, knight 320,
  bishop 330, rook 500, queen 900 — plus a piece-square table, a small table
  per piece type that nudges pieces toward good squares. Knights are worth more
  in the centre than on the rim; pawns gain value as they advance; the king
  prefers to be tucked behind its pawns. This is what stops it playing
  aimlessly when nothing is hanging.
- **Speed.** Depth 2 from any position is a few thousand positions — a handful
  of milliseconds. The two-second requirement is met with enormous margin. A
  deliberate short pause is added before it moves, so the reply feels considered
  rather than instant, and the status line reads "Thinking…" throughout.
- **Correctness.** Its move always comes from `legalMoves()`. It is not capable
  of producing an illegal move, because it never constructs a move itself.
- If it is checkmated or stalemated it has no moves, and the game ends normally.

---

## 7. Mode 3 — Online

Two devices, one room code, moves appearing live on both.

### 7.1 The shape of it

Each room code gets its own **Durable Object** — one object, existing once
globally, holding that game. Both browsers open a WebSocket to it. It is the
referee: it owns the position, it decides every move, and it tells both
browsers what happened.

Browsers are never trusted. A browser asks to make a move; it does not make one.

### 7.2 Seats

- The first person to connect is **White**.
- The second is **Black**.
- Everyone after that is a **spectator** — they see the game live and cannot
  move.

Seats are recorded in the room's database against a random token the browser
generates once and keeps in its own storage. That token is what makes refresh
work: reload the page and you reconnect with the same token, and the room hands
you back the same seat rather than treating you as a new arrival. It is not an
account — it is a coat check ticket.

A connection's identity is also attached to the WebSocket itself with
`serializeAttachment`, so that if Cloudflare puts the room to sleep between
moves and wakes it later, it still knows who is on the other end of each
connection.

### 7.3 The conversation

Every message both directions is JSON with exactly two fields, `type` and
`payload`.

**Browser → room**

| `type` | `payload` | Meaning |
|---|---|---|
| `hello` | `{ token }` | I'm here; this is my ticket |
| `move` | `{ from, to, promotion? }` | I would like to play this |
| `newgame` | `{}` | Reset the board |
| `resign` | `{}` | I resign |

**Room → browser**

| `type` | `payload` | Meaning |
|---|---|---|
| `seated` | `{ role, code }` | You are White / Black / a spectator |
| `state` | `{ fen, status, lastMove, players, winner? }` | The truth. Draw this. |
| `rejected` | `{ reason }` | That move was not legal, or not yours to make |

There is one authoritative message — `state` — and it carries the whole
position. Browsers never patch their board from a move message and hope they
stay in sync; they are told the position and they draw it. Drift is therefore
impossible by construction.

### 7.4 Persistence

The room writes the position to its SQLite database **after every single move**.
Not on a timer — there are no timers anywhere in this project. Cloudflare is
free to evict the room from memory between moves; when the next message
arrives, it reads the position back and continues.

Two tables: one row holding the current game, and one row per seat token.

### 7.5 Requirements

- Two browsers, two devices: each sees the other's move within a second.
- An illegal move is refused by the room even if a browser is modified to send
  one. The offending browser is re-sent the true position and snaps back.
- Refreshing either browser rejoins the same game, same seat, same position.
- A third visitor with the code watches, and cannot move.
- **New game** resets the board for everyone in the room at once.
- If an opponent's connection drops, the game is not destroyed; they reconnect
  into their seat and play continues.

---

## 8. Extras — built last, and only once everything above works

1. **Captured pieces** — small gold pieces in trays either side of the board,
   with a running material advantage.
2. **Sound** — a soft wooden knock on a move, a firmer one on a capture, a
   distinct note on check. Off by default is wrong; on by default with a clear
   mute control is right. The preference is remembered.
3. **Resign** — a button, with one confirmation step, which ends the game and
   names the winner. Online, it tells the room, and the room tells both players.

---

## 9. Technical constraints

Non-negotiable, and repeated here so they are testable:

- Cloudflare Workers, **Free plan**.
- Static files served with `assets` in `wrangler.jsonc`, with
  `not_found_handling: "single-page-application"`, and `run_worker_first`
  scoped to the WebSocket path only — so that the game's files are served
  straight from Cloudflare's edge without our code running, and only online
  traffic touches the Worker.
- `compatibility_date` set to the build date; `observability` enabled.
- Rules written by hand in one module. **No `chess.js`. No engine library.**
- **No Socket.IO. No Express. No `ws`.** Cloudflare's native WebSocket support,
  accepted with `ctx.acceptWebSocket()`.
- One SQLite-backed Durable Object per room, reached with
  `env.ROOM.getByName(roomCode)`, declared with `new_sqlite_classes`.
- **No timers of any kind.** State is saved after every move instead.
- Plain HTML, CSS and JavaScript. **No React**, no build step, no bundler for
  the front end — the browser loads the modules directly.

---

## 10. Out of scope

Accounts · logins · clocks · ratings · threefold repetition · the fifty-move
rule · opening books · PGN export · React.

---

## 11. Decisions taken, and why

| Decision | Choice | Reason |
|---|---|---|
| Design source | giannacrisha.com's live tokens | No Figma file was available; the site is the real, authoritative brand. |
| Computer's colour | Player chooses, White preselected | The brief left it open; choosing is strictly more capable than not. |
| Board orientation, hot-seat | Does not flip | Two people side by side share one point of view. |
| Board orientation, online | Each player sees their own colour at the bottom | Each player has their own screen. |
| 3D pieces | Layered SVG, not WebGL | Matches the site's drawn-gold treatment, weighs almost nothing, and works everywhere. |
| Rules proof | Five positions, not one | The three required counts cannot reach castling, en passant or promotion. |

---

## 12. Still open

- Nothing blocking. If a Figma file appears later, §2 is the section that would
  be revisited, and only §2.
