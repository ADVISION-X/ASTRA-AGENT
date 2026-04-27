# Codex 循环治理提示词：GrassEye 第二阶段 100% TODO 完成

你现在进入 GrassEye 第二阶段执行任务。

你的唯一目标：

> 按照《GrassEye 第二阶段 TODO 计划》持续执行、修复、验证、更新，直到 TODO 清单 100% 完成。

你不能以“完成部分任务”“建议下一轮”“等待人工继续”“后续再做”作为结束。

唯一结束条件：

```txt
GrassEye 第二阶段 TODO 计划中所有 checkbox 全部完成，
第二阶段建设目标方案中的验收标准全部 PASS，
最终完成报告完整输出。
```

---

## 1. 必读文件

开始前必须读取并建立执行基线：

```txt
.github/instructions/cursor-rules/GRASSEYE-KERNEL.instructions.md
.github/instructions/cursor-rules/grasseye-index.instructions.md
.github/instructions/cursor-rules/modules/**/*.instructions.md
docs/法案辅助文件/**/*.md
GrassEye 第二阶段建设目标方案.md
GrassEye 第二阶段 TODO 计划.md
```

如果 TODO 文件尚未放入仓库，请先创建：

```txt
docs/GrassEye 第二阶段 TODO 计划.md
```

并把用户提供的 TODO 内容完整写入。

---

## 2. 最高治理原则

必须遵守“大道至简”：

- 单一：一个文件只做一件事，一个能力只归一个 owner。
- 直接：主链短，不搭第二链，不造平行实现。
- 真实：不假通过，不假数据，不假闭环。
- 可删除：无主、重复、越权、漂移、旧壳、伪逻辑必须删除或重构。

本轮是第二阶段实现，不是继续扩法案。

法案与施工图是权威，不是待你随便改写的说明文。

---

## 3. 本轮允许建设的方向

只允许建设第二阶段最小真实闭环：

```txt
Local Operator Console
→ Local Agent Service
→ BrowserController
→ Single PlatformAdapter
→ Video Region Evidence
→ Local AI Gateway
→ VisionClassificationResult
→ Governed Platform Action
→ Comment Evidence / OCR
→ CommentSignalResult
→ ProductOpportunityCandidate
→ Operator Review
→ Local Evidence Store
```

允许根据项目需要修改：

```txt
src/**
scripts/**
docs/**
package.json / lockfile / config files
local test fixtures
local validation scripts
```

但所有修改必须遵守 law / blueprint / TODO。

---

## 4. 本轮禁止方向

严禁：

- 把 GrassEye 写成 SaaS。
- 建远程浏览器托管服务。
- 保存、导出、上传 cookie / session / token / password。
- 默认公网暴露 local console / agent service / evidence store。
- 让 UI 直接调用 Playwright、local AI、数据库真相。
- 让 Core 直接写平台 selector、裸坐标、平台 DOM 细节。
- 多平台同时扩张。
- 自动评论、私信、关注、批量点赞、账号切换。
- 账号池、代理池、指纹伪装、验证码绕过、风控绕过。
- 本地 AI 失败后 silent fallback 到 paid/cloud API。
- Product Signal 输出采购、上架、广告投放决定。
- 提前建设 Electron / Tauri / SwiftUI 正式业务壳。
- 以 fixture、mock、demo 冒充生产真相。
- 留下 TODO、FIXME、HACK、XXX、假 PASS、空实现、伪闭环。

---

## 5. 执行循环

你必须按以下循环持续执行，直到 TODO 100% 完成：

### Loop Step 1：读取当前 TODO 状态

读取 `docs/GrassEye 第二阶段 TODO 计划.md`。

找出所有未完成 checkbox。

按编号顺序执行：T00 → T01 → T02 → ... → T13。

不得跳到后面做炫技功能。

---

### Loop Step 2：选择当前最小任务

每次只选择当前编号下最小可完成任务。

执行前说明：

```txt
当前任务编号：
当前任务目标：
允许修改范围：
禁止修改范围：
预期验收证据：
```

---

### Loop Step 3：执行实现

实现时必须：

- 使用现有 law / blueprint 决定路径。
- 新文件先判断 owner 和 canonical root。
- 跨域数据先建 type / schema。
- 外部不确定输入进入 unknown 后验证。
- AI 输出必须 schema validation。
- 平台动作必须经过 BrowserController / PlatformAdapter。
- 数据写入必须带 evidenceRef。
- 操作者 review 必须可见。

---

### Loop Step 4：验证

每完成一组相关任务，必须运行项目中可用的验证命令。

至少包含可用范围内的：

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

如果项目没有这些命令，你必须：

1. 检查 package.json。
2. 使用项目已有等价命令。
3. 如缺少必要命令，补充最小验证脚本。
4. 不能因为没有命令就跳过验证。

验证失败必须继续修复，不能把失败留到下一轮。

---

### Loop Step 5：更新 TODO

任务真实完成并验证后，才能把对应 checkbox 改成 `[x]`。

禁止：

- 没验证就勾选。
- 只写文件不运行就勾选。
- 只完成 happy path 就勾选。
- 把 blocker 当完成。

---

### Loop Step 6：继续循环

继续找下一个未完成 checkbox。

如果还有任何 checkbox 是 `[ ]`，你必须继续执行。

不得输出“下一轮建议”后结束。

---

## 6. 验证与审计要求

最终必须完成以下验证：

### 6.1 类型与质量

- TypeScript strict 通过。
- 无 `any`。
- 无 `as any`。
- 无 hidden any escape。
- 无 TODO / FIXME / HACK / XXX。

### 6.2 边界搜索

必须搜索并确认没有：

```txt
cloud AI fallback
paid AI fallback
OpenAI / Anthropic / Gemini paid SDK 偷渡
cookie export
session export
token logging
proxy pool
account pool
fingerprint spoofing
captcha bypass
remote browser service
Electron/Tauri/SwiftUI business shell
```

### 6.3 主链验证

必须证明：

- Local console 可启动。
- Local agent service 可启动。
- BrowserController 被使用，而不是 UI/Core 直接操作浏览器。
- PlatformAdapter 承接单平台页面动作。
- Local AI Gateway 承接 AI 任务。
- Evidence Store 能保存并删除证据。
- ProductOpportunityCandidate 可进入 review。
- Operator Console 能查看证据并处置候选。

### 6.4 安全隐私验证

必须证明：

- 不导出 cookie/session/token。
- 不读取浏览器密码。
- 不采集私信或非公开页面。
- 本地服务不默认公网暴露。
- 日志不打印敏感凭据。
- 数据删除真实生效。

---

## 7. Fixture 使用规则

允许使用本地 fixture 页面或本地 fixture provider 做测试，但必须遵守：

- fixture 只能用于测试和本地验证。
- fixture 必须明确标记为 fixture。
- fixture 不能冒充真实平台数据。
- fixture 不能绕过 production 边界。
- fixture 不能让 TODO 假通过。

如果真实平台登录或页面状态无法在自动环境中验证，必须保留：

- adapter contract 测试
- fixture page 主链测试
- 人工授权页面运行说明
- 不得把 fixture 称为真实平台闭环

---

## 8. 最终完成报告格式

当且仅当 TODO 100% 完成后，输出：

# GrassEye 第二阶段最终完成报告

## 1. 完成结论

明确写：

```txt
第二阶段 TODO 是否 100% 完成：是 / 否
第二阶段目标是否全部 PASS：是 / 否
```

如果不是全部“是”，不得结束，必须继续修复。

## 2. TODO 完成矩阵

| 编号 | 模块 | 完成状态 | 验收证据 |
|---|---|---|---|

## 3. 修改文件清单

## 4. 新增文件清单

## 5. 删除文件清单

## 6. 主链验收结果

按链路输出：

```txt
Local Operator Console
→ Local Agent Service
→ BrowserController
→ Single PlatformAdapter
→ Video Region Evidence
→ Local AI Gateway
→ VisionClassificationResult
→ Governed Platform Action
→ Comment Evidence / OCR
→ CommentSignalResult
→ ProductOpportunityCandidate
→ Operator Review
→ Local Evidence Store
```

每一环必须写 PASS / FAIL。

## 7. 验证命令结果

列出所有命令、结果、失败修复记录。

## 8. 法案一致性检查

逐项说明是否违反：

- local-app-shell
- local-ai-runtime
- agent-runtime
- platform-action
- vision-boundary
- comment-intelligence
- product-signal
- local-data
- operator-control
- security-privacy
- code-topology
- type-safety
- audit-system

## 9. 禁止方向检查

逐项说明是否出现：

- SaaS
- remote browser
- browser extension as main shell
- CLI-only
- multi-platform expansion
- cloud AI fallback
- paid API fallback
- account/proxy/fingerprint/captcha bypass
- auto comment/message/follow/batch like
- auto procurement/listing/ads
- Electron/Tauri/SwiftUI premature business shell

## 10. 剩余风险

只允许写真实风险。

如果风险意味着 TODO 未完成，必须继续修复，不能结束。

## 11. 最终声明

只有在全部完成时才允许写：

```txt
GrassEye 第二阶段 TODO 已 100% 完成，第二阶段最小真实闭环已通过验收。
```

---

## 9. 结束规则

你不能因为以下原因结束：

- 上下文很长。
- 已经完成大部分。
- 需要用户下一轮确认。
- 还有几个 TODO 可以后面做。
- 验证命令失败。
- 某个模块暂时没有实现。
- fixture 跑通但真实边界没建立。

只有一个结束条件：

```txt
TODO 100% DONE + 验收标准 100% PASS + 最终报告完整输出。
```
