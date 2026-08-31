# GPT 能力组 V4 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "gpt-capability-group-v5",
  "status": "active",
  "owner": "gpt",
  "lawIds": [
    "LAW-GPT-001-V13"
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

## 1. 唯一 Owner 与调用方向

`gpt` 只拥有 GPT Provider 的 23 个原子 Child、对应 DOM 合同、Browser Authority 调用、直接后置证明和 typed result。十二个 Product Plugin 各自直接拥有 Child 顺序、分支、重复、跳过、Prompt 语义、模型策略和结果组装。

```text
Product Plugin 的普通 TypeScript Flow
  -> ProductGptTools.execute(one typed child call)
  -> 一个 GPT Child
  -> Browser Authority exact Target + fresh Document
  -> observation，或 precondition + 至多一次 dispatch + postcondition
  -> success(value,evidence) | failed(reason,evidence)
```

必须物理不存在 `GPT_TURN_FLOW`、`GptTurnExecutor`、`executeTurn`、`runTurn`、全局 `stepIndex`、`resumePoint`、`flowVersion`、`reconcileOnly`、全局 GPT checkpoint 和固定 Child 间节拍。公共面不是 registry、bus、DSL、workflow engine 或第二调度器。

公开面采用静态类型映射：

```ts
interface ProductGptTools {
  execute<K extends GptChildId>(call: {
    sessionKey: string;
    productStepId: string;
    callId: string;
    child: K;
    input: GptChildInputMap[K];
  }): Promise<{
    value: GptChildOutputMap[K];
    evidenceRef: string;
    evidenceHash: string;
  }>;

  readCallFacts<K extends GptChildId>(call: {
    productStepId: string;
    callId: string;
    child: K;
    actionOrdinal: number;
    input: GptChildInputMap[K];
  }): Promise<ExactGptCallFacts>;
}
```

Product Plugin 不得提供 Target、Document、selector、WAL、lease、fence、mutation identity 或恢复指令。`sessionKey` 是产品定义的不透明逻辑会话槽；Browser Authority 唯一解析真实 Target 与 generation。

`readCallFacts` 不是第二 GPT Child 入口。它由 production execution binding 注入 job/attempt/plugin/version，以完整 input 计算 exact call identity，只组合 Browser mutation、Forensics evidence/artifact 和 GPT continuation 的安全只读事实。它不调用 Child、不写入、不决定下一步，且禁止返回 target/document、WAL row、state/phase/resumePoint/nextStep 或 per-call failure history。

## 2. 公开 Child 分母

| 类别 | childId | 原子语义 |
|---|---|---|
| 会话 | `prepare_clean_gpt_chat` | 证明唯一 fresh composer、exact empty draft、zero prior turn/attachment 与 not generating；仅草稿污染时至多一次清空并读回 |
| 会话 | `focus_exact_gpt_conversation` | 导航到冻结永久 conversation |
| 会话 | `verify_gpt_conversation_identity` | 证明 composer、canonical URL、turn marker、prior prompt/response hash 与 conversation identity |
| 档案 | `open_gpt_execution_profile` | 在当前 Document 打开或确认唯一 execution profile |
| 模型 | `open_gpt_model_selector_v2` | 以 ALREADY_OPEN OR OPENABLE 到达唯一 active advanced panel |
| 模型 | `select_exact_gpt_model_v2` | 在 active advanced panel 确认或选择唯一精确模型，并以至多一次动作恢复 active simple panel |
| 档案 | `ensure_exact_gpt_reasoning_tier` | 用数值 readback 到达精确推理档位 |
| 档案 | `close_gpt_execution_profile` | 关闭并直接证明弹面收束 |
| 附件 | `open_gpt_attachment_control` | 打开唯一附件入口并证明唯一上传动作 |
| 附件 | `attach_approved_gpt_files_once` | 至多一次挂载获准文件集合 |
| 附件 | `reconcile_gpt_attachment_set` | 有界只读等待并证明全部且仅有批准附件已上传完成 |
| Prompt | `write_exact_gpt_prompt` | 至多一次写入 exact Prompt |
| Prompt | `reconcile_gpt_draft` | 证明 exact draft 或返回冲突 |
| 提交 | `submit_exact_gpt_turn_once` | 至多一次提交 exact turn |
| 提交 | `reconcile_gpt_turn_submission` | 只读证明 exact user turn 与永久 conversation |
| 文本 | `wait_for_stable_gpt_text` | 等待精确 assistant turn 稳定；仅在精确 conversation-history 频繁提示遮挡时至多一次确认后继续原 probe |
| 文本 | `checkpoint_gpt_text_response` | 保存唯一 assistant turn 的完整 observed DOM HTML 与确定性语义文本，返回双 hash、marker 与 proof |
| 图片 | `wait_for_stable_gpt_image` | 等待精确 assistant turn 的唯一语义主图；仅在精确 conversation-history 频繁提示遮挡时至多一次确认后继续原 probe |
| 图片 | `checkpoint_gpt_generated_image` | 经当前已鉴权页面取得原始 bytes 与 proof |
| Continuation | `persist_gpt_continuation` | 保存永久 URL、turn marker、prior prompt/response hash、conversation identity 与主体绑定 |
| Continuation | `acquire_gpt_continuation_lane` | 对精确 continuation 获取 lane CAS |
| Continuation | `advance_gpt_continuation_lane` | 在已证明 turn 上推进 marker |
| Continuation | `release_gpt_continuation_lane` | settle 后释放精确 lane |

Browser Target/Document 绑定、mutation WAL 与 mutation outcome 对账属于 Browser Authority，不是 GPT Child。find/read/click、DOM 候选过滤和 selector 属于对应 Child 的私有实现，不再拆公共能力。

## 3. 原子 Child 合同

每个 Child 声明 `childId`、版本、输入/输出类型、所需 Target kind、允许的 Document transition、前置、唯一 observation 或至多一次 mutation、互斥且完备的正负后置判据、evidence schema 和 typed failure code。

`checkpoint_gpt_text_response` 的 DOM 责任是完整取回 Provider 当前实际呈现的产物，不是解释 JSON 或业务内容。它必须锁定精确 assistant turn，并保存该节点完整 `outerHTML`；唯一 JSON code block 时读取 code `textContent`，没有 code block 时遍历完整 semantic tree，把 `<br>`、块级边界、列表以及 `<strong>/<em>/<code>` 等标签确定性投影为显式 canonical 标记，保留转义、Unicode 与全部可见字符。canonical text 是 observed DOM 的可追溯语义投影，不冒充 Provider 原始 Markdown/source bytes；原 DOM HTML 与投影文本及各自 hash 一起进入同一 task-owned output artifact。禁止散落 text-node 拼接、`innerText` 布局副作用、预设业务字段选择器或正则截断；零个或多个完整 assistant 候选必须 typed fail-close。Forensics 与 Runtime Logs 只保存 artifact ref/hash，不保存 DOM 或正文。

每次调用身份固定为：

```text
job_id + attempt_id + plugin_id + plugin_version
+ product_step_id + call_id + child_id + input_hash
```

同一业务 attempt 跨 lease、进程、Target 和 build 保持同一 Provider effect identity；新业务 attempt 取得新 identity。Target-local Browser mutation 另加 `target_generation`，但 exact GPT call evidence identity 不加 target generation。同 attempt 已有 verified evidence 或 DISPATCHED/CONFIRMED/REJECTED Browser fact 的 target-local call 禁止在新 Target generation 重做物理 mutation；原 Target 可恢复时只读 rehydrate，否则当前 attempt typed fail-close。创建下一 attempt 前必须证明前一 attempt 没有未收束 `DISPATCHED`。

Provider effect 一次性只在同一业务 attempt/call 内成立；新 attempt 可在安全前提满足后重新执行。`DISPATCHED` 永远先读 WAL 与当前页面后置判据，禁止盲重放。

## 4. 当前 Document 前置

所有 Child 每次都读取当前 Target + 当前 Document。过去调用成功、产品步骤位置或任何 checkpoint 都不能证明瞬态弹面仍存在。模型或推理操作前，若 execution profile 不存在，Product Plugin 必须先调用 `open_gpt_execution_profile`；Child 自身仍须重新验证当前 DOM。Provider text/image wait 与 checkpoint 每次 probe 都在同一 system Target 上先复核 canonical conversation URL；URL 漂移时只在该 Target 导航复位并作一次有界 hydration，再以 turn marker 找到唯一 user turn。prompt hash 只对该 turn 内唯一请求正文机器节点计算：读取现役 deterministic semantic tree，恢复 strong/em/code 等显式标记，只移除投影算法为根块额外加入的一个终止分隔换行，并保留正文自身全部字符与尾换行。当前生产长消息的实证节点固定为 `[data-testid='collapsible-user-message-content']`，外层 `[data-message-author-role='user']` 的附件卡片、文件名与展开/收起控制文字不属于 Prompt；禁止 textContent 丢 Markdown 结构，也禁止 trim、删反引号或其它内容启发式。正文节点零个、多于一个或 canonical rendered-prompt hash 不等都零 mutation 失败关闭；随后只接受紧邻 assistant turn，并用 response hash 锁定稳定结果与 checkpoint。URL、marker、prompt hash、相邻 assistant 或 response hash 任一不成立都不得接收。

`reconcile_gpt_turn_submission` 的输入同时绑定 `turnMarker + expectedPromptHash`，成功值固定包含 canonical conversation URL、turn marker、user turn id、canonical rendered-prompt hash 与 conversation identity。唯一 Runtime/Forensics evidence writer 必须在该成功返回后、单一生产 Tab 让出时间片前，以同一 exact call identity 的受控 `submission-locator` suffix 写入并读回 task-owned artifact；同 identity 重放先读该 artifact并返回原成功值，再由后续 wait/checkpoint 导航 URL 作 live 验证。该 artifact 不写 proof 正文/Runtime Logs，不成为 continuation、恢复状态机或第二 locator store。

`prepare_clean_gpt_chat` 的成功集合只能是：唯一 composer，读回的 exact draft 为空字符串，user turn、attachment 与 generating 候选均为零。当且仅当后三项均为零且 composer 唯一、但读回存在旧 draft 时，该 Child 必须通过 Browser WAL 执行至多一次 exact composer 清空并直接读回空字符串；不得把旧 draft 当成新任务输入。存在 prior turn、attachment、generating 或候选不唯一时不得清理，必须以 `mutation_outcome=no` 失败关闭。

`open_gpt_model_selector_v2` 的唯一许可是：

```text
ALREADY_OPEN :=
  唯一 [role='menuitem'][aria-label='选择模型'][aria-expanded='true']
  AND 唯一 [data-testid='composer-model-picker-slider-advanced-view']
             [data-active='true']:not([inert])

OPENABLE :=
  唯一 [role='menuitem'][aria-label='选择模型']
             [aria-expanded='false'][aria-hidden='false']
  AND 唯一 active non-inert simple panel

success := ALREADY_OPEN OR (OPENABLE -> click once -> ALREADY_OPEN)
```

状态是等于或 OR 关系；两者均不成立、同时成立或任一候选不唯一都返回 `failed + reason`，不得点击。`select_exact_gpt_model_v2` 只在唯一 active、non-inert advanced panel 中读取 visible `[role='menuitemradio']`；目标 radio 未选中时点击该 radio，已经选中时点击唯一 expanded 模型入口，两条分支均只允许一次 mutation，并必须直接证明 active simple panel 已恢复后才成功。

推理的可操作节点固定为唯一 `[role='menuitem'][aria-label='能力']`；状态只从 `[data-model-reasoning-effort-slider] [role='slider']` 读取，必须满足 `aria-valuemin=0`、`aria-valuemax=4`、`aria-valuenow in 0..4`。映射为 `0=极速、1=中、2=高、3=极高、4=Pro`。等于目标时零 mutation，否则只向唯一能力 menuitem 发送有界方向键并回读等于目标；不可直接操作 `aria-hidden` slider。

附件入口固定为 `button#composer-plus-btn[data-testid='composer-plus-btn'][aria-haspopup='menu']`。允许为 hydration 有界等待；展开后必须在唯一 `div.__menu-item[tabindex='0']` 中由唯一叶子精确匹配“从电脑上传”。隐藏 `#upload-files` 只由 Browser Authority 在 dispatch 前校验，不作为上层可见候选。

`attach_approved_gpt_files_once` 只负责一次获准 file-input batch。由于 Provider 会对跨会话重复文件名自动追加 `(n)`，该 Child 必须在不改变获准 bytes、sha256、artifactRef 与业务 display name 的前提下，为每个 attempt + artifact 派生唯一且确定的 `providerDisplayName`，以该精确名称构造临时上传文件并通过 Browser grant 发送；后续 Prompt 只能引用 Child 返回的 `providerDisplayName`，不得继续引用会被 Provider 改写的业务 display name。ZIP 与其它附件对 GPT Child 都是不透明 bytes；Child 不得解压、解释 entry、验证 Product 内部目录或另建材料清单。附件卡片与文件名出现不能证明 Provider 上传完成。`reconcile_gpt_attachment_set` 必须完整采用 Product 给定的有界 `timeoutMs`，不得以 60 秒或其它公共常量缩短，在该期限内重复读取 fresh DOM：attachment region 唯一、卡片数量与 NFC `providerDisplayName` 集合全部且仅有批准项，每个精确卡片的 `svg[data-testid='library-file-icon']` 都具有 Browser 可见盒子，并且 `svg[class*='animate-spin']` 可见数为零，才可成功。选择器必须直接落到待判定 SVG，不得用 `:has(...)` 让可见外层卡片掩盖不可见子节点。条件满足即提前返回；集合冲突立即失败；仅 spinner 或未完成卡片持续存在时等待到 Product 上限并以 `GPT_ATTACHMENT_UPLOAD_TIMEOUT` 失败。只有真实 Chrome 已实证并冻结唯一机器身份的明确 Provider 上传错误才可立即返回对应原生 typed failure；当前没有该身份时不得虚构通用错误 selector、文本规则或提前失败。该 Child 成功前 Product 不得写 Prompt 或提交；`submit_exact_gpt_turn_once` dispatch 前必须重新读取 composer，证明 exact prompt hash 与 turnMarker 仍在，否则以 `GPT_PROMPT_CHANGED_BEFORE_SUBMIT` 零 mutation 失败。

`wait_for_stable_gpt_text` 与 `wait_for_stable_gpt_image` 共用 GPT Owner 内唯一的 conversation-history 提示合同。每次 fresh probe 先只读检查可见 `[data-testid='modal-conversation-history-rate-limit']`：零个继续原 probe；恰好一个时必须同时证明其内恰好一个 `[role='dialog']`、唯一 `h2` 精确文本为“请求过于频繁”、唯一可见启用 `button` 精确文本为“明白了”。只有全部成立且本次 wait 尚未确认过该提示，才通过当前 exact wait call 的 Browser WAL 至多点击一次，并直接证明 root 变为零后重新执行原 conversation URL + marker + prompt hash 前置。多 root、结构/文本漂移、按钮多义或不可用、同次 wait 第二次出现都必须 typed fail 且不得再点击。该动作只关闭遮挡，绝不证明限制解除、回答稳定或允许 submit；不新增 Child、Product 分支、限流表、计时器或第二恢复状态。

## 5. 失败、证据与验收

Child 只返回 `success` 或 `failed + typed reason`。真实页面/Provider failure 必须包含 `code`、`mutationOutcome=no|dispatched|confirmed`、`evidenceRef/evidenceHash` 和存在时的原生 cause，并终止当前 attempt；Child 不返回 `review_required`、`recovery_pending`、流程位置、重试决策或可供 Product 继续编排的历史 per-call failure。exact submit 已 CONFIRMED 后，只有施工图冻结的瞬时 Browser/channel 软件故障、`mutationOutcome=no`、不存在 Provider terminal negative，且仍早于原 immutable absoluteDeadline 时，Runtime 才可引用原 submit exact fact，以现役 lease release 的 `POST_SUBMIT_READBACK_FAULT` 与 `current_reason` 释放 lease；同一 attempt 重领后由 Product 的 Progressive Exact Fact Replay 跳过 submit 并继续读回。`BROWSER_EXACT_TARGET_UNAVAILABLE`、`BROWSER_DOCUMENT_INVALID`、Provider terminal negative 与 deadline expiry 不得进入该恢复分支，必须结束当前 attempt。conversation-history 提示只按上一节在现役 wait Child 内至多一次确认；其它真实操作频繁/额度阻断机器身份只返回专属 typed blocker、零 mutation，并交由 Website 现役 retry/parking 策略裁决，不新增限流状态或调度器。`checkpoint_gpt_text_response` 成功后的接收、归一或组装软件故障同样由 Product 引用同一 raw artifact/ref/hash 沿原 attempt 恢复。

固定 5 秒等待被删除。等待只允许是单个 Child 为 fresh DOM、hydration 或直接 postcondition 使用的有界实现，并由真实条件提前结束。Provider text/image wait 必须分解为 fresh DOM 驱动的短 probe，每次 probe 后根据实际 Provider 状态计算瞬时 nextCheckAt，未到时不进 Browser FIFO；每次重领都重新完成 canonical URL + marker + prompt hash + 相邻 assistant + response hash 链，总生命期以 exact submit 首次 CONFIRMED 的 immutable terminalAt + Product timeoutMs 为 absoluteDeadline，重启不刷新。不得新增 wait table/ticket/durable nextCheckAt。`close_gpt_execution_profile` 只能使用当前 profile Owner 内经实证唯一的收束动作并直接证明 popup 缺席，不得假定点击 composer 必然收束 profile。

聚焦验收必须证明：23 个 Child 精确；公共面无 turn API；产品能显式调用任意 Child 序列；每个已开始 Child span 在 Browser lease 获取、park、reacquire 或原子能力任一失败点都恰好产生一个 typed terminal；readCallFacts 只读、无流程决策与无 failure/state/Target/WAL 泄漏；模型面板支持 ALREADY_OPEN/OPENABLE；五个推理数值往返；同一业务文件在不同 attempt 获得不同但确定的精确 `providerDisplayName`；一个 UTF-8 ZIP 仍只产生一次 file-input mutation，GPT Child 不读取其 entry；附件名称已出现但上传未完成时不得成功且不得产生 mutation，Product timeout 超过 60 秒时不得被公共 Child 截短，全部完成后立即成功，持续未完成时 typed timeout；Prompt 在提交前被页面清空或改写时不得点击；marker 外层 user 容器即使混入附件卡片、文件名与展开/收起文字，canonical rendered-prompt hash 仍等于原 composer prompt，inline code 反引号与正文尾换行被保留且只删除一个投影根分隔换行，正文自身漂移则失败；conversation-history 提示覆盖缺席、唯一、重复、多 root、标题/按钮漂移和按钮禁用，缺席零点击、唯一一次点击且 root 消失、其余全部零点击失败，关闭后必须重新验证原 wait 前置；submission reconcile artifact 必须按 exact identity 幂等写读并在单 Tab 已切换到其它会话、进程重启后仍返回原 canonical URL/marker/user turn/prompt hash/identity，且 submit mutation count 不增加；URL 漂移后只能在同一 Target 精确复位，marker 正确但 prompt hash 错误、assistant 非紧邻或 response hash 漂移均失败；exact submit 已 CONFIRMED 后的瞬时只读软件故障在 immutable deadline 前保持同 attempt 且再次 submit mutation count 为零，永久 Target/Document 错误与超时结束 attempt；文本 checkpoint 对 code block、`<br>`、块级节点、列表、strong/em/code、转义和 Unicode 形成确定性语义文本，DOM HTML hash、语义文本 hash 与 task-owned artifact readback 一致，零/多完整候选失败，且不得把投影称为原始 Markdown bytes；候选 0 或多于 1 时无物理点击；`DISPATCHED` 不重放；同 attempt 已有 evidence 的 target-local call 跨 Target generation mutation count 为 0；原 Target 不可只读恢复时 attempt fail-close；wait 重启不刷新 absoluteDeadline；continuation 必须持有 prior prompt/response hash 且 persist/advance/release 在 DB commit/return 边界幂等；失败只返回当前原因和证据。
