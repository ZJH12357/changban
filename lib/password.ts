// Workers WebCrypto permits at most 100,000 PBKDF2 iterations per derivation.
// Store the algorithm and cost with new hashes; old unprefixed V1 hashes used 120,000.
export const PASSWORD_ITERATIONS = 100000;
const PREFIX = `pbkdf2_sha256$${PASSWORD_ITERATIONS}$`;
const LEGACY_ITERATIONS = 120000;
const encoder = new TextEncoder();

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2, "0")).join("");
}
function saltBytes(salt: string) {
  if (!/^[a-f0-9]{32}$/.test(salt)) throw new Error("Invalid password salt");
  return Uint8Array.from(salt.match(/../g)!, part => Number.parseInt(part, 16));
}
async function derive(password: string, salt: string, iterations: number) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBytes(salt), iterations }, key, 256));
}
function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return different === 0;
}
export async function hashPassword(password: string, salt: string) {
  return PREFIX + await derive(password, salt, PASSWORD_ITERATIONS);
}
export async function verifyPassword(password: string, salt: string, stored: string) {
  if (stored.startsWith(PREFIX) && /^[a-f0-9]{64}$/.test(stored.slice(PREFIX.length))) {
    return equal(await derive(password, salt, PASSWORD_ITERATIONS), stored.slice(PREFIX.length));
  }
  // Existing local accounts remain valid without altering their stored credentials.
  // The previous cloud registration failed before insertion, so no cloud legacy rows were created.
  if (/^[a-f0-9]{64}$/.test(stored)) {
    return equal(await derive(password, salt, LEGACY_ITERATIONS), stored);
  }
  return false;
}
