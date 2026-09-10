# GPT 能力组 V33 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "gpt-capability-group-v33",
  "status": "active",
  "owner": "gpt",
  "lawIds": [
    "LAW-GPT-001-V40"
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

`gpt` 只拥有 GPT Provider 的 28 个原子 Child、对应局部合同、Browser Authority 调用、直接后置证明和 typed result：二十二个 Provider 页面语义 Child、六个 continuation transaction Child。十二个 Product Plugin 各自直接拥有 Child 顺序、分支、重复、跳过、Prompt 语义、精确模型、requested reasoning tier、selection policy 和结果组装；模型选择完成后重新确保 execution profile 打开、再执行 Product 冻结的推理要求，也属于每个 Product 自己的显式顺序。

V26 已冻结 28 个 Child 的公开身份、物理隔离与局部合同；V28 已把 `checkpoint_gpt_generated_image` 从静默媒体 checkpoint 收敛为唯一 Browser-owned typed compound mutation：固定点击一次承载已冻结语义主图的可交互图片容器，再点击同一图片查看器内唯一 `button[aria-label='保存']`，并等待 Browser 原生下载完成；两个依赖输入共用一个 exact call、一个 WAL row、一个 terminal receipt 与最终媒体同一性后置。分享菜单不是下载入口。其它 Child 的 mutation 配额不变。该 Child 的直接前驱核验继续收敛到现役 continuation 唯一真相：直接前驱 text checkpoint 保留自己的 turn marker、prompt hash 与 assistant turn，当前图片 turn 必须与它位于同一 canonical conversation 且 assistant turn ordinal 精确相差 2。页面同一次 coherent observation 还必须证明前驱 text assistant turn 的 semantic text hash 与 receipt 相同；不得反向要求前驱 receipt 冒充当前图片 turn。V29 把所有 mutation 的标签交互就绪收敛到 Browser Authority：GPT Child 不接收或选择 tabId，不调用 `tabs.update`，不聚焦窗口，也不建立第二 precondition、WAL 或恢复链。V30 进一步要求现有第三份 `agent-generated-image-receipt.v1`、成功态 Forensics 安全投影与 task-exact completed-result replay 全部绑定并回读同一 Product-safe Browser 下载事实；不新增第四 artifact、Website 字段或第二证据库。V30 继续保留 V25 已冻结的三步 fork 页面接管、`/c/WEB:<opaque>` 瞬时 route 以及 execution profile 的 PRO/PLUS、0..2/0..4 与 exact/exact-or-observed-maximum 语义，不得借本次修改建立通用 compound action 或兼容路径。

V32 将所有 Child 的流转闸门收敛为“一个业务完成判据，加至多一个不可替代安全判据”。这里计算的是能够阻断下游的独立业务事实，不是 DOM 字段数量；把多个独立事实包装成一个布尔值、helper、hash、状态名或 identity 仍按多个判据计算。canonical identity 只有在同一 Owner、同一原子 observation/transaction 产生且下游始终整体消费时才算一个判据。第三个阻断判据必须以当前消费者、删除反例、现役 readback/测试以及无更简单方案四项证明；任一缺失即物理删除，不得迁入相邻 Child、Browser postcondition、Product、测试或兼容链。

```text
Product Plugin 的普通 TypeScript Flow
  -> ProductGptTools.execute(one typed child call)
  -> 一个 GPT Child
  -> Browser Authority exact Target + current Document
  -> mutation 才由 Browser Authority 自动选中精确 system Tab、复用唯一 2500ms 闸门并重新取得 fresh Document/qualification；observation 与 wait 不激活
  -> observation，或 precondition + 至多一次 dispatch + postcondition；唯一图片 checkpoint 例外是一个固定两次依赖点击的 Browser compound dispatch
  -> success(value,evidence) | failed(reason,evidence)
```

必须物理不存在 `GPT_TURN_FLOW`、`GptTurnExecutor`、`executeTurn`、`runTurn`、全局 `stepIndex`、`resumePoint`、`flowVersion`、`reconcileOnly`、全局 GPT checkpoint 和固定 Child 间节拍。公共面不是 registry、bus、DSL、workflow engine 或第二调度器。

页面 Child 调用 Browser Authority 时，只有完成本次 typed command 必需的精确载荷可以在现役认证且 AES-GCM 加密的 WebSocket 内瞬时通过：`write_exact_gpt_prompt` 的批准文本、Browser 对 GPT Composer 当前 contenteditable 值按 fill 直接后置同一机械规范生成且绑定 observation revision 的 hash-only `exactEditableTextHash` reply、text checkpoint 专用 exact-assistant-turn reply-only channel 的 exact assistant `outerHTML + semanticText`、一次批量 file-input 的 Browser 已解析批准路径、固定 start URL 或已验证 canonical conversation URL，以及 current Document 同一次 coherent observation 中产生并进入 revision hash 的 sanitized `currentUrl`。它们必须同时绑定 exact call、Target、current Document 和 payload hash；Prompt 与路径只进请求，Composer 只返回哈希且不得回传 Prompt 正文，DOM 正文只进 task-owned artifact，完整 canonical conversation URL 正文只进现役 task-owned submission-locator/continuation。Target admission 的 `claimOrigin` 永不进入 GPT 页面语义；GPT 不产生、不读取 Browser URL，只消费 Browser 签发的 revision-bound `currentUrl` 判断根页或 canonical conversation。面向已渲染 user/assistant turn 的 `semanticTextHash` 不得改义或作为 Composer fallback。Browser 日志、WAL、proof、诊断和错误回包只能保存 hash、长度、数量、ref、stage 与 typed cause，禁止复制原文。cookie、token、credential、任意页面身份和通用 opaque payload 仍绝对禁止进入 wire；不得增加第二 transport、第二 resolver、URL registry、字段改名旁路或 Browser 业务解释。

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

`readCallFacts` 只读取当前 active attempt 的同一原子调用事实，用于发现已有物理动作后失败关闭，绝不返回可恢复结果。`readContinuationExact` 只允许读取当前 attempt 内刚完成的 continuation，或读取 Website 已作为新业务任务正式下发并鉴权的已入库材料；不得按 job、latest、历史 attempt、旧 checkpoint 或旧 conversation 查找。二者都不调用 Child、不写入、不决定下一步，也不得成为恢复入口。

## 2. 公开 Child 分母

| 类别 | childId | 原子语义 |
|---|---|---|
| 会话 | `prepare_clean_gpt_chat` | 证明唯一 fresh composer、exact empty draft、zero prior turn/attachment 与 not generating；仅草稿污染时至多一次清空并读回 |
| 会话 | `focus_exact_gpt_conversation` | 导航到冻结永久 conversation |
| 会话 | `verify_gpt_conversation_identity` | 证明 composer、canonical URL、turn marker、prior prompt/response hash 与 conversation identity |
| 档案 | `open_gpt_execution_profile` | 在当前 Document 打开或确认唯一 execution profile |
| 模型 | `open_gpt_model_selector_v2` | 以 ALREADY_OPEN OR OPENABLE 到达唯一 active advanced panel |
| 模型 | `select_exact_gpt_model_v2` | 在 active advanced panel 确认或选择唯一精确模型，并以至多一次动作恢复 active simple panel |
| 档案 | `ensure_gpt_reasoning_requirement` | 按 Product 冻结的 requested tier 与 selection policy 解析已证明 scale，并用数值 readback 到达唯一 resolved 档位 |
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
| 图片 | `checkpoint_gpt_generated_image` | 在同一 assistant section + semanticMediaId 上点击语义主图、点击图片查看器唯一保存按钮，证明原生下载完成后取得同一原始 bytes 与 proof |
| 会话 | `open_gpt_checkpoint_actions_menu` | 对 Product 指定的 exact source checkpoint 打开或确认唯一操作菜单，并证明唯一“打开新分支”叶子；不得创建 child relation |
| 会话 | `open_gpt_fork_destination_menu` | 在已证明的 source-bound 第一层菜单内至多一次点击“打开新分支”，并证明第二层目标菜单内唯一“分支到新聊天”叶子；不得创建 child relation |
| 会话 | `fork_exact_gpt_conversation_at_checkpoint` | 在已证明的第二层目标菜单内至多一次点击“分支到新聊天”，由 Browser 验证并接管唯一 child tab、把同一逻辑 targetRef 转移到该 tab、关闭 source tab，再读回 child relation；不得再次打开任一菜单 |
| Continuation | `persist_gpt_continuation` | 保存永久 URL、turn marker、prior prompt/response hash、conversation identity 与主体绑定 |
| Continuation | `reserve_exact_gpt_continuation_once` | 在现役 continuation row/store 以 opaque reusable-origin 或 derived-source identity 作一次 reservation CAS |
| Continuation | `complete_exact_gpt_continuation_reservation_once` | 在同 reservation/lane/fence 一次写齐 provider、artifact、semantic-admission 与 read-grant receipt 并释放 reservation lane |
| Continuation | `acquire_gpt_continuation_lane` | 对精确 continuation 获取 lane CAS |
| Continuation | `advance_gpt_continuation_lane` | 在一个 lane CAS 内原子推进 provider + checkpoint receipt 并释放 lane |
| Continuation | `release_gpt_continuation_lane` | settle 后释放精确 lane |

Browser Target/Document 绑定、mutation WAL 与 mutation outcome 对账属于 Browser Authority，不是 GPT Child。find/read/click、DOM 候选过滤和 selector 属于对应 Child 的私有实现，不再拆公共能力。

### 2.1 物理目录、唯一真相与删除式切换

GPT Capability 的生产物理边界固定为一个 `src/capabilities/gpt/` 总目录。对外调用只经 `index.ts`；`contract.ts` 是 28 个 Child 身份与局部合同的唯一真相，`child-types.ts` 是输入输出映射的唯一真相，`handler-registry.ts` 是 28 个生产 handler 的唯一装配表，`ability-group.ts` 是单次执行的唯一入口。`handler-registry.ts` 只做 contract 分母到 exact Child handler 的静态一对一装配，不拥有执行、流程、fallback 或第二合同；上述五者不得被 Child 目录复制、覆盖或降级为第二 registry、第二 Facade 或第二 executor。

`contract.ts` 中每个现役 `childCapabilityId` 必须且只能投影为一个同名字节的 `children/<exact-childCapabilityId>/` 目录，每个目录必须且只能有一个 `handler.ts` 作为该 Child 的生产 handler。只有该 Child 独占且当前实际需要时，目录内才可增加名称明确的私有 `observation.ts`、`selectors.ts` 或 `settlement.ts`；不得为形式统一创建空文件、每 Child `index.ts`、第二合同、第二类型表或第二 handler map。`handler-registry.ts` 必须直接 import 全部 28 个 exact handler 并只导出一份完整 map；不得按页面/continuation 或其它画像再分表，不得出现转发 sheet。Child 不得直接或间接 import 兄弟 Child，外部生产代码不得导入 `children/**` 或其它 GPT 私有文件。

两个以上现役 Child 严格共用的产品中性页面机械原语留在 `web/`；唯一 continuation store/controller 留在 `session/`；证据、artifact、readback 与 production lifecycle 分别留在自身名称明确的窄模块。共同模块不得拥有 Child 的语义意图、局部 DOM 身份、状态谓词、WAIT 资格、直接后置或 Product 步骤，也不得使用 `common`、`shared`、`utils`、`service`、`manager`、`facade`、`bridge`、`adapter` 等名称隐藏无 Owner 逻辑。

切换必须在同一候选中把现役 handler 真实迁入 28 个 exact Child 目录，并物理删除 `web/children/attachment-children.ts`、`web/children/composer-submission-children.ts`、`web/children/conversation-children.ts`、`web/children/execution-profile-children.ts`、`web/children/model-selection-v2-children.ts`、`web/children/text-response-children.ts`、`web/children/image-response-children.ts`、`web/children/response-children.ts` 与 `session/session-children.ts`。不得保留 re-export 转发文件、alias、compatibility、feature flag、fallback、dual path 或第二装配表；搬迁后失去真实消费者的 helper 和 export 必须同时删除。

机器验收必须从唯一 `contract.ts` 解析 Child 分母，并证明该集合与 `children/` 一级目录、`handler.ts`、唯一 `handler-registry.ts` 装配键四者精确相等，并证明 `ability-group.ts` 只消费该完整 map；无缺失、额外、重复、分表、旧组合文件、兄弟 Child import、外部私有 import、Capability 到 Product Plugin import、GPT 到 Browser 私有 runtime import 或生产 import 环。目录扫描只验证 `contract.ts` 的物理投影，不得反向取得 Child 身份主权；所有断言进入现役唯一 `quality:check`，不得建立第二 checker、报告或 verdict。

`reserve_exact_gpt_continuation_once`、`complete_exact_gpt_continuation_reservation_once` 与 `acquire_gpt_continuation_lane` 仍由 Product 显式排列，但 reservation identity 必须绑定 `attempt_id`。它们只服务当前 active attempt 的连续步骤；任一步失败或进程重启后，该 reservation 不得被旧 attempt 或新 attempt 读回、完成或获取。跨业务任务只允许消费 Website 明确下发且已经领域入库的 continuation 材料。

`readContinuationExact({lookupKind:"frontier_ref"})` 不得由 Product 用来发现或复用旧 attempt 半成品。当前 attempt 的内部读取必须同时闭合 attempt identity；跨任务读取必须来自 Website 当前任务合同明确下发的已入库 continuation 引用与授权，不能由 AGENT 自行扫描或猜选。

## 3. 原子 Child 合同

每个 Child 必须在现役唯一 contract map 中显式声明八项内容：`childId + contractVersion`、原子语义意图、唯一 Owner/读写边界、exact call 输入、唯一能力画像与 bounded-wait 资格、DONE/ACT/WAIT/FAIL_CLOSED 的局部事实和裁决、零或一次 mutation 加完整正反后置、最小安全证据。任何字段都不得由通用默认模板、自由 `observedSemantics`、调用顺序或历史成功推导。

画像分母固定为：

| Profile | Child |
|---|---|
| `DOM_OBSERVATION`（5） | `verify_gpt_conversation_identity`、`reconcile_gpt_attachment_set`、`reconcile_gpt_draft`、`reconcile_gpt_turn_submission`、`checkpoint_gpt_text_response` |
| `TARGET_LOCAL_MUTATION`（14） | `checkpoint_gpt_generated_image`、`prepare_clean_gpt_chat`、`focus_exact_gpt_conversation`、`open_gpt_execution_profile`、`open_gpt_model_selector_v2`、`select_exact_gpt_model_v2`、`ensure_gpt_reasoning_requirement`、`close_gpt_execution_profile`、`open_gpt_attachment_control`、`write_exact_gpt_prompt`、`wait_for_stable_gpt_text`、`wait_for_stable_gpt_image`、`open_gpt_checkpoint_actions_menu`、`open_gpt_fork_destination_menu` |
| `PROVIDER_EFFECT_ONCE`（3） | `attach_approved_gpt_files_once`、`submit_exact_gpt_turn_once`、`fork_exact_gpt_conversation_at_checkpoint` |
| `CONTINUATION_TRANSACTION`（6） | `persist_gpt_continuation`、`reserve_exact_gpt_continuation_once`、`complete_exact_gpt_continuation_reservation_once`、`acquire_gpt_continuation_lane`、`advance_gpt_continuation_lane`、`release_gpt_continuation_lane` |

Browser mutation 前交互就绪与动作后 2500ms 读回不是 Child 的 bounded-wait 画像，而是所有真实 GPT 页面状态改变共享的唯一物理底座。现有 WAL 进入 DISPATCHED 后，Browser Authority 才可在精确 system Tab 非 active 时执行一次 `tabs.update({active:true})`，复用同一 2500ms 闸门后重新证明 tab、Target、Document 与动作资格，并在每次物理输入前复核 activation generation；已 active 时更新为零，纯 observation、wait、park/reacquire 不激活，GPT/Product 看不到 tabId 也不能配置或绕过该闸门。点击、输入、清空、填写、键盘、文件选择/上传、提交、导航、刷新、返回根页、切换会话、模型/推理档位、菜单开关、弹窗确认、fork、轮询导航、恢复导航以及未来新增页面动作，均由 Browser Authority 在最后一个物理页面输入完成后保持同一 Target、current Document、claim 与 FIFO，硬等待完整 2500ms；2499ms 及以前动作后结果读取为零，满时才允许首次 fresh coherent current-Document read。成功或失败都不能提前，延迟本身也不是成功证据；现有 postcondition budget 从首次可读时刻起算。首次输入前用户切走以 `BROWSER_TARGET_NOT_INTERACTIVE` 和 mutation_outcome=no 失败，输入开始后则保留真实 dispatch 且绝不重放。GPT/Product 不能传入、缩短、关闭或另配延迟，不能调用窗口聚焦、循环抢回或建立第二计时/读取链。纯 observation、continuation transaction 与非页面动作不产生新闸门，但它们若是某一页面动作后的首次结果读取，仍服从该动作已建立的 read-not-before。

Child 自身的 bounded-wait 只保留动作闸门之后的真实条件等待和无前置动作的 Provider 长等待：`reconcile_gpt_attachment_set`、`reconcile_gpt_turn_submission`、`wait_for_stable_gpt_text`、`wait_for_stable_gpt_image` 等只在各自合同冻结上限或调用既有 deadline 内 fresh observe，不取得额外 mutation 配额。纯 observation 的 `reconcile_gpt_draft` 仍以两份各自完整的 fresh coherent packet 证明同一 Target/Document、composer、exact draft hash、附件集合与 send 条件连续一致；任一 packet 不完整、revision 漂移或两次事实不等即丢弃重取或在原 deadline 内失败。候选多义、结构冲突或 native payload 非法在获得合法首读后按原合同失败关闭。公开 terminal 始终只有 `success(value,evidence)` 或 `failed(typedReason,evidence)`；局部裁决不持久化、不进入 Product 状态。

所有页面 Child 的一次裁决只能消费 Browser 在同一 typed observation 内原子采集、或由 Browser 机械证明 revision 未变化的 `BrowserDomObservationPacketV2`。packet 固定绑定 exact call、Target、current Document、sanitized `currentUrl`、observation revision、observedAt、该 Child 最少充分的稀疏事实和 native cause；`currentUrl` 必须与 DOM facts 来自 current Document 的同一次 `Runtime.callFunctionOn` 并共同进入 `observationRevisionHash`。整包 stale、`currentUrl` 缺失/非法、Document/revision 改变或未完整返回时整包作废，禁止 Child 从 `claimOrigin`、Target claim 时 URL、`Page.getFrameTree`、另一次 URL/DOM 读取、页面外请求或持久 snapshot 拼接。Observation V1 的类型、decoder、caller 与 tests 在同一 CHANGE 物理删除，不存在 V1/V2 union、alias、optional currentUrl、dual-read 或 fallback。Browser 只签发物理事实；GPT 只负责 root/conversation Provider 语义，不读取 raw WAL、Target/Document 或把 Browser terminal 当成 GPT 语义。

真实页面的分支入口包含三次独立物理动作，Product 必须显式排列三个调用。`open_gpt_checkpoint_actions_menu` 只接受 Product 已冻结的 exact source provider/checkpoint、canonical conversation URL、turn marker、prior prompt/response identity 与自己的 exact call identity；若同一 source-bound 第一层 active menu 和唯一“打开新分支”叶子已经成立则零动作成功，否则只点击该 source assistant turn 内唯一 `button[aria-label='更多操作']` 一次，并以 fresh coherent packet 直接证明第一层菜单与叶子。真实 Chrome 已证明至少一个现役变体没有 `aria-haspopup`、另一个现役变体可以具有该属性，因此 `aria-haspopup` 不得作为 selector 或资格事实；`aria-expanded` 只作为同一入口的独立折叠/展开状态事实。已消失的 `button[data-testid='more-turn-action-button']`、OR selector、fallback 与第二入口均禁止。它是 target-local mutation，不得打开第二层菜单或创建 child relation。

`open_gpt_fork_destination_menu` 使用独立 exact call identity，只接受自身 fresh 前置重新证明的同一 source-bound 第一层 active menu 与唯一“打开新分支”叶子；若第二层目标菜单与唯一 `role=menuitem` 且精确文本为“分支到新聊天”的叶子已经成立则零动作成功，否则只点击“打开新分支”一次，并以 fresh coherent packet 直接证明第二层菜单与最终叶子。它是 target-local mutation，不得点击最终 fork 叶子或创建 child relation。

`fork_exact_gpt_conversation_at_checkpoint` 使用独立 exact call identity，只接受当前 active attempt 内 fresh 证明的 source-bound 第二层菜单。Browser Authority 至多 dispatch 一次；已有任何 WAL outcome 时立即失败关闭，不再次点击、不读回旧 child。Provider 新页的接管、验证与 source 关闭仍在同一 typed command 内完成；任一步失败即结束 attempt，新 attempt 建立干净会话并从 Product 第一入口重做。

### 3.1 页面实证闭环

页面操作分母矩阵唯一属于 GPT Owner。每个 mutation Child 只在当前 attempt 调用 Browser；provider_effect_identity_hash = sha256([job_id, attempt_id, plugin_id, plugin_version, product_step_id, call_id, child_id, request_hash, payload_hash])。同一 attempt 的同一动作至多 dispatch 一次，新 attempt 因 attempt_id 不同获得新的 Website 授权身份。

二十二个页面 Child 继续只在各自现有 handler、合同和 Browser typed command 内闭合，不新增 Child、公共 selector registry、第二 observation、第二存储或质量裁决。当前真实页面实证要求以下直接约束：

- `checkpoint_gpt_generated_image` 必须先证明直接前驱 text checkpoint 与当前图片 turn 属于同一 canonical conversation，且前驱 assistant turn ordinal + 2 精确等于当前图片 assistant turn ordinal；同一次 coherent observation 必须同时命中该前驱 assistant turn，并证明它的 semantic text hash 与 receipt 相同。前驱 receipt 的 turn marker、prompt hash、assistant turn 与 source checkpoint identity 必须保持前驱自身原值，严禁要求它们等于当前图片 turn 的 marker、prompt hash 或 assistant turn；字段形状正确、仅 URL 相同或仅 ordinal 相邻都不能代替完整身份闭合。闭合后才允许执行唯一 authenticated-media `delivery=visible-download` compound mutation：媒体 alt 必须精确符合 `已生成图片：<非空 NFC 标题>`；在当前 assistant turn 内点击承载冻结语义媒体的唯一可交互图片容器，证明唯一 `[role='dialog']` 图片查看器的 aria-label 精确等于从媒体 alt 去掉一次固定前缀所得标题，再点击其中唯一 `button[aria-label='保存']`；Browser 必须观察同一主 frame 的唯一原生下载开始与完成事件、相同完成字节数，最后重新取得并证明同一媒体 hash。两次点击只对应一个 exact call、一个 WAL row、一个 terminal receipt；同一 WAL row 持久绑定 0..2 次物理输入、download-guid hash 与完成事实，任一部分失败不得重放。现有第三份 `agent-generated-image-receipt.v1` 必须绑定并回读 exact call identity、Product-safe Browser evidence ref/hash、Browser/mutation outcome、唯一原生下载 guid hash/完成字节事实与媒体 content identity；成功态 safe projection 和 task-exact replay 都必须逐项匹配，不能只在失败态保存 `browser_fact` 或只验证三份文件存在。
- `checkpoint_gpt_text_response` 的 exact assistant turn 专用 reply 必须携带并核对产生 turn 邻接事实的同一 `observationRevisionHash`；不得把一条列表 observation 与另一 revision 的完整 DOM/semantic reply 拼成 checkpoint。
- `close_gpt_execution_profile` 必须在关闭前证明当前 trigger 与唯一 popup 的 owner relation，关闭后的同一直接后置必须证明该 popup 缺席、trigger collapsed 且唯一 composer 未被遮挡并可操作；全局 `popup=0` 单独不能成功。
- `focus_exact_gpt_conversation` 只负责至多一次导航，并以 Browser fresh currentUrl 精确等于 Product 冻结 canonical URL 作为唯一业务完成判据；Target/current Document 未漂移继续由 Browser typed command 保证。它不读取 composer、marker、prompt/response turn，也不在 Browser 2500ms 总闸门后增加固定或条件计时链。完整 conversation identity 只由紧随其后的 `verify_gpt_conversation_identity` 证明。
- `open_gpt_attachment_control` 必须在唯一 composer form scope 内确认唯一可见附件入口，并只在唯一活动菜单内核对唯一精确“从电脑上传”叶子；不得要求真实页面未保证的 `aria-expanded`、`aria-controls`、`aria-labelledby` 或附件 trigger/menu owner relation。`open_gpt_checkpoint_actions_menu` 必须把第一层菜单及“打开新分支”叶子绑定 exact source-turn trigger；`open_gpt_fork_destination_menu` 必须把第二层菜单及“分支到新聊天”叶子绑定前一层 source-bound 入口。页面全局唯一菜单不能代替后二者的 owner relation。
- `open_gpt_execution_profile` 必须以同一 coherent packet 证明 trigger 与 popup 的 `aria-labelledby` owner relation；owner 不等时零 mutation 失败。`open_gpt_model_selector_v2` 必须保留 Product 冻结的 `modelDisplayName`，只有 active advanced panel 内该 exact radio 已唯一 hydration 才能成功。
- `select_exact_gpt_model_v2` 的唯一 Browser mutation reply 必须把动作目标的稳定 identity、exact model name 与动作后的 `aria-checked=true` 绑定，同时保留现役 popup/simple/advanced 收束事实；不得用面板折叠单独冒充模型已选中，也不得补第二次点击或第二次 DOM 读回。
- `reconcile_gpt_turn_submission` 必须先核对现役 confirmed-submit receipt 的 exact call identity、turn marker 与 prompt hash，再以同一 coherent packet 中的 exact user turn + durable canonical URL 组成唯一 submission locator；receipt 匹配是唯一安全判据。composer 或附件清理不得成为 locator 成功门，返回的 conversation identity 不能自行补造未核对的 marker。
- `submit_exact_gpt_turn_once` 的唯一业务完成判据是 exact rendered prompt 对应 user turn 唯一出现，唯一安全判据是同一 exact provider effect 的 Browser terminal receipt。“相同 user turn 已存在”的零动作分支同样只接受唯一 exact turn 并绝不重提；composer 清空、附件清空、永久 URL、Assistant hydration 或其它页面清理事实只可诊断，不得否认已经发生的提交或制造重做资格。
- `verify_gpt_conversation_identity` 必须把 canonical URL、marker、exact user prompt、相邻 assistant response 与最终 identity 绑定同一 observation revision；不同 revision 的 turn 列表和完整 assistant 读取不能拼成成功。
- `wait_for_stable_gpt_text` 与 `wait_for_stable_gpt_image` 的输入必须包含 `reconcile_gpt_turn_submission` 返回的 required `conversationIdentityHash`。每次首次 probe、park/reacquire 与跨 URL 导航后的 fresh probe，都必须用 `canonical URL + turnMarker + observed userTurnId + promptHash` 重算并核对该 identity，再接受紧邻 assistant；只核对 prompt hash 不合格。十二个 Product 调用方必须在同一删除式切换中传递该 required 字段，不保留 optional、默认、旧输入或兼容分支。
- `reconcile_gpt_attachment_set`、`wait_for_stable_gpt_text` 与 `wait_for_stable_gpt_image` 还必须识别各自真实页面 terminal error，并在同一 coherent packet 中立即 typed fail-close；选择器和机械特征只有取得当前候选的真实 Chrome fresh-DOM 实证后才能冻结。在实证缺失时，这三项不得猜测 selector、不得把超时冒充 terminal，也不得阻断其余已闭合 Child 的施工与验收。

`checkpoint_gpt_text_response` 的 DOM 责任是完整取回 Provider 当前实际呈现的产物，不是解释 JSON 或业务内容。它必须锁定精确 assistant turn，并通过专用 exact-assistant-turn reply-only typed channel 保存该节点完整 `outerHTML`；确定性语义读取始终遍历完整 response tree，把 `<br>`、块级边界、列表以及 `<strong>/<em>/<code>` 等标签投影为显式 canonical 标记并保留转义、Unicode 与全部可见字符。`<pre>` 内的 code 使用 code `textContent` 作为该块语义，但绝不能因页面恰好只有一个 code block 就丢弃标题、正文、列表或结尾兄弟节点；纯单一 code-block 回答仍自然得到干净代码正文。exact assistant turn 的 `semanticText/semanticTextHash` 与 coherent observation 的 `semanticTextHash` 必须调用 Browser Owner 内同一唯一 serializer，禁止第二算法或兼容分支。canonical text 是 observed DOM 的可追溯语义投影，不冒充 Provider 原始 Markdown/source bytes；原 DOM HTML 与投影文本及各自 hash 一起进入同一 task-owned output artifact，二者不得进入通用 coherent packet。禁止散落 text-node 拼接、`innerText` 布局副作用、预设业务字段选择器或正则截断；零个或多个完整 assistant 候选必须 typed fail-close。Forensics 与 Runtime Logs 只保存 artifact ref/hash，不保存 DOM 或正文。

`wait_for_stable_gpt_image` 与 `checkpoint_gpt_generated_image` 的 turn Owner 是紧邻已验证 user turn 的唯一外层 `[data-testid^='conversation-turn-']:not(:has([data-message-author-role='user']))` section，而不是其内可选的 `[data-message-author-role='assistant']` 文本节点。真实 Chrome 已证明外层 section 不再携带 `data-turn`；图片 turn 可以没有 assistant 文本角色节点。每次 fresh probe 必须证明该 section 唯一、Provider stop/generating 控件缺席。Browser 已鉴权媒体命令必须在同一 current Document 再证明该 section 恰好一个，并把其中 raw `<img>` 机械投影为语义候选：只有 connected、`complete=true`、natural width/height 均大于零、非零布局、computed display/visibility/opacity 非隐藏且 NFC `alt` 非空的节点进入集合；禁止像素阈值和首节点选择。物理节点先按页面内资源 identity 收敛，再在当前登录会话内取得原始 bytes并按 content hash 去重；同 bytes 的重复 URL/节点只算一个，最终 content identity 零个继续等待、多个立即 typed fail。`wait_for_stable_gpt_image` 始终使用 `delivery=probe`，只返回 assistantTurnId、semanticMediaId、mediaHash 与绑定 Target/Document 的原始 bytes receipt，绝不点击图片、分享、保存或下载。最终 checkpoint 必须使用 `delivery=visible-download`：相同 assistantTurnId + semanticMediaId + mediaHash 的媒体 alt 必须精确符合 `已生成图片：<非空 NFC 标题>`；按固定顺序点击承载该媒体的唯一可交互图片容器，证明唯一图片查看器的 aria-label 精确等于从媒体 alt 去掉一次固定前缀所得标题，再点击其中唯一 `button[aria-label='保存']`；Browser 观察同一主 frame 的唯一原生下载开始与完成事件、相同完成字节数，最后一次点击后的 Browser 总闸门满时再重新取得原始 bytes 并证明 content hash 未变。两个依赖输入共用一个 WAL/receipt，同一行持久绑定部分动作和 download-guid hash/完成事实；唯一 download tracker 保留到最终 identity 回读与结算，首个 completed 后出现第二 downloadWillBegin 仍必须失败。任何 0/1/2 次部分结果都按真实 mutation outcome 失败关闭且不得重放。task-owned receipt 再绑定 canonical conversation、turn marker、prompt hash、原图/变换 content identity、直接前驱 text receipt 与同一 Product-safe Browser 下载 receipt；现有三份 artifact 中第三份就是该绑定，不新增第四份。禁止 responseText/responseHash/expectedResponseHash 文本门槛、inner assistant-role 门槛、选择第一个 raw img、截图、DOM URL、页面外 fetch、分享菜单或第二 downloader。

每次调用身份固定为：

```text
job_id + attempt_id + plugin_id + plugin_version
+ product_step_id + call_id + child_id + input_hash
```

Provider effect identity 固定为 `sha256([job_id, attempt_id, plugin_id, plugin_version, product_step_id, call_id, child_id, request_hash, payload_hash])`。Browser 只查询当前 attempt 的 WAL；同一 identity 至多 dispatch 一次。新 attempt 是新的 Website 授权，不读旧 call facts 或旧会话。

Provider effect 的 at-most-once 边界只限同一 attempt。DISPATCHED/CONFIRMED 不得在该 attempt 重发；attempt 失败即 typed fail-close，不再做 source-only/full-readback、submission-locator reconcile 或旧会话读回。

## 4. 当前 Document 前置

所有 Child 每次都读取当前 Target + 当前 Document。过去调用成功、产品步骤位置或任何 checkpoint 都不能证明瞬态弹面仍存在。模型或推理操作前，若 execution profile 不存在，Product Plugin 必须先调用 `open_gpt_execution_profile`；Child 自身仍须重新验证当前 DOM。Provider text/image wait 与 checkpoint 每次 probe 都在当前合法 system Target 上先复核 canonical conversation URL；checkpoint 与同 URL wait 立即读取，只有 `wait_for_stable_gpt_text` 或 `wait_for_stable_gpt_image` 在等待产物时发现 fresh currentUrl 属于另一 canonical conversation、即将实际跨 conversation URL 查证结果，才先取得第 5 节的全进程 30000ms 轮询资格，然后只在该 Target 导航复位并作一次有界 hydration，再以 turn marker 找到唯一 user turn。prompt hash 只对该 turn 内唯一请求正文机器节点计算：读取现役 deterministic semantic tree，恢复 strong/em/code 等显式标记，只移除投影算法为根块额外加入的一个终止分隔换行，并保留正文自身全部字符与尾换行。Browser 先机械证明 exact 外层 user turn 内恰好一个 user-role root，再裁决两个互斥结构：长 Prompt 恰好一个 `[data-testid='collapsible-user-message-content']`；仅当长节点为零时，短 Prompt 必须恰好一个无元素子节点 `.whitespace-pre-wrap` 正文叶子。长节点存在时不得再读短结构；长/短节点或 user root 缺失、多义都 typed fail-close。外层 user-role root 的附件卡片、文件名与展开/收起控制文字不属于 Prompt；禁止 textContent 丢 Markdown 结构，也禁止 trim、删反引号或其它内容启发式。canonical rendered-prompt hash 不等时零 mutation 失败关闭；随后只接受紧邻 assistant turn。文本 wait/checkpoint 用 canonical response hash 锁定稳定语义文本；图片 wait 只用 `delivery=probe` 锁定 assistantTurnId + semanticMediaId + mediaHash/content identity，最终图片 checkpoint 才用一次 `delivery=visible-download` compound mutation；禁止 responseText/responseHash 门槛。URL、marker、prompt hash、相邻 assistant 及当前结果类型对应的 text response hash 或 image media/content identity 任一不成立都不得接收。

`reconcile_gpt_turn_submission` 的输入同时绑定 `turnMarker + expectedPromptHash`，成功值固定包含由 revision-bound `currentUrl` 判定的 canonical conversation URL、turn marker、user turn id、canonical rendered-prompt hash 与 conversation identity。唯一 Forensics evidence Owner 必须在 Runtime/GPT 经现役接口调用后、单一生产 Tab 让出时间片前，以同一 exact call identity 的受控 `submission-locator` suffix 写入并读回 task-owned artifact；Runtime/GPT 不建立第二 writer，同 identity 重放先读该 artifact并返回原成功值，再由后续 wait/checkpoint 导航 URL 作 live 验证。完整 canonical conversation URL 正文只持久于该既有 submission-locator 与 continuation。confirmed submit 可从唯一 Browser WAL 与 Forensics confirmed receipt 派生 source-only 短生命周期授权；Browser 只接受发送源 D0，或该 exact submit 同一原子 Child 以同 Target、navigationEpoch 不变或精确 +1、initial exact-call evidence 的 hash-only `confirmed_submit_readback_document_hash` 唯一证明的直接后置 D1，并仅以该 Document 的 coherent currentUrl 做零导航零 mutation observation/settle/locator 写入；任意 D2、Target-only、epoch 跳跃、缺失或多义 hash 都失败关闭本次 probe并保留同一 attempt；只有 submission-locator 唯一闭合后才升级为允许 exact canonical navigation 的 full readback，continuation 只能消费已闭合 locator，不得替代 locator 签发升级。两者都用毕释放，不得写入 artifact、row、WAL、log、proof、registry/ledger 或成为第四份 URL 真相。


所有 Product 共用的页面动作不再由各 Child 自行决定是否等待。GPT 只调用 Browser Authority 的既有 typed command；Browser 唯一总闸门在动作完成后先阻断完整 2500ms，再允许 Browser 自带 postcondition 或 GPT semantic readback 第一次读取 fresh current Document。动作已显示成功、失败、缺席、未 hydration、尚未清空或 locator 尚未形成，都不得在 2500ms 内被读取或裁决；满时后再依源码冻结的正反判据、既有有界 timeout 与 fresh coherent observation 收束。该规则覆盖全部现役和未来页面动作，不以 Product、Child、effect scope、轮询、恢复或内部动作区分。调用方零配置，等待失败零重放，Browser 之外不得存在 2500ms helper、sleep、第二观察链或第二 timer。

已渲染 user turn 的请求身份保持单链：同一次 coherent observation 以外层 `[data-testid^='conversation-turn-']:has([data-message-author-role='user'])` 取得 `conversation-turn-*`，再证明唯一内层 user-role root。prompt hash 只消费两个互斥实证结构之一：存在恰好一个 `[data-testid='collapsible-user-message-content']` 时使用该长 Prompt 正文；仅当其为零时，必须存在恰好一个无元素子节点 `.whitespace-pre-wrap` 短 Prompt 正文叶子。Browser 对选中的唯一正文节点签发 hash-only `exactGptUserPromptHash`；长节点存在时短结构不可参与。真实 Chrome 已证明角色在内层 `data-message-author-role`，外层不再携带 `data-turn`。正文或 user root 零项/多项、结构冲突或外层身份不合法失败关闭；附件卡片、展开/收起等控制文字不得进入哈希。禁止对外层容器使用 `semanticTextHash`，禁止第二 query 按序拼接、字符串剔除、自由 selector OR 或兼容 fallback。submit 直接后置、reconcile、Provider wait、conversation verify/fork 与 checkpoint identity 共用这一条事实。



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

模型 Child 的成功不授权后续推理 Child 假定瞬态 popup 仍然存在。每个 Product 的静态 Flow 必须显式排列 `select_exact_gpt_model_v2 -> open_gpt_execution_profile -> ensure_gpt_reasoning_requirement`：中间的 `open_gpt_execution_profile` 在当前 Document 重新确认父菜单。其 coherent query 集合封闭为 `popup`=`GPT_PROFILE_POPUP_SELECTOR`、`simple-panel`=`GPT_PROFILE_SIMPLE_PANEL_SELECTOR`、`reasoning-control`=`GPT_PROFILE_REASONING_CONTROL_SELECTOR`、`enabled-reasoning-control`=`GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR`、`reasoning-value`=`GPT_PROFILE_REASONING_VALUE_SELECTOR`、`trigger`=`GPT_PROFILE_TRIGGER_SELECTOR` 六组；每组必须保留 `scopeRawCount/scopeEligibleCount/rawCount/eligibleCount/rejections/nativeCauseCode/nativeCauseCount` 与整包 `observationRevisionHash`，其中 `reasoning-value` 另取 `ariaValueMin/ariaValueMax/ariaValueNow`，`trigger` 另取 `ariaExpanded`。封闭裁决为：`WAIT` 仅当六组 `raw=eligible=0` 且 current Target/Document 未变、仍在 5 秒上限内；`DONE` 仅当 popup、simple、reasoning、enabled-reasoning、reasoning-value、trigger 均为 `raw=eligible=1`，slider 精确为 `0..2/current∈0..2` 或 `0..4/current∈0..4` 且 trigger expanded=true；`ACT` 仅当前五组 `raw=eligible=0` 且唯一 trigger 为 `raw=eligible=1 + expanded=false`，随后点击一次并由该 mutation 的同一 coherent postcondition packet 达到 `DONE`；其余任一 raw/eligible 多义、ineligible raw、部分结构、未知 scale、字段非法、Target/Document 漂移或到期全零一律立即 `FAIL_CLOSED`，分别保留上述候选证据并返回稳定 typed reason。不得使用固定 Child 间 sleep、共享 profile workflow、兼容分支或第二选择链替代这次事实确认。

推理的可操作节点固定为唯一 `[role='menuitem'][aria-label='能力']`；状态只从 `[data-model-reasoning-effort-slider] [role='slider']` 读取。唯一承认的 scale 是 `0..2` 与 `0..4`：二者共同映射 `0=极速、1=中、2=高`，后者另映射 `3=极高、4=Pro`。Product profile 必须使用 `gpt-execution-profile.v2` 中名为 `reasoningRequirement` 的 required discriminated union：`reasoningRequirement:{selectionPolicy:'exact',requestedTier:GptReasoningTier}`，或仅允许 `requestedTier='pro_standard'` 的 `reasoningRequirement:{selectionPolicy:'exact-or-observed-maximum',requestedTier:'pro_standard'}`；`ensure_gpt_reasoning_requirement` 只消费 `profile.reasoningRequirement`。字段缺失、optional/default、把 `selectionPolicy/requestedTier` 散落在 Profile 顶层、其它 scale、账号徽标/cookie/storage 推断和通用 range 解析都失败关闭。exact requested value 不在 observed scale 时返回 `GPT_REASONING_TIER_UNAVAILABLE` 且零 mutation；exact-or-observed-maximum 请求 Pro 时只允许 `0..4 -> 4/Pro/degraded=false` 或 `0..2 -> 2/高/degraded=true`。resolved value 已满足时零 mutation，否则只向唯一能力 menuitem 发送一条有界方向键 command 并直接回读 resolved value；不可直接操作 `aria-hidden` slider。

`ensure_gpt_reasoning_requirement` 的 typed result 与唯一 safe evidence projection 必须同时保留 `requestedTier/requestedValue/selectionPolicy`、`observedScale(min/max/currentBefore)`、`resolvedTier/resolvedValue` 或 null、`degraded`、最终 `currentValue`、`mutationOutcome`、Browser terminal 与 GPT semantic postcondition。`resolved=高` 不得冒充 `requested=Pro`；exact unavailable 也必须保存 Product 请求、policy、observed scale、`resolved=null` 与 mutation 为零。该结果只进入现役 evidence writer/readback，不新增 proof、artifact store、表或 ledger。

Profile schema 采用一次性 V1→V2 删除式切换：五个消费完整 profile 的 Child、全部 Product profile、private-base 冻结 bytes/hash、exact call input identity、acceptance 与 inspector 同时只认 v2；旧 `reasoningTier` active reader、`pro_extended` 无消费者 alias、`ensure_exact_gpt_reasoning_tier` Child ID、旧 input/contract 与 fixtures 物理删除。禁止 v1/v2 union、optional policy、default、alias、feature flag、dual reader 或 compatibility wrapper。28 个 Child 与 6/13/3/6 画像分母保持不变。

附件入口固定为 `button#composer-plus-btn[data-testid='composer-plus-btn'][aria-haspopup='menu']`，并只在唯一 composer form scope 中查询；上传叶子 query 固定在真实 Chrome 已证明唯一可见的活动菜单 scope `#thread-bottom div.popover[aria-busy='false']` 内，以 `div.__menu-item[tabindex='0'] span + textEquals("从电脑上传")` 查询。两组均保留 `scopeRawCount/scopeEligibleCount/rawCount/eligibleCount/rejections/nativeCauseCode/nativeCauseCount` 与整包 revision。封闭裁决为：`WAIT` 仅当入口 `raw=eligible=0`、活动菜单 `scopeEligible=0`、叶子 `raw=eligible=0`、current Target/Document 未变且仍在 5 秒上限内；`DONE` 仅当入口 `raw=eligible=1`、活动菜单 `scopeEligible=1`、叶子 `eligible=1`，且同 scope 内其余 raw 叶子的 rejection 全部只是 `TEXT_MISMATCH`；`ACT` 仅当入口 `raw=eligible=1`、活动菜单 `scopeEligible=0`、叶子 `raw=eligible=0`，随后点击一次并由该 mutation 返回的同一 coherent postcondition packet 达到 `DONE`；其余入口/作用域/叶子多义、ineligible raw、活动 scope 已出现但精确叶子缺失、非法 rejection/native payload、Target/Document 漂移或到期全零一律立即 `FAIL_CLOSED`。作用域外的页面隐藏/折叠旧菜单必须被排除，若旧 popover 仍匹配 scope selector 则只能作为 scope rejection，二者都不得授权，也不得把页面全局 raw 数量冒充活动菜单多义。等待不增加点击配额，点击后禁止第二次 DOM observation 拼接成功。隐藏 `#upload-files` 只由 Browser Authority 在 dispatch 前校验，不作为上层可见候选。

`attach_approved_gpt_files_once` 只负责一次获准 file-input batch。Product→GPT 的输入继续严格为 `{artifactRef, displayName, sha256, bytes}`；由于 Provider 会对跨会话重复文件名自动追加 `(n)`，GPT schema 的唯一公开 projector 与该 Child 共同构成 `providerDisplayName` 的唯一语义 Owner：算法只能存在于 GPT schema，Product 只能调用该 projector 或消费 Child 返回值，不得复制算法。它必须在不改变获准 bytes、sha256、artifactRef 与业务 display name 的前提下，为每个 job + artifact 派生唯一且确定、跨 attempt 不变的 `providerDisplayName`，并以 `{artifactRef, providerDisplayName, expectedSha256, bytes}` 调用现役唯一 Browser attach 入口。该入口必须同时携带本 Child 源码冻结的活动菜单 scope、精确上传叶子 selector 与 `textEquals("从电脑上传")`，Browser 只对它们做机械重验并在现役唯一 `browser.file-input.v1` 内执行一次可见叶子点击、一次同文档 chooser backend-node 绑定和一次批量 file set；禁止 GPT 另发 click Child，也禁止 Browser 直接向隐藏 input 写入、chooser 失败后 fallback 或再次上传。GPT 不取得 `localPath`、不构造或复制本地文件；Browser 只对名称、文件与 grant 做机械验证，并通过现有 execution artifact binding 调用 Runtime Owner 的 task-owned 窄化 materializer，由 Runtime 在同一材料目录中建立该精确 basename 的 hardlink 临时别名并在 binding settle/abort 时清理。hardlink 不可用时 typed fail-close，禁止 copy fallback、Browser 私有目录、第二 resolver/store 或兼容路径。后续 Prompt 只能引用 GPT projector 或 Child 返回的 `providerDisplayName`，不得继续引用会被 Provider 改写的业务 display name。ZIP 与其它附件对 GPT Child 都是不透明 bytes；Child 不得解压、解释 entry、验证 Product 内部目录或另建材料清单。

`reconcile_gpt_attachment_set` 的唯一 readiness scope 是当前 fresh coherent observation 中唯一的 `form:has(#prompt-textarea)`；附件项只认该 scope 内可见且有 layout 的 `[role='group'][aria-label]` 卡片。成功必须同时满足：composer scope `raw=eligible=1`；卡片 `raw=eligible=expected`；每个 `aria-label` NFC 后与全部且仅有批准的 `providerDisplayName` 一一精确相等；这些卡片内部可见 `svg[class*='animate-spin']` 与可见 `button.cursor-wait` 均为零。仅页面出现同名文字、仅数量相等、隐藏或 no-layout 卡片、仍带 `cursor-wait` 的上传忙态都不能证明完成。旧 `[class*='grid-area:header']` region、旧 `svg[data-testid='library-file-icon']` 及其 reader 必须物理删除，不得以 OR、fallback 或第二 observation 链保留。卡片尚未出现、存在 no-layout 候选、spinner 或 pending action 时只在 Product 给定的完整 `timeoutMs` 内 fresh observe；`BROWSER_DOM_NODE_STALE` 必须丢弃旧 nodeId 并从 composer、exact cards、scoped spinners 与 scoped pending actions 重做整包观察；两者都零 mutation。集合出现未知名称、重复名称、raw 超出批准数量或 scope 多义时立即 typed fail-close；只有等待型状态持续至 Product 上限才返回 `GPT_ATTACHMENT_UPLOAD_TIMEOUT`。该 Child 成功后 Product 才能调用 `write_exact_gpt_prompt`。Composer 的写入后置、`write_exact_gpt_prompt` readback、`reconcile_gpt_draft` 和 `submit_exact_gpt_turn_once` 发送前置必须一次性只消费 Browser 对 contenteditable 当前值按同一唯一机械规范生成的 hash-only `exactEditableTextHash`；面向已渲染 user/assistant turn 的 `semanticTextHash` 继续只服务 rendered semantic projection，禁止用于 Composer，也禁止双读或兼容 fallback。exact hash readback 成功后才调用 `reconcile_gpt_draft`，最后 submit dispatch 前必须重新证明 exact prompt hash、exact attachment set 与 turnMarker；任何前置失败都保持 Prompt 或 submit 的物理 mutation为零。禁止把 Prompt 前移、固定 sleep、延长公共 timeout、新增第二上传/写入/submit 路径或在 Product/Browser/Runtime/Website 绕过 readiness。

`wait_for_stable_gpt_text` 与 `wait_for_stable_gpt_image` 共用 GPT Owner 内唯一的 conversation-history 提示合同。每次 fresh probe 先只读检查可见 `[data-testid='modal-conversation-history-rate-limit']`：零个继续原 probe；恰好一个时必须同时证明其内恰好一个 `[role='dialog']`、唯一 `h2` 精确文本为“请求过于频繁”、唯一可见启用 `button` 精确文本为“明白了”。只有全部成立且本次 wait 尚未确认过该提示，才通过当前 exact wait call 的 Browser WAL 至多点击一次，并直接证明 root 变为零后重新执行原 conversation URL + marker + prompt hash 前置。多 root、结构/文本漂移、按钮多义或不可用、同次 wait 第二次出现都必须 typed fail 且不得再点击。该动作只关闭遮挡，绝不证明限制解除、回答稳定或允许 submit；不新增 Child、Product 分支、限流表、计时器或第二恢复状态。

## 5. 失败、证据与验收

GPT 只返回当前 Child 的 typed success 或 typed failure。任一失败、进程重启、lease 失效、Target/Document 丢失、结果不明或 Website 拒绝都结束当前 attempt；不得产生 recovery_pending、POST_SUBMIT_READBACK_FAULT、recoverOnly、requireEvidence、submission-locator recovery 或历史 per-call execution input。

新 attempt 必须创建干净 GPT 会话并由 Product 从第一入口重新调用所需 Child。GPT 不查询旧 attempt 的 call facts、checkpoint、conversation、DOM、evidence 或 staged result。Forensics 可以保留脱敏审计事实，但不向 Product 或 GPT 提供恢复资格。

验收必须证明：

1. 公开 Child 分母和每个 Child 的原子合同保持唯一；
2. 同一 attempt 的同一 Browser mutation 最多 dispatch 一次；
3. provider effect identity 精确包含 attempt_id；
4. 旧 fence 下的 GPT/Browser 调用全部拒绝；
5. 新 attempt 使用全新会话并从 Product 第一步进入；
6. recoverOnly、requireEvidence、POST_SUBMIT_READBACK_FAULT、task_exact_effect 的执行消费者为零；
7. 不存在第二 GPT transport、WAL、恢复 store、queue、manager、planner、fallback、compatibility 或 bridge；
8. 真实 Chrome 证明 current attempt 的前置、一次 dispatch、直接后置与 typed failure，且不得用静态检查冒充生产完成。
