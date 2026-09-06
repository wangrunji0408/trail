import { LEVELS, getRoom } from './levels.js';

const clone = value => structuredClone(value);
const same = (a, b) => a.x === b.x && a.y === b.y;
const makeFrame = room => ({
  roomId: room.id, snake: [0, 1, 2].map(i => ({ x: room.start[0] - i, y: room.start[1] })),
  tokens: [], fruits: clone(room.fruits), direction: 'right', stone: null, used: [],
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
    this.state = { frame: makeFrame(LEVELS[level]), stack: [], moves: 0, won: false, message: LEVELS[level].subtitle, event: 'start' };
    this.history = [];
  }
  get room() { return getRoom(this.state.frame.roomId); }
  get ready() { return matches(this.state.frame.tokens, this.room.gate.needs); }
  get fixture() { return this.room.fixtures.find(item => same(item, this.state.frame.snake[0])); }
  save() { this.history.push(clone(this.state)); }
  say(message, event = 'bump') { this.state.message = message; this.state.event = event; return false; }
  undo() {
    if (!this.history.length) return false;
    this.state = this.history.pop();
    this.state.message = '退回一步。花园愿意等你。';
    this.state.event = 'undo';
    return true;
  }
  move(direction) {
    if (this.state.won) return false;
    const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
    if (!delta) return false;
    const f = this.state.frame, room = this.room;
    const head = { x: f.snake[0].x + delta[0], y: f.snake[0].y + delta[1] };
    if (head.x <= 0 || head.y <= 0 || head.x >= room.width - 1 || head.y >= room.height - 1 || room.walls.some(([x, y]) => x === head.x && y === head.y)) return this.say('这里是石墙。试试另一条路。');
    const foodIndex = f.fruits.findIndex(food => same(food, head));
    if (foodIndex >= 0 && f.tokens.length >= room.capacity) return this.say('鳞片已经满了。先想想，要留下什么。', 'full');
    const growing = foodIndex >= 0 || f.snake.length < f.tokens.length + 3;
    if (f.snake.slice(0, growing ? undefined : -1).some(part => same(part, head))) return this.say('尾巴还在这里。绕一下，或按 Z 退回。');
    const onGate = same(head, room.gate);
    if (onGate && !this.ready) return this.say('门轻轻摇头。看看门上的纹样。', 'locked');
    this.save();
    this.state.moves++;
    f.direction = direction;
    this.state.event = 'move';
    this.state.message = '';
    if (foodIndex >= 0) {
      f.tokens.unshift(f.fruits.splice(foodIndex, 1)[0].kind);
      this.state.event = 'eat';
      this.state.message = '一颗果子，变成了一枚果纹。';
    }
    f.snake = [head, ...f.snake].slice(0, f.tokens.length + 3);
    const fixture = room.fixtures.find(item => same(item, head));
    if (fixture?.type === 'veil') {
      f.tokens = [];
      f.snake = f.snake.slice(0, 3);
      this.state.event = 'wash';
      this.state.message = '白雨洗掉了所有果纹。石头上的刻印还在。';
    }
    if (onGate) {
      if (room.gate.returns) {
        this.state.frame = this.state.stack.pop();
        this.state.frame.tokens.unshift('v');
        this.state.frame.used.push('pot');
        this.state.message = '回来了。只带回一枚花种，外面的红色依然在。';
        this.state.event = 'return';
      } else {
        this.state.won = true;
        this.state.message = LEVELS[this.level].discovery;
        this.state.event = 'win';
      }
    }
    return true;
  }
  interact() {
    if (this.state.won) return false;
    const at = this.fixture, f = this.state.frame;
    if (!at) return this.say('走到石台、石碑、井或陶壶上，再按空格。', 'info');
    if (at.type === 'fold') {
      if (f.tokens.filter(t => t === 'r').length < 3) return this.say('石台需要三颗鲜红果，才能折出一枚红印。');
      this.save();
      let removed = 0;
      f.tokens = ['s', ...f.tokens.filter(t => t !== 'r' || removed++ >= 3)];
      f.snake = f.snake.slice(0, f.tokens.length + 3);
      this.state.message = '三颗红果，折成一枚红印。颜色还在，鳞片空了。';
      this.state.event = 'fold';
    } else if (at.type === 'stone') {
      if (f.stone && f.tokens.includes(f.stone)) return this.say('刻印已经在身上了。石碑安静地亮着。', 'info');
      if (f.stone) {
        if (f.tokens.length >= this.room.capacity) return this.say('没有空鳞片来读回刻印了。', 'full');
        this.save(); f.tokens.unshift(f.stone);
        this.state.message = '摸一摸旧刻痕，熟悉的颜色又回到了身上。'; this.state.event = 'read';
      } else {
        if (!f.tokens.length) return this.say('石碑是空的。先带一枚果纹过来。');
        this.save(); f.stone = f.tokens[0];
        this.state.message = '最近的一枚果纹，刻进了两块相连的石头。'; this.state.event = 'write';
      }
    } else if (at.type === 'well') {
      if (f.used.includes('well')) return this.say('井已经回应了。去右上方拾起它送来的月果。', 'info');
      const index = f.tokens.indexOf(at.input);
      if (index < 0) return this.say('井需要鲜红果。红印虽然是红色，却没有汁液。按 Z 可以退回。', 'lossy');
      this.save(); f.tokens.splice(index, 1); f.snake = f.snake.slice(0, f.tokens.length + 3);
      f.fruits.push({ x: at.output[0], y: at.output[1], kind: 'b' }); f.used.push('well');
      this.state.message = '咚。井收下鲜果，在右上方送来一颗月果。去看看。'; this.state.event = 'well';
    } else if (at.type === 'pot') {
      if (f.used.includes('pot')) return this.say('这只壶的花种已经带回来了。', 'info');
      if (f.tokens.length >= this.room.capacity) return this.say('先留出一片空鳞，装下要带回来的花种。', 'full');
      this.save(); this.state.stack.push(clone(f)); this.state.frame = makeFrame(getRoom('inner'));
      this.state.message = '你变成了一条小蛇。长长的自己，在壶外等你。'; this.state.event = 'enter';
    } else return this.say('白雨不说话，只轻轻落下。', 'info');
    this.state.moves++;
    return true;
  }
}
