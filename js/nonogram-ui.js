import { generate, DIFFICULTIES } from "./nonogram.js";

const STORE_KEY = "nonogram.state.v1";
const BEST_KEY = "nonogram.best.v1";

// Cell states: 0 empty, 1 filled, 2 marked (X).
const theme = {
  background: "#0f1320",
  grid: "#2a3147",
  gridStrong: "#46506e",
  fill: "#7aa2f7",
  mark: "#5a6b93",
  clue: "#cdd6f4",
  clueDone: "#5a6b93",
};

export function initNonogram(root) {
  const q = (name) => root.querySelector(`[data-el="${name}"]`);
  const canvas = q("board");
  const ctx = canvas.getContext("2d");
  const statusEl = q("status");
  const timerEl = q("timer");
  const bestEl = q("best");
  const progressEl = q("progress");
  const difficultyEl = q("difficulty");
  const modeBtn = q("mode");
  const winEl = q("win");
  const winTimeEl = q("win-time");

  let puzzle = null;
  let cells = null; // flat array of 0/1/2
  let history = [];
  let solved = false;
  let mode = "fill"; // or "mark"
  let drag = null; // { action, last }
  let cellSize = 28;
  let leftMargin = 0;
  let topMargin = 0;
  let maxRowClue = 1;
  let maxColClue = 1;
  let dpr = window.devicePixelRatio || 1;
  let timerStart = null;
  let timerId = null;
  let elapsed = 0;

  function nowSeconds() {
    return Math.floor((Date.now() - timerStart) / 1000) + elapsed;
  }
  function formatTime(total) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  function startTimer() {
    stopTimer();
    timerStart = Date.now();
    timerId = setInterval(() => { timerEl.textContent = formatTime(nowSeconds()); }, 500);
  }
  function stopTimer() {
    if (timerId) clearInterval(timerId);
    timerId = null;
  }
  function pause() {
    if (timerStart !== null) { elapsed = nowSeconds(); timerStart = null; }
    stopTimer();
  }

  function loadBest() {
    try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch { return {}; }
  }
  function showBest() {
    const v = loadBest()[puzzle.difficulty];
    bestEl.textContent = v ? formatTime(v) : "--:--";
  }
  function saveBest(seconds) {
    const best = loadBest();
    const key = puzzle.difficulty;
    if (best[key] === undefined || seconds < best[key]) {
      best[key] = seconds;
      localStorage.setItem(BEST_KEY, JSON.stringify(best));
    }
    showBest();
  }

  function persist() {
    if (!puzzle) return;
    localStorage.setItem(STORE_KEY, JSON.stringify({
      puzzle,
      cells,
      difficulty: puzzle.difficulty,
      elapsed: timerStart ? nowSeconds() : elapsed,
    }));
  }

  function restore() {
    try {
      const data = JSON.parse(localStorage.getItem(STORE_KEY));
      if (!data || !data.puzzle) return false;
      puzzle = data.puzzle;
      cells = data.cells;
      elapsed = data.elapsed || 0;
      difficultyEl.value = data.difficulty;
      checkSolved();
      return true;
    } catch {
      return false;
    }
  }

  function computeMargins() {
    maxRowClue = Math.max(1, ...puzzle.rowClues.map((c) => c.length));
    maxColClue = Math.max(1, ...puzzle.colClues.map((c) => c.length));
  }

  function layout() {
    const wrap = canvas.parentElement;
    const available = wrap.clientWidth || 320;
    // Reserve clue cells equal to one grid cell each.
    cellSize = Math.max(16, Math.min(40, Math.floor(available / (puzzle.cols + maxRowClue))));
    leftMargin = maxRowClue * cellSize;
    topMargin = maxColClue * cellSize;
    const cssW = leftMargin + puzzle.cols * cellSize;
    const cssH = topMargin + puzzle.rows * cellSize;
    dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  // A clue is satisfied if the corresponding line's filled runs match it.
  function runsOf(line) {
    const runs = [];
    let run = 0;
    for (const v of line) {
      if (v === 1) run++;
      else if (run > 0) { runs.push(run); run = 0; }
    }
    if (run > 0) runs.push(run);
    return runs.length ? runs : [0];
  }
  function sameClue(a, b) {
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }
  function clueDone(line, clue) {
    if (clue.length === 1 && clue[0] === 0) return line.every((v) => v === 0);
    return sameClue(runsOf(line), clue);
  }
  function rowLine(r) {
    const line = [];
    for (let c = 0; c < puzzle.cols; c++) line.push(cells[r * puzzle.cols + c] === 1 ? 1 : 0);
    return line;
  }
  function colLine(c) {
    const line = [];
    for (let r = 0; r < puzzle.rows; r++) line.push(cells[r * puzzle.cols + c] === 1 ? 1 : 0);
    return line;
  }

  function render() {
    const W = leftMargin + puzzle.cols * cellSize;
    const H = topMargin + puzzle.rows * cellSize;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, W, H);

    // Cells.
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        const v = cells[r * puzzle.cols + c];
        const x = leftMargin + c * cellSize;
        const y = topMargin + r * cellSize;
        if (v === 1) {
          ctx.fillStyle = theme.fill;
          ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
        } else if (v === 2) {
          ctx.strokeStyle = theme.mark;
          ctx.lineWidth = 2;
          const p = cellSize * 0.3;
          ctx.beginPath();
          ctx.moveTo(x + p, y + p);
          ctx.lineTo(x + cellSize - p, y + cellSize - p);
          ctx.moveTo(x + cellSize - p, y + p);
          ctx.lineTo(x + p, y + cellSize - p);
          ctx.stroke();
        }
      }
    }

    // Grid lines.
    for (let c = 0; c <= puzzle.cols; c++) {
      ctx.strokeStyle = c % 5 === 0 ? theme.gridStrong : theme.grid;
      ctx.lineWidth = c % 5 === 0 ? 1.5 : 1;
      const x = leftMargin + c * cellSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, topMargin);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let r = 0; r <= puzzle.rows; r++) {
      ctx.strokeStyle = r % 5 === 0 ? theme.gridStrong : theme.grid;
      ctx.lineWidth = r % 5 === 0 ? 1.5 : 1;
      const y = topMargin + r * cellSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Clues.
    const fontSize = Math.max(10, Math.floor(cellSize * 0.5));
    ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let r = 0; r < puzzle.rows; r++) {
      const clue = puzzle.rowClues[r];
      ctx.fillStyle = clueDone(rowLine(r), clue) ? theme.clueDone : theme.clue;
      for (let k = 0; k < clue.length; k++) {
        const cx = leftMargin - (clue.length - k) * cellSize + cellSize / 2;
        const cy = topMargin + r * cellSize + cellSize / 2;
        ctx.fillText(String(clue[k]), cx, cy + 1);
      }
    }
    for (let c = 0; c < puzzle.cols; c++) {
      const clue = puzzle.colClues[c];
      ctx.fillStyle = clueDone(colLine(c), clue) ? theme.clueDone : theme.clue;
      for (let k = 0; k < clue.length; k++) {
        const cx = leftMargin + c * cellSize + cellSize / 2;
        const cy = topMargin - (clue.length - k) * cellSize + cellSize / 2;
        ctx.fillText(String(clue[k]), cx, cy + 1);
      }
    }

    updateStatus();
  }

  function cellFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - leftMargin;
    const y = e.clientY - rect.top - topMargin;
    if (x < 0 || y < 0) return null;
    const c = Math.floor(x / cellSize);
    const r = Math.floor(y / cellSize);
    if (c < 0 || c >= puzzle.cols || r < 0 || r >= puzzle.rows) return null;
    return r * puzzle.cols + c;
  }

  function onPointerDown(e) {
    if (solved) return;
    const idx = cellFromEvent(e);
    if (idx === null) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    snapshot();
    const target = mode === "fill" ? 1 : 2;
    // If the cell already holds the target, the gesture clears instead.
    const clearing = cells[idx] === target;
    drag = { value: clearing ? 0 : target, last: idx };
    cells[idx] = clearing ? 0 : target;
    render();
  }

  function onPointerMove(e) {
    if (!drag) return;
    const idx = cellFromEvent(e);
    if (idx === null || idx === drag.last) return;
    e.preventDefault();
    drag.last = idx;
    cells[idx] = drag.value;
    render();
  }

  function onPointerUp(e) {
    if (!drag) return;
    e.preventDefault();
    drag = null;
    checkSolved();
    persist();
    render();
    if (solved) onWin();
  }

  function snapshot() {
    history.push(cells.slice());
    if (history.length > 400) history.shift();
  }

  function checkSolved() {
    solved = true;
    for (let i = 0; i < cells.length; i++) {
      const want = puzzle.solution[Math.floor(i / puzzle.cols)][i % puzzle.cols];
      if ((cells[i] === 1 ? 1 : 0) !== want) { solved = false; break; }
    }
  }

  function updateStatus() {
    let filled = 0;
    let target = 0;
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        if (puzzle.solution[r][c] === 1) target++;
        if (cells[r * puzzle.cols + c] === 1) filled++;
      }
    }
    progressEl.textContent = `${filled}/${target} filled`;
    statusEl.textContent = solved ? "Solved" : "In progress";
    statusEl.dataset.state = solved ? "solved" : "playing";
    modeBtn.textContent = mode === "fill" ? "Mode: Fill" : "Mode: Mark";
    modeBtn.classList.toggle("active", mode === "mark");
  }

  function onWin() {
    const seconds = nowSeconds();
    pause();
    saveBest(seconds);
    winTimeEl.textContent = formatTime(seconds);
    winEl.classList.add("show");
    persist();
  }

  function newGame(difficulty) {
    puzzle = generate(difficulty);
    cells = new Array(puzzle.rows * puzzle.cols).fill(0);
    difficultyEl.value = difficulty;
    solved = false;
    history = [];
    elapsed = 0;
    winEl.classList.remove("show");
    computeMargins();
    layout();
    showBest();
    startTimer();
    persist();
  }

  function undo() {
    if (history.length === 0) return;
    cells = history.pop();
    solved = false;
    render();
    persist();
  }

  function solveAll() {
    if (!confirm("Reveal the full solution?")) return;
    snapshot();
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        cells[r * puzzle.cols + c] = puzzle.solution[r][c] === 1 ? 1 : 0;
      }
    }
    pause();
    checkSolved();
    render();
    persist();
  }

  function bindControls() {
    q("new-game").addEventListener("click", () => newGame(difficultyEl.value));
    difficultyEl.addEventListener("change", () => newGame(difficultyEl.value));
    q("undo").addEventListener("click", undo);
    modeBtn.addEventListener("click", () => { mode = mode === "fill" ? "mark" : "fill"; render(); });
    q("solve").addEventListener("click", solveAll);
    q("win-next").addEventListener("click", () => newGame(difficultyEl.value));

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", () => { drag = null; });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("beforeunload", persist);
  }

  for (const [key, cfg] of Object.entries(DIFFICULTIES)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = `${cfg.label} (${cfg.rows} x ${cfg.cols})`;
    difficultyEl.appendChild(opt);
  }

  bindControls();
  if (!restore()) {
    newGame("easy");
  } else {
    computeMargins();
    layout();
    showBest();
    if (!solved) startTimer();
    else timerEl.textContent = formatTime(elapsed);
  }

  return {
    onShow() {
      layout();
      if (puzzle && !solved && timerStart === null) startTimer();
    },
    onHide() {
      pause();
      persist();
    },
  };
}
