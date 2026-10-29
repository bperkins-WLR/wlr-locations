/* The live build stamp on its own, so an open copy of the app can ask "is
   there a newer version?" with a few bytes instead of downloading the whole
   page. See scripts/update.js. */
import { BUILD } from '../lib/build.js';

export function GET() {
  return new Response(JSON.stringify({ build: BUILD }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
