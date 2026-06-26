// Shikaku puzzle engine: generator + uniqueness solver.
// A Shikaku puzzle divides a grid into rectangles. Each rectangle holds exactly
// one clue, and the clue value equals the rectangle's area. Rectangles tile the
// whole grid without gaps or overlaps.

function randInt(n) {
  return Math.floor(Math.random() * n);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Build a random rectangular tiling of the grid by anchoring each new rectangle
// at the top-left-most empty cell. This guarantees full coverage with no gaps.
function randomPartition(rows, cols, maxArea) {
  const grid = new Int32Array(rows * cols).fill(-1);
  const rects = [];
  let id = 0;

  for (let start = 0; start < rows * cols; start++) {
    if (grid[start] !== -1) continue;
    const r = Math.floor(start / cols);
    const c = start % cols;

    // Width available to the right on the anchor row.
    let maxW = 0;
    while (c + maxW < cols && grid[r * cols + (c + maxW)] === -1) maxW++;

    // Collect every legal rectangle anchored at (r, c) within the area cap.
    const candidates = [];
    for (let w = 1; w <= maxW; w++) {
      let maxH = 0;
      let ok = true;
      while (r + maxH < rows && ok) {
        for (let cc = c; cc < c + w; cc++) {
          if (grid[(r + maxH) * cols + cc] !== -1) { ok = false; break; }
        }
        if (ok) maxH++;
      }
      for (let h = 1; h <= maxH; h++) {
        const area = w * h;
        if (area <= maxArea) candidates.push({ w, h, area });
      }
    }

    // Weight toward larger rectangles so the board is not full of single cells,
    // but keep variety.
    let total = 0;
    for (const cand of candidates) total += cand.area;
    let pick = Math.random() * total;
    let chosen = candidates[candidates.length - 1];
    for (const cand of candidates) {
      pick -= cand.area;
      if (pick <= 0) { chosen = cand; break; }
    }

    for (let rr = r; rr < r + chosen.h; rr++) {
      for (let cc = c; cc < c + chosen.w; cc++) {
        grid[rr * cols + cc] = id;
      }
    }
    rects.push({ r, c, w: chosen.w, h: chosen.h });
    id++;
  }

  return rects;
}

function partitionToClues(rects) {
  return rects.map((rect) => {
    const r = rect.r + randInt(rect.h);
    const c = rect.c + randInt(rect.w);
    return { r, c, value: rect.w * rect.h };
  });
}

// All rectangles that contain the given clue, match its area, stay in bounds,
// and contain no other clue cell.
function rectanglesForClue(rows, cols, clue, clueKeys) {
  const result = [];
  const v = clue.value;
  for (let w = 1; w <= v; w++) {
    if (v % w !== 0) continue;
    const h = v / w;
    if (w > cols || h > rows) continue;
    for (let r0 = clue.r - h + 1; r0 <= clue.r; r0++) {
      if (r0 < 0 || r0 + h > rows) continue;
      for (let c0 = clue.c - w + 1; c0 <= clue.c; c0++) {
        if (c0 < 0 || c0 + w > cols) continue;
        let conflict = false;
        for (let rr = r0; rr < r0 + h && !conflict; rr++) {
          for (let cc = c0; cc < c0 + w; cc++) {
            const key = rr * cols + cc;
            if (key !== clue.r * cols + clue.c && clueKeys.has(key)) {
              conflict = true;
              break;
            }
          }
        }
        if (!conflict) result.push({ r: r0, c: c0, w, h });
      }
    }
  }
  return result;
}

// Count solutions up to `limit` using backtracking with a most-constrained-first
// ordering. Because clue areas always sum to the grid area, a non-overlapping
// placement of every clue is necessarily a perfect tiling.
export function countSolutions(rows, cols, clues, limit = 2) {
  const clueKeys = new Set(clues.map((cl) => cl.r * cols + cl.c));
  const candidatesList = clues.map((cl) => rectanglesForClue(rows, cols, cl, clueKeys));
  if (candidatesList.some((list) => list.length === 0)) return 0;

  const order = clues.map((_, i) => i).sort((a, b) => candidatesList[a].length - candidatesList[b].length);
  const cover = new Int8Array(rows * cols).fill(0);
  let count = 0;

  function canPlace(rect) {
    for (let rr = rect.r; rr < rect.r + rect.h; rr++) {
      for (let cc = rect.c; cc < rect.c + rect.w; cc++) {
        if (cover[rr * cols + cc]) return false;
      }
    }
    return true;
  }
  function mark(rect, value) {
    for (let rr = rect.r; rr < rect.r + rect.h; rr++) {
      for (let cc = rect.c; cc < rect.c + rect.w; cc++) {
        cover[rr * cols + cc] = value;
      }
    }
  }

  function backtrack(idx) {
    if (count >= limit) return;
    if (idx === order.length) { count++; return; }
    const clueIdx = order[idx];
    for (const rect of candidatesList[clueIdx]) {
      if (!canPlace(rect)) continue;
      mark(rect, 1);
      backtrack(idx + 1);
      mark(rect, 0);
      if (count >= limit) return;
    }
  }

  backtrack(0);
  return count;
}

export const DIFFICULTIES = {
  easy: { label: "Easy", rows: 5, cols: 5, maxArea: 6 },
  medium: { label: "Medium", rows: 7, cols: 7, maxArea: 8 },
  hard: { label: "Hard", rows: 9, cols: 9, maxArea: 9 },
  expert: { label: "Expert", rows: 11, cols: 11, maxArea: 10 },
};

// Generate a puzzle, preferring one with a unique solution.
export function generatePuzzle(difficultyKey) {
  const cfg = DIFFICULTIES[difficultyKey] || DIFFICULTIES.easy;
  const { rows, cols, maxArea } = cfg;
  const maxAttempts = 120;
  let fallback = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rects = randomPartition(rows, cols, maxArea);
    const clues = partitionToClues(rects);
    const puzzle = { rows, cols, clues, solution: rects, difficulty: difficultyKey };
    fallback = puzzle;
    if (countSolutions(rows, cols, clues, 2) === 1) return puzzle;
  }
  return fallback;
}
