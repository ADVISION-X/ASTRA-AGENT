# GrassEye 第三阶段 TODO 计划

版本：1.0  
阶段主题：真实网页单平台无人值守 Agent MVP  
阶段目标：今晚尽快进入本机真实平台实测

---

## 0. 第三阶段一句话目标

第三阶段完成后，GrassEye 必须从 fixture/demo 本地闭环升级为真实网页单平台无人值守 Agent MVP：

```txt
人工启动
→ 本机授权浏览器
→ 真实网页视频平台
→ 连续无人值守观察视频
→ 截图
→ 本地 AI 判断
→ 有限平台动作
→ 评论截图
→ OCR / 评论理解
→ 生成真实 evidence-backed candidate
→ 回到 Workbench 人工复核
```

---

## 1. 阶段完成态

| 能力 | 完成态 |
|---|---|
| 平台接入 | 至少接入 1 个真实网页视频平台 |
| 推荐首平台 | Facebook Web / Facebook Reels / Facebook Watch 优先 |
| 浏览器会话 | 使用本机授权浏览器会话，不导出 cookie/session |
| 无人值守 | 可按 maxRounds 或 maxRuntime 连续运行 |
| 视频截图 | 能定位真实视频区域并保存 evidence |
| 本地 AI | 真实截图进入 Local AI Gateway，输出结构化结果 |
| 平台动作 | 只执行有限动作，全部写 action log |
| 评论采集 | 产品候选可打开评论区并截图 |
| 评论理解 | OCR / 评论意图分析能生成 comment signal |
| 候选生成 | 只生成 evidence-backed pending candidate |
| Workbench | 显示 Real Platform Mode、候选、证据、日志 |
| 安全边界 | 不绕过登录、验证码、风控；不自动评论、私信、关注 |
| 执法验证 | typecheck / audit / build / launch 全通过 |
| 人工验收 | 完成一次真实平台实测记录 |

---

## 2. 阶段边界

### 必须做

- 单平台真实网页 Adapter。
- 本机授权浏览器会话。
- 真实视频区域截图。
- 本地 AI 对真实截图分类。
- 有限平台动作。
- 评论区截图与评论信号。
- 真实 evidence-backed candidate。
- 无人值守运行轮次、限速、停止条件。
- Workbench 显示真实运行模式。
- 安全门：登录、验证码、风控、低置信度、连续失败。
- 第三阶段验收报告。

### 不做

- 不做多平台。
- 不做账号池、代理池、指纹伪装。
- 不绕过验证码或平台风控。
- 不自动评论、私信、关注。
- 不做采购、上架、广告投放决策。
- 不做 SaaS、远程浏览器、云端账号托管。
- 不把本地 AI 默认改成云端付费 API。

---

## 3. TODO 总表

| ID | 任务 | 完成标准 | 状态 |
|---|---|---|---|
| T00 | 现状验证 | 第二阶段命令链可运行 | [ ] |
| T01 | 第三阶段文件落位 | 目标/TODO/提示词在 canonical path | [ ] |
| T02 | 首平台选择 | 明确一个真实平台入口 | [ ] |
| T03 | RealPlatformAdapter | 真实平台逻辑收敛到 adapter | [ ] |
| T04 | Browser Session | 本机授权会话可用，无 cookie/session 外泄 | [ ] |
| T05 | Video Capture | 真实视频区域截图保存为 evidence | [ ] |
| T06 | Vision Classification | 真实截图得到本地 AI 结构化判断 | [ ] |
| T07 | Platform Actions | 有限动作可执行并可审计 | [ ] |
| T08 | Comment Capture | 产品候选评论区截图保存 evidence | [ ] |
| T09 | Comment Signals | OCR / 评论意图分析产出结构化信号 | [ ] |
| T10 | Candidate Generation | 生成真实 evidence-backed pending candidate | [ ] |
| T11 | Unattended Runtime | 可无人值守连续运行指定轮数/时长 | [ ] |
| T12 | Workbench Integration | 页面显示 Real Platform Mode 和真实候选 | [ ] |
| T13 | Safety Gates | 登录/验证码/风控/低置信度/连续失败可停机或 review | [ ] |
| T14 | Audit Enforcement | 第三阶段关键边界进入审计 | [ ] |
| T15 | Manual Verification | 第三阶段关键边界通过本机实测与执法证据验证 | [ ] |
| T16 | Manual Live Test | 完成一次真实平台实测记录 | [ ] |
| T17 | Acceptance Report | 第三阶段验收报告落盘 | [ ] |

---

## 4. 详细任务

### T00 — 现状验证

- [ ] `npm run typecheck`
- [ ] `npm run audit`
- [ ] `npm run build`
- [ ] `npm run grasseye:start`
- [ ] 确认 Workbench 可打开
- [ ] 确认第二阶段没有阻塞第三阶段的 P0 问题

完成标准：typecheck、audit、build、grasseye:start 命令通过，或真实阻塞被修复。

---

### T01 — 第三阶段文件落位

- [ ] `docs/阶段目标/phase-03-真实单平台无人值守Agent建设目标.md`
- [ ] `docs/TODO/phase-03-TODO.md`
- [ ] `docs/Codex提示词/phase-03-codex-loop.md`
- [ ] 后续验收报告放入 `docs/验收报告/phase-03-acceptance-report.md`

完成标准：文件不散落根目录，不破坏路径治理法案。

---

### T02 — 首平台选择与入口探测

优先级：

1. Facebook Web / Facebook Reels / Facebook Watch
2. TikTok Web
3. YouTube Shorts

- [ ] 确认平台名称
- [ ] 确认入口 URL
- [ ] 确认可由本机浏览器打开
- [ ] 确认用户可手动登录
- [ ] 确认视频区域可见
- [ ] 确认评论区可打开
- [ ] 确认没有要求绕过验证码或风控
- [ ] 如果 Facebook 不可落地，记录原因并切换备选平台

完成标准：确定一个真实首平台，不停留在抽象研究。

---

### T03 — RealPlatformAdapter

- [ ] 在 `src/features/platform-action/adapters/` 建立真实平台 adapter
- [ ] 不覆盖 fixture adapter
- [ ] 平台 DOM / selector / 坐标只存在于 adapter 内部
- [ ] AgentRuntime 不直接依赖平台页面结构
- [ ] Adapter 输出结构化 ActionResult
- [ ] 所有动作绑定 action log

完成标准：真实平台差异被 PlatformAdapter 收敛。

---

### T04 — Browser Session 策略

- [ ] 使用本机授权浏览器或 Playwright local userDataDir
- [ ] 允许用户手动登录
- [ ] 不读取浏览器密码
- [ ] 不导出 cookie/session/token
- [ ] 登录异常进入 operator review
- [ ] 验证码出现则 stop/review，不绕过

完成标准：本地授权会话可用，且不外泄凭据。

---

### T05 — Video Region Capture

- [ ] 定位真实视频区域
- [ ] 截视频区域，不截整屏敏感区域
- [ ] 保存 video evidence artifact
- [ ] 绑定 taskRunId / roundId
- [ ] 截图失败进入 retry/skip/review

完成标准：至少保存 1 张真实网页视频截图 evidence。

---

### T06 — Vision Classification

- [ ] 真实截图进入 Local AI Gateway
- [ ] 使用受治理 promptVersion / schemaVersion
- [ ] 输出 classification / confidence / reason / suggestedAction
- [ ] 低置信度不能强行动作
- [ ] non-product 不得生成 candidate

完成标准：真实截图完成一次本地 AI 判断。

---

### T07 — Platform Actions

允许：

- [ ] scroll / continue next
- [ ] open video
- [ ] screenshot video area
- [ ] click not interested
- [ ] like or save candidate
- [ ] open comments
- [ ] screenshot comments
- [ ] return / continue

禁止：

- [ ] 自动评论
- [ ] 自动私信
- [ ] 自动关注
- [ ] 账号池 / 代理池 / 指纹伪装
- [ ] 验证码绕过

完成标准：至少一次真实平台动作执行并写入 action log。

---

### T08 — Comment Capture

- [ ] 仅产品候选打开评论区
- [ ] 评论区截图保存为 evidence
- [ ] 支持有限评论滚动，不无限抓取
- [ ] 不采集私信或非公开内容
- [ ] 评论 evidence 绑定 source video evidence

完成标准：至少保存 1 张真实评论区 evidence，若平台不可用必须写明原因。

---

### T09 — OCR / Comment Signals

- [ ] 评论截图进入 OCR 或当前本地 OCR fallback
- [ ] OCR 文本保留不确定性
- [ ] 评论理解使用 Local AI Gateway
- [ ] 输出 purchaseIntent / painPoints / complaints / demandTerms
- [ ] 不做个人画像，不追踪评论用户

完成标准：至少一次评论 evidence 生成 comment signal。

---

### T10 — Candidate Generation

- [ ] 只有 product_video + 有效 evidence 才能生成 candidate
- [ ] candidate 包含 sourcePlatform / sourceVideoId / evidenceRefs
- [ ] candidate 默认 pending review
- [ ] candidate 不自动 approve
- [ ] non-product evidence 不进入 candidate source

完成标准：至少 1 条真实 evidence-backed candidate 进入 Workbench。

---

### T11 — Unattended Runtime

- [ ] 支持 maxRounds
- [ ] 支持 maxRuntimeMinutes
- [ ] 支持 dwell time / rate limit
- [ ] 支持 pause / stop
- [ ] 支持连续失败阈值
- [ ] 至少连续观察 5 个真实视频
- [ ] 运行期间持续写 action log

完成标准：人工启动后可无人值守跑完指定轮数。

---

### T12 — Workbench Integration

页面必须显示：

- [ ] Real Platform Mode / Fixture Mode
- [ ] 当前平台
- [ ] 当前 adapter
- [ ] Agent 状态
- [ ] 当前轮次
- [ ] 当前 action
- [ ] Candidate Pool
- [ ] Evidence Preview
- [ ] Action Logs
- [ ] Start / Pause / Stop
- [ ] maxRounds / maxRuntime 配置
- [ ] 中英文切换继续可用

完成标准：用户能看出 Agent 是否真的在真实平台运行。

---

### T13 — Safety Gates

- [ ] 登录页：pause + operator review
- [ ] 验证码：stop + operator review
- [ ] 异常跳转：stop/review
- [ ] 页面结构无法识别：skip/review
- [ ] AI 低置信度：skip/review
- [ ] 连续失败超过阈值：stop
- [ ] 超时：stop
- [ ] 所有停止原因进入 action log

完成标准：Agent 不在未知状态乱点。

---

### T14 — Tests

至少补：

- [ ] real adapter contract test
- [ ] browser session config test
- [ ] video capture result schema test
- [ ] safety gate test
- [ ] non-product no candidate test
- [ ] max rounds unattended runtime test
- [ ] workbench real mode display test
- [ ] API snapshot real platform fields test

完成标准：`npm test` 通过，能阻止关键漂移。

---

### T15 — Audit Enforcement

至少补：

- [ ] platform-action inspector 检查真实 adapter 落位
- [ ] security-privacy inspector 检查无 cookie/session/token 泄露
- [ ] local-app-shell inspector 检查 Real/Fixture Mode 显示
- [ ] agent-runtime inspector 检查 maxRounds / pause / stop
- [ ] product-signal inspector 检查 non-product 不生成 candidate
- [ ] code-topology inspector 检查真实 adapter 不散落

完成标准：`npm run audit` 通过，或真实 gap 明确报告。

---

### T16 — Manual Live Test

必须记录：

- [ ] 平台名称
- [ ] 入口 URL
- [ ] 登录方式
- [ ] 运行轮数
- [ ] 运行时长
- [ ] 视频截图数量
- [ ] 评论截图数量
- [ ] candidate 数量
- [ ] skip 数量
- [ ] error 数量
- [ ] 是否触发风控
- [ ] 是否需要每轮人工干预
- [ ] 是否生成至少 1 条真实 candidate

完成标准：至少一次真实平台无人值守运行完成。

---

### T17 — Acceptance Report

- [ ] 创建 `docs/验收报告/phase-03-acceptance-report.md`
- [ ] 写入命令结果
- [ ] 写入真实平台实测结果
- [ ] 写入风险和未完成项
- [ ] 明确 PASS / NOT PASS

完成标准：第三阶段是否完成有证据，不靠口头宣布。

---

## 5. 第三阶段验收命令

必须运行：

```bash
npm run typecheck
npm test
npm run audit:build
npm run audit
npm run build
npm run grasseye:start
```

如果新增：

```bash
npm run verify:phase3
npm run demo:phase3
```

也必须运行。

---

## 6. 第三阶段失败定义

出现以下任一项，不得宣称第三阶段完成：

- 仍然只跑 fixture 数据。
- 真实平台 adapter 没有接入。
- 不能截图真实视频。
- 不能连续无人值守运行。
- non-product 仍生成 candidate。
- 无法停止 / 暂停。
- 页面不显示真实平台模式。
- 每轮都需要人工点击。
- 出现验证码仍试图绕过。
- 自动评论 / 私信 / 关注。
- cookie/session/token 泄露。
- audit 有未解释 gap。
- 用测试冒充真实平台完成。

---

## 7. 完成声明格式

```txt
第三阶段验收状态：PASS / NOT PASS
真实平台：
入口：
运行轮数：
生成候选数量：
视频证据数量：
评论证据数量：
是否触发风控：
是否需要人工每轮干预：
audit 状态：
未完成项：
风险：
```
