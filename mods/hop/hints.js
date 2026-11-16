// Hint labels for jumping to a row with a key or two, easymotion style.
// Plain ES module (no herdr / node APIs) so node --test can test it.

// Home row first, then the top row, then the bottom row.
export const ALPHABET = "asdfghjkl;qwertyuiopzxcvbnm";
const HOME = 10;

// `count` labels, all the same length: the shortest length that the whole
// alphabet covers, using the fewest letters that still cover `count` (never
// fewer than the home row). In alphabet order, the first `count` of them.
export function hintLabels(count) {
  let len = 1;
  while (ALPHABET.length ** len < count) len++;
  let k = HOME;
  while (k ** len < count) k++;
  const chars = [...ALPHABET.slice(0, k)];
  let labels = [""];
  for (let i = 0; i < len; i++) labels = labels.flatMap((p) => chars.map((c) => p + c));
  return labels.slice(0, count);
}

// Which labels `typed` still leads to (indexes, in order), and the one it
// spells out in full, if any.
export function matchHints(labels, typed) {
  const candidates = [];
  labels.forEach((l, i) => {
    if (l.startsWith(typed)) candidates.push(i);
  });
  const exact = labels.indexOf(typed);
  return { exact: exact < 0 ? null : exact, candidates };
}
