// TRAIL - Shared Constants

import { DIR } from './game.js';

export const ROLE_HEX = {
  U: '#3498db',  // user - blue
  A: '#2ecc71',  // assistant - green
  S: '#e74c3c',  // system - red
  T: '#95a5a6',  // think - grey
};

export const ROLES = new Set(['U', 'A', 'S', 'T']);

export const TILES = [
  { token: '.', color: null },
  { token: '#', color: '#0a0a15' },
  { token: '^', color: null },
  { token: 'E', color: '#ffd700' },
  { token: 'U', color: '#3498db' },
  { token: 'A', color: '#2ecc71' },
  { token: 'S', color: '#e74c3c' },
  { token: 'T', color: '#95a5a6' },
  { token: 'G', color: '#4a4a5a' },
  { token: '✨', color: '#00bcd4' },
  { token: '!a', color: null },
  { token: '|a', color: '#8b4513' },
  { token: 'F', color: '#ff9800' },
  { token: 'M', color: '#ff9800' },
  { token: '@', color: '#9b59b6' },
  { token: '$', color: '#e91e63' },
  { token: '◇', color: '#888' },
  { token: '*', color: '#f39c12' },
];

export const DIR_MAP = {
  ArrowUp: DIR.UP, ArrowDown: DIR.DOWN,
  ArrowLeft: DIR.LEFT, ArrowRight: DIR.RIGHT,
  w: DIR.UP, s: DIR.DOWN, a: DIR.LEFT, d: DIR.RIGHT,
  W: DIR.UP, S: DIR.DOWN, A: DIR.LEFT, D: DIR.RIGHT,
};
