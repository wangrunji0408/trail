// TRAIL - Level txt parser

const COLOR_MAP = { r: 'red', b: 'blue', g: 'green', y: 'yellow' };

export function parseLevelText(text) {
  // Split on "---" to separate main level from sub-levels
  const sections = text.split(/^---.*$/m);
  const def = parseSection(sections[0]);

  // Parse sub-level sections
  for (let i = 1; i < sections.length; i++) {
    const sub = parseSection(sections[i]);
    if (!sub.start || !sub.exit) continue;
    // Attach sub-level to the appropriate portal/delegate
    if (def.portals.length > 0 && !def.portals[0].subLevel) {
      def.portals[0].subLevel = sub;
    } else if (def.delegates.length > 0 && !def.delegates[0].subLevel) {
      def.delegates[0].subLevel = sub;
    }
  }

  // Parse delegate instructions from meta
  if (def._instructions && def.delegates.length > 0) {
    def.delegates[0].instructions = def._instructions;
    delete def._instructions;
  }

  return def;
}

function parseSection(text) {
  const lines = text.split('\n');
  const meta = {};
  const mapLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('//')) {
      const m = trimmed.match(/^\/\/\s*([\w]+)\s*:\s*(.+)$/);
      if (m) meta[m[1]] = m[2].trim();
      continue;
    }
    mapLines.push(trimmed);
  }

  const grid = mapLines.map(line => line.split(/\s+/).filter(t => t.length > 0));
  const height = grid.length;
  const width = height > 0 ? Math.max(...grid.map(row => row.length)) : 0;

  const def = {
    world: parseInt(meta.world) || 0,
    title: meta.title || '',
    width, height,
    start: null, exit: null,
    walls: [], colors: [], gates: [],
    switches: [], switchWalls: [],
    checkpoints: [],
    shadowZone: [], shadowColors: [],
    forks: [],
    portals: [], delegates: [],
    memoryStones: [], dyes: [], wildcards: [],
  };

  const gatePattern = meta.gate
    ? meta.gate.split('').map(c => COLOR_MAP[c] || c)
    : [];

  if (meta.checkpoint) {
    const parts = meta.checkpoint.split(/\s+/);
    def.checkpointRule = parts[0] || 'invert';
    def.checkpointSteps = parseInt(parts[1]) || 1;
  }
  if (meta.maxLength) def.maxLength = parseInt(meta.maxLength);
  if (meta.solution) def.solution = meta.solution;

  // Parse delegate instructions: "instructions: ↑→→→ 向上|↓→→→ 向下|→→→ 直行"
  if (meta.instructions) {
    const DIR_SHORT = { '↑': 'UP', '↓': 'DOWN', '←': 'LEFT', '→': 'RIGHT' };
    def._instructions = meta.instructions.split('|').map(part => {
      const [movesStr, ...descParts] = part.trim().split(/\s+/);
      const moves = [...movesStr].map(c => DIR_SHORT[c]).filter(Boolean);
      return { label: movesStr, moves, desc: descParts.join(' ') || '' };
    });
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < (grid[y]?.length || 0); x++) {
      parseToken(grid[y][x], x, y, def, gatePattern);
    }
  }

  return def;
}

function parseToken(token, x, y, def, gatePattern) {
  if (token === '.') return;
  if (token === '#') { def.walls.push([x, y]); return; }
  if (token === 'S') { def.start = [x, y]; return; }
  if (token === 'E') { def.exit = [x, y]; return; }
  if (token === 'G') { def.gates.push({ x, y, pattern: gatePattern }); return; }
  if (token === 'C') { def.checkpoints.push({ x, y }); return; }
  if (token === '@') { def.portals.push({ x, y }); return; }
  if (token === 'F') { def.forks.push({ x, y }); return; }
  if (token === '$') { def.delegates.push({ x, y }); return; }
  if (token === '◇') { def.wildcards.push([x, y]); return; }

  if (token.length === 1 && COLOR_MAP[token]) {
    def.colors.push({ x, y, c: COLOR_MAP[token] });
    return;
  }
  if (token.length === 2 && token[0] === 'D' && COLOR_MAP[token[1]]) {
    def.dyes.push({ x, y, c: COLOR_MAP[token[1]] });
    return;
  }
  if (token.length === 2 && token[0] === '~' && COLOR_MAP[token[1]]) {
    def.shadowColors.push({ x, y, c: COLOR_MAP[token[1]] });
    def.shadowZone.push([x, y]);
    return;
  }
  if (token === '~') { def.shadowZone.push([x, y]); return; }
  if (token[0] === '*') {
    def.memoryStones.push([x, y]);
    if (token.length === 2 && COLOR_MAP[token[1]]) {
      def.colors.push({ x, y, c: COLOR_MAP[token[1]] });
    }
    return;
  }
  if (token[0] === '!' && token.length >= 2) {
    def.switches.push({ x, y, id: token[1], permanent: true });
    return;
  }
  if (token[0] === '|' && token.length >= 2) {
    def.switchWalls.push({ x, y, id: token[1] });
    return;
  }
  console.warn(`Unknown token "${token}" at (${x},${y}), treating as wall`);
  def.walls.push([x, y]);
}
