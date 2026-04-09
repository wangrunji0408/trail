// TRAIL - Level Definitions
import { parseLevelText } from './parser.js';

export const LEVEL_FILES = [
  '1-token', '2-decode', '3-conversation', '4-system', '5-thinking',
  '6-fork', '7-forgetting', '8-portal', '9-subagent',
];

// Level texts embedded inline so the game works via file:// without a server
export const LEVEL_TEXTS = {
  '1-token': `// world: 1
// title: Token
// gate: 1+1=2

^ . 1 .
. + 2 =
1 . . G
. . # E`,

  '2-decode': `// world: 2
// title: Decode
// decode: 1\\+1=$ 2
// decode: 1=$ 1
// gate: 1+1=2

^ . 1 .
. + = .
1 . ✨ G
. . # E`,

  '3-conversation': `// world: 3
// title: 对话
// gate: 👋
// decode: U👋A$ 👋

^ # # #
U . 👋 .
# # # A
. . ✨ .
. # # #
. . G E`,

  '4-system': `// world: 4
// title: 系统提示
// gate: SUA

^ S U A G E`,

  '5-thinking': `// world: 5
// title: 思考
// gate: UA

^ U T 1 A G E`,

  '6-fork': `// world: 6
// title: 分叉
// note: 走到F上自动分叉。Tab切换分支。分支走到另一分支上时自动合并，序列拼接，副作用保留。
// gate: S

. !a . . . #
^ F . |a G E
. S . . . #

// solution: dwdtsdwwdsdd`,

  '7-forgetting': `// world: 7
// title: 遗忘
// note: 蛇身超过长度上限后最老段消失，记忆石保存关键字符
// gate: S
// maxLength: 5

. . . S . . . . . #
^ . . # . . . . G E
. . . *S . . . . . #

// solution: sdddddwdddddd`,

  '8-portal': `// world: 8
// title: 传送
// note: 主网格缺少的字符只能从子空间获取
// gate: SU
// solution: dd{ddd}ddd

^ S @ . G E

--- sublevel
// title: 子空间

^ U . E`,

  '9-subagent': `// world: 9
// title: 委派
// note: 选择不同指令让子代理走不同路径返回不同字符
// gate: SA
// instructions: ↑→→→ 向上再向右|↓→→→ 向下再向右|→→→ 直行
// solution: dd{1}dddd

# . . . . . #
^ S $ . . G E
# . . . . . #

--- sublevel
// title: 子代理空间

. A . .
^ . . E
. U . .`,
};

export async function loadLevelsBrowser() {
  const levels = [];
  for (const name of LEVEL_FILES) {
    // Try inline texts first (works with file://)
    if (LEVEL_TEXTS[name]) {
      levels.push(parseLevelText(LEVEL_TEXTS[name]));
      continue;
    }
    // Fallback: fetch from server (works with http://)
    try {
      const text = await (await fetch(`levels/${name}.txt`)).text();
      levels.push(parseLevelText(text));
    } catch (e) {
      console.warn(`Failed to load level ${name}:`, e);
    }
  }
  return levels;
}

export function loadLevelsFromTexts(texts) {
  return texts.map(t => parseLevelText(t));
}

export { parseLevelText };
