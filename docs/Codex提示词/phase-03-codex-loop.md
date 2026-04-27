# GrassEye 第三阶段 Codex Loop

本阶段主模式：Vision-first Coordinate Mode。

主链：截图 -> 视觉目标 -> 坐标动作 -> 截图验证 -> action log。

兜底：Playwright / DOM Semantic Mode，仅用于辅助定位、调试、打开页面，不得成为隐藏主路径。

禁止：stealth、anti-detection、fingerprint spoof、captcha bypass、proxy pool、account pool、cookie/session/token export、自动评论/私信/关注。

验收主链：npm run typecheck / npm run audit:build / npm run audit / npm run build / npm run launch / manual live run record。# GrassEye 第三阶段 Codex 循环治理提示词

你现在进入 GrassEye 第三阶段执行任务。

本轮目标：

> 把 GrassEye 从 fixture/demo 本地闭环升级为真实网页单平台无人值守 Agent MVP，并尽快进入本机真实平台实测。

你必须按照《GrassEye 第三阶段 TODO 计划》循环执行、修复、验证，直到第三阶段 TODO 100% 完成。

---

## 1. 唯一结束条件

只有在以下条件全部满足时，才能结束任务：

1. 第三阶段 TODO 全部完成。
2. 至少一个真实网页视频平台 adapter 可用。
3. Agent 可以在本机授权浏览器中连续无人值守运行。
4. Agent 可以真实观察视频、截图、调用本地 AI 判断。
5. Agent 可以根据结构化判断执行有限平台动作。
6. Agent 可以打开评论区并保存评论 evidence，除非平台当前评论区不可用且有明确记录。
7. Agent 可以生成真实 evidence-backed candidate。
8. Workbench 显示 Real Platform Mode，不再只是 fixture。
9. Stop / Pause / maxRounds / maxRuntimeMinutes 可用。
10. non-product 不生成 candidate。
11. 不绕过登录、验证码、风控。
12. 不自动评论、私信、关注。
13. 不导出 cookie/session/token。
14. `npm run typecheck` 通过。
15. `npm run audit:build` 通过。
16. `npm run audit` 通过。
17. `npm run build` 通过。
18. `npm run launch` 通过。
19. 第三阶段验收报告落盘。
20. 真实平台实测记录落盘。
21. 最终报告输出 PASS / NOT PASS。

---

## 2. 第一执行顺序

### Step 1：读取治理文件

读取：

```txt
.github/instructions/cursor-rules/GRASSEYE-KERNEL.instructions.md
.github/instructions/cursor-rules/grasseye-index.instructions.md
.github/instructions/cursor-rules/modules/*.instructions.md
docs/阶段目标/phase-03-*.md
docs/TODO/phase-03-*.md
docs/法案辅助文件/*.md
```

如果第三阶段文件还没落到 canonical path，先落位。

### Step 2：跑现状验证

先运行：

```bash
npm run typecheck
npm run audit
npm run build
npm run launch
```

如果第二阶段当前状态阻塞第三阶段，先修阻塞项，但不要无限扫尾。

### Step 3：选择首平台

优先尝试：

```txt
Facebook Web / Facebook Reels / Facebook Watch
```

必须明确：平台名称、入口 URL、登录方式、视频区域可见性、评论区可见性、是否需要人工登录、是否存在验证码或风控。

如果 Facebook 当前不可落地，必须明确原因，并选择 TikTok Web 或 YouTube Shorts 作为备选。