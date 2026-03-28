// TRAIL - Canvas Renderer

const CELL = 56;
const PAD = 1;
const RADIUS = 6;

const PALETTE = {
  bg: '#0f0e17',
  gridBg: '#1a1a2e',
  gridLine: '#16213e',
  wall: '#0a0a15',
  empty: '#16213e',
  exit: '#ffd700',
  exitGlow: 'rgba(255,215,0,0.25)',
  snakeDefault: '#e0e0e0',
  snakeHead: '#ffffff',
  snakePreset: 'rgba(255,255,255,0.35)',
  shadowOverlay: 'rgba(128,0,255,0.15)',
  shadowSeg: 0.35, // alpha for shadow segments
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
  prism: '#e8e8e8',
  fork: '#ff9800',
  merge: '#ff9800',
  portal: '#9b59b6',
  delegate: '#e91e63',
  memoryStoneBg: '#2c3e50',
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
  }

  render(state) {
    const ctx = this.ctx;
    const { width, height } = state;
    const gridW = width * CELL;
    const gridH = height * CELL;

    // Size canvas
    const canvasW = Math.max(gridW + 80, 500);
    const canvasH = gridH + 180;
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
    this.offsetY = 70;

    // Header
    this._drawHeader(ctx, state, canvasW);

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);

    // Grid cells
    this._drawGrid(ctx, state);

    // Snakes
    for (const { snake, active } of state.snakes) {
      this._drawSnake(ctx, snake, active, state);
    }

    ctx.restore();

    // Footer
    this._drawFooter(ctx, state, canvasW, this.offsetY + gridH + 16);

    // Portal overlay
    if (state.portalGame) {
      this._drawPortalOverlay(ctx, state.portalGame.getState(), canvasW, canvasH);
    }
  }

  _drawHeader(ctx, state, canvasW) {
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`World ${state.world}`, 20, 24);

    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(state.title || '', canvasW / 2, 28);

    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '13px monospace';
    ctx.textAlign = 'right';
    const phaseText = {
      prism_select: '🔷 选择棱镜色',
      forked: `分支 ${state.activeBranch + 1}`,
      merge_select: '选择分支',
      in_portal: '📦 子空间',
      delegate_select: '📋 选择指令',
      won: '✓ 通关',
    }[state.phase] || '';
    ctx.fillText(phaseText, canvasW - 20, 24);

    // Hint
    if (state.hint) {
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(state.hint, canvasW / 2, 52);
    }
  }

  _drawGrid(ctx, state) {
    const { grid, width, height, switchState, memoryStoneColors } = state;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = grid[y][x];
        const cx = x * CELL, cy = y * CELL;

        // Base fill
        let fill = PALETTE.empty;
        if (cell.type === 'wall') fill = PALETTE.wall;
        else if (cell.type === 'color') fill = this._colorFill(cell.color, 0.35);
        else if (cell.type === 'exit') fill = PALETTE.exitGlow;
        else if (cell.type === 'gate' || cell.type === 'echo_gate') fill = PALETTE.gate;
        else if (cell.type === 'switch') fill = PALETTE.empty;
        else if (cell.type === 'switch_wall') fill = switchState[cell.switchId] ? PALETTE.switchWallOpen : PALETTE.switchWallClosed;
        else if (cell.type === 'checkpoint') fill = PALETTE.empty;
        else if (cell.type === 'prism') fill = PALETTE.prism;
        else if (cell.type === 'fork') fill = PALETTE.empty;
        else if (cell.type === 'merge') fill = PALETTE.empty;
        else if (cell.type === 'portal') fill = 'rgba(155,89,182,0.2)';
        else if (cell.type === 'delegate') fill = 'rgba(233,30,99,0.2)';

        this._fillRoundRect(ctx, cx + PAD, cy + PAD, CELL - PAD * 2, CELL - PAD * 2, RADIUS, fill);

        // Memory stone background
        if (cell.memoryStone) {
          const key = `${x},${y}`;
          const stored = memoryStoneColors[key];
          ctx.save();
          if (stored) {
            ctx.fillStyle = colorVal(stored);
            ctx.globalAlpha = 0.3;
            this._fillRoundRect(ctx, cx + PAD, cy + PAD, CELL - PAD * 2, CELL - PAD * 2, RADIUS, colorVal(stored));
            ctx.globalAlpha = 1;
          }
          // Star marker
          ctx.fillStyle = stored ? PALETTE.memoryStoneActive : PALETTE.textDim;
          ctx.font = '18px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('★', cx + CELL / 2, cy + CELL / 2);
          ctx.restore();
        }

        // Shadow overlay
        if (cell.shadow) {
          ctx.fillStyle = PALETTE.shadowOverlay;
          this._fillRoundRect(ctx, cx + PAD, cy + PAD, CELL - PAD * 2, CELL - PAD * 2, RADIUS, PALETTE.shadowOverlay);
        }

        // Special markers
        this._drawCellMarker(ctx, cell, cx, cy, state);
      }
    }
  }

  _drawCellMarker(ctx, cell, cx, cy, state) {
    const mx = cx + CELL / 2, my = cy + CELL / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (cell.type === 'exit') {
      ctx.fillStyle = PALETTE.exit;
      ctx.font = 'bold 22px monospace';
      ctx.fillText('E', mx, my);
    }
    if (cell.type === 'gate') {
      // Show pattern as colored dots
      const p = cell.pattern;
      const dotR = 6;
      const totalW = p.length * dotR * 2 + (p.length - 1) * 3;
      let sx = mx - totalW / 2 + dotR;
      for (const c of p) {
        ctx.beginPath();
        ctx.arc(sx, my, dotR, 0, Math.PI * 2);
        ctx.fillStyle = colorVal(c);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        sx += dotR * 2 + 3;
      }
    }
    if (cell.type === 'echo_gate') {
      ctx.fillStyle = PALETTE.checkpoint;
      ctx.font = '11px monospace';
      ctx.fillText('echo', mx, my - 8);
      const p = cell.requires;
      const dotR = 5;
      let sx = mx - ((p.length * dotR * 2 + (p.length - 1) * 3) / 2) + dotR;
      for (const c of p) {
        ctx.beginPath();
        ctx.arc(sx, my + 8, dotR, 0, Math.PI * 2);
        ctx.fillStyle = colorVal(c);
        ctx.fill();
        sx += dotR * 2 + 3;
      }
    }
    if (cell.type === 'switch') {
      const on = state.switchState[cell.switchId];
      ctx.fillStyle = on ? PALETTE.switchOn : PALETTE.switchOff;
      ctx.font = '20px monospace';
      ctx.fillText(on ? '◆' : '◇', mx, my);
      if (cell.permanent) {
        ctx.fillStyle = PALETTE.textDim;
        ctx.font = '9px monospace';
        ctx.fillText('perm', mx, my + 16);
      }
    }
    if (cell.type === 'switch_wall') {
      const open = state.switchState[cell.switchId];
      if (!open) {
        // Draw bars
        ctx.strokeStyle = PALETTE.switchWallClosed;
        ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          const bx = cx + 12 + i * 14;
          ctx.beginPath();
          ctx.moveTo(bx, cy + 8);
          ctx.lineTo(bx, cy + CELL - 8);
          ctx.stroke();
        }
      }
    }
    if (cell.type === 'checkpoint') {
      ctx.fillStyle = PALETTE.checkpoint;
      ctx.font = 'bold 18px monospace';
      ctx.fillText('C', mx, my);
    }
    if (cell.type === 'fork') {
      ctx.fillStyle = PALETTE.fork;
      ctx.font = 'bold 18px monospace';
      ctx.fillText('F', mx, my);
    }
    if (cell.type === 'merge') {
      ctx.fillStyle = PALETTE.fork;
      ctx.font = 'bold 18px monospace';
      ctx.fillText('M', mx, my);
    }
    if (cell.type === 'portal') {
      ctx.fillStyle = PALETTE.portal;
      ctx.font = '22px monospace';
      ctx.fillText('◎', mx, my);
    }
    if (cell.type === 'delegate') {
      ctx.fillStyle = PALETTE.delegate;
      ctx.font = '20px monospace';
      ctx.fillText('⊕', mx, my);
    }
  }

  _drawSnake(ctx, snake, active, state) {
    if (snake.length === 0) return;

    // Draw connections
    for (let i = 0; i < snake.length - 1; i++) {
      const a = snake[i], b = snake[i + 1];
      const ax = a.x * CELL + CELL / 2, ay = a.y * CELL + CELL / 2;
      const bx = b.x * CELL + CELL / 2, by = b.y * CELL + CELL / 2;
      ctx.strokeStyle = active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }

    // Draw segments
    for (let i = 0; i < snake.length; i++) {
      const seg = snake[i];
      const sx = seg.x * CELL + CELL / 2;
      const sy = seg.y * CELL + CELL / 2;
      const isHead = (i === snake.length - 1);
      const r = isHead ? 14 : 11;

      ctx.save();
      if (seg.isShadow) ctx.globalAlpha = PALETTE.shadowSeg;
      if (!active) ctx.globalAlpha *= 0.5;

      // Fill
      let fill = seg.color ? colorVal(seg.color) : PALETTE.snakeDefault;
      if (isHead) fill = PALETTE.snakeHead;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();

      // Color ring for head
      if (isHead && seg.color) {
        ctx.strokeStyle = colorVal(seg.color);
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Preset border (dashed)
      if (seg.isPreset) {
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Shadow segments: hatch pattern
      if (seg.isShadow && seg.color) {
        ctx.strokeStyle = colorVal(seg.color);
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  _drawFooter(ctx, state, canvasW, footerY) {
    ctx.textAlign = 'center';

    // Message
    if (state.message) {
      ctx.fillStyle = PALETTE.textHighlight;
      ctx.font = '14px monospace';
      ctx.fillText(state.message, canvasW / 2, footerY + 10);
    }

    // Max length indicator
    if (state.maxLength < Infinity) {
      const snake = state.snakes[0]?.snake || [];
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = '12px monospace';
      ctx.fillText(`蛇身: ${snake.length} / ${state.maxLength}`, canvasW / 2, footerY + 30);
    }

    // Preset colors display
    if (state.presetColors?.length > 0) {
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = '12px monospace';
      const dotR = 5;
      const label = '预置: ';
      const labelW = ctx.measureText(label).width;
      const totalW = labelW + state.presetColors.length * (dotR * 2 + 4);
      let sx = canvasW / 2 - totalW / 2;
      ctx.textAlign = 'left';
      ctx.fillText(label, sx, footerY + 50);
      sx += labelW + 4;
      for (const c of state.presetColors) {
        ctx.beginPath();
        ctx.arc(sx + dotR, footerY + 46, dotR, 0, Math.PI * 2);
        ctx.fillStyle = colorVal(c);
        ctx.fill();
        sx += dotR * 2 + 4;
      }
    }

    // Controls help
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    let controlsY = footerY + 72;
    ctx.fillText('方向键:移动  Z:撤销  R:重来  N:下一关', canvasW / 2, controlsY);
    if (state.world >= 6) {
      ctx.fillText('Backspace:倒带', canvasW / 2, controlsY + 16);
    }

    // Prism selector
    if (state.phase === 'prism_select' && state.prismOptions) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = '14px monospace';
      ctx.fillText('选择棱镜色:', canvasW / 2, footerY + 10);
      const opts = state.prismOptions;
      const totalOptW = opts.length * 80;
      let ox = canvasW / 2 - totalOptW / 2;
      for (let i = 0; i < opts.length; i++) {
        const c = opts[i];
        ctx.fillStyle = colorVal(c);
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`[${i + 1}] ●`, ox + 40, footerY + 34);
        ox += 80;
      }
    }

    // Delegate selector
    if (state.phase === 'delegate_select' && state.delegateInstructions) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('为子代理选择指令:', canvasW / 2, footerY + 10);
      const instrs = state.delegateInstructions;
      for (let i = 0; i < instrs.length; i++) {
        ctx.fillStyle = PALETTE.text;
        ctx.font = '13px monospace';
        ctx.fillText(`[${i + 1}] ${instrs[i].label}  ${instrs[i].desc}`, canvasW / 2, footerY + 32 + i * 18);
      }
    }

    // Won state
    if (state.won) {
      ctx.fillStyle = PALETTE.exit;
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('✓ 通关！', canvasW / 2, footerY + 10);
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = '13px monospace';
      ctx.fillText('按 N 进入下一关', canvasW / 2, footerY + 34);
    }
  }

  _drawPortalOverlay(ctx, subState, canvasW, canvasH) {
    // Dim background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Draw sub-grid centered
    const subGridW = subState.width * CELL;
    const subGridH = subState.height * CELL;
    const sx = Math.floor((canvasW - subGridW) / 2);
    const sy = Math.floor((canvasH - subGridH) / 2);

    // Border
    ctx.strokeStyle = PALETTE.portal;
    ctx.lineWidth = 3;
    ctx.strokeRect(sx - 8, sy - 30, subGridW + 16, subGridH + 46);

    // Title
    ctx.fillStyle = PALETTE.portal;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(subState.title || '子空间', canvasW / 2, sy - 12);

    ctx.save();
    ctx.translate(sx, sy);
    this._drawGrid(ctx, subState);
    for (const { snake, active } of subState.snakes) {
      this._drawSnake(ctx, snake, active, subState);
    }
    ctx.restore();
  }

  // Helpers
  _fillRoundRect(ctx, x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  _colorFill(color, alpha) {
    const hex = PALETTE[color] || '#888';
    if (alpha >= 1) return hex;
    // Convert hex to rgba
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
}
