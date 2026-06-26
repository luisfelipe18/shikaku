// Sudoku engine: full-grid generator, uniqueness-checked puzzle maker, solver.
// Boards are flat arrays of 81 numbers, 0 meaning empty.

const SIZE = 9;
const CELLS = 81;

const PEERS = buildPeers();

function buildPeers() {
  const peers = [];
  for (let i = 0; i < CELLS; i++) {
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    const set = new Set();
    for (let k = 0; k < SIZE; k++) {
      set.add(r * SIZE + k);
      set.add(k * SIZE + c);
    }
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        set.add((br + dr) * SIZE + (bc + dc));
      }
    }
    set.delete(i);
    peers.push([...set]);
  }
  return peers;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function canPlace(board, idx, value) {
  for (const p of PEERS[idx]) {
    if (board[p] === value) return false;
  }
  return true;
}

// Pick the empty cell with the fewest candidates to keep search shallow.
function findBest(board) {
  let best = -1;
  let bestCount = 10;
  let bestCands = null;
  for (let i = 0; i < CELLS; i++) {
    if (board[i] !== 0) continue;
    const cands = [];
    for (let v = 1; v <= SIZE; v++) {
      if (canPlace(board, i, v)) cands.push(v);
    }
    if (cands.length < bestCount) {
      bestCount = cands.length;
      best = i;
      bestCands = cands;
      if (bestCount <= 1) break;
    }
  }
  return { idx: best, cands: bestCands };
}

// Count solutions up to `limit`.
export function countSolutions(board, limit = 2) {
  const work = board.slice();
  let count = 0;

  function recurse() {
    if (count >= limit) return;
    const { idx, cands } = findBest(work);
    if (idx === -1) {
      count++;
      return;
    }
    if (cands.length === 0) return;
    for (const v of cands) {
      work[idx] = v;
      recurse();
      work[idx] = 0;
      if (count >= limit) return;
    }
  }

  recurse();
  return count;
}

export function solve(board) {
  const work = board.slice();
  function recurse() {
    const { idx, cands } = findBest(work);
    if (idx === -1) return true;
    if (!cands || cands.length === 0) return false;
    for (const v of cands) {
      work[idx] = v;
      if (recurse()) return true;
      work[idx] = 0;
    }
    return false;
  }
  return recurse() ? work : null;
}

function fillBoard(board) {
  const { idx } = findBest(board);
  if (idx === -1) return true;
  const cands = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((v) => canPlace(board, idx, v)));
  for (const v of cands) {
    board[idx] = v;
    if (fillBoard(board)) return true;
    board[idx] = 0;
  }
  return false;
}

export const DIFFICULTIES = {
  easy: { label: "Easy", givens: 42 },
  medium: { label: "Medium", givens: 34 },
  hard: { label: "Hard", givens: 28 },
  expert: { label: "Expert", givens: 24 },
};

// Generate a puzzle by carving cells out of a full grid while keeping the
// solution unique.
export function generate(difficultyKey) {
  const cfg = DIFFICULTIES[difficultyKey] || DIFFICULTIES.easy;
  const solution = new Array(CELLS).fill(0);
  fillBoard(solution);

  const puzzle = solution.slice();
  const order = shuffle([...Array(CELLS).keys()]);
  let filled = CELLS;
  const target = cfg.givens;

  for (const idx of order) {
    if (filled <= target) break;
    const backup = puzzle[idx];
    if (backup === 0) continue;
    puzzle[idx] = 0;
    if (countSolutions(puzzle, 2) === 1) {
      filled--;
    } else {
      puzzle[idx] = backup;
    }
  }

  const givens = puzzle.map((v) => v !== 0);
  return { puzzle, solution, givens, difficulty: difficultyKey };
}
