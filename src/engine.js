import { LEVELS, RECIPES, TOKENS, getRoom } from './levels.js';

const clone = value => structuredClone(value);
const same = (a, b) => a.x === b.x && a.y === b.y;
const keyOf = item => `${item.x},${item.y}`;
const directions = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const makeFrame = room => ({
  roomId: room.id, snake: [0, 1].map(i => ({ x: room.start[0] - i, y: room.start[1] })),
  tokens: [], fruits: clone(room.fruits), direction: 'right', stones: {}, used: [], switches: [], reset: false,
});
export function matches(tokens, needs) {
  const remaining = [...tokens];
  return needs.every(need => {
    const i = remaining.findIndex(token => need === 'red' ? ['r', 's'].includes(token) : token === need);
    if (i < 0) return false;
    remaining.splice(i, 1);
    return true;
  });
}
export class Garden {
  constructor(level = 0) { this.load(level); }
  load(level) {
    this.level = level;
    this.state = { frame: makeFrame(LEVELS[level]), stack: [], moves: 0, won: false, message: '', event: 'start' };
    this.history = [];
  }
  get room() { return getRoom(this.state.frame.roomId); }
  get ready() { return matches(this.state.frame.tokens, this.room.gate.needs); }
  get fixture() { return this.room.fixtures.find(item => same(item, this.state.frame.snake[0])); }
  get recipe() {
    const tokens = this.state.frame.tokens;
    return Object.values(RECIPES).find(r => r.scroll && tokens.includes(r.scroll) && matches(tokens, r.needs))
      || (matches(tokens, RECIPES.basic.needs) ? RECIPES.basic : null);
  }
  save() { this.history.push(clone(this.state)); }
  say(message, event = 'bump') { this.state.message = message; this.state.event = event; return false; }
  undo() {
    if (!this.history.length) return false;
    this.state = this.history.pop();
    this.state.message = '已撤回。';
    this.state.event = 'undo';
    return true;
  }
  blocked(head) {
    return head.x <= 0 || head.y <= 0 || head.x >= this.room.width - 1 || head.y >= this.room.height - 1
      || this.room.walls.some(([x, y]) => x === head.x && y === head.y)
      || this.room.fixtures.some(item => same(item, head) && item.type === 'shutter' && !this.state.frame.switches.includes(item.channel));
  }
  move(direction) {
    if (this.state.won || !directions[direction]) return false;
    const f = this.state.frame, room = this.room, delta = directions[direction];
    const head = { x: f.snake[0].x + delta[0], y: f.snake[0].y + delta[1] };
    if (this.blocked(head)) return this.say('通路被挡住。');
    const foodIndex = f.fruits.findIndex(food => same(food, head));
    if (foodIndex >= 0 && f.tokens.length >= room.capacity) return this.say('容量已满。', 'full');
    const arriving = room.fixtures.find(item => same(item, head));
    const stored = arriving?.type === 'stone' && f.stones[keyOf(arriving)];
    const loading = (stored && !f.tokens.includes(stored)) || (arriving?.type === 'book' && !f.tokens.includes(RECIPES[arriving.recipe].scroll));
    const growing = foodIndex >= 0 || (loading && f.tokens.length < room.capacity) || f.snake.length < f.tokens.length + 2;
    // Reversing into the neck is never legal, even for a two-cell snake.
    if (same(head, f.snake[1]) || f.snake.slice(0, growing ? undefined : -1).some(part => same(part, head))) return this.say('不能撞上身体。');
    const onGate = same(head, room.gate);
    if (onGate && !this.ready) return this.say('缺少出口要求的果纹。', 'locked');
    this.save();
    this.state.moves++;
    f.direction = direction;
    this.state.event = 'move';
    this.state.message = '';
    if (foodIndex >= 0) {
      const food = f.fruits.splice(foodIndex, 1)[0];
      f.tokens.unshift(food.kind);
      this.state.event = 'eat';
      this.state.message = `已吃下${TOKENS[food.kind].name}。`;
    }
    f.snake = [head, ...f.snake];
    const fixture = room.fixtures.find(item => same(item, head));
    if (fixture) this.touch(fixture);
    f.snake = f.snake.slice(0, f.tokens.length + 2);
    if (onGate) {
      if (room.gate.returns) {
        this.state.frame = this.state.stack.pop();
        this.state.frame.tokens.unshift('v');
        this.state.frame.used.push('pot');
        this.state.message = '已返回，获得一枚花种。';
        this.state.event = 'return';
      } else {
        this.state.won = true;
        this.state.message = '关卡完成。';
        this.state.event = 'win';
      }
    }
    return true;
  }
  touch(at) {
    const f = this.state.frame;
    if (at.type === 'fold') {
      if (f.tokens.filter(t => t === 'r').length < 3) return this.say('石台需要三颗鲜红果。', 'info');
      let removed = 0;
      f.tokens = ['s', ...f.tokens.filter(t => t !== 'r' || removed++ >= 3)];
      this.state.message = '三颗红果已折成一枚红印。'; this.state.event = 'fold';
    } else if (at.type === 'stone') {
      const stored = f.stones[keyOf(at)];
      if (stored) {
        if (f.tokens.includes(stored)) return this.say('石碑中保存的果纹已经在身上。', 'info');
        if (f.tokens.length >= this.room.capacity) return this.say('容量已满，无法读取石碑。', 'full');
        f.tokens.unshift(stored);
        this.state.message = `已从这块石碑读回${TOKENS[stored].name}。`; this.state.event = 'read';
      } else {
        if (!f.tokens.length) return this.say('石碑为空。', 'info');
        f.stones[keyOf(at)] = f.tokens[0];
        this.state.message = `${TOKENS[f.tokens[0]].name}已保存在这块石碑中。`; this.state.event = 'write';
      }
    } else if (at.type === 'reset') {
      f.tokens = []; f.reset = true;
      this.state.message = ''; this.state.event = 'wash';
    } else if (at.type === 'switch') {
      if (!f.switches.includes(at.channel)) f.switches.push(at.channel);
      this.state.message = ''; this.state.event = 'switch';
    } else if (at.type === 'well') {
      if (f.used.includes('well')) return this.say('井已使用，产物在右上方。', 'info');
      const index = f.tokens.indexOf(at.input);
      if (index < 0) return this.say('井需要鲜红果，不能投入红印。', 'lossy');
      f.tokens.splice(index, 1);
      f.fruits.push({ x: at.output[0], y: at.output[1], kind: 'b' }); f.used.push('well');
      this.state.message = '已投入鲜红果，右上方出现月果。'; this.state.event = 'well';
    } else if (at.type === 'book') {
      const recipe = RECIPES[at.recipe];
      if (f.tokens.includes(recipe.scroll)) return this.say('这份配方已经读过。', 'info');
      if (f.tokens.length >= this.room.capacity) return this.say('需要一格空位来读取配方卷。', 'full');
      f.tokens.unshift(recipe.scroll);
      this.state.message = `${recipe.name}：月果 + 金果 → 花种。`; this.state.event = 'learn';

    } else if (at.type === 'pot') {
      if (f.used.includes('pot')) return;
      if (f.tokens.length >= this.room.capacity) return this.say('需要留一格空位接收花种。', 'full');
      f.snake = f.snake.slice(0, f.tokens.length + 2);
      this.state.stack.push(clone(f)); this.state.frame = makeFrame(getRoom('inner'));
      this.state.message = '已进入壶内。'; this.state.event = 'enter';
    } else if (at.type === 'sign') {
      this.state.message = at.text; this.state.event = 'sign';
    }
  }
  generate() {
    if (this.state.won) return false;
    if (!this.room.canGenerate) return this.say('当前没有可用配方。', 'info');
    const f = this.state.frame, recipe = this.recipe;
    if (!recipe) return this.say('当前果纹不符合已知配方。', 'info');
    if (f.tokens.length >= this.room.capacity) return this.say('容量已满，无法加入新的输出。', 'full');
    const before = clone(this.state);
    f.tokens.unshift(recipe.output);
    if (!this.move(f.direction)) {
      const { message, event } = this.state;
      this.state = before;
      return this.say(message, event);
    }
    // Movement and output form a single checkpoint, including automatic fixtures.
    this.history[this.history.length - 1] = before;
    if (['move', 'eat'].includes(this.state.event)) {
      this.state.message = `已输出${TOKENS[recipe.output].name}。`;
      this.state.event = 'generate';
    }
    return true;
  }
}
