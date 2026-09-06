import test from 'node:test';
import assert from 'node:assert/strict';
import { Garden, matches } from '../src/engine.js';
import { LEVELS, INNER } from '../src/levels.js';

const run = (game, sequence) => {
  const directions = { R: 'right', L: 'left', U: 'up', D: 'down' };
  for (const key of sequence.replaceAll(' ', '')) {
    const result = key === 'X' ? game.interact() : key === 'Z' ? game.undo() : game.move(directions[key]);
    assert.equal(result, true, `${game.room.id} at ${JSON.stringify(game.state.frame.snake[0])}, ${key}: ${game.state.message}`);
    assert.ok(game.state.frame.tokens.length <= game.room.capacity);
    assert.equal(new Set(game.state.frame.snake.map(p=>`${p.x},${p.y}`)).size, game.state.frame.snake.length, 'The snake cannot overlap itself');
  }
};
const innerRoute = 'UU RRRRRRRR DD';
const solutions = [
  'RRRRRRRRR',
  'UU RRRRRRRRR DD',
  'RRRRRRR X RRR',
  'UU R DD R X RRRR X RRR',
  'RRRRRRR X UU RR DD R',
  `RRRRR X ${innerRoute} RRRR`,
  `RRRRR X R X RRR X UU X ${innerRoute} R DDDD LL D RR`,
];

for(let i=0;i<LEVELS.length;i++) test(`庭院 ${i+1}「${LEVELS[i].title}」can be solved with legal moves`,()=>{
  const game = new Garden(i);
  run(game, solutions[i]);
  assert.equal(game.state.won, true);
  assert.equal(game.state.stack.length, 0);
  assert.equal(game.ready, true);
});

test('All level objects are on distinct walkable interior tiles',()=>{
  for(const room of [...LEVELS,INNER]){
    const items=[...room.fruits,...room.fixtures,room.gate];
    const positions=items.map(p=>`${p.x},${p.y}`);
    assert.equal(new Set(positions).size,positions.length,room.id);
    for(const p of items){
      assert.ok(p.x>0&&p.x<room.width-1&&p.y>0&&p.y<room.height-1,room.id);
      assert.ok(!room.walls.some(([x,y])=>x===p.x&&y===p.y),room.id);
    }
  }
});
test('Gate checks consume matching symbols and distinguish essence from exact fruit',()=>{
  assert.equal(matches(['s'],['red']),true);
  assert.equal(matches(['s'],['r']),false);
  assert.equal(matches(['b'],['b','b']),false);
  assert.equal(matches(['r'],['s']),false);
});
test('Unnecessary food fills the finite body; failed moves are atomic',()=>{
  const game=new Garden(1);run(game,'RRRRRR');
  const frame=structuredClone(game.state.frame),moves=game.state.moves,history=game.history.length;
  assert.equal(game.move('right'),false);
  assert.equal(game.state.event,'full');
  assert.deepEqual(game.state.frame,frame);
  assert.equal(game.state.moves,moves);
  assert.equal(game.history.length,history);
  run(game,'Z');assert.equal(game.state.moves,moves-1);
});
test('Folding creates room while preserving red, and is fully undoable',()=>{
  const game=new Garden(2);run(game,'RRRRRRR');
  const before=structuredClone(game.state);
  assert.equal(game.move('right'),false);
  run(game,'X');assert.deepEqual(game.state.frame.tokens,['s']);assert.equal(matches(game.state.frame.tokens,['red']),true);
  run(game,'Z');assert.deepEqual(game.state.frame,before.frame);
});
test('Stone persists through the veil and must be explicitly read back',()=>{
  const game=new Garden(3);run(game,'UU R DD R X RR');
  assert.deepEqual(game.state.frame.tokens,[]);
  assert.equal(game.state.frame.stone,'r');
  assert.equal(game.ready,false);
  run(game,'RR X');assert.equal(game.ready,true);
  run(game,'Z');assert.deepEqual(game.state.frame.tokens,[]);
  assert.equal(game.state.frame.stone,'r');
});
test('A compressed seal cannot replace fresh fruit in the well',()=>{
  const game=new Garden(4);run(game,'RRRRRR X R');
  assert.deepEqual(game.state.frame.tokens,['s']);
  assert.equal(game.interact(),false);
  assert.equal(game.state.event,'lossy');
  assert.equal(game.state.frame.fruits.length,0);
  assert.equal(game.ready,false);
});
test('Well changes the world; the answer is not known until collected',()=>{
  const game=new Garden(4);run(game,'RRRRRRR X');
  assert.equal(game.ready,false);
  assert.deepEqual(game.state.frame.tokens,['r','r']);
  assert.deepEqual(game.state.frame.fruits,[{x:12,y:3,kind:'b'}]);
  run(game,'Z');assert.deepEqual(game.state.frame.tokens,['r','r','r']);assert.deepEqual(game.state.frame.fruits,[]);
  run(game,'X UU RR');assert.equal(game.ready,true);
});
test('Entering a pot suspends the parent, uses a fresh body, and only returns a seed',()=>{
  const game=new Garden(5);run(game,'RRRRR');const parent=structuredClone(game.state.frame);
  run(game,'X');assert.deepEqual(game.state.frame.tokens,[]);assert.deepEqual(game.state.stack[0],parent);
  run(game,innerRoute);assert.equal(game.state.stack.length,0);assert.deepEqual(game.state.frame.tokens,['v','r']);
  assert.deepEqual(game.state.frame.snake,parent.snake);assert.deepEqual(game.state.frame.fruits,parent.fruits);
  run(game,'Z');assert.equal(game.room.id,'inner');assert.equal(game.state.stack.length,1);assert.deepEqual(game.state.frame.tokens,['y','b']);
  run(game,'D');assert.deepEqual(game.state.frame.tokens,['v','r']);
});
test('Restart inside a pot resets the whole current garden',()=>{
  const game=new Garden(5);run(game,'RRRRR X UU');game.load(5);
  assert.equal(game.state.stack.length,0);assert.equal(game.room.id,'vessel');assert.equal(game.state.moves,0);assert.equal(game.history.length,0);
});
test('Walls, the neck, and unprepared exits cannot be crossed',()=>{
  const game=new Garden();assert.equal(game.move('left'),false);run(game,'UUUU');assert.equal(game.move('up'),false);
  run(game,'RRRRRRRRR DDD');assert.equal(game.move('down'),false);assert.equal(game.state.event,'locked');
});
test('Completion is explicit, undoable, and does not auto-advance',()=>{
  const game=new Garden();run(game,solutions[0]);assert.equal(game.level,0);assert.equal(game.move('up'),false);run(game,'Z');assert.equal(game.state.won,false);run(game,'R');assert.equal(game.state.won,true);
});
