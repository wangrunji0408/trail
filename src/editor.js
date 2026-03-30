// TRAIL - Editor Module

import { Game, DIR } from './game.js';
import { parseLevelText } from './levels.js';
import { TILES, DIR_MAP } from './constants.js';

let editorGame = null;
let editorLevelDef = null;
let selectedTile = null;
let editorOpen = false;
let editorLastLevelIndex = -1;

let ctrl = null; // controller from main.js
let editorEl, errorEl, modeEl;
let _editorClickHandler = null;
let _editorMoveHandler = null;
let _editorDrawing = false;

function isMetaLine(line) {
  const t = line.trim();
  return !t || t.startsWith('//');
}

function getCellToken(gx, gy) {
  const lines = editorEl.value.split('\n');
  const mapStart = lines.findIndex(l => !isMetaLine(l));
  if (mapStart < 0) return '.';
  let mapRow = 0;
  for (let i = mapStart; i < lines.length; i++) {
    if (isMetaLine(lines[i])) continue;
    if (mapRow === gy) {
      const tokens = lines[i].split(/\s+/).filter(t => t.length > 0);
      return tokens[gx] || '.';
    }
    mapRow++;
  }
  return '.';
}

function updateCellInText(gx, gy, token) {
  const lines = editorEl.value.split('\n');
  const mapStart = lines.findIndex(l => !isMetaLine(l));
  if (mapStart < 0) return;
  let mapRow = 0, lineIdx = -1;
  for (let i = mapStart; i < lines.length; i++) {
    if (isMetaLine(lines[i])) continue;
    if (mapRow === gy) { lineIdx = i; break; }
    mapRow++;
  }
  if (lineIdx < 0) return;
  const tokens = lines[lineIdx].split(/\s+/).filter(t => t.length > 0);
  while (tokens.length <= gx) tokens.push('.');
  tokens[gx] = token;
  lines[lineIdx] = tokens.join(' ');
  editorEl.value = lines.join('\n');
  editorParseAndRender();
}

function editorParseAndRender() {
  try {
    editorLevelDef = parseLevelText(editorEl.value);
    errorEl.textContent = '';
    editorGame = new Game(editorLevelDef);
    editorRenderFull();
    updateSizeDisplay();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

function editorRenderFull() {
  const renderer = ctrl.getRenderer();
  if (!renderer || !editorGame) return;
  renderer.render(editorGame.getState());
}

function updateSizeDisplay() {
  if (!editorLevelDef) return;
  document.getElementById('ep-w-val').textContent = editorLevelDef.width;
  document.getElementById('ep-h-val').textContent = editorLevelDef.height;
}

function resizeLevel(dw, dh) {
  const lines = editorEl.value.split('\n');
  const mapLineIndices = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isMetaLine(lines[i])) mapLineIndices.push(i);
  }
  if (mapLineIndices.length === 0) return;

  let rows = mapLineIndices.map(idx =>
    lines[idx].split(/\s+/).filter(t => t.length > 0)
  );
  const currentH = rows.length;
  const currentW = rows[0]?.length || 0;
  const newW = Math.max(1, currentW + dw);
  const newH = Math.max(1, currentH + dh);

  rows = rows.map(row => {
    if (row.length < newW) {
      while (row.length < newW) row.push('.');
    } else if (row.length > newW) {
      row = row.slice(0, newW);
    }
    return row;
  });

  if (newH > currentH) {
    for (let i = currentH; i < newH; i++) rows.push(Array(newW).fill('.'));
  } else if (newH < currentH) {
    rows = rows.slice(0, newH);
  }

  let rowIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!isMetaLine(lines[i])) {
      if (rowIdx < rows.length) lines[i] = rows[rowIdx++].join(' ');
      else lines[i] = null;
    }
  }
  let newLines = lines.filter(l => l !== null);
  while (rowIdx < rows.length) newLines.push(rows[rowIdx++].join(' '));

  editorEl.value = newLines.join('\n');
  editorParseAndRender();
}

function buildPalette() {
  const paletteEl = document.getElementById('ep-palette');
  for (const tile of TILES) {
    const btn = document.createElement('button');
    btn.className = 'tile-btn';
    btn.dataset.token = tile.token;
    let inner = '';
    if (tile.color) inner += `<span class="swatch" style="background:${tile.color}"></span>`;
    inner += tile.label;
    btn.innerHTML = inner;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tile-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTile = tile.token;
      modeEl.textContent = `画笔: ${tile.label} (${tile.token})`;
    });
    paletteEl.appendChild(btn);
  }
}

async function openEditor() {
  editorOpen = true;
  document.getElementById('editor-panel').classList.add('open');
  document.getElementById('btnEditor').classList.add('active');
  if (editorLastLevelIndex !== ctrl.getCurrentLevelIndex()) {
    const filename = ctrl.getCurrentLevelFilename();
    if (filename) {
      try {
        const txt = await (await fetch(`levels/${filename}`)).text();
        editorEl.value = txt;
        editorLastLevelIndex = ctrl.getCurrentLevelIndex();
      } catch (_) {}
    } else {
      editorLastLevelIndex = ctrl.getCurrentLevelIndex();
    }
  }
  editorParseAndRender();
  updateSizeDisplay();
  setupEditorCanvasEvents();
}

function closeEditor() {
  editorOpen = false;
  document.getElementById('editor-panel').classList.remove('open');
  document.getElementById('btnEditor').classList.remove('active');
  if (editorLevelDef) {
    ctrl.setLevel(ctrl.getCurrentLevelIndex(), editorLevelDef);
    ctrl.setGame(new Game(editorLevelDef));
  }
  editorLevelDef = null;
  editorGame = null;
  removeEditorCanvasEvents();
  ctrl.gameRender();
}

function paintAt(e) {
  if (!selectedTile || !editorLevelDef) return;
  const renderer = ctrl.getRenderer();
  if (!renderer) return;
  const canvas = renderer.canvas;
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) / (rect.width / canvas.offsetWidth) - renderer.offsetX;
  const cy = (e.clientY - rect.top) / (rect.height / canvas.offsetHeight) - renderer.offsetY;
  const cell = renderer.cell;
  const gx = Math.floor(cx / cell);
  const gy = Math.floor(cy / cell);
  if (gx < 0 || gx >= editorLevelDef.width || gy < 0 || gy >= editorLevelDef.height) return;
  const currentToken = getCellToken(gx, gy);
  const newToken = (currentToken === selectedTile) ? '.' : selectedTile;
  updateCellInText(gx, gy, newToken);
}

function setupEditorCanvasEvents() {
  const canvas = ctrl.getRenderer().canvas;
  removeEditorCanvasEvents();

  _editorClickHandler = (e) => paintAt(e);
  canvas.addEventListener('click', _editorClickHandler);

  canvas.addEventListener('mousedown', () => { _editorDrawing = true; });
  canvas.addEventListener('mouseup', () => { _editorDrawing = false; });
  canvas.addEventListener('mouseleave', () => { _editorDrawing = false; });
  _editorMoveHandler = (e) => { if (_editorDrawing) paintAt(e); };
  canvas.addEventListener('mousemove', _editorMoveHandler);
}

function removeEditorCanvasEvents() {
  const renderer = ctrl.getRenderer();
  if (!renderer) return;
  const canvas = renderer.canvas;
  if (_editorClickHandler) canvas.removeEventListener('click', _editorClickHandler);
  if (_editorMoveHandler) canvas.removeEventListener('mousemove', _editorMoveHandler);
  _editorClickHandler = null;
  _editorMoveHandler = null;
}

function playSolution() {
  editorParseAndRender();
  if (!editorLevelDef?.solution || !editorGame) {
    errorEl.textContent = '没有解法（在 // solution: 中定义）';
    return;
  }
  errorEl.textContent = '';
  const DM = { w: DIR.UP, a: DIR.LEFT, s: DIR.DOWN, d: DIR.RIGHT };
  let i = 0;
  const sol = editorLevelDef.solution;
  function step() {
    if (i >= sol.length || editorGame.won) { editorRenderFull(); return; }
    const ch = sol[i++];
    if (DM[ch]) {
      const r = editorGame.move(DM[ch]);
      if (!r.success && editorGame.phase !== 'won') {
        errorEl.textContent = `解法失败: 步骤 ${i} '${ch}': ${r.reason}`;
        editorRenderFull(); return;
      }
    } else if (ch === '<') editorGame.rewind();
    else if (ch === 't') editorGame.switchBranch();
    else if ('123'.includes(ch)) {
      const idx = parseInt(ch) - 1;
      if (editorGame.phase === 'merge_select') editorGame.selectBranch(idx);
      else if (editorGame.phase === 'delegate_select') editorGame.selectInstruction(idx);
    }
    editorRenderFull();
    setTimeout(step, 150);
  }
  step();
}

function wireEditorButtons() {
  // Test (play mode)
  document.getElementById('ep-test').addEventListener('click', () => {
    selectedTile = null;
    document.querySelectorAll('.tile-btn').forEach(b => b.classList.remove('active'));
    modeEl.textContent = '试玩模式';
    editorParseAndRender();
  });

  // Reset
  document.getElementById('ep-reset').addEventListener('click', () => {
    if (editorGame) { editorGame.restart(); editorRenderFull(); }
  });

  // Solution playback
  document.getElementById('ep-solution').addEventListener('click', playSolution);

  // Load current level
  document.getElementById('ep-load-level').addEventListener('click', async () => {
    const filename = ctrl.getCurrentLevelFilename();
    if (!filename) return;
    try {
      const txt = await (await fetch(`levels/${filename}`)).text();
      editorEl.value = txt;
      editorParseAndRender();
      updateSizeDisplay();
    } catch (e) {
      errorEl.textContent = '加载失败: ' + e.message;
    }
  });

  // Save
  document.getElementById('ep-save').addEventListener('click', async () => {
    const txt = editorEl.value;
    const filename = ctrl.getCurrentLevelFilename();
    if (!filename) {
      errorEl.textContent = '无法确定文件名，请先选择关卡';
      return;
    }
    try {
      const res = await fetch('http://localhost:3001/save-level', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content: txt }),
      });
      const data = await res.json();
      if (data.ok) {
        errorEl.textContent = '';
        modeEl.textContent = `✅ 已保存: ${data.saved}`;
        try { ctrl.setLevel(ctrl.getCurrentLevelIndex(), parseLevelText(txt)); } catch (_) {}
      } else {
        errorEl.textContent = '保存失败: ' + (data.error || '未知错误');
      }
    } catch (e) {
      errorEl.textContent = '保存失败 (服务未运行?): ' + e.message;
    }
  });

  // Source toggle (mobile)
  const sourceToggleBtn = document.getElementById('ep-source-toggle');
  const textareaSection = document.getElementById('ep-textarea-section');
  sourceToggleBtn.addEventListener('click', () => {
    const expanded = textareaSection.classList.toggle('expanded');
    sourceToggleBtn.textContent = expanded ? '📄 隐藏源码' : '📄 查看源码';
  });

  // Size controls
  document.getElementById('ep-w-dec').addEventListener('click', () => resizeLevel(-1, 0));
  document.getElementById('ep-w-inc').addEventListener('click', () => resizeLevel(+1, 0));
  document.getElementById('ep-h-dec').addEventListener('click', () => resizeLevel(0, -1));
  document.getElementById('ep-h-inc').addEventListener('click', () => resizeLevel(0, +1));

  // Live parse on textarea input
  let debounce = null;
  editorEl.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(editorParseAndRender, 300);
  });
}

function wireEditorKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (!editorOpen || !editorGame) return;
    if (document.activeElement === editorEl) return;

    if (DIR_MAP[e.key]) {
      editorGame.move(DIR_MAP[e.key]);
      if (editorGame.phase === 'in_portal' && editorGame.portalGame?.won) editorGame._exitPortal();
      editorRenderFull(); e.preventDefault();
    } else if (e.key === 'z' || e.key === 'Z') { editorGame.undo(); editorRenderFull(); }
    else if (e.key === 'r' || e.key === 'R') { editorGame.restart(); editorRenderFull(); }
    else if (e.key === 'Backspace') { editorGame.rewind(); editorRenderFull(); e.preventDefault(); }
    else if (e.key === 'Escape') {
      selectedTile = null;
      document.querySelectorAll('.tile-btn').forEach(b => b.classList.remove('active'));
      modeEl.textContent = '';
    }
  });
}

export function initEditor(controller) {
  ctrl = controller;
  editorEl = document.getElementById('ep-textarea');
  errorEl = document.getElementById('ep-error');
  modeEl = document.getElementById('ep-mode');

  buildPalette();
  wireEditorButtons();
  wireEditorKeyboard();

  // Toggle button
  document.getElementById('btnEditor').addEventListener('click', () => {
    editorOpen ? closeEditor() : openEditor();
  });
  document.getElementById('ep-close-btn').addEventListener('click', closeEditor);

  return {
    isOpen: () => editorOpen,
    open: openEditor,
    close: closeEditor,
    renderIfOpen: () => { if (editorOpen && editorGame) editorRenderFull(); },
    getSelectedTile: () => selectedTile,
    getEditorLevelDef: () => editorLevelDef,
    handleTap: (gx, gy) => {
      if (!selectedTile || !editorLevelDef) return;
      if (gx < 0 || gx >= editorLevelDef.width || gy < 0 || gy >= editorLevelDef.height) return;
      const currentToken = getCellToken(gx, gy);
      const newToken = (currentToken === selectedTile) ? '.' : selectedTile;
      updateCellInText(gx, gy, newToken);
    },
    resetLastLevelIndex: () => { editorLastLevelIndex = -1; },
  };
}
