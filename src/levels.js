// TRAIL - Level Definitions
import { parseLevelText } from './parser.js';

export const LEVEL_FILES = [
  '1-growth', '2-echo', '3-prism', '4-shadow', '5-fork',
  '6-rewind', '7-forgetting', '8-portal', '9-subagent',
];

export async function loadLevelsBrowser() {
  const levels = [];
  for (const name of LEVEL_FILES) {
    const text = await (await fetch(`levels/${name}.txt`)).text();
    levels.push(parseLevelText(text));
  }
  return levels;
}

export function loadLevelsFromTexts(texts) {
  return texts.map(t => parseLevelText(t));
}

export { parseLevelText };
