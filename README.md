# Shikaku

A web version of the Shikaku logic puzzle, built to run on GitHub Pages and
optimized for browser play, including mobile Safari.

## Play

Open `index.html` in any modern browser, or deploy to GitHub Pages (see below).

## How to play

Shikaku ("divide into squares") is a Nikoli logic puzzle.

- Drag across cells to draw a rectangle.
- Every rectangle must contain exactly one number.
- The number equals the rectangle's area (width times height).
- Rectangles cannot overlap and must cover the entire grid.
- Tap a rectangle to remove it. Drawing over an existing rectangle replaces it.

Rectangles are colored as you build them: green when a rectangle is valid, red
when it is wrong, and neutral while it has no number inside yet.

## Features

- Puzzle generator with a uniqueness solver, so every puzzle has a single
  solution.
- Four difficulties: Easy (5x5), Medium (7x7), Hard (9x9), Expert (11x11).
- Touch and pointer input tuned for Safari and mobile.
- Timer with best-time tracking and automatic progress saving (localStorage).
- Undo, Clear, and Solve controls.
- Modern, responsive dark interface. No build step and no dependencies.

## Project structure

```
index.html        Markup and layout
styles.css        Theme and responsive styles
js/puzzle.js      Puzzle generator and uniqueness solver
js/game.js        Game state and rule validation
js/app.js         Canvas rendering, input, and controls
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
