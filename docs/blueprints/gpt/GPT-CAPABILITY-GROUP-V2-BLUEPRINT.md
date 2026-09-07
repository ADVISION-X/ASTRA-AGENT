# GPT 能力组 V26 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "gpt-capability-group-v26",
  "status": "active",
  "owner": "gpt",
  "lawIds": [
    "LAW-GPT-001-V32"
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

本次 V26 保持 28 个 Child 的公开身份、物理隔离、局部合同与 mutation 配额不变，并把 `checkpoint_gpt_generated_image` 的直接前驱核验口径收敛到现役 continuation 唯一真相：直接前驱 text checkpoint 保留自己的 turn marker、prompt hash 与 assistant turn，当前图片 turn 必须与它位于同一 canonical conversation 且 assistant turn ordinal 精确相差 2。页面同一次 coherent observation 还必须证明前驱 text assistant turn 的 semantic text hash 与 receipt 相同；不得反向要求前驱 receipt 冒充当前图片 turn。本次同时保留 V25 已冻结的三步 fork 页面接管、`/c/WEB:<opaque>` 瞬时 route 以及 execution profile 的 PRO/PLUS、0..2/0..4 与 exact/exact-or-observed-maximum 语义，不得借本次修改行为或建立兼容路径。

```text
Product Plugin 的普通 TypeScript Flow
  -> ProductGptTools.execute(one typed child call)
  -> 一个 GPT Child
  -> Browser Authority exact Target + fresh Document
  -> observation，或 precondition + 至多一次 dispatch + postcondition
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
| 图片 | `checkpoint_gpt_generated_image` | 以同一 assistant section + semanticMediaId 经当前已鉴权页面取得原始 bytes 与 proof |
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

`reserve_exact_gpt_continuation_once`、`complete_exact_gpt_continuation_reservation_once` 与现役 `acquire_gpt_continuation_lane` 必须始终由 Product 作为三次独立 `execute` 显式排列。reserve 的 typed union 只区分无 source checkpoint 的 reusable-origin 与绑定 exact source checkpoint 的 derived-continuation；两者都只在唯一 `production_continuations` row/store 写一次 reservation 或按完全相同内容幂等读回，冻结 creator job、lane/fence、effect identity 与 origin provenance。complete 只在同 reservation identity/lane/fence 上一次写齐 provider、task-owned artifact、Website exact semantic-admission receipt 与 opaque read-grant 必需字段，然后释放 reservation lane；必需字段未齐时 row 不 complete，现役 acquire 必须拒绝。acquire 默认只接受 `row_authorization`，current authorization 必须等于 row authorization；只有 typed `continuation_lane_use_grant` 将 current job/current authorization、row origin authorization、owner/subject、exact manifest 与 continuation relation 全部绑定并验证后，才允许同一 acquire Child 做一次跨 entitlement lane CAS。DB commit 后 return 前崩溃只允许同内容 readback。其它 task 不得偷取未完成 reservation 或重做 origin effect；共享层不得出现 Bazi、private base、Product id、Prompt、nextStep、phase 或业务 status。

`readContinuationExact({lookupKind:"frontier_ref"})` 仍是唯一 product-neutral exact continuation 读面。`origin_authorization` 严格复核 origin authorization；`current_artifact_read_grant` 机械复核 current authorization、owner/subject、exact source artifact/checkpoint、semantic-admission receipt 与 opaque read-grant 后读取同一 complete row 的 origin artifact，不要求尚未存在的 manifest 或 child relation。返回型必须同时读回已验证 authorization kind/current authorization、semantic-admission receipt 与 opaque read-grant hash，让 Product 不需自创字段。`continuation_lane_use_grant` 不在该 read variant 混用，它只是现役 acquire 的 typed authorization。该能力不新增 query kind、API 或 store，零条返回 null，多条或当前 typed variant 任一绑定不等失败关闭。

## 3. 原子 Child 合同

每个 Child 必须在现役唯一 contract map 中显式声明八项内容：`childId + contractVersion`、原子语义意图、唯一 Owner/读写边界、exact call 输入、唯一能力画像与 bounded-wait 资格、DONE/ACT/WAIT/FAIL_CLOSED 的局部事实和裁决、零或一次 mutation 加完整正反后置、最小安全证据。任何字段都不得由通用默认模板、自由 `observedSemantics`、调用顺序或历史成功推导。

画像分母固定为：

| Profile | Child |
|---|---|
| `DOM_OBSERVATION`（6） | `verify_gpt_conversation_identity`、`reconcile_gpt_attachment_set`、`reconcile_gpt_draft`、`reconcile_gpt_turn_submission`、`checkpoint_gpt_text_response`、`checkpoint_gpt_generated_image` |
| `TARGET_LOCAL_MUTATION`（13） | `prepare_clean_gpt_chat`、`focus_exact_gpt_conversation`、`open_gpt_execution_profile`、`open_gpt_model_selector_v2`、`select_exact_gpt_model_v2`、`ensure_gpt_reasoning_requirement`、`close_gpt_execution_profile`、`open_gpt_attachment_control`、`write_exact_gpt_prompt`、`wait_for_stable_gpt_text`、`wait_for_stable_gpt_image`、`open_gpt_checkpoint_actions_menu`、`open_gpt_fork_destination_menu` |
| `PROVIDER_EFFECT_ONCE`（3） | `attach_approved_gpt_files_once`、`submit_exact_gpt_turn_once`、`fork_exact_gpt_conversation_at_checkpoint` |
| `CONTINUATION_TRANSACTION`（6） | `persist_gpt_continuation`、`reserve_exact_gpt_continuation_once`、`complete_exact_gpt_continuation_reservation_once`、`acquire_gpt_continuation_lane`、`advance_gpt_continuation_lane`、`release_gpt_continuation_lane` |

bounded-wait 只是画像附加特征：`prepare_clean_gpt_chat`、`focus_exact_gpt_conversation`、`open_gpt_execution_profile`、`open_gpt_attachment_control`、`write_exact_gpt_prompt`、`submit_exact_gpt_turn_once`、`reconcile_gpt_attachment_set`、`reconcile_gpt_turn_submission`、`wait_for_stable_gpt_text`、`wait_for_stable_gpt_image` 只能在各自合同冻结的上限或调用既有 deadline 内对正面瞬时事实 fresh observe。`prepare_clean_gpt_chat`、`focus_exact_gpt_conversation` 与 `write_exact_gpt_prompt` 只在自身唯一 mutation 后使用共享 2500ms semantic fresh-readback 窗口；`submit_exact_gpt_turn_once` 只消费 Browser 同一点击包已有的 5000ms 外层 turn hydration 后置，随后进行一次 GPT semantic readback，不叠加第二等待链；`open_gpt_execution_profile` 与 `open_gpt_attachment_control` 只等待当前 Document 的入口或直接后置 hydration。所有这些等待都不等待 Product 步骤、不跨 Target/Document，也不取得额外 mutation 配额。纯 observation 的 `reconcile_gpt_draft` 必须以两份各自完整的 fresh coherent packet 证明同一 Target/Document、composer、exact draft hash、附件集合与 send 条件连续一致；任一 packet 自身不完整、revision 漂移或两次事实不等即丢弃重取或在原 deadline 内失败，禁止把两次各自不完整的读取拼成一次资格。候选多义、结构冲突或 native payload 非法必须立即失败。公开 terminal 始终只有 `success(value,evidence)` 或 `failed(typedReason,evidence)`；局部裁决不持久化、不进入 Product 状态。

所有页面 Child 的一次裁决只能消费 Browser 在同一 typed observation 内原子采集、或由 Browser 机械证明 revision 未变化的 `BrowserDomObservationPacketV2`。packet 固定绑定 exact call、Target、current Document、sanitized `currentUrl`、observation revision、observedAt、该 Child 最少充分的稀疏事实和 native cause；`currentUrl` 必须与 DOM facts 来自 current Document 的同一次 `Runtime.callFunctionOn` 并共同进入 `observationRevisionHash`。整包 stale、`currentUrl` 缺失/非法、Document/revision 改变或未完整返回时整包作废，禁止 Child 从 `claimOrigin`、Target claim 时 URL、`Page.getFrameTree`、另一次 URL/DOM 读取、页面外请求或持久 snapshot 拼接。Observation V1 的类型、decoder、caller 与 tests 在同一 CHANGE 物理删除，不存在 V1/V2 union、alias、optional currentUrl、dual-read 或 fallback。Browser 只签发物理事实；GPT 只负责 root/conversation Provider 语义，不读取 raw WAL、Target/Document 或把 Browser terminal 当成 GPT 语义。

真实页面的分支入口包含三次独立物理动作，Product 必须显式排列三个调用。`open_gpt_checkpoint_actions_menu` 只接受 Product 已冻结的 exact source provider/checkpoint、canonical conversation URL、turn marker、prior prompt/response identity 与自己的 exact call identity；若同一 source-bound 第一层 active menu 和唯一“打开新分支”叶子已经成立则零动作成功，否则只点击该 source assistant turn 内唯一 `button[aria-label='更多操作']` 一次，并以 fresh coherent packet 直接证明第一层菜单与叶子。真实 Chrome 已证明至少一个现役变体没有 `aria-haspopup`、另一个现役变体可以具有该属性，因此 `aria-haspopup` 不得作为 selector 或资格事实；`aria-expanded` 只作为同一入口的独立折叠/展开状态事实。已消失的 `button[data-testid='more-turn-action-button']`、OR selector、fallback 与第二入口均禁止。它是 target-local mutation，不得打开第二层菜单或创建 child relation。

`open_gpt_fork_destination_menu` 使用独立 exact call identity，只接受自身 fresh 前置重新证明的同一 source-bound 第一层 active menu 与唯一“打开新分支”叶子；若第二层目标菜单与唯一 `role=menuitem` 且精确文本为“分支到新聊天”的叶子已经成立则零动作成功，否则只点击“打开新分支”一次，并以 fresh coherent packet 直接证明第二层菜单与最终叶子。它是 target-local mutation，不得点击最终 fork 叶子或创建 child relation。

`fork_exact_gpt_conversation_at_checkpoint` 再使用独立 exact call identity，只接受自身 fresh 前置重新证明的同一 source-bound 第二层目标菜单与唯一“分支到新聊天”叶子。Browser Authority 至多 dispatch 一次最终 fork 动作，并把 Provider 新开页面的机械收束作为同一 typed command 的固定 successor normalization：点击前冻结当前 target 集合，点击后必须恰好新增一个合法 gpt-web page；Browser attach 并只读验证该新页主 frame、source conversation content 与 current child route，把现有逻辑 `targetRef` 的物理所有权原子转移到 child tab，签发递增 Document/navigation epoch，再 detach 并关闭 source tab。terminal reply 前必须重新发布同一逻辑 targetRef 的 child claim，并读回 settled production Tab 恰好一个且就是 child tab；不得关闭 child、不得导航 source、不得保持 source tab 存活。GPT 与 Product 不得枚举 tab、接收 tabId/URL 或选择页面；后续只在该逻辑 targetRef 的 child Document 上读回唯一 child conversation identity、child URL/marker 与绑定 source marker/checkpoint 的 source-to-child relation。固定 normalization 不是第二 Provider 动作、第二 WAL row 或第二执行链。fork 是 provider-effect-once：dispatch 前必须先从现役 Browser mutation receipt 与既有 fork-relation artifact 对账同一 exact call/source checkpoint；已有 verified relation 时只读返回原 child，DISPATCHED/CONFIRMED/REJECTED 或多义事实均不得再次点击。`readCallFacts(task_exact_effect)` 按同 task/plugin/version/call/input/source checkpoint 重算完整 identity并只返回 Product-safe 的零或唯一 fact。commit-before-return 后只读原 child，禁止第二次 fork。任一步 missing、ambiguous、stale、目标集合零/多、新页 Origin 非法、child 接管失败、source tab 关闭失败、新 claim 未闭合或 relation 多义都以自身 typed reason 零额外 Provider 动作失败，不允许循环点击、latest source、same-conversation fallback、第二 Browser capability或并存第二生产 Tab。

### 3.1 页面实证闭环

页面操作分母矩阵唯一位于 `src/capabilities/gpt/page-operation-matrix.json`，归属 GPT Owner，并处于 `LAW-GPT-001-V32` 的 `src/capabilities/gpt/**` 适用范围内。质检只能从密封候选读取该矩阵；不得从工作树外读回、复制第二份矩阵或建立兼容查找路径。

二十二个页面 Child 继续只在各自现有 handler、合同和 Browser typed command 内闭合，不新增 Child、公共 selector registry、第二 observation、第二存储或质量裁决。当前真实页面实证要求以下直接约束：

- `checkpoint_gpt_generated_image` 必须先证明直接前驱 text checkpoint 与当前图片 turn 属于同一 canonical conversation，且前驱 assistant turn ordinal + 2 精确等于当前图片 assistant turn ordinal；同一次 coherent observation 必须同时命中该前驱 assistant turn，并证明它的 semantic text hash 与 receipt 相同。前驱 receipt 的 turn marker、prompt hash、assistant turn 与 source checkpoint identity 必须保持前驱自身原值，严禁要求它们等于当前图片 turn 的 marker、prompt hash 或 assistant turn；字段形状正确、仅 URL 相同或仅 ordinal 相邻都不能代替完整身份闭合。闭合后才可取得当前 assistant turn 的媒体。
- `checkpoint_gpt_text_response` 的 exact assistant turn 专用 reply 必须携带并核对产生 turn 邻接事实的同一 `observationRevisionHash`；不得把一条列表 observation 与另一 revision 的完整 DOM/semantic reply 拼成 checkpoint。
- `close_gpt_execution_profile` 必须在关闭前证明当前 trigger 与唯一 popup 的 owner relation，关闭后的同一直接后置必须证明该 popup 缺席、trigger collapsed 且唯一 composer 未被遮挡并可操作；全局 `popup=0` 单独不能成功。
- `focus_exact_gpt_conversation` 导航或零导航后都必须在同一 fresh coherent packet 中证明 canonical URL、目标 marker、该 marker 的 exact user turn 与 prompt hash；URL 相等不是 conversation identity。
- `open_gpt_attachment_control` 必须在唯一 composer form scope 内确认唯一可见附件入口，并只在唯一活动菜单内核对唯一精确“从电脑上传”叶子；不得要求真实页面未保证的 `aria-expanded`、`aria-controls`、`aria-labelledby` 或附件 trigger/menu owner relation。`open_gpt_checkpoint_actions_menu` 必须把第一层菜单及“打开新分支”叶子绑定 exact source-turn trigger；`open_gpt_fork_destination_menu` 必须把第二层菜单及“分支到新聊天”叶子绑定前一层 source-bound 入口。页面全局唯一菜单不能代替后二者的 owner relation。
- `open_gpt_execution_profile` 必须以同一 coherent packet 证明 trigger 与 popup 的 `aria-labelledby` owner relation；owner 不等时零 mutation 失败。`open_gpt_model_selector_v2` 必须保留 Product 冻结的 `modelDisplayName`，只有 active advanced panel 内该 exact radio 已唯一 hydration 才能成功。
- `select_exact_gpt_model_v2` 的唯一 Browser mutation reply 必须把动作目标的稳定 identity、exact model name 与动作后的 `aria-checked=true` 绑定，同时保留现役 popup/simple/advanced 收束事实；不得用面板折叠单独冒充模型已选中，也不得补第二次点击或第二次 DOM 读回。
- `reconcile_gpt_turn_submission` 必须先核对现役 confirmed-submit receipt 的 exact call identity、turn marker 与 prompt hash，再接受同一 coherent packet 中的 exact user turn 和 durable canonical URL；返回的 conversation identity 不能自行补造未核对的 marker。
- `submit_exact_gpt_turn_once` 的“相同 user turn 已存在”零动作成功分支，除 URL、marker、prompt 与唯一 turn 外，还必须在同一 coherent packet 证明 composer exact empty 且待提交附件为零；残留 draft 或 attachment 必须失败关闭。
- `verify_gpt_conversation_identity` 必须把 canonical URL、marker、exact user prompt、相邻 assistant response 与最终 identity 绑定同一 observation revision；不同 revision 的 turn 列表和完整 assistant 读取不能拼成成功。
- `wait_for_stable_gpt_text` 与 `wait_for_stable_gpt_image` 的输入必须包含 `reconcile_gpt_turn_submission` 返回的 required `conversationIdentityHash`。每次首次 probe、park/reacquire 与跨 URL 导航后的 fresh probe，都必须用 `canonical URL + turnMarker + observed userTurnId + promptHash` 重算并核对该 identity，再接受紧邻 assistant；只核对 prompt hash 不合格。十二个 Product 调用方必须在同一删除式切换中传递该 required 字段，不保留 optional、默认、旧输入或兼容分支。
- `reconcile_gpt_attachment_set`、`wait_for_stable_gpt_text` 与 `wait_for_stable_gpt_image` 还必须识别各自真实页面 terminal error，并在同一 coherent packet 中立即 typed fail-close；选择器和机械特征只有取得当前候选的真实 Chrome fresh-DOM 实证后才能冻结。在实证缺失时，这三项不得猜测 selector、不得把超时冒充 terminal，也不得阻断其余已闭合 Child 的施工与验收。

`checkpoint_gpt_text_response` 的 DOM 责任是完整取回 Provider 当前实际呈现的产物，不是解释 JSON 或业务内容。它必须锁定精确 assistant turn，并通过专用 exact-assistant-turn reply-only typed channel 保存该节点完整 `outerHTML`；确定性语义读取始终遍历完整 response tree，把 `<br>`、块级边界、列表以及 `<strong>/<em>/<code>` 等标签投影为显式 canonical 标记并保留转义、Unicode 与全部可见字符。`<pre>` 内的 code 使用 code `textContent` 作为该块语义，但绝不能因页面恰好只有一个 code block 就丢弃标题、正文、列表或结尾兄弟节点；纯单一 code-block 回答仍自然得到干净代码正文。exact assistant turn 的 `semanticText/semanticTextHash` 与 coherent observation 的 `semanticTextHash` 必须调用 Browser Owner 内同一唯一 serializer，禁止第二算法或兼容分支。canonical text 是 observed DOM 的可追溯语义投影，不冒充 Provider 原始 Markdown/source bytes；原 DOM HTML 与投影文本及各自 hash 一起进入同一 task-owned output artifact，二者不得进入通用 coherent packet。禁止散落 text-node 拼接、`innerText` 布局副作用、预设业务字段选择器或正则截断；零个或多个完整 assistant 候选必须 typed fail-close。Forensics 与 Runtime Logs 只保存 artifact ref/hash，不保存 DOM 或正文。

`wait_for_stable_gpt_image` 与 `checkpoint_gpt_generated_image` 的 turn Owner 是紧邻已验证 user turn 的唯一外层 `[data-testid^='conversation-turn-']:not(:has([data-message-author-role='user']))` section，而不是其内可选的 `[data-message-author-role='assistant']` 文本节点。真实 Chrome 已证明外层 section 不再携带 `data-turn`；图片 turn 可以没有 assistant 文本角色节点。每次 fresh probe 必须证明该 section 唯一、Provider stop/generating 控件缺席。Browser 已鉴权媒体原子命令必须在同一 current Document 再证明该 section 恰好一个，并把其中 raw `<img>` 机械投影为语义候选：只有 connected、`complete=true`、natural width/height 均大于零、非零布局、computed display/visibility/opacity 非隐藏且 NFC `alt` 非空的节点进入集合；禁止像素阈值和首节点选择。物理节点先按页面内资源 identity 收敛，再在当前登录会话内取得原始 bytes并按 content hash 去重；同 bytes 的重复 URL/节点只算一个，最终 content identity 零个继续等待、多个立即 typed fail。集合恰好一个时，wait 返回 assistantTurnId、semanticMediaId 与 mediaHash；Browser reply 同时返回 target/document hash 与原始 bytes receipt。该 assistant section 可以没有可见文本。checkpoint 必须用相同 assistantTurnId + semanticMediaId + mediaHash 重新取得并证明同一媒体，task-owned receipt 再绑定 canonical conversation、turn marker、prompt hash、原图/变换 content identity 与直接前驱 text receipt；禁止 responseText/responseHash/expectedResponseHash 文本门槛、inner assistant-role 门槛、选择第一个 raw img、截图、DOM URL、页面外 fetch 或第二 downloader。

每次调用身份固定为：

```text
job_id + attempt_id + plugin_id + plugin_version
+ product_step_id + call_id + child_id + input_hash
```

同一 Provider effect 的跨 attempt 物理身份固定为 `provider_effect_identity_hash = sha256(canonical ordered tuple [job_id, plugin_id, plugin_version, product_step_id, call_id, child_id, request_hash, payload_hash])`；attempt_id、lease、进程、Target、Document 与 build 只属于执行绑定，不得制造新的 effect identity。物理 pre-dispatch fence 唯一属于 Browser WAL：Browser 在任何 provider-effect PREPARED 前跨全部 attempt 机械查询该 hash，历史零项才可首次 dispatch；历史非空时，只有全部记录均为 `REJECTED + mutation_outcome=no`、每条均属于不同旧 attempt，且当前 permit 绑定 Website 新签发并不同于全部旧记录的 accepted attempt，才可再次 PREPARED；任一 `DISPATCHED`、`CONFIRMED`、`REJECTED + dispatched|confirmed`、当前 attempt 已有记录、identity/attempt 多义或记录冲突均零 mutation失败关闭。Forensics 只拥有 exact-call evidence 生命周期，不参与签发物理提交许可；Product 只消费 GPT 安全投影。Target-local Browser mutation 仍另加 `attempt_id + target_generation`，同 attempt 已有 verified evidence 或 DISPATCHED/CONFIRMED/REJECTED fact 时禁止在新 Target generation 重做。已有唯一 `CONFIRMED + passed` submit receipt 时，Website 必须保留同一 accepted attempt，只允许 GPT 沿原 pending evidence 做零 mutation读回；新 attempt、错误码、deadline 和 Target 丢失都不产生重提资格。

Provider effect 在整个 job 的相同 `provider_effect_identity_hash` 下物理至多一次。`DISPATCHED` 永远只读 Browser WAL，只能在原现场对账；`CONFIRMED` 永远只沿 Website 保留的同一 accepted attempt 读回成果。Browser 不裁决 REJECTED/FAILED 后是否建立新 attempt；只有 Website 签发不同的新 accepted attempt，且 Browser WAL 对该 hash 的全部历史均为不同旧 attempt 的 `REJECTED + no` 时才可再次 PREPARED，任何已发出或不能排除已发出的物理输入都必须永久拦截。

## 4. 当前 Document 前置

所有 Child 每次都读取当前 Target + 当前 Document。过去调用成功、产品步骤位置或任何 checkpoint 都不能证明瞬态弹面仍存在。模型或推理操作前，若 execution profile 不存在，Product Plugin 必须先调用 `open_gpt_execution_profile`；Child 自身仍须重新验证当前 DOM。Provider text/image wait 与 checkpoint 每次 probe 都在当前合法 system Target 上先复核 canonical conversation URL；checkpoint 与同 URL wait 立即读取，只有 `wait_for_stable_gpt_text` 或 `wait_for_stable_gpt_image` 在等待产物时发现 fresh currentUrl 属于另一 canonical conversation、即将实际跨 conversation URL 查证结果，才先取得第 5 节的全进程 30000ms 轮询资格，然后只在该 Target 导航复位并作一次有界 hydration，再以 turn marker 找到唯一 user turn。prompt hash 只对该 turn 内唯一请求正文机器节点计算：读取现役 deterministic semantic tree，恢复 strong/em/code 等显式标记，只移除投影算法为根块额外加入的一个终止分隔换行，并保留正文自身全部字符与尾换行。当前生产长消息的实证节点固定为 `[data-testid='collapsible-user-message-content']`，外层 `[data-message-author-role='user']` 的附件卡片、文件名与展开/收起控制文字不属于 Prompt；禁止 textContent 丢 Markdown 结构，也禁止 trim、删反引号或其它内容启发式。正文节点零个、多于一个或 canonical rendered-prompt hash 不等都零 mutation 失败关闭；随后只接受紧邻 assistant turn。文本 wait/checkpoint 用 canonical response hash 锁定稳定语义文本；图片 wait/checkpoint 只用 assistantTurnId + semanticMediaId + mediaHash/content identity 锁定媒体，禁止 responseText/responseHash 门槛。URL、marker、prompt hash、相邻 assistant 及当前结果类型对应的 text response hash 或 image media/content identity 任一不成立都不得接收。

`reconcile_gpt_turn_submission` 的输入同时绑定 `turnMarker + expectedPromptHash`，成功值固定包含由 revision-bound `currentUrl` 判定的 canonical conversation URL、turn marker、user turn id、canonical rendered-prompt hash 与 conversation identity。唯一 Forensics evidence Owner 必须在 Runtime/GPT 经现役接口调用后、单一生产 Tab 让出时间片前，以同一 exact call identity 的受控 `submission-locator` suffix 写入并读回 task-owned artifact；Runtime/GPT 不建立第二 writer，同 identity 重放先读该 artifact并返回原成功值，再由后续 wait/checkpoint 导航 URL 作 live 验证。完整 canonical conversation URL 正文只持久于该既有 submission-locator 与 continuation。confirmed submit + 原 Target/Document 仍在时，可从唯一 Browser WAL 与 Forensics confirmed receipt 派生 source-only 短生命周期授权，仅以同一 coherent currentUrl 做零导航零 mutation observation/settle/locator 写入；只有 submission-locator 唯一闭合后才升级为允许 exact canonical navigation 的 full readback，continuation 只能消费已闭合 locator，不得替代 locator 签发升级。两者都用毕释放，不得写入 artifact、row、WAL、log、proof、registry/ledger 或成为第四份 URL 真相。

当 `submit_exact_gpt_turn_once` 已由 Browser WAL + Forensics 唯一终结为 `CONFIRMED + passed`，但直接 GPT 语义后置或后续 locator/readback 失败时，唯一 evidence 生命周期必须保持原 `pending`，Website 保留同一 accepted attempt。原 Target/Document 尚在时，Product 可在同一 Browser execution 内立即且只调用现役 `reconcile_gpt_turn_submission` 做 source-only 有界零 mutation回证并写入唯一 locator；locator 闭合后，后续 invocation 才可经 full readback 导航原 canonical URL。reconcile 失败、locator 暂缺/损坏/多义或原 Document 消失只结束本次 probe，不得 terminal-fail 原 submit evidence、创建新 attempt、重写 Prompt/附件/submit、按当前/最新聊天猜测，或释放成可重提任务。

所有 Product 共用的 Provider 页面 mutation Child 必须在自己的直接后置内统一执行条件驱动稳定判定：Browser 已终结唯一物理动作后，若该 Child 仍需 GPT semantic fresh readback，首次只有可恢复的缺席、未 hydration、尚未清空或尚未形成 canonical locator 等瞬时负事实时，必须在最多 `2500ms` 内反复从同一 exact Target/Document 取得 fresh coherent 零 mutation 观察；正面条件出现立即返回，Target/Document 失效、候选多义、结构冲突、非法输入或其它硬失败立即停止，到期仍未满足才返回原 typed postcondition failure。该规则位于 GPT Child，不位于 SEO 或其它 Product；Browser 的同一 mutation packet 已经拥有更长的条件驱动 direct postcondition 时继续沿现役 packet，不追加第二观察链。纯 observation、continuation transaction、Provider 长等待、checkpoint、DONE 零动作不使用该窗口；禁止固定 sleep、等待后单次读取、把时间到达当成功、重发动作或增加 mutation 配额。

已渲染 user turn 的请求身份保持单链：同一次 coherent observation 以外层 `[data-testid^='conversation-turn-']:has([data-message-author-role='user'])` 取得 `conversation-turn-*`，但 prompt hash 只消费 Browser 在该外层 turn 内对唯一 `[data-testid='collapsible-user-message-content']` 正文节点签发的 `exactGptUserPromptHash`。真实 Chrome 已证明角色在内层 `data-message-author-role`，外层不再携带 `data-turn`。正文零项/多项或外层身份不合法失败关闭；附件卡片、展开/收起等控制文字不得进入哈希。禁止对外层容器使用 `semanticTextHash`，禁止第二 query 按序拼接、字符串剔除、selector OR 或 fallback。submit 直接后置、reconcile、Provider wait、conversation verify/fork 与 checkpoint identity 共用这一条事实。

recoverable confirmed submit 不新增公共 `readConfirmedSubmitFailure`。Product fresh/恢复入口只消费现役 `readCallFacts` 的 Product-safe 已完成事实：命中唯一 confirmed submit 时跳过 profile、附件、Prompt、draft 与 submit，沿 Website 保留的同一 accepted attempt 消费原 pending evidence；零项时只进入正常 fresh Flow，真正的跨 attempt provider-effect pre-dispatch fence 仍由 Browser WAL 在 PREPARED 前独立执行，Product 与 Forensics 均不参与或签发许可。source-only 授权只绑定原 Target/Document 的 coherent currentUrl，零导航零 mutation；唯一 locator 闭合后升级为 full readback，才允许现役 acquisition 恢复单一 Target 并 exact canonical navigate。损坏、多义或 identity 错配失败关闭。不得暴露 Target/Document/WAL/DOM/failure proof、流程位置或历史 per-call failure，不新增 store、locator、状态、Child、Browser lane 或 submit 路径。

唯一 `CONFIRMED + passed` submit receipt 一经闭合，就立即保护同一 accepted attempt 与原 pending evidence，不要求 locator 已闭合。locator pending 时只允许原 Target/Document 的 source-only reconcile；locator 闭合后才允许 full readback。`continuationRef`、回答 checkpoint、response hash 或已完成 Product frontier 都不是前置。该规则覆盖 fresh 首轮和 continuation follow-up；已完成的模型、附件、Prompt、draft 与 submit 必须物理跳过。locator 暂缺、损坏、多义或 hash/identity 不闭合只结束本次 probe，绝不得重新提交补证据。

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

`attach_approved_gpt_files_once` 只负责一次获准 file-input batch。Product→GPT 的输入继续严格为 `{artifactRef, displayName, sha256, bytes}`；由于 Provider 会对跨会话重复文件名自动追加 `(n)`，该 Child 是 `providerDisplayName` 的唯一语义 Owner，必须在不改变获准 bytes、sha256、artifactRef 与业务 display name 的前提下，为每个 attempt + artifact 派生唯一且确定的 `providerDisplayName`，并以 `{artifactRef, providerDisplayName, expectedSha256, bytes}` 调用现役唯一 Browser attach 入口。该入口必须同时携带本 Child 源码冻结的活动菜单 scope、精确上传叶子 selector 与 `textEquals("从电脑上传")`，Browser 只对它们做机械重验并在现役唯一 `browser.file-input.v1` 内执行一次可见叶子点击、一次同文档 chooser backend-node 绑定和一次批量 file set；禁止 GPT 另发 click Child，也禁止 Browser 直接向隐藏 input 写入、chooser 失败后 fallback 或再次上传。GPT 不取得 `localPath`、不构造或复制本地文件；Browser 只对名称、文件与 grant 做机械验证，并通过现有 execution artifact binding 调用 Runtime Owner 的 task-owned 窄化 materializer，由 Runtime 在同一材料目录中建立该精确 basename 的 hardlink 临时别名并在 binding settle/abort 时清理。hardlink 不可用时 typed fail-close，禁止 copy fallback、Browser 私有目录、第二 resolver/store 或兼容路径。后续 Prompt 只能引用 Child 返回的 `providerDisplayName`，不得继续引用会被 Provider 改写的业务 display name。ZIP 与其它附件对 GPT Child 都是不透明 bytes；Child 不得解压、解释 entry、验证 Product 内部目录或另建材料清单。

`reconcile_gpt_attachment_set` 的唯一 readiness scope 是当前 fresh coherent observation 中唯一的 `form:has(#prompt-textarea)`；附件项只认该 scope 内可见且有 layout 的 `[role='group'][aria-label]` 卡片。成功必须同时满足：composer scope `raw=eligible=1`；卡片 `raw=eligible=expected`；每个 `aria-label` NFC 后与全部且仅有批准的 `providerDisplayName` 一一精确相等；这些卡片内部可见 `svg[class*='animate-spin']` 与可见 `button.cursor-wait` 均为零。仅页面出现同名文字、仅数量相等、隐藏或 no-layout 卡片、仍带 `cursor-wait` 的上传忙态都不能证明完成。旧 `[class*='grid-area:header']` region、旧 `svg[data-testid='library-file-icon']` 及其 reader 必须物理删除，不得以 OR、fallback 或第二 observation 链保留。卡片尚未出现、存在 no-layout 候选、spinner 或 pending action 时只在 Product 给定的完整 `timeoutMs` 内 fresh observe；`BROWSER_DOM_NODE_STALE` 必须丢弃旧 nodeId 并从 composer、exact cards、scoped spinners 与 scoped pending actions 重做整包观察；两者都零 mutation。集合出现未知名称、重复名称、raw 超出批准数量或 scope 多义时立即 typed fail-close；只有等待型状态持续至 Product 上限才返回 `GPT_ATTACHMENT_UPLOAD_TIMEOUT`。该 Child 成功后 Product 才能调用 `write_exact_gpt_prompt`。Composer 的写入后置、`write_exact_gpt_prompt` readback、`reconcile_gpt_draft` 和 `submit_exact_gpt_turn_once` 发送前置必须一次性只消费 Browser 对 contenteditable 当前值按同一唯一机械规范生成的 hash-only `exactEditableTextHash`；面向已渲染 user/assistant turn 的 `semanticTextHash` 继续只服务 rendered semantic projection，禁止用于 Composer，也禁止双读或兼容 fallback。exact hash readback 成功后才调用 `reconcile_gpt_draft`，最后 submit dispatch 前必须重新证明 exact prompt hash、exact attachment set 与 turnMarker；任何前置失败都保持 Prompt 或 submit 的物理 mutation为零。禁止把 Prompt 前移、固定 sleep、延长公共 timeout、新增第二上传/写入/submit 路径或在 Product/Browser/Runtime/Website 绕过 readiness。

`wait_for_stable_gpt_text` 与 `wait_for_stable_gpt_image` 共用 GPT Owner 内唯一的 conversation-history 提示合同。每次 fresh probe 先只读检查可见 `[data-testid='modal-conversation-history-rate-limit']`：零个继续原 probe；恰好一个时必须同时证明其内恰好一个 `[role='dialog']`、唯一 `h2` 精确文本为“请求过于频繁”、唯一可见启用 `button` 精确文本为“明白了”。只有全部成立且本次 wait 尚未确认过该提示，才通过当前 exact wait call 的 Browser WAL 至多点击一次，并直接证明 root 变为零后重新执行原 conversation URL + marker + prompt hash 前置。多 root、结构/文本漂移、按钮多义或不可用、同次 wait 第二次出现都必须 typed fail 且不得再点击。该动作只关闭遮挡，绝不证明限制解除、回答稳定或允许 submit；不新增 Child、Product 分支、限流表、计时器或第二恢复状态。

## 5. 失败、证据与验收

同一 exact child evidence 只有一个 append-only 生命周期：既有 `gpt-call-evidence:v1:<exactCallIdentityHash>` 初始记录首次写 `pending` 后不进入 completed-result replay；随后只有既有 `gpt-call-terminal-evidence:v1:<exactCallIdentityHash>` 的唯一 terminal `passed` 或显式不可恢复的 `failed` 可关闭，两条记录合计一个 lifecycle、最多两条。Browser `DISPATCHED` 只允许原现场只读对账；Provider submit 已 `CONFIRMED + passed` 时，locator/DOM/readback 瞬时失败、Target/Document 丢失、probe deadline 到期、进程或 lease 变化都必须保持原 pending 与同一 accepted attempt，后续 invocation 继续同一 evidence。只有 Provider 明确 terminal negative、永久撤权、confirmed-submit receipt 或该 submit 的 initial exact-call evidence 损坏或多义才写 terminal failed；submission-locator 的缺失、损坏或多义明确不属于该终止条件；成功读回只写一次 terminal passed。再次得到 pending 不写结算；禁止覆盖 initial、刷新 identity、由新 attempt 对账，或增加第三 key/row、invocation evidence、第二 writer、table、failure history、恢复状态或 verdict。

Child 只返回 `success` 或 `failed + typed reason`。真实页面/Provider failure 必须包含 `code`、`mutationOutcome=no|dispatched|confirmed`、`evidenceRef/evidenceHash` 和存在时的最内层原生 cause；debugger detach/channel 原因不得被统一 `BROWSER_INFRASTRUCTURE_FAILED` 覆盖。Browser DOM candidate missing/ambiguous、rerender stale node、可见性/box 读取和 CDP payload 形态错误必须分别保留稳定 typed cause，`BROWSER_TARGET_INVALID` 只表达 exact Target identity 本身无效。`reconcile_gpt_turn_submission` 在自己的既有 timeout 内遇到瞬时 DOM candidate/stale cause 时，必须重新取得 fresh node 并从 user-turn count/composer/document 开始重做完整只读前置；它不得捕获真正 Target/Document 失效，也绝不得重发 submit。

safe evidence projection 必须保持 Browser terminal、物理 mutation 与 GPT 语义后置三者正交。exact submit 的 Browser WAL 与 Forensics evidence 唯一闭合 `CONFIRMED + passed` 后，原 Provider effect 永远 confirmed，原 exact child evidence 保持 pending 直到成果读回 terminal passed 或出现显式不可恢复事实；后续 reconcile/wait/checkpoint 的 `mutationOutcome=no` 只描述当前只读 Child。Runtime 必须立即引用 `confirmed_submit` 构造现役 `POST_SUBMIT_READBACK_FAULT`，Website 保留同一 accepted attempt；locator 未闭合时只允许原 Target/Document source-only reconcile，闭合后才允许 full readback。cause code、Target/Document read failure、locator 缺失、本次 probeDeadlineAt、进程重启和普通 attempt cap 都不得充当恢复 allowlist 或成果存亡门；deadline 只结束本次有限 probe，Website 继续用现役 `retry_not_before` 退避。Child 不返回 `review_required`、`recovery_pending`、流程位置、重试决策或历史 per-call failure。exact text/image checkpoint 成功后的接收、归一或组装软件故障同样引用原 artifact/ref/hash 沿原 attempt 恢复；任何已完成 frontier turn 均不得重新提交。

Continuation lane 的结构边界固定为：首次 persist 必须先验证 origin provider/checkpoint 成对、current=origin、prior_task_id=jobId，再原子写入；advance 必须先验证 current provider 与 text semantic hash 或 image media hash、URL、Prompt、marker 成对，再以同一 lane/version CAS 原子写 current provider/checkpoint 并清空 owner；release 只清空同一 owner/version，同 lane/version 已 owner=null 说明 advance/release 已结算，旧 provider lane 的 finally release 必须幂等 no-op而不得覆盖原 evidence 故障。generated-image current receipt 必须在自身内部绑定经 artifact readback 验证的同 conversation 直接前驱 text receipt；它仍是一份 current receipt，不形成历史链或第二状态。调用 Product 在 acquire 成功的下一语句立即进入 try/finally，expected provider compare、conversation focus/verify 或任一后续调用抛错时都必须 release；只有 advance 已成功或 DB commit 后幂等 readback证明成功时才设置 settled。合法 task-local busy lane 不是 ledger corruption；异常遗留 lane 只影响所属 job，并由同一 job 下一 accepted attempt 的现役接收事务释放，不得阻断其它 job、增加 cleanup worker 或建立第二 ledger。既有 frontier row 的一次性 cutover 不得在 schema migration 阶段盲写 current：evidenceStore 可用后，current provider=origin provider 时仍须读回 origin text artifact/evidence/hash 再复制；current provider 已推进时，现役部署只允许从同 job/plugin 的 task-owned exact-call artifact 唯一重建与 current provider 的 URL/marker/prompt/response hash 全等的 article text receipt。旧 generated-image provider 没有持久直接前驱 text receipt，不能伪造新 receipt，必须只让所属 task以精确 cutover code fail-close且禁止重做 Provider turn；零条、多条或不等同样 task-local fail-close，不得回退 provider、保留 nullable/legacy reader或阻断其它 task。

固定 5 秒等待被删除。等待只允许是单个 Child 为 fresh DOM、hydration 或直接 postcondition 使用的有界实现，并由真实条件提前结束。Provider text/image wait 每次由 Product 传入稳定 `probeBudgetMs`，本次合法 invocation 派生 `probeDeadlineAt=min(invocationStartedAt+probeBudgetMs, 当前 lease/abort 上限)`；同 invocation 的 normal park/reacquire 不刷新它，后续同 accepted attempt 的新 invocation 获得新的有限 budget。Provider submit 的 immutable terminalAt 只记录 effect 终结时刻，不参与 wait 寿命。两个 wait Child 继续共享 GPT Owner 进程级单调 `nextCrossConversationPollAt`：只有 fresh currentUrl 不等于目标 canonical URL 且即将实际导航时才同步 check-and-set，使跨 conversation navigate 至少相隔 30000ms；资格未到就 normal park、释放 Browser FIFO，在 FIFO 外等待资格或本次 probeDeadlineAt/abort，重领后 fresh 重读 URL。同 URL probe、其它 Child、checkpoint、fresh root 与动作直接后置不消费该资格。该标量不按 job 分片、不持久化，不建 waiter、队列、scheduler、worker、table 或第二 lane。每次重领重新证明 URL + marker + prompt hash + 相邻 assistant，并按类型重证文本或媒体 identity。本次 deadline 到达只以 typed fault 结束这一 probe并保留 confirmed submit 的 pending evidence；成功仍至少需要 deadline 内两次分离 fresh observation/download 一致。`close_gpt_execution_profile` 只能使用当前 profile Owner 内经实证唯一的收束动作并直接证明 popup 缺席。

授权验收必须额外证明：`current_artifact_read_grant` 零 manifest/child-relation 要求且只在 current authorization、owner/subject、source artifact/checkpoint、semantic-admission receipt/read-grant 全闭合时读回；`continuation_lane_use_grant` 则只在 current/origin authorization、owner/subject、manifest/continuation relation 全闭合时允许现役 acquire 一次跨 entitlement CAS。两种 grant 不得互换、合并或补默认值。

物理防重验收必须覆盖完整状态矩阵：`provider_effect_identity_hash` 逐字段绑定 ordered `job/plugin/version/step/call/child/request_hash/payload_hash`，attempt/lease/process/Target/Document/build 全部变化后 hash 不变；历史零项可首次 PREPARED；历史非空时，只有全部记录均为不同旧 attempt 的 `REJECTED + no` 且 Website 新签发的 accepted attempt 不同于全部旧记录时可再次 PREPARED；已有 `DISPATCHED`、`CONFIRMED`、`REJECTED + dispatched|confirmed`、当前 attempt 记录、identity/attempt 多义或记录冲突时 PREPARED/dispatch 增量均为零。测试必须直接穿过 Browser WAL 唯一硬门；Forensics 只验 exact-call evidence 生命周期，Product 只验 GPT 安全投影，二者都不能签发提交许可。

URL 闭环验收必须逐项证明：所有页面 Child 只消费与 current Document 同一次 observation 且进入 `observationRevisionHash` 的 sanitized `currentUrl`；`claimOrigin`、Target claim 时 URL、`Page.getFrameTree` URL、另一次读取和 caller 值均不能满足任何 GPT 页面语义。根页只接受 `/`，conversation 只接受 `/c/<单个非空有界 opaque segment>`，query/fragment 已在 Browser 物理丢弃；currentUrl 缺失、非法、与 revision 不闭合或语义不符时零 mutation fail-close。完整 canonical conversation URL 正文只在现役 submission-locator/continuation readback 出现。confirmed receipt 在 locator pending 时只可投影绑定原 Target/Document + coherent currentUrl 的 source-only 零导航授权；locator closed 后才投影 full recovery authorization。两者都只存在调用期内存且不可持久化。通用 coherent observation 不得含 rawDomHtml/semanticText，只有专用 exact-assistant-turn reply-only typed channel 可返回二者。

GPT 页面实证闭环使用一个稳定 `captureEpoch` 加一个廉价 `projectionRevision`。代码、合同、实现、Product、法案、Blueprint、矩阵、候选 digest 或 provider build marker 改变时，只运行离线 `refresh -> admit -> deterministic tests -> quality:check`，不得自动打开 Chrome。新 `captureEpoch` 只有两个入口：现有报告被真实 GPT 页面执行实际消费且同一事件的生产代码、运行日志、页面回读共同确认 `PAGE_EVIDENCE_CONFLICT_CONFIRMED`；或用户明确触发 `HUMAN_REQUESTED_RECAPTURE`。其它情况固定 `RECAPTURE_FORBIDDEN`；`PAGE_EVIDENCE_GAP` 只保留缺口。冲突触发只采受影响场景，人工触发只按明确范围采集。准入必须按当前修改实际消费的页面事实裁决：完整 Child 可全量准入；存在明确缺口的单个 Child 只能显式声明并消费已经绑定的 observation fact，未知或未观察 fact 失败关闭。上游 Child 的无关缺口不得否定下游已经绑定的具体成功 observation；法案或 Blueprint 中未点名页面 Child 的其它域变更不得回退成 22 个页面 Child 全受影响。

聚焦验收必须证明：28 个 Child 精确且画像数量为 6/13/3/6；28 行均具八项显式合同、共同硬门及画像附加门，页面 Child 只消费 coherent Browser packet，六个 continuation 不调用 Browser；reserve/complete/acquire 三调用互不合并且每个 mutation count 恰为一，reservation 与 completion 的 commit-before-return 都只读回原 receipt，未 complete row 不能 acquire，非 creator 不能偷取未完成 reservation；opaque grant 的 current/origin authorization、owner/subject、source checkpoint、manifest/continuation 任一错配都在 artifact read 前失败。Product 对 fork 必须显式调用 `open_gpt_checkpoint_actions_menu -> open_gpt_fork_destination_menu -> fork_exact_gpt_conversation_at_checkpoint`：三者分别只点击更多操作、“打开新分支”和“分支到新聊天”至多一次；前两步分别直接证明第一层与第二层唯一菜单及 source-bound owner relation，最终一步必须由 Browser 在同一命令内证明恰好一个新增合法 gpt-web page、验证 source conversation content 与 child route、把同一逻辑 targetRef 接管到 child tab、关闭 source tab并递增 Document/navigation epoch，且在 reply 前恢复 settled production Tab 恰好一个，GPT/Product 看不到 tabId。菜单已经打开、菜单 missing/ambiguous、动作间 redraw、target 集合零/多、fork DISPATCHED 后崩溃、CONFIRMED-before-return、source 错配、零/多 child、child 接管失败、source 关闭失败、新 claim 未闭合与 relation 多义都必须逐项证明；Page.navigate 与 child close 计数必须为零，任何路径不得循环点击、把三次 action 合并、持久并存第二 Tab 或建立第二 Browser capability。富文本验收必须用真实 DOM tree 覆盖标题、正文、列表、inline code、唯一 JSON code block 与结尾兄弟节点，证明 exact assistant turn 与 coherent observation 经同一 serializer 得到相同完整 semantic hash；纯单一 code-block 仍得到干净正文。文本与图片稳定等待必须分别证明本次 probeDeadlineAt 内至少两次一致 fresh observation/download 才成功；本次 deadline 到达即使首样本存在也只结束本次 probe并保持 confirmed-submit evidence pending，不 checkpoint、不建立新 attempt。跨 attempt provider-effect 测试必须证明相同 provider_effect_identity_hash 在 lease、进程、Target、Document、build 与 attempt 变化后物理 submit count 仍为一；已有 DISPATCHED、CONFIRMED、REJECTED + dispatched|confirmed 或多条冲突 fact 时新 PREPARED/dispatch 增量为零。公共面无 turn API；产品能显式调用任意 Child 序列；每个已开始 Child span 在 Browser lease 获取、park、reacquire 或原子能力任一失败点都恰好产生一个 typed terminal；readCallFacts 与 readContinuationExact 都只读、无流程决策与无 failure/state/Target/WAL 泄漏，turn-marker/frontier-ref 查询互斥且互相 fallback 为零；模型面板必须覆盖 OPENABLE、点击后旧 expanded-entry 过渡态和稳定 `popup=1 + entry=0 + simple=0 + advanced=1` 的 ALREADY_OPEN，只有稳定终态可成功；已选中和未选中两种真实页面状态都只点击唯一 radio 一次，模型入口额外点击计数为零，选择后 popup 保留、entry collapsed、simple active、advanced absent；Browser `CONFIRMED + confirmed` 后 GPT semantic postcondition failed 必须保持 failed且 proof 正交保存三项真相；`open_gpt_execution_profile` 必须分别覆盖 0..2 与 0..4 的全零候选 `0 -> 1` hydration 后一次打开、已经 DONE 零动作、六组任一 raw/eligible 多义或 ineligible raw/部分结构立即失败、5 秒全零 timeout、Target/Document 漂移，并逐项断言 failure proof 保留六组 rejection/native cause/revision；其点击后的完整 DONE 只能来自同一 mutation coherent packet，额外 DOM observation 为零。推理矩阵必须覆盖 0..4 exact high、exact Pro、adaptive Pro，0..2 exact high、exact Pro unavailable 零动作、adaptive Pro resolved high/degraded=true；每个成功格覆盖 already-selected 零动作与一条 bounded keypress，未知 max 1/3/5、min 非零、current 越界、缺字段、多义、disabled、Target/Document/revision drift 与后置不等全部失败关闭，并逐字段证明 requested/policy/observed/resolved/degraded 与唯一 evidence readback 一致。`open_gpt_attachment_control` 必须覆盖入口 `0 -> 1` hydration、页面全局隐藏旧节点存在但活动 scope 为零、点击后唯一活动 scope 内 raw 多叶子而 exact eligible=1、其它叶子全部 `TEXT_MISMATCH`、scope/leaf/入口 partial conflict 立即失败、5 秒全零 timeout、Target/Document 漂移，并断言最多一次点击、同一 mutation coherent packet、点击后额外 DOM observation 为零及候选 rejection/native cause/revision 保真；相应 mutants 必须让删除 scope、恢复 `choiceRaw===1`、恢复 immediate-zero-fail、删除 deadline/document guard 或增加第二读回全部失败。Product→GPT 附件输入必须排除 `providerDisplayName`，GPT→Browser attach 必须携带 GPT 派生的该精确名称与源码冻结的 active-menu scope/visible upload leaf/exact text；同一业务文件在不同 attempt 获得不同但确定的精确 `providerDisplayName`；一个 UTF-8 ZIP 仍只产生一次 file-input mutation，其内必须机械证明唯一可见上传叶子点击一次、唯一 chooser 事件与 exact `#upload-files` backend node 一致、仅一次 `DOM.setFileInputFiles`、成败都关闭 interception，并证明 direct hidden-input、chooser 超时重试、backend-node 错配与第二上传路径均不可达；GPT Child 不读取 ZIP entry；同 attempt 已有 verified `CONFIRMED` attach 时 materializer 与 file-input 增量都为零；页面其它位置出现附件名称、唯一 composer 内卡片缺失/隐藏/no-layout、精确卡片仍含可见 spinner 时都不得成功且不得产生 mutation；stale 丢弃旧 nodeId 后必须从 composer、exact cards 与 scoped spinners 完整重查，畸形 CDP payload 才返回 `BROWSER_DOM_READ_INVALID`，Product timeout 超过 60 秒时不得被公共 Child 截短；唯一 composer、全部且仅有精确可见卡片与零 scoped spinner 成立后必须立即进入 `write_exact_gpt_prompt`，exact prompt readback 后只允许一次 submit，file-input、prompt fill 与 submit mutation 分别恰为一次。Prompt 在提交前被页面清空或改写时不得点击；marker 外层 user 容器即使混入附件卡片、文件名与展开/收起文字，canonical rendered-prompt hash 仍等于原 composer prompt，inline code 反引号与正文尾换行被保留且只删除一个投影根分隔换行，正文自身漂移则失败；conversation-history 提示覆盖缺席、唯一、重复、多 root、标题/按钮漂移和按钮禁用；submission reconcile 必须覆盖 DOM candidate missing/ambiguous/stale 后 fresh read成功、真正 Target/Document 失效原样失败、且两者 submit mutation 增量均为零；submission-locator artifact 按 exact identity 幂等写读并在切换会话、进程重启后仍返回原定位事实；fresh 首轮在 continuation、checkpoint 与 locator 均缺失时，必须用同一 accepted attempt 的 exact confirmed receipt 保持原 evidence pending，在原 Target/Document source-only reconcile且 submit 为零；locator closed 后才恢复原 URL，locator 损坏/多义或原 Document 消失时仍保持同 attempt且 submit 为零；exact submit CONFIRMED 后分别注入 DOM typed cause、BROWSER_TARGET_INVALID、BROWSER_DOCUMENT_INVALID、channel fault、wait timeout、进程重启与 attempt cap 已满，全部保持同一 accepted attempt 和原 confirmed submit、再次 submit 为零，只有 Provider terminal negative/业务撤权/confirmed-submit receipt 或该 submit 的 initial exact-call evidence 损坏或多义结束恢复资格，submission-locator 缺失/损坏/多义不得冒充该终止条件；文本/image checkpoint、frontier origin/current、lane release、DISPATCHED 不重放、跨 Target generation mutation 禁重做、每 invocation probeDeadlineAt 有限且 park/reacquire 不刷新、后续同 attempt invocation 可取得新 budget、terminalAt 不作全局寿命及原生 cause 保真仍按前述合同证明。

上述附件验收中，“零 scoped spinner 后进入 Prompt”的表述必须同时满足同一 coherent observation 内零可见 `button.cursor-wait` pending action；必须覆盖“卡片与 ready 图标已经出现、spinner 为零但 `cursor-wait` 仍存在”时继续 fresh observe，直到该忙态消失才启动 `write_exact_gpt_prompt`，全程附件、Prompt 与 submit mutation 配额均不增加。
