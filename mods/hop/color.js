// Pure helpers for colors (no "herdr" import, so node --test can load it).

// A #rgb / #rgba / #rrggbb / #rrggbbaa color with its alpha set to `alpha`
// (0..1) as #rrggbbaa. Anything else (a color name) comes back unchanged.
export function withAlpha(color, alpha) {
  const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color);
  if (!m) return color;
  let hex = m[1].toLowerCase();
  if (hex.length <= 4) hex = [...hex].map((c) => c + c).join("");
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255).toString(16).padStart(2, "0");
  return `#${hex.slice(0, 6)}${a}`;
}
