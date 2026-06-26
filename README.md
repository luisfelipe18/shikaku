# Puzzles: Shikaku and Sudoku

Two browser-based logic puzzles in one app, built to run on GitHub Pages and
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
- Tap a rectangle to remove it. Drawing over an existing rectangle replaces it.

Rectangles turn green when valid, red when wrong, and stay neutral while they
have no number inside yet.

## Sudoku

Classic 9x9 Sudoku.

- Tap a cell, then tap a number to place it.
- Each row, column, and 3x3 box must contain 1 to 9 with no repeats.
- Use Notes to pencil in candidates. Conflicts are highlighted in red.
- Hint fills the selected cell. Keyboard input and arrow keys are supported.

## Features

- Generators with uniqueness solvers, so every puzzle has a single solution.
- Four difficulties for each game.
- Touch and pointer input tuned for Safari and mobile.
- Per-game timer with best-time tracking and automatic progress saving.
- Undo and Solve in both games; Clear for Shikaku; Notes and Hint for Sudoku.
- Modern, responsive dark interface. No build step and no dependencies.

## Project structure

```
index.html        Markup, tabs, and both game views
styles.css        Theme and responsive styles
js/main.js        Tab switching and lazy game initialization
js/puzzle.js      Shikaku generator and uniqueness solver
js/game.js        Shikaku game state and rule validation
js/shikaku.js     Shikaku canvas rendering, input, and controls
js/sudoku.js      Sudoku generator and uniqueness solver
js/sudoku-ui.js   Sudoku board rendering, input, and controls
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
