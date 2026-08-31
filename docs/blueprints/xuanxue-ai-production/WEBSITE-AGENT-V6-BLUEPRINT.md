# AGENT 十二产品插件与网站 V6 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "agent-production-runtime-v6",
  "status": "active",
  "owner": "agent-production-runtime",
  "lawIds": [
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V15"
  ],
  "contractRefs": [
    "docs/specs/agent-production-runtime/agent-plugin-capability-manifest.provider.spec.json",
    "docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json",
    "docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json"
  ],
  "dependencyEdges": [
    {"contractRef":"docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json","from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"ai-acceptance","repo":"ADVISION-X/xuanxue-web"}},
    {"contractRef":"docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json","from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"ai-acceptance","repo":"ADVISION-X/xuanxue-web"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"app-shell-ui","repo":"local"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"architecture-boundary","repo":"local"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"forensics-persistence-capability","repo":"local"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"gpt","repo":"local"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"local-app-shell","repo":"local"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"runtime-log-spine","repo":"local"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"startup-entrypoint","repo":"local"}}
  ],
  "prohibitedDependencyEdges": []
}
```

## 1. 唯一主链

```text
Website business task
  -> V6 claim / lease / fence
  -> shared runtime durable accept
  -> Mediator 路由一次
  -> 唯一 Product Plugin 的普通 TypeScript Flow
  -> ProductGptTools.execute(one Child) / 其它原子 Capability
  -> observed DOM HTML + deterministic semantic text 双 hash task-owned artifact
  -> Product base receipt + one lossless normalization
  -> staged business result
  -> durable Outbox completion intent
  -> Website domain consumer admission
  -> completed + admission receipt
```

网站是业务任务、公开状态、结果合同和领域入库的唯一 Owner。AGENT Product Plugin 是产品内部 Flow 的唯一 Owner。shared runtime 只拥有 transport 与副作用安全，不得决定下一个 GPT Child。

## 2. 十二个 Product Plugin

| Plugin | primary product/action |
|---|---|
| `bazi-chart-interpretation` | `bazi_chart_interpretation/produce` |
| `bazi-ai-full-analysis` | `bazi_ai_full_analysis/produce` |
| `bazi-report-followup` | `bazi_report_followup/followup` |
| `qimen-professional-answer` | `qimen_professional_answer/produce` |
| `qimen-report-followup` | `qimen_report_followup/followup` |
| `hehun-ai-analysis` | `hehun_ai_analysis/produce` |
| `hehun-report-followup` | `hehun_report_followup/followup` |
| `naming-bazi-analysis-and-naming` | `naming_bazi_analysis_and_naming/produce` |
| `naming-from-existing-bazi-report` | `naming_from_existing_bazi_report/produce` |
| `public-knowledge-article-pipeline` | `public_knowledge_article_pipeline/produce_article` |
| `localization-production` | `localization_report_translation/report_translation`; `localization_article_translation/article_translation` |
| `payment-screenshot-observation` | `payment_screenshot_observation/observe` |

每个 primary 的 `accuracy_challenge` 与 `quality_reflection` 路由回同一 Product Plugin，不新增 Plugin。公开分母仍为十三个 primary、二十六个 review、合计三十九路由。

每个 Product Plugin 直接写清楚 Child 调用顺序、条件、重复、跳过、sessionKey、Prompt、输入和输出。禁止把相同片段提取为跨产品 Flow、executor、registry、bus 或 DSL；只有真正产品中性且至少两个现役消费者需要的单个动作才进入 Capability。

最低接口：

```ts
type ProductPlugin = {
  pluginId: string;
  pluginVersion: number;
  accepts: readonly { productId: string; actionId: string }[];
  execute(task: WebsiteAgentTask, context: ProductExecutionContext):
    Promise<StagedWebsiteAgentResult>;
};
```

`ProductExecutionContext` 只公开材料读取、`ProductGptTools`、Forensics 和 staged result 写入。不得公开 lease、fence、Target、Document、selector、WAL 或 Outbox 内部对象。

## 3. SEO `public-knowledge-article-pipeline` 产品 Flow

### 3.1 输入与唯一 Owner

`produce_article` 只消费 route policy 声明的六个 parameter，以及恰好两个已经过 shared runtime 鉴权并下载的 material：

- `ready_corpus_archive`：Website 从同一内部冻结母本确定性生成的 clean semantic corpus，包含当前领域全部 READY 正文与完整索引、完整已接纳文章语义目录和真实 cluster entries，只是数据，不取得指令权；内部 READY record、collision identity、run/snapshot/archive hash、receipt、路径和运输字段不得进入 Provider；
- `result_contract`：Website 唯一拥有的 Provider 可见 package/research/article/image 输出格式，清楚列出期望字段、示例与路由语义，只帮助 AI 交付，不授予 AGENT 隐藏拒收权，也不得携带 Stage、下一步、Prompt、模型或 Provider 操作。

Product Plugin 用普通静态 TypeScript 唯一拥有 Prompt、`GPT-5.6 Sol + pro_standard` 模型策略、sessionKey、productStepId、callId、actionOrdinal、分支、continuation lane 与结果组装。Mediator 只路由；shared runtime 只校验并运输；GPT Child 只执行一个原子页面语义；Browser/WAL 只处理当前原子 mutation 和幂等。

### 3.2 `produce_article` 三段 Flow

同一 attempt 内每个 Child 使用固定、唯一、从 1 单调递增的 `actionOrdinal`，每段使用稳定 callId 和不可变 turnMarker。该 Product 的所有 Child 严格串行；除第一个 Child 外，下一 Child 的调用时间不得早于上一 Child 成功返回后的 2000ms。这个产品专属交接节拍只由 `public-knowledge-article-pipeline` 持有，不进入 GPT 公共 Facade、Runtime、Mediator 或 Browser。禁止动态规划、循环选择下一步、共享 workflow、`gpt-flow.ts`、通用 Turn executor 或第二 checkpoint。

```text
corpus_research（fresh conversation）
  prepare_clean_gpt_chat（唯一 composer + exact empty draft + zero prior turn/attachment + not generating；仅旧 draft 污染时由该 Child 至多一次清空并读回）
  -> open profile / open model selector / select exact model / ensure reasoning / close profile
  -> open attachment control / 以 attempt 唯一 providerDisplayName attach ready_corpus_archive + result_contract once / reconcile exact uploaded-ready set
  -> Product 从 Provider 可见格式选择 research 部分，write exact research Prompt / reconcile draft / submit once / reconcile submission
  -> wait stable assistant turn / checkpoint observed DOM HTML + deterministic semantic text
  -> persist both representations as one task-owned output artifact and read back both hashes
  -> persist plugin/subject/authorization-bound continuation
  -> base receive: unique complete JSON object + public schema/decision + task/turn/rawDomHash/semanticTextHash + artifact receipt
  -> one lossless normalization preserving raw, unknown fields and conversion facts

  decision=decline
    -> package {research, article:null, image:null}
    -> staged result

  decision=proceed
    -> article_synthesis

article_synthesis（same conversation, zero attachments）
  acquire continuation lane
  -> focus exact conversation / verify prior turn identity
  -> exact profile stack
  -> Product 从 Provider 可见格式选择 article 部分，write exact article Prompt / reconcile draft / submit once / reconcile submission
  -> wait stable assistant turn / checkpoint observed DOM HTML + deterministic semantic text
  -> persist both representations as one task-owned output artifact and read back both hashes
  -> base receive + one lossless normalization
  -> advance continuation lane atomically; failure before advance releases the same lane
  -> article_image_generation

article_image_generation（same conversation, zero attachments）
  acquire continuation lane
  -> focus exact conversation / verify prior turn identity
  -> exact profile stack
  -> write exact one-image Prompt（只请求基于已完成文章的一张横向主图）/ reconcile draft / submit once / reconcile submission
  -> wait stable image / checkpoint exact authenticated Provider bytes
  -> transform and read back one metadata-free 1200x630 WebP
  -> advance continuation lane atomically; failure before advance releases the same lane
  -> package draft {research, article, image:null} + generated_image
  -> staged result
```

`exact profile stack` 的顺序唯一固定为 `open_gpt_execution_profile -> open_gpt_model_selector_v2 -> select_exact_gpt_model_v2 -> ensure_exact_gpt_reasoning_tier -> close_gpt_execution_profile`。模型选择之后才对最终推理档位做直接 readback；不得使用推理在前、模型在后或任何等价顺序。

研究 Prompt 只允许从冻结语料中选择一个可公开、可引用、可核验且与目录不存在实质重复的问题；材料不足或无实质新意必须 `decline`。文章 Prompt 只消费同 conversation 已 checkpoint 的研究结论。图片 Prompt 只请求基于同 conversation 已完成文章的一张横向主图，不在程序中复制创意限制。

### 3.3 SEO 两条复核 Flow

`accuracy_challenge` 与 `quality_reflection` 各自开启独立 fresh conversation，只挂载 route policy 已鉴权的 `subject_result + review_context`，执行一次 exact profile、附件、Prompt、submission 与 text checkpoint；原文先进入 task-owned output artifact，再以同一基础机器边界接收并作唯一无损归一。它们不得复用 `produce_article` 的材料、conversation、continuation 或 mutation identity，不得改写文章、发布内容或替网站裁决 finding。

### 3.4 结果、失败与未施工产品

每个成功 Child 的 Forensics ref 按真实执行顺序进入 `evidence_refs`；真实外部 Child failure 原样抛出，不以字符串猜测重试。AI 输出不得因额外字段、字段顺序、string 与单元素 string[]、枚举、空值、数量、Markdown、引用闭包或内容质量被 AGENT 拒收；不能无损归一时保留同一任务、raw artifact/ref/hash 与 conversation，等待 Website 授权格式重出，不重做业务研究。Plugin 只交付 staged article package 与 staged generated image；Website domain consumer 负责领域投影、幂等入库并签发 hash-bound receipt 后才 completed。发布、URL、canonical、sitemap、索引提交、分发和搜索成效始终只属于 Website。

除 `public-knowledge-article-pipeline` 外，其余尚未单独施工的 Product `execute` 必须继续立即返回 `failed + PRODUCT_FLOW_NOT_IMPLEMENTED:<plugin>:<action>`，Provider 调用和物理页面动作均为零。该失败是唯一主链 fail-closed，不是兼容桥或第三状态。

## 4. shared runtime 的窄职责

shared runtime 只负责以下运输、安全与恢复边界：

- 单一 worker/session/attestation；
- claim、lease、renew、fence 与 abort；
- 第一次 durable accept 的运输确认，以及 Website accepted-attempt 计数回执的原样消费与透传；
- material authorization 和精确输入身份；
- Browser/Provider dispatch budget 与 WAL 协调；
- staged result 和 durable Outbox；
- typed failure 透传与容量释放。

Mediator 只解析 `product_id + action_id + contract version` 并路由一次。Catalog 只列出静态 Plugin 与 route，不执行 Flow。

runtime 不持有 `GPT_TURN_FLOW`、全局 GPT 状态、shared prompt assembly、stepIndex、resumePoint、flowVersion、reconcileOnly 或固定 pacing。Prompt 语义由 Product Plugin 构造，runtime 只提供已授权材料事实，具体 Child 只把本次 exact Prompt 写入页面。

### 4.1 智慧的唯一形态

AGENT 不新建中央 Scheduler、优先级 Traffic Arbiter、恢复状态机、graph、planner 或第二队列。智慧只体现为“谁当下有资格执行一个 Browser 动作”：

```text
未到 nextCheckAt / 尚在 Provider 等待
  -> 不进 Browser FIFO

已到检查时间且需要 exact Browser probe/mutation
  -> 进入现役唯一有界严格 FIFO

normal / inspection / recovery
  -> 同一 FIFO，没有 priority、抢占或旁路
```

Runtime 只持有 lease/deadline/abort、durable attempt binding、Outbox 和容量释放；Product 自己决定下一个 Child，Browser 只决定物理 dispatch 是否安全。

### 4.2 Effect Identity、顺序与 pluginVersion

exact GPT call identity 唯一为：

```text
job_id + attempt_id + plugin_id + plugin_version
+ product_step_id + call_id + child_id + input_hash
```

`actionOrdinal` 是 Product 静态顺序证明，不进入 effect/evidence logical identity。`pluginVersion` 必须从 durable plugin identity 贯穿 execution binding、Browser permit/MAC、Extension validator、WAL、recovery lookup 与日志身份。

Browser Owner 保留两种查询：

- `atomicStepRecovery`：先按完整 exact effect identity 查找唯一 mutation，再独立校验 actionOrdinal；
- `callRecoveryScope`：只用 job + current attempt + plugin + version + product step + provider scope 定位原 parked Target，结果多义必须失败关闭。

两者不得合并为宽匹配恢复查询。Target/Document、WAL row 和 Browser 私有 identity 不返回 Product。

### 4.3 `ProductGptTools.readCallFacts`

`ProductGptTools` 在 live `execute(one Child)` 之外只新增一个无 mutation 读面：

```ts
readCallFacts({ productStepId, callId, child, actionOrdinal, input }): Promise<{
  exactCallIdentityHash: `sha256:${string}`;
  mutation: null | {
    owner: "browser";
    effectScope: "target_local" | "provider_effect";
    outcome: "DISPATCHED" | "CONFIRMED" | "REJECTED";
    terminalAt: string | null;
  };
  evidence: null | {
    owner: "forensics-persistence";
    evidenceRef: string;
    evidenceHash: `sha256:${string}`;
    readbackVerified: true;
    artifactRefs: readonly string[];
  };
  continuation: null | {
    owner: "gpt-session-controller";
    continuationRef: string;
    conversationIdentityHash: `sha256:${string}`;
    priorPromptHash: `sha256:${string}`;
    priorResponseHash: `sha256:${string}`;
    laneVersion: number;
    contentReadbackVerified: true;
  };
}>;
```

job/attempt/plugin/version 由 durable execution binding 注入，inputHash 由同一 canonical hash 计算。该读面不写入、不安排任务、不返回 nextStep/resumePoint/phase/state/Target/Document/WAL row，也不提供无 durable Owner 的 per-call `failure`。真实外部 Child typed failure 冻结 Runtime `attempt_failure` 并结束 attempt；但 exact submit 已 CONFIRMED 后，只读 wait、reacquire 或 conversation readback 在 mutationOutcome=no 且不存在 Provider terminal negative/deadline expiry 时的软件故障，通过现役 lease release 写入 `release_reason=POST_SUBMIT_READBACK_FAULT` 与 `current_reason`，同一 attempt 重领后从 submit exact fact 继续，不写 `attempt_failure`、不接受新 attempt、不再次 submit。exact text checkpoint 后的接收、归一或组装软件故障同样沿同一 artifact 和 attempt 恢复。

### 4.4 Product-owned Progressive Exact Fact Replay

lease/process 重启后，Product 从自己的 `execute` 入口重走普通静态 TypeScript，但不盲目重做动作：

```text
读取当前可由 task + Product 静态事实完整构造 identity 的 facts
  -> 只读恢复/验证上游输出
  -> 得到下一 call 的动态 input
  -> 计算完整 inputHash
  -> 再读取下一 exact call facts
```

任何新 Browser mutation 前，Product 必须已渐进验证到当前边界，并先检查当前已能构造 identity 的不可逆 submit/upload 锚点。禁止为“入口全量 preflight”降级成 job + step + call 宽查询，也禁止 call descriptor registry、recovery graph 或 shared interpreter。

### 4.5 Target-local 跨代次边界

Target-local Browser mutation identity 另绑定 target generation，但 Forensics evidence identity 只绑定 exact GPT call identity。因此同 attempt 必须遵守：

- 已有 verified evidence 的 target-local call 不得在新 Target generation 重做物理 mutation；
- evidence 缺失但 Browser 已有 DISPATCHED/CONFIRMED/REJECTED 事实时仍不重发，只补核原事实与 evidence；
- 原 exact Target 可恢复时只读 rehydrate；原 Target 丢失或所需瞬态事实无法只读恢复时，当前 attempt typed fail-close；
- 只有 Website 安全接受新 attempt 且前 attempt 没有未收束 DISPATCHED 时，才能以新 identity 重新生产。

不新增 recoveryGeneration、evidenceVersion 或第二 evidence chain。

### 4.6 Forensics 与 Continuation 幂等

Forensics evidence key 必须为 `gpt-call-evidence:v1:<exactCallIdentityHash>`，artifact key 只在该 identity 后追加 `submission-locator/observed-response/original/webp` 等受控 suffix。`proof.evidenceHash` 只证明 proof 内容，不充当 logical call identity。同 key 异内容、多记录或完整性损坏必须失败关闭。`reconcile_gpt_turn_submission` 成功后、单一生产 Tab 让出时间片前，唯一 evidence writer 必须把 canonical URL + marker + user turn id + canonical rendered-prompt hash + conversation identity 写入并读回同 exact identity 的 task-owned submission-locator artifact；同 identity 重放先从该 artifact 返回原定位事实，不依赖当前 Tab 所在会话、不再次 submit，也不创建第二 locator store。Product 按固定 actionOrdinal 恢复并组装完整 evidence_refs。

`persist_gpt_continuation` 的 continuationRef 由 exact persist call identity 确定性派生；provider 内容必须包含 canonical conversation URL、turn marker、prior prompt hash、prior response hash 与 conversation identity。相同 binding/provider 内容 readback 返回原 ref，不同内容冲突失败。`advance/release` 同时支持正常 lane CAS 和 DB commit 后返回前崩溃的内容幂等 readback，不创建第二 continuation Owner。

同一 Website task 出现多次 attempt 时，Product 必须先用当前 durable attempt 计算 turn marker，再通过只读 `readContinuationForTurn(turnMarker)` 精确取得 continuation。现役查询只复用 `origin_job_id + plugin_id + prior_turn_marker`：零条返回 null，一条继续校验 owner/subject/authorization，并以 canonical URL + turn marker + prior prompt hash + prior response hash 验证 conversation identity，多条失败关闭；禁止 job-only、唯一一条或最新一条回退，旧 attempt continuation 不得混入当前 attempt。

### 4.7 Cooperative Provider Wait 与 park

wait Child 把最长等待拆为 fresh DOM 驱动的短 probe，条件满足立即返回，不以 sleep 或经过时间作为成功条件。每次 probe 后按当前 Provider 事实计算瞬时 `nextCheckAt`，未到时不进 FIFO，不持久化 wait ticket/table/nextCheckAt。

```text
absoluteDeadline
  = exact submit Provider effect 首次 CONFIRMED 的 immutable terminalAt
  + Product timeoutMs
```

Browser WAL 必须在现有 row 内冻结 terminalAt；可变 `updated_at` 不得刷新 deadline。normal Provider wait park 只在 effect 已 CONFIRMED、pending mutation 为零且恢复锚点完整时允许；DISPATCHED recovery park 保留原 Target/Document 与冻结后置判据。两者都撤销 claim/Workspace 并立即释放 FIFO。Extension parked registry 仍只在内存，service worker 丢失时 fail-close，不猜 tab 且不建第二 durable registry。

## 5. 二元任务与 attempt

Website job 只有两种状态：

```text
failed:
  current_reason        当前为何尚未交付，可替换
  attempt_failure       当前 attempt 第一次真实外部执行失败，不可变；可为空

completed:
  result_hash
  business_admission_receipt
```

初始任务为 `failed + current_reason=AWAITING_FIRST_ATTEMPT`。claim、lease、执行中、待发送、待消费、暂停、拒绝和需对账都不成为状态；它们只更新 `current_reason` 和对应权威记录。Website 的 accepted/progress write receipt 只证明运输接收与 attempt 已启动，UI 不得把 seq2 命名为研究完成或轮询进度；Provider 已提交、checkpoint、article_synthesis 与等待领域入库只能分别从现役 Runtime span、Browser WAL、task-owned artifact 与 consumer receipt 的安全投影显示，Runtime Log 不成为任务权威。

```text
lease grant != attempt
first durable accept -> accepted_attempt_count + 1
lease expiry/crash -> same attempt may re-lease
staged result OR first true external attempt_failure -> attempt ends
post-checkpoint receiver fault -> same attempt + same raw artifact resumes
post-submit readback software fault -> same attempt + confirmed submit fact resumes
accepted attempt budget/policy -> Website durable authority
```

Website 唯一决定 accepted attempt 预算、累计、next retry、故障片区停车与放行；AGENT、Outbox 与 Browser 不硬编码固定三次或其它次数，也不建立第二重试裁决。任何新真实 attempt 前都必须证明前 attempt 无未决 `DISPATCHED`；exact submit 已 CONFIRMED 后的只读软件故障保持原 accepted attempt，并由现役 lease release/current_reason 与 AGENT 本地 exact call facts 恢复，release reason 固定为 `POST_SUBMIT_READBACK_FAULT`，不新增状态、表、调度器或第二账本。已经 checkpoint 的 AI 产物因接收器软件故障不得增加 attempt 或重做 Provider mutation。

Website 的现役 `accepted_attempt_limit` 只是故障保险丝，不是任务终态。一次 attempt 以真实外部失败结束且 `accepted_attempt_count >= accepted_attempt_limit` 时，Website 仍保持 `status=failed`，只把现役 `current_reason.code` 原子替换为 `RECOVERY_PARKED` 并保留原 failure code；claim 暂停领取该 job，但 public run 不得继续显示为正在执行。唯一放行动作是现役 SEO Work Order 的系统级 `run` 事务：它只批量重新武装该 Work Order 下 `RECOVERY_PARKED + accepted_at=null + attempt_id=null + terminal_status=null` 的原 job，保留累计 `accepted_attempt_count`，只把 `accepted_attempt_limit` 原子提升到 `accepted_attempt_count + 1`，并写入现役事件/审计后等待一个新 attempt。不得提供单文章人工 retry，不得创建 replacement run/job、第三任务状态、第二 API、第二队列或第二停车表。

## 6. 调用与副作用身份

每个 GPT 调用由以下事实稳定标识：

```text
job_id + attempt_id + plugin_id + plugin_version
+ product_step_id + call_id + child_id + input_hash
```

同一业务 attempt 跨 lease/process/Target/build 不变；下一真实 attempt 使用新 identity。Target-local Browser mutation 另绑定 target generation，但 exact-call evidence identity 不绑 target generation；因此同 attempt 已有 verified evidence 的 target-local call 禁止跨代重做。前一 attempt 存在未决 `DISPATCHED` 时禁止接受下一 attempt。

Browser WAL 必须先于物理 mutation。Provider effect 的 once 语义限定在同一 business attempt/call；因此经确定失败结束的 attempt 可以在新 attempt 重新执行，而不会被旧全局 identity 假阻断。`DISPATCHED` 永不盲重放。

## 7. Outbox 与完成

Outbox 只保存：

```text
intent
idempotency_key
payload_hash
receipt
last_error
next_delivery_at
```

timeout/连接中断/5xx 沿同一 intent 有界退避；确定性合同或业务拒绝保存原生 code 并令 `next_delivery_at=null`。Outbox 没有 attempt 预算、parked 状态、任务状态或第二 verdict。

Website 启动和 claim 的数据库前置只使用现役 commercial migration registry。部署操作必须先由 canonical `db:migrate:commercial` 显式应用 0097；普通 `start.sh` 不执行 migration，只在创建 Core 前以现役只读 verify 路径机械证明仓库 migration head、数据库 registry 与每个 migration hash 一致。不一致必须输出精确 `COMMERCIAL_MIGRATION_*` 原因并停止 Core Ready、control-room 与 claim，不得让缺列退化成循环 HTTP 500。跨仓 HTTP 失败必须保留远端 code、HTTP status 与 `responsibleOwner=website`；AGENT 不得把 Website 失败改写为 production-runtime Owner。

AGENT staged result、Outbox delivered、Website completion submission 均不等于完成。Website domain consumer 以 `job_id + result_hash` 幂等入库并签发 hash-bound receipt 后，任务才原子变为 completed；此前保持 failed 并用 `current_reason` 表达当前位置。

## 8. 四个故障片区原位删除重构

本次只删除并重构四个现役故障片区：GPT wait/checkpoint 的 user-turn 正文识别、Runtime/Website 的 confirmed-submit 后 lease 收束、现役 continuation provider/verify 的 prior prompt identity，以及 Website commercial migration 准入与 accepted-attempt 停车/放行。AI 产物解析与接收片区由其独立施工保持，不在本次改写；当前 Website task、attempt、conversation、Outbox、Browser WAL 与已完成 Provider effect 均不得迁移、替换或清空。执行顺序固定：

1. 停止 SEO 故障片区新 claim，读取并收束 live lease 与未决 Provider effect；
2. 物理删除 wait/checkpoint 中对整个 user turn 聚合文本或正文 `textContent` 做 prompt hash 的旧实现及伪造 `readText=prompt` 的旧测试，在同一 Child 原位改为 marker 下唯一正文机器节点的 deterministic semantic tree，并只删除投影算法额外加入的一个根终止分隔换行；
3. 物理删除 confirmed submit 之后仍把只读软件故障写成 `attempt_failure` 并清除 attempt 的旧分支，在现役 lease release/current_reason 合同原位加入 `POST_SUBMIT_READBACK_FAULT`，由同一 attempt 重领并通过 exact call facts 跳过 submit；
4. 在 submission reconcile 原位绑定 expected prompt hash，并把 canonical URL + marker + user turn id + canonical rendered-prompt hash + conversation identity 写入同 exact-call 的 task-owned submission-locator artifact；同 identity 恢复先读该 artifact。在唯一 continuation provider 与现役 verify Child 原位保留 prior prompt hash，统一验证 canonical URL + marker + prior prompt/response hash，不建第二 store；
5. 在 Website 启动前原位复用 commercial migration registry verify；在 attempt failure 与现役 SEO Work Order `run` 事务原位完成 `RECOVERY_PARKED` 与原 job 批量放行，并把 control-room 的同一 PostgreSQL client 查询改为串行；不得新增迁移器、恢复 API、表或状态；
6. 删除与上述旧行为绑定的 fixture/inspector 断言，原位建立真实 DOM 污染、同 attempt 重领零重发、continuation 四元身份、migration head 失配拒绝启动和 exhausted job 原 identity 放行的聚焦验收；
7. 显式应用 0097、聚焦静态与真实 Chrome 证据通过后，才恢复该故障片区新 claim并验证 SEO 第二步与最终入库。

禁止 replacement job/run、legacy reader、备份回灌、alias、bridge、dual read/write、shadow、fallback、第二恢复链或第二结果真相。现有任务身份、失败史、Provider effect 与业务对象都保留。

## 9. 聚焦验收

本轮静态验收：十二个 Product Plugin 保留既有身份、路由与 Skill；GPT wait/checkpoint 只使用唯一请求正文节点的 canonical semantic prompt，submission reconcile 在单 Tab 让出前写读同 exact-call locator artifact，confirmed-submit 后只沿现役 lease release/current_reason 保持同 attempt，continuation 仍只有唯一 provider/store 并补齐 prior prompt hash。每个已开始 GPT Child span 即使在 Browser lease 获取、park 或 reacquire 失败也必须恰好产生一个 typed terminal，禁止悬空 span。未施工的 `execute` 继续以精确 `PRODUCT_FLOW_NOT_IMPLEMENTED:<plugin>:<action>` 失败，且 Provider 调用与物理页面动作均为零。runtime 不决定 Child；公开状态 union 精确为 failed/completed；attempt 预算只来自 Website 持久策略；`RECOVERY_PARKED` 只允许是 Website `current_reason`，现役 Work Order `run` 只批量放行原 job；Outbox 无 parked/独立预算；启动前 migration head/hash 必须闭合，control-room 单 client 无并发 query，Website HTTP failure 不丢失 Owner；本轮不修改 AI 产物解析与接收链。

单个 Product 的业务步骤、Prompt、模型、分支、材料和结果验收不属于本轮分母；后续每个 Product 单独施工时，必须新增该 Product 自己的聚焦验收。已施工的 SEO Product 聚焦验收必须分别对 produce_article 的 proceed/decline 与两条 review 路由按 actionOrdinal 断言 exact Child sequence，不得以“全部 Child 均曾出现”代替顺序证明。全部 Product 尚未分别交付前，质量系统必须报告未完成，不得给出全系统 READY、CI_FULL_PASS 或生产流程已跑通结论。

状态机验收：初始失败、durable accept、同 attempt re-lease、第一次真实外部 failure 冻结、Website 策略接受新 attempt、DISPATCHED 在原 attempt 对账、exact submit CONFIRMED 后只读软件故障以 `POST_SUBMIT_READBACK_FAULT` 释放且不写 failure/不增 attempt、重领不再次 submit、exact text checkpoint 后接收器故障不写 failure/不增 attempt、同 raw artifact 恢复、staged result 待入库仍 failed、领域 admission 原子 completed。进度验收必须证明 accepted/progress seq2 只显示 attempt 已启动，Provider submit、checkpoint、article_synthesis 与领域入库分层显示且各自来自对应现役 Owner。

智慧调度聚焦验收：无中央 Scheduler/priority/recovery bypass；唯一 FIFO 最多十个 waiter；未到 nextCheckAt 的 wait 不入队；normal/recovery 共用 FIFO；park 后其它 job 可继续；Progressive Exact Fact Replay 必须先恢复 wait 输出再构造 checkpoint/continuation inputHash，宽匹配 lookup 为零；readCallFacts 只读且无 failure/state/nextStep/Target/WAL 泄漏；pluginVersion 端到端，actionOrdinal 不进 effect/evidence identity。

恢复与幂等验收：Forensics exact-call append/readback 返回原 recordRef，同 key 异内容 fail-close，submission-locator 在单 Tab 已切换会话和进程重启后仍按 exact identity 返回原 URL/marker/user turn/prompt hash/identity 且 submit mutation count 不增加，重启前后 evidence_refs 完整有序；同 job 多 attempt 的 continuation 必须由当前 attempt turn marker 只命中当前一条，并以 URL + marker + prior prompt/response hash 复核，旧 marker、缺失 prior prompt hash 与未知 marker 不得回退；continuation persist/advance/release 覆盖 DB commit 与 return 之间崩溃；同 attempt 已有 verified evidence 的 target-local 新 Target generation mutation count 为零，原 Target 不可只读恢复则 attempt fail-close；Provider terminalAt 不可变，等待 55 分钟后重启不重获完整 timeout。

真实 Browser 验收：normal wait 每个短 probe 都必须完成 `同一 targetRef park -> 释放 FIFO -> 同一 targetRef reacquire -> Page.bringToFront -> fresh DOM probe`，扩展不得 close/detach 唯一 system Tab，不得出现 `BROWSER_CAPABILITY_REJECTED`、`BROWSER_TARGET_INVALID` 或悬空 Child span；至少三个并发业务任务在无人点击时仍只使用一个 system tabId/targetRef，并按 URL + marker + prompt/response hash 回到各自会话。DISPATCHED recovery park/reacquire、service worker 丢失 parked registry 后 typed fail-close、操作者页面零影响、同 attempt 禁跨代重做和唯一已鉴权媒体 bytes 链均必须在真实 Chrome/MV3 上成立；SEO 实测必须继续出现 `corpus_research -> article_synthesis`，不能用第一步有效回答或静态测试替代第二步证据。

删除验收：SEO 故障片区停止新 claim 且未决副作用收束；旧 user-turn 聚合正文/textContent 哈希、未持久 submission locator、post-submit 软件故障结束 attempt、缺少 prior prompt hash 的 continuation 以及对应 fixture/inspector 断言物理退出；当前 Website task、attempt、conversation、artifact/checkpoint、Outbox 与 Browser WAL 身份保持不变；不重新研究，最终由同一 task 取得领域入库回执。
