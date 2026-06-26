import { generate, DIFFICULTIES } from "./sudoku.js";

const STORE_KEY = "sudoku.state.v1";
const BEST_KEY = "sudoku.best.v1";
const SIZE = 9;
const CELLS = 81;

function peersOf(idx) {
  const r = Math.floor(idx / SIZE);
  const c = idx % SIZE;
  const set = new Set();
  for (let k = 0; k < SIZE; k++) {
    set.add(r * SIZE + k);
    set.add(k * SIZE + c);
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) set.add((br + dr) * SIZE + (bc + dc));
  }
  set.delete(idx);
  return [...set];
}

const PEERS = Array.from({ length: CELLS }, (_, i) => peersOf(i));

export function initSudoku(root) {
  const q = (name) => root.querySelector(`[data-el="${name}"]`);
  const boardEl = q("board");
  const padEl = q("pad");
  const statusEl = q("status");
  const timerEl = q("timer");
  const bestEl = q("best");
  const progressEl = q("progress");
  const difficultyEl = q("difficulty");
  const notesBtn = q("notes");
  const winEl = q("win");
  const winTimeEl = q("win-time");

  let state = null; // { values, givens, solution, notes, difficulty }
  let selected = -1;
  let notesMode = false;
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
      values: state.values,
      givens: state.givens,
      solution: state.solution,
      notes: state.notes.map((s) => [...s]),
      difficulty: state.difficulty,
      elapsed: timerStart ? nowSeconds() : elapsed,
    }));
  }

  function restore() {
    try {
      const data = JSON.parse(localStorage.getItem(STORE_KEY));
      if (!data || !data.values) return false;
      state = {
        values: data.values,
        givens: data.givens,
        solution: data.solution,
        notes: (data.notes || []).map((a) => new Set(a)),
        difficulty: data.difficulty,
      };
      while (state.notes.length < CELLS) state.notes.push(new Set());
      elapsed = data.elapsed || 0;
      difficultyEl.value = data.difficulty;
      checkSolved();
      return true;
    } catch {
      return false;
    }
  }

  function buildBoard() {
    boardEl.innerHTML = "";
    cellEls.length = 0;
    for (let i = 0; i < CELLS; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "sk-cell";
      const r = Math.floor(i / SIZE);
      const c = i % SIZE;
      if (c % 3 === 0) cell.classList.add("box-left");
      if (r % 3 === 0) cell.classList.add("box-top");
      if (c === SIZE - 1) cell.classList.add("box-right");
      if (r === SIZE - 1) cell.classList.add("box-bottom");
      const value = document.createElement("span");
      value.className = "sk-value";
      const notes = document.createElement("span");
      notes.className = "sk-notes";
      for (let n = 1; n <= SIZE; n++) {
        const mark = document.createElement("span");
        mark.dataset.n = String(n);
        notes.appendChild(mark);
      }
      cell.append(value, notes);
      cell.addEventListener("click", () => selectCell(i));
      boardEl.appendChild(cell);
      cellEls.push(cell);
    }
  }

  function buildPad() {
    padEl.innerHTML = "";
    for (let n = 1; n <= SIZE; n++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sk-key";
      btn.textContent = String(n);
      btn.addEventListener("click", () => inputNumber(n));
      padEl.appendChild(btn);
    }
    const erase = document.createElement("button");
    erase.type = "button";
    erase.className = "sk-key sk-key-erase";
    erase.textContent = "Erase";
    erase.addEventListener("click", () => inputNumber(0));
    padEl.appendChild(erase);
  }

  function selectCell(i) {
    selected = i;
    render();
  }

  function snapshot() {
    history.push({
      values: state.values.slice(),
      notes: state.notes.map((s) => new Set(s)),
    });
    if (history.length > 300) history.shift();
  }

  function inputNumber(n) {
    if (solved || selected < 0) return;
    if (state.givens[selected]) return;
    snapshot();
    if (n === 0) {
      state.values[selected] = 0;
      state.notes[selected].clear();
    } else if (notesMode) {
      if (state.values[selected] !== 0) state.values[selected] = 0;
      const notes = state.notes[selected];
      if (notes.has(n)) notes.delete(n);
      else notes.add(n);
    } else {
      state.values[selected] = state.values[selected] === n ? 0 : n;
      state.notes[selected].clear();
      if (state.values[selected] !== 0) clearPeerNotes(selected, n);
    }
    afterMove();
  }

  function clearPeerNotes(idx, n) {
    for (const p of PEERS[idx]) state.notes[p].delete(n);
  }

  function conflicts() {
    const bad = new Set();
    for (let i = 0; i < CELLS; i++) {
      const v = state.values[i];
      if (v === 0) continue;
      for (const p of PEERS[i]) {
        if (state.values[p] === v) { bad.add(i); bad.add(p); }
      }
    }
    return bad;
  }

  function checkSolved() {
    const full = state.values.every((v) => v !== 0);
    solved = full && conflicts().size === 0;
  }

  function afterMove() {
    checkSolved();
    render();
    persist();
    if (solved) onWin();
  }

  function render() {
    const bad = conflicts();
    const selVal = selected >= 0 ? state.values[selected] : 0;
    const selPeers = selected >= 0 ? new Set(PEERS[selected]) : new Set();
    let filled = 0;

    for (let i = 0; i < CELLS; i++) {
      const cell = cellEls[i];
      const v = state.values[i];
      if (v !== 0) filled++;
      const valueEl = cell.firstChild;
      const notesEl = cell.lastChild;
      valueEl.textContent = v === 0 ? "" : String(v);

      cell.classList.toggle("given", state.givens[i]);
      cell.classList.toggle("filled", !state.givens[i] && v !== 0);
      cell.classList.toggle("conflict", bad.has(i));
      cell.classList.toggle("selected", i === selected);
      cell.classList.toggle("peer", selPeers.has(i));
      cell.classList.toggle("same", v !== 0 && v === selVal);

      const showNotes = v === 0 && state.notes[i].size > 0;
      cell.classList.toggle("has-notes", showNotes);
      if (showNotes) {
        for (const mark of notesEl.children) {
          mark.textContent = state.notes[i].has(Number(mark.dataset.n)) ? mark.dataset.n : "";
        }
      }
    }

    progressEl.textContent = `${filled}/81 filled`;
    statusEl.textContent = solved ? "Solved" : "In progress";
    statusEl.dataset.state = solved ? "solved" : "playing";
    notesBtn.classList.toggle("active", notesMode);
    notesBtn.setAttribute("aria-pressed", String(notesMode));
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
      values: puzzle.puzzle.slice(),
      givens: puzzle.givens.slice(),
      solution: puzzle.solution.slice(),
      notes: Array.from({ length: CELLS }, () => new Set()),
      difficulty,
    };
    difficultyEl.value = difficulty;
    selected = -1;
    solved = false;
    history = [];
    elapsed = 0;
    winEl.classList.remove("show");
    render();
    showBest();
    startTimer();
    persist();
  }

  function undo() {
    if (history.length === 0) return;
    const prev = history.pop();
    state.values = prev.values;
    state.notes = prev.notes;
    solved = false;
    render();
    persist();
  }

  function giveHint() {
    if (solved) return;
    let target = selected;
    if (target < 0 || state.values[target] === state.solution[target]) {
      const empties = [];
      for (let i = 0; i < CELLS; i++) {
        if (state.values[i] !== state.solution[i]) empties.push(i);
      }
      if (empties.length === 0) return;
      target = empties[Math.floor(Math.random() * empties.length)];
    }
    snapshot();
    state.values[target] = state.solution[target];
    state.notes[target].clear();
    clearPeerNotes(target, state.solution[target]);
    selected = target;
    afterMove();
  }

  function solveAll() {
    if (!confirm("Reveal the full solution?")) return;
    snapshot();
    state.values = state.solution.slice();
    state.notes = state.notes.map(() => new Set());
    pause();
    checkSolved();
    render();
    persist();
  }

  function onKey(e) {
    if (!root.classList.contains("active")) return;
    if (e.key >= "1" && e.key <= "9") { inputNumber(Number(e.key)); }
    else if (e.key === "0" || e.key === "Backspace" || e.key === "Delete") { inputNumber(0); }
    else if (e.key === "n" || e.key === "N") { notesMode = !notesMode; render(); }
    else if (selected >= 0 && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      const r = Math.floor(selected / SIZE);
      const c = selected % SIZE;
      let nr = r, nc = c;
      if (e.key === "ArrowUp") nr = Math.max(0, r - 1);
      if (e.key === "ArrowDown") nr = Math.min(SIZE - 1, r + 1);
      if (e.key === "ArrowLeft") nc = Math.max(0, c - 1);
      if (e.key === "ArrowRight") nc = Math.min(SIZE - 1, c + 1);
      selectCell(nr * SIZE + nc);
      e.preventDefault();
    }
  }

  function bindControls() {
    q("new-game").addEventListener("click", () => newGame(difficultyEl.value));
    difficultyEl.addEventListener("change", () => newGame(difficultyEl.value));
    q("undo").addEventListener("click", undo);
    notesBtn.addEventListener("click", () => { notesMode = !notesMode; render(); });
    q("hint").addEventListener("click", giveHint);
    q("solve").addEventListener("click", solveAll);
    q("win-next").addEventListener("click", () => newGame(difficultyEl.value));
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", persist);
  }

  for (const [key, cfg] of Object.entries(DIFFICULTIES)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = cfg.label;
    difficultyEl.appendChild(opt);
  }

  buildBoard();
  buildPad();
  bindControls();

  if (!restore()) {
    newGame("easy");
  } else {
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
