// Binairo (Takuzu) engine: full-grid generator, uniqueness-checked carver,
// and a propagating backtracking solver.
//
// Rules on an N x N grid (N even):
//  - Each cell is 0 or 1.
//  - No three equal cells in a row, horizontally or vertically.
//  - Each row and each column has the same number of 0s and 1s.
//  - No two rows are identical, and no two columns are identical.

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Can value v be assigned at (r, c) without breaking the no-three rule or the
// per-line count limit, given the other concrete cells? Empty cells (-1) are
// ignored, so this is safe during both generation and solving.
function canAssign(board, N, r, c, v) {
  const at = (rr, cc) => board[rr * N + cc];
  // No three in a row horizontally.
  if (c >= 2 && at(r, c - 1) === v && at(r, c - 2) === v) return false;
  if (c <= N - 3 && at(r, c + 1) === v && at(r, c + 2) === v) return false;
  if (c >= 1 && c <= N - 2 && at(r, c - 1) === v && at(r, c + 1) === v) return false;
  // No three in a row vertically.
  if (r >= 2 && at(r - 1, c) === v && at(r - 2, c) === v) return false;
  if (r <= N - 3 && at(r + 1, c) === v && at(r + 2, c) === v) return false;
  if (r >= 1 && r <= N - 2 && at(r - 1, c) === v && at(r + 1, c) === v) return false;
  // Count limit.
  const half = N / 2;
  let rowCount = 0;
  let colCount = 0;
  for (let k = 0; k < N; k++) {
    if (board[r * N + k] === v) rowCount++;
    if (board[k * N + c] === v) colCount++;
  }
  if (rowCount >= half || colCount >= half) return false;
  return true;
}

function lineComplete(board, N, idx, isRow) {
  for (let k = 0; k < N; k++) {
    if (board[(isRow ? idx * N + k : k * N + idx)] === -1) return false;
  }
  return true;
}

function duplicateLine(board, N, idx, isRow) {
  const get = (i, k) => board[isRow ? i * N + k : k * N + i];
  for (let other = 0; other < N; other++) {
    if (other === idx) continue;
    if (!lineComplete(board, N, other, isRow)) continue;
    let same = true;
    for (let k = 0; k < N; k++) {
      if (get(idx, k) !== get(other, k)) { same = false; break; }
    }
    if (same) return true;
  }
  return false;
}

// Apply forced single-candidate deductions until stable. Returns false on a
// contradiction. Mutates board.
function propagate(board, N) {
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < N * N; i++) {
      if (board[i] !== -1) continue;
      const r = Math.floor(i / N);
      const c = i % N;
      const can0 = canAssign(board, N, r, c, 0);
      const can1 = canAssign(board, N, r, c, 1);
      if (!can0 && !can1) return false;
      if (can0 !== can1) {
        board[i] = can0 ? 0 : 1;
        changed = true;
      }
    }
  }
  return true;
}

function findEmpty(board, N) {
  for (let i = 0; i < N * N; i++) if (board[i] === -1) return i;
  return -1;
}

// Count solutions up to `limit`.
export function countSolutions(start, N, limit = 2) {
  let count = 0;

  function search(board) {
    if (count >= limit) return;
    if (!propagate(board, N)) return;
    const idx = findEmpty(board, N);
    if (idx === -1) {
      // Full board: verify distinct rows and columns.
      for (let i = 0; i < N; i++) {
        if (duplicateLine(board, N, i, true)) return;
        if (duplicateLine(board, N, i, false)) return;
      }
      count++;
      return;
    }
    const r = Math.floor(idx / N);
    const c = idx % N;
    for (const v of [0, 1]) {
      if (!canAssign(board, N, r, c, v)) continue;
      const next = board.slice();
      next[idx] = v;
      // Early duplicate pruning when a line just completed.
      if (lineComplete(next, N, r, true) && duplicateLine(next, N, r, true)) continue;
      if (lineComplete(next, N, c, false) && duplicateLine(next, N, c, false)) continue;
      search(next);
      if (count >= limit) return;
    }
  }

  search(start.slice());
  return count;
}

function buildFullBoard(N) {
  const board = new Int8Array(N * N).fill(-1);

  function fill(idx) {
    if (idx === N * N) return true;
    const r = Math.floor(idx / N);
    const c = idx % N;
    for (const v of shuffle([0, 1])) {
      if (!canAssign(board, N, r, c, v)) continue;
      board[idx] = v;
      if (lineComplete(board, N, r, true) && duplicateLine(board, N, r, true)) { board[idx] = -1; continue; }
      if (lineComplete(board, N, c, false) && duplicateLine(board, N, c, false)) { board[idx] = -1; continue; }
      if (fill(idx + 1)) return true;
      board[idx] = -1;
    }
    return false;
  }

  return fill(0) ? board : null;
}

export const DIFFICULTIES = {
  easy: { label: "Easy", size: 6, clues: 18 },
  medium: { label: "Medium", size: 8, clues: 30 },
  hard: { label: "Hard", size: 10, clues: 45 },
  expert: { label: "Expert", size: 12, clues: 62 },
};

// Generate a puzzle by carving a full solution down to roughly `clues` givens
// while keeping the solution unique.
export function generate(difficultyKey) {
  const cfg = DIFFICULTIES[difficultyKey] || DIFFICULTIES.easy;
  const N = cfg.size;
  let solution = null;
  for (let i = 0; i < 50 && !solution; i++) solution = buildFullBoard(N);
  if (!solution) return generate("easy");

  const puzzle = Int8Array.from(solution);
  const order = shuffle([...Array(N * N).keys()]);
  let remaining = N * N;

  for (const idx of order) {
    if (remaining <= cfg.clues) break;
    const backup = puzzle[idx];
    puzzle[idx] = -1;
    if (countSolutions(puzzle, N, 2) === 1) {
      remaining--;
    } else {
      puzzle[idx] = backup;
    }
  }

  const givens = Array.from(puzzle, (v) => v !== -1);
  return {
    size: N,
    values: Array.from(puzzle),
    solution: Array.from(solution),
    givens,
    difficulty: difficultyKey,
  };
}
