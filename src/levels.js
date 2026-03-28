// TRAIL - Level Definitions
import { parseLevelText } from './parser.js';

const LEVEL_FILES = [
  '1-growth', '2-echo', '3-prism', '4-shadow', '5-fork',
  '6-rewind', '7-forgetting', '8-portal', '9-subagent',
];

function attachSubLevels(levels) {
  if (levels[7]?.portals?.[0]) {
    levels[7].portals[0].subLevel = {
      world: 0, width: 4, height: 1,
      start: [0, 0], exit: [3, 0],
      colors: [{ x: 1, y: 0, c: 'yellow' }],
      title: '子空间',
    };
  }
  if (levels[8]?.delegates?.[0]) {
    levels[8].delegates[0].subLevel = {
      world: 0, width: 4, height: 3,
      start: [0, 1], exit: [3, 1],
      colors: [{ x: 1, y: 0, c: 'green' }, { x: 1, y: 2, c: 'blue' }],
      title: '子代理空间',
    };
    levels[8].delegates[0].instructions = [
      { label: '↑→→→', moves: ['UP', 'RIGHT', 'RIGHT', 'RIGHT'], desc: '向上再向右' },
      { label: '↓→→→', moves: ['DOWN', 'RIGHT', 'RIGHT', 'RIGHT'], desc: '向下再向右' },
      { label: '→→→', moves: ['RIGHT', 'RIGHT', 'RIGHT'], desc: '直行' },
    ];
  }
}

// Browser: async fetch
export async function loadLevelsBrowser() {
  const levels = [];
  for (const name of LEVEL_FILES) {
    const text = await (await fetch(`levels/${name}.txt`)).text();
    levels.push(parseLevelText(text));
  }
  attachSubLevels(levels);
  return levels;
}

// Node.js: called from test helper
export function loadLevelsFromTexts(texts) {
  const levels = texts.map(t => parseLevelText(t));
  attachSubLevels(levels);
  return levels;
}

export { LEVEL_FILES, parseLevelText };
