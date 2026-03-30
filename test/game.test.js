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
// world: 1
// title: Test
// gate: rb
S . r b G E
`);
    assert.equal(def.world, 1);
    assert.deepEqual(def.start, [0, 0]);
    assert.deepEqual(def.exit, [5, 0]);
    assert.deepEqual(def.gates[0].pattern, ['red', 'blue']);
  });

  it('parses solution from meta', () => {
    const def = parseLevelText(`
// solution: dddwwd
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
    const g = new Game(parseLevelText(`// gate: rb\nS r b G E`));
    playSolution(g, 'dddd');
    assert.ok(g.won);
  });

  it('ignores empty cells between colors', () => {
    const g = new Game(parseLevelText(`// gate: rb\nS r . b G E`));
    playSolution(g, 'ddddd');
    assert.ok(g.won);
  });

  it('rejects wrong order', () => {
    const g = new Game(parseLevelText(`// gate: rb\nS b r . G E`));
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

