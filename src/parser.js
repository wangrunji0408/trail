// TRAIL - Level txt parser

export function parseLevelText(text) {
  // Split on "---" to separate main level from sub-levels
  const sections = text.split(/^---.*$/m);
  const def = parseSection(sections[0]);

  // Parse sub-level sections
  for (let i = 1; i < sections.length; i++) {
    const sub = parseSection(sections[i]);
    if (!sub.start || !sub.exit) continue;
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
  const metaArrays = {};  // for repeated keys like 'decode'
  const mapLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('//')) {
      const m = trimmed.match(/^\/\/\s*([\w]+)\s*:\s*(.+)$/);
      if (m) {
        const key = m[1], val = m[2].trim();
        meta[key] = val;
        if (!metaArrays[key]) metaArrays[key] = [];
        metaArrays[key].push(val);
      }
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
    walls: [], chars: [], gates: [],
    switches: [], switchWalls: [],
    decodes: [], decodeRules: [],
    forks: [],
    portals: [], delegates: [],
    memoryStones: [], dyes: [], wildcards: [],
  };

  // Gate pattern: each character is a symbol to match
  const gatePattern = meta.gate ? [...meta.gate] : [];

  // Decode rules: "// decode: regex output" (one per line)
  if (metaArrays.decode) {
    for (const line of metaArrays.decode) {
      const lastSpace = line.lastIndexOf(' ');
      if (lastSpace > 0) {
        const pattern = line.slice(0, lastSpace);
        const output = line.slice(lastSpace + 1);
        def.decodeRules.push({ regex: new RegExp(pattern), output });
      }
    }
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
  // Escape: \X → char tile with character X
  if (token[0] === '\\' && token.length >= 2) {
    def.chars.push({ x, y, char: token.slice(1) });
    return;
  }

  if (token === '.') return;
  if (token === '#') { def.walls.push([x, y]); return; }
  if (token === '^') { def.start = [x, y]; return; }
  if (token === 'E') { def.exit = [x, y]; return; }
  if (token === 'G') { def.gates.push({ x, y, pattern: gatePattern }); return; }
  if (token === '✨') { def.decodes.push({ x, y }); return; }
  if (token === '@') { def.portals.push({ x, y }); return; }
  if (token === 'F') { def.forks.push({ x, y }); return; }
  if (token === '$') { def.delegates.push({ x, y }); return; }
  if (token === '◇') { def.wildcards.push([x, y]); return; }

  // Dye tiles: DX (legacy support)
  if (token.length === 2 && token[0] === 'D') {
    def.dyes.push({ x, y, char: token[1] });
    return;
  }

  // Memory stones: * or *X
  if (token[0] === '*') {
    def.memoryStones.push([x, y]);
    if (token.length >= 2) {
      def.chars.push({ x, y, char: token.slice(1) });
    }
    return;
  }

  // Switches: !a
  if (token[0] === '!' && token.length >= 2) {
    def.switches.push({ x, y, id: token[1], permanent: true });
    return;
  }
  // Switch walls: |a
  if (token[0] === '|' && token.length >= 2) {
    def.switchWalls.push({ x, y, id: token[1] });
    return;
  }

  // All other tokens → char tile
  def.chars.push({ x, y, char: token });
}
