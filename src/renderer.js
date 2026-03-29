// TRAIL - Canvas Renderer

const CELL_DEFAULT = 56;
const PAD = 1;
const RADIUS = 6;

// Compute cell size so the grid fits within the available area.
function computeCell(gridW, gridH, availW, availH) {
  const headerH = 44;
  const footerH = 80;
  const maxCellW = Math.floor((availW - 16) / gridW);
  const maxCellH = Math.floor((availH - headerH - footerH) / gridH);
  return Math.max(24, Math.min(CELL_DEFAULT, maxCellW, maxCellH));
}

const PALETTE = {
  bg: '#0f0e17',
  wall: '#0a0a15',
  empty: '#16213e',
  exit: '#ffd700',
  exitGlow: 'rgba(255,215,0,0.25)',
  snakeDefault: '#e0e0e0',
  snakeHead: '#ffffff',
  shadowOverlay: 'rgba(128,0,255,0.15)',
  shadowSeg: 0.35,
  red: '#e74c3c',
  blue: '#3498db',
  green: '#2ecc71',
  yellow: '#f1c40f',
  gate: '#4a4a5a',
  switchOn: '#2ecc71',
  switchOff: '#7f8c8d',
  switchWallClosed: '#8b4513',
  switchWallOpen: 'rgba(139,69,19,0.2)',
  checkpoint: '#00bcd4',
  fork: '#ff9800',
  portal: '#9b59b6',
  delegate: '#e91e63',
  memoryStoneActive: '#f39c12',
  text: '#e0e0e0',
  textDim: '#7f8c8d',
  textHighlight: '#ffd700',
};

function colorVal(name) {
  return PALETTE[name] || name || PALETTE.snakeDefault;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.offsetX = 0;
    this.offsetY = 0;
    this.cell = CELL_DEFAULT;
  }

  render(state) {
    const ctx = this.ctx;
    const { width, height } = state;

    // Determine available space from wrapper element
    const wrapper = this.canvas.parentElement;
    const availW = wrapper ? wrapper.clientWidth : window.innerWidth;
    const availH = wrapper ? wrapper.clientHeight : window.innerHeight;

    const cell = computeCell(width, height, availW, availH);
    this.cell = cell;

    const headerH = 44;
    const footerH = 80;
    const gridW = width * cell;
    const gridH = height * cell;

    const canvasW = Math.max(gridW + 40, Math.min(availW, 800));
    const canvasH = gridH + headerH + footerH;

    this.canvas.width = canvasW * devicePixelRatio;
    this.canvas.height = canvasH * devicePixelRatio;
    this.canvas.style.width = canvasW + 'px';
    this.canvas.style.height = canvasH + 'px';
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    // Background
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Center grid
    this.offsetX = Math.floor((canvasW - gridW) / 2);
    this.offsetY = headerH;

    // Header
    this._drawHeader(ctx, state, canvasW, headerH);

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    this._drawGrid(ctx, state, cell);
    for (const { snake, active } of state.snakes) {
      this._drawSnake(ctx, snake, active, state, cell);
    }
    ctx.restore();

    // Footer
    this._drawFooter(ctx, state, canvasW, this.offsetY + gridH + 10);

    // Portal overlay
    if (state.portalGame) {
      this._drawPortalOverlay(ctx, state.portalGame.getState(), canvasW, canvasH, cell);
    }
  }

  _drawHeader(ctx, state, canvasW, headerH) {
    const midY = Math.floor(headerH / 2) + 4;
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`World ${state.world}`, 10, midY);

    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(state.title || '', canvasW / 2, midY);

    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    const phaseText = {
      forked: `分支 ${state.activeBranch + 1}`,
      merge_select: '选择分支',
      in_portal: '📦 子空间',
      delegate_select: '📋 选择指令',
      won: '✓ 通关',
    }[state.phase] || '';
    ctx.fillText(phaseText, canvasW - 10, midY);
  }

  _drawGrid(ctx, state, cell = CELL_DEFAULT) {
    const { grid, width, height, switchState, memoryStoneColors } = state;
    const radius = Math.max(3, Math.floor(cell * RADIUS / CELL_DEFAULT));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const c = grid[y][x];
        const cx = x * cell, cy = y * cell;

        let fill = PALETTE.empty;
        if (c.type === 'wall') fill = PALETTE.wall;
        else if (c.type === 'color') fill = this._colorFill(c.color, 0.35);
        else if (c.type === 'exit') fill = PALETTE.exitGlow;
        else if (c.type === 'gate') fill = PALETTE.gate;
        else if (c.type === 'switch_wall') fill = switchState[c.switchId] ? PALETTE.switchWallOpen : PALETTE.switchWallClosed;
        else if (c.type === 'checkpoint') fill = 'rgba(0,188,212,0.15)';
        else if (c.type === 'dye') fill = this._colorFill(c.color, 0.25);
        else if (c.type === 'wildcard') fill = 'rgba(200,200,200,0.15)';
        else if (c.type === 'portal') fill = 'rgba(155,89,182,0.2)';
        else if (c.type === 'delegate') fill = 'rgba(233,30,99,0.2)';

        this._fillRoundRect(ctx, cx + PAD, cy + PAD, cell - PAD * 2, cell - PAD * 2, radius, fill);

        if (c.memoryStone) {
          const key = `${x},${y}`;
          const stored = memoryStoneColors[key];
          ctx.save();
          if (stored) {
            ctx.globalAlpha = 0.3;
            this._fillRoundRect(ctx, cx + PAD, cy + PAD, cell - PAD * 2, cell - PAD * 2, radius, colorVal(stored));
            ctx.globalAlpha = 1;
          }
          ctx.fillStyle = stored ? PALETTE.memoryStoneActive : PALETTE.textDim;
          ctx.font = `${Math.floor(cell * 0.35)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('★', cx + cell / 2, cy + cell / 2);
          ctx.restore();
        }

        if (c.shadow) {
          this._fillRoundRect(ctx, cx + PAD, cy + PAD, cell - PAD * 2, cell - PAD * 2, radius, PALETTE.shadowOverlay);
        }

        this._drawCellMarker(ctx, c, cx, cy, state, cell);
      }
    }
  }

  _drawCellMarker(ctx, c, cx, cy, state, cell = CELL_DEFAULT) {
    const mx = cx + cell / 2, my = cy + cell / 2;
    const fs = Math.max(10, Math.floor(cell * 0.38));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (c.type === 'exit') {
      ctx.fillStyle = PALETTE.exit;
      ctx.font = `bold ${fs}px monospace`;
      ctx.fillText('⚑', mx, my);
    }
    if (c.type === 'gate') {
      const p = c.pattern;
      const dotR = Math.max(3, Math.floor(cell * 0.1));
      const gap = Math.max(2, Math.floor(cell * 0.05));
      const totalW = p.length * dotR * 2 + (p.length - 1) * gap;
      let sx = mx - totalW / 2 + dotR;
      for (const col of p) {
        ctx.beginPath();
        ctx.arc(sx, my, dotR, 0, Math.PI * 2);
        ctx.fillStyle = colorVal(col);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        sx += dotR * 2 + gap;
      }
    }
    if (c.type === 'checkpoint') {
      ctx.fillStyle = PALETTE.checkpoint;
      ctx.font = `bold ${Math.max(9, fs - 4)}px monospace`;
      ctx.fillText('</>', mx, my);
    }
    if (c.type === 'dye') {
      ctx.fillStyle = colorVal(c.color);
      ctx.font = `bold ${fs}px monospace`;
      ctx.fillText('▼', mx, my);
    }
    if (c.type === 'wildcard') {
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = `${fs}px monospace`;
      ctx.fillText('◇', mx, my);
    }
    if (c.type === 'echo_gate') {
      const eFs = Math.max(8, fs - 5);
      ctx.fillStyle = PALETTE.checkpoint;
      ctx.font = `${eFs}px monospace`;
      ctx.fillText('echo', mx, my - cell * 0.15);
      const p = c.requires;
      const dotR = Math.max(3, Math.floor(cell * 0.08));
      let sx = mx - ((p.length * dotR * 2 + (p.length - 1) * 2) / 2) + dotR;
      for (const col of p) {
        ctx.beginPath();
        ctx.arc(sx, my + cell * 0.15, dotR, 0, Math.PI * 2);
        ctx.fillStyle = colorVal(col);
        ctx.fill();
        sx += dotR * 2 + 2;
      }
    }
    if (c.type === 'switch') {
      const on = state.switchState[c.switchId];
      ctx.fillStyle = on ? PALETTE.switchOn : PALETTE.switchOff;
      ctx.font = `${fs}px monospace`;
      ctx.fillText(on ? '◆' : '◇', mx, my);
      if (c.permanent) {
        ctx.fillStyle = PALETTE.textDim;
        ctx.font = `${Math.max(7, fs - 8)}px monospace`;
        ctx.fillText('perm', mx, my + cell * 0.3);
      }
    }
    if (c.type === 'switch_wall') {
      const open = state.switchState[c.switchId];
      if (!open) {
        ctx.strokeStyle = PALETTE.switchWallClosed;
        ctx.lineWidth = Math.max(2, cell * 0.05);
        const barCount = 3;
        const barSpacing = (cell - 8) / (barCount + 1);
        for (let i = 1; i <= barCount; i++) {
          const bx = cx + barSpacing * i;
          ctx.beginPath();
          ctx.moveTo(bx, cy + 6);
          ctx.lineTo(bx, cy + cell - 6);
          ctx.stroke();
        }
      }
    }
    if (c.type === 'fork') {
      ctx.fillStyle = PALETTE.fork;
      ctx.font = `bold ${fs}px monospace`;
      ctx.fillText('⑂', mx, my);
    }
    if (c.type === 'portal') {
      ctx.fillStyle = PALETTE.portal;
      ctx.font = `${fs}px monospace`;
      ctx.fillText('◎', mx, my);
    }
    if (c.type === 'delegate') {
      ctx.fillStyle = PALETTE.delegate;
      ctx.font = `${fs}px monospace`;
      ctx.fillText('⊕', mx, my);
    }
  }

  _drawSnake(ctx, snake, active, state, cell = CELL_DEFAULT) {
    if (snake.length === 0) return;

    for (let i = 0; i < snake.length - 1; i++) {
      const a = snake[i], b = snake[i + 1];
      if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) continue;
      this._drawConnection(ctx, a, b, active, cell);
    }

    if (active && state.extraConnections) {
      for (const [a, b] of state.extraConnections) {
        this._drawConnection(ctx, a, b, active, cell);
      }
    }

    for (let i = 0; i < snake.length; i++) {
      const seg = snake[i];
      const sx = seg.x * cell + cell / 2;
      const sy = seg.y * cell + cell / 2;
      const isHead = (i === snake.length - 1);
      const r = Math.max(6, Math.floor(cell * (isHead ? 0.26 : 0.20)));

      ctx.save();
      if (seg.isShadow) ctx.globalAlpha = PALETTE.shadowSeg;
      if (!active) ctx.globalAlpha *= 0.5;

      let fill = seg.color ? colorVal(seg.color) : PALETTE.snakeDefault;
      if (isHead) fill = PALETTE.snakeHead;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();

      if (isHead && seg.color) {
        ctx.strokeStyle = colorVal(seg.color);
        ctx.lineWidth = Math.max(2, cell * 0.05);
        ctx.stroke();
      }
      if (seg.isPreset) {
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (seg.isShadow && seg.color) {
        ctx.strokeStyle = colorVal(seg.color);
        ctx.lineWidth = Math.max(2, cell * 0.05);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  _drawFooter(ctx, state, canvasW, footerY) {
    ctx.textAlign = 'center';

    if (state.won) {
      ctx.fillStyle = PALETTE.exit;
      ctx.font = 'bold 18px monospace';
      ctx.fillText('✓ 通关！按 N 进入下一关', canvasW / 2, footerY + 14);
      return;
    }

    if (state.phase === 'delegate_select' && state.delegateInstructions) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = '13px monospace';
      ctx.fillText('为子代理选择指令:', canvasW / 2, footerY + 10);
      const instrs = state.delegateInstructions;
      for (let i = 0; i < instrs.length; i++) {
        ctx.fillStyle = PALETTE.text;
        ctx.font = '12px monospace';
        ctx.fillText(`[${i + 1}] ${instrs[i].label}  ${instrs[i].desc}`, canvasW / 2, footerY + 28 + i * 16);
      }
      return;
    }

    let y = footerY + 14;
    if (state.message) {
      ctx.fillStyle = PALETTE.textHighlight;
      ctx.font = '13px monospace';
      ctx.fillText(state.message, canvasW / 2, y);
      y += 18;
    }
    if (state.maxLength < Infinity) {
      const snake = state.snakes[0]?.snake || [];
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = '12px monospace';
      ctx.fillText(`蛇身: ${snake.length} / ${state.maxLength}`, canvasW / 2, y);
      y += 16;
    }
    if (state.presetColors?.length > 0) {
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = '12px monospace';
      const dotR = 5;
      const label = '预置: ';
      const labelW = ctx.measureText(label).width;
      const totalW = labelW + state.presetColors.length * (dotR * 2 + 4);
      let sx = canvasW / 2 - totalW / 2;
      ctx.textAlign = 'left';
      ctx.fillText(label, sx, y);
      sx += labelW + 4;
      for (const c of state.presetColors) {
        ctx.beginPath();
        ctx.arc(sx + dotR, y - 4, dotR, 0, Math.PI * 2);
        ctx.fillStyle = colorVal(c);
        ctx.fill();
        sx += dotR * 2 + 4;
      }
    }
  }

  _drawPortalOverlay(ctx, subState, canvasW, canvasH, cell = CELL_DEFAULT) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const subCell = computeCell(subState.width, subState.height, canvasW * 0.8, canvasH * 0.7);
    const subGridW = subState.width * subCell;
    const subGridH = subState.height * subCell;
    const sx = Math.floor((canvasW - subGridW) / 2);
    const sy = Math.floor((canvasH - subGridH) / 2);

    ctx.strokeStyle = PALETTE.portal;
    ctx.lineWidth = 3;
    ctx.strokeRect(sx - 8, sy - 26, subGridW + 16, subGridH + 36);

    ctx.fillStyle = PALETTE.portal;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(subState.title || '子空间', canvasW / 2, sy - 10);

    ctx.save();
    ctx.translate(sx, sy);
    this._drawGrid(ctx, subState, subCell);
    for (const { snake, active } of subState.snakes) {
      this._drawSnake(ctx, snake, active, subState, subCell);
    }
    ctx.restore();
  }

  _drawConnection(ctx, a, b, active, cell = CELL_DEFAULT) {
    const ax = a.x * cell + cell / 2, ay = a.y * cell + cell / 2;
    const bx = b.x * cell + cell / 2, by = b.y * cell + cell / 2;
    ctx.strokeStyle = active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = Math.max(4, cell * 0.14);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }

  _fillRoundRect(ctx, x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  _colorFill(color, alpha) {
    const hex = PALETTE[color] || '#888';
    if (alpha >= 1) return hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
}
