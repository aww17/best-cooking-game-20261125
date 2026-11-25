// A small seeded random number generator (mulberry32): the same seed gives the same
// sequence of orders, so a screenshot scene is repeatable and ?seed= fixes the shift.
// It is the only source of chance in the world; Date.now() and Math.random() never touch
// a rule.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An integer in [0, n), from a random() in [0, 1). */
export function randomInt(random, n) {
  const value = Math.floor(random() * n);
  return value < 0 ? 0 : value >= n ? n - 1 : value;
}
