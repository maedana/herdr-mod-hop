// Go to a space, tab or pane. Every space in order as a tree: space rows,
// their tabs (settled ones dimmed), and the panes of tabs with more than one.
// Type to filter, ↑/↓ to show a row's place behind the window as you go, Enter
// to stay there (a click: go to that row), ctrl+d to close a tab, Esc to leave.
// f (normal mode) puts a hint on each space, tab and pane row in view; typing
// a hint goes to its row (backspace takes a letter back, Esc or a letter no
// hint has leaves the hints).
// Last rows: new work (a tab here, a space on this computer or on each
// connected machine).

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { agents, spaces, panes, focused, terminals, run, hc, home, theme, settings, props, closeOverlay, openOverlay, shared, setShared } from "herdr";
import { hintLabels, matchHints, ALPHABET } from "./hints.js";

// A pane's folder with home as ~.
function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}
// What runs in a pane: the mod's name for a mod pane, else the program's.
const paneName = (p) => p.mod ?? p.program?.name ?? "";

const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };

// Space colors, kept by space id in shared "space.colors": a theme
// color name ("ansi6") or a picked #rrggbb. A space seen without one gets
// the theme color fewest spaces use, once; every mod does the same in the
// same order, so they agree, and adding or renaming spaces moves nothing.
const PROJECT_COLORS = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
function spaceColors() {
  const ids = new Set(spaces().map((p) => p.id));
  const kept = Object.fromEntries(Object.entries(shared("space.colors") ?? {}).filter(([id]) => ids.has(id)));
  let changed = Object.keys(kept).length !== Object.keys(shared("space.colors") ?? {}).length;
  for (const p of spaces()) {
    if (kept[p.id] || p.name === "~") continue;
    const uses = (c) => Object.values(kept).filter((v) => v === c).length;
    kept[p.id] = PROJECT_COLORS.reduce((best, c) => (uses(c) < uses(best) ? c : best));
    changed = true;
  }
  if (changed) setShared("space.colors", kept);
  return kept;
}
function spaceColor(t, p) {
  if (p.name === "~") return t.dim;
  const c = spaceColors()[p.id] ?? PROJECT_COLORS[0];
  return c.startsWith("#") ? c : (MARK[c] ?? t[c]);
}

export default class Picker extends View {
  init(_props, cx) {
    this.filter = "";
    this.input = InputState.new({ placeholder: "Go to a tab, space or agent…" });
    this.input.on("change", (_e, cx) => {
      this.filter = this.input.value();
      // Filtering picks the first row that matched itself; clearing goes back to where you are.
      const rows = this.rows();
      this.at = this.filter ? Math.max(0, rows.findIndex((r) => r.hit)) : null;
      if (this.at !== null) this.switchTo(rows[this.at]);
      cx.notify();
    });
    this.input.on("submit", (_e, cx) => this.go(this.rows()[this.at], cx));
    // Modes: insert = the input has the keyboard, normal = the root (this.handle) does.
    this.insert = false;
    this.input.on("focus", (_e, cx) => { this.insert = true; this.hint = null; cx.notify(); });
    this.blurredAt = 0;
    // The Input handles Esc itself and blurs first, so the same Esc then bubbles to the root
    // with insert already false; blurredAt lets that Esc be told apart from a normal-mode one.
    // A blur while switching is the switch taking the keyboard, not the user leaving the input.
    this.input.on("blur", (_e, cx) => {
      if (this.switching) return;
      this.insert = false;
      this.blurredAt = Date.now();
      cx.notify();
    });
    this.at = null;
    // Hint mode: null, or { keys, labels, typed, sig } (see startHints).
    this.hint = null;
    // The row whose place is shown behind the window (see switchTo); set to where you are on opening.
    this.shown = null;
    this.switching = false;
    this.switches = 0;
    this.closed = false;
    this.acx = cx;
    this.scroll = 0;
    this.machines = [];
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(600, () => { if (!this.insert) this.handle.focus(); });
    cx.spawn(async (cx) => {
      try {
        const r = await hc(["machine", "ls", "--json"]);
        if (r.code === 0) this.machines = (JSON.parse(r.stdout).machines ?? []).filter((m) => m.state === "connected" && !m.temporary).map((m) => m.name);
      } catch {}
      cx.notify();
    });
  }

  close() {
    this.closed = true;
    closeOverlay(props().overlay);
  }

  // Every space in order: a space row, its tabs, and the panes of each tab with more
  // than one (a lone pane is told on its tab row). Every row can be picked.
  // Filtering keeps what matches and the tab and space it sits in; `hit` marks
  // the rows that matched themselves.
  rows() {
    const f = this.filter.toLowerCase();
    const has = (...xs) => !f || xs.join(" ").toLowerCase().includes(f);
    const all = agents();
    const ps = panes();
    const live = terminals().filter((x) => x.state === "live");
    const teamOf = (addrs) => {
      let n = 0;
      const walk = (a) => live.filter((x) => x.parent === a).forEach((k) => (n++, walk(k.address)));
      addrs.forEach(walk);
      return n;
    };
    const out = [];
    for (const w of spaces()) {
      const spaceHit = has(w.name);
      const body = [];
      for (const ctx of w.tabs) {
        const mine = all.filter((a) => a.tab === ctx.id);
        const own = ps.filter((p) => p.tab === ctx.id);
        const paneHits = own.filter((p) => has(paneName(p), p.title ?? "", folder(p.cwd)));
        const many = own.length > 1;
        const tabHit = has(ctx.name, ...mine.map((a) => a.program?.name ?? "")) || (!many && paneHits.length > 0);
        if (!spaceHit && !tabHit && !paneHits.length) continue;
        body.push({ kind: "tab", w, ctx, mine, panes: own, team: teamOf(mine.map((a) => a.address)), hit: tabHit });
        if (many) {
          for (const p of spaceHit || tabHit ? own : paneHits) body.push({ kind: "pane", w, ctx, p, hit: paneHits.includes(p) });
        }
      }
      if (!spaceHit && !body.length) continue;
      out.push({ kind: "space", w, hit: spaceHit });
      out.push(...body);
    }
    out.push({ kind: "new" });
    out.push({ kind: "space-new", machine: null });
    for (const m of this.machines) out.push({ kind: "space-new", machine: m });
    return out;
  }

  // A row's place, the same for the row whichever filter shows it; new rows have none.
  placeKey(r) {
    if (r?.kind === "space") return `s:${r.w.id}`;
    if (r?.kind === "tab") return `t:${r.ctx.id}`;
    if (r?.kind === "pane") return `p:${r.p.pane}`;
    return null;
  }

  // Shows a space, tab or pane row's place behind the window.
  show(r) {
    if (r.kind === "space") run("space.select", { id: r.w.id });
    else if (r.kind === "tab") run("tab.select", { id: r.ctx.id });
    else if (r.kind === "pane") {
      // pane.focus shows a pane in another tab of the shown space (checked); for
      // another space, show its tab first, as tab.select does for any space.
      if (r.w.id !== focused()?.space) run("tab.select", { id: r.ctx.id });
      run("pane.focus", { pane: r.p.pane });
    }
  }

  // The selection moved: show its place, once per place (new rows do nothing).
  switchTo(r) {
    const k = this.placeKey(r);
    if (!k || k === this.shown) return;
    this.shown = k;
    // Switching hands the keyboard to the pane it shows; take it back for the mode
    // we're in, now and again once the switch has settled. Blurs meanwhile are ignored.
    const n = ++this.switches;
    this.switching = true;
    this.show(r);
    this.refocus();
    this.acx.timer.after(16, () => this.refocus());
    this.acx.timer.after(120, () => {
      if (n !== this.switches) return;
      this.switching = false;
      this.refocus();
    });
  }

  refocus() {
    if (this.closed) return;
    if (this.insert) this.input.focus();
    else this.handle.focus();
  }

  // Enter or a click: make a new tab or space, or go to the row's place (shown
  // already after moving to it; a click may pick another), and close.
  go(r, _cx) {
    if (!r) return;
    this.close();
    if (r.kind === "new") run("tab.new");
    else if (r.kind === "space-new") run("space.new", { machine: r.machine ?? "" });
    else this.show(r);
  }

  // Every row's place (or kind) in order: hints are dropped when it changes.
  listSig(rows) {
    return rows.map((r) => this.placeKey(r) ?? r.kind).join("|");
  }

  // Hints for the space, tab and pane rows in view, top to bottom.
  startHints(rows, inView) {
    const keys = rows.filter((r, i) => inView(i) && this.placeKey(r)).map((r) => this.placeKey(r));
    if (!keys.length) return;
    this.hint = { keys, labels: hintLabels(keys.length), typed: "", sig: this.listSig(rows) };
  }

  // A key in hint mode. Returns true when it was taken; false lets the usual
  // handling have it (the hints are gone by then).
  hintKey(e, rows, cx) {
    const m = e.modifiers;
    const ch = e.key_char ?? (e.key.length === 1 ? e.key : "");
    const typing = ch.length === 1 && ch > " ";
    if (e.key === "escape") this.hint = null;
    else if (e.key === "backspace") this.hint.typed = this.hint.typed.slice(0, -1);
    else if (m.control || m.alt || m.platform || !typing) {
      this.hint = null;
      cx.notify();
      return false;
    } else if (m.shift) {
      // Hints are lower case only: a shifted letter does nothing.
    } else if (!ALPHABET.includes(ch)) this.hint = null;
    else {
      const typed = this.hint.typed + ch;
      const { exact, candidates } = matchHints(this.hint.labels, typed);
      if (exact !== null) {
        const key = this.hint.keys[exact];
        this.hint = null;
        this.go(rows.find((r) => this.placeKey(r) === key), cx);
      } else if (!candidates.length) this.hint = null;
      else this.hint.typed = typed;
    }
    return true;
  }

  // The hint badge for a row while hinting, if its hint still fits what's typed.
  hintBadge(t, r) {
    if (!this.hint) return null;
    const i = this.hint.keys.indexOf(this.placeKey(r));
    const label = this.hint.labels[i];
    const { typed } = this.hint;
    if (i < 0 || !label.startsWith(typed)) return null;
    return h_flex()
      .flex_none()
      .px(4)
      .rounded(4)
      .border_1()
      .border_color(t.accent)
      .bg(t.background)
      .text_size(11)
      .font_bold()
      .when(typed.length > 0, (el) => el.child(div().text_color(t.dim).child(typed)))
      .child(div().text_color(t.accent).child(label.slice(typed.length)));
  }

  glyph(t, st) {
    if (st === "working") return svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900);
    return div().w(12).flex_none().text_color(t[st] ?? t.dim).child(st === "idle" ? "○" : st ? "●" : "·");
  }

  render() {
    const t = theme();
    const rows = this.rows();
    const pickable = rows;
    // Opens on where you are: the focused pane, else its tab (a lone pane has no row).
    if (this.at === null) {
      const fo = focused();
      let i = fo?.pane ? rows.findIndex((r) => r.kind === "pane" && r.p.pane === fo.pane) : -1;
      if (i < 0 && fo?.tab) i = rows.findIndex((r) => r.kind === "tab" && r.ctx.id === fo.tab);
      if (i < 0) i = rows.findIndex((r) => r.kind === "tab" && r.w.active && r.ctx.active);
      this.at = Math.max(0, i);
      // That place is already shown: moving off it and back switches, opening doesn't.
      this.shown = this.placeKey(rows[this.at]);
    }
    this.at = Math.min(this.at, pickable.length - 1);
    if (this.hint && this.hint.sig !== this.listSig(rows)) this.hint = null;
    const sel = pickable[this.at];
    // One continuous strip: each row at a fixed y. Scrolling moves the strip only
    // as far as it takes to keep the selected row in view, so the arrows can't
    // run the selection off the list.
    const H = { space: 36, tab: 32, pane: 28, new: 36, "space-new": 32 };
    const tops = [];
    let y = 0;
    rows.forEach((r) => { tops.push(y); y += H[r.kind] ?? 32; });
    const total = y;
    const height = Math.min(480, this.listHeight ?? 480);
    const fixed = total > height;
    const maxScroll = Math.max(0, total - height);
    this.scroll = Math.max(0, Math.min(this.scroll, maxScroll));
    const si = rows.indexOf(sel);
    if (si >= 0) {
      if (tops[si] < this.scroll) this.scroll = tops[si];
      if (tops[si] + (H[sel.kind] ?? 32) > this.scroll + height) this.scroll = tops[si] + (H[sel.kind] ?? 32) - height;
    }
    const place = (el, i) =>
      fixed
        ? el.absolute().left(0).right(0).top(tops[i] - this.scroll).bottom(height - (tops[i] + (H[rows[i].kind] ?? 32) - this.scroll))
        : el;
    const visible = (i) => !fixed || (tops[i] + (H[rows[i].kind] ?? 32) > this.scroll && tops[i] < this.scroll + height);

    const row = (r) => {
      const on = r === sel;
      if (r.kind === "space") {
        // The space's colored initial and name; the gap above sets the groups apart.
        return div().pt(4).child(
          h_flex()
            .id(`pk-sp-${r.w.id}`)
            .mx(4)
            .px(10)
            .h(32)
            .rounded(7)
            .gap(8)
            .items_center()
            .text_size(11)
            .font_semibold()
            .text_color(on ? t.foreground : t.dim)
            .cursor_pointer()
            .when(on, (el) => el.bg(t.hover))
            .hover((s) => s.bg(t.hover).text_color(t.foreground))
            .on_click(() => this.go(r))
            .children([this.hintBadge(t, r)].filter(Boolean))
            .child(h_flex().size(18).flex_none().rounded(5).bg(spaceColor(t, r.w)).items_center().justify_center().text_size(10.5).font_bold().text_color("#ffffff").child([...r.w.name][0]?.toUpperCase() ?? "?"))
            .child(div().flex_1().truncate().child(r.w.name)),
        );
      }
      if (r.kind === "pane") {
        // One step in from its tab: status, program, title, and the folder on the right.
        const name = paneName(r.p);
        const title = r.p.title && r.p.title !== name ? r.p.title : "";
        const here = r.w.active && r.ctx.active && r.p.focused;
        return h_flex()
          .id(`pk-p-${r.p.pane}`)
          .mx(4)
          .pl(32)
          .pr(10)
          .h(28)
          .rounded(7)
          .gap(8)
          .items_center()
          .text_size(12)
          .cursor_pointer()
          .when(on, (el) => el.bg(t.hover))
          .hover((s) => s.bg(t.hover))
          .on_click(() => this.go(r))
          .children([this.hintBadge(t, r)].filter(Boolean))
          .child(this.glyph(t, r.p.status))
          .child(div().flex_none().text_color(r.ctx.settled ? t.dim : t.foreground).when(here, (d) => d.font_semibold()).child(name))
          .child(div().flex_1().min_w(0).truncate().text_color(r.ctx.settled ? t.dim : t.muted).child(title))
          .child(div().flex_none().max_w(220).truncate().text_size(11).text_color(t.dim).child(folder(r.p.cwd)));
      }
      if (r.kind === "new" || r.kind === "space-new") {
        const label = r.kind === "new" ? "new tab" : r.machine ? `new space on ${r.machine}` : "new space";
        return h_flex()
          .id(r.kind === "new" ? "pk-new" : `pk-space-${r.machine ?? "here"}`)
          .mx(4)
          .when(r.kind === "new", (el) => el.mt(4))
          .px(10)
          .h(32)
          .items_center()
          .rounded(7)
          .gap(8)
          .text_color(t.muted)
          .cursor_pointer()
          .when(on, (el) => el.bg(t.hover))
          .hover((s) => s.bg(t.hover))
          .on_click(() => this.go(r))
          .child(div().w(12).child("+"))
          .child(label);
      }
      // A lone pane is told here; with more, the agents in it (each pane has its row below).
      const who = r.panes.length === 1 ? paneName(r.panes[0]) : r.mine.map((a) => a.program?.name ?? "agent").join(" · ");
      const here = r.w.active && r.ctx.active;
      return h_flex()
        .id(`pk-${r.ctx.id}`)
        .mx(4)
        .px(10)
.h(32)
        .rounded(7)
        .gap(10)
        .items_center()
        .cursor_pointer()
        .when(on, (el) => el.bg(t.hover))
        .hover((s) => s.bg(t.hover))
        .on_click(() => this.go(r))
        .children([this.hintBadge(t, r)].filter(Boolean))
        .child(this.glyph(t, r.ctx.status))
        .child(div().flex_1().truncate().text_color(r.ctx.settled ? t.dim : t.foreground).when(here, (d) => d.font_semibold()).child(r.ctx.name))
        .when(r.ctx.status === "blocked", (el) => el.child(div().text_size(11).text_color(t.blocked).child("needs you")))
        .when(r.ctx.status === "done", (el) => el.child(div().text_size(11).text_color(t.done).child("finished")))
        .child(div().text_size(11).text_color(t.dim).child(who + (r.team ? `  +${r.team}` : "")));
    };

    return v_flex()
      .id("picker")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      .p(18)
      .gap(10)
      .bg(t.popover)
      .text_size(13)
      .on_key_down((e, cx) => {
        const k = e.key;
        const m = e.modifiers;
        const plain = !m.control && !m.alt && !m.platform && !m.shift;
        const normal = !this.insert && plain;
        if (this.hint && this.hintKey(e, rows, cx)) {
          cx.stop_propagation();
          return cx.notify();
        }
        if (k === "escape") {
          // insert -> normal (the filter stays); normal -> close
          if (!this.insert && Date.now() - this.blurredAt > 100) return this.close();
          this.insert = false;
          this.handle.focus();
        } else if (k === "down" || (normal && k === "j")) {
          this.at = (this.at + 1) % pickable.length;
          this.switchTo(pickable[this.at]);
        } else if (k === "up" || (normal && k === "k")) {
          this.at = (this.at + pickable.length - 1) % pickable.length;
          this.switchTo(pickable[this.at]);
        }
        else if (normal && k === "enter") this.go(sel, cx);
        else if (normal && k === "f") this.startHints(rows, visible);
        else if (normal && k === "i") {
          this.insert = true;
          this.input.focus();
        } else if (normal && k === "q") return this.close();
        else if (k === "d" && e.modifiers.control) {
          if (sel?.kind === "tab") {
            this.close();
            run("tab.close", { id: sel.ctx.id });
          }
        } else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(h_flex().items_center().child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child("Go to…")).child(div().px(6).py(1).mr(6).rounded(5).border_1().border_color(this.insert ? t.dim : t.accent).when(!!this.hint, (el) => el.bg(t.accent)).text_size(10).font_semibold().text_color(this.hint ? t.accent_foreground : this.insert ? t.dim : t.accent).child(this.hint ? "HINT" : this.insert ? "INSERT" : "NORMAL")).child(div().id("picker-esc").px(6).py(2).rounded(5).text_size(11).text_color(t.dim).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(() => this.close()).child("Esc")))
      .child(
        h_flex().h(36).flex_none().px(10).gap(8).items_center().rounded(9).border_1().border_color(t.accent).bg(t.background)
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .child(svg("mods/workspace-chrome/search.svg").size(15).text_color(t.dim))
          .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground)),
      )
      .child(
        v_flex()
          .id("pk-list")
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_size_change((size, cx) => {
            this.listHeight = size.height / settings().zoom;
            cx.notify();
          })
          .h(Math.min(480, total))
          .min_h(0)
          .mb(6)
          .when(fixed, (el) =>
            el.overflow_hidden().on_scroll_wheel((e, cx) => {
              // What's in view changes, so the hints would be on the wrong rows.
              this.hint = null;
              this.scroll = Math.max(0, Math.min(this.scroll - e.delta.y, maxScroll));
              // The selection follows the wheel, so the next frame doesn't scroll back to it.
              while (this.at < pickable.length - 1 && tops[rows.indexOf(pickable[this.at])] < this.scroll) this.at++;
              while (this.at > 0 && tops[rows.indexOf(pickable[this.at])] + (H[pickable[this.at].kind] ?? 32) > this.scroll + height) this.at--;
              this.switchTo(pickable[this.at]);
              cx.notify();
            }))
          .children(rows.map((r, i) => (visible(i) ? place(row(r), i) : null)).filter(Boolean)),
      )
      .child(this.footer(t));
  }

  // The keys of the mode we're in (same test as the badge), one dim line under the list.
  // Pairs of [keys, what]; keys are set a shade brighter than the words.
  footer(t) {
    const help = this.hint
      ? [["", "type a hint to jump"], ["backspace", "undo"], ["esc", "cancel"]]
      : this.insert
        ? [["", "type to filter"], ["↑/↓", "move"], ["esc", "normal"], ["enter", "close"]]
        : [["j/k", "move"], ["f", "hint"], ["i", "search"], ["enter/esc/q", "close"]];
    const parts = [];
    help.forEach(([keys, what], i) => {
      if (i > 0) parts.push(div().child("·"));
      parts.push(h_flex().gap(4).when(!!keys, (el) => el.child(div().text_color(t.muted).child(keys))).child(div().child(what)));
    });
    return h_flex().flex_none().pt(8).gap(6).items_center().border_t(1).border_color(t.border).text_size(11).text_color(t.dim).children(parts);
  }
}
