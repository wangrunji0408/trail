# TRAIL

一个伪装成贪吃蛇的网格解谜游戏。蛇从固定起点生长，通过 9 个世界的关卡，隐喻大语言模型的核心原理。

## 运行

```bash
npx serve .
```

游戏: http://localhost:3000
编辑器: http://localhost:3000/editor.html

## 测试

```bash
node --test test/game.test.js
```

## 操作

| 按键 | 功能 |
|------|------|
| WASD / 方向键 | 延伸蛇身（反向 = 撤销） |
| R | 重来 |
| N | 下一关 |
| Backspace | 倒带 |
| Tab | 切换分支 |
| 1/2/3 | 选择指令 |

## 世界一览

| # | 名称 | 游戏机制 | 隐喻 |
|---|------|---------|------|
| 1 | 生长 | 彩色格 + 图案门（序列匹配） | Completion |
| 2 | 回声 | 检查点自动延伸，取反颜色 | Conversation |
| 3 | 棱镜 | 染料格改变待定格颜色 | System Prompt |
| 4 | 暗影 | 暗区蛇身对门不可见 | Thinking / CoT |
| 5 | 分叉 | 走到 F 自动分叉，走到对方身上自动合并 | Fork |
| 6 | 倒带 | 回收蛇头，永久开关不复位 | Rewind |
| 7 | 遗忘 | 蛇身长度上限 + 记忆石 | Context Window |
| 8 | 传送 | 进入子空间，带回颜色 | Tool Call |
| 9 | 委派 | 选择指令，子代理自动执行 | Subagent |

## 关卡格式

关卡定义为 `levels/*.txt`，详见 [DESIGN.md](DESIGN.md)。
