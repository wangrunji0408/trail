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
      if (game.phase === 'delegate_select') game.selectInstruction(idx);
    } else if (ch === '[' || ch === '{') {
      // Sub-sequence markers — just skip
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
  it('parses a simple level with char tiles', () => {
    const def = parseLevelText(`
// world: 1
// title: Test
// gate: 1+1=2
^ . 1 + G E
`);
    assert.equal(def.world, 1);
    assert.deepEqual(def.start, [0, 0]);
    assert.deepEqual(def.exit, [5, 0]);
    assert.deepEqual(def.gates[0].pattern, ['1', '+', '1', '=', '2']);
  });

  it('parses decode rules', () => {
    const def = parseLevelText(`
// decode: 1\\+1=$ 2
// decode: 2\\+2=$ 4
^ . E
`);
    assert.equal(def.decodeRules.length, 2);
    assert.equal(def.decodeRules[0].output, '2');
    assert.equal(def.decodeRules[1].output, '4');
    assert.ok(def.decodeRules[0].regex.test('1+1='));
    assert.ok(!def.decodeRules[0].regex.test('2+1='));
  });

  it('parses solution from meta', () => {
    const def = parseLevelText(`
// solution: dddwwd
^ . . . E
`);
    assert.equal(def.solution, 'dddwwd');
  });

  it('parses role chars U/A/S/T', () => {
    const def = parseLevelText(`^ U A S T E`);
    assert.equal(def.chars.length, 4);
    assert.deepEqual(def.chars.map(c => c.char), ['U', 'A', 'S', 'T']);
  });
});

// ============================================================
// Gate: subsequence matching with chars
// ============================================================
describe('Gate: char subsequence matching', () => {
  it('matches contiguous char pattern', () => {
    const g = new Game(parseLevelText(`// gate: UA\n^ U A G E`));
    playSolution(g, 'dddd');
    assert.ok(g.won);
  });

  it('ignores empty cells between chars', () => {
    const g = new Game(parseLevelText(`// gate: UA\n^ U . A G E`));
    playSolution(g, 'ddddd');
    assert.ok(g.won);
  });

  it('rejects wrong order', () => {
    const g = new Game(parseLevelText(`// gate: UA\n^ A U . G E`));
    playSolution(g, 'ddd');
    const r = g.move(RIGHT);
    assert.equal(r.reason, 'pattern mismatch');
  });
});

// ============================================================
// T (think) — hides content from gate matching
// ============================================================
describe('Think (T) hides content from gate', () => {
  it('T hides subsequent chars until next U/A/S', () => {
    // Sequence: U, T, X, A — visible = [U, A], T and X hidden
    const g = new Game(parseLevelText(`// gate: UA\n^ U T 1 A G E`));
    playSolution(g, 'dddddd');
    assert.ok(g.won);
  });

  it('without T, extra chars block contiguous match', () => {
    // Sequence: U, 1, A — gate wants contiguous "UA" — no match because 1 is between
    const g = new Game(parseLevelText(`// gate: UA\n^ U 1 A . G E`));
    playSolution(g, 'dddd');
    const r = g.move(RIGHT);
    assert.equal(r.reason, 'pattern mismatch');
  });

  it('T itself is not visible', () => {
    // Sequence: T, U, A — visible = [U, A]
    const g = new Game(parseLevelText(`// gate: UA\n^ T U A G E`));
    playSolution(g, 'ddddd');
    assert.ok(g.won);
  });
});

// ============================================================
// Decode (✨)
// ============================================================
describe('Decode (✨)', () => {
  it('produces output when suffix matches', () => {
    const g = new Game(parseLevelText(`// decode: 1\\+1=$ 2\n// gate: 1+1=2\n^ 1 + 1 = ✨ G E`));
    playSolution(g, 'ddddddd');
    assert.ok(g.won);
  });

  it('produces ? when no match', () => {
    const g = new Game(parseLevelText(`// decode: 1\\+1=$ 2\n^ 2 + 1 = ✨ E`));
    playSolution(g, 'dddddd');
    const head = g.getHead();
    // The ✨ segment should have char '?'
    const decodeSeg = g.snake[5]; // index 5 is the ✨ position
    assert.equal(decodeSeg.char, '?');
  });
});

// ============================================================
// Walk-back undo
// ============================================================
describe('Walk-back undo', () => {
  it('moving backward undoes last step', () => {
    const g = new Game(parseLevelText(`^ . . E`));
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
