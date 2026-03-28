// TRAIL - Level Definitions
// 9 worlds, 1 tutorial level each

export const LEVELS = [
  // ===== World 1: Growth (Completion) =====
  // Teach: colored tiles dye segments, gates check last N colored segments
  // Two paths: top has wrong order (blue→red), bottom has right order (red→blue)
  {
    world: 1,
    title: '生长',
    hint: '蛇经过彩色格会染色。门检查最近收集的颜色序列。',
    width: 6, height: 3,
    start: [0, 1],
    exit: [5, 1],
    walls: [[2, 1], [3, 1]],
    colors: [
      { x: 2, y: 0, c: 'blue' }, { x: 3, y: 0, c: 'red' },   // top: wrong order
      { x: 2, y: 2, c: 'red' },  { x: 3, y: 2, c: 'blue' },  // bottom: right order
    ],
    gates: [{ x: 4, y: 1, pattern: ['red', 'blue'] }],
  },

  // ===== World 2: Echo (Conversation) =====
  // Teach: preset segments are part of your snake; checkpoints update preset registry; echo gates check presets
  // Preset snake has blue. Checkpoint copies your last color to presets. Echo gate requires red in presets.
  {
    world: 2,
    title: '回声',
    hint: '虚线段是预置内容。经过检查点会将你的颜色加入预置。回声门检查预置颜色。',
    width: 7, height: 3,
    start: [2, 1],
    exit: [6, 1],
    presets: [
      { x: 0, y: 1, c: 'blue' },
      { x: 1, y: 1, c: 'blue' },
    ],
    colors: [{ x: 3, y: 1, c: 'red' }],
    checkpoints: [{ x: 4, y: 1 }],
    echoGates: [{ x: 5, y: 1, requires: ['red'] }],
  },

  // ===== World 3: Prism (System Prompt) =====
  // Teach: prism choice transforms all ◇ tiles; only one choice makes the level solvable
  // Gate requires [red, red]. Prism red → ◇ become red (solvable). Prism blue → ◇ become blue (fail).
  {
    world: 3,
    title: '棱镜',
    hint: '开始前选择一个棱镜色。棱镜色决定了◇格子变成什么。',
    width: 5, height: 3,
    start: [0, 1],
    exit: [4, 1],
    prismOptions: ['red', 'blue'],
    prismTiles: [
      { x: 1, y: 1, colorMap: { red: 'red', blue: 'blue' } },
      { x: 2, y: 1, colorMap: { red: 'red', blue: 'blue' } },
    ],
    gates: [{ x: 3, y: 1, pattern: ['red', 'red'] }],
  },

  // ===== World 4: Shadow (Thinking) =====
  // Teach: shadow segments are invisible to gates
  // Two paths through blue: top has regular blue (blocks gate), bottom has shadow blue (invisible to gate)
  {
    world: 4,
    title: '暗影',
    hint: '暗区（紫色底纹）中的蛇身不会被门看到。',
    width: 5, height: 3,
    start: [0, 1],
    exit: [4, 1],
    walls: [[2, 1]],
    colors: [
      { x: 1, y: 1, c: 'red' },
      { x: 2, y: 0, c: 'blue' },  // regular blue (top path)
    ],
    shadowColors: [
      { x: 2, y: 2, c: 'blue' },  // shadow blue (bottom path)
    ],
    gates: [{ x: 3, y: 1, pattern: ['red'] }],
  },

  // ===== World 5: Fork =====
  // Teach: fork splits snake; each branch can trigger effects; merge keeps one but side effects persist
  // Need switch AND red color. Switch is up, red is down. Fork to get both. Merge keeping the red branch.
  {
    world: 5,
    title: '分叉',
    hint: 'F 分叉后 Tab 切换分支。两条分支的开关效果都会保留。在 M 处按 1/2 选择保留哪条。',
    width: 8, height: 3,
    start: [0, 1],
    exit: [7, 1],
    forks: [{ x: 2, y: 1 }],
    merges: [{ x: 5, y: 1 }],
    switches: [{ x: 3, y: 0, id: 'a', permanent: true }],
    switchWalls: [{ x: 6, y: 1, id: 'a' }],
    colors: [{ x: 4, y: 2, c: 'red' }],
    gates: [{ x: 7, y: 1, pattern: ['red'] }],
    // Branch 1 (up): press switch
    // Branch 2 (down): collect red
    // Merge: keep branch 2 (has red), switch from branch 1 persists → wall opens
  },

  // ===== World 6: Rewind =====
  // Teach: rewind removes head segments; permanent switches persist through rewind
  // Switch is in dead end. Press it, rewind, take newly opened path.
  {
    world: 6,
    title: '倒带',
    hint: 'Backspace 倒带（回收蛇头）。永久开关不会因倒带复位。',
    width: 7, height: 3,
    start: [0, 1],
    exit: [6, 1],
    walls: [[0, 0], [2, 0], [0, 2], [2, 2]],
    switches: [{ x: 1, y: 0, id: 'a', permanent: true }],
    switchWalls: [{ x: 3, y: 1, id: 'a' }],
    colors: [{ x: 4, y: 1, c: 'red' }],
    gates: [{ x: 5, y: 1, pattern: ['red'] }],
    // Path: right→up(switch, dead end)→rewind→right→right(wall open)→right(red)→right(gate)→exit
  },

  // ===== World 7: Forgetting (Context Window) =====
  // Teach: snake has max length; oldest segments fade; memory stones preserve fading colors
  // Two paths: top has red without memory stone (fades → fail), bottom has red on memory stone (preserved → pass)
  {
    world: 7,
    title: '遗忘',
    hint: '蛇身有长度上限。超过时最老的段会消失。★记忆石能保存消失段的颜色。',
    width: 10, height: 3,
    maxLength: 5,
    start: [0, 1],
    exit: [9, 1],
    walls: [[3, 1]],
    colors: [
      { x: 3, y: 0, c: 'red' },  // top: red without memory stone
      { x: 3, y: 2, c: 'red' },  // bottom: red with memory stone
    ],
    memoryStones: [[3, 2]],
    gates: [{ x: 8, y: 1, pattern: ['red'] }],
    // Top path: red at pos 3, fades by pos 8 → gate fails
    // Bottom path: red at pos 3 with memory stone, fades but stone captures → gate passes
  },

  // ===== World 8: Portal (Tool Call) =====
  // Teach: portal enters sub-grid; sub-grid result color returns to main
  // Need yellow for gate, but yellow only exists in sub-grid
  {
    world: 8,
    title: '传送',
    hint: '传送门通向子空间。在子空间中收集的颜色会带回来。',
    width: 6, height: 3,
    start: [0, 1],
    exit: [5, 1],
    colors: [{ x: 1, y: 1, c: 'red' }],
    portals: [{
      x: 2, y: 1,
      subLevel: {
        world: 0, width: 4, height: 1,
        start: [0, 0], exit: [3, 0],
        colors: [{ x: 1, y: 0, c: 'yellow' }],
        title: '子空间',
      },
    }],
    gates: [{ x: 4, y: 1, pattern: ['red', 'yellow'] }],
  },

  // ===== World 9: Subagent (Delegate) =====
  // Teach: delegate tile sends an autonomous sub-snake; player chooses instructions; result returns
  // Need green for gate; delegate sub-grid has two possible paths based on instruction
  {
    world: 9,
    title: '委派',
    hint: '委派格会派遣子代理。选择不同指令，子代理走不同路径，返回不同颜色。',
    width: 6, height: 3,
    start: [0, 1],
    exit: [5, 1],
    colors: [{ x: 1, y: 1, c: 'red' }],
    delegates: [{
      x: 3, y: 1,
      subLevel: {
        world: 0, width: 4, height: 3,
        start: [0, 1], exit: [3, 1],
        colors: [
          { x: 1, y: 0, c: 'green' },
          { x: 1, y: 2, c: 'blue' },
        ],
        title: '子代理空间',
      },
      instructions: [
        { label: '↑→→→', moves: ['UP', 'RIGHT', 'RIGHT', 'RIGHT'], desc: '向上再向右' },
        { label: '↓→→→', moves: ['DOWN', 'RIGHT', 'RIGHT', 'RIGHT'], desc: '向下再向右' },
        { label: '→→→', moves: ['RIGHT', 'RIGHT', 'RIGHT'], desc: '直行' },
      ],
    }],
    gates: [{ x: 4, y: 1, pattern: ['red', 'green'] }],
    // Instruction 1: sub-snake goes up→right→right→right, picks green ✓
    // Instruction 2: sub-snake goes down→right→right→right, picks blue ✗
    // Instruction 3: sub-snake goes right→right→right, no color ✗
  },
];
