/**
 * gichess — the Worker.
 *
 * This does one job. Requests to /ws/<CODE> are handed to the Room that owns
 * that code; everything else is a file the browser asked for, and Cloudflare
 * serves it from the edge.
 *
 * Because `run_worker_first` in wrangler.jsonc is scoped to "/ws/*", the page
 * and its scripts never wake this code at all. The fallback below only runs if
 * that setting is ever loosened.
 */

import { Room } from './room.js';

// Cloudflare needs the Durable Object class exported from the entry point.
export { Room };

/**
 * Any four letters.
 *
 * Codes we GENERATE avoid I and O, which are easily misread. But a code
 * someone TYPES should be accepted as typed: if they mistype it they will
 * simply find an empty room, which is far friendlier than being told their
 * friend's code is invalid.
 */
const ROOM_CODE = /^[A-Z]{4}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/ws\/([A-Za-z]{1,8})$/);

    if (match) {
      const code = match[1].toUpperCase();
      if (!ROOM_CODE.test(code)) {
        return new Response('That is not a room code.', { status: 400 });
      }
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('This address expects a WebSocket.', { status: 426 });
      }
      // getByName gives the one and only Room for this code, wherever in the
      // world it already lives, creating it the first time.
      return env.ROOM.getByName(code).fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};
