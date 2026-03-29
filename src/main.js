// TRAIL - Main entry point

import { Game, DIR } from './game.js';
import { Renderer } from './renderer.js';
import { loadLevelsBrowser } from './levels.js';

let currentLevelIndex = 0;
let game = null;
let renderer = null;
let LEVELS = [];

const COLOR_HEX = { red: '#e74c3c', blue: '#3498db', green: '#2ecc71', yellow: '#f1c40f' };

export function loadLevel(index) {
  if (index < 0 || index >= LEVELS.length) return;
  currentLevelIndex = index;
  game = new Game(LEVELS[index]);
  render();
  const sel = document.getElementById('levelSelect');
  if (sel) sel.value = index;
}

export function getGame() { return game; }
export function getCurrentLevelIndex() { return currentLevelIndex; }
export function getLevels() { return LEVELS; }

function render() {
  if (!game || !renderer) return;
  renderer.render(game.getState());
  renderSequence();
}

function renderSequence() {
  const el = document.getElementById('sequence');
  if (!el || !game) return;
  const snake = game.getActiveSnake();
  let html = '';
  for (const seg of snake) {
    if (!seg.color) continue;
    const bg = COLOR_HEX[seg.color] || '#888';
    const opacity = seg.isShadow ? '0.35' : '1';
    const border = seg.isPreset ? 'dashed' : 'solid';
    html += `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${bg};opacity:${opacity};border:1.5px ${border} rgba(255,255,255,0.3);margin:0 1px;" title="${seg.color}"></span>`;
  }
  el.innerHTML = html;
}

export function handleKey(e) {
  if (!game) return;
  // Don't capture keys when editor textarea is focused
  if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') return;

  const key = e.key;
  let handled = true;

  if (key === 'n' || key === 'N') {
    if (game.won || e.shiftKey) loadLevel(currentLevelIndex + 1);
    return;
  }
  if (key === 'p' || key === 'P') {
    loadLevel(currentLevelIndex - 1);
    return;
  }

  if (game.phase === 'delegate_select') {
    const idx = parseInt(key) - 1;
    if (idx >= 0) game.selectInstruction(idx);
    render();
    return;
  }

  const dirMap = {
    ArrowUp: DIR.UP, ArrowDown: DIR.DOWN,
    ArrowLeft: DIR.LEFT, ArrowRight: DIR.RIGHT,
    w: DIR.UP, s: DIR.DOWN, a: DIR.LEFT, d: DIR.RIGHT,
    W: DIR.UP, S: DIR.DOWN, A: DIR.LEFT, D: DIR.RIGHT,
  };
  if (dirMap[key]) {
    game.move(dirMap[key]);
    if (game.phase === 'in_portal' && game.portalGame?.won) game._exitPortal();
  }
  else if (key === 'z' || key === 'Z') game.undo();
  else if (key === 'r' || key === 'R') game.restart();
  else if (key === 'Backspace') { game.rewind(); e.preventDefault(); }
  else if (key === 'Tab') { game.switchBranch(); e.preventDefault(); }
  else handled = false;

  if (handled) render();
}

function move(dir) {
  if (!game) return;
  game.move(dir);
  if (game.phase === 'in_portal' && game.portalGame?.won) game._exitPortal();
  render();
}

// Touch swipe support on canvas
function initTouchSwipe(canvas) {
  let startX = 0, startY = 0;
  canvas.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    const minSwipe = 30;
    if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? DIR.RIGHT : DIR.LEFT);
    } else {
      move(dy > 0 ? DIR.DOWN : DIR.UP);
    }
  }, { passive: true });
}

// Init
window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('gameCanvas');
  renderer = new Renderer(canvas);

  // Redraw on resize
  window.addEventListener('resize', () => { if (game) render(); });

  LEVELS = await loadLevelsBrowser();

  const select = document.getElementById('levelSelect');
  LEVELS.forEach((level, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${level.world}. ${level.title}`;
    select.appendChild(opt);
  });
  select.addEventListener('change', (e) => loadLevel(parseInt(e.target.value)));
  window.addEventListener('keydown', handleKey);

  // D-pad buttons
  const btnMap = {
    'btn-up':      () => move(DIR.UP),
    'btn-down':    () => move(DIR.DOWN),
    'btn-left':    () => move(DIR.LEFT),
    'btn-right':   () => move(DIR.RIGHT),
    'btn-undo':    () => { game?.undo(); render(); },
    'btn-restart': () => { game?.restart(); render(); },
    'btn-prev':    () => loadLevel(currentLevelIndex - 1),
    'btn-next':    () => { if (game?.won || true) loadLevel(currentLevelIndex + 1); },
  };
  for (const [id, fn] of Object.entries(btnMap)) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', fn);
      // touchstart for faster response
      el.addEventListener('touchstart', (e) => { e.preventDefault(); fn(); }, { passive: false });
    }
  }

  initTouchSwipe(canvas);
  loadLevel(0);
});
