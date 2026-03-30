// TRAIL - Shared Constants

import { DIR } from './game.js';

export const COLOR_HEX = {
  red: '#e74c3c', blue: '#3498db', green: '#2ecc71', yellow: '#f1c40f',
};

export const TILES = [
  { token: '.', label: '空', color: null },
  { token: '#', label: '墙', color: '#0a0a15' },
  { token: 'S', label: '起', color: null },
  { token: 'E', label: '终', color: '#ffd700' },
  { token: 'r', label: '红', color: '#e74c3c' },
  { token: 'b', label: '蓝', color: '#3498db' },
  { token: 'g', label: '绿', color: '#2ecc71' },
  { token: 'y', label: '黄', color: '#f1c40f' },
  { token: 'G', label: '门', color: '#4a4a5a' },
  { token: 'C', label: 'C站', color: '#00bcd4' },
  { token: '!a', label: '!开', color: null },
  { token: '|a', label: '|墙', color: '#8b4513' },
  { token: '~', label: '~暗', color: '#8000ff' },
  { token: '~b', label: '~蓝', color: '#8844cc' },
  { token: 'F', label: 'F叉', color: '#ff9800' },
  { token: 'M', label: 'M合', color: '#ff9800' },
  { token: '@', label: '@传', color: '#9b59b6' },
  { token: '$', label: '$派', color: '#e91e63' },
  { token: 'Dr', label: 'Dr', color: '#e74c3c' },
  { token: 'Dg', label: 'Dg', color: '#2ecc71' },
  { token: '◇', label: '◇', color: '#888' },
  { token: '*r', label: '★r', color: '#f39c12' },
];

export const DIR_MAP = {
  ArrowUp: DIR.UP, ArrowDown: DIR.DOWN,
  ArrowLeft: DIR.LEFT, ArrowRight: DIR.RIGHT,
  w: DIR.UP, s: DIR.DOWN, a: DIR.LEFT, d: DIR.RIGHT,
  W: DIR.UP, S: DIR.DOWN, A: DIR.LEFT, D: DIR.RIGHT,
};
