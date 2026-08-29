# AGENT 十二产品插件与网站 V6 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "agent-production-runtime-v6",
  "status": "active",
  "owner": "agent-production-runtime",
  "lawIds": [
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V12"
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
- `result_contract`：Website 唯一拥有的 complete declarative package/research/article/image contract，完整声明 exact fields、嵌套字段、枚举和闭包，只描述输出事实，不得携带 Stage、下一步、Prompt、模型或 Provider 操作。

Product Plugin 用普通静态 TypeScript 唯一拥有 Prompt、`GPT-5.6 Sol + pro_standard` 模型策略、sessionKey、productStepId、callId、actionOrdinal、分支、continuation lane 与结果组装。Mediator 只路由；shared runtime 只校验并运输；GPT Child 只执行一个原子页面语义；Browser/WAL 只处理当前原子 mutation 和幂等。

### 3.2 `produce_article` 三段 Flow

同一 attempt 内每个 Child 使用固定、唯一、从 1 单调递增的 `actionOrdinal`，每段使用稳定 callId 和不可变 turnMarker。该 Product 的所有 Child 严格串行；除第一个 Child 外，下一 Child 的调用时间不得早于上一 Child 成功返回后的 2000ms。这个产品专属交接节拍只由 `public-knowledge-article-pipeline` 持有，不进入 GPT 公共 Facade、Runtime、Mediator 或 Browser。禁止动态规划、循环选择下一步、共享 workflow、`gpt-flow.ts`、通用 Turn executor 或第二 checkpoint。

```text
corpus_research（fresh conversation）
  prepare_clean_gpt_chat（唯一 composer + exact empty draft + zero prior turn/attachment + not generating；仅旧 draft 污染时由该 Child 至多一次清空并读回）
  -> open profile / open model selector / select exact model / ensure reasoning / close profile
  -> open attachment control / 以 attempt 唯一 providerDisplayName attach ready_corpus_archive + result_contract once / reconcile exact uploaded-ready set
  -> Product 从完整合同选择 research 子合同，write exact research Prompt / reconcile draft / submit once / reconcile submission
  -> wait stable text / checkpoint exact text
  -> persist plugin/subject/authorization-bound continuation
  -> strict parse public-knowledge-research-output.v3

  decision=decline
    -> package {research, article:null, image:null}
    -> staged result

  decision=proceed
    -> article_synthesis

article_synthesis（same conversation, zero attachments）
  acquire continuation lane
  -> focus exact conversation / verify prior turn identity
  -> exact profile stack
  -> Product 从完整合同选择 article 子合同，write exact article Prompt / reconcile draft / submit once / reconcile submission
  -> wait stable text / checkpoint exact text
  -> strict parse public-knowledge-article-output.v3
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

`accuracy_challenge` 与 `quality_reflection` 各自开启独立 fresh conversation，只挂载 route policy 已鉴权的 `subject_result + review_context`，执行一次 exact profile、附件、Prompt、submission 与 text checkpoint，并严格解析 `website-agent-review-output.v1`。它们不得复用 `produce_article` 的材料、conversation、continuation 或 mutation identity，不得改写文章、发布内容或替网站裁决 finding。

### 3.4 结果、失败与未施工产品

每个成功 Child 的 Forensics ref 按真实执行顺序进入 `evidence_refs`；typed failure 原样抛出，不以字符串猜测重试。Plugin 只交付 staged article package 与 staged generated image；Website domain consumer 严格验收、幂等入库并签发 hash-bound receipt 后才 completed。发布、URL、canonical、sitemap、索引提交、分发和搜索成效始终只属于 Website。

除 `public-knowledge-article-pipeline` 外，其余尚未单独施工的 Product `execute` 必须继续立即返回 `failed + PRODUCT_FLOW_NOT_IMPLEMENTED:<plugin>:<action>`，Provider 调用和物理页面动作均为零。该失败是唯一主链 fail-closed，不是兼容桥或第三状态。

## 4. shared runtime 的窄职责

shared runtime 只负责以下运输、安全与恢复边界：

- 单一 worker/session/attestation；
- claim、lease、renew、fence 与 abort；
- 第一次 durable accept 与 accepted attempt 计数；
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
    laneVersion: number;
    contentReadbackVerified: true;
  };
}>;
```

job/attempt/plugin/version 由 durable execution binding 注入，inputHash 由同一 canonical hash 计算。该读面不写入、不安排任务、不返回 nextStep/resumePoint/phase/state/Target/Document/WAL row，也不提供无 durable Owner 的 per-call `failure`。当前 Child typed failure 直接冻结 Runtime `attempt_failure` 并结束 attempt。

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

Forensics evidence key 必须为 `gpt-call-evidence:v1:<exactCallIdentityHash>`，artifact key 只在该 identity 后追加 `original/webp` 等受控 suffix。`proof.evidenceHash` 只证明 proof 内容，不充当 logical call identity。同 key 异内容、多记录或完整性损坏必须失败关闭。Product 按固定 actionOrdinal 恢复并组装完整 evidence_refs。

`persist_gpt_continuation` 的 continuationRef 由 exact persist call identity 确定性派生；相同 binding/provider 内容 readback 返回原 ref，不同内容冲突失败。`advance/release` 同时支持正常 lane CAS 和 DB commit 后返回前崩溃的内容幂等 readback，不创建第二 continuation Owner。

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
  attempt_failure       当前 attempt 第一次真实执行失败，不可变；可为空

completed:
  result_hash
  business_admission_receipt
```

初始任务为 `failed + current_reason=AWAITING_FIRST_ATTEMPT`。claim、lease、执行中、待发送、待消费、暂停、拒绝和需对账都不成为状态；它们只更新 `current_reason` 和对应权威记录。

```text
lease grant != attempt
first durable accept -> accepted_attempt_count + 1
lease expiry/crash -> same attempt may re-lease
staged result OR first attempt_failure -> attempt ends
accepted_attempt_count <= 3
```

第三个 attempt 失败后仍为 `failed + exact reason`。系统只能在该 job 的安全事实改变后继续处理，不能创建第四个 attempt。若第三次已有 `DISPATCHED` 未决 effect，只能在第三 attempt 内对账收束。

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

timeout/连接中断/5xx 沿同一 intent 有界退避；确定性合同或业务拒绝保存原生 code 并令 `next_delivery_at=null`。Outbox 没有三次预算、parked 状态、任务状态或第二 verdict。

AGENT staged result、Outbox delivered、Website completion submission 均不等于完成。Website domain consumer 以 `job_id + result_hash` 幂等入库并签发 hash-bound receipt 后，任务才原子变为 completed；此前保持 failed 并用 `current_reason` 表达当前位置。

## 8. 空数据删除式切换

本次切换不迁移当前任务或 runtime 状态。执行顺序固定：

1. 停止新 claim；
2. 收束所有 live lease 与 Provider effect，所有 `DISPATCHED` 必须得到 confirmed/rejected 或明确阻断；
3. 物理删除 Website 当前 AI task/runtime/attempt/outbox 数据；
4. 物理删除 AGENT 当前 job/attempt/checkpoint/旧 Outbox/对应旧 Browser WAL；
5. 启用只含二元状态和新 attempt/call identity 的空 schema；
6. 恢复 claim，仅接受新任务。

已由 Website domain consumer 入库的报告、文章、翻译、付款观察等业务对象保留；若存在旧 task 外键，切换前解除或改为不依赖执行记录。禁止数据迁移、legacy reader、备份回灌、alias、bridge、dual read/write、shadow 或第二链路。

## 9. 聚焦验收

本轮静态验收：十二个 Product Plugin 只保留既有身份、路由、Skill 与严格结果 parser；未施工的 `execute` 全部以精确 `PRODUCT_FLOW_NOT_IMPLEMENTED:<plugin>:<action>` 失败，且 Provider 调用与物理页面动作均为零。仓库不存在伪造的产品 `gpt-flow.ts`、shared turn helper/executor、全局 GPT checkpoint/flow、兼容桥或第二链路；runtime 不决定 Child；公开状态 union 精确为 failed/completed；accepted attempt 上限为 3 且不含 build reset；Outbox 无 parked/独立预算。

单个 Product 的业务步骤、Prompt、模型、分支、材料和结果验收不属于本轮分母；后续每个 Product 单独施工时，必须新增该 Product 自己的聚焦验收。已施工的 SEO Product 聚焦验收必须分别对 produce_article 的 proceed/decline 与两条 review 路由按 actionOrdinal 断言 exact Child sequence，不得以“全部 Child 均曾出现”代替顺序证明。全部 Product 尚未分别交付前，质量系统必须报告未完成，不得给出全系统 READY、CI_FULL_PASS 或生产流程已跑通结论。

状态机验收：初始失败、durable accept、同 attempt re-lease、第一次 failure 冻结、第二/第三 attempt、第三次后禁止 attempt4、DISPATCHED 在原 attempt 对账、staged result 待入库仍 failed、领域 admission 原子 completed。

智慧调度聚焦验收：无中央 Scheduler/priority/recovery bypass；唯一 FIFO 最多十个 waiter；未到 nextCheckAt 的 wait 不入队；normal/recovery 共用 FIFO；park 后其它 job 可继续；Progressive Exact Fact Replay 必须先恢复 wait 输出再构造 checkpoint/continuation inputHash，宽匹配 lookup 为零；readCallFacts 只读且无 failure/state/nextStep/Target/WAL 泄漏；pluginVersion 端到端，actionOrdinal 不进 effect/evidence identity。

恢复与幂等验收：Forensics exact-call append/readback 返回原 recordRef，同 key 异内容 fail-close，重启前后 evidence_refs 完整有序；continuation persist/advance/release 覆盖 DB commit 与 return 之间崩溃；同 attempt 已有 verified evidence 的 target-local 新 Target generation mutation count 为零，原 Target 不可只读恢复则 attempt fail-close；Provider terminalAt 不可变，等待 55 分钟后重启不重获完整 timeout。

真实 Browser 验收：normal wait park/reacquire 、DISPATCHED recovery park/reacquire、service worker 丢失 parked registry 后 typed fail-close、操作者页面零影响、同 attempt 禁跨代重做和唯一已鉴权媒体 bytes 链均必须在真实 Chrome/MV3 上成立。

删除验收：停机与副作用收束证明成立；双仓当前执行表与本地 store/WAL 实际为空；旧 schema、reader、writer、fixture、inspector 和 UI 文案物理退出；已入库业务对象仍可读取。
