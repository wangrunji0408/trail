// TRAIL - Main Entry Point

import { Game, DIR } from './game.js';
import { Renderer } from './renderer.js';
import { parseLevelText } from './levels.js';
import { ROLE_HEX, ROLES, DIR_MAP } from './constants.js';
import { initEditor } from './editor.js';

let currentLevelIndex = 0;
let game = null;
let renderer = null;
let LEVELS = [];
let LEVEL_FILES_DYNAMIC = [];
let editorApi = null;

function loadLevel(index) {
  if (index < 0 || index >= LEVELS.length) return;
  currentLevelIndex = index;
  game = new Game(LEVELS[index]);
  gameRender();
  document.getElementById('levelSelect').value = index;
  editorApi?.resetLastLevelIndex();
}

function currentLevelFilename() {
  const name = LEVEL_FILES_DYNAMIC[currentLevelIndex];
  if (!name) return null;
  return name.endsWith('.txt') ? name : name + '.txt';
}

function gameRender() {
  if (!renderer) return;
  if (editorApi?.isOpen()) {
    editorApi.renderIfOpen();
  } else if (game) {
    renderer.render(game.getState());
    renderSequence();
  }
}

function renderSequence() {
  const el = document.getElementById('sequence');
  if (!el || !game) return;
  const snake = game.getActiveSnake();
  let html = '';
  let currentRole = null;
  for (const seg of snake) {
    if (!seg.char) continue;
    if (ROLES.has(seg.char)) currentRole = seg.char;
    const bg = currentRole ? ROLE_HEX[currentRole] : '#888';
    html += `<span style="display:inline-block;min-width:14px;height:16px;line-height:16px;text-align:center;font-size:10px;font-weight:bold;border-radius:3px;background:${bg};color:#fff;margin:0 1px;padding:0 2px;" title="${seg.char}">${seg.char}</span>`;
  }
  el.innerHTML = html;
}

function gameMoveDir(dir) {
  if (!game) return;
  game.move(dir);
  if (game.phase === 'in_portal' && game.portalGame?.won) game._exitPortal();
  gameRender();
}

function handleKey(e) {
  if (!game) return;
  if (document.activeElement?.id === 'ep-textarea') return;
  if (editorApi?.isOpen()) return; // editor has its own key handler

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
    if (idx >= 0) { game.selectInstruction(idx); gameRender(); }
    return;
  }

  if (DIR_MAP[key]) gameMoveDir(DIR_MAP[key]);
  else if (key === 'z' || key === 'Z') game.undo();
  else if (key === 'r' || key === 'R') game.restart();
  else if (key === 'Backspace') { game.rewind(); e.preventDefault(); }
  else if (key === 'Tab') { game.switchBranch(); e.preventDefault(); }
  else handled = false;

  if (handled) gameRender();
}

function initTouchSwipe(canvas) {
  let startX = 0, startY = 0;
  canvas.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    // Editor paint mode: tap to paint
    if (editorApi?.isOpen() && editorApi.getSelectedTile()) {
      if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
        const rect = canvas.getBoundingClientRect();
        const cx = (startX - rect.left) / (rect.width / canvas.offsetWidth) - renderer.offsetX;
        const cy = (startY - rect.top) / (rect.height / canvas.offsetHeight) - renderer.offsetY;
        const cell = renderer.cell;
        const gx = Math.floor(cx / cell);
        const gy = Math.floor(cy / cell);
        editorApi.handleTap(gx, gy);
      }
      return;
    }

    // Normal swipe
    const minSwipe = 28;
    if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;
    gameMoveDir(Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? DIR.RIGHT : DIR.LEFT)
      : (dy > 0 ? DIR.DOWN : DIR.UP));
  }, { passive: true });
}

async function loadLevelList() {
  let fileList = null;
  try {
    const r = await fetch('http://localhost:3001/list-levels');
    if (r.ok) {
      const data = await r.json();
      fileList = data.files.map(f => f.replace(/\.txt$/, ''));
    }
  } catch (_) {}
  if (!fileList) {
    fileList = ['1-token', '2-decode', '3-conversation', '4-system', '5-thinking',
                '6-fork', '7-forgetting', '8-portal', '9-subagent'];
  }
  LEVEL_FILES_DYNAMIC = fileList;

  LEVELS = [];
  for (const name of fileList) {
    try {
      const txt = await (await fetch(`levels/${name}.txt`)).text();
      LEVELS.push(parseLevelText(txt));
    } catch (_) {}
  }
}

function rebuildLevelSelect(selectIndex) {
  const select = document.getElementById('levelSelect');
  select.innerHTML = '';
  if (LEVELS.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = '（无法加载关卡，请通过 HTTP 服务器打开）';
    select.appendChild(opt);
  } else {
    LEVELS.forEach((level, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${i + 1}. ${level.title || LEVEL_FILES_DYNAMIC[i] || i}`;
      select.appendChild(opt);
    });
  }
  if (typeof selectIndex === 'number') loadLevel(selectIndex);
}

// === Init ===
window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('gameCanvas');
  renderer = new Renderer(canvas);

  window.addEventListener('resize', () => {
    if (editorApi?.isOpen()) editorApi.renderIfOpen();
    else if (game) gameRender();
  });

  await loadLevelList();

  if (LEVELS.length === 0) {
    const select = document.getElementById('levelSelect');
    const opt = document.createElement('option');
    opt.textContent = '（无法加载关卡，请通过 HTTP 服务器打开）';
    select.appendChild(opt);
  } else {
    rebuildLevelSelect(0);
    document.getElementById('levelSelect').addEventListener('change', e => loadLevel(parseInt(e.target.value)));
  }

  // New level button
  document.getElementById('btnNewLevel').addEventListener('click', async () => {
    const name = prompt('新关卡名称（如 10-myLevel）:');
    if (!name || !name.trim()) return;
    const safeName = name.trim().replace(/[^a-z0-9\u4e00-\u9fff_-]/gi, '-');
    const filename = safeName + '.txt';
    const content = `// world: ${LEVELS.length + 1}\n// title: ${safeName}\n\n^ . . . .\n. . . . .\n. . . . .\n. . . . .\n. . . . E\n`;
    try {
      const res = await fetch('http://localhost:3001/save-level', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content }),
      });
      const data = await res.json();
      if (!data.ok) { alert('创建失败: ' + (data.error || '未知错误')); return; }
      await loadLevelList();
      rebuildLevelSelect(LEVELS.length - 1);
    } catch (e) {
      alert('创建失败 (服务未运行?): ' + e.message);
    }
  });

  window.addEventListener('keydown', handleKey);
  initTouchSwipe(canvas);

  // D-pad
  const dpadActions = {
    'btn-up':      () => gameMoveDir(DIR.UP),
    'btn-down':    () => gameMoveDir(DIR.DOWN),
    'btn-left':    () => gameMoveDir(DIR.LEFT),
    'btn-right':   () => gameMoveDir(DIR.RIGHT),
    'btn-undo':    () => { if (game) { game.undo(); gameRender(); } },
    'btn-restart': () => { if (game) { game.restart(); gameRender(); } },
    'btn-prev':    () => loadLevel(currentLevelIndex - 1),
    'btn-next':    () => loadLevel(currentLevelIndex + 1),
  };
  for (const [id, fn] of Object.entries(dpadActions)) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener('click', fn);
    el.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false });
  }

  // Editor
  editorApi = initEditor({
    getRenderer: () => renderer,
    getGame: () => game,
    setGame: (g) => { game = g; },
    getLevels: () => LEVELS,
    setLevel: (index, def) => { LEVELS[index] = def; },
    getCurrentLevelIndex: () => currentLevelIndex,
    getLevelFilenames: () => LEVEL_FILES_DYNAMIC,
    getCurrentLevelFilename: () => currentLevelFilename(),
    gameRender: () => gameRender(),
    reloadLevels: async (selectIndex) => {
      await loadLevelList();
      rebuildLevelSelect(selectIndex);
    },
  });
});
