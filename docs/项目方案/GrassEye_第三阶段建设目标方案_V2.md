# GrassEye 第三阶段建设目标方案

版本：2.0  
定位：第三阶段完成态定义文件  
文件性质：阶段目标方案，不是 TODO，不是施工图，不是法案，不是验收报告  
当前阶段关键词：**取证、结构化日志、单条视频闭环、Browse Ledger / Evidence Packet 分层**  
核心目标：第三阶段完成后，GrassEye 必须能在本机真实浏览器中完成“打开页面 → 处理当前视频 → 取证或记录 → 切换下一个视频”的最小可证明 Agent 闭环。

---

## 1. 阶段结论

第三阶段不再以“完整无人值守真实网页 Agent MVP”为目标。

旧目标中的“长时间无人值守、多轮连续运行、完整候选池复核、单平台真实 Web Adapter 完整闭环”已经超出当前最小可交付边界，容易误导 Codex 过早扩张。

第三阶段当前唯一目标是：

> **把 GrassEye Agent 从法案和施工图推进到真实代码链路：在本机浏览器中，从打开目标页面开始，完成一条视频的观察、截图、AI 第一问、分支、结构化日志、Browse Ledger / Evidence Packet 归档、切换下一个视频，并用结构化日志证明全过程。**

第三阶段完成后，系统应该从：

```txt
法案与施工图清晰
```

升级为：

```txt
Agent 单条视频取证竖切链路可运行、可证明、可循环治理
```

---

## 2. 第三阶段一句话目标

```txt
人工启动 GrassEye 后，Agent 在本机真实浏览器中打开目标视频流，处理当前视频，截图并询问本地 AI 是否产品视频，根据结果生成 Browse Ledger 或 Evidence Packet，写入结构化日志，然后切换到下一个视频并进入下一条视频稳定等待状态。
```

---

## 3. 第三阶段核心主线

第三阶段只围绕这一条竖切链路建设：

```txt
TASK_START
→ OPEN_TARGET_PAGE
→ DETECT_LOGIN_OR_SAFETY
→ WAIT_FEED_READY
→ SINGLE_VIDEO_ROUND_START
→ WAIT_VIDEO_STABLE
→ IDENTIFY_CURRENT_VIDEO
→ CALIBRATE_GEOMETRY
→ SCREENSHOT_VIDEO_AREA
→ RECORD_VIDEO_EVIDENCE
→ ASK_AI_PRODUCT_PRESENCE
→ VALIDATE_AI_OUTPUT
→ BRANCH
→ FINALIZE_BROWSE_LEDGER / FINALIZE_EVIDENCE_PACKET / FINALIZE_FAILED_OR_REVIEW_RECORD
→ SCROLL_NEXT_VIDEO
→ WAIT_VIDEO_STABLE for next video
```

必须明确：

- `OPEN_TARGET_PAGE` 只发生在任务开始或显式恢复时。
- `SCROLL_NEXT_VIDEO` 后必须回到 `WAIT_VIDEO_STABLE`。
- 不允许 `SCROLL_NEXT_VIDEO` 后重新打开目标页面作为正常路径。
- 每个 round 必须有 `roundId`。
- 每条视频必须有 `videoVisitId`。
- 每个动作必须有结构化日志。
- 每个 round 必须 finalize 成以下之一：
  - `Product Discovery Evidence Packet`
  - `Lightweight Browse Ledger Entry`
  - `Explicit Failed / Review Record`

---

## 4. 第三阶段与旧目标的差异

| 项目 | 旧第三阶段口径 | 新第三阶段口径 |
|---|---|---|
| 核心目标 | 单平台真实网页无人值守 Agent MVP | 单条视频取证竖切链路可运行、可证明 |
| 运行范围 | 连续多轮无人值守 | 先证明打开页面到切下一个视频 |
| 数据模型 | 候选产品为中心 | Browse Ledger / Evidence Packet 分层 |
| 日志要求 | action log 可追踪 | StructuredRuntimeEvent + StructuredActionLog 作为运行真相 |
| 非产品视频 | 不进入 candidate | 默认进入 Browse Ledger，不生成 full packet |
| 产品视频 | 生成 candidate | 生成 Evidence Packet，candidate 只是 packet 内索引 |
| 高级 AI | 后期分析候选 | 当前阶段不实现高级 AI，只保证 packet 可投喂 |
| 平台选择 | 明确偏 Facebook Web | 不在阶段目标中绑定平台，真实 adapter 由当前实现与法案约束决定 |
| 验收方式 | test / build / launch | typecheck / verify / audit / ci / live proof，不使用 repository tests 作为质量真相 |
| 无人值守 | 第三阶段完成要求 | 暂不作为当前完成条件，先做受治理单链路闭环 |

---

## 5. 第三阶段不做什么

第三阶段不做以下内容：

```txt
完整长时间无人值守
多平台适配
高级 AI 产品选择
采购判断
利润判断
供应链判断
广告判断
爆款判断
自动上架
自动下单
自动评论
自动私信
自动关注
批量点赞
账号池
代理池
验证码绕过
风控绕过
指纹伪装
SaaS 化
Mac App 打包
完整候选池商业分析
```

第三阶段尤其不做：

```txt
让 Agent 从 1000 个产品视频中挑 5 个产品。
```

这是后期高级 AI 或人工分析阶段的任务，不属于 Agent 取证阶段。

---

## 6. 第三阶段必须做什么

第三阶段必须完成以下最小闭环。

### 6.1 Workbench 与 Runtime 可启动

必须做到：

- Local Workbench 可启动。
- Agent Runtime 可启动。
- Runtime Snapshot 可读取。
- 操作者可 Start / Stop。
- 本地服务不默认暴露公网。

### 6.2 打开真实目标页面

必须做到：

- Agent 能打开或连接本机真实浏览器页面。
- 页面打开动作写入结构化日志。
- 如果页面是 `about:blank` 或导航失败，必须写 failureReason。
- 不允许无限 running。

### 6.3 检测登录 / 验证码 / 安全页 / 未知 UI

必须做到：

- 识别 login wall / captcha / safety page / unknown UI。
- 出现上述状态时进入 `review_required`。
- 不绕过验证码。
- 不绕过登录保护。
- 不使用代理池、账号池、指纹伪装。

### 6.4 等待视频稳定

必须做到：

- 等待 feed ready。
- 等待当前视频 stable。
- 避免黑屏、加载中、空白页面截图。
- 如果超时，写 `skipped_unstable_video` 或 failed/review record。

### 6.5 识别当前视频

必须做到：

- 生成 `videoVisitId`。
- 记录当前 URL / screenshotHash / page hint。
- 防止重复截图、重复 AI 调用、重复点赞、重复 candidate。

### 6.6 几何校准

必须做到：

- 获取 viewport / screenshot 尺寸。
- 获取 geometry guard 状态。
- geometry mismatch 必须进入 review_required。
- 不允许 geometry 失败后继续盲点。

### 6.7 截图与证据记录

必须做到：

- 截图当前视频区域或 bounded viewport fallback。
- 生成 `videoEvidenceId`。
- 写入 Evidence Store。
- 截图记录必须绑定 `roundId`、`videoVisitId`、`sourceUrl`、`capturedAt`。

### 6.8 本地 AI 第一问

第一问固定：

```txt
Does this screenshot show a video that is demonstrating, featuring, using, unboxing, comparing, or clearly presenting a concrete product?
```

本地 AI 只判断：

```txt
是否产品视频
置信度
可见产品类型
画面证据观察
不确定性
建议下一步动作
```

本地 AI 不判断：

```txt
产品是否好卖
是否盈利
是否采购
是否投广告
是否爆款
是否值得做
```

如果本地 AI 不可用：

- 不允许 fake success。
- 必须写 `local_ai_unavailable`。
- 必须进入治理分支。

### 6.9 Schema Validation

AI 输出必须经过 schema validation。

不允许：

- free text 直接驱动动作。
- 未验证 JSON 驱动点击。
- 缺少 promptVersion / schemaVersion / evidenceRef 的 AI 结果进入下游。

### 6.10 分支处理

#### product_yes_high_confidence

必须进入产品取证路径：

```txt
collect_pre_action_metrics
→ optional like/save marker
→ open_comments
→ screenshot_comments
→ extract_visible_comments
→ summarize_comment_signals
→ create pending candidate
→ finalize Evidence Packet
```

要求：

- 先采集 pre_action metrics，再 like/save。
- like/save 只是 recommendation_tuning_marker。
- like/save 不得解释为购买意图。
- 评论采样必须有限。
- candidate 只能是 `pending_analysis`。

#### product_no_high_confidence

必须进入轻量浏览路径：

```txt
decide_negative_action
→ scroll_next 或 governed click_not_interested
→ finalize Browse Ledger
→ scroll_next_video
```

要求：

- product_no 默认不创建 candidate。
- product_no 默认不创建 full Evidence Packet。
- product_no 默认进入 Browse Ledger。
- `click_not_interested` 是可选受治理动作，不是默认动作。
- UI 不明确时不得盲点。

#### product_uncertain

必须进入：

```txt
record uncertainty
→ finalize Browse Ledger 或 review record
→ scroll_next_video 或 review_required
```

要求：

- 不点赞。
- 不创建 candidate。
- 不生成 full Evidence Packet，除非 operator marked 或 review_required with evidence。

### 6.11 Browse Ledger / Evidence Packet 分层

必须做到：

- 非产品视频进入 Browse Ledger。
- 产品视频进入 Evidence Packet。
- Browse Ledger 不进入高级 AI 默认导出集。
- Advanced AI export set 默认只包含 Evidence Packets。
- Browse Ledger 只出现在 summary 统计中。

### 6.12 结构化日志

必须新增并使用：

- `StructuredRuntimeEvent`
- `StructuredActionLog`

结构化日志必须证明：

```txt
open_target_page_completed
detect_login_or_safety_completed
wait_feed_ready_completed
single_video_round_started
wait_video_stable_completed
identify_current_video_completed
calibrate_geometry_completed or review_required
screenshot_video_area_completed
ask_ai_product_presence_completed or local_ai_unavailable
validate_ai_output_completed or local_ai_unavailable
branch_decision_completed
finalize_browse_ledger_completed or finalize_evidence_packet_completed or finalize_failed_or_review_record_completed
scroll_next_video_completed
next_video_wait_started
```

不允许：

- console.log 作为运行真相。
- fake structured log。
- success log 写在动作执行前。
- 失败没有 failureReason。
- review_required 没有 reviewRequiredReason。
- action log 没有 actionPurpose。
- evidence 相关日志没有 evidenceRefs 或 unavailable reason。

---

## 7. 第三阶段关键对象

| 对象 | 当前阶段定位 |
|---|---|
| AgentRuntime | 编排单条视频取证 round |
| PlatformAdapter | 执行受治理平台动作 |
| BrowserController | 浏览器原子能力 |
| LocalAI Gateway | 本地 AI 调用入口 |
| StructuredRuntimeEvent | Agent 步骤事实账本 |
| StructuredActionLog | 平台动作事实账本 |
| EvidenceStore | 本地证据与记录存储 |
| BrowseLedgerEntry | 非产品 / skip / duplicate 的轻量流水 |
| ProductDiscoveryEvidencePacket | 产品视频完整取证包 |
| RuntimeSnapshot | 当前运行状态摘要 |
| Workbench | 操作、状态、复核入口 |

---

## 8. 第三阶段完成判定

第三阶段只有在以下条件全部满足时，才算完成：

```txt
1. Local Workbench 可启动。
2. Agent Runtime 可启动。
3. Agent 能打开目标页面。
4. Agent 能检测 login / captcha / safety / unknown UI。
5. Agent 能等待 feed ready。
6. Agent 能进入 single video round。
7. Agent 能等待 video stable。
8. Agent 能识别 videoVisitId。
9. Agent 能完成 geometry calibration，或明确 review_required。
10. Agent 能截图并生成 video evidence。
11. Agent 能调用本地 AI 第一问，或明确 local_ai_unavailable。
12. Agent 能 validate AI output。
13. Agent 能执行 product_yes / product_no / uncertain / failed 分支。
14. product_no 默认进入 Browse Ledger。
15. product_yes 默认进入 Evidence Packet。
16. 每个动作都有 StructuredActionLog。
17. 每个关键步骤都有 StructuredRuntimeEvent。
18. 每个 round 都 finalize 成 packet / ledger / failed-review record 之一。
19. Agent 能执行 scroll_next_video。
20. scroll_next_video 后进入下一条视频的 wait_video_stable。
21. Runtime Snapshot 能展示当前状态和计数。
22. Workbench 能展示当前状态和 stop/review 信息。
23. 无 fake PASS。
24. 无 fake evidence。
25. 无 fake AI result。
26. 无 fake action log。
27. 无 tests / __tests__ / *.test.* 文件。
28. 不使用 npm test 作为质量真相。
29. typecheck 通过。
30. verify:browse-flow 通过。
31. verify:evidence-packet 通过。
32. verify:structured-logging 通过。
33. verify:coordinate 通过。
34. audit:build 通过。
35. audit 通过。
36. verify:phase3 通过。
37. ci:full 通过。
38. live run 有结构化日志证明“打开页面到切换下一个视频”完成。
```

如果任一项不满足，第三阶段不得封版。

---

## 9. 当前第三阶段不是最终商业产品

第三阶段完成后的 GrassEye 不是最终商业化产品。

它应该是：

```txt
一个本地运行、真实网页、单条视频取证链路可证明、Browse Ledger / Evidence Packet 分层明确、结构化日志驱动的产品视频发现 Agent MVP。
```

它必须保持克制：

```txt
不多平台
不刷量
不绕过风控
不自动采购
不自动上架
不自动投放
不做最终选品
```

第三阶段的核心交付不是“漂亮界面”，不是“高级 AI 分析”，也不是“完整无人值守系统”，而是：

```txt
Agent 单条视频取证链路真正上路。
```

---

## 10. 第三阶段与第四阶段边界

第三阶段完成后，第四阶段才可以考虑：

```txt
多轮长时间无人值守
更成熟的运行策略
候选聚类
高级 AI 批量分析
多产品比较
多平台适配
更完善的数据看板
Mac App 包装
长期运行稳定性优化
```

第三阶段不做这些。

第三阶段只做一件事：

> **让 GrassEye 在真实网页上完成一条可证明的 Agent 取证链路。**
