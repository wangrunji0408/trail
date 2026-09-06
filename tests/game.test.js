import test from 'node:test';
import assert from 'node:assert/strict';
import { Garden, matches } from '../src/engine.js';
import { LEVELS, INNER } from '../src/levels.js';
import { renderBoard } from '../src/render.js';

const run = (game, sequence) => {
  const directions = { R:'right', L:'left', U:'up', D:'down' };
  for (const key of sequence.replaceAll(' ', '')) {
    const result = key==='X' ? game.generate() : key==='Z' ? game.undo() : game.move(directions[key]);
    assert.equal(result, true, `${game.room.id} at ${JSON.stringify(game.state.frame.snake[0])}, ${key}: ${game.state.message}`);
    assert.ok(game.state.frame.tokens.length <= game.room.capacity);
    assert.equal(new Set(game.state.frame.snake.map(p=>`${p.x},${p.y}`)).size,game.state.frame.snake.length,'Body must not overlap');
    assert.ok(game.state.frame.snake.length <= game.state.frame.tokens.length+2);
  }
};
const innerRoute='UU RRRRRRRR DD';
const resetAndReturn='UU R DD R RR U RRRR DDDD LLLLLL UUU';
const solutions=[
  'RRRRRRRRR',
  'UU RRRRRRRRR DD',
  'RRRRRR UU R DD RRR',
  `${resetAndReturn} L DDD RRRRR UUU RRR`,
  'RRRRR U RR D R UU R DD R',
  'RRRRRRR X DD R',
  'RRRR UU RR DD R X DD R',
  `RRRRR ${innerRoute} RRRR`,
  `RRRR UU R DD R U RRR DDDD LLLL UUU L DDD RRRR UUUU R U ${innerRoute} R DD L D X R D`,
];
for(let i=0;i<LEVELS.length;i++)test(`关卡 ${i+1}「${LEVELS[i].title}」合法通关`,()=>{
  const game=new Garden(i);run(game,solutions[i]);
  assert.equal(game.state.won,true);assert.equal(game.state.stack.length,0);assert.equal(game.ready,true);
  assert.ok(game.history.every(state=>state.event!=='sign'),'默认通关路线不触发提示牌');
});

test('所有角落提示牌都可以通过合法路线抵达',()=>{
  const paths=['UUU L','UUU L','RRRRRR UUUU RRRR','UUU L','RRRRR UUUU RRRRR','UUU L','UUU L','UUU L','RRRR UUUU RR'];
  for(let level=0;level<LEVELS.length;level++){
    const game=new Garden(level);run(game,paths[level]);assert.equal(game.fixture?.type,'sign',LEVELS[level].id);
  }
  const inner=new Garden(7);run(inner,'RRRRR UUU L');assert.equal(inner.fixture?.type,'sign');
});

test('初始蛇身只有相邻的头、尾两格；首次输入立即增长一格',()=>{
  const game=new Garden();assert.deepEqual(game.state.frame.snake,[{x:3,y:5},{x:2,y:5}]);
  run(game,'RRR');assert.equal(game.state.frame.snake.length,3);assert.deepEqual(game.state.frame.tokens,['r']);
});
test('关卡物件位于互不重叠的可行走格子',()=>{
  for(const room of [...LEVELS,INNER]){
    const items=[...room.fruits,...room.fixtures,room.gate];
    assert.equal(new Set(items.map(p=>`${p.x},${p.y}`)).size,items.length,room.id);
    for(const p of items){assert.ok(p.x>0&&p.x<room.width-1&&p.y>0&&p.y<room.height-1);assert.ok(!room.walls.some(([x,y])=>x===p.x&&y===p.y),room.id);}
  }
});
test('门区分颜色与具体物品，并计入重复需求',()=>{
  assert.equal(matches(['s'],['red']),true);assert.equal(matches(['s'],['r']),false);
  assert.equal(matches(['b'],['b','b']),false);assert.equal(matches(['r'],['s']),false);
});
test('容量阻挡不改动物件、蛇身、步数或撤回栈',()=>{
  const game=new Garden(1);run(game,'RRRRRR');const frame=structuredClone(game.state.frame),moves=game.state.moves,history=game.history.length;
  assert.equal(game.move('right'),false);assert.equal(game.state.event,'full');
  assert.deepEqual(game.state.frame,frame);assert.equal(game.state.moves,moves);assert.equal(game.history.length,history);
});
test('第三关可绕过石台行走，但必须主动绕路压缩才能取齐月果',()=>{
  const game=new Garden(2);run(game,'RRRRRRR');assert.deepEqual(game.state.frame.tokens,['r','r','r']);
  assert.equal(game.move('right'),false);assert.equal(game.state.event,'full');
  run(game,'Z UU');const before=structuredClone(game.state);run(game,'R');
  assert.deepEqual(game.state.frame.tokens,['s']);assert.equal(game.state.event,'fold');
  assert.equal(game.state.moves,before.moves+1);run(game,'Z');assert.deepEqual(game.state.frame,before.frame);
});
test('石碑仅在原坐标保存，重置后必须回到原处读回',()=>{
  const game=new Garden(3);run(game,'UU R DD R RR U R');
  assert.deepEqual(game.state.frame.tokens,[]);assert.equal(game.state.frame.snake.length,2);
  assert.deepEqual(game.state.frame.stones,{'5,5':'r'});assert.equal(game.ready,false);assert.equal(game.state.frame.reset,true);
  run(game,'RRR DDDD LLLLLL UU');assert.deepEqual(game.state.frame.tokens,[]);
  const before=structuredClone(game.state.frame);run(game,'U');assert.deepEqual(game.state.frame.tokens,['r']);
  assert.deepEqual(game.state.frame.stones,{'5,5':'r'});run(game,'Z');assert.deepEqual(game.state.frame,before);
});
test('两块石碑不共享储存，第二块不会传送第一块中的物品',()=>{
  const room=LEVELS[3];room.fixtures.push({x:9,y:5,type:'stone'});
  try {const game=new Garden(3);run(game,'UU R DD R RR U RR D');assert.deepEqual(game.state.frame.tokens,[]);assert.deepEqual(game.state.frame.stones,{'5,5':'r'});}
  finally {room.fixtures.pop();}
});
test('回路需右侧开关打开；重置本身不开门，再次经过仍清空',()=>{
  const game=new Garden(3);run(game,'DDD RRRR');assert.equal(game.move('right'),false);assert.equal(game.state.frame.reset,false);
  game.load(3);run(game,'UU R DD R RR U R');assert.deepEqual(game.state.frame.switches,[]);assert.equal(game.blocked({x:8,y:8}),true);
  game.load(3);run(game,resetAndReturn);assert.deepEqual(game.state.frame.switches,['return']);assert.equal(game.blocked({x:8,y:8}),false);assert.deepEqual(game.state.frame.tokens,['r']);
  run(game,'RR U R');assert.deepEqual(game.state.frame.tokens,[]);assert.deepEqual(game.state.frame.stones,{'5,5':'r'});
});
test('踩井即调用，输入被消耗，结果仍留在地图；撤回完整恢复',()=>{
  const game=new Garden(4);run(game,'RRRRR U RR');const before=structuredClone(game.state);run(game,'D');
  assert.equal(game.state.event,'well');assert.deepEqual(game.state.frame.tokens,['r','r']);assert.equal(game.ready,false);
  assert.deepEqual(game.state.frame.fruits,[{x:12,y:3,kind:'b'}]);run(game,'Z');assert.deepEqual(game.state.frame,before.frame);
  run(game,'D R UU R');assert.equal(game.ready,true);
});
test('第五关惯性直走必经折叠块而失败，只有绕行才能投入鲜果',()=>{
  const game=new Garden(4);run(game,'RRRRRRR');assert.deepEqual(game.state.frame.tokens,['s']);
  assert.equal(game.state.event,'lossy');assert.deepEqual(game.state.frame.fruits,[]);
  assert.match(renderBoard(game),/→/);
});
test('提示牌踩上自动显示，离开后不再处于提示牌上，空格无须参与',()=>{
  const game=new Garden();run(game,'UUU L');assert.equal(game.fixture.type,'sign');assert.equal(game.state.event,'sign');
  assert.match(game.state.message,/门.*果纹/);run(game,'D');assert.equal(game.fixture,undefined);assert.equal(game.state.message,'');
});
test('空格输出直接加入蛇身，不消耗原输入，不在地图产生物品',()=>{
  const game=new Garden(5);run(game,'RRRRRRR');const before=structuredClone(game.state.frame);
  run(game,'X');assert.deepEqual(game.state.frame.tokens,['y','b','r']);
  assert.deepEqual(game.state.frame.fruits,[]);assert.equal(game.ready,true);
  assert.deepEqual(game.state.frame.snake[0],{x:before.snake[0].x+1,y:before.snake[0].y});assert.equal(game.state.frame.snake.length,5);
  run(game,'Z');assert.deepEqual(game.state.frame,before);assert.equal(game.ready,false);
  run(game,'X D');assert.equal(game.state.frame.snake.length,5);
});
test('原料不齐时输出无效，只有移动不会自动输出',()=>{
  const game=new Garden(5);assert.equal(game.generate(),false);assert.equal(game.state.moves,0);
  run(game,'RRRRRRRR');assert.deepEqual(game.state.frame.tokens,['b','r']);assert.equal(game.ready,false);
  run(game,'X');assert.equal(game.ready,true);
});
test('输出占用容量，满容量不能再输出',()=>{
  const game=new Garden(5);run(game,'RRRRRRR X');const before=structuredClone(game.state.frame);
  assert.equal(game.generate(),false);assert.equal(game.state.event,'full');assert.deepEqual(game.state.frame,before);
});
test('输出前进受墙阻挡时完全回滚，输出与移动共用一步撤回',()=>{
  const game=new Garden(5);run(game,'RRRRRRR UUUU');
  const before=structuredClone(game.state),history=game.history.length;
  assert.equal(game.generate(),false);assert.deepEqual(game.state.frame,before.frame);
  assert.equal(game.state.moves,before.moves);assert.equal(game.history.length,history);
  game.load(5);run(game,'RRRRRRR');const frame=structuredClone(game.state.frame),moves=game.state.moves;
  run(game,'X');assert.equal(game.state.moves,moves+1);run(game,'Z');assert.deepEqual(game.state.frame,frame);
});
test('空格生成后进入出口，在同一步完成验收',()=>{
  const game=new Garden(5);run(game,'RRRRRRR DD R');assert.equal(game.ready,false);
  run(game,'X');assert.equal(game.state.won,true);assert.deepEqual(game.state.frame.snake[0],{x:12,y:7});
  run(game,'Z');assert.equal(game.state.won,false);assert.ok(!game.state.frame.tokens.includes('y'));
});
test('只有读取书卷才启用配方，书卷与输出都占容量',()=>{
  const game=new Garden(6);run(game,'RRRR');assert.equal(game.recipe,null);assert.equal(game.generate(),false);
  assert.deepEqual(game.state.frame.tokens,['y','b']);assert.equal(game.ready,false);
  run(game,'U');const before=structuredClone(game.state.frame);run(game,'U');
  assert.equal(game.state.event,'learn');assert.deepEqual(game.state.frame.tokens,['k','y','b']);assert.equal(game.recipe.output,'v');
  run(game,'Z');assert.deepEqual(game.state.frame,before);assert.equal(game.recipe,null);
  run(game,'U X R');assert.deepEqual(game.state.frame.tokens,['v','k','y','b']);assert.equal(game.state.frame.snake.length,6);assert.equal(game.ready,true);
});
test('满容量不能读取书卷，重复读取不重复占格',()=>{
  const game=new Garden(6);run(game,'RRRR U');game.state.frame.tokens.push('r','r');run(game,'U');
  assert.equal(game.state.event,'full');assert.ok(!game.state.frame.tokens.includes('k'));
  game.load(6);run(game,'RRRR UU RR UU LL DD');assert.equal(game.state.frame.tokens.filter(t=>t==='k').length,1);
});
test('踩陶壶自动进入，壶内初始两格，返回仅追加花种且能跨房间撤回',()=>{
  const game=new Garden(7);run(game,'RRRR');run(game,'R');const parent=structuredClone(game.state.stack[0]);
  assert.equal(game.state.frame.snake.length,2);assert.deepEqual(game.state.frame.tokens,[]);assert.deepEqual(game.state.stack[0],parent);
  run(game,innerRoute);assert.equal(game.state.stack.length,0);assert.deepEqual(game.state.frame.tokens,['v','r']);assert.deepEqual(game.state.frame.snake,parent.snake);
  run(game,'Z');assert.equal(game.room.id,'inner');assert.equal(game.state.stack.length,1);run(game,'D');assert.deepEqual(game.state.frame.tokens,['v','r']);
});
test('重来清除储物和侧路状态；通关不会自动跳关',()=>{
  const game=new Garden(3);run(game,resetAndReturn);game.load(3);assert.deepEqual(game.state.frame.stones,{});assert.deepEqual(game.state.frame.switches,[]);assert.equal(game.state.frame.reset,false);
  game.load(0);assert.equal(game.move('left'),false);run(game,solutions[0]);assert.equal(game.level,0);assert.equal(game.move('up'),false);run(game,'Z');assert.equal(game.state.won,false);
});
