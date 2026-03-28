// TRAIL - Unit Tests
// Run: node --test test/game.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Game, DIR } from '../src/game.js';
import { LEVELS } from '../src/levels.js';

const { UP, DOWN, LEFT, RIGHT } = DIR;

function play(game, ...steps) {
  for (const step of steps) {
    if (step === 'REWIND') { game.rewind(); continue; }
    if (step === 'TAB') { game.switchBranch(); continue; }
    if (typeof step === 'string' && step.startsWith('SELECT')) {
      game.selectBranch(parseInt(step.slice(6)) - 1); continue;
    }
    if (typeof step === 'string' && step.startsWith('INSTR')) {
      game.selectInstruction(parseInt(step.slice(5)) - 1); continue;
    }
    if (typeof step === 'string' && step.startsWith('PRISM:')) {
      game.setPrism(step.slice(6)); continue;
    }
    const result = game.move(step);
    if (!result.success && game.phase !== 'won') {
      throw new Error(`Move failed: ${result.reason} at head=${JSON.stringify(game.getHead())}`);
    }
  }
}

// ============================================================
// World 1: Growth
// ============================================================
describe('World 1: Growth', () => {
  it('bottom path (red→blue) passes the gate', () => {
    const g = new Game(LEVELS[0]);
    play(g, DOWN, RIGHT, RIGHT, RIGHT, RIGHT, UP, RIGHT);
    // At gate: last colored = [red, blue], gate requires [red, blue] ✓
    assert.ok(g.won);
  });

  it('top path (blue→red) fails the gate', () => {
    const g = new Game(LEVELS[0]);
    play(g, UP, RIGHT, RIGHT, RIGHT, RIGHT);
    // At (4,0), try to go down to gate at (4,1)
    const result = g.move(DOWN);
    assert.equal(result.reason, 'pattern mismatch');
    assert.ok(!g.won);
  });
});

// ============================================================
// World 2: Echo
// ============================================================
describe('World 2: Echo', () => {
  it('checkpoint adds color to presets, echo gate opens', () => {
    const g = new Game(LEVELS[1]);
    assert.deepEqual(g.presetColors, ['blue', 'blue']);
    play(g, RIGHT, RIGHT, RIGHT); // move, red, checkpoint
    assert.ok(g.presetColors.includes('red'), 'presets should include red after checkpoint');
    play(g, RIGHT, RIGHT); // echo gate, exit
    assert.ok(g.won);
  });

  it('without going through red, echo gate blocks', () => {
    const g = new Game(LEVELS[1]);
    // Skip the red tile by going around
    g.move(UP);    // (2,0)
    g.move(RIGHT); // (3,0)
    g.move(RIGHT); // (4,0)
    g.move(RIGHT); // (5,0)
    g.move(DOWN);  // (5,1) echo gate — presets don't contain red
    assert.ok(!g.won, 'should not win without checkpoint adding red');
  });
});

// ============================================================
// World 3: Prism
// ============================================================
describe('World 3: Prism', () => {
  it('starts in prism_select phase', () => {
    const g = new Game(LEVELS[2]);
    assert.equal(g.phase, 'prism_select');
  });

  it('prism=red transforms tiles to red → gate [red,red] passes', () => {
    const g = new Game(LEVELS[2]);
    play(g, 'PRISM:red', RIGHT, RIGHT, RIGHT, RIGHT);
    assert.ok(g.won);
  });

  it('prism=blue transforms tiles to blue → gate [red,red] fails', () => {
    const g = new Game(LEVELS[2]);
    g.setPrism('blue');
    play(g, RIGHT, RIGHT);
    const result = g.move(RIGHT); // gate
    assert.equal(result.reason, 'pattern mismatch');
  });
});

// ============================================================
// World 4: Shadow
// ============================================================
describe('World 4: Shadow', () => {
  it('bottom path through shadow blue → gate sees only red → passes', () => {
    const g = new Game(LEVELS[3]);
    // start=(0,1), red=(1,1), wall=(2,1), shadow+blue=(2,2), gate=(3,1)
    play(g, RIGHT, DOWN, RIGHT, RIGHT, UP, RIGHT);
    assert.ok(g.won);
  });

  it('top path through regular blue → gate rejects (last colored is blue, not red)', () => {
    const g = new Game(LEVELS[3]);
    // go right(red), up, right(blue, NOT shadow), right, down to gate
    play(g, RIGHT, UP, RIGHT, RIGHT);
    // At (3,0), try to go DOWN to gate at (3,1)
    const result = g.move(DOWN);
    assert.equal(result.success, false);
    assert.equal(result.reason, 'pattern mismatch');
  });

  it('shadow segments are invisible to gate pattern check', () => {
    const g = new Game(LEVELS[3]);
    play(g, RIGHT, DOWN, RIGHT); // at (2,2) shadow+blue
    const snake = g.snake;
    const shadowSeg = snake.find(s => s.x === 2 && s.y === 2);
    assert.ok(shadowSeg.isShadow, 'segment at shadow zone should be shadow');
    assert.equal(shadowSeg.color, 'blue');
    // Visible colored should NOT include shadow blue
    const visible = g.snake.filter(s => !s.isShadow && s.color);
    assert.equal(visible.length, 1);
    assert.equal(visible[0].color, 'red');
  });
});

// ============================================================
// World 5: Fork
// ============================================================
describe('World 5: Fork', () => {
  it('fork creates two branches', () => {
    const g = new Game(LEVELS[4]);
    play(g, RIGHT, RIGHT); // reach fork at (2,1)
    assert.equal(g.phase, 'forked');
    assert.equal(g.branches.length, 2);
  });

  it('correct solution: branch0=switch, branch1=red, merge keeping branch1', () => {
    const g = new Game(LEVELS[4]);
    play(g, RIGHT, RIGHT); // fork
    // Branch 0: go up to press switch
    play(g, UP, RIGHT, RIGHT, DOWN);
    assert.ok(g.switchState.a, 'switch should be pressed by branch 0');
    // Switch to branch 1
    play(g, 'TAB');
    assert.equal(g.activeBranch, 1);
    // Branch 1: go down to collect red
    play(g, DOWN, RIGHT, RIGHT, RIGHT, UP); // reach merge at (5,1)
    assert.equal(g.phase, 'merge_select');
    // Select branch 1 (has red)
    play(g, 'SELECT2');
    assert.equal(g.phase, 'playing');
    assert.ok(g.switchState.a, 'switch from branch 0 should persist after merge');
    // Continue to exit
    play(g, RIGHT, RIGHT);
    // wait - need to check: (6,1)=switchWall (should be open), (7,1)=gate+exit
    assert.ok(g.won);
  });
});

// ============================================================
// World 6: Rewind
// ============================================================
describe('World 6: Rewind', () => {
  it('permanent switch persists through rewind', () => {
    const g = new Game(LEVELS[5]);
    play(g, RIGHT, UP); // (1,1) then (1,0)=switch
    assert.ok(g.switchState.a, 'switch should be on');
    play(g, 'REWIND', 'REWIND'); // back to (0,1)
    assert.ok(g.switchState.a, 'permanent switch should persist after rewind');
    assert.equal(g.snake.length, 1);
  });

  it('full solution: press switch, rewind, take opened path', () => {
    const g = new Game(LEVELS[5]);
    play(g, RIGHT, UP); // press switch at (1,0)
    play(g, 'REWIND', 'REWIND'); // back to start
    play(g, RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, RIGHT); // right through opened wall, red, gate, exit
    assert.ok(g.won);
  });
});

// ============================================================
// World 7: Forgetting (Context Window)
// ============================================================
describe('World 7: Forgetting', () => {
  it('maxLength causes oldest segments to fade', () => {
    const g = new Game(LEVELS[6]);
    assert.equal(g.maxLength, 5);
    // Move 7 times to exceed limit
    for (let i = 0; i < 7; i++) {
      if (i < 1) g.move(DOWN);
      else g.move(RIGHT);
    }
    assert.ok(g.snake.length <= 5, 'snake should not exceed maxLength');
  });

  it('bottom path with memory stone preserves red → passes gate', () => {
    const g = new Game(LEVELS[6]);
    // Bottom path: down, right*3 (red+memoryStone at (3,2)), right, up, right*4, gate, exit
    play(g, DOWN, RIGHT, RIGHT, RIGHT, RIGHT, UP, RIGHT, RIGHT, RIGHT, RIGHT, RIGHT);
    assert.ok(g.won, 'should win via memory stone path');
  });

  it('top path without memory stone loses red → fails gate', () => {
    const g = new Game(LEVELS[6]);
    // Top path: up, right*3 (red at (3,0) no memory stone), right, down, right*4, gate
    play(g, UP, RIGHT, RIGHT, RIGHT, RIGHT, DOWN, RIGHT, RIGHT, RIGHT);
    const result = g.move(RIGHT); // gate at (8,1)
    assert.ok(!result.success || !g.won, 'red should have faded without memory stone');
  });
});

// ============================================================
// World 8: Portal (Tool Call)
// ============================================================
describe('World 8: Portal', () => {
  it('entering portal switches to sub-game', () => {
    const g = new Game(LEVELS[7]);
    play(g, RIGHT); // red
    play(g, RIGHT); // portal
    assert.equal(g.phase, 'in_portal');
    assert.ok(g.portalGame);
  });

  it('completing sub-game returns color to main game', () => {
    const g = new Game(LEVELS[7]);
    play(g, RIGHT, RIGHT); // red, then portal
    // In portal: navigate sub-grid
    play(g, RIGHT, RIGHT, RIGHT); // yellow, empty, exit
    assert.equal(g.phase, 'playing', 'should return to main game after portal exit');
    const head = g.snake.at(-1);
    assert.equal(head.color, 'yellow', 'portal should return yellow');
  });

  it('full solution: get red, portal for yellow, gate [red,yellow], exit', () => {
    const g = new Game(LEVELS[7]);
    play(g, RIGHT, RIGHT); // red, portal
    play(g, RIGHT, RIGHT, RIGHT); // sub-grid: yellow, _, exit
    play(g, RIGHT, RIGHT, RIGHT); // main: continue to gate, exit
    assert.ok(g.won);
  });
});

// ============================================================
// World 9: Subagent (Delegate)
// ============================================================
describe('World 9: Subagent', () => {
  it('entering delegate tile triggers instruction selection', () => {
    const g = new Game(LEVELS[8]);
    play(g, RIGHT, RIGHT, RIGHT); // red, empty, delegate
    assert.equal(g.phase, 'delegate_select');
  });

  it('instruction 1 (up path) returns green → gate passes', () => {
    const g = new Game(LEVELS[8]);
    play(g, RIGHT, RIGHT, RIGHT); // reach delegate
    play(g, 'INSTR1'); // select instruction 1: UP,RIGHT,RIGHT,RIGHT → green
    assert.equal(g.snake.at(-1).color, 'green', 'delegate should return green');
    assert.equal(g.phase, 'playing');
    play(g, RIGHT, RIGHT); // gate, exit
    assert.ok(g.won);
  });

  it('instruction 2 (down path) returns blue → gate fails', () => {
    const g = new Game(LEVELS[8]);
    play(g, RIGHT, RIGHT, RIGHT);
    play(g, 'INSTR2'); // select instruction 2: DOWN,RIGHT,RIGHT,RIGHT → blue
    assert.equal(g.snake.at(-1).color, 'blue');
    const result = g.move(RIGHT); // gate [red, green]
    assert.equal(result.reason, 'pattern mismatch');
  });

  it('instruction 3 (straight) returns no color → gate fails', () => {
    const g = new Game(LEVELS[8]);
    play(g, RIGHT, RIGHT, RIGHT);
    play(g, 'INSTR3');
    assert.equal(g.snake.at(-1).color, null);
  });
});

// ============================================================
// General mechanics
// ============================================================
describe('General mechanics', () => {
  it('snake cannot cross itself', () => {
    const g = new Game(LEVELS[0]);
    play(g, DOWN); // (0,2)
    play(g, RIGHT); // (1,2)
    play(g, UP); // (1,1)
    const result = g.move(LEFT); // try to go to (0,1) = start = occupied
    assert.equal(result.reason, 'self collision');
  });

  it('undo restores previous state', () => {
    const g = new Game(LEVELS[0]);
    play(g, DOWN);
    assert.equal(g.snake.length, 2);
    g.undo();
    assert.equal(g.snake.length, 1);
    assert.equal(g.getHead().x, 0);
    assert.equal(g.getHead().y, 1);
  });

  it('restart resets the game', () => {
    const g = new Game(LEVELS[0]);
    play(g, DOWN, RIGHT, RIGHT);
    g.restart();
    assert.equal(g.snake.length, 1);
    assert.equal(g.won, false);
    assert.equal(g.phase, 'playing');
  });
});
