import { generatePuzzle, DIFFICULTIES } from "./puzzle.js";
import { Game } from "./game.js";

const STORE_KEY = "shikaku.state.v1";
const BEST_KEY = "shikaku.best.v1";

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const timerEl = document.getElementById("timer");
const bestEl = document.getElementById("best");
const progressEl = document.getElementById("progress");
const difficultyEl = document.getElementById("difficulty");
const winEl = document.getElementById("win");
const winTimeEl = document.getElementById("win-time");

const theme = {
  background: "#0f1320",
  grid: "#2a3147",
  clueText: "#f4f6fb",
  clueBg: "#1b2236",
  open: { fill: "rgba(120,140,180,0.16)", stroke: "#5a6b93" },
  valid: { fill: "rgba(56,196,142,0.18)", stroke: "#38c48e" },
  error: { fill: "rgba(238,108,108,0.18)", stroke: "#ee6c6c" },
  preview: { fill: "rgba(122,162,247,0.20)", stroke: "#7aa2f7" },
};

let game = null;
let cellSize = 48;
let dpr = window.devicePixelRatio || 1;
let drag = null; // { startR, startC, curR, curC }
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
  timerId = setInterval(() => {
    timerEl.textContent = formatTime(nowSeconds());
  }, 500);
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

function loadBest() {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY)) || {};
  } catch {
    return {};
  }
}

function showBest() {
  const best = loadBest();
  const v = best[game.difficulty];
  bestEl.textContent = v ? formatTime(v) : "--:--";
}

function saveBest(seconds) {
  const best = loadBest();
  const key = game.difficulty;
  if (best[key] === undefined || seconds < best[key]) {
    best[key] = seconds;
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  }
  showBest();
}

function persist() {
  if (!game) return;
  const data = {
    difficulty: game.difficulty,
    rows: game.rows,
    cols: game.cols,
    clues: game.clues,
    solution: game.solution,
    rects: game.rects,
    elapsed: timerStart ? nowSeconds() : elapsed,
  };
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

function restore() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!data || !data.clues) return false;
    game = new Game(data);
    game.rects = data.rects || [];
    game._checkSolved();
    elapsed = data.elapsed || 0;
    difficultyEl.value = data.difficulty;
    return true;
  } catch {
    return false;
  }
}

function layout() {
  const wrap = canvas.parentElement;
  const available = wrap.clientWidth;
  const maxCell = 64;
  cellSize = Math.max(20, Math.min(maxCell, Math.floor(available / game.cols)));
  const cssW = cellSize * game.cols;
  const cssH = cellSize * game.rows;
  dpr = window.devicePixelRatio || 1;
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}

function roundRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function render() {
  const W = cellSize * game.cols;
  const H = cellSize * game.rows;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, W, H);

  // Light grid lines.
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  for (let c = 0; c <= game.cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * cellSize + 0.5, 0);
    ctx.lineTo(c * cellSize + 0.5, H);
    ctx.stroke();
  }
  for (let r = 0; r <= game.rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * cellSize + 0.5);
    ctx.lineTo(W, r * cellSize + 0.5);
    ctx.stroke();
  }

  // Player rectangles.
  const pad = 3;
  for (const rect of game.rects) {
    const kind = game.classify(rect);
    const style = theme[kind] || theme.open;
    const x = rect.c * cellSize + pad;
    const y = rect.r * cellSize + pad;
    const w = rect.w * cellSize - pad * 2;
    const h = rect.h * cellSize - pad * 2;
    roundRect(x, y, w, h, 8);
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // Drag preview.
  if (drag) {
    const top = Math.min(drag.startR, drag.curR);
    const left = Math.min(drag.startC, drag.curC);
    const bottom = Math.max(drag.startR, drag.curR);
    const right = Math.max(drag.startC, drag.curC);
    const x = left * cellSize + pad;
    const y = top * cellSize + pad;
    const w = (right - left + 1) * cellSize - pad * 2;
    const h = (bottom - top + 1) * cellSize - pad * 2;
    roundRect(x, y, w, h, 8);
    ctx.fillStyle = theme.preview.fill;
    ctx.fill();
    ctx.strokeStyle = theme.preview.stroke;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Clue numbers.
  const fontSize = Math.max(12, Math.floor(cellSize * 0.42));
  ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const clue of game.clues) {
    const cx = clue.c * cellSize + cellSize / 2;
    const cy = clue.r * cellSize + cellSize / 2;
    const radius = cellSize * 0.34;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = theme.clueBg;
    ctx.fill();
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = theme.clueText;
    ctx.fillText(String(clue.value), cx, cy + 1);
  }
}

function cellFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;
  let c = Math.floor(x / cellSize);
  let r = Math.floor(y / cellSize);
  c = Math.max(0, Math.min(game.cols - 1, c));
  r = Math.max(0, Math.min(game.rows - 1, r));
  return { r, c };
}

function onPointerDown(e) {
  if (game.solved) return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  const { r, c } = cellFromEvent(e);
  drag = { startR: r, startC: c, curR: r, curC: c, moved: false };
  render();
}

function onPointerMove(e) {
  if (!drag) return;
  e.preventDefault();
  const { r, c } = cellFromEvent(e);
  if (r !== drag.curR || c !== drag.curC) drag.moved = true;
  drag.curR = r;
  drag.curC = c;
  render();
}

function onPointerUp(e) {
  if (!drag) return;
  e.preventDefault();
  const { startR, startC, curR, curC, moved } = drag;
  drag = null;

  if (!moved) {
    // A tap on an existing rectangle removes it.
    game.removeRectAt(startR, startC);
  } else {
    game.addRect(startR, startC, curR, curC);
  }
  afterMove();
}

function afterMove() {
  render();
  updateStatus();
  persist();
  if (game.solved) onWin();
}

function updateStatus() {
  const total = game.rows * game.cols;
  const filled = game.filledCells();
  progressEl.textContent = `${filled}/${total} cells | ${game.validCount()}/${game.clues.length} rectangles`;
  if (game.solved) {
    statusEl.textContent = "Solved";
    statusEl.dataset.state = "solved";
  } else {
    statusEl.textContent = "In progress";
    statusEl.dataset.state = "playing";
  }
}

function onWin() {
  stopTimer();
  const seconds = nowSeconds();
  saveBest(seconds);
  winTimeEl.textContent = formatTime(seconds);
  winEl.classList.add("show");
  persist();
}

function newGame(difficulty, keepTime = false) {
  const puzzle = generatePuzzle(difficulty);
  game = new Game(puzzle);
  difficultyEl.value = difficulty;
  if (!keepTime) elapsed = 0;
  winEl.classList.remove("show");
  layout();
  updateStatus();
  showBest();
  startTimer();
  persist();
}

function resumeGame() {
  layout();
  updateStatus();
  showBest();
  if (game.solved) {
    stopTimer();
    timerEl.textContent = formatTime(elapsed);
  } else {
    startTimer();
  }
}

function bindControls() {
  document.getElementById("new-game").addEventListener("click", () => {
    newGame(difficultyEl.value);
  });
  difficultyEl.addEventListener("change", () => {
    newGame(difficultyEl.value);
  });
  document.getElementById("undo").addEventListener("click", () => {
    if (game.undo()) afterMove();
  });
  document.getElementById("clear").addEventListener("click", () => {
    game.clear();
    afterMove();
  });
  document.getElementById("solve").addEventListener("click", () => {
    if (!confirm("Reveal the full solution?")) return;
    game.revealSolution();
    stopTimer();
    render();
    updateStatus();
    persist();
  });
  document.getElementById("win-next").addEventListener("click", () => {
    newGame(difficultyEl.value);
  });

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", () => { drag = null; render(); });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  window.addEventListener("resize", () => layout());
  window.addEventListener("beforeunload", persist);
}

function populateDifficulties() {
  for (const [key, cfg] of Object.entries(DIFFICULTIES)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = `${cfg.label} (${cfg.rows} x ${cfg.cols})`;
    difficultyEl.appendChild(opt);
  }
}

function init() {
  populateDifficulties();
  bindControls();
  if (restore()) {
    resumeGame();
  } else {
    newGame("easy");
  }
}

init();
