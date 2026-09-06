const line = (x1, y1, x2, y2) => Array.from({ length: Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) + 1 }, (_, i) => [x1 + Math.sign(x2 - x1) * i, y1 + Math.sign(y2 - y1) * i]);
const fruit = (x, y, kind) => ({ x, y, kind });
const fixture = (x, y, type, extra = {}) => ({ x, y, type, ...extra });
const sign = (x, y, text) => fixture(x, y, 'sign', { text });
const room = data => ({ width: 15, height: 11, start: [3, 5], capacity: 3, walls: [], fruits: [], fixtures: [], ...data });
const divider = x => [...line(x, 1, x, 3), ...line(x, 5, x, 7), [x, 9]];

export const TOKENS = {
  r: { name: '红果', color: '#cc7059', glyph: '●' },
  b: { name: '月果', color: '#6e9da8', glyph: '☾' },
  y: { name: '金果', color: '#c5a451', glyph: '◆' },
  s: { name: '红印', color: '#b66758', glyph: '✿' },
  v: { name: '花种', color: '#a18ab0', glyph: '✧' },
  k: { name: '花种卷', color: '#95825e', glyph: '▤' },
};
export const RECIPES = {
  basic: { name: '金果', needs: ['red', 'b'], output: 'y' },
  bloom: { name: '花种卷', needs: ['b', 'y'], output: 'v', scroll: 'k' },
};

export const INNER = room({
  id: 'inner', title: '壶内', capacity: 2,
  fruits: [fruit(5, 3, 'b'), fruit(9, 3, 'y')],
  walls: [[7, 4], [7, 5], [7, 6], [5, 7], [9, 7]],
  fixtures: [sign(2, 2, '壶里的果纹留在壶里，只有花种带回。')],
  gate: { x: 11, y: 5, needs: ['b', 'y'], returns: true },
  objective: '带月果和金果到出口。',
});

export const LEVELS = [
  room({ id: 'first', title: '初尝', capacity: 4,
    fruits: [fruit(6, 5, 'r')], walls: [[4, 2], [5, 2], [9, 3], [9, 4], [5, 8], [10, 8], [11, 8]],
    fixtures: [sign(2, 2, '门只检查蛇身上的果纹。')],
    gate: { x: 12, y: 5, needs: ['red'] }, objective: '带红果到出口。',
  }),
  room({ id: 'enough', title: '恰好', capacity: 2,
    fruits: [fruit(6, 3, 'r'), fruit(10, 3, 'b'), fruit(6, 5, 'y'), fruit(8, 5, 'y'), fruit(10, 5, 'y')],
    fixtures: [sign(2, 2, '每颗果子都占一格，包括门不需要的。')],
    walls: [[5, 7], [6, 7], [9, 7]], gate: { x: 12, y: 5, needs: ['red', 'b'] },
    objective: '带红果和月果到出口。',
  }),
  room({ id: 'fold', title: '折叠', capacity: 3,
    walls: [...line(1, 4, 8, 4), ...line(1, 6, 8, 6)],
    fruits: [fruit(4, 5, 'r'), fruit(6, 5, 'r'), fruit(8, 5, 'r'), fruit(11, 5, 'b'), fruit(12, 5, 'b')],
    fixtures: [fixture(10, 3, 'fold'), sign(13, 1, '红印保留了三颗红果的颜色，只占一格。')],
    gate: { x: 13, y: 5, needs: ['red', 'b', 'b'] }, objective: '带红色与两枚月果到出口。',
  }),
  room({ id: 'stone', title: '储物', capacity: 3,
    walls: divider(8), fruits: [fruit(4, 3, 'r')],
    fixtures: [fixture(5, 5, 'stone'), fixture(8, 4, 'reset'), fixture(8, 8, 'shutter', { channel: 'return' }), fixture(11, 7, 'switch', { channel: 'return' }),
      sign(2, 2, '石碑中的物品，不会随蛇身一起消失。')],
    gate: { x: 12, y: 5, needs: ['red'] }, objective: '带红果到出口。',
  }),
  room({ id: 'well', title: '水井', capacity: 3,
    walls: [...line(1, 4, 7, 4), ...line(1, 6, 7, 6)],
    fruits: [fruit(4, 5, 'r'), fruit(6, 5, 'r'), fruit(8, 5, 'r')],
    fixtures: [fixture(9, 5, 'fold'), fixture(10, 5, 'well', { input: 'r', output: [12, 3] }),
      sign(13, 1, '红印保留颜色，却不能代替鲜果。')],
    gate: { x: 13, y: 5, needs: ['b'] }, objective: '取回井产出的月果，带到出口。',
  }),
  room({ id: 'produce', title: '新果', capacity: 3, canGenerate: true,
    fruits: [fruit(5, 5, 'r'), fruit(7, 5, 'b')],
    fixtures: [sign(2, 2, '新果来自已有果纹；生成不会消耗原料。')],
    gate: { x: 12, y: 7, needs: ['y'] },
    objective: '带金果到出口。',
  }),
  room({ id: 'scroll', title: '配方卷', capacity: 4, canGenerate: true,
    fruits: [fruit(5, 5, 'b'), fruit(7, 5, 'y')],
    fixtures: [sign(2, 2, '卷名不是配方。读过的书卷也占一格。'), fixture(7, 3, 'book', { recipe: 'bloom' })],
    gate: { x: 12, y: 7, needs: ['v'] },
    objective: '带花种到出口。',
  }),
  room({ id: 'vessel', title: '陶壶', capacity: 3,
    fruits: [fruit(6, 5, 'r')], fixtures: [fixture(8, 5, 'pot'), sign(2, 2, '壶内和壶外，各有一条蛇。')],
    walls: [[5, 2], [6, 2], [10, 7], [10, 8]], gate: { x: 12, y: 5, needs: ['red', 'v'] },
    objective: '带红色和壶内的花种到出口。',
  }),
  room({ id: 'garden', title: '组合', capacity: 4, canGenerate: true,
    walls: [...line(1, 4, 6, 4), ...line(1, 6, 6, 6), ...divider(10)],
    fruits: [fruit(4, 5, 'r'), fruit(5, 5, 'r'), fruit(6, 5, 'r'), fruit(11, 7, 'b')],
    fixtures: [fixture(7, 3, 'fold'), fixture(8, 5, 'stone'), fixture(10, 4, 'reset'), fixture(10, 8, 'shutter', { channel: 'return' }), fixture(12, 8, 'switch', { channel: 'return' }),
      fixture(12, 3, 'pot'),
      sign(9, 1, '新生成的果纹，也能成为下一次生成的材料。')],
    gate: { x: 13, y: 8, needs: ['s', 'v', 'y'] },
    objective: '带红印、花种和金果到出口。',
  }),
];

export function getRoom(id) { return id === 'inner' ? INNER : LEVELS.find(level => level.id === id); }
