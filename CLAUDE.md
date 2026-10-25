# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No `package.json`, no build, no linter, no tests. UI text and README are in Spanish; keep new user-facing strings in Spanish.

## Running

Open `index.html` directly, or serve statically (e.g. `python -m http.server 8000`) and visit `http://localhost:8000`.

## Architecture

Everything lives in `game.js` (a single script loaded by `index.html`, using module-level globals — no modules/classes). `index.html` supplies the element IDs the script looks up at load time (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`, `skin-select`); renaming any of them breaks the script.

Key points that span several functions:

- **Piece/board encoding**: `PIECES[type]` and `COLORS[type]` are indexed 1–7 (index 0 is `null`). Board cells hold `0` or the piece type index, which doubles as the color index in `drawBlock`. `COLORS` is only the retro palette; the active palette/draw style comes from `SKINS[currentSkin]` (`colors`, `bg`, `grid`, `drawBlock`), applied via `applySkin()` (persisted in localStorage `skin`, mirrored in `data-skin` on `<html>`, selector `#skin-select`). `drawBlock`, `drawGrid` and `clearCanvas` read from the active skin, and the next-piece canvas uses it too.
- **State flow**: `loop` (rAF, accumulates `dropAccum` against `dropInterval`) and the `keydown` handler both mutate the global `current` piece; locking goes through `lockPiece()` → `merge()` → `clearLines()` (updates score/lines/level/`dropInterval`) → `spawn()`. `spawn()` calls `endGame()` if the new piece collides immediately.
- **Pause/restart**: `togglePause` cancels/restarts the rAF loop and reuses the same overlay as game over; `init()` fully resets state and is also the restart button handler.
- **Board size is duplicated**: `COLS`/`ROWS`/`BLOCK` in `game.js` must match the `width`/`height` attributes of `<canvas id="board">` in `index.html` (currently 300×600). The next-piece preview uses a separate 120×120 canvas with a hardcoded 30px block.
- Rotation is clockwise only (`rotateCW`) with simple horizontal kicks `[0, -1, 1, -2, 2]` in `tryRotate` (not SRS).
