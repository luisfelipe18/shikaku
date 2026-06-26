import { initShikaku } from "./shikaku.js";
import { initSudoku } from "./sudoku-ui.js";

const TAB_KEY = "puzzles.tab";

const tabs = Array.from(document.querySelectorAll(".tab"));
const views = {
  shikaku: document.getElementById("view-shikaku"),
  sudoku: document.getElementById("view-sudoku"),
};
const factories = {
  shikaku: () => initShikaku(views.shikaku),
  sudoku: () => initSudoku(views.sudoku),
};
const apps = {};
let current = null;

function activate(name) {
  if (!views[name]) name = "shikaku";
  if (current === name) return;

  if (current && apps[current] && apps[current].onHide) apps[current].onHide();

  for (const tab of tabs) {
    const on = tab.dataset.tab === name;
    tab.classList.toggle("active", on);
    tab.setAttribute("aria-selected", String(on));
  }
  for (const [key, view] of Object.entries(views)) {
    view.classList.toggle("active", key === name);
  }

  current = name;
  // Initialize lazily so layout happens while the view is visible.
  if (!apps[name]) apps[name] = factories[name]();
  else if (apps[name].onShow) apps[name].onShow();

  localStorage.setItem(TAB_KEY, name);
}

for (const tab of tabs) {
  tab.addEventListener("click", () => activate(tab.dataset.tab));
}

activate(localStorage.getItem(TAB_KEY) || "shikaku");
