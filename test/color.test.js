import { test } from "node:test";
import assert from "node:assert/strict";
import { withAlpha } from "../mods/hop/color.js";

test("#rrggbb にアルファ 0.85 を付けて #rrggbbd9 にする", () => {
  assert.equal(withAlpha("#1a2b3c", 0.85), "#1a2b3cd9");
});

test("#rgb は 6 桁に展開してからアルファを付ける", () => {
  assert.equal(withAlpha("#abc", 0.85), "#aabbccd9");
});

test("既に 8 桁なら元のアルファを置き換える", () => {
  assert.equal(withAlpha("#1a2b3cff", 0.85), "#1a2b3cd9");
});

test("#rgba (4 桁) もアルファを置き換える", () => {
  assert.equal(withAlpha("#abcf", 0.85), "#aabbccd9");
});

test("アルファ 0 と 1 は 00 と ff", () => {
  assert.equal(withAlpha("#000000", 0), "#00000000");
  assert.equal(withAlpha("#000000", 1), "#000000ff");
});

test("16 進でない値 (色名など) はそのまま返す", () => {
  assert.equal(withAlpha("ansi6", 0.85), "ansi6");
});

test("アルファ 0.7 は b3", () => {
  assert.equal(withAlpha("#1a2b3c", 0.7), "#1a2b3cb3");
});
