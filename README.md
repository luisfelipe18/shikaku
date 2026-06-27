# Puzzles: Shikaku, Sudoku, Nonogram, Binairo

Four browser-based logic puzzles in one app, built to run on GitHub Pages and
optimized for play in modern browsers including mobile Safari. Switch between
games with the tabs at the top.

## Play

Open `index.html` in any modern browser, or deploy to GitHub Pages (see below).

## Shikaku

Shikaku ("divide into squares") is a Nikoli logic puzzle.

- Drag across cells to draw a rectangle.
- Every rectangle must contain exactly one number.
- The number equals the rectangle's area (width times height).
- Rectangles cannot overlap and must cover the entire grid.
- Tap an empty cell to place a single-cell rectangle; tap a rectangle to remove it.

## Sudoku

Classic 9x9 Sudoku.

- Tap a cell, then tap a number to place it.
- Each row, column, and 3x3 box must contain 1 to 9 with no repeats.
- Use Notes to pencil in candidates. Conflicts are highlighted in red.
- Hint fills the selected cell. Keyboard input and arrow keys are supported.

## Nonogram

Also known as Picross or Griddlers.

- Each number is a run of consecutive filled cells in that row or column.
- Drag to paint cells. Toggle Mode to fill cells or mark them with an X.
- Numbers in a clue are separated by at least one empty cell.
- Solve every line to reveal the hidden picture.

## Binairo

Also known as Takuzu.

- Tap a cell to cycle through empty, 0, and 1.
- No more than two of the same digit may sit next to each other.
- Each row and column has an equal number of 0s and 1s.
- No two rows are identical, and no two columns are identical.

## Features

- Generators with uniqueness solvers, so every puzzle has a single solution.
- Multiple difficulties per game.
- Touch and pointer input tuned for Safari and mobile.
- Per-game timer with best-time tracking and automatic progress saving.
- Undo and Solve in every game, plus game-specific helpers (Notes, Hint, Mode).
- Modern, responsive dark interface. No build step and no dependencies.

## Project structure

```
index.html        Markup, tabs, and all game views
styles.css        Theme and responsive styles
js/main.js        Tab switching and lazy game initialization
js/puzzle.js      Shikaku generator and uniqueness solver
js/game.js        Shikaku game state and rule validation
js/shikaku.js     Shikaku canvas rendering, input, and controls
js/sudoku.js      Sudoku generator and uniqueness solver
js/sudoku-ui.js   Sudoku board rendering, input, and controls
js/nonogram.js    Nonogram generator and line solver
js/nonogram-ui.js Nonogram canvas rendering, input, and controls
js/binairo.js     Binairo generator and uniqueness solver
js/binairo-ui.js  Binairo board rendering, input, and controls
```

## Deploy to GitHub Pages

This repository includes a workflow at `.github/workflows/deploy.yml` that
publishes the site with GitHub Actions.

1. In the repository, open **Settings -> Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to the configured branch. The workflow builds and deploys the site, and
   the live URL appears in the workflow run summary.

The site is fully static, so it can also be served by enabling Pages from a
branch root.
