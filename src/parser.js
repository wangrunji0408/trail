// TRAIL - Level txt parser
// Parses text-based level definitions into levelDef objects

const COLOR_MAP = { r: 'red', b: 'blue', g: 'green', y: 'yellow' };

export function parseLevelText(text) {
  const lines = text.split('\n');
  const meta = {};
  const mapLines = [];

  // Parse meta comments and map lines
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#') && trimmed.includes(':')) {
      const m = trimmed.match(/^#\s*([\w]+)\s*:\s*(.+)$/);
      if (m) { meta[m[1]] = m[2].trim(); continue; }
    }
    if (trimmed.startsWith('#') && !trimmed.includes(':')) {
      // Could be a wall-only row like "# # # # #"
      if (/^[#.\s\w◇~*|!@$SCEGFMD]+$/.test(trimmed)) {
        mapLines.push(trimmed);
      }
      continue;
    }
    mapLines.push(trimmed);
  }

  // Parse map into tokens grid
  const grid = mapLines.map(line => {
    // Split by whitespace, preserving multi-char tokens like Dr, ~b, *r, !a, |a
    return line.split(/\s+/).filter(t => t.length > 0);
  });

  const height = grid.length;
  const width = Math.max(...grid.map(row => row.length));

  // Build level definition
  const def = {
    world: parseInt(meta.world) || 0,
    title: meta.title || '',
    hint: meta.hint || '',
    width,
    height,
    start: null,
    exit: null,
    walls: [],
    colors: [],
    gates: [],
    echoGates: [],
    switches: [],
    switchWalls: [],
    checkpoints: [],
    shadowZone: [],
    shadowColors: [],
    forks: [],
    merges: [],
    portals: [],
    delegates: [],
    memoryStones: [],
    dyes: [],
    wildcards: [],
  };

  // Gate pattern from meta
  const gatePattern = meta.gate
    ? meta.gate.split('').map(c => COLOR_MAP[c] || c)
    : [];

  // Checkpoint config from meta
  if (meta.checkpoint) {
    const parts = meta.checkpoint.split(/\s+/);
    def.checkpointRule = parts[0] || 'invert';
    def.checkpointSteps = parseInt(parts[1]) || 1;
  }

  // Max length
  if (meta.maxLength) def.maxLength = parseInt(meta.maxLength);

  // Solution sequence
  if (meta.solution) def.solution = meta.solution;

  // Parse each cell
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < (grid[y]?.length || 0); x++) {
      const token = grid[y][x];
      parseToken(token, x, y, def, gatePattern);
    }
  }

  return def;
}

function parseToken(token, x, y, def, gatePattern) {
  if (token === '.') return; // empty
  if (token === '#') { def.walls.push([x, y]); return; }
  if (token === 'S') { def.start = [x, y]; return; }
  if (token === 'E') { def.exit = [x, y]; return; }
  if (token === 'G') { def.gates.push({ x, y, pattern: gatePattern }); return; }
  if (token === 'C') { def.checkpoints.push({ x, y }); return; }
  if (token === 'F') { def.forks.push({ x, y }); return; }
  if (token === 'M') { def.merges.push({ x, y }); return; }
  if (token === '@') { def.portals.push({ x, y }); return; }
  if (token === '$') { def.delegates.push({ x, y }); return; }
  if (token === '◇') { def.wildcards.push([x, y]); return; }

  // Single color: r, b, g, y
  if (token.length === 1 && COLOR_MAP[token]) {
    def.colors.push({ x, y, c: COLOR_MAP[token] });
    return;
  }

  // Dye: Dr, Db, Dg, Dy
  if (token.length === 2 && token[0] === 'D' && COLOR_MAP[token[1]]) {
    def.dyes.push({ x, y, c: COLOR_MAP[token[1]] });
    return;
  }

  // Shadow + color: ~r, ~b, ~g
  if (token.length === 2 && token[0] === '~' && COLOR_MAP[token[1]]) {
    def.shadowColors.push({ x, y, c: COLOR_MAP[token[1]] });
    def.shadowZone.push([x, y]);
    return;
  }
  // Shadow zone only: ~
  if (token === '~') { def.shadowZone.push([x, y]); return; }

  // Memory stone: * or *r, *b, ...
  if (token[0] === '*') {
    def.memoryStones.push([x, y]);
    if (token.length === 2 && COLOR_MAP[token[1]]) {
      def.colors.push({ x, y, c: COLOR_MAP[token[1]] });
    }
    return;
  }

  // Switch: !a (permanent switch with id)
  if (token[0] === '!' && token.length >= 2) {
    def.switches.push({ x, y, id: token[1], permanent: true });
    return;
  }

  // Switch wall: |a
  if (token[0] === '|' && token.length >= 2) {
    def.switchWalls.push({ x, y, id: token[1] });
    return;
  }

  // Unknown token — treat as wall
  console.warn(`Unknown token "${token}" at (${x},${y}), treating as wall`);
  def.walls.push([x, y]);
}
