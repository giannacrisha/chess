/**
 * gichess — the pieces.
 *
 * Royal, gold, and sculpted. Drawn rather than modelled: there is no 3D
 * library here, no WebGL and no downloaded models. Each piece is one vector
 * outline rendered four times on top of itself:
 *
 *   1. a soft contact shadow on the square, so the piece sits ON the board
 *      rather than being printed into it;
 *   2. the body, filled with a metal gradient — bright at the top left,
 *      falling to a deep brown at the lower right;
 *   3. a sheen: white where the light hits, transparent through the middle,
 *      darkening at the bottom. This layer is the whole illusion. Metal looks
 *      like metal because of the way light slides across it.
 *   4. a dark rim along the silhouette, so the piece separates cleanly from
 *      whatever square it is standing on.
 *
 * Black's pieces are the same forms in a darker, cooler pour of the same
 * metal — antique gold against dark bronze. Two golds, not gold against
 * plastic.
 */

import { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, WHITE } from './rules.js';

/* ------------------------------------------------------------------ *
 * The outlines. One path each, drawn in a 45 x 45 box.
 * ------------------------------------------------------------------ */

const OUTLINES = {
  // Short, with a clear ball head on a narrow neck.
  [PAWN]:
    'M22.5 17.1c-2.2 0-4 2.5-4 5.6 0 2.2.9 4.1 2.2 5.1-.7 1.9-2.3 3.4-4.2 4.3-1 .5-1.7 1.4' +
    '-1.7 2.6v1.7h15.4v-1.7c0-1.2-.7-2.1-1.7-2.6-1.9-.9-3.5-2.4-4.2-4.3 1.3-1 2.2-2.9 2.2-5.1' +
    ' 0-3.1-1.8-5.6-4-5.6z' +
    'M13.6 35.4h17.8c.7 0 1.3.4 1.5 1.1l.9 2.9H11.2l.9-2.9c.2-.7.8-1.1 1.5-1.1z',

  // Square and solid: the one piece that should look built rather than turned.
  [ROOK]:
    'M12.4 8.2h5.2v3.2h3.2V8.2h3.4v3.2h3.2V8.2h5.2c.7 0 1.3.6 1.3 1.3v6.2l-2.5 2.4v13.6' +
    'l2.4 1.8c.5.4.9 1 1.1 1.7l.8 2.8H11.5l.8-2.8c.2-.7.6-1.3 1.1-1.7l2.4-1.8V19.1l-2.5-2.4' +
    'V9.5c0-.7.6-1.3 1.3-1.3z',

  // A tall pointed mitre. The height and the point are what stop it reading
  // as a king, which is exactly the mistake the first draft made.
  [BISHOP]:
    'M22.5 8.2c-1.9 2.3-5.6 7.1-6.6 11.2-.9 3.7.5 7.1 3.2 9-.7 1.6-2 2.9-3.7 3.6v1.5h14.2' +
    'v-1.5c-1.7-.7-3-2-3.7-3.6 2.7-1.9 4.1-5.3 3.2-9-1-4.1-4.7-8.9-6.6-11.2z' +
    'M13.2 33.9h18.6c.7 0 1.3.4 1.5 1.1l1 3.4H10.7l1-3.4c.2-.7.8-1.1 1.5-1.1z',

  // A horse in profile: muzzle to the left, mane sweeping back and down into
  // a heavy base.
  [KNIGHT]:
    'M23.9 8.4c-.5-1.5-1.2-2.8-2-3.8-.4-.5-1.2-.4-1.5.2l-1.5 2.9c-.9-.5-1.9-.7-2.8-.5-.6.1' +
    '-.9.7-.8 1.3.5 2.5.1 4.8-1 6.9-1.2 2.3-3.1 4.3-4.7 6.4-1.4 1.8-2.3 3.6-1.9 5.3.3 1.4 ' +
    '1.6 2.3 3 2.1 1.7-.2 3.1-1.5 4.2-2.9.9 1 2.1 1.6 3.4 1.7-.6 2-2 3.5-3.9 4.6-2.6 1.5' +
    '-5 3.3-6.2 6-.4.9-.6 1.9-.6 2.9v1.3h23.9v-1.3c.5-5.9.6-12.4-1-17.7-1.8-6-5.7-10.2' +
    '-10.6-12.1z',

  // Five points, five balls, a deep collar and a flared foot.
  [QUEEN]:
    'M10.8 12.4l3.7 11.9-1.5-13 4 12.6 2.3-13.9 3.1 13.3 3.1-13.3 2.3 13.9 4-12.6-1.5 13' +
    'l3.7-11.9-3.2 13.8H14z' +
    'M14 27.2h17c.7 0 1.3.6 1.2 1.3-.1 2.4-.8 4.5-2 6.1 1 .8 1.8 1.9 2.2 3.1l.4 1.2H12.2' +
    'l.4-1.2c.4-1.2 1.2-2.3 2.2-3.1-1.2-1.6-1.9-3.7-2-6.1-.1-.7.5-1.3 1.2-1.3z',

  // The tallest piece on the board, and the only one wearing a cross.
  [KING]:
    'M21.1 3.2h2.8v3.6h3.6v2.8h-3.6v3.5c5.9.5 10.7 4.5 11.6 9.8.5 3-.6 6-2.9 8.1 1.1 1 2 ' +
    '2.3 2.5 3.8l.6 1.8H11.3l.6-1.8c.5-1.5 1.4-2.8 2.5-3.8-2.3-2.1-3.4-5.1-2.9-8.1.9-5.3 ' +
    '5.7-9.3 11.6-9.8V9.6h-3.6V6.8h3.6z',
};

/**
 * Pieces whose design includes turned spheres — the pawn's head, the bishop's
 * finial, the queen's five crown balls. Drawn with the body so they take the
 * same gradient, sheen and rim.
 */
const EXTRAS = {
  [PAWN]: [[22.5, 12.4, 4.6]],
  [BISHOP]: [[22.5, 5.9, 2.2]],
  [QUEEN]: [
    [10.8, 10.4, 2.6], [15.4, 7.1, 2.4], [22.5, 5.7, 2.8],
    [29.6, 7.1, 2.4], [34.2, 10.4, 2.6],
  ],
};

/** Details that are engraved into a piece rather than part of its outline. */
const DETAILS = {
  // A diagonal cut, not a cross. A cross would make it read as a king.
  [BISHOP]: '<path d="M25.9 15.4l-5.9 7.4" stroke-width="1.6" ' +
            'stroke-linecap="round" class="gcp-engrave"/>',
  [KNIGHT]: '<circle cx="18.4" cy="15.2" r="1.25" class="gcp-eye" fill="currentColor" ' +
            'stroke="none"/>' +
            '<path d="M24.6 10.4c4 2 6.6 5.6 7.8 10.4" stroke-width="1.3" ' +
            'stroke-linecap="round" class="gcp-engrave"/>' +
            '<path d="M12.6 22.6c.9-.5 1.9-.7 2.9-.6" stroke-width="1.1" ' +
            'stroke-linecap="round" class="gcp-engrave"/>',
  [ROOK]:   '<path d="M15.8 19.1h13.4M14.6 32.9h15.8" stroke-width="1.2" ' +
            'class="gcp-engrave"/>',
  [KING]:   '<path d="M16.4 30.5c4-1.5 8.2-1.5 12.2 0" stroke-width="1.3" ' +
            'stroke-linecap="round" class="gcp-engrave"/>',
  [QUEEN]:  '<path d="M15.2 34.6h14.6" stroke-width="1.2" stroke-linecap="round" ' +
            'class="gcp-engrave"/>',
  [PAWN]:   '',
};

const SHAPE_ID = {
  [PAWN]: 'gcp-pawn', [KNIGHT]: 'gcp-knight', [BISHOP]: 'gcp-bishop',
  [ROOK]: 'gcp-rook', [QUEEN]: 'gcp-queen', [KING]: 'gcp-king',
};

export const PIECE_NAMES = {
  [PAWN]: 'pawn', [KNIGHT]: 'knight', [BISHOP]: 'bishop',
  [ROOK]: 'rook', [QUEEN]: 'queen', [KING]: 'king',
};

/* ------------------------------------------------------------------ *
 * The shared definitions — gradients, filters and the outlines
 * themselves — added to the page once and referenced by every piece.
 * ------------------------------------------------------------------ */

const DEFS = `
<svg id="gichess-defs" aria-hidden="true" focusable="false"
     style="position:absolute;width:0;height:0;overflow:hidden">
  <defs>
    <!-- Antique gold: white-hot at the top left, deep brown at the bottom right. -->
    <linearGradient id="gcGold" x1=".18" y1="0" x2=".82" y2="1">
      <stop offset="0"   stop-color="#FFF6DE"/>
      <stop offset=".13" stop-color="#F5DFA8"/>
      <stop offset=".34" stop-color="#E2B975"/>
      <stop offset=".56" stop-color="#CA9F57"/>
      <stop offset=".78" stop-color="#A0703A"/>
      <stop offset="1"   stop-color="#6B4722"/>
    </linearGradient>

    <!-- Dark bronze: the same metal, poured colder. -->
    <linearGradient id="gcBronze" x1=".18" y1="0" x2=".82" y2="1">
      <stop offset="0"   stop-color="#A88551"/>
      <stop offset=".16" stop-color="#836033"/>
      <stop offset=".40" stop-color="#5C4020"/>
      <stop offset=".64" stop-color="#3D2911"/>
      <stop offset=".85" stop-color="#2A1B0A"/>
      <stop offset="1"   stop-color="#140C04"/>
    </linearGradient>

    <!-- The sheen. This layer is what makes it read as metal. -->
    <linearGradient id="gcSheen" x1=".12" y1="0" x2=".7" y2="1">
      <stop offset="0"   stop-color="#FFFFFF" stop-opacity=".68"/>
      <stop offset=".14" stop-color="#FFFFFF" stop-opacity=".30"/>
      <stop offset=".34" stop-color="#FFFFFF" stop-opacity=".04"/>
      <stop offset=".52" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset=".74" stop-color="#2B1D0D" stop-opacity=".14"/>
      <stop offset="1"   stop-color="#2B1D0D" stop-opacity=".42"/>
    </linearGradient>

    <!-- A second, tighter glint along the very top edge. -->
    <linearGradient id="gcGlint" x1=".3" y1="0" x2=".45" y2=".38">
      <stop offset="0"   stop-color="#FFFFFF" stop-opacity=".85"/>
      <stop offset="1"   stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>

    <filter id="gcContact" x="-40%" y="-60%" width="180%" height="260%">
      <feGaussianBlur stdDeviation="1.4"/>
    </filter>

    ${Object.entries(OUTLINES)
      .map(([type, d]) => {
        const spheres = (EXTRAS[type] || [])
          .map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`)
          .join('');
        return `<g id="${SHAPE_ID[type]}"><path d="${d}"/>${spheres}</g>`;
      })
      .join('\n    ')}
  </defs>
</svg>`;

let defsInstalled = false;

/** Put the gradients and outlines into the page. Safe to call repeatedly. */
export function installPieceDefs(doc = document) {
  if (defsInstalled || doc.getElementById('gichess-defs')) { defsInstalled = true; return; }
  doc.body.insertAdjacentHTML('afterbegin', DEFS);
  defsInstalled = true;
}

/* ------------------------------------------------------------------ *
 * Drawing one piece
 * ------------------------------------------------------------------ */

/**
 * The SVG markup for one piece.
 * @param {number} type   PAWN … KING
 * @param {'w'|'b'} colour
 */
export function pieceSVG(type, colour) {
  const shape = `#${SHAPE_ID[type]}`;
  const white = colour === WHITE;
  const body = white ? 'url(#gcGold)' : 'url(#gcBronze)';
  const rim = white ? '#4A3116' : '#0D0803';
  // Black pieces get a faint warm outer edge (drawn below the body) so they
  // hold their shape against a dark square instead of becoming a silhouette.
  return `<svg class="piece" viewBox="0 0 45 45" role="img"
       aria-label="${white ? 'White' : 'Black'} ${PIECE_NAMES[type]}"
       data-piece="${PIECE_NAMES[type]}" data-colour="${colour}">
  <ellipse cx="22.5" cy="39.4" rx="10.5" ry="2" fill="rgba(46,30,12,.42)"
           filter="url(#gcContact)"/>
  ${!white ? `<use href="${shape}" fill="none" stroke="#D8AF78" stroke-opacity=".28"
       stroke-width="2.2" stroke-linejoin="round"/>` : ''}
  <use href="${shape}" fill="${body}"/>
  <use href="${shape}" fill="url(#gcSheen)"/>
  <g fill="none" stroke="${white ? 'rgba(62,39,16,.55)' : 'rgba(216,175,120,.42)'}">
    ${DETAILS[type] || ''}
  </g>
  <use href="${shape}" fill="none" stroke="${rim}" stroke-opacity=".75"
       stroke-width=".9" stroke-linejoin="round"/>
</svg>`;
}

/** The same thing as a real element, for when you need to move it about. */
export function pieceElement(type, colour) {
  const holder = document.createElement('div');
  holder.innerHTML = pieceSVG(type, colour);
  return holder.firstElementChild;
}

/** Draw a board piece value (signed: positive white, negative black). */
export function pieceSVGFromValue(value) {
  return value === 0 ? '' : pieceSVG(Math.abs(value), value > 0 ? 'w' : 'b');
}
