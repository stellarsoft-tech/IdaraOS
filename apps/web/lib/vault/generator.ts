/**
 * Strong password generator (isomorphic - runs in the browser and on the server).
 *
 * Uses the Web Crypto CSPRNG (globalThis.crypto.getRandomValues, available in modern browsers and
 * Node 20+) with rejection sampling to avoid modulo bias. Guarantees at least one character from each
 * selected class, then shuffles so the guaranteed characters aren't predictably placed.
 */

export interface PasswordOptions {
  length: number
  uppercase: boolean
  lowercase: boolean
  digits: boolean
  symbols: boolean
  avoidAmbiguous: boolean
}

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: true,
}

export const MIN_LENGTH = 8
export const MAX_LENGTH = 128

const SETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  digits: "0123456789",
  // Shell/CSV-friendly symbol set (no quotes or backslash)
  symbols: "!@#$%^&*()-_=+[]{};:,.?",
}
// Visually confusable characters stripped when "avoid ambiguous" is on
const AMBIGUOUS = new Set("Il1O0o".split(""))

function strip(chars: string): string {
  return chars
    .split("")
    .filter((c) => !AMBIGUOUS.has(c))
    .join("")
}

/** Uniform random integer in [0, maxExclusive) with rejection sampling (no modulo bias). */
function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0
  const limit = Math.floor(0xffffffff / maxExclusive) * maxExclusive
  const buf = new Uint32Array(1)
  let x = 0
  do {
    globalThis.crypto.getRandomValues(buf)
    x = buf[0]
  } while (x >= limit)
  return x % maxExclusive
}

export function generatePassword(opts: PasswordOptions): string {
  const pools: string[] = []
  const addPool = (on: boolean, chars: string) => {
    if (!on) return
    const c = opts.avoidAmbiguous ? strip(chars) : chars
    if (c) pools.push(c)
  }
  addPool(opts.uppercase, SETS.uppercase)
  addPool(opts.lowercase, SETS.lowercase)
  addPool(opts.digits, SETS.digits)
  addPool(opts.symbols, SETS.symbols)
  // Nothing selected → fall back to lowercase so we always return something usable
  if (pools.length === 0) pools.push(opts.avoidAmbiguous ? strip(SETS.lowercase) : SETS.lowercase)

  const length = Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, Math.floor(opts.length) || DEFAULT_PASSWORD_OPTIONS.length))
  const all = pools.join("")
  const out: string[] = []

  // Guarantee at least one character from each selected pool (when it fits in the length)
  for (const pool of pools) {
    if (out.length >= length) break
    out.push(pool[randomInt(pool.length)])
  }
  while (out.length < length) out.push(all[randomInt(all.length)])

  // Fisher-Yates shuffle so the guaranteed characters aren't clustered at the front
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out.slice(0, length).join("")
}
