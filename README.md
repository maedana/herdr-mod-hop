# herdr-mod-hop

A [herdr-app](https://github.com/herdrdev/herdr-app) mod that lets you hop between spaces, tabs and panes with the keyboard. It opens as a translucent overlay window with a tree of everything you have open.

## Features

- Tree of spaces > tabs > panes
- Moving the selection switches the view behind the overlay; Enter / Esc / q just close it
- NORMAL / INSERT / HINT modes
- `f` jumps by hint: home-row letters first, two or more letters when there are not enough
- Key help for the current mode in the footer
- Semi-transparent window

## Keys

NORMAL (default):

| Key | Action |
| --- | --- |
| `j` / `k`, `↓` / `↑` | Move the selection |
| `f` | Show hints |
| `i` | Switch to INSERT |
| `Enter` / `Esc` / `q` | Close |
| `ctrl-d` | Close the selected tab |

INSERT:

| Key | Action |
| --- | --- |
| Letters | Filter the tree |
| `↓` / `↑` | Move the selection |
| `Esc` | Back to NORMAL (the filter stays) |
| `Enter` | Close |

HINT:

| Key | Action |
| --- | --- |
| Hint letters | Jump to that row |
| `backspace` | Undo the last letter |
| `Esc` | Cancel |

## Install

```sh
./install.sh
```

This copies `mods/*/` into `$HERDR_APP_HOME/mods/` (default `~/.config/herdr-app/mods/`). It copies rather than symlinks, because a symlinked mod folder is not hot-reloaded.

Then bind a key in `keys.json` (in the `global` section):

```json
"ctrl-shift-k": "mod.open:hop"
```

## Requires

Tested with herdr-app 0.1.16.

## Development

```sh
node --test
```

## License

Apache License 2.0, see [LICENSE](LICENSE).

`mods/hop/main.js` is derived from the `picker` mod shipped with [herdr-app](https://github.com/herdrdev/herdr-app) (Apache License 2.0) and has been modified.
