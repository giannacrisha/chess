# gichess

A browser chess game. Royal, gold, and sculpted — built to match the look of
[giannacrisha.com](https://giannacrisha.com).

**By giannacrisha.**

Three ways to play:

1. **Hot-seat** — two people, one screen, taking turns.
2. **Vs computer** — you pick White or Black, the browser plays the other side.
3. **Online** — two people type the same room code on two different devices and
   see each other's moves live.

No accounts. No logins. No downloads. Open a link and play.

---

## Plain-English glossary

This project uses a handful of technical words. Each one is defined here exactly
once, and every other document assumes you have read this list.

| Term | What it actually means |
|---|---|
| **Repository** ("repo") | The project folder, with a full history of every change ever made to it. Lives on your laptop and on GitHub. |
| **Commit** | One saved checkpoint in that history, with a note explaining what changed. |
| **Branch** | A parallel copy of the project where work happens, so the main copy is never broken mid-edit. |
| **Pull request** ("PR") | A request to fold a branch back into the main copy. It is the place where changes get reviewed before they count. |
| **Cloudflare Workers** | Cloudflare's service for running small programs on their servers around the world. Our server code lives here. There is no machine to rent or maintain. |
| **Worker** | One such program. Ours does exactly one job: hand out the game's files, and pass online-game traffic to the right room. |
| **Static assets** | Files that never change per visitor — the HTML page, the stylesheet, the JavaScript, the sounds. Cloudflare serves these directly, for free, very fast. |
| **`wrangler`** | The command-line tool that runs our project on a laptop and publishes it to Cloudflare. |
| **`wrangler.jsonc`** | The project's settings file, telling Cloudflare what to serve and how. (`.jsonc` = JSON with comments allowed.) |
| **Durable Object** ("DO") | A Cloudflare feature that gives us one — and only ever one — small, long-lived object per name, anywhere in the world, with its own private database attached. We create one per room code. It is what makes two phones agree on a single chessboard. |
| **SQLite** | The small database that lives inside each Durable Object. We use it to write down the position after every move, so nothing is lost. |
| **WebSocket** | A phone line, rather than a letter. Normal web traffic is request-then-reply; a WebSocket stays open in both directions, so the server can push your opponent's move to you the instant it happens. |
| **Single-page application** ("SPA") | A site that is really one HTML page which rewrites itself, rather than loading a new page per click. A setting tells Cloudflare to serve that one page for any address. |
| **Module** | One JavaScript file with a clear job, that other files can borrow from. `rules.js` is a module. |
| **FEN** | Forsyth–Edwards Notation: a chess position written as a single line of text. It is how the server writes a game down in the database and how it reads it back. |
| **`perft`** | "Performance test." Counting every legal sequence of moves to a given depth. Chess has known, published answers for these counts, so if our count matches, our rules are right. This is our proof of correctness. |
| **Minimax** | The way the computer opponent thinks: assume I play my best move, then assume you play your best reply, and judge the position at the end of that. |
| **Alpha–beta pruning** | A shortcut that lets minimax skip branches that cannot possibly change the answer. Same result, far less work. |
| **Depth** | How many turns ahead the computer looks. Depth 2 = my move, then your reply. |

---

## What "finished" means

gichess is done when all of this is true:

- **Full legal chess in every mode.** All six pieces, check, checkmate,
  stalemate, castling, en passant, and promotion where you choose the piece.
- **An illegal move is impossible to make.** Not "rejected with an error" —
  impossible. The board will not let go of the piece.
- **One rulebook.** Every mode, and the server, share the exact same
  `rules.js`. There is no second, slightly-different copy of the rules anywhere.
- **The rules are proved, not assumed.** The move-counting test passes before
  any game screen is built.
- **The computer answers within two seconds**, always with a legal move.
- **Online works properly.** First person in plays White, second plays Black,
  anyone after that watches. The server decides every move — not the browsers.
  Refreshing the page puts you back in the same game in the same seat. "New
  game" resets the board for both players.

---

## How to run it on your laptop

You need [Node.js](https://nodejs.org) installed (version 20 or newer).

```bash
npm install
npm run dev
```

That prints a `http://localhost:8787` address. Open it in a browser.

To check the chess rules are correct:

```bash
npm test
```

This runs the move-counting test described above. It must say all tests passed.

---

## How to publish it to the internet

One-time setup — this opens a browser window and asks you to sign in to
Cloudflare:

```bash
npx wrangler login
```

Then, any time you want to publish:

```bash
npm run deploy
```

Wrangler prints the public address at the end, something like
`https://gichess.<your-name>.workers.dev`. That link is the game. Send it to
anyone.

Everything here fits inside the Cloudflare **Free** plan.

---

## How the project is laid out

```
gichess/
├─ README.md                      this file
├─ ProductSpec.md                 what we are building, precisely
├─ FEATUREROADMAP_workplan.md     the task list, in order
├─ wrangler.jsonc                 Cloudflare settings
├─ package.json                   commands and project metadata
├─ public/                        everything the browser downloads
│  ├─ index.html                  the one page
│  ├─ css/gichess.css             the look
│  ├─ sfx/                        move and capture sounds
│  └─ js/
│     ├─ rules.js                 THE RULES. Shared by every mode and the server.
│     ├─ board.js                 drawing the board, and picking up pieces
│     ├─ engine.js                the computer opponent
│     ├─ online.js                talking to the server
│     └─ app.js                   menus, modes, and glue
├─ src/                           everything that runs on Cloudflare
│  ├─ worker.js                   routes traffic
│  └─ room.js                     one online game room (a Durable Object)
└─ test/
   └─ perft.test.js               the proof that the rules are right
```

The single most important line in that tree is `public/js/rules.js`. It is the
only place chess rules are written, it has no dependencies, and it runs
unchanged both in the browser and on Cloudflare's servers.

---

## Deliberately not included

Accounts or logins · chess clocks · ratings · draw by threefold repetition ·
the fifty-move rule · opening books · saving or exporting games in PGN ·
React or any other front-end framework · any third-party chess library.

The rules are written from scratch, by hand, in this repository.

---

## Credits

Designed and built by **giannacrisha**.

Visual language adapted from [giannacrisha.com](https://giannacrisha.com):
the cream ground, the gold, and the sculpted 3D objects.
