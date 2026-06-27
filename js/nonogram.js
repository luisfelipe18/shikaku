// Nonogram (Picross) engine: generates puzzles that are solvable by pure line
// logic, which also guarantees a unique solution.
//
// A solution is a grid of 0/1. Each row and column has a clue: the sequence of
// run lengths of consecutive filled (1) cells.

function clueFor(line) {
  const clue = [];
  let run = 0;
  for (const v of line) {
    if (v === 1) run++;
    else if (run > 0) { clue.push(run); run = 0; }
  }
  if (run > 0) clue.push(run);
  return clue.length ? clue : [0];
}

// All arrangements of a line consistent with the clue and the known state
// (-1 unknown, 0 empty, 1 filled). Returns an array of 0/1 arrays.
function arrangements(clue, state) {
  const n = state.length;
  const blocks = clue.length === 1 && clue[0] === 0 ? [] : clue;
  const results = [];
  const arr = new Array(n).fill(0);

  function place(blockIdx, pos) {
    if (blockIdx === blocks.length) {
      for (let i = pos; i < n; i++) {
        if (state[i] === 1) return;
        arr[i] = 0;
      }
      results.push(arr.slice());
      return;
    }
    const len = blocks[blockIdx];
    let remaining = blocks.length - blockIdx - 1;
    for (let b = blockIdx; b < blocks.length; b++) remaining += blocks[b];
    const maxStart = n - remaining;
    for (let s = pos; s <= maxStart; s++) {
      let ok = true;
      for (let i = pos; i < s; i++) {
        if (state[i] === 1) { ok = false; break; }
      }
      if (!ok) break; // a forced 1 before s blocks every later start too
      for (let i = s; i < s + len; i++) {
        if (state[i] === 0) { ok = false; break; }
      }
      if (!ok) continue;
      for (let i = pos; i < s; i++) arr[i] = 0;
      for (let i = s; i < s + len; i++) arr[i] = 1;
      let next = s + len;
      if (blockIdx < blocks.length - 1) {
        if (next < n) {
          if (state[next] === 1) continue;
          arr[next] = 0;
          next++;
        }
      }
      place(blockIdx + 1, next);
    }
  }

  place(0, 0);
  return results;
}

// Tighten a single line: returns the updated state, or null on contradiction.
function solveLine(clue, state) {
  const options = arrangements(clue, state);
  if (options.length === 0) return null;
  const n = state.length;
  const out = state.slice();
  for (let i = 0; i < n; i++) {
    if (out[i] !== -1) continue;
    let all1 = true;
    let all0 = true;
    for (const opt of options) {
      if (opt[i] === 1) all0 = false;
      else all1 = false;
      if (!all0 && !all1) break;
    }
    if (all1) out[i] = 1;
    else if (all0) out[i] = 0;
  }
  return out;
}

// Solve by repeated line logic only. Returns the grid (may contain -1 if logic
// is insufficient) or null on contradiction.
function lineSolve(rowClues, colClues) {
  const R = rowClues.length;
  const C = colClues.length;
  const grid = Array.from({ length: R }, () => new Array(C).fill(-1));
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < R; r++) {
      const res = solveLine(rowClues[r], grid[r]);
      if (!res) return null;
      for (let c = 0; c < C; c++) {
        if (grid[r][c] !== res[c]) { grid[r][c] = res[c]; changed = true; }
      }
    }
    for (let c = 0; c < C; c++) {
      const col = grid.map((row) => row[c]);
      const res = solveLine(colClues[c], col);
      if (!res) return null;
      for (let r = 0; r < R; r++) {
        if (grid[r][c] !== res[r]) { grid[r][c] = res[r]; changed = true; }
      }
    }
  }
  return grid;
}

export const DIFFICULTIES = {
  easy: { label: "Easy", rows: 5, cols: 5, density: 0.55 },
  medium: { label: "Medium", rows: 10, cols: 10, density: 0.55 },
  hard: { label: "Hard", rows: 15, cols: 15, density: 0.55 },
};

// Generate a nonogram that is fully solvable by line logic (hence unique).
export function generate(difficultyKey) {
  const cfg = DIFFICULTIES[difficultyKey] || DIFFICULTIES.easy;
  const { rows, cols, density } = cfg;

  for (let attempt = 0; attempt < 4000; attempt++) {
    const solution = [];
    let anyFilled = false;
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const v = Math.random() < density ? 1 : 0;
        if (v) anyFilled = true;
        row.push(v);
      }
      solution.push(row);
    }
    if (!anyFilled) continue;

    const rowClues = solution.map(clueFor);
    const colClues = [];
    for (let c = 0; c < cols; c++) {
      colClues.push(clueFor(solution.map((row) => row[c])));
    }

    const solved = lineSolve(rowClues, colClues);
    if (!solved) continue;
    let complete = true;
    for (let r = 0; r < rows && complete; r++) {
      for (let c = 0; c < cols; c++) {
        if (solved[r][c] !== solution[r][c]) { complete = false; break; }
      }
    }
    if (complete) {
      return { rows, cols, rowClues, colClues, solution, difficulty: difficultyKey };
    }
  }

  // Fallback: a trivially solvable single-cell puzzle (extremely unlikely).
  const solution = Array.from({ length: rows }, () => new Array(cols).fill(0));
  solution[0][0] = 1;
  const rowClues = solution.map(clueFor);
  const colClues = [];
  for (let c = 0; c < cols; c++) colClues.push(clueFor(solution.map((row) => row[c])));
  return { rows, cols, rowClues, colClues, solution, difficulty: difficultyKey };
}
