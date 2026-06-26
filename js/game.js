// Game state: tracks the player's rectangles over a puzzle and validates them.

export class Game {
  constructor(puzzle) {
    this.load(puzzle);
  }

  load(puzzle) {
    this.rows = puzzle.rows;
    this.cols = puzzle.cols;
    this.clues = puzzle.clues;
    this.solution = puzzle.solution || null;
    this.difficulty = puzzle.difficulty;
    this.clueAt = new Map(); // cellIndex -> clue value
    for (const clue of this.clues) {
      this.clueAt.set(clue.r * this.cols + clue.c, clue.value);
    }
    this.rects = []; // { r, c, w, h }
    this.history = [];
    this.solved = false;
  }

  cellIndex(r, c) {
    return r * this.cols + c;
  }

  snapshot() {
    this.history.push(this.rects.map((rect) => ({ ...rect })));
    if (this.history.length > 200) this.history.shift();
  }

  undo() {
    if (this.history.length === 0) return false;
    this.rects = this.history.pop();
    this.solved = false;
    return true;
  }

  clear() {
    if (this.rects.length === 0) return;
    this.snapshot();
    this.rects = [];
    this.solved = false;
  }

  rectAtCell(r, c) {
    for (let i = this.rects.length - 1; i >= 0; i--) {
      const rect = this.rects[i];
      if (r >= rect.r && r < rect.r + rect.h && c >= rect.c && c < rect.c + rect.w) {
        return i;
      }
    }
    return -1;
  }

  removeRectAt(r, c) {
    const idx = this.rectAtCell(r, c);
    if (idx === -1) return false;
    this.snapshot();
    this.rects.splice(idx, 1);
    this.solved = false;
    return true;
  }

  // Add a rectangle from a drag between two cells. Any existing rectangle that
  // overlaps the new one is removed first.
  addRect(r0, c0, r1, c1) {
    const top = Math.min(r0, r1);
    const left = Math.min(c0, c1);
    const bottom = Math.max(r0, r1);
    const right = Math.max(c0, c1);
    const rect = { r: top, c: left, w: right - left + 1, h: bottom - top + 1 };

    this.snapshot();
    this.rects = this.rects.filter((other) => !this._overlap(rect, other));
    this.rects.push(rect);
    this.solved = false;
    this._checkSolved();
    return rect;
  }

  _overlap(a, b) {
    return (
      a.c < b.c + b.w &&
      a.c + a.w > b.c &&
      a.r < b.r + b.h &&
      a.r + a.h > b.r
    );
  }

  // Classify a rectangle: "valid" (one clue, area matches), "error" (wrong),
  // or "open" (no clue inside yet).
  classify(rect) {
    let cluesInside = 0;
    let value = 0;
    for (let rr = rect.r; rr < rect.r + rect.h; rr++) {
      for (let cc = rect.c; cc < rect.c + rect.w; cc++) {
        const v = this.clueAt.get(this.cellIndex(rr, cc));
        if (v !== undefined) {
          cluesInside++;
          value = v;
        }
      }
    }
    const area = rect.w * rect.h;
    if (cluesInside === 0) return "open";
    if (cluesInside > 1) return "error";
    return value === area ? "valid" : "error";
  }

  filledCells() {
    let n = 0;
    for (const rect of this.rects) n += rect.w * rect.h;
    return n;
  }

  validCount() {
    let n = 0;
    for (const rect of this.rects) if (this.classify(rect) === "valid") n++;
    return n;
  }

  _checkSolved() {
    if (this.rects.length !== this.clues.length) {
      this.solved = false;
      return;
    }
    if (this.filledCells() !== this.rows * this.cols) {
      this.solved = false;
      return;
    }
    this.solved = this.rects.every((rect) => this.classify(rect) === "valid");
  }

  revealSolution() {
    if (!this.solution) return false;
    this.snapshot();
    this.rects = this.solution.map((rect) => ({ ...rect }));
    this._checkSolved();
    return true;
  }
}
