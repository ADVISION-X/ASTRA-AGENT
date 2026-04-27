# GrassEye 第三阶段 Codex 循环治理提示词

你现在进入 GrassEye 第三阶段执行任务。

本轮目标：

> 把 GrassEye 从 fixture/demo 本地闭环升级为真实网页单平台无人值守 Agent MVP，并尽快进入本机真实平台实测。

你必须按照《GrassEye 第三阶段 TODO 计划》循环执行、修复、验证，直到第三阶段 TODO 100% 完成。

---

## 一、唯一结束条件

你只有在以下条件全部满足时，才能结束任务：

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
16. `npm run audit:build` 通过。
17. `npm run audit` 通过。
18. `npm run build` 通过。
19. `npm run launch` 通过。
20. 第三阶段验收报告落盘。
21. 真实平台实测记录落盘。
22. 最终报告输出 PASS / NOT PASS。

如果任何一项未完成，你不能宣布第三阶段完成。

---

## 二、阶段性质

第三阶段不是继续第二阶段扫尾。

第三阶段必须让 Agent 真正上路：

```txt
人工启动
→ 本机授权浏览器
→ 真实网页视频平台
→ 连续无人值守观察
→ 截图
→ 本地 AI 判断
→ 有限动作
→ 评论截图
→ OCR / 评论分析
→ 候选生成
→ Workbench 人工复核
```

---

## 三、最高治理原则

必须遵守现有 GrassEye 法案：

- GRASSEYE-KERNEL
- grasseye-index
- module-agent-runtime
- module-platform-action
- module-vision-boundary
- module-comment-intelligence
- module-product-signal
- module-local-data
- module-operator-control
- module-security-privacy
- module-code-topology
- module-type-safety
- module-local-ai-runtime
- module-local-app-shell
- module-localization
- module-audit-system

如现有法案不足，优先使用施工图或最小法案补强，不得把法案变成垃圾桶。

---

## 四、禁止事项

严禁：

- 绕过登录。
- 绕过验证码。
- 绕过平台风控。
- 使用账号池。
- 使用代理池。
- 指纹伪装。
- 自动评论。
- 自动私信。
- 自动关注。
- 批量互动刷量。
- 导出 cookie。
- 导出 session。
- 保存 token 到日志。
- 云端浏览器托管用户账号。
- 默认调用云端付费 AI。
- 用 fixture 结果冒充真实平台结果。
- 用测试假装真实实测完成。
- fake PASS。

如果遇到登录、验证码、异常风控：

```txt
pause / stop
→ operator review
→ 写入 action log
```

不要绕过。

---

## 五、第一执行顺序

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

---

### Step 2：跑现状验证

先运行：

```bash
npm run typecheck
npm run audit
npm run build
npm run launch
```

如果第二阶段当前状态阻塞第三阶段，先修阻塞项，但不要无限扫尾。

---

### Step 3：选择首平台

优先尝试：

```txt
Facebook Web / Facebook Reels / Facebook Watch
```

必须明确：

- 平台名称
- 入口 URL
- 登录方式
- 视频区域可见性
- 评论区可见性
- 是否需要人工登录
- 是否存在验证码 / 风控

如果 Facebook 当前不可落地，必须明确原因，并选择一个备选平台：

```txt
TikTok Web
或
YouTube Shorts
```

不得停在“继续研究平台”。

---

### Step 4：实现 RealPlatformAdapter

实现真实平台 adapter。

要求：

- 文件放在 `src/features/platform-action/adapters/`
- 不覆盖 fixture adapter
- 平台 DOM / selector / 坐标只存在于 adapter 内部
- AgentRuntime 不直接依赖平台页面结构
- 所有动作返回结构化 ActionResult
- 所有动作写入 action log
- 坐标点击只能作为 adapter 内部 fallback

---

### Step 5：实现真实 Browser Session

要求：

- 使用本机授权浏览器会话
- 允许用户手动登录
- 不导出 cookie/session/token
- 不托管远程浏览器
- 登录异常进入 operator review
- 验证码出现则 stop / review，不绕过

---

### Step 6：视频截图链路

要求：

- 能定位真实视频区域
- 能截视频区域
- 能保存 video evidence
- 能绑定 taskRunId / roundId
- 低质量或未识别截图进入 skip / retry / review

---

### Step 7：本地 AI 判断真实截图

要求：

- 真实截图进入 Local AI Gateway
- 进入真实平台前必须先通过受治理的本地模型角色配置与 local-ai-runtime 执法检查
- 输出 taskType / modelRole / model / runtime / promptVersion / schemaVersion / evidenceRef / confidence / implementationStatus / result
- 低置信度不能强行动作
- non-product 不得生成 candidate

---

### Step 8：有限平台动作

允许动作：

```txt
scroll
open video
screenshot video area
click not interested
like/save candidate
open comments
screenshot comments
continue next
```

不允许动作：

```txt
comment
DM
follow
account switch
captcha bypass
proxy/fingerprint spoofing
```

---

### Step 9：评论采集和分析

要求：

- 只对 product candidate 打开评论区
- 截图评论区
- OCR 评论
- 提取购买意图 / 痛点 / 质疑 / 需求词
- 不做个人画像
- 不追踪评论用户

---

### Step 10：候选生成

要求：

- 只从 product_video + 有效 evidence 生成 candidate
- candidate 必须 pending review
- candidate 必须绑定 evidenceRefs
- candidate 必须标注 sourcePlatform
- candidate 必须在 Workbench 显示
- non-product evidence 不得进入 candidate source

---

### Step 11：无人值守运行

要求：

- 支持 maxRounds
- 支持 maxRuntimeMinutes
- 支持 pause
- 支持 stop
- 支持连续失败阈值
- 支持 dwell time / rate limit
- 至少实测连续 5 轮真实页面观察
- 运行中持续写 action log

---

### Step 12：Workbench 集成

Workbench 必须显示：

- Real Platform Mode / Fixture Mode
- 当前平台
- 当前 adapter
- agent 状态
- 当前轮次
- 当前 action
- candidate pool
- evidence preview
- action log
- pause / stop / start
- maxRounds / maxRuntime 配置
- 本地化切换保持可用

---

### Step 13：执法审计与本机实测

不得新增测试文件；关键边界必须进入执法系统或本机实测证据：

- real adapter contract audit
- safety gate audit
- non-product no candidate audit
- max rounds unattended runtime audit
- workbench real mode display verification

必须补审计：

- platform-action owner 检查真实 adapter 边界
- security-privacy owner 检查无 cookie/session/token 泄露
- product-signal owner 检查 non-product 不生成 candidate
- agent-runtime owner 检查 pause / stop / maxRounds
- local-app-shell owner 检查 Workbench 显示真实平台模式

---

### Step 14：真实平台实测

必须执行一次真实平台实测。

记录：

```txt
平台名称
入口 URL
运行轮数
运行时长
视频截图数量
评论截图数量
候选数量
跳过数量
错误数量
是否触发风控
是否需要人工每轮干预
是否生成真实 candidate
```

如果因为平台风控 / 登录 / 页面结构导致不能完成，必须报告 NOT PASS 和真实阻塞，不得假装完成。

---

## 六、验证命令

你必须循环运行：

```bash
npm run typecheck
npm run audit:build
npm run audit
npm run build
npm run launch
```

如果新增：

```bash
npm run verify:phase3
npm run demo:phase3
```

也必须运行。

---

## 七、文档要求

必须创建或更新：

```txt
docs/验收报告/phase-03-acceptance-report.md
```

如果还没有 phase-03 TODO 在 canonical path，也必须创建：

```txt
docs/TODO/phase-03-TODO.md
```

如果需要 Codex prompt 落盘：

```txt
docs/Codex提示词/phase-03-codex-loop.md
```

不得把文档散落在根目录。

---

## 八、循环要求

你必须循环执行：

1. 修改代码。
2. 运行验证。
3. 读失败。
4. 修复失败。
5. 再验证。
6. 更新 TODO。
7. 继续下一个任务。

不得在有失败项时停止。

不得只输出建议。

必须实际修改项目。

---

## 九、最终输出报告格式

完成后输出：

# GrassEye 第三阶段完成报告

## 1. 阶段目标

## 2. 首平台选择

| 项目 | 结果 |
|---|---|
| 平台 | |
| 入口 URL | |
| 登录方式 | |
| 是否需要人工登录 | |
| 是否出现验证码/风控 | |

## 3. 新增文件清单

## 4. 修改文件清单

## 5. RealPlatformAdapter 说明

## 6. 无人值守运行结果

| 项目 | 结果 |
|---|---|
| 运行轮数 | |
| 运行时长 | |
| 视频截图数 | |
| 评论截图数 | |
| candidate 数 | |
| skip 数 | |
| error 数 | |
| 是否需要每轮人工干预 | |

## 7. Workbench 验收

| 项目 | 是否通过 |
|---|---|
| Real Platform Mode | |
| Start / Pause / Stop | |
| maxRounds / maxRuntime | |
| Candidate Pool | |
| Evidence Preview | |
| Action Logs | |

## 8. 安全边界

| 边界 | 是否通过 |
|---|---|
| 无验证码绕过 | |
| 无自动评论 | |
| 无自动私信 | |
| 无自动关注 | |
| 无 cookie/session/token 外泄 | |
| 无云端 AI fallback | |

## 9. 验证命令结果

列出：

```bash
npm run typecheck
npm run audit:build
npm run audit
npm run build
npm run launch
```

## 10. 真实发现项

列出所有 violation / gap / limitation。

不要隐藏。

## 11. 第三阶段验收状态

只能回答：

```txt
PASS
```

或：

```txt
NOT PASS
```

如果 NOT PASS，说明剩余阻塞。
