// TRAIL - Main entry point

import { Game, DIR } from './game.js';
import { Renderer } from './renderer.js';
import { loadLevelsBrowser } from './levels.js';

let currentLevelIndex = 0;
let game = null;
let renderer = null;
let LEVELS = [];

const COLOR_HEX = { red: '#e74c3c', blue: '#3498db', green: '#2ecc71', yellow: '#f1c40f' };

function loadLevel(index) {
  if (index < 0 || index >= LEVELS.length) return;
  currentLevelIndex = index;
  game = new Game(LEVELS[index]);
  render();
  document.getElementById('levelSelect').value = index;
}

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

function handleKey(e) {
  if (!game) return;
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

  // Delegate instruction selection
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

// Init
window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('gameCanvas');
  renderer = new Renderer(canvas);

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
  loadLevel(0);
});
