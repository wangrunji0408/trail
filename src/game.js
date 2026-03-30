// TRAIL - Game Engine

export const DIR = {
  UP: { dx: 0, dy: -1 },
  DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 },
  RIGHT: { dx: 1, dy: 0 },
};

const ROLE_CHARS = new Set(['U', 'A', 'S', 'T']);

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
    if (def.chars) for (const t of def.chars) this.grid[t.y][t.x] = { type: 'char', char: t.char };
    if (def.gates) for (const t of def.gates) this.grid[t.y][t.x] = { type: 'gate', pattern: t.pattern };
    if (def.switches) for (const t of def.switches) {
      this.grid[t.y][t.x] = { type: 'switch', switchId: t.id, permanent: !!t.permanent };
    }
    if (def.switchWalls) for (const t of def.switchWalls) {
      this.grid[t.y][t.x] = { type: 'switch_wall', switchId: t.id };
    }
    if (def.decodes) for (const t of def.decodes) {
      this.grid[t.y][t.x] = { type: 'decode' };
    }
    if (def.dyes) for (const t of def.dyes) {
      this.grid[t.y][t.x] = { type: 'dye', char: t.char };
    }
    if (def.wildcards) for (const [x, y] of def.wildcards) {
      this.grid[y][x] = { type: 'wildcard' };
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

    this.decodeRules = def.decodeRules || [];

    this.snake = [{ x: def.start[0], y: def.start[1], char: null }];

    this.won = false;
    this.switchState = {};
    this.undoStack = [];
    this.message = null;
    this.maxLength = def.maxLength || Infinity;
    this.memoryStoneChars = {};
    this.lastDir = null;
    this.activeRole = null;

    this.phase = 'playing';

    // Fork
    this.branches = null;
    this.activeBranch = 0;
    this.forkLength = 0;
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

    let segChar = null;
    if (cell.type === 'char') segChar = cell.char;
    if (cell.type === 'dye') segChar = cell.char;
    if (cell.type === 'decode') segChar = this._resolveDecodeChar(activeSnake);

    // Update activeRole if stepping on a role char
    if (segChar && ROLE_CHARS.has(segChar)) {
      this.activeRole = segChar;
    }

    activeSnake.push({ x: nx, y: ny, char: segChar });
    this._applyEffects(cell, nx, ny, dir);
    this._enforceMaxLength();
    return { success: true };
  }

  _resolveDecodeChar(snake) {
    // Build sequence string from snake chars
    const seq = snake.map(s => s.char).filter(Boolean).join('');
    for (const rule of this.decodeRules) {
      if (rule.regex.test(seq)) return rule.output;
    }
    return '?';
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
            this.grid[gy][gx] = { type: 'char', char: cell.char };
          }
        }
      }
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

  // === GATE CHECKING ===
  _checkGate(pattern) {
    if (!pattern || pattern.length === 0) return true;

    const visible = this._getVisibleSequence();
    // Add memory stone chars
    const stoneChars = Object.values(this.memoryStoneChars);
    const seq = [...stoneChars, ...visible];

    // Subsequence matching
    for (let i = 0; i <= seq.length - pattern.length; i++) {
      let match = true;
      for (let j = 0; j < pattern.length; j++) {
        if (seq[i + j] !== pattern[j]) { match = false; break; }
      }
      if (match) return true;
    }
    return false;
  }

  // Build visible sequence: all chars, but skip content between T and next U/A/S
  _getVisibleSequence() {
    const snake = this.getActiveSnake();
    const result = [];
    let inThink = false;
    for (const seg of snake) {
      if (!seg.char) continue;
      if (seg.char === 'T') {
        inThink = true;
        continue;  // T itself is also hidden
      }
      if (inThink && ROLE_CHARS.has(seg.char) && seg.char !== 'T') {
        inThink = false;
      }
      if (!inThink) {
        result.push(seg.char);
      }
    }
    return result;
  }

  // === FORK (Tab) ===
  switchBranch() {
    if (!this.branches) return;
    this.branches[this.activeBranch].switchState = clone(this.switchState);
    this.activeBranch = (this.activeBranch + 1) % this.branches.length;
    this.switchState = clone(this.branches[this.activeBranch].switchState);
  }

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
    // Restore activeRole by scanning backwards
    this.activeRole = null;
    for (let i = snake.length - 1; i >= 0; i--) {
      if (snake[i].char && ROLE_CHARS.has(snake[i].char)) {
        this.activeRole = snake[i].char;
        break;
      }
    }
    return true;
  }

  _exitPortal() {
    if (!this.portalGame) return;
    let returnChar = null;
    for (let i = this.portalGame.snake.length - 1; i >= 0; i--) {
      if (this.portalGame.snake[i].char) { returnChar = this.portalGame.snake[i].char; break; }
    }
    this.snake[this.snake.length - 1].char = returnChar;
    this.portalGame = null;
    this.phase = 'playing';
    this.message = returnChar ? `获得 ${returnChar}` : null;
  }

  selectInstruction(index) {
    if (this.phase !== 'delegate_select') return;
    const cell = this._delegateCell;
    const instr = cell.instructions[index];
    if (!instr) return;
    const subGame = new Game(cell.subLevel);
    for (const m of instr.moves) subGame.move(DIR[m]);
    let returnChar = null;
    for (let i = subGame.snake.length - 1; i >= 0; i--) {
      if (subGame.snake[i].char) { returnChar = subGame.snake[i].char; break; }
    }
    this.snake[this.snake.length - 1].char = returnChar;
    this.phase = 'playing';
    this.message = returnChar ? `子代理返回 ${returnChar}` : '子代理未能完成任务';
    this._delegateCell = null;
  }

  _enforceMaxLength() {
    const snake = this.getActiveSnake();
    while (snake.length > this.maxLength) {
      const removed = snake.shift();
      const cell = this.grid[removed.y]?.[removed.x];
      if (cell?.memoryStone && removed.char) {
        this.memoryStoneChars[`${removed.x},${removed.y}`] = removed.char;
      }
    }
  }

  pushUndo() {
    this.undoStack.push({
      snake: clone(this.snake),
      switchState: clone(this.switchState),
      won: this.won, phase: this.phase,
      memoryStoneChars: clone(this.memoryStoneChars),
      branches: this.branches ? clone(this.branches) : null,
      activeBranch: this.activeBranch,
      forkLength: this.forkLength,
      extraConnections: clone(this.extraConnections),
      message: this.message,
      grid: clone(this.grid),
      activeRole: this.activeRole,
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
    this.memoryStoneChars = s.memoryStoneChars;
    this.branches = s.branches;
    this.activeBranch = s.activeBranch;
    this.forkLength = s.forkLength;
    this.extraConnections = s.extraConnections;
    this.message = s.message;
    this.grid = s.grid;
    this.activeRole = s.activeRole;
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
      maxLength: this.maxLength, memoryStoneChars: this.memoryStoneChars,
      portalGame: this.portalGame,
      world: this.world, title: this.levelDef.title,
      activeBranch: this.activeBranch,
      extraConnections: this.extraConnections,
      delegateInstructions: this._delegateCell?.instructions || null,
      activeRole: this.activeRole,
    };
  }
}
