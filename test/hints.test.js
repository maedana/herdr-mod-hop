import { test } from "node:test";
import assert from "node:assert/strict";
import { hintLabels, matchHints, ALPHABET } from "../mods/hop/hints.js";

test("no labels for 0 rows", () => {
  assert.deepEqual(hintLabels(0), []);
});

test("5 rows get the 1-letter home row labels a s d f g", () => {
  assert.deepEqual(hintLabels(5), ["a", "s", "d", "f", "g"]);
});

test("12 rows get 1 letter: the 10 home row letters + q w", () => {
  assert.deepEqual(hintLabels(12), ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "q", "w"]);
});

test("30 rows get 2 letters, from the 10 home row letters (k=10)", () => {
  const labels = hintLabels(30);
  assert.equal(labels.length, 30);
  assert.deepEqual(labels.slice(0, 11), ["aa", "as", "ad", "af", "ag", "ah", "aj", "ak", "al", "a;", "sa"]);
  assert.equal(labels[29], "d;");
});

test("101 rows get 2 letters, from the 10 home row letters + q (k=11)", () => {
  const labels = hintLabels(101);
  assert.equal(labels.length, 101);
  assert.ok(labels.every((l) => l.length === 2));
  assert.deepEqual(new Set(labels.join("")), new Set("asdfghjkl;q"));
});

// [row count, label length, letters used (from the start of ALPHABET)]
const boundaries = [
  [1, 1, 1],
  [10, 1, 10],
  [11, 1, 11],
  [27, 1, 27],
  [28, 2, 10],
  [100, 2, 10],
  [101, 2, 11],
  [27 ** 2, 2, 27],
  [27 ** 2 + 1, 3, 10],
];
for (const [count, len, k] of boundaries) {
  test(`${count} rows: length ${len}, using the first ${k} letters of ALPHABET`, () => {
    const labels = hintLabels(count);
    assert.equal(labels.length, count);
    assert.ok(labels.every((l) => l.length === len), "all labels have the same length");
    assert.deepEqual(new Set(labels.join("")), new Set(ALPHABET.slice(0, k)));
  });
}

// Compare in ALPHABET order (a < s < d ...).
const rank = (label) => [...label].map((c) => ALPHABET.indexOf(c));
const before = (x, y) => {
  const a = rank(x);
  const b = rank(y);
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
};

for (const count of [1, 5, 12, 27, 28, 30, 101, 729, 730]) {
  test(`${count} rows: no duplicates, sorted in ALPHABET order, first label is on the home row`, () => {
    const labels = hintLabels(count);
    assert.equal(new Set(labels).size, count, "no duplicates");
    for (let i = 1; i < labels.length; i++) assert.ok(before(labels[i - 1], labels[i]), `${labels[i - 1]} < ${labels[i]}`);
    assert.equal(labels[0], "a".repeat(labels[0].length), "first label is on the home row");
  });
}

test("matchHints: narrows to candidates whose prefix matches the first letter (no exact match yet)", () => {
  assert.deepEqual(matchHints(["aa", "as", "sa", "ss"], "s"), { exact: null, candidates: [2, 3] });
});

test("matchHints: returns the index as exact on an exact match", () => {
  assert.deepEqual(matchHints(["aa", "as", "sa", "ss"], "sa"), { exact: 2, candidates: [2] });
});

test("matchHints: no candidates if no label matches", () => {
  assert.deepEqual(matchHints(["aa", "as", "sa", "ss"], "d"), { exact: null, candidates: [] });
  assert.deepEqual(matchHints(["aa", "as", "sa", "ss"], "aq"), { exact: null, candidates: [] });
});

test("matchHints: everything is a candidate with no input", () => {
  assert.deepEqual(matchHints(["a", "s", "d"], ""), { exact: null, candidates: [0, 1, 2] });
});

test("matchHints: a 1-letter label matches exactly in one key", () => {
  assert.deepEqual(matchHints(hintLabels(5), "f"), { exact: 3, candidates: [3] });
});
