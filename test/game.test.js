// TRAIL - Unit Tests
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game, DIR } from '../src/game.js';
import { LEVEL_FILES, loadLevelsFromTexts } from '../src/levels.js';
import { parseLevelText } from '../src/parser.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const levelsDir = resolve(__dir, '../levels');
const LEVELS = loadLevelsFromTexts(
  LEVEL_FILES.map(name => readFileSync(resolve(levelsDir, name + '.txt'), 'utf-8'))
);

const { UP, DOWN, LEFT, RIGHT } = DIR;
const DIR_MAP = { w: UP, s: DOWN, a: LEFT, d: RIGHT };

// Execute a solution string on a game.
// w/a/s/d = directions, < = rewind, t = tab(switch branch),
// [moves] = branch sub-sequence, {moves} = portal sub-sequence,
// 1/2/3 = select branch or instruction
function playSolution(game, solution) {
  let i = 0;
  while (i < solution.length) {
    const ch = solution[i];
    if (DIR_MAP[ch]) {
      const result = game.move(DIR_MAP[ch]);
      if (!result.success && game.phase !== 'won') {
        throw new Error(`Step ${i} '${ch}': ${result.reason} at (${game.getHead().x},${game.getHead().y})`);
      }
    } else if (ch === '<') {
      game.rewind();
    } else if (ch === 't') {
      game.switchBranch();
    } else if (ch === '1' || ch === '2' || ch === '3') {
      const idx = parseInt(ch) - 1;
      if (game.phase === 'merge_select') game.selectBranch(idx);
      else if (game.phase === 'delegate_select') game.selectInstruction(idx);
    } else if (ch === '[' || ch === '{') {
      // Sub-sequence markers — just skip, moves inside are normal
    } else if (ch === ']' || ch === '}') {
      // End of sub-sequence
    }
    i++;
  }
}

// ============================================================
// Parser
// ============================================================
describe('Parser', () => {
  it('parses a simple level', () => {
    const def = parseLevelText(`
# world: 1
# title: Test
# gate: rb
S . r b G E
`);
    assert.equal(def.world, 1);
    assert.deepEqual(def.start, [0, 0]);
    assert.deepEqual(def.exit, [5, 0]);
    assert.deepEqual(def.gates[0].pattern, ['red', 'blue']);
  });

  it('parses solution from meta', () => {
    const def = parseLevelText(`
# solution: dddwwd
S . . . E
`);
    assert.equal(def.solution, 'dddwwd');
  });
});

// ============================================================
// Gate: subsequence matching
// ============================================================
describe('Gate: subsequence matching', () => {
  it('matches contiguous pattern', () => {
    const g = new Game(parseLevelText(`# gate: rb\nS r b G E`));
    playSolution(g, 'dddd');
    assert.ok(g.won);
  });

  it('rejects non-contiguous', () => {
    const g = new Game(parseLevelText(`# gate: rb\nS r . b G E`));
    playSolution(g, 'ddd');
    const r = g.move(RIGHT);
    assert.equal(r.reason, 'pattern mismatch');
  });

  it('rejects wrong order', () => {
    const g = new Game(parseLevelText(`# gate: rb\nS b r . G E`));
    playSolution(g, 'ddd');
    const r = g.move(RIGHT);
    assert.equal(r.reason, 'pattern mismatch');
  });
});

// ============================================================
// Walk-back undo
// ============================================================
describe('Walk-back undo', () => {
  it('moving backward undoes last step', () => {
    const g = new Game(parseLevelText(`S . . E`));
    g.move(RIGHT);
    assert.equal(g.snake.length, 2);
    g.move(LEFT); // walk back
    assert.equal(g.snake.length, 1);
  });
});

// ============================================================
// All levels: solve with embedded solution
// ============================================================
describe('All levels: solution verification', () => {
  LEVELS.forEach((level, i) => {
    if (!level.solution) return;
    it(`Level ${i + 1} (${level.title}): solution "${level.solution}" wins`, () => {
      const g = new Game(level);
      playSolution(g, level.solution);
      assert.ok(g.won, `Level ${i + 1} not won after solution. phase=${g.phase}`);
    });
  });
});

// ============================================================
// World-specific mechanics
// ============================================================
describe('World 2: checkpoint auto-extend', () => {
  it('checkpoint inverts color and extends', () => {
    const g = new Game(LEVELS[1]);
    // S(0,2)→d→d→d(3,2)r→d(4,2)C[auto→(5,2)blue]
    playSolution(g, 'dddd');
    const cpX = LEVELS[1].checkpoints[0].x;
    assert.equal(g.getHead().x, cpX + 1, 'head should be 1 past checkpoint');
    assert.ok(g.snake.some(s => s.color === 'blue' && s.isPreset));
  });
});

describe('World 3: dye + wildcard', () => {
  it('dye transforms wildcards', () => {
    const g = new Game(LEVELS[2]);
    // Bottom path to green dye: s(0,3)→d(1,3)→d(2,3)Dg
    playSolution(g, 'sdd');
    const wasWildcard = LEVELS[2].wildcards[0];
    const cell = g.grid[wasWildcard[1]][wasWildcard[0]];
    assert.equal(cell.type, 'color');
    assert.equal(cell.color, 'green');
  });
});

describe('World 4: shadow invisible to gate', () => {
  it('shadow segment color not seen by gate', () => {
    const g = new Game(LEVELS[3]);
    playSolution(g, 'dsdd'); // right(red), down, right(~blue shadow), right
    const shadowSeg = g.snake.find(s => s.isShadow);
    assert.ok(shadowSeg, 'should have a shadow segment');
    assert.equal(shadowSeg.color, 'blue');
    // Gate [red] should pass since shadow blue is invisible
    const visible = g.snake.filter(s => !s.isShadow && s.color);
    assert.deepEqual(visible.map(s => s.color), ['red']);
  });
});

describe('World 6: rewind + permanent switch', () => {
  it('permanent switch survives rewind', () => {
    const g = new Game(LEVELS[5]);
    playSolution(g, 'dw'); // right then up = switch
    assert.ok(g.switchState.a);
    playSolution(g, '<<'); // rewind twice
    assert.ok(g.switchState.a, 'permanent switch must survive rewind');
    assert.equal(g.snake.length, 1);
  });
});
