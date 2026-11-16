import { test } from "node:test";
import assert from "node:assert/strict";
import { withAlpha } from "../mods/hop/color.js";

test("adds alpha 0.85 to #rrggbb to make #rrggbbd9", () => {
  assert.equal(withAlpha("#1a2b3c", 0.85), "#1a2b3cd9");
});

test("expands #rgb to 6 digits before adding alpha", () => {
  assert.equal(withAlpha("#abc", 0.85), "#aabbccd9");
});

test("replaces the existing alpha of an 8-digit color", () => {
  assert.equal(withAlpha("#1a2b3cff", 0.85), "#1a2b3cd9");
});

test("replaces the alpha of #rgba (4 digits) too", () => {
  assert.equal(withAlpha("#abcf", 0.85), "#aabbccd9");
});

test("alpha 0 and 1 give 00 and ff", () => {
  assert.equal(withAlpha("#000000", 0), "#00000000");
  assert.equal(withAlpha("#000000", 1), "#000000ff");
});

test("returns non-hex values (color names etc.) unchanged", () => {
  assert.equal(withAlpha("ansi6", 0.85), "ansi6");
});

test("alpha 0.7 gives b3", () => {
  assert.equal(withAlpha("#1a2b3c", 0.7), "#1a2b3cb3");
});
