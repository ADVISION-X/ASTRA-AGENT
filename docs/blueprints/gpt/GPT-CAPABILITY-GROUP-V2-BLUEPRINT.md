# GPT 能力组 V15 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "gpt-capability-group-v15",
  "status": "active",
  "owner": "gpt",
  "lawIds": [
    "LAW-GPT-001-V23"
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

`gpt` 只拥有 GPT Provider 的 27 个原子 Child、对应局部合同、Browser Authority 调用、直接后置证明和 typed result：二十一个 Provider 页面语义 Child、六个 continuation transaction Child。十二个 Product Plugin 各自直接拥有 Child 顺序、分支、重复、跳过、Prompt 语义、模型策略和结果组装；模型选择完成后重新确保 execution profile 打开、再设置推理档位，也属于每个 Product 自己的显式顺序。

```text
Product Plugin 的普通 TypeScript Flow
  -> ProductGptTools.execute(one typed child call)
  -> 一个 GPT Child
  -> Browser Authority exact Target + fresh Document
  -> observation，或 precondition + 至多一次 dispatch + postcondition
  -> success(value,evidence) | failed(reason,evidence)
```

必须物理不存在 `GPT_TURN_FLOW`、`GptTurnExecutor`、`executeTurn`、`runTurn`、全局 `stepIndex`、`resumePoint`、`flowVersion`、`reconcileOnly`、全局 GPT checkpoint 和固定 Child 间节拍。公共面不是 registry、bus、DSL、workflow engine 或第二调度器。

页面 Child 调用 Browser Authority 时，只有完成本次 typed command 必需的精确原文可以在现役认证且 AES-GCM 加密的 WebSocket 内瞬时通过：`write_exact_gpt_prompt` 的批准文本、text checkpoint 专用 exact-assistant-turn reply-only channel 的 exact assistant `outerHTML + semanticText`、一次批量 file-input 的 Browser 已解析批准路径、固定 start URL 或已验证 canonical conversation URL，以及 current Document 同一次 coherent observation 中产生并进入 revision hash 的 sanitized `currentUrl`。它们必须同时绑定 exact call、Target、current Document 和 payload hash；Prompt 与路径只进请求，DOM 正文只进 task-owned artifact，完整 canonical conversation URL 正文只进现役 task-owned submission-locator/continuation。Target admission 的 `claimOrigin` 永不进入 GPT 页面语义；GPT 不产生、不读取 Browser URL，只消费 Browser 签发的 revision-bound `currentUrl` 判断根页或 canonical conversation。Browser 日志、WAL、proof、诊断和错误回包只能保存 hash、长度、数量、ref、stage 与 typed cause，禁止复制原文。cookie、token、credential、任意页面身份和通用 opaque payload 仍绝对禁止进入 wire；不得增加第二 transport、第二 resolver、URL registry、字段改名旁路或 Browser 业务解释。

公开面采用静态类型映射：

```ts
type ExactGptContinuationReadback =
  | ExactGptTurnMarkerReadback
  | (ExactGptFrontierReadback & {
      authorizationReadback:
        | {
            kind: "origin_authorization";
            originAuthorizationRef: string;
          }
        | {
            kind: "current_artifact_read_grant";
            currentAuthorizationRef: string;
            ownerScopeHash: `sha256:${string}`;
            subjectRef: string;
            sourceArtifactRef: string;
            sourceCheckpointRef: string;
            semanticAdmissionReceiptRef: string;
            semanticAdmissionReceiptHash: `sha256:${string}`;
            opaqueReadGrantHash: `sha256:${string}`;
          };
    });

type AcquireGptContinuationLaneAuthorization =
  | {
      kind: "row_authorization";
      currentAuthorizationRef: string;
    }
  | {
      kind: "continuation_lane_use_grant";
      currentJobId: string;
      currentAuthorizationRef: string;
      opaqueLaneUseGrantHash: `sha256:${string}`;
    };

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
    lookupKind?: "current_attempt" | "task_exact_effect";
    productStepId: string;
    callId: string;
    child: K;
    actionOrdinal: number;
    input: GptChildInputMap[K];
  }): Promise<ExactGptCallFacts>;

  readContinuationExact(query:
    | { lookupKind: "turn_marker"; turnMarker: string }
    | {
        lookupKind: "frontier_ref";
        frontierRef: `sha256:${string}`;
        authorization: {
          kind: "origin_authorization";
          originAuthorizationRef: string;
        } | {
          kind: "current_artifact_read_grant";
          currentAuthorizationRef: string;
          opaqueReadGrantHash: `sha256:${string}`;
        };
      }
  ): Promise<null | ExactGptContinuationReadback>;
}
```

Product Plugin 不得提供 Target、Document、selector、WAL、lease、fence、mutation identity 或恢复指令。`sessionKey` 是产品定义的不透明逻辑会话槽；Browser Authority 唯一解析真实 Target 与 generation。

`readCallFacts` 与 product-neutral `readContinuationExact` 都不是第二 GPT Child 入口。前者默认由 production execution binding 注入 current job/attempt/plugin/version，以完整 input 计算 exact call identity，只组合 Browser mutation、Forensics evidence/artifact 和 GPT continuation 的安全只读事实；只有 Product 已从 verified current checkpoint 冻结了 successor Provider effect 的完整 step/call/child/input 时，才可显式使用 `task_exact_effect`，由同一读面在同 job/plugin/version 的 durable accepted attempt 分母内逐 attempt 重算完整 exact identity，并要求存在事实的候选为零或唯一。该模式不返回 attempt 列表、不按 latest/created_at 选择、不扫描近似 step/call、不供 `execute` 隐式使用；零条返回 current-attempt 空事实，多条或 mutation/evidence 身份不闭合失败关闭，是否跳过或继续仍只由 Product 静态 Flow 决定。后者只接受互斥的 exact `turn_marker` 或 exact `frontier_ref` 查询，严禁互相 fallback；frontier 模式只按调用 Product 提供的确定性 `frontierRef` 命中现役 `production_continuations` 唯一 row，复核 job/plugin/owner/subject/authorization 后一次返回 immutable origin provider/checkpoint 与 current provider/checkpoint。text checkpoint 必须从现役 task-owned artifact 读回 raw DOM + semantic text 并重算双 hash；generated-image checkpoint 必须从同一 Owner 读回 original/webp artifacts 并重算 content hash，同时读回并验证同一 receipt 内绑定的同 conversation 直接前驱 text checkpoint，使调用 Product 不必猜测或重做已完成成文；bytes 只在调用期返回，不存入 row、proof 或日志。两种查询均零条返回 null，多条、类型不符、hash 漂移、provider/checkpoint 不配对或权限不等失败关闭。二者都不调用 Child、不写入、不决定下一步，且禁止新增 SEO 专用公共读面、job-only/latest 查询、target/document、WAL row、state/phase/resumePoint/nextStep 或 per-call failure history。

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
| 图片 | `wait_for_stable_gpt_image` | 等待紧邻请求的 exact assistant section 生成停止且唯一语义主图稳定；不要求内层 assistant-role 节点或文本 |
| 图片 | `checkpoint_gpt_generated_image` | 以同一 assistant section + semanticMediaId 经当前已鉴权页面取得原始 bytes 与 proof |
| 会话 | `open_gpt_checkpoint_actions_menu` | 对 Product 指定的 exact source checkpoint 打开或确认唯一操作菜单，并证明唯一“打开新分支”叶子；不得创建 child relation |
| 会话 | `fork_exact_gpt_conversation_at_checkpoint` | 在已证明的 exact source-bound 操作菜单内至多一次 fork，并读回唯一 child relation；不得再次打开菜单 |
| Continuation | `persist_gpt_continuation` | 保存永久 URL、turn marker、prior prompt/response hash、conversation identity 与主体绑定 |
| Continuation | `reserve_exact_gpt_continuation_once` | 在现役 continuation row/store 以 opaque reusable-origin 或 derived-source identity 作一次 reservation CAS |
| Continuation | `complete_exact_gpt_continuation_reservation_once` | 在同 reservation/lane/fence 一次写齐 provider、artifact、semantic-admission 与 read-grant receipt 并释放 reservation lane |
| Continuation | `acquire_gpt_continuation_lane` | 对精确 continuation 获取 lane CAS |
| Continuation | `advance_gpt_continuation_lane` | 在一个 lane CAS 内原子推进 provider + checkpoint receipt 并释放 lane |
| Continuation | `release_gpt_continuation_lane` | settle 后释放精确 lane |

Browser Target/Document 绑定、mutation WAL 与 mutation outcome 对账属于 Browser Authority，不是 GPT Child。find/read/click、DOM 候选过滤和 selector 属于对应 Child 的私有实现，不再拆公共能力。

`reserve_exact_gpt_continuation_once`、`complete_exact_gpt_continuation_reservation_once` 与现役 `acquire_gpt_continuation_lane` 必须始终由 Product 作为三次独立 `execute` 显式排列。reserve 的 typed union 只区分无 source checkpoint 的 reusable-origin 与绑定 exact source checkpoint 的 derived-continuation；两者都只在唯一 `production_continuations` row/store 写一次 reservation 或按完全相同内容幂等读回，冻结 creator job、lane/fence、effect identity 与 origin provenance。complete 只在同 reservation identity/lane/fence 上一次写齐 provider、task-owned artifact、Website exact semantic-admission receipt 与 opaque read-grant 必需字段，然后释放 reservation lane；必需字段未齐时 row 不 complete，现役 acquire 必须拒绝。acquire 默认只接受 `row_authorization`，current authorization 必须等于 row authorization；只有 typed `continuation_lane_use_grant` 将 current job/current authorization、row origin authorization、owner/subject、exact manifest 与 continuation relation 全部绑定并验证后，才允许同一 acquire Child 做一次跨 entitlement lane CAS。DB commit 后 return 前崩溃只允许同内容 readback。其它 task 不得偷取未完成 reservation 或重做 origin effect；共享层不得出现 Bazi、private base、Product id、Prompt、nextStep、phase 或业务 status。

`readContinuationExact({lookupKind:"frontier_ref"})` 仍是唯一 product-neutral exact continuation 读面。`origin_authorization` 严格复核 origin authorization；`current_artifact_read_grant` 机械复核 current authorization、owner/subject、exact source artifact/checkpoint、semantic-admission receipt 与 opaque read-grant 后读取同一 complete row 的 origin artifact，不要求尚未存在的 manifest 或 child relation。返回型必须同时读回已验证 authorization kind/current authorization、semantic-admission receipt 与 opaque read-grant hash，让 Product 不需自创字段。`continuation_lane_use_grant` 不在该 read variant 混用，它只是现役 acquire 的 typed authorization。该能力不新增 query kind、API 或 store，零条返回 null，多条或当前 typed variant 任一绑定不等失败关闭。

## 3. 原子 Child 合同

每个 Child 必须在现役唯一 contract map 中显式声明八项内容：`childId + contractVersion`、原子语义意图、唯一 Owner/读写边界、exact call 输入、唯一能力画像与 bounded-wait 资格、DONE/ACT/WAIT/FAIL_CLOSED 的局部事实和裁决、零或一次 mutation 加完整正反后置、最小安全证据。任何字段都不得由通用默认模板、自由 `observedSemantics`、调用顺序或历史成功推导。

画像分母固定为：

| Profile | Child |
|---|---|
| `DOM_OBSERVATION`（6） | `verify_gpt_conversation_identity`、`reconcile_gpt_attachment_set`、`reconcile_gpt_draft`、`reconcile_gpt_turn_submission`、`checkpoint_gpt_text_response`、`checkpoint_gpt_generated_image` |
| `TARGET_LOCAL_MUTATION`（12） | `prepare_clean_gpt_chat`、`focus_exact_gpt_conversation`、`open_gpt_execution_profile`、`open_gpt_model_selector_v2`、`select_exact_gpt_model_v2`、`ensure_exact_gpt_reasoning_tier`、`close_gpt_execution_profile`、`open_gpt_attachment_control`、`write_exact_gpt_prompt`、`wait_for_stable_gpt_text`、`wait_for_stable_gpt_image`、`open_gpt_checkpoint_actions_menu` |
| `PROVIDER_EFFECT_ONCE`（3） | `attach_approved_gpt_files_once`、`submit_exact_gpt_turn_once`、`fork_exact_gpt_conversation_at_checkpoint` |
| `CONTINUATION_TRANSACTION`（6） | `persist_gpt_continuation`、`reserve_exact_gpt_continuation_once`、`complete_exact_gpt_continuation_reservation_once`、`acquire_gpt_continuation_lane`、`advance_gpt_continuation_lane`、`release_gpt_continuation_lane` |

bounded-wait 只是画像附加特征：`open_gpt_execution_profile`、`open_gpt_attachment_control`、`reconcile_gpt_attachment_set`、`reconcile_gpt_turn_submission`、`wait_for_stable_gpt_text`、`wait_for_stable_gpt_image` 只能在各自合同冻结的上限或调用既有 deadline 内对正面瞬时事实 fresh observe。前两个 Child 只等待当前 Document 的入口或直接后置 hydration，不等待 Product 步骤、不跨 Target/Document，也不取得额外 mutation 配额；候选多义、结构冲突或 native payload 非法必须立即失败。公开 terminal 始终只有 `success(value,evidence)` 或 `failed(typedReason,evidence)`；六个局部裁决不持久化、不进入 Product 状态。

所有页面 Child 的一次裁决只能消费 Browser 在同一 typed observation 内原子采集、或由 Browser 机械证明 revision 未变化的 `BrowserDomObservationPacketV2`。packet 固定绑定 exact call、Target、current Document、sanitized `currentUrl`、observation revision、observedAt、该 Child 最少充分的稀疏事实和 native cause；`currentUrl` 必须与 DOM facts 来自 current Document 的同一次 `Runtime.callFunctionOn` 并共同进入 `observationRevisionHash`。整包 stale、`currentUrl` 缺失/非法、Document/revision 改变或未完整返回时整包作废，禁止 Child 从 `claimOrigin`、Target claim 时 URL、`Page.getFrameTree`、另一次 URL/DOM 读取、页面外请求或持久 snapshot 拼接。Observation V1 的类型、decoder、caller 与 tests 在同一 CHANGE 物理删除，不存在 V1/V2 union、alias、optional currentUrl、dual-read 或 fallback。Browser 只签发物理事实；GPT 只负责 root/conversation Provider 语义，不读取 raw WAL、Target/Document 或把 Browser terminal 当成 GPT 语义。

真实页面的分支入口是两个独立状态变化，Product 必须显式排列两个调用。`open_gpt_checkpoint_actions_menu` 只接受 Product 已冻结的 exact source provider/checkpoint、canonical conversation URL、turn marker、prior prompt/response identity 与自己的 exact call identity；若同一 source-bound active menu 和唯一“打开新分支”叶子已经成立则零动作成功，否则只点击该 source turn 的唯一更多操作入口一次，并以 fresh coherent packet 直接证明菜单与叶子。它是 target-local mutation，不得创建 child relation或点击 fork 叶子。

`fork_exact_gpt_conversation_at_checkpoint` 使用独立 exact call identity，只接受已经由自身 fresh 前置重新证明的同一 source-bound active menu 与唯一 fork 叶子；Browser Authority 至多 dispatch 一次 fork 叶子动作，后置必须唯一读回 child conversation identity、child URL/marker 与 source-to-child relation，不得再次打开菜单。fork 是 provider-effect-once：WAL/Forensics 必须产生 DISPATCHED/CONFIRMED/REJECTED，`readCallFacts(task_exact_effect)` 按同 task/plugin/version/call/input/source checkpoint 重算完整 identity并只返回 Product-safe 的零或唯一 fact。commit-before-return 后只读原 child，禁止第二次 fork。任一步 missing、ambiguous、stale 后不能 fresh 闭合或关系多义都以自身 typed reason 零额外动作失败，不允许循环点击、latest source、same-conversation fallback 或第二 Browser capability。

`checkpoint_gpt_text_response` 的 DOM 责任是完整取回 Provider 当前实际呈现的产物，不是解释 JSON 或业务内容。它必须锁定精确 assistant turn，并通过专用 exact-assistant-turn reply-only typed channel 保存该节点完整 `outerHTML`；唯一 JSON code block 时读取 code `textContent`，没有 code block 时遍历完整 semantic tree，把 `<br>`、块级边界、列表以及 `<strong>/<em>/<code>` 等标签确定性投影为显式 canonical 标记，保留转义、Unicode 与全部可见字符。canonical text 是 observed DOM 的可追溯语义投影，不冒充 Provider 原始 Markdown/source bytes；原 DOM HTML 与投影文本及各自 hash 一起进入同一 task-owned output artifact，二者不得进入通用 coherent packet。禁止散落 text-node 拼接、`innerText` 布局副作用、预设业务字段选择器或正则截断；零个或多个完整 assistant 候选必须 typed fail-close。Forensics 与 Runtime Logs 只保存 artifact ref/hash，不保存 DOM 或正文。

`wait_for_stable_gpt_image` 与 `checkpoint_gpt_generated_image` 的 turn Owner 是紧邻已验证 user turn 的唯一外层 `conversation-turn-*[data-turn='assistant']` section，而不是其内可选的 `[data-message-author-role='assistant']` 文本节点。每次 fresh probe 必须证明该 section 唯一、Provider stop/generating 控件缺席。Browser 已鉴权媒体原子命令必须在同一 current Document 再证明该 section 恰好一个，并把其中 raw `<img>` 机械投影为语义候选：只有 connected、`complete=true`、natural width/height 均大于零、非零布局、computed display/visibility/opacity 非隐藏且 NFC `alt` 非空的节点进入集合；禁止像素阈值和首节点选择。物理节点先按页面内资源 identity 收敛，再在当前登录会话内取得原始 bytes并按 content hash 去重；同 bytes 的重复 URL/节点只算一个，最终 content identity 零个继续等待、多个立即 typed fail。集合恰好一个时，wait 返回 assistantTurnId、semanticMediaId 与 mediaHash；Browser reply 同时返回 target/document hash 与原始 bytes receipt。该 assistant section 可以没有可见文本。checkpoint 必须用相同 assistantTurnId + semanticMediaId + mediaHash 重新取得并证明同一媒体，task-owned receipt 再绑定 canonical conversation、turn marker、prompt hash、原图/变换 content identity 与直接前驱 text receipt；禁止 responseText/responseHash/expectedResponseHash 文本门槛、inner assistant-role 门槛、选择第一个 raw img、截图、DOM URL、页面外 fetch 或第二 downloader。

每次调用身份固定为：

```text
job_id + attempt_id + plugin_id + plugin_version
+ product_step_id + call_id + child_id + input_hash
```

同一业务 attempt 跨 lease、进程、Target 和 build 保持同一 Provider effect identity；新业务 attempt 取得新 identity。Target-local Browser mutation 另加 `target_generation`，但 exact GPT call evidence identity 不加 target generation。同 attempt 已有 verified evidence 或 DISPATCHED/CONFIRMED/REJECTED Browser fact 的 target-local call 禁止在新 Target generation 重做物理 mutation；原 Target/Document 可恢复时只读 rehydrate。Browser Authority 权威证明原 Document 不存在时，target_local 只能消费 Browser public reconciliation 终结的 `REJECTED + mutation_outcome=dispatched`，GPT/Product 不写 Browser WAL、不自行结算 outcome；provider_effect 不得因 Document 丢失简化终结，仍依 Browser WAL、Forensics receipt 与 task-owned locator 只读对账。唯一换 Target 例外是 exact Provider submit 已有唯一 Browser WAL + Forensics `CONFIRMED + passed` receipt，此时 Runtime 保留同一 accepted attempt，Browser 通过现役 acquisition 建立新的合法 system Target/Document，GPT 使用 task-owned submission-locator 的 canonical conversation URL + marker + prompt hash + conversation identity 只读重证原 turn，所有 Provider mutation 增量为零。创建下一 attempt 前必须证明前一 attempt 没有未收束 `DISPATCHED`。

Provider effect 一次性只在同一业务 attempt/call 内成立；不存在 verified confirmed effect 时，新 attempt 才可在安全前提满足后首次执行未完成 effect。已有 `CONFIRMED + passed` receipt 的 effect 不因 Target/Document 丢失而获得重新执行资格，只允许同 accepted attempt 跨合法 system Target/Document 只读回证。`DISPATCHED` 永远先读 WAL 与当前页面后置判据，禁止盲重放。

## 4. 当前 Document 前置

所有 Child 每次都读取当前 Target + 当前 Document。过去调用成功、产品步骤位置或任何 checkpoint 都不能证明瞬态弹面仍存在。模型或推理操作前，若 execution profile 不存在，Product Plugin 必须先调用 `open_gpt_execution_profile`；Child 自身仍须重新验证当前 DOM。Provider text/image wait 与 checkpoint 每次 probe 都在当前合法 system Target 上先复核 canonical conversation URL；URL 漂移时只在该 Target 导航复位并作一次有界 hydration，再以 turn marker 找到唯一 user turn。prompt hash 只对该 turn 内唯一请求正文机器节点计算：读取现役 deterministic semantic tree，恢复 strong/em/code 等显式标记，只移除投影算法为根块额外加入的一个终止分隔换行，并保留正文自身全部字符与尾换行。当前生产长消息的实证节点固定为 `[data-testid='collapsible-user-message-content']`，外层 `[data-message-author-role='user']` 的附件卡片、文件名与展开/收起控制文字不属于 Prompt；禁止 textContent 丢 Markdown 结构，也禁止 trim、删反引号或其它内容启发式。正文节点零个、多于一个或 canonical rendered-prompt hash 不等都零 mutation 失败关闭；随后只接受紧邻 assistant turn。文本 wait/checkpoint 用 canonical response hash 锁定稳定语义文本；图片 wait/checkpoint 只用 assistantTurnId + semanticMediaId + mediaHash/content identity 锁定媒体，禁止 responseText/responseHash 门槛。URL、marker、prompt hash、相邻 assistant 及当前结果类型对应的 text response hash 或 image media/content identity 任一不成立都不得接收。

`reconcile_gpt_turn_submission` 的输入同时绑定 `turnMarker + expectedPromptHash`，成功值固定包含由 revision-bound `currentUrl` 判定的 canonical conversation URL、turn marker、user turn id、canonical rendered-prompt hash 与 conversation identity。唯一 Runtime/Forensics evidence writer 必须在该成功返回后、单一生产 Tab 让出时间片前，以同一 exact call identity 的受控 `submission-locator` suffix 写入并读回 task-owned artifact；同 identity 重放先读该 artifact并返回原成功值，再由后续 wait/checkpoint 导航 URL 作 live 验证。完整 canonical conversation URL 正文只持久于该既有 submission-locator 与 continuation；confirmed-submit recovery authorization 只能从两者已验证 readback 派生为短生命周期 typed 内存投影，用毕释放，不得写入 artifact、row、WAL、log、proof、registry/ledger 或成为第四份 URL 真相。该 submission-locator artifact 不写 proof 正文/Runtime Logs，不成为 continuation、恢复状态机或第二 locator store。

`CONFIRMED` submit receipt 与上述 submission-locator 一旦唯一闭合，就足以授权同一 accepted attempt 的只读回证；`continuationRef`、回答 checkpoint、response hash 或已完成 Product frontier 都不是前置。该规则同时覆盖 fresh 首轮和 continuation follow-up：Runtime 必须先配对 exact submit + locator，Product 再从 locator/reconcile、wait 或 checkpoint 中首个未确认动作继续；已完成的模型、附件、Prompt、draft 与 submit 必须物理跳过。locator 缺失、多义或 hash/identity 不闭合时失败关闭，绝不得以重新提交补证据。

`prepare_clean_gpt_chat` 的成功集合只能是：唯一 composer，读回的 exact draft 为空字符串，user turn、attachment 与 generating 候选均为零。当且仅当后三项均为零且 composer 唯一、但读回存在旧 draft 时，该 Child 必须通过 Browser WAL 执行至多一次 exact composer 清空并直接读回空字符串；不得把旧 draft 当成新任务输入。存在 prior turn、attachment、generating 或候选不唯一时不得清理，必须以 `mutation_outcome=no` 失败关闭。

`open_gpt_model_selector_v2` 的唯一许可是：

```text
ALREADY_OPEN :=
  唯一 profile popup
  AND [role='menuitem'][aria-label='选择模型'] 为零
  AND active non-inert simple panel 为零
  AND 唯一 [data-testid='composer-model-picker-slider-advanced-view']
             [data-active='true']:not([inert])

OPENABLE :=
  唯一 profile popup
  AND 唯一 [role='menuitem'][aria-label='选择模型']
             [aria-expanded='false'][aria-hidden='false']
  AND 唯一 active non-inert simple panel
  AND advanced panel 为零

success := ALREADY_OPEN OR (OPENABLE -> click once -> ALREADY_OPEN)
```

状态是等于或 OR 关系；两者均不成立、同时成立或任一要求的候选不唯一都返回 `failed + reason`，不得点击。OPENABLE 点击后的直接后置必须等待 React 过渡态结束并命中稳定 ALREADY_OPEN；旧的 expanded-entry 中间态不能成功，也不得以新旧兼容 OR、fallback selector 或固定 sleep 放行。`select_exact_gpt_model_v2` 只在唯一 active、non-inert advanced panel 中读取 visible `[role='menuitemradio']`；无论唯一目标 radio 当前 `aria-checked=true` 或 `false`，都点击这个精确 radio 一次，严禁点击模型入口。Browser 必须在这一次 mutation 的同一 coherent postcondition packet 内一次性直接证明：同一 profile popup 仍唯一存在、唯一模型入口为 `aria-expanded=false`、active non-inert simple panel 恰好一个、advanced panel 为零；任何一项不成立都返回 typed failure。GPT Child 直接消费该 packet 结算，不得随后另发第二次 DOM observation，把 React 的另一个瞬间拼进本 Child 裁决。

模型 Child 的成功不授权后续推理 Child 假定瞬态 popup 仍然存在。每个 Product 的静态 Flow 必须显式排列 `select_exact_gpt_model_v2 -> open_gpt_execution_profile -> ensure_exact_gpt_reasoning_tier`：中间的 `open_gpt_execution_profile` 在当前 Document 重新确认父菜单。其 coherent query 集合封闭为 `popup`=`GPT_PROFILE_POPUP_SELECTOR`、`simple-panel`=`GPT_PROFILE_SIMPLE_PANEL_SELECTOR`、`reasoning-control`=`GPT_PROFILE_REASONING_CONTROL_SELECTOR`、`enabled-reasoning-control`=`GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR`、`reasoning-value`=`GPT_PROFILE_REASONING_VALUE_SELECTOR`、`trigger`=`GPT_PROFILE_TRIGGER_SELECTOR` 六组；每组必须保留 `scopeRawCount/scopeEligibleCount/rawCount/eligibleCount/rejections/nativeCauseCode/nativeCauseCount` 与整包 `observationRevisionHash`，其中 `reasoning-value` 另取 `ariaValueMin/ariaValueMax/ariaValueNow`，`trigger` 另取 `ariaExpanded`。封闭裁决为：`WAIT` 仅当六组 `raw=eligible=0` 且 current Target/Document 未变、仍在 5 秒上限内；`DONE` 仅当 popup、simple、reasoning、enabled-reasoning、reasoning-value、trigger 均为 `raw=eligible=1`，slider 为 `0..4/current∈0..4` 且 trigger expanded=true；`ACT` 仅当前五组 `raw=eligible=0` 且唯一 trigger 为 `raw=eligible=1 + expanded=false`，随后点击一次并由该 mutation 的同一 coherent postcondition packet 达到 `DONE`；其余任一 raw/eligible 多义、ineligible raw、部分结构、字段非法、Target/Document 漂移或到期全零一律立即 `FAIL_CLOSED`，分别保留上述候选证据并返回稳定 typed reason。不得使用固定 Child 间 sleep、共享 profile workflow、兼容分支或第二选择链替代这次事实确认。

推理的可操作节点固定为唯一 `[role='menuitem'][aria-label='能力']`；状态只从 `[data-model-reasoning-effort-slider] [role='slider']` 读取，必须满足 `aria-valuemin=0`、`aria-valuemax=4`、`aria-valuenow in 0..4`。映射为 `0=极速、1=中、2=高、3=极高、4=Pro`。等于目标时零 mutation，否则只向唯一能力 menuitem 发送有界方向键并回读等于目标；不可直接操作 `aria-hidden` slider。

附件入口固定为 `button#composer-plus-btn[data-testid='composer-plus-btn'][aria-haspopup='menu']`，并只在唯一 composer form scope 中查询；上传叶子 query 固定在真实 Chrome 已证明唯一可见的活动菜单 scope `#thread-bottom div.popover[aria-busy='false']` 内，以 `div.__menu-item[tabindex='0'] span + textEquals("从电脑上传")` 查询。两组均保留 `scopeRawCount/scopeEligibleCount/rawCount/eligibleCount/rejections/nativeCauseCode/nativeCauseCount` 与整包 revision。封闭裁决为：`WAIT` 仅当入口 `raw=eligible=0`、活动菜单 `scopeEligible=0`、叶子 `raw=eligible=0`、current Target/Document 未变且仍在 5 秒上限内；`DONE` 仅当入口 `raw=eligible=1`、活动菜单 `scopeEligible=1`、叶子 `eligible=1`，且同 scope 内其余 raw 叶子的 rejection 全部只是 `TEXT_MISMATCH`；`ACT` 仅当入口 `raw=eligible=1`、活动菜单 `scopeEligible=0`、叶子 `raw=eligible=0`，随后点击一次并由该 mutation 返回的同一 coherent postcondition packet 达到 `DONE`；其余入口/作用域/叶子多义、ineligible raw、活动 scope 已出现但精确叶子缺失、非法 rejection/native payload、Target/Document 漂移或到期全零一律立即 `FAIL_CLOSED`。作用域外的页面隐藏/折叠旧菜单必须被排除，若旧 popover 仍匹配 scope selector 则只能作为 scope rejection，二者都不得授权，也不得把页面全局 raw 数量冒充活动菜单多义。等待不增加点击配额，点击后禁止第二次 DOM observation 拼接成功。隐藏 `#upload-files` 只由 Browser Authority 在 dispatch 前校验，不作为上层可见候选。

`attach_approved_gpt_files_once` 只负责一次获准 file-input batch。Product→GPT 的输入继续严格为 `{artifactRef, displayName, sha256, bytes}`；由于 Provider 会对跨会话重复文件名自动追加 `(n)`，该 Child 是 `providerDisplayName` 的唯一语义 Owner，必须在不改变获准 bytes、sha256、artifactRef 与业务 display name 的前提下，为每个 attempt + artifact 派生唯一且确定的 `providerDisplayName`，并以 `{artifactRef, providerDisplayName, expectedSha256, bytes}` 调用现役唯一 Browser attach 入口。该入口必须同时携带本 Child 源码冻结的活动菜单 scope、精确上传叶子 selector 与 `textEquals("从电脑上传")`，Browser 只对它们做机械重验并在现役唯一 `browser.file-input.v1` 内执行一次可见叶子点击、一次同文档 chooser backend-node 绑定和一次批量 file set；禁止 GPT 另发 click Child，也禁止 Browser 直接向隐藏 input 写入、chooser 失败后 fallback 或再次上传。GPT 不取得 `localPath`、不构造或复制本地文件；Browser 只对名称、文件与 grant 做机械验证，并通过现有 execution artifact binding 调用 Runtime Owner 的 task-owned 窄化 materializer，由 Runtime 在同一材料目录中建立该精确 basename 的 hardlink 临时别名并在 binding settle/abort 时清理。hardlink 不可用时 typed fail-close，禁止 copy fallback、Browser 私有目录、第二 resolver/store 或兼容路径。后续 Prompt 只能引用 Child 返回的 `providerDisplayName`，不得继续引用会被 Provider 改写的业务 display name。ZIP 与其它附件对 GPT Child 都是不透明 bytes；Child 不得解压、解释 entry、验证 Product 内部目录或另建材料清单。附件卡片与文件名出现不能证明 Provider 上传完成。`reconcile_gpt_attachment_set` 必须完整采用 Product 给定的有界 `timeoutMs`，不得以 60 秒或其它公共常量缩短，在该期限内重复读取 fresh DOM：attachment region 唯一、卡片数量与 NFC `providerDisplayName` 集合全部且仅有批准项，每个精确卡片的 `svg[data-testid='library-file-icon']` 都具有 Browser 可见盒子，并且 `svg[class*='animate-spin']` 可见数为零，才可成功。选择器必须直接落到待判定 SVG，不得用 `:has(...)` 让可见外层卡片掩盖不可见子节点。Browser 将已识别的 DevTools no-layout/no-box 结果投影为当轮不可见候选时，Child 必须继续同一 `timeoutMs`；遇到 `BROWSER_DOM_NODE_STALE` 时必须丢弃旧 nodeId，并从 attachment region、exact labels、ready icons 与 spinners 开始重做完整 fresh Document 只读核验。两种情况都不得产生 mutation；只有 CDP record/number/coordinate payload 真实畸形的 `BROWSER_DOM_READ_INVALID` 才立即失败关闭。条件满足即提前返回；集合冲突立即失败；仅 spinner 或未完成卡片持续存在时等待到 Product 上限并以 `GPT_ATTACHMENT_UPLOAD_TIMEOUT` 失败。只有真实 Chrome 已实证并冻结唯一机器身份的明确 Provider 上传错误才可立即返回对应原生 typed failure；当前没有该身份时不得虚构通用错误 selector、文本规则、selector fallback、第二 DOM 读取链或第二上传路径。该 Child 成功前 Product 不得写 Prompt 或提交；`submit_exact_gpt_turn_once` dispatch 前必须重新读取 composer，证明 exact prompt hash 与 turnMarker 仍在，否则以 `GPT_PROMPT_CHANGED_BEFORE_SUBMIT` 零 mutation 失败。

`wait_for_stable_gpt_text` 与 `wait_for_stable_gpt_image` 共用 GPT Owner 内唯一的 conversation-history 提示合同。每次 fresh probe 先只读检查可见 `[data-testid='modal-conversation-history-rate-limit']`：零个继续原 probe；恰好一个时必须同时证明其内恰好一个 `[role='dialog']`、唯一 `h2` 精确文本为“请求过于频繁”、唯一可见启用 `button` 精确文本为“明白了”。只有全部成立且本次 wait 尚未确认过该提示，才通过当前 exact wait call 的 Browser WAL 至多点击一次，并直接证明 root 变为零后重新执行原 conversation URL + marker + prompt hash 前置。多 root、结构/文本漂移、按钮多义或不可用、同次 wait 第二次出现都必须 typed fail 且不得再点击。该动作只关闭遮挡，绝不证明限制解除、回答稳定或允许 submit；不新增 Child、Product 分支、限流表、计时器或第二恢复状态。

## 5. 失败、证据与验收

`pending` evidence 失败关闭只表示未决事实绝不能进入 completed-result replay。同一 exact identity 的 Browser WAL 或 session CAS 仍为 `DISPATCHED` 时，仅允许原 attempt 沿原 Target/Document 或原 session CAS 做只读/幂等对账；若对账取得 `passed` 或 `failed`，唯一 evidence writer 以 `gpt-call-terminal-evidence:v1:<exactCallIdentityHash>` append-only 写一次终态结算，唯一读面优先 terminal、缺失时才读 initial pending。再次得到 pending 不写结算；禁止覆盖 initial、刷新 identity、由新 attempt 对账，或增加第二 writer、table、verdict。

Child 只返回 `success` 或 `failed + typed reason`。真实页面/Provider failure 必须包含 `code`、`mutationOutcome=no|dispatched|confirmed`、`evidenceRef/evidenceHash` 和存在时的最内层原生 cause；debugger detach/channel 原因不得被统一 `BROWSER_INFRASTRUCTURE_FAILED` 覆盖。Browser DOM candidate missing/ambiguous、rerender stale node、可见性/box 读取和 CDP payload 形态错误必须分别保留稳定 typed cause，`BROWSER_TARGET_INVALID` 只表达 exact Target identity 本身无效。`reconcile_gpt_turn_submission` 在自己的既有 timeout 内遇到瞬时 DOM candidate/stale cause 时，必须重新取得 fresh node 并从 user-turn count/composer/document 开始重做完整只读前置；它不得捕获真正 Target/Document 失效，也绝不得重发 submit。

safe evidence projection 必须保持 Browser terminal、物理 mutation 与 GPT 语义后置三者正交。Browser WAL 已为 `CONFIRMED` 而 GPT 的后续 direct semantic postcondition 失败时，同一 GPT failed proof 必须如实保存 `browserOutcome=CONFIRMED + mutationOutcome=confirmed + postconditionResult=failed`；不得把它降成 `mutationOutcome=no`，也不得据此把 GPT Child 判为 success。原 submit 与当前 readback Child 仍必须分开保存：exact submit 的 Browser WAL mutation 与 Forensics evidence 已共同读回 `CONFIRMED + passed` 后，原 Provider effect 永远保持 confirmed；后续 reconcile/wait/checkpoint 的 `mutationOutcome=no` 只描述该只读 Child。只要不存在 Provider 明确 terminal negative、Website 永久业务撤权、submit evidence 损坏或多义，Runtime 必须引用原 exact fact 构造现役 `POST_SUBMIT_READBACK_FAULT + confirmed_submit` lease release，同一 accepted attempt 重领后由 Product Progressive Exact Fact Replay 跳过 submit 并继续读回。cause code、Target/Document read failure、wait absoluteDeadline、进程重启和普通 attempt cap 都不得充当恢复 allowlist 或成果存亡门；deadline 只结束一次 wait/probe，Website 用现役 `retry_not_before` 退避。Child 不返回 `review_required`、`recovery_pending`、流程位置、重试决策或历史 per-call failure。exact text/image checkpoint 成功后的接收、归一或组装软件故障同样引用原 artifact/ref/hash 沿原 attempt 恢复；任何已完成 frontier turn 均不得重新提交。

Continuation lane 的结构边界固定为：首次 persist 必须先验证 origin provider/checkpoint 成对、current=origin、prior_task_id=jobId，再原子写入；advance 必须先验证 current provider 与 text semantic hash 或 image media hash、URL、Prompt、marker 成对，再以同一 lane/version CAS 原子写 current provider/checkpoint 并清空 owner；release 只清空同一 owner/version，同 lane/version 已 owner=null 说明 advance/release 已结算，旧 provider lane 的 finally release 必须幂等 no-op而不得覆盖原 evidence 故障。generated-image current receipt 必须在自身内部绑定经 artifact readback 验证的同 conversation 直接前驱 text receipt；它仍是一份 current receipt，不形成历史链或第二状态。调用 Product 在 acquire 成功的下一语句立即进入 try/finally，expected provider compare、conversation focus/verify 或任一后续调用抛错时都必须 release；只有 advance 已成功或 DB commit 后幂等 readback证明成功时才设置 settled。合法 task-local busy lane 不是 ledger corruption；异常遗留 lane 只影响所属 job，并由同一 job 下一 accepted attempt 的现役接收事务释放，不得阻断其它 job、增加 cleanup worker 或建立第二 ledger。既有 frontier row 的一次性 cutover 不得在 schema migration 阶段盲写 current：evidenceStore 可用后，current provider=origin provider 时仍须读回 origin text artifact/evidence/hash 再复制；current provider 已推进时，现役部署只允许从同 job/plugin 的 task-owned exact-call artifact 唯一重建与 current provider 的 URL/marker/prompt/response hash 全等的 article text receipt。旧 generated-image provider 没有持久直接前驱 text receipt，不能伪造新 receipt，必须只让所属 task以精确 cutover code fail-close且禁止重做 Provider turn；零条、多条或不等同样 task-local fail-close，不得回退 provider、保留 nullable/legacy reader或阻断其它 task。

固定 5 秒等待被删除。等待只允许是单个 Child 为 fresh DOM、hydration 或直接 postcondition 使用的有界实现，并由真实条件提前结束。Provider text/image wait 必须分解为 fresh DOM 驱动的短 probe，每次 probe 后根据实际 Provider 状态计算瞬时 nextCheckAt，未到时不进 Browser FIFO；每次重领都重新完成 canonical URL + marker + prompt hash + 相邻 assistant，并按类型重证文本 response hash 或图片 media/content identity，总生命期以 exact submit 首次 CONFIRMED 的 immutable terminalAt + Product timeoutMs 为 absoluteDeadline，重启不刷新。不得新增 wait table/ticket/durable nextCheckAt。`close_gpt_execution_profile` 只能使用当前 profile Owner 内经实证唯一的收束动作并直接证明 popup 缺席，不得假定点击 composer 必然收束 profile。

授权验收必须额外证明：`current_artifact_read_grant` 零 manifest/child-relation 要求且只在 current authorization、owner/subject、source artifact/checkpoint、semantic-admission receipt/read-grant 全闭合时读回；`continuation_lane_use_grant` 则只在 current/origin authorization、owner/subject、manifest/continuation relation 全闭合时允许现役 acquire 一次跨 entitlement CAS。两种 grant 不得互换、合并或补默认值。

URL 闭环验收必须逐项证明：所有页面 Child 只消费与 current Document 同一次 observation 且进入 `observationRevisionHash` 的 sanitized `currentUrl`；`claimOrigin`、Target claim 时 URL、`Page.getFrameTree` URL、另一次读取和 caller 值均不能满足任何 GPT 页面语义。根页只接受 `/`，conversation 只接受 `/c/<单个非空有界 opaque segment>`，query/fragment 已在 Browser 物理丢弃；currentUrl 缺失、非法、与 revision 不闭合或语义不符时零 mutation fail-close。完整 canonical conversation URL 正文只在现役 submission-locator/continuation readback 出现，recovery authorization 只在调用期内存投影且不可持久化。通用 coherent observation 不得含 rawDomHtml/semanticText，只有专用 exact-assistant-turn reply-only typed channel 可返回二者。

聚焦验收必须证明：27 个 Child 精确且画像数量为 6/12/3/6；27 行均具八项显式合同、共同硬门及画像附加门，页面 Child 只消费 coherent Browser packet，六个 continuation 不调用 Browser；reserve/complete/acquire 三调用互不合并且每个 mutation count 恰为一，reservation 与 completion 的 commit-before-return 都只读回原 receipt，未 complete row 不能 acquire，非 creator 不能偷取未完成 reservation；opaque grant 的 current/origin authorization、owner/subject、source checkpoint、manifest/continuation 任一错配都在 artifact read 前失败。Product 对 fork 必须显式调用 `open_gpt_checkpoint_actions_menu` 后再调用 `fork_exact_gpt_conversation_at_checkpoint`：前者只打开或确认唯一 source-bound 菜单且 mutation 为零或一，后者只点击唯一 fork 叶子一次；菜单已经打开、菜单 missing/ambiguous、两动作间 redraw、fork DISPATCHED 后崩溃、CONFIRMED-before-return、source 错配、零/多 child 与 relation 多义都必须逐项证明，任何路径不得循环点击或把两 action 合并。公共面无 turn API；产品能显式调用任意 Child 序列；每个已开始 Child span 在 Browser lease 获取、park、reacquire 或原子能力任一失败点都恰好产生一个 typed terminal；readCallFacts 与 readContinuationExact 都只读、无流程决策与无 failure/state/Target/WAL 泄漏，turn-marker/frontier-ref 查询互斥且互相 fallback 为零；模型面板必须覆盖 OPENABLE、点击后旧 expanded-entry 过渡态和稳定 `popup=1 + entry=0 + simple=0 + advanced=1` 的 ALREADY_OPEN，只有稳定终态可成功；已选中和未选中两种真实页面状态都只点击唯一 radio 一次，模型入口额外点击计数为零，选择后 popup 保留、entry collapsed、simple active、advanced absent；Browser `CONFIRMED + confirmed` 后 GPT semantic postcondition failed 必须保持 failed且 proof 正交保存三项真相；`open_gpt_execution_profile` 必须覆盖全零候选 `0 -> 1` hydration 后一次打开、已经 DONE 零动作、六组任一 raw/eligible 多义或 ineligible raw/部分结构立即失败、5 秒全零 timeout、Target/Document 漂移，并逐项断言 failure proof 保留六组 rejection/native cause/revision；其点击后的完整 DONE 只能来自同一 mutation coherent packet，额外 DOM observation 为零。`open_gpt_attachment_control` 必须覆盖入口 `0 -> 1` hydration、页面全局隐藏旧节点存在但活动 scope 为零、点击后唯一活动 scope 内 raw 多叶子而 exact eligible=1、其它叶子全部 `TEXT_MISMATCH`、scope/leaf/入口 partial conflict 立即失败、5 秒全零 timeout、Target/Document 漂移，并断言最多一次点击、同一 mutation coherent packet、点击后额外 DOM observation 为零及候选 rejection/native cause/revision 保真；相应 mutants 必须让删除 scope、恢复 `choiceRaw===1`、恢复 immediate-zero-fail、删除 deadline/document guard 或增加第二读回全部失败。五个推理数值往返；Product→GPT 附件输入必须排除 `providerDisplayName`，GPT→Browser attach 必须携带 GPT 派生的该精确名称与源码冻结的 active-menu scope/visible upload leaf/exact text；同一业务文件在不同 attempt 获得不同但确定的精确 `providerDisplayName`；一个 UTF-8 ZIP 仍只产生一次 file-input mutation，其内必须机械证明唯一可见上传叶子点击一次、唯一 chooser 事件与 exact `#upload-files` backend node 一致、仅一次 `DOM.setFileInputFiles`、成败都关闭 interception，并证明 direct hidden-input、chooser 超时重试、backend-node 错配与第二上传路径均不可达；GPT Child 不读取 ZIP entry；同 attempt 已有 verified `CONFIRMED` attach 时 materializer 与 file-input 增量都为零；附件名称已出现但上传未完成时不得成功且不得产生 mutation，ready SVG 的已识别 no-layout/no-box 只作为当轮不可见候选继续 fresh query，stale 丢弃旧 nodeId 后完整重查，畸形 CDP payload 才返回 `BROWSER_DOM_READ_INVALID`，Product timeout 超过 60 秒时不得被公共 Child 截短，全部完成后立即成功，持续未完成时 typed timeout；真实 Chrome 中 ready 后必须实际进入 `write_exact_gpt_prompt`，且 file-input mutation 仍恰为一次。Prompt 在提交前被页面清空或改写时不得点击；marker 外层 user 容器即使混入附件卡片、文件名与展开/收起文字，canonical rendered-prompt hash 仍等于原 composer prompt，inline code 反引号与正文尾换行被保留且只删除一个投影根分隔换行，正文自身漂移则失败；conversation-history 提示覆盖缺席、唯一、重复、多 root、标题/按钮漂移和按钮禁用；submission reconcile 必须覆盖 DOM candidate missing/ambiguous/stale 后 fresh read成功、真正 Target/Document 失效原样失败、且两者 submit mutation 增量均为零；submission-locator artifact 按 exact identity 幂等写读并在切换会话、进程重启后仍返回原定位事实；fresh 首轮在 continuation 与 checkpoint 均缺失时，必须用同一 accepted attempt 的 `current_attempt` exact submit receipt + 唯一 locator 恢复原 URL 且再次 submit 为零，缺失、损坏或多义 locator 必须失败关闭且再次 submit 仍为零；exact submit CONFIRMED 后分别注入 DOM typed cause、BROWSER_TARGET_INVALID、BROWSER_DOCUMENT_INVALID、channel fault、wait timeout、进程重启与 attempt cap 已满，全部保持同一 accepted attempt 和原 confirmed submit、再次 submit 为零，只有 Provider terminal negative/业务撤权/evidence 损坏或多义结束恢复资格；文本/image checkpoint、frontier origin/current、lane release、DISPATCHED 不重放、跨 Target generation mutation 禁重做、absoluteDeadline 不刷新及原生 cause 保真仍按前述合同证明。
