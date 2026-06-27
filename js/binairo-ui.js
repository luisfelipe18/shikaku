import { generate, DIFFICULTIES } from "./binairo.js";

const STORE_KEY = "binairo.state.v1";
const BEST_KEY = "binairo.best.v1";

export function initBinairo(root) {
  const q = (name) => root.querySelector(`[data-el="${name}"]`);
  const boardEl = q("board");
  const statusEl = q("status");
  const timerEl = q("timer");
  const bestEl = q("best");
  const progressEl = q("progress");
  const difficultyEl = q("difficulty");
  const winEl = q("win");
  const winTimeEl = q("win-time");

  let state = null; // { size, values, givens, solution, difficulty }
  let solved = false;
  let history = [];
  let timerStart = null;
  let timerId = null;
  let elapsed = 0;
  const cellEls = [];

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
    const v = loadBest()[state.difficulty];
    bestEl.textContent = v ? formatTime(v) : "--:--";
  }
  function saveBest(seconds) {
    const best = loadBest();
    const key = state.difficulty;
    if (best[key] === undefined || seconds < best[key]) {
      best[key] = seconds;
      localStorage.setItem(BEST_KEY, JSON.stringify(best));
    }
    showBest();
  }

  function persist() {
    if (!state) return;
    localStorage.setItem(STORE_KEY, JSON.stringify({
      size: state.size,
      values: state.values,
      givens: state.givens,
      solution: state.solution,
      difficulty: state.difficulty,
      elapsed: timerStart ? nowSeconds() : elapsed,
    }));
  }

  function restore() {
    try {
      const data = JSON.parse(localStorage.getItem(STORE_KEY));
      if (!data || !data.values) return false;
      state = data;
      elapsed = data.elapsed || 0;
      difficultyEl.value = data.difficulty;
      checkSolved();
      return true;
    } catch {
      return false;
    }
  }

  function buildBoard() {
    const N = state.size;
    boardEl.innerHTML = "";
    boardEl.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
    boardEl.style.gridTemplateRows = `repeat(${N}, 1fr)`;
    cellEls.length = 0;
    for (let i = 0; i < N * N; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "bn-cell";
      cell.addEventListener("click", () => cycle(i));
      boardEl.appendChild(cell);
      cellEls.push(cell);
    }
  }

  function snapshot() {
    history.push(state.values.slice());
    if (history.length > 300) history.shift();
  }

  function cycle(i) {
    if (solved || state.givens[i]) return;
    snapshot();
    const cur = state.values[i];
    state.values[i] = cur === -1 ? 0 : cur === 0 ? 1 : -1;
    afterMove();
  }

  function conflicts() {
    const N = state.size;
    const v = state.values;
    const at = (r, c) => v[r * N + c];
    const bad = new Set();
    const half = N / 2;

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cur = at(r, c);
        if (cur === -1) continue;
        if (c >= 2 && at(r, c - 1) === cur && at(r, c - 2) === cur) {
          bad.add(r * N + c); bad.add(r * N + c - 1); bad.add(r * N + c - 2);
        }
        if (r >= 2 && at(r - 1, c) === cur && at(r - 2, c) === cur) {
          bad.add(r * N + c); bad.add((r - 1) * N + c); bad.add((r - 2) * N + c);
        }
      }
    }

    for (let r = 0; r < N; r++) {
      let z = 0, o = 0;
      for (let c = 0; c < N; c++) { if (at(r, c) === 0) z++; else if (at(r, c) === 1) o++; }
      if (z > half || o > half) for (let c = 0; c < N; c++) if (at(r, c) !== -1) bad.add(r * N + c);
    }
    for (let c = 0; c < N; c++) {
      let z = 0, o = 0;
      for (let r = 0; r < N; r++) { if (at(r, c) === 0) z++; else if (at(r, c) === 1) o++; }
      if (z > half || o > half) for (let r = 0; r < N; r++) if (at(r, c) !== -1) bad.add(r * N + c);
    }
    return bad;
  }

  function checkSolved() {
    solved = state.values.every((x, i) => x === state.solution[i]);
  }

  function afterMove() {
    checkSolved();
    render();
    persist();
    if (solved) onWin();
  }

  function render() {
    const bad = conflicts();
    let filled = 0;
    for (let i = 0; i < cellEls.length; i++) {
      const cell = cellEls[i];
      const v = state.values[i];
      if (v !== -1) filled++;
      cell.textContent = v === -1 ? "" : String(v);
      cell.classList.toggle("v0", v === 0);
      cell.classList.toggle("v1", v === 1);
      cell.classList.toggle("given", state.givens[i]);
      cell.classList.toggle("conflict", bad.has(i));
    }
    progressEl.textContent = `${filled}/${cellEls.length} filled`;
    statusEl.textContent = solved ? "Solved" : "In progress";
    statusEl.dataset.state = solved ? "solved" : "playing";
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
    const puzzle = generate(difficulty);
    state = {
      size: puzzle.size,
      values: puzzle.values.slice(),
      givens: puzzle.givens.slice(),
      solution: puzzle.solution.slice(),
      difficulty,
    };
    difficultyEl.value = difficulty;
    solved = false;
    history = [];
    elapsed = 0;
    winEl.classList.remove("show");
    buildBoard();
    render();
    showBest();
    startTimer();
    persist();
  }

  function undo() {
    if (history.length === 0) return;
    state.values = history.pop();
    solved = false;
    render();
    persist();
  }

  function giveHint() {
    if (solved) return;
    const empties = [];
    for (let i = 0; i < state.values.length; i++) {
      if (state.values[i] !== state.solution[i]) empties.push(i);
    }
    if (empties.length === 0) return;
    snapshot();
    const idx = empties[Math.floor(Math.random() * empties.length)];
    state.values[idx] = state.solution[idx];
    afterMove();
  }

  function solveAll() {
    if (!confirm("Reveal the full solution?")) return;
    snapshot();
    state.values = state.solution.slice();
    pause();
    checkSolved();
    render();
    persist();
  }

  function bindControls() {
    q("new-game").addEventListener("click", () => newGame(difficultyEl.value));
    difficultyEl.addEventListener("change", () => newGame(difficultyEl.value));
    q("undo").addEventListener("click", undo);
    q("hint").addEventListener("click", giveHint);
    q("solve").addEventListener("click", solveAll);
    q("win-next").addEventListener("click", () => newGame(difficultyEl.value));
    window.addEventListener("beforeunload", persist);
  }

  for (const [key, cfg] of Object.entries(DIFFICULTIES)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = `${cfg.label} (${cfg.size} x ${cfg.size})`;
    difficultyEl.appendChild(opt);
  }

  bindControls();
  if (!restore()) {
    newGame("easy");
  } else {
    buildBoard();
    render();
    showBest();
    if (!solved) startTimer();
    else timerEl.textContent = formatTime(elapsed);
  }

  return {
    onShow() {
      if (state && !solved && timerStart === null) startTimer();
    },
    onHide() {
      pause();
      persist();
    },
  };
}
