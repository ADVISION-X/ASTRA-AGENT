# GPT 能力组 V2 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "gpt-capability-group-v2",
  "status": "active",
  "owner": "gpt",
  "lawIds": [
    "LAW-GPT-001-V5"
  ],
  "contractRefs": [],
  "dependencyEdges": [
    {"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"capability-governance","repo":"local"}},
    {"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"}},
    {"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"runtime-log-spine","repo":"local"}}
  ],
  "prohibitedDependencyEdges": []
}
```

## 唯一终态与调用方向

`gpt` 是 GPT Provider 的唯一能力组，公开 transport 固定为 `gpt-web`，物理根固定为
`src/capabilities/gpt/`。Product Plugin 只拥有业务轮次、Prompt 与材料角色、模型策略、fresh/continuation
意图和结果合同；Provider 页面动作顺序、原子 checkpoint、页面失败对账与重启恢复只由能力组内唯一共享
`GptTurnExecutor` 维护。十二个 Product Plugin 不得各自保存 `gpt_flow`、child 动作数组、页面 retry 或恢复链。

```text
Product Plugin 的产品中性 GptTurnRequest
  -> src/capabilities/gpt/index.ts 唯一公共 Facade
  -> 唯一 GptTurnExecutor 恢复或推进一个 turn
  -> 一个稳定 Provider 页面意图对应的精确 Child Ability
  -> Browser Authority exact Target + Document
  -> 一次有界 observation，或一次 precondition + 唯一 dispatch + 直接 postcondition
  -> 原子 checkpoint 后推进下一步
  -> typed GptTurnReceipt 返回 Product Plugin
```

公共 Facade 只暴露 `listChildCapabilityIds()` 与 `executeTurn(request)`；原子 Child 的 `execute()` 只供同根
`GptTurnExecutor` 使用，不向 Product Plugin 暴露。`GptTurnRequest` 只允许 frozen execution profile、获准附件、
exact Prompt、fresh/continuation 意图、预期 text/image 输出与调用身份；不得携带动作数组、selector、脚本、坐标、
tab id、Provider URL 或 fallback policy。`GptTurnExecutor` 是产品中性的页面状态机，不理解领域内容、不决定业务轮次、
是否续问或结果是否合格，也不是第二 Facade、第二 Session Controller、第二队列或第二 mutation Owner。

## 公共子能力分母

公开 `childCapabilityId` 固定为以下 23 项：十九个 GPT 页面语义 Child，加四个 continuation 状态 Child。
实现文件可以按同一页面 Owner 垂直合并，但不得增减、别名、动态生成或用粗粒度整轮能力替代。

| 类别 | 固定 childCapabilityId | 唯一语义 |
|---|---|---|
| 会话 | `prepare_clean_gpt_chat` | 在任务 Target 上有界等待根页面 hydration，并证明 fresh composer 与无历史 turn |
| 会话 | `focus_exact_gpt_conversation` | 导航到冻结的永久 conversation URL；不把短暂 URL 保存为 continuation |
| 会话 | `verify_gpt_conversation_identity` | 有界等待 composer、精确 turn marker 与 conversation identity 同时成立 |
| 执行档案 | `open_gpt_execution_profile` | 打开当前唯一模型/推理弹面并证明唯一 Owner |
| 模型选择 V2 | `open_gpt_model_selector_v2` | 从当前可见 execution profile 唯一入口进入 active、non-inert 模型面板；不读取隐藏高级面板 |
| 模型选择 V2 | `select_exact_gpt_model_v2` | 只在 active、non-inert 模型面板点击唯一精确模型并证明 execution profile 已恢复；V1 `ensure_exact_gpt_model` 物理退出 |
| 执行档案 | `ensure_exact_gpt_reasoning_tier` | 在同一弹面读取或选择精确推理档位 |
| 执行档案 | `close_gpt_execution_profile` | 关闭弹面并证明触发器已收束；不假设存在 Advanced 或第二弹窗 |
| 附件 | `open_gpt_attachment_control` | 有界等待并打开真实 Chrome 已证明唯一的附件机器身份，随后证明唯一“从电脑上传”交互节点可用 |
| 附件 | `attach_approved_gpt_files_once` | 对获准集合执行至多一次物理挂载 |
| 附件 | `reconcile_gpt_attachment_set` | 证明 composer 全部且仅有批准附件；已 dispatch 时只读对账 |
| Prompt | `write_exact_gpt_prompt` | 对空或已证明可写的 composer 执行至多一次精确写入 |
| Prompt | `reconcile_gpt_draft` | 按输入 hash 证明 exact draft，区分空、完整和冲突草稿 |
| 提交 | `submit_exact_gpt_turn_once` | 在附件与 draft 均已对账后执行至多一次提交 |
| 提交 | `reconcile_gpt_turn_submission` | 证明 exact user turn 已出现，并有界等待永久 conversation identity；不以临时 URL 判失败 |
| 文本回答 | `wait_for_stable_gpt_text` | 锁定精确 assistant turn，忽略 request placeholder，并等待生成状态结束与文本稳定 |
| 文本回答 | `checkpoint_gpt_text_response` | 保存精确 assistant turn 的文本、hash、marker 与 proof |
| 图片回答 | `wait_for_stable_gpt_image` | 在精确 assistant turn 内按语义主图选择器等待唯一稳定生成图，不按 raw img 数量猜测 |
| 图片回答 | `checkpoint_gpt_generated_image` | 经 Browser Authority 的已鉴权页面会话取得原始 bytes，保存 hash/尺寸与下载 proof |
| Continuation | `persist_gpt_continuation` | 保存永久 canonical URL、conversation identity、turn marker 与主体绑定 |
| Continuation | `acquire_gpt_continuation_lane` | 对精确 continuation 执行 lane CAS 获取 |
| Continuation | `advance_gpt_continuation_lane` | 在已 checkpoint 的 turn 上原子推进 marker |
| Continuation | `release_gpt_continuation_lane` | 在 settle 或失败收束后释放精确 lane |

以下三项只属于 Browser Authority 边界，不属于上述 GPT 分母：绑定 exact Target/Document；经 WAL 许可并执行一次
governed browser mutation；按冻结 postcondition 对账 mutation outcome。页面内的 find/read/click、横向滚动、点击已核验的唯一
composer 聚焦表面关闭弹面、DOM 候选过滤和 selector 只属于相应元素 Owner 的 Child 内部实现，不再拆成公共兄弟能力。

标题、conversation 搜索、checkpoint fork、临时 UI 清理、限流处置、搜索弹窗、artifact 包装与 runtime checkpoint
恢复都不属于生产 GPT 公共分母。标题是 Provider 可自动生成的人工可读标签，不参与身份、路由、恢复或验收。
确有风控、限流、登录或页面结构不受支持时失败关闭到人工诊断，不建立正常路径公共能力或猜测处理器。

## Child 合同与 Browser 原子边界

每个页面 Child 必须声明 `childCapabilityId`、`contractVersion`、`inputSchema`、`requiredTargetKind`、
`allowedDocumentTransition`、`precondition`、`oneObservationOrMutation`、`postcondition`、`evidenceSchema`、
`failureClassification` 和 `replayPolicy`。一次 mutation Child 只允许冻结一个元素 Owner、唯一候选、前置事实、
一次物理 dispatch 和互斥且覆盖允许结果的正向/负向 postcondition；候选为零时不得点击，多于一个时不得猜选。

`replayPolicy` 只有三种：observation 不持久化物理 effect；模型弹面、推理档位、附件入口和 draft 等页面局部动作是
`target-local-per-generation`，logical identity 必须绑定 targetRef，新 Target 代次可重新建立页面状态；附件实际挂载和
GPT turn 提交属于 `provider-effect-once`，logical identity 跨 Target/attempt/build 稳定，一旦 WAL 为 DISPATCHED、
CONFIRMED 或 REJECTED 就不得再次发送。不得用统一的“所有 REJECTED 永久封死”或“换 attempt 就可重发”替代这两个边界。

Child proof 固定绑定 `flowVersion + stepIndex + inputHash + pluginStepId + childCapabilityId + actionOrdinal`、
`executionId`、Target/Document 前后 ref/hash、URL hash/page type、候选数、受控语义、mutation outcome、
postcondition、开始/结束时间与 evidence ref/hash。公共 Facade 不得在 Child 前后或失败分支隐藏 DOM 观察、页面
mutation、重试或 cleanup；Child 不调用兄弟 Child 隐藏 workflow。

Browser Authority 是物理动作和已鉴权页面资源传输的唯一 Owner。物理打开 ChatGPT 标签页属于任务 Target
lifecycle，不是 GPT Child；fresh turn 在该 Target 调用 `prepare_clean_gpt_chat`，authorized continuation 调用
`focus_exact_gpt_conversation` 后再调用 `verify_gpt_conversation_identity`。能力组不得查询或复用操作者页面，
不得读取 cookie、storage、密码或 token，也不得自动登录、处理验证码/2FA、绕过风控或修改全局设置。

## Execution profile 的唯一现役 DOM 合同

以下合同来自同一真实 ChatGPT Target/Document 对推理档位 `极速 -> 中 -> 高 -> 极高 -> Pro` 的逐档往返实证。
execution profile 是页面瞬态，旧 `open_gpt_execution_profile` checkpoint 的成功不证明它跨恢复仍存在。

`open_gpt_model_selector_v2` 只接受同一 open profile 内以下 OR 状态机：

```text
ALREADY_OPEN :=
  唯一 [role='menuitem'][aria-label='选择模型'][aria-expanded='true']
  AND 唯一 [data-testid='composer-model-picker-slider-advanced-view'][data-active='true']:not([inert])

OPENABLE :=
  唯一 [role='menuitem'][aria-label='选择模型'][aria-expanded='false'][aria-hidden='false']
  AND 唯一 simple panel [data-active='true']:not([inert])

terminal := ALREADY_OPEN OR (OPENABLE -> click entry once -> prove ALREADY_OPEN)
```

`ALREADY_OPEN` 成立时返回 success 且不 dispatch；`OPENABLE` 成立时只点击该唯一入口一次。两个状态都不成立、
同时成立、入口或面板不是唯一、点击后未直接得到 `ALREADY_OPEN`，均以 `mutation_outcome=no|dispatched` 的真实阶段失败，
不得引入旧 simple-panel-only 前置、并列 selector、fallback 或第二打开链。`select_exact_gpt_model_v2` 随后只在上述唯一
active、non-inert advanced panel 内读取 visible `[role='menuitemradio']`，按精确模型名冻结唯一候选并完成一次选择；
inactive、inert、aria-hidden、折叠或只有几何盒子的模型节点不参与候选。

推理操作节点固定为唯一 `[role='menuitem'][aria-label='能力']`；状态只从
`[data-model-reasoning-effort-slider] [role='slider']` 读取。后者虽为 `aria-hidden=true`，但只承担不可操作 readback，
必须同时满足 `aria-valuemin=0`、`aria-valuemax=4`、`aria-valuenow∈{0,1,2,3,4}`。数值映射固定为
`0=极速、1=中、2=高、3=极高、4=Pro`。若 now 等于目标，零 mutation 成功；否则能力 menuitem 必须唯一且未禁用，
只向它发送恰好 `abs(target-now)` 次同方向 ArrowLeft/ArrowRight，并直接回读 now 等于目标。页面文字不参与身份或状态判断，
不得直接操作 aria-hidden slider。

附件入口的现役 DOM 合同只来自当前候选的真实 Chrome fresh Document 实证：入口唯一机器身份为
`button#composer-plus-btn[data-testid='composer-plus-btn'][aria-haspopup='menu']`，允许至多 5 秒有界等待 hydration；
本地化 `aria-label` 不参与生产身份。点击后直接后置判据先限定唯一 `div.__menu-item[tabindex='0']` 交互节点，
再由其唯一 `span` 叶子精确匹配 `从电脑上传`；父节点全文是 `添加照片和文件从电脑上传`，不得把父节点当成
exact-text 节点，也不得以虚构 `role=menuitem`、并列旧 selector、fallback 或旧快照放行动作。
入口 0 个在等待耗尽后失败且不点击，多于 1 个立即失败；展开后上传动作 0 个或多于 1 个均不得进入文件挂载。
真实 Chrome 同时证明 `#upload-files` 唯一存在但不可见，类型为 `input[type='file'][multiple][tabindex='-1']`；GPT Child
不得用 visible find 把隐藏 input 当作上层动作许可。实际挂载仍只调用 Browser Authority 的 `attachFile`，由其在物理
dispatch 前对 `#upload-files` 做一次非可见性依赖的 exact-candidate 校验并持有文件 grant/WAL，不新增 picker 或第二上传链。

生成图片的页面资源 URL 不是 artifact。`checkpoint_gpt_generated_image` 只能请求 Browser Authority 在当前 exact
Target/Document、精确 assistant turn 和现有认证上下文内取回原始 bytes；页面外直接请求、截图、DOM URL、重复 raw
img 节点或 selector fallback 均不得冒充成功。下载 receipt 必须绑定 Target/Document、conversation、turn、语义主图、
content hash、bytes、media type 与尺寸，再交给现有 artifact/checkpoint 路径；不新增下载服务、对象库或上传链。

## 唯一 turn 状态机与断点续传

`GptTurnExecutor` 只按请求条件选择以下唯一顺序；“无需附件”或“无需某类输出”是合同明确跳过，不是另一条链：

```text
fresh: prepare_clean_gpt_chat
continuation: focus_exact_gpt_conversation -> verify_gpt_conversation_identity
-> open_gpt_execution_profile
-> open_gpt_model_selector_v2
-> select_exact_gpt_model_v2
-> ensure_exact_gpt_reasoning_tier
-> close_gpt_execution_profile
-> [open_gpt_attachment_control -> attach_approved_gpt_files_once -> reconcile_gpt_attachment_set]
-> write_exact_gpt_prompt -> reconcile_gpt_draft
-> submit_exact_gpt_turn_once -> reconcile_gpt_turn_submission
-> [wait_for_stable_gpt_text -> checkpoint_gpt_text_response]
-> [wait_for_stable_gpt_image -> checkpoint_gpt_generated_image]
-> persist/advance continuation -> release lane
```

现役链使用唯一的步骤诊断节拍：Browser Authority 完成 exact Target/Document 绑定后，`GptTurnExecutor` 在该次
执行的第一个已启用 Child 开始前先执行一次精确 `5000ms` 的 `wait`；随后，一个已启用 Child 只有在返回
`success` 且其原子 checkpoint 已完成后，才再次等待精确 `5000ms`，然后开始下一个已启用 Child。失败后不等待，
最后一个已启用 Child 后也不等待。该节拍只隔开动作时序，不构成下一步的 DOM 前置事实、动作许可、
postcondition、成功判据、重试或恢复证据；每个 Child 仍必须在 fresh Document 上独立完成自己的 Chrome 已实证
exact selector、唯一候选和直接后置判据。

Browser WAL 必须在物理 mutation 发送前落 PREPARED、发送后落 DISPATCHED，是副作用是否发生的先行权威；shared runtime
checkpoint 持久化 `flow_version`、`step_index`、`input_hash`、proof、`mutation_state`、Target/Document identity、
conversation identity 与输出 ref，只能单调追平 WAL，不得把同一步已 DISPATCHED/CONFIRMED 降级为 `no`。进程重启先读取
durable job、该 checkpoint、Browser WAL 和当前 Document：

- Provider effect 已 `confirmed` 且 input/hash 相容时直接从 WAL authority 恢复 checkpoint 并越过物理动作；
- 物理 dispatch 已发但尚未证明的上传、提交只在原 Target/Document 调用对应 reconcile，不再 dispatch；
- 恢复现场必须 park 原 Target、撤销 active claim/Workspace 并释放全局 FIFO；同一 job 重试按 exact targetRef 重领，其他 job 继续执行；
- execution-profile、模型面板与推理面板的成功 checkpoint 只证明当时步骤，不证明当前 DOM 仍打开；恢复计算出的下一步若位于 `open_gpt_model_selector_v2` 至 `close_gpt_execution_profile` 片段，执行起点必须在同一条现役步骤数组中回到 `open_gpt_execution_profile`，按当前 Target/Document 重新建立瞬态前置，再顺序推进；这不是第二恢复链，也不得改写已经确认的 Provider effect；
- Target-local terminal 现场随 Target 关闭；新 Target 代次使用绑定新 targetRef 的 identity 重新建立页面局部状态，当前 Target 被重新 claim 或 Document 改变时同样不得沿用旧 DOM 前置；
- 页面未 hydration、提交后仍是临时 conversation URL、request placeholder 尚未转成永久 assistant turn，只做有界观察并保存当前步骤，不判用户终态；
- mutation 明确未发且前置仍成立时，才允许原 action ordinal 再进入一次许可；
- 输入、主体、授权、Provider effect Target/Document 或已确认页面事实冲突时失败关闭并保留原 checkpoint/WAL，不新开整轮或兼容路径。

Browser/postcondition 失败是 attempt/step 事实，不直接把 durable job 变成用户终态。只有确定性合同不可满足、授权或
安全边界拒绝，或在已 dispatch 动作完成补核后仍有明确期限事实，才交由唯一 runtime terminal Owner 裁决失败。

## 状态、证据与验收

GPT 能力组不建私有数据库、队列、证据库、日志系统或 mutation ledger。唯一 Session Controller 只管理 opaque
continuation、原 Plugin、主体/授权/hash、永久 conversation identity、turn marker 与 lane CAS；原子 checkpoint 使用
shared runtime 现役 SQLite/WAL，proof 使用现役 Forensics，日志只保存脱敏 authority ref/hash。

静态检查必须证明：只有一个 `gpt` 根、一个公共 Facade、一个 `GptTurnExecutor`、一个 Session Controller；公共分母
恰好为上述 23 项；十二个 Product Plugin 中页面 child 数组、Provider 页面 retry/recovery、V1 `ensure_exact_gpt_model` 与旧 `gpt_flow` 物理为零；
搜索、分叉、标题、临时 UI、artifact 包装、公开 runtime-recovery child 与旧 `ai-input-gateway` 物理为零。

Exam 必须覆盖 exact 23 分母、唯一顺序、0/1/多候选、模型 V2 的 ALREADY_OPEN 零点击、OPENABLE 单击后收束、两态均不成立/同时成立/入口或面板不唯一时拒绝、非目标模型切换、目标模型已选仍从 active advanced panel 收束、推理 now=target 零 mutation、0..4 每档双向到达、非法 min/max/now 与能力入口缺失/多候选/禁用拒绝、恢复直接落在模型或推理步骤时先于当前 Target/Document 重新执行 open_gpt_execution_profile、附件入口 hydration 后唯一命中、旧本地化 aria-label 为零命中、展开后真实无 role 上传父节点与 exact-text 叶子分层唯一命中、附件精确集合、
draft 冲突、临时 conversation URL、历史会话 hydration、request placeholder、文本/图片独立稳定、Provider effect 已 dispatch 禁重放、
WAL 领先 checkpoint 时恢复、checkpoint mutation 单调、Target-local 新代次可重做、恢复现场不冻结其他 job。真实 Chrome 必须以当前候选证明：同一 Target/Document 上执行档案、
真实附件、Prompt、一次提交、永久 conversation identity、稳定文本、精确 assistant turn 图片原始 bytes 和一次真实重启恢复；
截图、HTTP 成功、旧快照、直接资源 URL 或空队列都不能替代。

正文闭环：Owner 是 `gpt`；输入是 Product Plugin 已批准的产品中性 `GptTurnRequest` 与 Browser Authority grant，
输出是绑定 23 项分母、原子 checkpoint、Target/Document 与 evidence ref/hash 的 `GptTurnReceipt`。业务步骤留在 Product
Plugin，Provider 页面步骤只在唯一 Turn Executor，物理动作与已鉴权媒体取回只在 Browser Authority，恢复只沿现役
checkpoint/WAL 单链前进；不保留兼容桥、第二页面链或第二 verdict。
