// TRAIL - Game Engine
// Worlds: 1-Growth 2-Echo 3-Prism 4-Shadow 5-Fork 6-Rewind 7-Forgetting 8-Portal 9-Subagent

export const DIR = {
  UP: { dx: 0, dy: -1 },
  DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 },
  RIGHT: { dx: 1, dy: 0 },
};

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

export class Game {
  constructor(levelDef) {
    this.levelDef = levelDef;
    this.restart();
  }

  restart() {
    const def = this.levelDef;
    this.width = def.width;
    this.height = def.height;
    this.world = def.world || 0;

    // Build grid
    this.grid = Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => ({ type: 'empty' }))
    );
    // Place tiles — order matters: later entries can add flags to existing cells
    if (def.walls) for (const [x, y] of def.walls) this.grid[y][x] = { type: 'wall' };
    if (def.colors) for (const t of def.colors) this.grid[t.y][t.x] = { type: 'color', color: t.c };
    if (def.gates) for (const t of def.gates) this.grid[t.y][t.x] = { type: 'gate', pattern: t.pattern };
    if (def.echoGates) for (const t of def.echoGates) {
      this.grid[t.y][t.x] = { type: 'echo_gate', requires: t.requires };
    }
    if (def.switches) for (const t of def.switches) {
      this.grid[t.y][t.x] = { type: 'switch', switchId: t.id, permanent: !!t.permanent };
    }
    if (def.switchWalls) for (const t of def.switchWalls) {
      this.grid[t.y][t.x] = { type: 'switch_wall', switchId: t.id };
    }
    if (def.checkpoints) for (const t of def.checkpoints) {
      this.grid[t.y][t.x] = { type: 'checkpoint' };
    }
    if (def.prismTiles) for (const t of def.prismTiles) {
      this.grid[t.y][t.x] = { type: 'prism', colorMap: t.colorMap };
    }
    // Shadow zone: adds flag to existing cells
    if (def.shadowZone) for (const [x, y] of def.shadowZone) {
      this.grid[y][x].shadow = true;
    }
    // Shadow + color in one cell
    if (def.shadowColors) for (const t of def.shadowColors) {
      this.grid[t.y][t.x] = { type: 'color', color: t.c, shadow: true };
    }
    if (def.forks) for (const t of def.forks) this.grid[t.y][t.x] = { type: 'fork' };
    if (def.merges) for (const t of def.merges) this.grid[t.y][t.x] = { type: 'merge' };
    if (def.portals) for (const t of def.portals) {
      this.grid[t.y][t.x] = { type: 'portal', subLevel: t.subLevel, returnColor: t.returnColor };
    }
    if (def.delegates) for (const t of def.delegates) {
      this.grid[t.y][t.x] = { type: 'delegate', subLevel: t.subLevel, instructions: t.instructions };
    }
    // Memory stone: add flag to cell (can coexist with color)
    if (def.memoryStones) for (const [x, y] of def.memoryStones) {
      this.grid[y][x].memoryStone = true;
    }
    // Exit — placed last so it doesn't get overwritten
    this.grid[def.exit[1]][def.exit[0]] = { type: 'exit' };

    // Snake
    this.snake = [{ x: def.start[0], y: def.start[1], color: null, isShadow: false, isPreset: false }];
    if (def.presets) {
      this.snake = def.presets.map(p => ({ x: p.x, y: p.y, color: p.c, isShadow: false, isPreset: true }));
      this.snake.push({ x: def.start[0], y: def.start[1], color: null, isShadow: false, isPreset: false });
    }

    // State
    this.won = false;
    this.switchState = {};
    this.presetColors = (def.presets || []).map(p => p.c).filter(Boolean);
    this.undoStack = [];
    this.message = null;
    this.maxLength = def.maxLength || Infinity;
    this.memoryStoneColors = {};

    // Phase
    this.phase = 'playing';
    this.prismColor = null;
    this.prismOptions = def.prismOptions || null;
    if (this.prismOptions) this.phase = 'prism_select';

    // Fork
    this.branches = null;
    this.activeBranch = 0;

    // Portal / Delegate
    this.portalGame = null;
    this.portalReturnPos = null;
    this.delegateAuto = null; // { game, moves, index, returnColor }
  }

  // === CORE MOVE ===
  move(dir) {
    if (this.phase === 'in_portal') {
      const result = this.portalGame.move(dir);
      if (this.portalGame.won) this._exitPortal();
      return result;
    }
    if (this.phase !== 'playing' && this.phase !== 'forked') {
      return { success: false, reason: 'not playing' };
    }

    const head = this.getHead();
    const nx = head.x + dir.dx;
    const ny = head.y + dir.dy;

    if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height)
      return { success: false, reason: 'out of bounds' };

    const cell = this.grid[ny][nx];
    if (cell.type === 'wall') return { success: false, reason: 'wall' };
    if (cell.type === 'switch_wall' && !this.switchState[cell.switchId])
      return { success: false, reason: 'locked' };

    // Self collision
    const activeSnake = this.getActiveSnake();
    if (activeSnake.some(s => s.x === nx && s.y === ny))
      return { success: false, reason: 'self collision' };
    // Other branch collision
    if (this.branches) {
      for (let i = 0; i < this.branches.length; i++) {
        if (i !== this.activeBranch && this.branches[i].snake.some(s => s.x === nx && s.y === ny))
          return { success: false, reason: 'branch collision' };
      }
    }

    // Gate checks
    if (cell.type === 'gate' && !this._checkGate(cell.pattern))
      return { success: false, reason: 'pattern mismatch' };
    if (cell.type === 'echo_gate' && !this._checkEcho(cell.requires))
      return { success: false, reason: 'echo mismatch' };

    // Commit move
    this.pushUndo();
    const seg = {
      x: nx, y: ny,
      color: (cell.type === 'color') ? cell.color : null,
      isShadow: !!cell.shadow, // shadow only from cell flag, NOT propagated
      isPreset: false,
    };
    activeSnake.push(seg);
    this._applyEffects(cell, nx, ny);
    this._enforceMaxLength();
    return { success: true };
  }

  _applyEffects(cell, x, y) {
    if (cell.type === 'switch') {
      this.switchState[cell.switchId] = cell.permanent ? true : !this.switchState[cell.switchId];
      // Sync to active branch's switchState
      if (this.branches) {
        this.branches[this.activeBranch].switchState = clone(this.switchState);
      }
    }
    if (cell.type === 'exit') {
      this.won = true;
      this.phase = 'won';
    }
    if (cell.type === 'checkpoint') {
      this._handleCheckpoint();
    }
    if (cell.type === 'fork' && !this.branches) {
      this.branches = [
        { snake: clone(this.getActiveSnake()), switchState: clone(this.switchState) },
        { snake: clone(this.getActiveSnake()), switchState: clone(this.switchState) },
      ];
      this.activeBranch = 0;
      this.phase = 'forked';
      this.message = 'Tab 切换分支 · 到达合并点后按 1/2 选择';
    }
    if (cell.type === 'merge' && this.branches) {
      this.phase = 'merge_select';
      this.message = '按 1 或 2 选择保留哪条分支';
    }
    if (cell.type === 'portal') {
      this.portalReturnPos = { x, y };
      this.portalGame = new Game(cell.subLevel);
      this.phase = 'in_portal';
      this.message = '进入传送门！在子网格中解谜获取结果';
    }
    if (cell.type === 'delegate') {
      this.portalReturnPos = { x, y };
      this.phase = 'delegate_select';
      this._delegateCell = cell;
      this.message = '选择指令 (按 1/2/3)';
    }
  }

  _handleCheckpoint() {
    const snake = this.getActiveSnake();
    let lastColor = null;
    for (let i = snake.length - 1; i >= 0; i--) {
      if (snake[i].color && !snake[i].isPreset) { lastColor = snake[i].color; break; }
    }
    if (lastColor) this.presetColors.push(lastColor);
  }

  // === GATE CHECKING ===
  // Gate checks last N *colored* segments (skipping colorless), among visible (non-shadow) segments
  _checkGate(pattern) {
    const visible = this.getActiveSnake().filter(s => !s.isShadow);
    // Include memory stone colors at front
    const stoneSegs = Object.values(this.memoryStoneColors).map(c => ({ color: c }));
    const all = [...stoneSegs, ...visible];
    const colored = all.filter(s => s.color);
    if (colored.length < pattern.length) return false;
    const tail = colored.slice(-pattern.length);
    return tail.every((s, i) => s.color === pattern[i]);
  }

  _checkEcho(requires) {
    return requires.every(c => this.presetColors.includes(c));
  }

  // === WORLD-SPECIFIC ACTIONS ===
  setPrism(color) {
    if (this.phase !== 'prism_select') return;
    this.prismColor = color;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (cell.type === 'prism') {
          const mapped = cell.colorMap[color];
          if (mapped === 'wall') this.grid[y][x] = { type: 'wall' };
          else if (mapped === 'empty') this.grid[y][x] = { type: 'empty' };
          else this.grid[y][x] = { type: 'color', color: mapped };
        }
      }
    }
    this.phase = 'playing';
  }

  switchBranch() {
    if (!this.branches || this.phase === 'merge_select') return;
    // Save current switchState to current branch
    this.branches[this.activeBranch].switchState = clone(this.switchState);
    this.activeBranch = (this.activeBranch + 1) % this.branches.length;
    // Restore new branch's switchState
    this.switchState = clone(this.branches[this.activeBranch].switchState);
  }

  selectBranch(index) {
    if (this.phase !== 'merge_select' || !this.branches) return;
    if (index < 0 || index >= this.branches.length) return;
    // Save current branch state first
    this.branches[this.activeBranch].switchState = clone(this.switchState);
    // Merge ALL branches' switch states (side effects from all branches persist)
    const merged = {};
    for (const b of this.branches) Object.assign(merged, b.switchState);
    this.snake = this.branches[index].snake;
    this.switchState = merged;
    this.branches = null;
    this.activeBranch = 0;
    this.phase = 'playing';
    this.message = null;
  }

  rewind() {
    if (this.phase !== 'playing' && this.phase !== 'forked') return false;
    const snake = this.getActiveSnake();
    if (snake.length <= 1) return false;
    this.pushUndo();
    const removed = snake.pop();
    const cell = this.grid[removed.y][removed.x];
    if (cell.type === 'switch' && !cell.permanent) {
      this.switchState[cell.switchId] = !this.switchState[cell.switchId];
    }
    return true;
  }

  _exitPortal() {
    if (!this.portalGame) return;
    const ps = this.portalGame.snake;
    let returnColor = null;
    for (let i = ps.length - 1; i >= 0; i--) {
      if (ps[i].color) { returnColor = ps[i].color; break; }
    }
    this.snake[this.snake.length - 1].color = returnColor;
    this.portalGame = null;
    this.phase = 'playing';
    this.message = returnColor ? `获得 ${returnColor}` : null;
  }

  // Delegate (World 9: Subagent)
  selectInstruction(index) {
    if (this.phase !== 'delegate_select') return;
    const cell = this._delegateCell;
    const instr = cell.instructions[index];
    if (!instr) return;
    // Create sub-game and auto-play
    const subGame = new Game(cell.subLevel);
    if (instr.prism) subGame.setPrism(instr.prism);
    // Execute auto-moves
    for (const m of instr.moves) {
      subGame.move(DIR[m]);
    }
    // Get result: last colored segment (regardless of whether sub-game won)
    let returnColor = null;
    for (let i = subGame.snake.length - 1; i >= 0; i--) {
      if (subGame.snake[i].color) { returnColor = subGame.snake[i].color; break; }
    }
    this.snake[this.snake.length - 1].color = returnColor;
    this.phase = 'playing';
    this.message = returnColor
      ? `子代理返回 ${returnColor}`
      : '子代理未能完成任务';
    this._delegateCell = null;
  }

  // === MAX LENGTH (World 7) ===
  _enforceMaxLength() {
    const snake = this.getActiveSnake();
    while (snake.length > this.maxLength) {
      const removed = snake.shift();
      const cell = this.grid[removed.y]?.[removed.x];
      if (cell?.memoryStone && removed.color) {
        this.memoryStoneColors[`${removed.x},${removed.y}`] = removed.color;
      }
    }
  }

  // === UNDO ===
  pushUndo() {
    this.undoStack.push({
      snake: clone(this.snake),
      switchState: clone(this.switchState),
      won: this.won,
      phase: this.phase,
      presetColors: [...this.presetColors],
      memoryStoneColors: clone(this.memoryStoneColors),
      branches: this.branches ? clone(this.branches) : null,
      activeBranch: this.activeBranch,
      message: this.message,
    });
    if (this.undoStack.length > 200) this.undoStack.shift();
  }

  undo() {
    if (this.phase === 'in_portal') return this.portalGame.undo();
    if (this.undoStack.length === 0) return false;
    const s = this.undoStack.pop();
    this.snake = s.snake;
    this.switchState = s.switchState;
    this.won = s.won;
    this.phase = s.phase;
    this.presetColors = s.presetColors;
    this.memoryStoneColors = s.memoryStoneColors;
    this.branches = s.branches;
    this.activeBranch = s.activeBranch;
    this.message = s.message;
    return true;
  }

  // === HELPERS ===
  getHead() {
    return this.getActiveSnake().at(-1);
  }

  getActiveSnake() {
    return this.branches ? this.branches[this.activeBranch].snake : this.snake;
  }

  getAllSnakes() {
    if (this.branches) {
      return this.branches.map((b, i) => ({ snake: b.snake, active: i === this.activeBranch }));
    }
    return [{ snake: this.snake, active: true }];
  }

  getState() {
    return {
      grid: this.grid, width: this.width, height: this.height,
      snakes: this.getAllSnakes(), won: this.won, phase: this.phase,
      switchState: this.switchState,
      prismOptions: this.prismOptions, prismColor: this.prismColor,
      message: this.message,
      maxLength: this.maxLength, memoryStoneColors: this.memoryStoneColors,
      presetColors: this.presetColors,
      portalGame: this.portalGame,
      world: this.world, title: this.levelDef.title, hint: this.levelDef.hint,
      activeBranch: this.activeBranch,
      delegateInstructions: this._delegateCell?.instructions || null,
    };
  }
}
