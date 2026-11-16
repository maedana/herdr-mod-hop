import { test } from "node:test";
import assert from "node:assert/strict";
import { hintLabels, matchHints, ALPHABET } from "../mods/hop/hints.js";

test("0 行ならラベルは空", () => {
  assert.deepEqual(hintLabels(0), []);
});

test("5 行ならホームポジションの 1 文字 a s d f g", () => {
  assert.deepEqual(hintLabels(5), ["a", "s", "d", "f", "g"]);
});

test("12 行ならホーム 10 文字 + q w の 1 文字", () => {
  assert.deepEqual(hintLabels(12), ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "q", "w"]);
});

test("30 行なら 2 文字。使う文字はホームポジション 10 文字 (k=10)", () => {
  const labels = hintLabels(30);
  assert.equal(labels.length, 30);
  assert.deepEqual(labels.slice(0, 11), ["aa", "as", "ad", "af", "ag", "ah", "aj", "ak", "al", "a;", "sa"]);
  assert.equal(labels[29], "d;");
});

test("101 行なら 2 文字。使う文字はホーム 10 + q (k=11)", () => {
  const labels = hintLabels(101);
  assert.equal(labels.length, 101);
  assert.ok(labels.every((l) => l.length === 2));
  assert.deepEqual(new Set(labels.join("")), new Set("asdfghjkl;q"));
});

// [行数, ラベルの長さ, 使われる文字 (ALPHABET の先頭から)]
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
  test(`${count} 行: 長さ ${len}、ALPHABET の先頭 ${k} 文字を使う`, () => {
    const labels = hintLabels(count);
    assert.equal(labels.length, count);
    assert.ok(labels.every((l) => l.length === len), "全ラベルが同じ長さ");
    assert.deepEqual(new Set(labels.join("")), new Set(ALPHABET.slice(0, k)));
  });
}

// ALPHABET の順で比べる (a < s < d …)。
const rank = (label) => [...label].map((c) => ALPHABET.indexOf(c));
const before = (x, y) => {
  const a = rank(x);
  const b = rank(y);
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
};

for (const count of [1, 5, 12, 27, 28, 30, 101, 729, 730]) {
  test(`${count} 行: 重複なし・ALPHABET 順の辞書順・先頭のラベルはホームポジション`, () => {
    const labels = hintLabels(count);
    assert.equal(new Set(labels).size, count, "重複なし");
    for (let i = 1; i < labels.length; i++) assert.ok(before(labels[i - 1], labels[i]), `${labels[i - 1]} < ${labels[i]}`);
    assert.equal(labels[0], "a".repeat(labels[0].length), "先頭のラベルはホームポジション");
  });
}

test("matchHints: 1 文字目で前方一致する候補に絞る (完全一致はまだ無い)", () => {
  assert.deepEqual(matchHints(["aa", "as", "sa", "ss"], "s"), { exact: null, candidates: [2, 3] });
});

test("matchHints: 完全一致したらその添字を exact に返す", () => {
  assert.deepEqual(matchHints(["aa", "as", "sa", "ss"], "sa"), { exact: 2, candidates: [2] });
});

test("matchHints: どのラベルにも当てはまらなければ候補なし", () => {
  assert.deepEqual(matchHints(["aa", "as", "sa", "ss"], "d"), { exact: null, candidates: [] });
  assert.deepEqual(matchHints(["aa", "as", "sa", "ss"], "aq"), { exact: null, candidates: [] });
});

test("matchHints: 未入力なら全部が候補", () => {
  assert.deepEqual(matchHints(["a", "s", "d"], ""), { exact: null, candidates: [0, 1, 2] });
});

test("matchHints: 1 文字ラベルは 1 打で完全一致", () => {
  assert.deepEqual(matchHints(hintLabels(5), "f"), { exact: 3, candidates: [3] });
});
