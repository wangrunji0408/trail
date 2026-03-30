# TRAIL - Project Guide

## Overview
Browser-based puzzle game. Snake navigates a grid collecting colors to pass gates. Zero npm dependencies, zero build tools, ES modules loaded directly by browser.

## Architecture

```
index.html              HTML/CSS + <script type="module" src="src/main.js">
src/main.js             Entry point: game init, key/touch input, D-pad, level loading
src/editor.js           Editor panel: palette, painting, resize, save/load, solution playback
src/constants.js        Shared constants: COLOR_HEX, TILES, DIR_MAP
src/game.js             Game class: core logic, move, undo, fork/merge, portal, delegate
src/renderer.js         Renderer class: Canvas 2D rendering
src/parser.js           parseLevelText(): text DSL → level definition object
src/levels.js           Level file list, loadLevelsBrowser(), parseLevelText re-export
test/game.test.js       Tests using node:test (run: node --test test/game.test.js)
save-server.js          Node.js server (port 3001) for saving levels to disk
levels/*.txt            Level data files in custom text DSL
```

## Key Patterns

- **editor.js ↔ main.js coupling**: `initEditor(controller)` receives a controller object with getters/setters for shared state (renderer, game, levels). Returns an API object (`isOpen`, `open`, `close`, `renderIfOpen`, `handleTap`, etc.).
- **Game state**: `Game` class holds grid, snake, switchState, phase (`playing`|`forked`|`won`|`in_portal`|`delegate_select`), undoStack, branches (fork), portalGame (nested Game).
- **Cell types**: empty, wall, color, exit, gate, switch, switch_wall, checkpoint, dye, wildcard, fork, portal, delegate. Cells can also have `shadow` and `memoryStone` flags.
- **Colors**: red, blue, green, yellow. Mapped from single chars: r, b, g, y.

## Running
- Game: `npx serve .` then open in browser
- Tests: `node --test test/game.test.js`
- Save server: `node save-server.js`

## Conventions
- Vanilla JS, no TypeScript, no bundler
- Chinese UI text
- Commit messages in English, lowercase imperative style
