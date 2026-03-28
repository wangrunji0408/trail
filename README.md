# TRAIL

一个伪装成贪吃蛇的网格解谜游戏。蛇从固定起点生长，通过 9 个世界的关卡，隐喻大语言模型的核心原理。

## 运行

```bash
npx serve .
```

打开 http://localhost:3000

## 测试

```bash
node --test test/game.test.js
```

## 操作

| 按键 | 功能 |
|------|------|
| 方向键 | 延伸蛇身 |
| Z | 撤销 |
| R | 重来 |
| N | 下一关 |
| Backspace | 倒带（World 6+） |
| Tab | 切换分支（World 5） |
| 1/2/3 | 选择棱镜色 / 分支 / 指令 |

## 世界一览

| # | 名称 | 游戏机制 | 隐喻 |
|---|------|---------|------|
| 1 | 生长 | 彩色格 + 图案门 | Completion |
| 2 | 回声 | 预置段 + 检查点 + 回声门 | Conversation |
| 3 | 棱镜 | 开局选色，全局变换格子 | System Prompt |
| 4 | 暗影 | 暗区中的蛇身对门不可见 | Thinking / CoT |
| 5 | 分叉 | 蛇分裂，合并时副作用保留 | Fork / Beam Search |
| 6 | 倒带 | 回收蛇头，永久开关不复位 | Rewind / Regeneration |
| 7 | 遗忘 | 蛇身长度上限 + 记忆石 | Context Window / Compaction |
| 8 | 传送 | 进入子空间，带回颜色 | Tool Call |
| 9 | 委派 | 选择指令，子代理自动执行 | Subagent |
