# gichess — Feature Roadmap & Work Plan

**Owner:** giannacrisha · **Date:** 2026-09-15

Every task below has three things: what it **depends on**, which **files** it
touches, and a **definition of done** — a statement that is either true or false,
never a matter of opinion. A task is finished when its definition of done is
demonstrably true, not when the code is written.

**Working agreement**

- One task per commit. Commit, then push, then move on.
- Work happens on a branch and lands through a pull request. Nothing is ever
  force-pushed.
- Tasks are done in order. Where a task has no dependency listed, it depends on
  the one before it.
- 🔒 marks a **gate**: nothing after it starts until it is green.

**The order, and why:** hot-seat live on the internet first — because a real
address you can send to someone is worth more than three half-features on a
laptop. Then the computer opponent. Then online rooms. Then the extras.

---

## Phase 0 — Foundation  ·  *the three documents*

- [x] **T0.1 — README**
  - Depends on: nothing
  - Files: `README.md`
  - Done when: the project, the three modes, every technical term, the
    definition of finished, and the run/deploy commands are all written down.

- [x] **T0.2 — Product specification**
  - Depends on: T0.1
  - Files: `ProductSpec.md`
  - Done when: the design tokens, every screen, the rules contract, all three
    modes, the online message protocol and the constraints are specified
    precisely enough to build from without further questions.

- [x] **T0.3 — This work plan**
  - Depends on: T0.2
  - Files: `FEATUREROADMAP_workplan.md`
  - Done when: every feature appears as a checkbox task with dependencies,
    files and a definition of done, in build order.

---

## Phase 1 — The rulebook, and hot-seat live on the internet

*Goal of this phase: a public web address where two people can play a complete,
correct game of chess on one screen.*

### 1a. Scaffolding

- [x] **T1.1 — Project skeleton**
  - Depends on: T0.3
  - Files: `package.json`, `wrangler.jsonc`, `public/index.html`
  - What: the Cloudflare settings file (name `gichess`, today's
    `compatibility_date`, `observability` on, `assets` pointing at `public/`
    with `not_found_handling: "single-page-application"`), and npm commands
    `dev`, `test`, `deploy`.
  - Done when: `npm run dev` serves a page saying "gichess" at
    `localhost:8787`, and `npx wrangler deploy --dry-run` reports no config
    errors.

### 1b. The rules — the heart of the project

- [x] **T1.2 — Board representation and piece movement**
  - Depends on: T1.1
  - Files: `public/js/rules.js`
  - What: the 0x88 board, `newGame()`, FEN in and out, and pseudo-legal move
    generation for all six pieces (pseudo-legal = movement is correct but we
    have not yet checked whether it leaves our own king in check).
  - Done when: from the starting position the generator produces 20 moves, and
    a position loaded from FEN and written back out returns the identical FEN
    string.

- [x] **T1.3 — Legality, castling, en passant, promotion**
  - Depends on: T1.2
  - Files: `public/js/rules.js`
  - What: filter out moves that leave your own king attacked; castling with all
    four of its conditions; en passant including its one-move expiry; promotion
    producing four separate moves, one per choice of piece.
  - Done when: a position where a pinned piece appears able to move yields no
    such move; castling is offered when legal and withheld when the king is in
    check, passes through an attacked square, or has moved; an en passant
    capture is offered on the move after a double pawn push and not the move
    after that.

- [x] 🔒 **T1.4 — The proof: move-counting test**
  - Depends on: T1.3
  - Files: `test/perft.test.js`, `package.json`
  - What: count every legal move sequence to a given depth and compare against
    the published answers. Five positions, chosen so that castling, en passant
    and promotion are all actually exercised — the starting position alone
    cannot reach any of them in three moves.
  - Done when: `npm test` passes with **depth 1 = 20, depth 2 = 400,
    depth 3 = 8,902** from the start position, plus depth 4 = 197,281, plus the
    four supplementary positions in ProductSpec §4.4, and the whole run finishes
    in under 30 seconds.
  - **GATE. Nothing below this line begins until this test is green.**
    If it fails, the only work permitted is fixing `rules.js`.

- [x] **T1.5 — Game status**
  - Depends on: T1.4
  - Files: `public/js/rules.js`, `test/perft.test.js`
  - What: `status()` returning `playing`, `check`, `checkmate` or `stalemate`.
  - Done when: a known back-rank mate reports `checkmate`, a known stalemate
    position reports `stalemate`, and a position in check with escapes available
    reports `check`. Tested, not eyeballed.

### 1c. The look

- [x] **T1.6 — Design system**
  - Depends on: T1.1 *(may run in parallel with 1b)*
  - Files: `public/css/gichess.css`, `public/index.html`
  - What: every token from ProductSpec §2 as CSS custom properties, in both
    light and dark; the four web fonts loaded; the page shell, the wordmark, and
    the button and panel styles.
  - Done when: the page shows the `gichess` wordmark in Jacquard 12 on the cream
    ground, switching correctly between light and dark with the system setting
    and with the toggle, with no flash of the wrong theme on load.

- [x] **T1.7 — The gold pieces**
  - Depends on: T1.6
  - Files: `public/js/pieces.js`, `public/css/gichess.css`
  - What: twelve SVG pieces — six shapes in two finishes — built in the four
    layers of ProductSpec §2.4: gradient body, specular highlight, contact
    shadow, dark rim.
  - Done when: all twelve render side by side at 96px and at 32px, each is
    unmistakable at the smaller size, both finishes are legible on both the
    light and dark squares, and they read as sculpted metal rather than flat
    silhouettes.

- [x] **T1.8 — Board rendering**
  - Depends on: T1.7, T1.5
  - Files: `public/js/board.js`, `public/css/gichess.css`
  - What: draw an 8×8 board from a position, with file and rank labels, and a
    `flipped` option for later use online.
  - Done when: an arbitrary FEN renders correctly; the board is square and fully
    visible from 360px wide up to a large desktop screen; it never scrolls
    sideways.

- [x] **T1.9 — Making moves, and the impossibility of illegal ones**
  - Depends on: T1.8
  - Files: `public/js/board.js`
  - What: select a piece with a click or by dragging; its legal destinations
    appear as gold dots; only those squares accept it; the piece animates home
    from anywhere else. Works with mouse and with touch.
  - Done when: **no sequence of clicks, drags or taps can produce a position
    that `rules.js` does not consider legal** — verified by attempting, for a
    selection of positions, to move every piece to every one of the 64 squares
    and confirming that only legal destinations are accepted. Pieces of the
    colour not to move cannot be picked up at all.

- [x] **T1.10 — Promotion chooser**
  - Depends on: T1.9
  - Files: `public/js/board.js`, `public/css/gichess.css`
  - What: on reaching the last rank, a panel of four gold pieces; the move
    commits only on choosing; dismissing cancels the move entirely.
  - Done when: each of the four choices produces the correct piece, and
    dismissing the panel leaves the pawn on its original square with the turn
    unchanged.

### 1d. The first mode, and the first deploy

- [x] **T1.11 — Hot-seat**
  - Depends on: T1.10
  - Files: `public/js/app.js`, `public/index.html`
  - What: the menu, the hot-seat mode itself, the status line with every message
    in ProductSpec §3.2, last-move highlighting, board freeze on game over, and
    New game.
  - Done when: a complete game can be played from the opening move to checkmate
    with correct status text throughout; a stalemate is announced as a draw; New
    game restores the starting position.

- [x] **T1.12 — Live on the internet** 🎉
  - Depends on: T1.11
  - Files: `wrangler.jsonc`, `README.md`
  - What: `npm run deploy`, then play a real game against another person through
    the public address, on a phone and on a laptop.
  - Done when: a `https://gichess.*.workers.dev` address exists, a stranger with
    the link can play a full game on a phone without instructions, and the
    address is written into the README.
  - **Live at <https://gichess.giannacrisha-ee3.workers.dev>**
  - **Phase 1 ships here. Everything after this is addition, not repair.**

---

## Phase 2 — The computer opponent

*Goal: a legal, non-random opponent that answers in well under two seconds.*

- [ ] **T2.1 — Judging a position**
  - Depends on: T1.12
  - Files: `public/js/engine.js`
  - What: the evaluation function — material values plus a piece-square table
    per piece type, as specified in ProductSpec §6.
  - Done when: the starting position scores 0; a position a queen up scores
    roughly +900 for that side; a knight in the centre scores higher than the
    same knight in a corner.

- [ ] **T2.2 — Minimax with alpha–beta pruning, depth 2**
  - Depends on: T2.1
  - Files: `public/js/engine.js`
  - What: search two turns ahead, choosing the move that leaves the position
    best after the opponent's best reply. Alpha–beta prunes branches that cannot
    change the outcome.
  - Done when: from 20 varied positions the chosen move is always one of
    `legalMoves()`; it takes a free queen when one is offered; it does not hang
    its own queen for nothing; and the slowest of the 20 searches completes in
    **under 200ms**, a tenfold margin on the two-second requirement. Pruning is
    proved correct by checking it picks the same move as an unpruned search.

- [ ] **T2.3 — Vs computer mode**
  - Depends on: T2.2
  - Files: `public/js/app.js`, `public/index.html`, `public/css/gichess.css`
  - What: colour choice on the menu (White preselected); the board oriented to
    the player's colour; "Thinking…" while it searches; the board locked during
    its turn; the machine moving first when the player picks Black.
  - Done when: 50 games played out with random legal player moves finish with a
    proper result and no illegal move, no crash and no stuck turn; every
    computer reply arrives within two seconds; and the player never gets a turn
    out of order.

- [ ] **T2.4 — Deploy Phase 2**
  - Depends on: T2.3
  - Files: —
  - Done when: both modes work at the public address, on a phone and a laptop.

---

## Phase 3 — Online rooms

*Goal: two people, two devices, one room code, moves live on both.*

- [ ] **T3.1 — Durable Object wiring**
  - Depends on: T2.4
  - Files: `wrangler.jsonc`
  - What: the `ROOM` binding, the `Room` class, the `new_sqlite_classes`
    migration, and `run_worker_first` scoped to `/ws/*` only.
  - Done when: `npx wrangler deploy --dry-run` accepts the configuration, and
    static files still load without the Worker running for them.

- [ ] **T3.2 — Routing**
  - Depends on: T3.1
  - Files: `src/worker.js`
  - What: requests to `/ws/<CODE>` go to `env.ROOM.getByName(code)`; everything
    else is served from the static assets. Room codes are validated and
    uppercased before use.
  - Done when: a WebSocket connection to `/ws/TEST` is accepted, the same code
    always reaches the same room, a different code reaches a different one, and
    an invalid code is refused.

- [ ] **T3.3 — The room: connections, seats, storage**
  - Depends on: T3.2
  - Files: `src/room.js`
  - What: accept WebSockets with `ctx.acceptWebSocket()`; the two SQLite tables;
    seat assignment (first White, second Black, rest spectators) keyed to the
    browser's token; identity attached with `serializeAttachment`; the position
    written after every change. **No timers.**
  - Done when: three connections to one code are seated White, Black and
    spectator; the position survives the room being evicted from memory between
    moves; and a `grep` for `setTimeout`, `setInterval` and `setAlarm` across
    `src/` returns nothing.

- [ ] **T3.4 — The room as referee**
  - Depends on: T3.3
  - Files: `src/room.js`
  - What: on a `move` message, check the sender holds the seat whose turn it is
    and that the move is in `legalMoves()`; apply it, save it, and broadcast the
    full new position to everyone. Otherwise reply `rejected` and re-send the
    true position. Also `newgame` and `resign`.
  - Done when: a deliberately modified client that sends an illegal move, a move
    out of turn, or a move for the other colour is refused every time and snapped
    back to the true position — **the server's answer does not depend on the
    browser behaving.**

- [ ] **T3.5 — The online client**
  - Depends on: T3.4
  - Files: `public/js/online.js`, `public/js/app.js`
  - What: generate and remember the browser's token; connect; send `move`; draw
    whatever `state` says and nothing else; show the room code for sharing;
    orient the board to your own colour; reconnect automatically if the
    connection drops.
  - Done when: two devices with the same code see each other's moves within a
    second, and a full legal game can be played end to end.

- [ ] **T3.6 — Rejoining, watching, resetting**
  - Depends on: T3.5
  - Files: `public/js/online.js`, `src/room.js`
  - Done when: refreshing either browser mid-game returns it to the same seat
    and the same position; a third person with the code watches live and cannot
    move; and New game resets the board for everyone in the room at once.

- [ ] **T3.7 — Deploy Phase 3**
  - Depends on: T3.6
  - Files: `README.md`
  - Done when: a real game is played between two different devices on different
    networks through the public address, with a third watching, and the room
    instructions are in the README.

---

## Phase 4 — The extras

*Only once everything above is true.*

- [ ] **T4.1 — Captured pieces**
  - Depends on: T3.7
  - Files: `public/js/board.js`, `public/js/app.js`, `public/css/gichess.css`
  - Done when: every capture appears in the right tray in all three modes, the
    material advantage is shown, and New game clears both trays.

- [ ] **T4.2 — Sound**
  - Depends on: T4.1
  - Files: `public/sfx/`, `public/js/sound.js`, `public/js/app.js`
  - Done when: move, capture and check each have a distinct sound; a mute
    control works and is remembered between visits; no sound plays before the
    visitor's first interaction with the page; and the game is completely usable
    with sound off.

- [ ] **T4.3 — Resign**
  - Depends on: T4.2
  - Files: `public/js/app.js`, `src/room.js`
  - Done when: resigning takes one confirmation, ends the game and names the
    winner; online, both players and any spectators see it immediately.

- [ ] **T4.4 — Final deploy and pass**
  - Depends on: T4.3
  - Files: `README.md`
  - Done when: every definition of done in this document is true at the public
    address, on a phone and on a laptop, in light and in dark.

---

## Risks, and what we do about them

| Risk | What we do |
|---|---|
| The rules are subtly wrong, and it surfaces only after the UI is built on them | The 🔒 gate at T1.4. Five positions, not one. Nothing is built on unproven rules. |
| The three required counts miss castling, en passant and promotion entirely | Four supplementary positions that are dense in exactly those cases. |
| Online games drift out of sync between the two browsers | Browsers never apply their own moves speculatively. The room sends the whole position; browsers draw it. Drift is impossible rather than unlikely. |
| A modified browser cheats | The room validates every move with the same `rules.js`. Browsers ask; they do not do. |
| Cloudflare evicts a room mid-game | The position is written to SQLite after every move, so eviction costs nothing. No timers are needed, and none are used. |
| The computer is too slow | Depth 2 is thousands of positions, not millions. Measured at T2.2 against a 200ms budget — a tenfold margin. |
| Deploying turns out to be the hard part, discovered at the end | We deploy at T1.12, before the second mode exists, and again after every phase. |

---

## What is needed from giannacrisha

- A Cloudflare account, and `npx wrangler login` run once, before **T1.12**.
  Everything before that runs on the laptop. The Free plan is sufficient.
