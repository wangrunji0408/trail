// TRAIL - Game Engine

export const DIR = {
  UP: { dx: 0, dy: -1 },
  DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 },
  RIGHT: { dx: 1, dy: 0 },
};

const INVERT = { red: 'blue', blue: 'red', green: 'yellow', yellow: 'green' };

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

    this.grid = Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => ({ type: 'empty' }))
    );
    if (def.walls) for (const [x, y] of def.walls) this.grid[y][x] = { type: 'wall' };
    if (def.colors) for (const t of def.colors) this.grid[t.y][t.x] = { type: 'color', color: t.c };
    if (def.gates) for (const t of def.gates) this.grid[t.y][t.x] = { type: 'gate', pattern: t.pattern };
    if (def.switches) for (const t of def.switches) {
      this.grid[t.y][t.x] = { type: 'switch', switchId: t.id, permanent: !!t.permanent };
    }
    if (def.switchWalls) for (const t of def.switchWalls) {
      this.grid[t.y][t.x] = { type: 'switch_wall', switchId: t.id };
    }
    if (def.checkpoints) for (const t of def.checkpoints) {
      this.grid[t.y][t.x] = { type: 'checkpoint' };
    }
    if (def.dyes) for (const t of def.dyes) {
      this.grid[t.y][t.x] = { type: 'dye', color: t.c };
    }
    if (def.wildcards) for (const [x, y] of def.wildcards) {
      this.grid[y][x] = { type: 'wildcard' };
    }
    if (def.shadowZone) for (const [x, y] of def.shadowZone) {
      this.grid[y][x].shadow = true;
    }
    if (def.shadowColors) for (const t of def.shadowColors) {
      this.grid[t.y][t.x] = { type: 'color', color: t.c, shadow: true };
    }
    if (def.forks) for (const t of def.forks) this.grid[t.y][t.x] = { type: 'fork' };
    if (def.portals) for (const t of def.portals) {
      this.grid[t.y][t.x] = { type: 'portal', subLevel: t.subLevel };
    }
    if (def.delegates) for (const t of def.delegates) {
      this.grid[t.y][t.x] = { type: 'delegate', subLevel: t.subLevel, instructions: t.instructions };
    }
    if (def.memoryStones) for (const [x, y] of def.memoryStones) {
      this.grid[y][x].memoryStone = true;
    }
    if (def.exit) this.grid[def.exit[1]][def.exit[0]] = { type: 'exit' };

    this.snake = [{ x: def.start[0], y: def.start[1], color: null, isShadow: false, isPreset: false }];

    this.won = false;
    this.switchState = {};
    this.undoStack = [];
    this.message = null;
    this.maxLength = def.maxLength || Infinity;
    this.memoryStoneColors = {};
    this.lastDir = null;

    this.checkpointRule = def.checkpointRule || 'invert';
    this.checkpointSteps = def.checkpointSteps || 1;

    this.phase = 'playing';

    // Fork
    this.branches = null;
    this.activeBranch = 0;
    this.forkLength = 0;

    // Extra connections for rendering (e.g., fork branches)
    this.extraConnections = [];

    this.portalGame = null;
    this.portalReturnPos = null;
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

    // Walk-back undo
    const activeSnake = this.getActiveSnake();
    if (activeSnake.length >= 2) {
      const prev = activeSnake[activeSnake.length - 2];
      if (prev.x === nx && prev.y === ny) {
        return this.undo() ? { success: true, walkBack: true } : { success: false, reason: 'cannot undo' };
      }
    }

    const cell = this.grid[ny][nx];
    if (cell.type === 'wall') return { success: false, reason: 'wall' };
    if (cell.type === 'switch_wall' && !this.switchState[cell.switchId])
      return { success: false, reason: 'locked' };
    if (cell.type === 'wildcard') return { success: false, reason: 'wildcard not activated' };

    // Self collision (active branch)
    if (activeSnake.some(s => s.x === nx && s.y === ny))
      return { success: false, reason: 'self collision' };

    // Fork: check if target is on other branch's UNIQUE segments → auto-merge
    if (this.branches) {
      for (let i = 0; i < this.branches.length; i++) {
        if (i === this.activeBranch) continue;
        const other = this.branches[i].snake;
        for (let j = this.forkLength; j < other.length; j++) {
          if (other[j].x === nx && other[j].y === ny) {
            this._mergeBranches(this.activeBranch, i, nx, ny);
            return { success: true };
          }
        }
      }
    }

    // Gate check
    if (cell.type === 'gate' && !this._checkGate(cell.pattern))
      return { success: false, reason: 'pattern mismatch' };

    // Commit move
    this.pushUndo();
    this.lastDir = dir;

    let segColor = null;
    if (cell.type === 'color') segColor = cell.color;
    if (cell.type === 'dye') segColor = cell.color;

    activeSnake.push({
      x: nx, y: ny,
      color: segColor,
      isShadow: !!cell.shadow,
      isPreset: false,
    });
    this._applyEffects(cell, nx, ny, dir);
    this._enforceMaxLength();
    return { success: true };
  }

  _applyEffects(cell, x, y, dir) {
    if (cell.type === 'switch') {
      this.switchState[cell.switchId] = cell.permanent ? true : !this.switchState[cell.switchId];
      if (this.branches) {
        this.branches[this.activeBranch].switchState = clone(this.switchState);
      }
    }
    if (cell.type === 'exit') {
      this.won = true;
      this.phase = 'won';
    }
    // Fork: auto-fork when stepping on F tile
    if (cell.type === 'fork' && !this.branches) {
      this.branches = [
        { snake: clone(this.getActiveSnake()), switchState: clone(this.switchState) },
        { snake: clone(this.getActiveSnake()), switchState: clone(this.switchState) },
      ];
      this.forkLength = this.getActiveSnake().length;
      this.activeBranch = 0;
      this.phase = 'forked';
      this.message = 'Tab 切换分支 · 走到另一分支上自动合并';
    }
    if (cell.type === 'dye') {
      for (let gy = 0; gy < this.height; gy++) {
        for (let gx = 0; gx < this.width; gx++) {
          if (this.grid[gy][gx].type === 'wildcard') {
            this.grid[gy][gx] = { type: 'color', color: cell.color };
          }
        }
      }
    }
    if (cell.type === 'checkpoint') {
      this._handleCheckpoint(dir);
    }
    if (cell.type === 'portal') {
      this.portalReturnPos = { x, y };
      this.portalGame = new Game(cell.subLevel);
      this.phase = 'in_portal';
      this.message = '进入传送门！';
    }
    if (cell.type === 'delegate') {
      this.portalReturnPos = { x, y };
      this.phase = 'delegate_select';
      this._delegateCell = cell;
      this.message = '选择指令 (按 1/2/3)';
    }
  }

  _handleCheckpoint(dir) {
    const snake = this.getActiveSnake();
    let lastColor = null;
    for (let i = snake.length - 2; i >= 0; i--) {
      if (snake[i].color && !snake[i].isPreset) { lastColor = snake[i].color; break; }
    }
    if (!lastColor) return;

    const responseColor = this.checkpointRule === 'invert'
      ? (INVERT[lastColor] || lastColor) : lastColor;

    snake[snake.length - 1].isPreset = true;

    for (let step = 0; step < this.checkpointSteps; step++) {
      const head = snake[snake.length - 1];
      const ax = head.x + dir.dx;
      const ay = head.y + dir.dy;
      if (ax < 0 || ax >= this.width || ay < 0 || ay >= this.height) break;
      if (this.grid[ay][ax].type === 'wall') break;
      if (snake.some(s => s.x === ax && s.y === ay)) break;
      snake.push({ x: ax, y: ay, color: responseColor, isShadow: false, isPreset: true });
    }
  }

  // === GATE CHECKING ===
  _checkGate(pattern) {
    const visible = this.getActiveSnake().filter(s => !s.isShadow);
    const stoneSegs = Object.values(this.memoryStoneColors).map(c => ({ color: c }));
    const colored = [...stoneSegs, ...visible].filter(s => s.color);
    for (let i = 0; i <= colored.length - pattern.length; i++) {
      let match = true;
      for (let j = 0; j < pattern.length; j++) {
        if (colored[i + j].color !== pattern[j]) { match = false; break; }
      }
      if (match) return true;
    }
    return false;
  }

  // === FORK (Tab) ===
  // Tab when not forked → create fork; Tab when forked → switch branch
  switchBranch() {
    if (!this.branches) return;
    // Switch active branch
    this.branches[this.activeBranch].switchState = clone(this.switchState);
    this.activeBranch = (this.activeBranch + 1) % this.branches.length;
    this.switchState = clone(this.branches[this.activeBranch].switchState);
  }

  // Auto-merge: moving branch lands on target branch's unique cell
  _mergeBranches(movingIdx, targetIdx, mergeX, mergeY) {
    this.pushUndo();
    const moving = this.branches[movingIdx];
    const target = this.branches[targetIdx];

    const mergedSwitch = {};
    Object.assign(mergedSwitch, target.switchState);
    Object.assign(mergedSwitch, moving.switchState);

    const shared = target.snake.slice(0, this.forkLength);
    const movingUnique = moving.snake.slice(this.forkLength);
    const targetUnique = target.snake.slice(this.forkLength);

    this.snake = [...shared, ...movingUnique, ...targetUnique];

    // Extra connections for renderer:
    // 1. Fork point → target branch start
    // 2. Moving branch end → merge point
    this.extraConnections = [];
    if (shared.length > 0 && targetUnique.length > 0) {
      this.extraConnections.push([shared[shared.length - 1], targetUnique[0]]);
    }
    if (movingUnique.length > 0) {
      const mergePoint = target.snake.find(s => s.x === mergeX && s.y === mergeY);
      if (mergePoint) {
        this.extraConnections.push([movingUnique[movingUnique.length - 1], mergePoint]);
      }
    }

    this.switchState = mergedSwitch;
    this.branches = null;
    this.activeBranch = 0;
    this.forkLength = 0;
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
    let returnColor = null;
    for (let i = this.portalGame.snake.length - 1; i >= 0; i--) {
      if (this.portalGame.snake[i].color) { returnColor = this.portalGame.snake[i].color; break; }
    }
    this.snake[this.snake.length - 1].color = returnColor;
    this.portalGame = null;
    this.phase = 'playing';
    this.message = returnColor ? `获得 ${returnColor}` : null;
  }

  selectInstruction(index) {
    if (this.phase !== 'delegate_select') return;
    const cell = this._delegateCell;
    const instr = cell.instructions[index];
    if (!instr) return;
    const subGame = new Game(cell.subLevel);
    for (const m of instr.moves) subGame.move(DIR[m]);
    let returnColor = null;
    for (let i = subGame.snake.length - 1; i >= 0; i--) {
      if (subGame.snake[i].color) { returnColor = subGame.snake[i].color; break; }
    }
    this.snake[this.snake.length - 1].color = returnColor;
    this.phase = 'playing';
    this.message = returnColor ? `子代理返回 ${returnColor}` : '子代理未能完成任务';
    this._delegateCell = null;
  }

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

  pushUndo() {
    this.undoStack.push({
      snake: clone(this.snake),
      switchState: clone(this.switchState),
      won: this.won, phase: this.phase,
      memoryStoneColors: clone(this.memoryStoneColors),
      branches: this.branches ? clone(this.branches) : null,
      activeBranch: this.activeBranch,
      forkLength: this.forkLength,
      extraConnections: clone(this.extraConnections),
      message: this.message,
      grid: clone(this.grid),
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
    this.memoryStoneColors = s.memoryStoneColors;
    this.branches = s.branches;
    this.activeBranch = s.activeBranch;
    this.forkLength = s.forkLength;
    this.extraConnections = s.extraConnections;
    this.message = s.message;
    this.grid = s.grid;
    return true;
  }

  getHead() { return this.getActiveSnake().at(-1); }

  getActiveSnake() {
    return this.branches ? this.branches[this.activeBranch].snake : this.snake;
  }

  getAllSnakes() {
    if (this.branches) return this.branches.map((b, i) => ({ snake: b.snake, active: i === this.activeBranch }));
    return [{ snake: this.snake, active: true }];
  }

  getState() {
    return {
      grid: this.grid, width: this.width, height: this.height,
      snakes: this.getAllSnakes(), won: this.won, phase: this.phase,
      switchState: this.switchState, message: this.message,
      maxLength: this.maxLength, memoryStoneColors: this.memoryStoneColors,
      portalGame: this.portalGame,
      world: this.world, title: this.levelDef.title,
      activeBranch: this.activeBranch,
      extraConnections: this.extraConnections,
      delegateInstructions: this._delegateCell?.instructions || null,
    };
  }
}
