// Seeded random numbers for Neon Shores: the whole city is built from one
// seed, so the same seed always grows the same streets, buildings and cars.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick an integer in [min, max] from a seeded stream.
export function pickInt(rnd, min, max) {
  return min + Math.floor(rnd() * (max - min + 1));
}

// Pick one element of an array from a seeded stream.
export function pickOne(rnd, list) {
  return list[Math.floor(rnd() * list.length)];
}

// A tiny string hash so a word seed ("palma") becomes a number seed.
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
