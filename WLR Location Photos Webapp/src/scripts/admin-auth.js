// Admin password gate. Kept free of DOM code so admin.astro can import the
// session token at build time for its pre-paint unlock check.
//
// This is a light gate, not security: the hash ships with the page. It keeps
// casual visitors out of a tool that only edits this device's own storage.

export const PW_HASH       = '213df38968aa805e75bf712ef8e41e5ef382597c1d8e7f06dee5561a449051fd';
export const SESSION_TOKEN = PW_HASH.slice(0, 24);
export const AUTH_KEY      = 'wlr_auth';   // sessionStorage, so it ends with the tab

export function isUnlocked() { return sessionStorage.getItem(AUTH_KEY) === SESSION_TOKEN; }
export function rememberUnlock() { sessionStorage.setItem(AUTH_KEY, SESSION_TOKEN); }
export function forgetUnlock() { sessionStorage.removeItem(AUTH_KEY); }

export async function checkPassword(input) {
  const encoded = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
  const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
  return hashHex === PW_HASH;
}
