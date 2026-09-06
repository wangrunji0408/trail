const line = (x1, y1, x2, y2) => Array.from({ length: Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) + 1 }, (_, i) => [x1 + Math.sign(x2 - x1) * i, y1 + Math.sign(y2 - y1) * i]);
const corridor = [...line(1, 4, 8, 4), ...line(1, 6, 8, 6)];
const fruit = (x, y, kind) => ({ x, y, kind });
const fixture = (x, y, type, extra = {}) => ({ x, y, type, ...extra });
const room = (data) => ({ width: 15, height: 11, start: [3, 5], capacity: 3, walls: [], fruits: [], fixtures: [], ...data });

export const TOKENS = {
  r: { name: '红果', color: '#cc7059', glyph: '●' },
  b: { name: '月果', color: '#6e9da8', glyph: '☾' },
  y: { name: '金果', color: '#c5a451', glyph: '◆' },
  s: { name: '红印', color: '#b66758', glyph: '✿' },
  v: { name: '花种', color: '#a18ab0', glyph: '✧' },
};

export const INNER = room({
  id: 'inner', title: '壶中的庭院', subtitle: '小小的地方，也有自己的天空。', capacity: 2,
  fruits: [fruit(5, 3, 'b'), fruit(9, 3, 'y')],
  walls: [[7, 4], [7, 5], [7, 6], [5, 7], [9, 7]],
  gate: { x: 11, y: 5, needs: ['b', 'y'], returns: true },
  objective: '带着月果与金果，走入壶中的光。',
  hints: ['外面的长蛇留在了壶口。这里是一条新的小蛇。', '取到两种果子，走进右侧的光门。', '向上两格，沿上方取两颗果子，再绕到右侧光门。'],
  epigraph: '你不必带回整座花园。',
});

export const LEVELS = [
  room({ id: 'first', title: '初尝', subtitle: '你走过的，都会成为你的一部分。', capacity: 4,
    fruits: [fruit(6, 5, 'r')], walls: [[4, 2], [5, 2], [9, 3], [9, 4], [5, 8], [10, 8], [11, 8]],
    gate: { x: 12, y: 5, needs: ['red'] }, objective: '吃下红果，走进与它同色的门。',
    hints: ['轻按方向键，蛇才会前进一步。不用着急。', '果子不会消失，它会变成身上的一枚果纹。', '沿着中间的小路，一直向右走。'],
    epigraph: '门认得你身上的颜色。', discovery: '门认得的，是你此刻带着的东西。',
  }),
  room({ id: 'enough', title: '恰好', subtitle: '花园很大，而你不必吃下所有。', capacity: 2,
    fruits: [fruit(6, 3, 'r'), fruit(10, 3, 'b'), fruit(6, 5, 'y'), fruit(8, 5, 'y'), fruit(10, 5, 'y')],
    walls: [[5, 7], [6, 7], [9, 7]], gate: { x: 12, y: 5, needs: ['red', 'b'] },
    objective: '身上只能留两枚果纹。门需要哪两枚？',
    hints: ['先看看门上的两种纹样。金色很美，却不在其中。', '上面的小路上，有红果与月果。', '向上两格，向右九格，再向下两格。走错了可以按 Z。'],
    epigraph: '有时候，少带一点，才能走得更远。', discovery: '不是每一颗果子，都值得占据一片鳞。',
  }),
  room({ id: 'fold', title: '折叠', subtitle: '三颗果子的故事，可以短一点。', capacity: 3,
    walls: [...line(1, 4, 13, 4), ...line(1, 6, 13, 6)],
    fruits: [fruit(4, 5, 'r'), fruit(6, 5, 'r'), fruit(8, 5, 'r'), fruit(11, 5, 'b'), fruit(12, 5, 'b')],
    fixtures: [fixture(10, 5, 'fold')], gate: { x: 13, y: 5, needs: ['red', 'b', 'b'] },
    objective: '把红果带到花形石台，再按空格。',
    hints: ['前面的两颗月果也需要位置。', '花形石台能把三颗红果折成一枚红印。红色依然在。', '走到花形石台，按空格，再继续向右。'],
    epigraph: '形状变小了，颜色还在。', discovery: '三颗红果折成一枚红印，腾出了两片鳞。',
  }),
  room({ id: 'stone', title: '石头记得', subtitle: '有些东西，不一定要带在身上。', capacity: 3,
    walls: [...line(7, 1, 7, 4), ...line(7, 6, 7, 9)], fruits: [fruit(4, 3, 'r')],
    fixtures: [fixture(5, 5, 'stone'), fixture(7, 5, 'veil'), fixture(9, 5, 'stone')],
    gate: { x: 12, y: 5, needs: ['red'] }, objective: '穿过白色的雨，把红色带到另一边。',
    hints: ['白雨会洗掉所有果纹。两块石碑却有同一道裂纹。', '带着红果站上左侧石碑，按空格留下刻印。', '穿过白雨后，站上右侧石碑，按空格读回刻印，再去门口。'],
    epigraph: '雨洗过鳞片，没有洗过石头。', discovery: '你已经忘了，石头却还记得。再读一次就好。',
  }),
  room({ id: 'well', title: '井的另一端', subtitle: '向世界投下一颗果子，等一个回答。', capacity: 3,
    walls: corridor, fruits: [fruit(4, 5, 'r'), fruit(6, 5, 'r'), fruit(8, 5, 'r')],
    fixtures: [fixture(9, 5, 'fold'), fixture(10, 5, 'well', { input: 'r', output: [12, 3] })],
    gate: { x: 13, y: 5, needs: ['b'] }, objective: '井要一颗鲜红果。它会在别处送回月果。',
    hints: ['井边刻着：红果 → 月果。红印没有鲜果的汁液。', '站上井口按空格，再去右上角看看。', '如果已经折叠了红果，按 Z 撤回。投果后向上两格、向右两格取月果，再去门口。'],
    epigraph: '知道果子的颜色，不等于还握着果子。', discovery: '红印留住了颜色，却丢了汁液。井的回答，也要亲自拾起。',
  }),
  room({ id: 'vessel', title: '壶中天地', subtitle: '一座花园，也可以装在另一座花园里。', capacity: 3,
    fruits: [fruit(6, 5, 'r')], fixtures: [fixture(8, 5, 'pot')],
    walls: [[5, 2], [6, 2], [10, 7], [10, 8]], gate: { x: 12, y: 5, needs: ['red', 'v'] },
    objective: '进入陶壶，替外面的自己带回一枚花种。',
    hints: ['带着红果站上陶壶，按空格。', '壶里有另一条小蛇。外面的蛇会留在原地等候。', '在壶里收集两种果子并走入光门。回到外面后继续向右。'],
    epigraph: '留下一条长长的自己，派一个小小的自己出发。', discovery: '带回一枚花种就够了。壶里的每一步，可以留在壶里。',
  }),
  room({ id: 'garden', title: '花园深处', subtitle: '你已经知道，怎样走过漫长的路。', capacity: 3,
    walls: [...line(1, 4, 7, 4), ...line(1, 6, 7, 6), ...line(10, 1, 10, 4), ...line(10, 6, 10, 9)],
    fruits: [fruit(4, 5, 'r'), fruit(5, 5, 'r'), fruit(7, 5, 'r'), fruit(11, 7, 'b')],
    fixtures: [fixture(8, 5, 'fold'), fixture(9, 5, 'stone'), fixture(10, 5, 'veil'), fixture(12, 5, 'stone'), fixture(12, 3, 'pot')],
    gate: { x: 13, y: 8, needs: ['s', 'v', 'b'] }, objective: '让红印、花种与月果，一起抵达最后的门。',
    hints: ['路上的每一种东西，你都已经见过。', '先折起红色，刻在石头上，再穿过白雨。', '读回红印，进壶取得花种，再吃下右下方的月果。三枚果纹，刚刚好。'],
    epigraph: '路很长。你不必一直很长。', discovery: '你带着的很少。你走过的很远。',
  }),
];

export function getRoom(id) { return id === 'inner' ? INNER : LEVELS.find(level => level.id === id); }
