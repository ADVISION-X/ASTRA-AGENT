# GrassEye Route Plan 肌肉记忆施工图

## 0. 文件定位

本文件是 GrassEye 生产自动化路线、肌肉记忆、能力组交接边界的权威施工图。

本文件只治理：

- Route Plan 如何调度肌肉记忆。
- 地图与 Route Plan 的边界。
- 肌肉记忆与能力组的边界。
- 能力组之间的结果交接合同。
- 产品发现路线中的评论链、下一条视频链、证据链。

本文件不治理：

- Nerve Bus 的 Envelope 运输细节。
- AI 模型执行细节。
- Forensics 存储实现细节。
- 各能力组内部 runtime 细节。
- 商业最终判断、采购判断、广告判断、上架判断。

一句话：

> Route Plan 是肌肉记忆的调度源，不是地图，不是能力组，不是神经系统，不是商业大脑。

---

## 1. 核心总纲

### 1.1 地图、Route Plan、肌肉记忆、能力组的关系

地图是路线入口。

Route Plan 是肌肉记忆调度源。

能力组是稳定身体器官。

子能力是器官内的具体动作。

端口/适配器是真实执行接触层。

```txt
地图 = 任务入口 + AI 交付 + routePlanId
Route Plan = routeLabel -> 肌肉动作链
肌肉记忆 = 可复用动作链
能力组 = 稳定能力边界
子能力 = 具体动作
端口/适配器 = 真实执行
```

### 1.2 最强边界

```txt
地图不是脚本。
地图不是采样流程。
地图不是动作链。
地图不是肌肉记忆。
地图不得复制 Route Plan 已经拥有的步骤、transition、routeLabel 或动作链。
```

```txt
Route Plan 是调度肌肉记忆的唯一来源。
Route Plan 只根据 routeLabel 选择步骤链。
Route Plan 不理解页面语义。
Route Plan 不判断产品价值。
Route Plan 不执行动作。
Route Plan 不写证据。
```

```txt
能力组只守自己的身体边界。
AI 只判断可见内容和输出结构化候选。
Visual Target 只定位目标。
Geometry Guard 只校验坐标安全。
Mouse Click 只执行点击。
Post-action Verification 只生成动作后观察包。
Forensics 只记账和保存证据。
```

---

## 2. 生产地图红线

生产自动化地图必须使用 `routePlanBoundMap`。

地图只能声明：

- 入口步骤。
- AI 步骤。
- Prompt Contract 引用。
- `routePlanId`。
- 必要任务元信息。

地图不得声明：

- 评论打开链。
- 点击链。
- 截图采样链。
- 证据保存链。
- 下一条视频链。
- routeLabel 对应动作链。
- 任何 frame-specific 采样细节。
- 任何平台特化动作流程。

生产地图中出现以下内容，视为边界泄漏：

```txt
capture-video-frame-3s
capture-video-frame-6s
prepare-ai-input-frame-3s
prepare-ai-input-frame-6s
promptInputRefFrame3s
promptInputRefFrame6s
screenshotEvidenceRefFrame3s
screenshotEvidenceRefFrame6s
comments opening chain
next video scroll chain
evidence persistence chain
```

产品存在判断的默认 Route Plan 主链必须保持轻量：

```txt
capture-startup-video-viewport
-> prepare-startup-ai-input
-> startup-preparation
-> capture-current-video-viewport
-> prepare-current-video-ai-input
-> judge-seeding-video
```

其中 `capture-current-video-viewport -> prepare-current-video-ai-input` 只允许承载轻量观察输入；不得把 3s / 6s / 10s 多帧采样重新拆回 Route Plan。AI 只消费轻量输入，只有 `product_yes` / `read-comments-and-save-evidence` 分支成立后，后续高质量证据截图链才允许展开。

TikTok、Facebook 等平台必须共享同一类弱地图边界。不得为了某个平台单独把动作链写进地图。

---

## 3. Route Plan 单一来源

产品发现默认肌肉记忆定义在：

```txt
src/map-plugins/route-plans/product-discovery-route-plan.constants.ts
src/map-plugins/route-plans/product-discovery-route-plan.v1.ts
```

这两个文件共同定义：

- 用户二元选项清单。
- 默认正向 routeLabel。
- 默认负向 routeLabel。
- routeLabel 到步骤链的匹配表。
- 每个步骤要调用的能力组和子能力。
- 每条肌肉动作链的顺序。

地图包只能引用：

```json
"routePlanId": "product-discovery-route-plan.v1"
```

地图不得复制 `product-discovery-route-plan.v1` 中的步骤链。

---

## 4. AI 与 Route Plan 的关系

Prompt Contract 决定 AI 输出：

```txt
decision
routeLabel
reason
confidence
nonExecutableSummary
```

`nonExecutableSummary` 只能记账，不能调度。

AI 输出中禁止出现：

```txt
nextIntent
suggestedNextAction
actionIntent
action_intent
click instruction
scroll instruction
dispatch_action
browser action execution decision
```

Orchestration 只能机械匹配 `routeLabel`。

Orchestration 禁止：

- 根据 `decision` 推断动作。
- 根据 `reason` 推断动作。
- 根据 `nonExecutableSummary` 推断动作。
- 硬编码 `product_yes/product_no` 的下一步。
- 跳过 Route Plan 直接调度能力组。

---

## 5. 肌肉记忆金字塔

只谈“动”的环节时，结构如下：

```txt
第一层：肌肉记忆 / Route Plan 肌肉段
第二层：能力组
第三层：子能力
第四层：端口 / 适配器
```

解释：

```txt
肌肉记忆 = 可复用动作链。
能力组 = 身体器官。
子能力 = 具体动作。
端口/适配器 = 真实执行接触层。
```

示例：

```txt
评论打开肌肉：
  observe-comments-button
  -> normalize-comments-target
  -> click-comments-button
  -> verify-comments-open
  -> capture-comments-panel
```

其中：

```txt
observe-comments-button 属于 Visual Target。
normalize-comments-target 属于 Geometry Guard。
click-comments-button 属于 Mouse Click。
verify-comments-open 属于 Post-action Verification / AI 语义验证链。
capture-comments-panel 属于 Screenshot / Evidence Capture 相关能力。
```

---

## 6. Muscle Joint Result Contracts

### 6.1 定义

肌肉关节结果合同，是能力组之间的标准结果交接口径。

它不是新能力组。

它不是新 owner。

它不是新神经系统。

它不是全局 Handoff 平台。

它不是 Nerve Bus 的语义职责。

它只是把各能力组 public result 中已经存在的交接关系标准化。

### 6.2 总链路

所有涉及“看见 -> 定位 -> 坐标 -> 动作 -> 验证”的肌肉链，必须遵守：

```txt
AI Candidate Result
-> Visual Target Result
-> Geometry Guard Result
-> Mouse Click Result
-> Post Action Verification Result
```

这五段不是新的执行链，而是现有能力组结果之间的标准交接节奏。

### 6.3 主权归属

```txt
AI Candidate Result
归 AI 能力组。
AI 只输出候选，不执行动作。

Visual Target Result
归 Visual Target 能力组。
Visual Target 只确认目标，不判断坐标是否可执行。

Geometry Guard Result
归 Geometry Guard 能力组。
Geometry Guard 只判断坐标是否安全可执行，不选择目标，不点击。

Mouse Click Result
归 Mouse Click 能力组。
Mouse Click 只代表 primitive click 执行结果，不代表页面结果成功。

Post Action Verification Result
归 Post-action Verification 能力组。
PAV 只代表动作后观察包构建结果，不代表最终商业判断。
```

### 6.4 Nerve Bus 边界

Nerve Bus 只运输 ResultEnvelope。

Nerve Bus 禁止：

- 定义 Muscle Joint Result Contracts。
- 解释 Muscle Joint Result Contracts。
- 修改 Muscle Joint Result Contracts。
- 验证业务字段。
- 根据 result 内容决定下一步。
- 理解 AI Candidate / Target / Coordinate / Click / Verify 的业务含义。

一句话：

> 神经只传，不懂，不改，不判断。

### 6.5 Route Plan 边界

Route Plan 只串联 result refs。

Route Plan 禁止：

- 展开 bbox。
- 展开 clickPoint。
- 展开 normalizedClickPoint。
- 解释 AI 候选内容。
- 解释坐标安全。
- 解释点击结果。
- 解释页面是否打开。
- 根据 Result 内部字段推断动作。

Route Plan 只允许：

```txt
上一步 result ref
-> 下一步 input ref
```

### 6.6 评论打开肌肉结果链

评论打开肌肉必须按以下标准结果链执行：

```txt
AI Candidate Result
-> Visual Target Result
-> Geometry Guard Result
-> Mouse Click Result
-> Post Action Verification Result
-> capture-comments-panel
```

在这条结果链里，Route Plan 只传递以下肌肉关节结果 refs：

```txt
aiResultRef
visualTargetResultRef
geometryGuardResultRef
clickResultRef
postActionVerificationResultRef
```

禁止链路：

```txt
AI Candidate Result -> Mouse Click
Visual Target Result -> Mouse Click
Mouse Click success -> capture-comments-panel
Mouse Click success -> comments panel opened
```

---

## 7. 标准结果合同要求

### 7.1 AI Candidate Result

生产者：

```txt
AI ability group
```

典型 Prompt Contract：

```txt
vision.commentsEntryTargetCandidate.v1
```

允许输出：

```txt
targetCandidates[]
candidateId
targetType
coordinateSpace
boundingBox
clickPoint
confidence
visibleText
evidenceObservations
uncertainty
nonExecutableSummary
```

禁止输出：

```txt
click instruction
scroll instruction
dispatch_action
routeLabel
comments intent judgment
browser action execution decision
```

AI Candidate Result 是非执行结果，只能作为 Visual Target 的候选输入。

---

### 7.2 Visual Target Result

生产者：

```txt
Visual Target ability group
```

Visual Target 成功结果必须输出标准 `VisualTargetResult`。

Action target 成功时必须包含：

```txt
visualTargetResultRef
sourceCandidateRef
sourceScreenshotEvidenceRef
sourceScreenshotProofRef
sourceAiResultRef
sourceAiProofRef
sourcePageStateProofRef
targetType
targetNature
coordinateSpace
boundingBox
candidateClickPoint
confidence
notExecutableUntilGeometryGuard = true
geometryGuardHandoffRequired = true
geometryGuardHandoffRef
geometryGuardHandoff
runtimeProof
```

`geometryGuardHandoff` 必须包含：

```txt
sourceVisualTargetResultRef
sourceTargetRef
sourceScreenshotEvidenceRef
sourceAiResultRef
sourcePageStateProofRef
bbox
clickPoint
coordinateSpace
targetType
targetNature
confidence
dataQualityFlags
```

Visual Target 禁止输出：

```txt
safeToClick
canClick
clickAllowed
executionAllowed
geometryVerified
verificationDecision
```

Visual Target Result 是非可执行目标结果。只有 Geometry Guard 能把它转成可执行坐标。

---

### 7.3 Geometry Guard Result

生产者：

```txt
Geometry Guard ability group
```

Geometry Guard `allow` 成功结果必须输出标准 `GeometryGuardResult`。

必须包含：

```txt
geometryGuardRef
geometryGuardProofRef
geometryGuardOutputRef
geometryGuardRuntimeProofRef
sourceVisualTargetResultRef
sourceTargetRef
sourceScreenshotEvidenceRef
sourceAiResultRef
sourcePageStateProofRef
normalizedCoordinateSpace
normalizedClickPoint
normalizedBbox
guardDecision = allow
riskLevel
requiresPostClickAiVerification
dataQualityFlags
runtimeProof
```

Geometry Guard 禁止：

- 选择视觉目标。
- 规划动作。
- 执行点击。
- 解释页面语义。
- 做 PAV 判断。
- 写 Forensics。
- 从 AI / contactSheet / imageEvidence 直接放行可执行坐标。
- 静默 clamp 坐标。
- 猜测 deviceScaleFactor。

Geometry Guard Result 是 Mouse Click 可执行坐标的唯一来源。

---

### 7.4 Mouse Click Result

生产者：

```txt
Mouse Click ability group
```

Mouse Click success 只代表 primitive click 已执行或被底层端口接受。

Mouse Click success 必须输出标准 `MouseClickResult`。

必须包含：

```txt
clickResultRef
actionExecutionRef
primitiveExecutionRef
geometryGuardRef
geometryGuardProofRef
sourceCoordinateProofRef
sourceTargetRef
sourceVisualTargetResultRef
normalizedClickPoint
coordinateSpace
button
clickCount
postActionVerificationRequired = true
postActionVerificationHandoffRef
runtimeProof
```

Mouse Click 禁止输出：

```txt
commentsPanelOpened
pageStateVerified
verificationDecision
actionResultVerifiedRef
finalActionLogRef
browserActionResult
fallbackUsed
retryCount > 0
```

Mouse Click success 不等于评论面板打开。

Mouse Click success 必须交给 PAV 或 AI 后续验证链确认结果。

---

### 7.5 Post Action Verification Result

生产者：

```txt
Post-action Verification ability group
```

PAV success 只代表动作后观察包构建成功，不代表最终语义动作成功。

PAV 标准结果必须包含：

```txt
postActionVerificationResultRef
sourceActionResultRef
sourceActionRuntimeProofRef
sourceActionAbilityGroupId
sourceActionChildCapabilityId
expectedOutcome
beforeEvidenceRefs
afterEvidenceRefs
observationRefs
supportingSourceProofRefs
observationFingerprint
packageStatus = built | failed | review_required
runtimeProof
```

PAV 禁止输出：

```txt
verificationDecision
confidence
confidencePolicy
minimumConfidence
actionResultVerifiedRef
finalSemanticTruth
businessTruth
```

当任务需要最终语义 yes/no 时，AI 是最终语义判断来源。

---

## 8. 当前产品发现默认路线

### 8.1 product_yes

AI 默认输出：

```txt
routeLabel = read-comments-and-save-evidence
```

匹配肌肉链：

```txt
observe-comments-entry-page-state
-> analyze-comments-entry-target-candidate
-> observe-comments-button
-> normalize-comments-target
-> click-comments-button
-> verify-comments-open
-> capture-comments-panel
-> extract-visible-comments
-> write-seeding-evidence-record
-> finalize-seeding-evidence-packet
-> finalize-seeding-browse-ledger
-> observe-next-item-page-state
-> press-next-video-key
-> capture-next-item-verification-viewport
-> prepare-next-item-verification-ai-input
-> verify-next-item-advanced
-> capture-current-video-viewport
```

### 8.2 product_no

AI 默认输出：

```txt
routeLabel = skip-current-video
```

匹配肌肉链：

```txt
observe-next-item-page-state
-> press-next-video-key
-> capture-next-item-verification-viewport
-> prepare-next-item-verification-ai-input
-> verify-next-item-advanced
-> capture-current-video-viewport
```

### 8.3 product_yes 关节结果链

`read-comments-and-save-evidence` 必须满足：

```txt
AI Candidate Result
-> Visual Target Result
-> Geometry Guard Result
-> Mouse Click Result
-> Post Action Verification Result
-> Screenshot / Evidence Capture Result
-> Forensics Evidence Record
```

不允许：

```txt
AI Candidate Result -> Mouse Click
Visual Target Result -> Mouse Click
Mouse Click Result -> capture-comments-panel
Mouse Click success -> comments panel opened
```

`click-comments-button:success` 必须后接：

```txt
verify-comments-open
```

只有动作后观察包或 AI 语义验证链确认后，才能进入：

```txt
capture-comments-panel
```

---

## 9. Advance Next Item Muscle

`click-next-video-arrow` 是当前 product_no 的肌肉记忆意图名。

Route Plan 不为 Facebook / TikTok 分叉第二条平台动作链。

下一条视频肌肉必须遵守：

- `normalize-next-video-arrow` 不得只靠 `screenshotEvidenceRef` + deterministic viewport geometry。
- Next-item target identity must come from AI target candidate, governed visual target result, or fallback policy explicitly marked high-risk.
- deterministic next-arrow geometry is fallback-only, never normal path.
- fallback must require post-click AI verification.
- `click-next-video-arrow` mechanical success does not equal next-item semantic success.
- `click-next-video-arrow:success` must be followed by visible-state capture and verification before the next round is treated as advanced.
- loop guard block must not be finalized as normal completed unless reason is run limit reached.

下一条视频肌肉也必须逐步迁移到同一关节结果合同：

```txt
AI Candidate Result
-> Visual Target Result
-> Geometry Guard Result
-> Mouse Click Result
-> Post Action Verification Result
```

---

## 10. Forensics 与 Evidence Report 边界

GrassEye 本地 Agent 不是商业最终决策 Agent。

GrassEye 本地 Agent 是：

```txt
线索收集器
证据取证器
结构化报告生成器
```

Forensics 只记发生过的证据。

Forensics 不负责：

- 产品最终判断。
- 利润判断。
- 供应链判断。
- 采购判断。
- 广告判断。
- 上架判断。
- 商业机会最终结论。

最终产物应是：

```txt
Evidence Report
```

Evidence Report 必须适合高级 AI 二次分析。

本地报告可以包含：

```txt
视频截图 refs
AI product presence result
AI target candidate result
Visual Target result
Geometry Guard result
Mouse Click result
PAV result
评论截图 refs
评论清洗结果
browse ledger
evidence packet
dataQualityFlags
uncertainty
nonExecutableSummary
```

本地报告不得包含：

```txt
采购决定
广告决定
上架决定
利润判断
供应链判断
爆品判断
final commercial decision
```

高级 AI / 人类负责最终商业判断。

---

## 11. 执法要求

执法必须失败以下情况：

### 11.1 地图越界

- 地图缺少必须的 `routePlanId`。
- 地图重新写入 Route Plan 已经拥有的步骤。
- 地图复制评论链、点击链、证据链、下一条视频链。
- 地图出现 frame-specific 采样细节。
- 地图写动作链。
- 地图写 routeLabel -> action chain。

### 11.2 Route Plan 越界

- Route Plan 缺少 `routeLabel -> step chain`。
- Prompt 或运行时硬编码 routeLabel，而不是引用 Route Plan 常量。
- Orchestration 根据 `decision` 推断动作。
- Orchestration 根据 `reason` 或 `nonExecutableSummary` 推断动作。
- 自动化路线进入人工审查。
- Route Plan 在 first AI step 前插入登录、安全墙、Feed、视频页语义判断。
- Route Plan 展开 bbox、clickPoint、normalizedClickPoint 等能力组内部字段。
- Route Plan 跳过 result refs 直接消费下游字段。

### 11.3 肌肉关节越界

- AI 直接输出 click / scroll / action instruction。
- Mouse Click 直接消费 AI bbox / clickPoint。
- Mouse Click 直接消费 Visual Target bbox / clickPoint。
- Geometry Guard 选择视觉目标。
- Visual Target 声称坐标可执行。
- Mouse Click 声称页面动作结果成功。
- PAV 声称最终语义动作成功。
- Nerve Bus 解释、修改、验证 Handoff / Result 合同。
- 新增 Handoff Owner。
- 新增 Handoff Ability Group。
- 新增 Handoff Registry。
- 新增全局 Handoff Runtime。

### 11.4 证据链越界

- Click success 直接进入 comments capture。
- 没有 verify-comments-open 就 capture-comments-panel。
- Mouse Click success 被当作 comments panel opened。
- PAV success 被当作最终语义成功。
- Forensics 构造商业结论。

---

## 12. CI-FULL 验收标准

CI-FULL 必须证明：

```txt
法案文件
-> 施工图
-> Route Plan
-> Ability Group
-> 子能力
-> 运行代码
```

在以下方面一致：

1. `ci:full` 是唯一完整质检入口。
2. 地图只绑定入口与 `routePlanId`。
3. Route Plan 是肌肉记忆唯一来源。
4. Orchestration 只机械匹配 `routeLabel`。
5. AI 只输出候选和语义判断，不输出动作。
6. Visual Target 输出非可执行 Target Result。
7. Geometry Guard 输出唯一可执行坐标安全 Result。
8. Mouse Click 只消费 Geometry Guard Result。
9. Mouse Click success 必须产生 PAV handoff。
10. PAV 只产动作后观察包，不产最终语义判断。
11. Forensics 只记证据，不做商业结论。
12. Route Plan 只串 result refs，不展开能力组内部字段。
13. Nerve Bus 只运输 ResultEnvelope。
14. 没有新增 Handoff owner / ability group / registry。
15. 评论打开肌肉必须完整通过：
    ```txt
    AI Candidate Result
    -> Visual Target Result
    -> Geometry Guard Result
    -> Mouse Click Result
    -> Post Action Verification Result
    -> capture-comments-panel
    ```

---

## 12.5 调试前观测要求

所有 “看见 -> 定位 -> 坐标 -> 动作 -> 验证” 肌肉链，进入真实平台调试前，必须具备：

```txt
1. Mission Step Trace
2. Joint Chain Checkpoint
3. Failure Snapshot
```

这些观测物不是 Route Plan 的第二职责。Route Plan 仍然只声明 step chain 和 result refs；Orchestration 在运行时生成观测记录，Forensics 只保存。

```txt
Route Plan 只串 step 和 result refs。
Route Plan 不解释 jointCheckpoint。
Route Plan 不生成 failureSnapshot。
```

评论按钮链必须能看到：

```txt
AI Candidate Result: exists/missing/not_applicable
Visual Target Result: exists/missing/not_applicable
Geometry Guard Result: exists/missing/not_applicable
Mouse Click Result: exists/missing/not_applicable
Post Verify Result: exists/missing/not_applicable
Comments Panel Capture: exists/missing/not_applicable
```

失败时必须能看到：

```txt
failedStepId
failedJointStage
missingInputRefKeys
lastSuccessfulResultRef
screenshotEvidenceRef
aiResultRef
visualTargetResultRef
geometryGuardResultRef
clickResultRef
postActionVerificationResultRef
commentsEvidenceRef
```

禁止：

```txt
Route Plan 解释 jointStage
Route Plan 解释 jointCheckpoint
Route Plan 生成 failureSnapshot
Route Plan 用日志字段驱动分支
Mission Step Trace 替代 result contract
```

---

## 13. 最终红线

```txt
地图不得变脚本。
Route Plan 不得变大脑。
AI 不得变手。
Visual Target 不得变 Geometry Guard。
Geometry Guard 不得变 Mouse Click。
Mouse Click 不得变 PAV。
PAV 不得变 AI。
Forensics 不得变商业判断。
Nerve Bus 不得变解释器。
Handoff 不得变新 owner。
```

一句话：

> 地图给路线，Route Plan 调肌肉，能力组产结果，神经只运输，Forensics 只记账，高级 AI 才做商业判断。
