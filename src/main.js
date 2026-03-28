// TRAIL - Main entry point

import { Game, DIR } from './game.js';
import { Renderer } from './renderer.js';
import { LEVELS } from './levels.js';

let currentLevelIndex = 0;
let game = null;
let renderer = null;

function loadLevel(index) {
  if (index < 0 || index >= LEVELS.length) return;
  currentLevelIndex = index;
  game = new Game(LEVELS[index]);
  render();
  // Update level selector
  document.getElementById('levelSelect').value = index;
}

function render() {
  if (!game || !renderer) return;
  renderer.render(game.getState());
}

function handleKey(e) {
  if (!game) return;
  const key = e.key;
  let handled = true;

  // Level navigation
  if (key === 'n' || key === 'N') {
    if (game.won || e.shiftKey) {
      loadLevel(currentLevelIndex + 1);
    }
    return;
  }
  if (key === 'p' || key === 'P') {
    loadLevel(currentLevelIndex - 1);
    return;
  }

  // Prism selection
  if (game.phase === 'prism_select') {
    const idx = parseInt(key) - 1;
    if (idx >= 0 && idx < game.prismOptions.length) {
      game.setPrism(game.prismOptions[idx]);
    }
    render();
    return;
  }

  // Delegate instruction selection
  if (game.phase === 'delegate_select') {
    const idx = parseInt(key) - 1;
    if (idx >= 0) {
      game.selectInstruction(idx);
    }
    render();
    return;
  }

  // Merge branch selection
  if (game.phase === 'merge_select') {
    const idx = parseInt(key) - 1;
    if (idx >= 0 && idx < 2) {
      game.selectBranch(idx);
    }
    render();
    return;
  }

  // Movement
  const dirMap = {
    ArrowUp: DIR.UP, ArrowDown: DIR.DOWN,
    ArrowLeft: DIR.LEFT, ArrowRight: DIR.RIGHT,
  };
  if (dirMap[key]) {
    game.move(dirMap[key]);
    // Check portal completion
    if (game.phase === 'in_portal' && game.portalGame?.won) {
      game._exitPortal();
    }
  }
  // Undo
  else if (key === 'z' || key === 'Z') {
    game.undo();
  }
  // Restart
  else if (key === 'r' || key === 'R') {
    game.restart();
  }
  // Rewind (World 6+)
  else if (key === 'Backspace') {
    game.rewind();
    e.preventDefault();
  }
  // Switch branch (World 5)
  else if (key === 'Tab') {
    game.switchBranch();
    e.preventDefault();
  }
  else {
    handled = false;
  }

  if (handled) render();
}

// Init
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  renderer = new Renderer(canvas);

  // Level selector
  const select = document.getElementById('levelSelect');
  LEVELS.forEach((level, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${level.world}. ${level.title}`;
    select.appendChild(opt);
  });
  select.addEventListener('change', (e) => {
    loadLevel(parseInt(e.target.value));
  });

  // Keyboard
  window.addEventListener('keydown', handleKey);

  // Start
  loadLevel(0);
});
