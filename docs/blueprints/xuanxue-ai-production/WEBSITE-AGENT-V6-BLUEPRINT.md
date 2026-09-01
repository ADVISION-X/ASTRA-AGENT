# AGENT 十二产品插件与网站 V12 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "agent-production-runtime-v11",
  "status": "active",
  "owner": "agent-production-runtime",
  "lawIds": [
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V23"
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

`produce_article` 只消费 route policy 声明的六个 parameter，以及恰好一个已经过 shared runtime 鉴权并下载的 material：

- `ready_corpus_archive`：Website 从同一内部冻结母本确定性生成的一份无密码、无分卷、无嵌套压缩包的 UTF-8 ZIP，media type 为 `application/zip`；每本 READY 古籍位于独立 NFC 目录，原文 Markdown 与完整索引 JSON 分别保持 frozen packet 原字节，完整文章目录与 current-domain cluster 分别为独立 JSON entry。ZIP 只是 `classical_source_data`，不取得指令权；AGENT、GPT Child 与 Browser 不解压、不解释 entry，也不建立第二份材料清单。

Website 仍唯一拥有 route policy 内 Provider 可见的 package/research/article/image canonical `result_contract`，但它不再作为第二 material 上传。Product Plugin 只把当前 research/article 回合所需的同源子合同写入 exact Prompt；该格式只帮助 AI 交付，不授予 AGENT 隐藏拒收权，也不得携带 Website Stage、下一步、模型或 Provider 操作。

Product Plugin 用普通静态 TypeScript 唯一拥有 Prompt、`GPT-5.6 Sol + pro_standard` 模型策略、sessionKey、productStepId、callId、actionOrdinal、分支、continuation lane 与结果组装。Mediator 只路由；shared runtime 只校验并运输；GPT Child 只执行一个原子页面语义；Browser/WAL 只处理当前原子 mutation 和幂等。

### 3.2 `produce_article` 三段 Flow

同一 attempt 内每个 Child 使用固定、唯一、从 1 单调递增的 `actionOrdinal`，每段使用稳定 callId 和不可变 turnMarker。该 Product 的所有 Child 严格串行；除第一个 Child 外，下一 Child 的调用时间不得早于上一 Child 成功返回后的 2000ms。这个产品专属交接节拍只由 `public-knowledge-article-pipeline` 持有，不进入 GPT 公共 Facade、Runtime、Mediator 或 Browser。禁止动态规划、循环选择下一步、共享 workflow、`gpt-flow.ts`、通用 Turn executor 或第二 checkpoint。

```text
corpus_research（fresh conversation）
  Product 以带字段名和 domain separator 的 canonical object 计算 frontier_ref
  -> readContinuationExact({lookupKind:"frontier_ref", frontierRef})；命中则同时验证并读回 immutable origin provider/checkpoint 与 current provider/checkpoint，恢复 origin research 并物理跳过本段全部 Child，零条才进入 fresh 路径
  prepare_clean_gpt_chat（唯一 composer + exact empty draft + zero prior turn/attachment + not generating；仅旧 draft 污染时由该 Child 至多一次清空并读回）
  -> open profile / open model selector / select exact model / ensure reasoning / close profile
  -> open attachment control / 以 attempt 唯一 providerDisplayName attach 唯一 ready_corpus_archive ZIP once / reconcile exact uploaded-ready set（本 Product 固定 timeoutMs=600000；条件满足立即返回，重启不延长）
  -> Product 从 Provider 可见格式选择 research 部分，write exact research Prompt / reconcile draft / submit once / reconcile submission
  -> wait stable assistant turn / checkpoint observed DOM HTML + deterministic semantic text
  -> persist both representations as one task-owned output artifact and read back both hashes
  -> persist plugin/subject/authorization-bound continuation，并在该首次 persist 的同一 DB 事务内将已计算 frontier_ref + origin provider + observed-response artifact receipt 原子首绑到同一 row
  -> base receive: unique complete JSON object + public schema/decision + task/turn/rawDomHash/semanticTextHash + artifact receipt
  -> one lossless normalization preserving raw, unknown fields and conversion facts

  decision=decline
    -> package {research, article:null, image:null}
    -> staged result

  decision=proceed
    -> article_synthesis

article_synthesis（same conversation, zero attachments）
  若 current checkpoint 已是完整 article text receipt，则从同一 task-owned artifact 读回文章双表示并物理跳过本段全部 Provider Child，直接进入 article_image_generation
  -> 否则 acquire continuation lane
  -> focus exact conversation / verify prior turn identity
  -> exact profile stack
  -> Product 从 Provider 可见格式选择 article 部分，write exact article Prompt / reconcile draft / submit once / reconcile submission
  -> wait stable assistant turn / checkpoint observed DOM HTML + deterministic semantic text
  -> persist both representations as one task-owned output artifact and read back both hashes
  -> base receive + one lossless normalization
  -> advance continuation lane 时在同一 CAS 原子写 current provider + article text checkpoint receipt；acquire 后从 provider compare、focus、verify 到 advance 的任一失败都在同一 finally 释放原 lane/version
  -> article_image_generation

article_image_generation（same conversation, zero attachments）
  acquire continuation lane
  -> focus exact conversation / verify prior turn identity
  -> exact profile stack
  -> write exact one-image Prompt（只请求基于已完成文章的一张横向主图）/ reconcile draft / submit once / reconcile submission
  -> 在紧邻请求的 exact assistant section 等待生成停止与唯一语义主图；不要求内层 assistant role 节点或非空文本
  -> checkpoint exact authenticated Provider bytes；三个或更多 raw img 渲染节点只要最终恰有一个完整、可见、非空 alt 的语义主图就不得被误拒
  -> transform and read back one metadata-free 1200x630 WebP
  -> advance continuation lane 时在同一 CAS 原子写 current provider + original/webp artifact checkpoint receipt；acquire 后任一失败都在同一 finally 释放原 lane/version
  -> package draft {research, article, image:null} + generated_image
  -> staged result
```

`exact profile stack` 的顺序唯一固定为 `open_gpt_execution_profile -> open_gpt_model_selector_v2 -> select_exact_gpt_model_v2 -> ensure_exact_gpt_reasoning_tier -> close_gpt_execution_profile`。模型选择之后才对最终推理档位做直接 readback；不得使用推理在前、模型在后或任何等价顺序。

Product Skill 只保留跨回合共同成立的产品目的、冻结来源边界、事实约束、接收原则和共同输出内核；`seo-turn-contract.ts` 只保留 research/article/image 各自当回合真正需要的字段与动作要求。每个 fresh conversation 的首个 Prompt 只组合一次共同内核与一次首回合合同；同 conversation 的 article/image 续接 Prompt 只组合一次各自当回合合同，不得重复整份 Skill，也不得建立第二 Prompt/Flow 真相。

研究 Prompt 只允许从冻结语料中选择一个可公开、可引用、可核验且与目录不存在实质重复的问题；材料不足或无实质新意必须 `decline`。文章 Prompt 只消费同 conversation 已 checkpoint 的研究结论。图片 Prompt 只请求基于同 conversation 已完成文章的一张横向主图，不在程序中复制创意限制。

### 3.3 SEO 两条复核 Flow

`accuracy_challenge` 与 `quality_reflection` 各自开启独立 fresh conversation，只挂载 route policy 已鉴权的 `subject_result + review_context`，执行一次 exact profile、附件、Prompt、submission 与 text checkpoint；原文先进入 task-owned output artifact，再以同一基础机器边界接收并作唯一无损归一。它们不得复用 `produce_article` 的材料、conversation、continuation 或 mutation identity，不得改写文章、发布内容或替网站裁决 finding。

### 3.4 结果、失败与未施工产品

当前 attempt 每个成功 Child 的 Forensics ref 按真实执行顺序进入 `evidence_refs`；跨 attempt 已恢复完成段只纳入逐项重验后的 terminal checkpoint evidenceRef，不伪造旧 attempt 的中间前缀。真实外部 Child failure 原样抛出，不以字符串猜测重试。AI 输出不得因额外字段、字段顺序、string 与单元素 string[]、枚举、空值、数量、Markdown、引用闭包、文本缺席于图片 turn 或内容质量被 AGENT 拒收；不能无损归一时保留同一任务、raw artifact/ref/hash 与 conversation，等待 Website 授权格式重出，不重做业务研究。corpus_research frontier 一经首绑就成为同一 Website task 的单调事实：后续真实 Child failure 可以诚实结束当前 attempt，但下一安全 attempt 进入同一 Product execute 时必须先按 exact frontier_ref 验证并读回 immutable origin 与 current provider/checkpoint。Product 先从已验证 origin research artifact 恢复 decision：`decline` 零 Provider mutation直接组装 `{research,article:null,image:null}`；只有 `proceed` 才以最远 current checkpoint 机械恢复 article 或 generated image artifact，再由自己的静态 TypeScript 进入下一未完成段。fresh research、decline，以及已完成 article/image 的 attach/write/submit 计数必须为零。Plugin 只交付 staged article package 与 staged generated image；Website domain consumer 负责领域投影、幂等入库并签发 hash-bound receipt 后才 completed。发布、URL、canonical、sitemap、索引提交、分发和搜索成效始终只属于 Website。

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

### 4.3 `ProductGptTools` 的两个只读事实面

`ProductGptTools` 在 live `execute(one Child)` 之外保留两个无 mutation 读面：

```ts
readCallFacts({ lookupKind?: "current_attempt" | "task_exact_effect", productStepId, callId, child, actionOrdinal, input }): Promise<{
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

readContinuationExact(query:
  | { lookupKind: "turn_marker"; turnMarker: string }
  | { lookupKind: "frontier_ref"; frontierRef: `sha256:${string}` }
): Promise<null
  | { lookupKind: "turn_marker"; lane: GptContinuationLane }
  | {
      lookupKind: "frontier_ref";
      continuationRef: string;
      originProvider: GptProviderContinuation;
      originCheckpoint: {
        sourceAttemptId: string;
        assistantTurnId: string;
        artifactRef: string;
        rawDomHtml: string;
        rawDomHash: `sha256:${string}`;
        semanticText: string;
        semanticTextHash: `sha256:${string}`;
        canonicalConversationUrl: string;
        promptHash: `sha256:${string}`;
        turnMarker: string;
        evidenceRef: string;
        evidenceHash: `sha256:${string}`;
      };
      currentProvider: GptProviderContinuation;
      currentCheckpoint:
        | {
            checkpointKind: "text";
            sourceAttemptId: string;
            assistantTurnId: string;
            artifactRef: string;
            rawDomHtml: string;
            rawDomHash: `sha256:${string}`;
            semanticText: string;
            semanticTextHash: `sha256:${string}`;
            canonicalConversationUrl: string;
            promptHash: `sha256:${string}`;
            turnMarker: string;
            evidenceRef: string;
            evidenceHash: `sha256:${string}`;
          }
        | {
            checkpointKind: "generated_image";
            sourceAttemptId: string;
            assistantTurnId: string;
            canonicalConversationUrl: string;
            promptHash: `sha256:${string}`;
            mediaHash: `sha256:${string}`;
            turnMarker: string;
            originalArtifactRef: string;
            originalSha256: `sha256:${string}`;
            originalBytes: Uint8Array;
            webpArtifactRef: string;
            webpSha256: `sha256:${string}`;
            webpBytes: Uint8Array;
            mediaType: "image/webp";
            width: 1200;
            height: 630;
            evidenceRef: string;
            evidenceHash: `sha256:${string}`;
            predecessorTextCheckpoint: {
              sourceAttemptId: string;
              assistantTurnId: string;
              artifactRef: string;
              rawDomHtml: string;
              rawDomHash: `sha256:${string}`;
              semanticText: string;
              semanticTextHash: `sha256:${string}`;
              canonicalConversationUrl: string;
              promptHash: `sha256:${string}`;
              turnMarker: string;
              evidenceRef: string;
              evidenceHash: `sha256:${string}`;
            };
          };
    }
>;
```

job/plugin/version 由 durable execution binding 注入，inputHash 由同一 canonical hash 计算；默认 `current_attempt` 还注入当前 attempt。`task_exact_effect` 只允许 Product 在已验证 current checkpoint 后，为其可完整构造且 marker/prompt hash 均由该 checkpoint 的 source attempt 冻结的 successor Provider effect 使用：同一读面从 Store 的同 job durable accepted attempt 分母逐一重算完整 exact identity，只接受零或唯一 mutation/evidence 闭合候选，零条返回 current-attempt 空事实，多条失败；禁止返回 attempt 列表、latest/created_at 选择、近似 step/call 搜索或让 shared runtime 决定是否继续。`readCallFacts` 不写入、不安排任务、不返回 nextStep/resumePoint/phase/state/Target/Document/WAL row，也不提供无 durable Owner 的 per-call `failure`。product-neutral `readContinuationExact` 只接受互斥的 exact turn-marker/frontier-ref query 且严禁互相 fallback；frontier 模式必须用当前 job/plugin/owner/subject/authorization 复核唯一 continuation row，并从 task-owned artifact 实体无损读回 immutable origin 与 current checkpoint，分别重算文本双 hash或 original/webp content hash 后，与各自 provider/conversation identity 一次返回。`originalBytes/webpBytes` 是现役 task-owned artifact 的调用期 readback，不进入 continuation row、日志或 proof；Product 只可用它恢复同一 generated image artifact，现役 completion/outbox 直接验证并持久化这些 bytes，禁止重新物化临时路径、启动后清空可恢复成果或新增 materialize 能力。禁止只返回 hash/ref 或已推进 provider 后让 Product 猜测已完成段，也禁止新增 SEO 专用公共读面、job-only/latest/created_at 选择、跨主体复用或 frontier 覆盖。

真实外部 Child typed failure 通常冻结 Runtime `attempt_failure` 并结束 attempt；唯一不可被该规则覆盖的是已经闭合的 Provider submit 事实。exact submit 的 Browser WAL mutation 与 Forensics evidence 已共同读回 `CONFIRMED + passed` 后，后续 `reconcile_gpt_turn_submission`、Provider wait 或 checkpoint 的失败必须同时携带两层正交事实：原 `confirmed_submit` receipt 永久保持 `outcome=CONFIRMED`，当前只读 Child 保持自己的 `code + mutationOutcome=no`。只要不存在 Provider 明确 terminal negative、Website 永久业务撤权、submit evidence 损坏或多义，Runtime 就必须通过现役 lease release 写入 `release_reason=POST_SUBMIT_READBACK_FAULT` 与 `current_reason`，保留同一 accepted attempt、原 exact call identity、terminalAt、conversation/frontier 和恢复资格；cause code、Target/Document 故障、wait absoluteDeadline 或进程重启只能决定诊断、一次 probe 的停止与 `retry_not_before`，绝不能把已确认提交降格成整体 mutation_outcome=no、写 attempt_failure、消耗新 attempt 或触发 RECOVERY_PARKED。重领后 Product 先读 exact submit fact，唯一 CONFIRMED 时跳过 image profile/prompt/draft/submit，直接执行 submission locator、原 turn wait/checkpoint 与成果入库；DISPATCHED/REJECTED/多义仍失败关闭，只有零 submit fact 才允许首次提交。全链复用现役 receipt/current_reason/lease release/task_exact_effect，不增加恢复状态、表、队列、scheduler 或第二结果真相。

### 4.4 Product-owned Progressive Exact Fact Replay

lease/process 重启后，Product 从自己的 `execute` 入口重走普通静态 TypeScript，但不盲目重做动作：

```text
读取当前可由 task + Product 静态事实完整构造 identity 的 facts
  -> 只读恢复/验证上游输出
  -> 得到下一 call 的动态 input
  -> 计算完整 inputHash
 -> 再读取下一 exact call facts
```

跨 attempt 的唯一例外不是宽查询：Product 必须先从 verified current checkpoint 取得 source attempt，并用它冻结 successor Provider effect 的 marker 与 prompt hash；随后只对该完整 call 使用 `task_exact_effect`。shared runtime 只返回零或唯一 exact mutation/evidence 事实，不返回 attempt 历史、不解释步骤；Product 见唯一 CONFIRMED submit 就物理跳过 profile/prompt/draft/submit，直接在原 conversation 对相邻 assistant turn 做只读 reconcile/wait/checkpoint，见零事实才允许当前 attempt 首次提交，见 DISPATCHED、REJECTED、多义或身份不闭合均失败关闭。

任何新 Browser mutation 前，Product 必须已渐进验证到当前边界，并先检查当前已能构造 identity 的不可逆 submit/upload 锚点。禁止为“入口全量 preflight”降级成 job + step + call 宽查询，也禁止 call descriptor registry、recovery graph 或 shared interpreter。

### 4.5 Target-local 跨代次边界

Target-local Browser mutation identity 另绑定 target generation，但 Forensics evidence identity 只绑定 exact GPT call identity。因此同 attempt 必须遵守：

- 已有 verified evidence 的 target-local call 不得在新 Target generation 重做物理 mutation；
- evidence 缺失但 Browser 已有 DISPATCHED/CONFIRMED/REJECTED 事实时仍不重发，只补核原事实与 evidence；
- 原 exact Target 可恢复时只读 rehydrate；原 Target 丢失或所需瞬态事实无法只读恢复时，未确认或 DISPATCHED effect typed fail-close且不得猜测/重发；
- exact Provider submit 已由 Browser WAL + Forensics 唯一证明 `CONFIRMED + passed` 是上述 fail-close 的明确例外：Website 保留同一 accepted attempt，Browser 只通过现役 acquisition 建立新的合法 system Target/Document，GPT 再用 task-owned submission-locator 的 canonical conversation URL + marker + prompt hash + conversation identity 只读重证原 turn；全部 Provider mutation 增量必须为零；
- 只有不存在可恢复的 confirmed effect、Website 安全接受新 attempt 且前 attempt 没有未收束 DISPATCHED 时，未完成的新 Provider effect 才能以新 identity 首次生产；任何已 confirmed effect 不得重新生产。

不新增 recoveryGeneration、evidenceVersion 或第二 evidence chain。

### 4.6 Forensics 与 Continuation 幂等

initial evidence 为 pending 时只允许失败关闭 completed-result replay，不把未决事实晋升为成功。同一 exact identity 的 Browser WAL 或 session CAS 仍为 `DISPATCHED` 时，仅允许原 attempt 沿原 Target/Document 或原 session CAS 做只读/幂等对账；对账取得 `passed` 或 `failed` 后，唯一 evidence writer 以 `gpt-call-terminal-evidence:v1:<exactCallIdentityHash>` append-only 写一次终态结算，唯一读面优先 terminal、缺失才读 initial。再次 pending 不写结算；禁止覆盖 initial、刷新 identity、由新 attempt 对账，或增加第二 writer、table、verdict。

Forensics evidence key 必须为 `gpt-call-evidence:v1:<exactCallIdentityHash>`，artifact key 只在该 identity 后追加 `submission-locator/observed-response/original/webp/generated-image-receipt` 等受控 suffix。`proof.evidenceHash` 只证明 proof 内容，不充当 logical call identity。同 key 异内容、多记录或完整性损坏必须失败关闭。`reconcile_gpt_turn_submission` 成功后、单一生产 Tab 让出时间片前，唯一 evidence writer 必须把 canonical URL + marker + user turn id + canonical rendered-prompt hash + conversation identity 写入并读回同 exact identity 的 task-owned submission-locator artifact；同 identity 重放先从该 artifact 返回原定位事实，不依赖当前 Tab 所在会话、不再次 submit，也不创建第二 locator store。当前 attempt 实际完成的每个 Child ref 按固定 actionOrdinal 进入 `evidence_refs`；跨 attempt 已恢复完成段只纳入各段经 artifact/hash 重验的 terminal checkpoint evidenceRef，不伪造或重建旧 attempt 的中间前缀 ref，也不新增 Evidence Manifest。

`persist_gpt_continuation` 的 continuationRef 由首次 exact persist call identity 确定性派生；provider 内容必须包含 canonical conversation URL、turn marker、prior prompt hash、prior response hash、source attempt、observed-response artifact receipt 与 conversation identity。SEO Product 在调用首次 persist 前已计算 deterministic frontier_ref；该次 persist 必须在一个 DB 事务内同时插入 continuation row、frontier_ref、immutable origin provider/checkpoint 与同内容的 current provider/checkpoint，禁止 persist 后再 bind。同一 row 的 lane advance 必须以一个 CAS 同时更新 current provider + current checkpoint receipt 并释放 lane，origin 永远不变；current text receipt 绑定 observed-response artifact，current generated-image receipt 绑定 original/webp 两个 task-owned artifact，并在同一 receipt 内绑定其同 conversation 直接前驱 text checkpoint receipt，保证最远图片事实仍可机械恢复成文；该嵌套 receipt 不构成 checkpoint 链、第二状态或流程语义。row 只存 receipt/hash 而不存 artifact bytes。相同 binding/provider/checkpoint/frontier 内容 readback 返回原 ref，同 frontier 不同 continuation 或 artifact 必须失败关闭；首次 persist 或 advance 在 DB commit 后、return 前崩溃时必须按同内容幂等读回原 ref。调用者从 acquire 成功开始就建立一个覆盖 provider compare、conversation focus/verify、Profile、Prompt、wait、checkpoint 与 advance 的 try/finally；只有 advance 已幂等确认才跳过 release，其余全部失败出口以原 lane/version 执行 release，不创建第二 continuation Owner。

同一 Website task 出现多次 attempt 时，普通 continuation 仍必须先用当前 durable attempt 计算 turn marker，再通过 product-neutral 只读 `readContinuationExact({lookupKind:"turn_marker", turnMarker})` 精确取得；现役 turn-marker 查询只复用 `origin_job_id + plugin_id + prior_turn_marker`，零条返回 null，一条继续校验 owner/subject/authorization，并以 canonical URL + turn marker + prior prompt hash + prior response hash 验证 conversation identity，多条失败关闭。SEO Product 仍复用同一读面的互斥 frontier-ref 模式，禁止互相 fallback。Product 在任何 fresh research Child 前计算且冻结：`frontier_ref=hashCanonical({identity_type:"gpt-continuation-frontier.v1",job_id:task.job_id,plugin_id:"public-knowledge-article-pipeline",owner_ref:task.business_identity.owner_ref,subject_ref:task.business_identity.subject_ref,authorization_ref:task.business_identity.authorization_ref,product_step_id:"corpus_research"})`。以 `readContinuationExact({lookupKind:"frontier_ref", frontierRef})` 只读精确命中首绑 row 并验证 immutable origin 与 current provider/checkpoint；命中后先恢复 research，再按 current checkpoint 的机械 artifact identity 恢复 article 或 generated image，并由 Product 静态 Flow 进入下一未完成调用。current checkpoint 不是 stage/nextStep/resumePoint，不允许 Session Controller 解释；禁止无字段名字符串拼接、job-only、唯一一条、最新一条、created_at 或旧 marker 回退。

### 4.7 Cooperative Provider Wait 与 park

wait Child 把最长等待拆为 fresh DOM 驱动的短 probe，条件满足立即返回，不以 sleep 或经过时间作为成功条件。每次 probe 后按当前 Provider 事实计算瞬时 `nextCheckAt`，未到时不进 FIFO，不持久化 wait ticket/table/nextCheckAt。

```text
absoluteDeadline
  = exact submit Provider effect 首次 CONFIRMED 的 immutable terminalAt
  + Product timeoutMs
```

Browser WAL 必须在现有 row 内冻结 terminalAt；可变 `updated_at` 不得刷新 deadline。normal Provider wait park 只在 effect 已 CONFIRMED、pending mutation 为零且恢复锚点完整时允许；DISPATCHED recovery park 保留原 Target/Document 与冻结后置判据。两者都撤销 claim/Workspace 并立即释放 FIFO。Extension parked registry 仍只在内存；MV3 actor 重建后仅以 Browser WAL 已知 `target-tab-<tabId>` 精确核验 `chrome.debugger.getTargets()` 中仍由本扩展持有 debugger、type=page、gpt-web Origin 的同一 tab，并以同 targetRef + 新 Document 重建内存 registry。它不得重新 attach、创建 Tab、按 URL/标题/顺序/聚焦页猜认或建立第二 durable registry；条件不闭合立即 `BROWSER_EXACT_TARGET_UNAVAILABLE`。DISPATCHED 仍须原 Document，不能使用重建的新 Document。

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
staged result OR first true external attempt_failure -> attempt ends; verified Product frontier remains task-bound
post-checkpoint receiver fault -> same attempt + same raw artifact resumes
post-submit readback software fault -> same attempt + confirmed submit fact resumes
next safe attempt with task frontier -> restore completed research; zero research Provider mutation
accepted attempt budget/policy -> Website durable authority
```

Website 唯一决定 accepted attempt 预算、累计、next retry、故障片区停车与放行；AGENT、Outbox 与 Browser 不硬编码固定次数，也不建立第二重试裁决。任何新真实 attempt 前都必须证明前 attempt 无未决 `DISPATCHED`。普通 attempt 保险丝只约束尚未发生或已明确 terminal negative 的新 Provider mutation；它没有资格阻断一个已有唯一 CONFIRMED submit 的只读成果取回。Website 收到闭合 `confirmed_submit` receipt 与当前 readback `mutation_outcome=no` 后，必须复用现役 `persistPostSubmitRelease` 语义保留原 `accepted_at + attempt_id`，释放 lease，写 `POST_SUBMIT_READBACK_FAULT` current_reason 与有界 `retry_not_before`，下一次 claim 仍返回同一 accepted attempt；cause code 和 readback deadline 不作为 admission allowlist。只有 Provider 明确 terminal negative、业务永久撤权、submit evidence 损坏/多义才能终止该成果恢复资格。已经 checkpoint 的 AI 产物因接收器软件故障同样不得增加 attempt 或重做 Provider mutation。若其它真实 Child failure 合法结束 attempt，Website 仍按既有策略接受下一 attempt；AGENT 的 Product frontier 只约束该 attempt 不得重做已完成 Provider turn。跨仓合同必须冻结“confirmed-submit 事实优先于 readback code/attempt cap”与永久撤权语义，双仓不得各写一份不同规则。

Website 的现役 `accepted_attempt_limit` 只是“是否允许创建新 Provider attempt/新 mutation”的故障保险丝，不是任务终态。只有不存在 confirmed effect 待读回、当前 accepted attempt 已因真实外部失败结束并清空 `accepted_at + attempt_id`，且 `accepted_attempt_count >= accepted_attempt_limit` 时，Website 才保持 `status=failed`，把现役 `current_reason.code` 原子替换为 `RECOVERY_PARKED` 并保留原 failure code；claim 暂停领取该 job，但 public run 不得继续显示为正在执行。confirmed-submit readback 必须保留非空 `accepted_at + attempt_id`，因此不得进入该停车条件。唯一放行动作仍是现役 SEO Work Order 的系统级 `run` 事务：它只批量重新武装真正满足 `RECOVERY_PARKED + accepted_at=null + attempt_id=null + terminal_status=null` 的原 job，保留累计 `accepted_attempt_count`，只把 `accepted_attempt_limit` 原子提升到 `accepted_attempt_count + 1`，并写入现役事件/审计后等待一个新 attempt。不得提供单文章人工 retry，不得创建 replacement run/job、第三任务状态、第二 API、第二队列或第二停车表。

### 5.1 SEO Work Order 永久撤权响应

Website 在现役 control intent 中返回 `cancel_requested` 且 `current_reason.code=PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED` 时，AGENT 将它解释为永久业务授权撤销，不是普通 pause 或可恢复 cancel。renew/readback 观察到该事实后，Runtime 设置本 attempt 的 abort signal，禁止开始任何新 Product Child、Browser/Provider/cloud mutation、checkpoint、artifact 或 terminal intent，并立即释放尚未取得的容量。若 Browser WAL 有未决 `DISPATCHED`，只允许用冻结的原 Target/Document 与后置判据作只读对账；不得重放、换 Target 或新建 attempt。对账收束后使用现役 lease release 回传删除确认与安全 evidence ref/hash，保留本地 WAL、task-owned checkpoint/artifact 和 receipts，但不写 `attempt_failure`、不 reclaim、不进入正常恢复。

Website 已确认的 accept/progress/checkpoint/completion receipt 只允许用原幂等键 readback；删除观察后不得产生新业务 mutation。已取得的真实活动 lease 在取消 lease-release 回执提交成功前仍占用该任务的业务槽，若 AGENT 离线则由 Website 在 lease 到期后释放；Runtime 不得提前报告该业务槽可用。取消回执成功后只释放该任务占用的业务槽、fence、Target、GPT continuation lane 与 Browser lane，其他任务继续。不得新增 cancellation store、delete queue、第三状态、replacement task/job、删除 worker 或第二协议；Website 仍唯一拥有 Work Order tombstone、领域成果和最终入库判断。

## 6. 调用与副作用身份

每个 GPT 调用由以下事实稳定标识：

```text
job_id + attempt_id + plugin_id + plugin_version
+ product_step_id + call_id + child_id + input_hash
```

同一业务 attempt 跨 lease/process/Target/build 不变；下一真实 attempt 使用新 identity。Target-local Browser mutation 另绑定 target generation，但 exact-call evidence identity 不绑 target generation；因此同 attempt 已有 verified evidence 的 target-local call 禁止跨代重做。前一 attempt 存在未决 `DISPATCHED` 时禁止接受下一 attempt。

Browser WAL 必须先于物理 mutation。Provider effect 的 once 语义限定在同一 business attempt/call；不存在 verified confirmed effect 时，经权威确定失败结束的 attempt 才可在 Website 接受的新 attempt 对尚未完成的 effect 使用新 identity 首次执行。已有唯一 `CONFIRMED + passed` receipt 的 effect 即使原 Target 丢失，也只能在同一 accepted attempt 的新合法 system Target/Document 上按 task-owned locator 只读回证，mutation 增量为零；不得被“新 attempt 新 identity”重新生产。`DISPATCHED` 永不盲重放。

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

Website 启动和 claim 的数据库前置只使用现役 commercial migration registry。部署操作必须先由 canonical `db:migrate:commercial` 显式应用 0097–0100；普通 `start.sh` 不执行 migration，只在创建 Core 前以现役只读 verify 路径机械证明仓库 migration head、数据库 registry 与每个 migration hash 一致。0100 只允许在无 live lease 时把 control protocol state 与 active device 的 manifest hash 从唯一 V11 预像原子旋转为代码生成的唯一 V12 hash、supersede 全部旧 worker session，并把 factory migration head 指向 0100；提交后必须读回 registry name/hash、control state hash、device hash 与旧 session superseded 四方闭合，禁止半切换或手工改数据库。不一致必须输出精确 `COMMERCIAL_MIGRATION_*` 原因并停止 Core Ready、control-room 与 claim，不得让缺列退化成循环 HTTP 500。跨仓 HTTP 失败必须保留远端 code、HTTP status 与 `responsibleOwner=website`；AGENT 不得把 Website 失败改写为 production-runtime Owner。

AGENT staged result、Outbox delivered、Website completion submission 均不等于完成。Website domain consumer 以 `job_id + result_hash` 幂等入库并签发 hash-bound receipt 后，任务才原子变为 completed；此前保持 failed 并用 `current_reason` 表达当前位置。

## 8. 当前故障片区原位删除重构

本次在同一唯一主链继续原位删除并重构四个已由真实 Chrome/日志证明的故障片区：图片 Child 把媒体-only assistant section 误判为空回答；continuation 只推进 provider 却没有同步推进 checkpoint；acquire 后 provider compare/focus/verify 失败绕过 release；任务局部 orphan lane 被全局 ledger 粗门放大成全部 claim 阻断。上一轮模型 radio 与 research frontier 的原位修复继续作为当前候选的一部分，不得回退。既有 MV3 actor、Provider wait、Browser 已鉴权原图链、Forensics、Outbox 与 Website 二元任务合同保持现役；当前 Website task、conversation、task-owned artifact、Browser WAL 与已完成 Provider effect 均不得迁移、替换或清空。本次为恢复同一已接受 task，`public-knowledge-article-pipeline` 的 pluginVersion=16、checkpointSchemaVersion=2 与 `SKILL.md` bytes/hash 固定不变；共同 Skill 只在 fresh research 或独立 review conversation 的首个 Prompt 组合一次，article/image 续接回合只组合各自 turn contract，禁止以版本升级或 Skill 改写制造 durable identity 冲突。执行顺序固定：

1. 先读取 Browser WAL 并确认没有 unresolved `PREPARED/DISPATCHED`，不得为施工盲重放或清理历史；
2. 在 `select_exact_gpt_model_v2` 片区物理删除已选中时点击 expanded entry 的分支；true/false 两种 `aria-checked` 都只点击唯一精确 radio，并以 popup + collapsed entry + active simple + zero advanced 形成一个直接后置合同；
3. 保留现役 `production_continuations` row 的 nullable unique frontier_ref 与 immutable origin provider/checkpoint receipt，在同一 row 垂直增加非空 current checkpoint receipt；新 row 首次 persist 时先证明 provider/checkpoint 成对且 current=origin。schema migration 只加列，禁止盲写 current；evidenceStore 可用后才对既有 frontier row 执行一次性 cutover：current provider 与 origin provider 完全相等也须读回 origin text artifact/evidence/hash 后复制；二者不等时，现役部署只允许在同 job/plugin 的 task-owned exact-call artifacts 中恰好找到一份 canonical URL、turn marker、prompt hash、response hash 与 current provider 全等的 article text checkpoint receipt后写入。旧 generated-image provider 因历史证据未持久直接前驱 text receipt不得伪造新 image receipt，只以精确 cutover code 阻断所属 task；零条、多条、hash 不等或 artifact 不可读同样 task-local fail-close，禁止从 origin 错配回填、回退 current provider、重做 Provider turn、保留 nullable/legacy reader或阻断其它 task；
4. 将 lane advance 物理重建为一个 CAS：同时写 current provider + current checkpoint receipt + lane_owner_job_id=null；text checkpoint receipt 绑定 observed-response artifact，generated-image checkpoint receipt 绑定 original/webp 两个 task-owned artifact并内嵌其同 conversation 直接前驱 text receipt，row 不保存正文或 bytes；
5. 在 `focusContinuation` 片区把 try/finally 边界前移到 acquire 成功的下一行，覆盖 expected provider compare、conversation focus、identity verify、Profile、Prompt、wait、checkpoint 与 advance；删除 compare 失败位于 finally 之外的旧结构，只有 advance 的 CAS/readback 已确认才不得 release；
6. 物理删除图片 wait/checkpoint 对 `[data-message-author-role='assistant']` 内层节点和非空 responseText 的依赖；以紧邻 user turn 的 exact `conversation-turn-*[data-turn='assistant']` section 为 turn Owner，只接受生成停止且恰好一个完整、可见、非空 alt 的语义主图，再把同一 semanticMediaId 交给现役 Browser 已鉴权 bytes 能力；
7. 在 ProductGptTools 现役 product-neutral continuation readback 上继续使用互斥的 exact turn-marker/frontier-ref query；frontier 模式一次验证并返回 immutable origin provider/checkpoint 与 current provider/checkpoint，current generated-image readback 从现役 task-owned artifact 重算 original/webp hash 后返回调用期 bytes，不返回 nextStep；
8. public-knowledge Product 在任何 fresh research Child 前查询 frontier；零条时沿现役路径首绑，命中时先恢复 origin research decision：decision=decline 时全部 Provider mutation为零并直接组装 `{research,article:null,image:null}`；只有 decision=proceed 才机械检查 current checkpoint，current=research 执行 article，current=article 直接恢复文章并用 article source attempt 冻结 image marker/prompt hash，再以 `task_exact_effect` 读取零或唯一既有图片 submit：唯一 CONFIRMED 时跳过全部 image profile/prompt/draft/submit 并只读原 turn，零条才首次提交，DISPATCHED/REJECTED/多义失败关闭；current=image 直接恢复同一图片 artifact并组装 staged result；两条 review 路由不使用 frontier；
9. ledger 对 orphan continuation lane 的判断改为 task-local：它只阻断所属 job 的 mutation，不能把全局 `ledger_reconciled` 置假；同一 job 获得新 accepted attempt 时继续复用现役 `releaseGptContinuationLanesForJob` 后再执行，不增加清理 worker、第二 ledger 或旁路 claim；
10. Runtime Log Spine 保留最内层 debugger detach/channel 原生 code + cause，claim 的安全 reason_codes 投影在脱敏后仍必须是机器允许的 code，禁止因脱敏值二次触发 `CLAIM_REQUEST_FAILED`，也禁止用 `BROWSER_INFRASTRUCTURE_FAILED` 覆盖原生原因；
11. 原位重建确定性验收和真实 Chrome 验收：真实图片 turn 为外层 assistant section、内层 assistant-role 节点为零、raw img 为三而唯一语义主图为一时，wait/checkpoint 必须成功并取得同一原始 bytes；同 task article 已 checkpoint 且上一 attempt 已 CONFIRMED image submit 后的新 attempt 通过唯一 `task_exact_effect` 直接只读原 image turn，research/article/image 的 attach/profile/prompt/draft/submit 增量均为零；零既有 image submit 时才允许当前 attempt 首次提交；每个 acquire 失败注入点 lane_owner 都回到 null，其它 job 仍可 claim。

禁止 replacement job/run、legacy reader、旧 continuation 猜选、备份回灌、alias、bridge、dual read/write、shadow、fallback、第二恢复链或第二结果真相。现有任务身份、失败史、Provider effect 与业务对象都保留；既有无 frontier 的历史 continuation 不自动取得新权威。已有 frontier row 的 current checkpoint 只能通过上述一次性精确 cutover 形成：provider 未推进才复制 origin，provider 已推进则必须唯一匹配现役 task-owned exact-call artifact，迁移完成后物理不存在 nullable/旧读路径。

## 9. 聚焦验收

本轮静态验收：十二个 Product Plugin 保留既有身份、路由与 Skill；Skill 共同内核只组合一次，research/article/image 差异只在 `seo-turn-contract.ts`，三份实际 Prompt 不再重复整份 Skill。SEO fresh 路径保留现有 actionOrdinal；frontier decision=decline 跳过 1-46 且零 Provider mutation直接组装，decision=proceed 时 current=research 跳过 1-16 而从 17 开始、current=article 跳过 1-31 而从 32 开始、current=image 跳过 1-46 并直接组装同一 artifact。GPT 模型选择的 checked true/false 两种分支都只点击唯一 radio，expanded entry 零点击，并直接证明 popup 保留、entry collapsed、simple active、advanced absent。GPT wait/checkpoint 只使用唯一请求正文节点的 canonical semantic prompt；image wait/checkpoint 直接使用 exact assistant section + semantic media，不依赖内层 assistant role/text；text/image wait 对唯一 conversation-history 提示在同一 exact call 内至多确认一次，submission reconcile 在单 Tab 让出前写读同 exact-call locator artifact。confirmed-submit 后任一非 Provider terminal-negative 的 readback failure 都沿现役 lease release/current_reason 保持同一 accepted attempt，错误码、deadline、Target/Document 或 attempt cap 不得降格 submit、写 failure 或重复 mutation；continuation 仍只有唯一 row/store，frontier、origin/current provider 与 checkpoint 都在该 row 原子维护。每个 acquire 后失败出口 lane_owner_job_id 都归零，每个已开始 GPT Child span 即使在 Browser lease 获取、park 或 reacquire 失败也必须恰好产生一个保留原生 cause 的 typed terminal。runtime 不决定 Child；公开状态 union 精确为 failed/completed；attempt 预算只来自 Website 持久策略；Outbox 无 parked/独立预算；AI 产物接收仍只作机械完整性与身份检查，不增加内容门槛。

本轮只把已施工 SEO Product 的模型选择与 task frontier 纳入业务分母；其它 Product 的业务步骤、Prompt、模型、分支、材料和结果验收仍不属于本轮分母。SEO 聚焦验收必须分别对 produce_article fresh proceed/decline、frontier-resume 与两条 review 路由按 actionOrdinal 断言 exact Child sequence，不得以“全部 Child 均曾出现”代替顺序证明。全部 Product 尚未分别交付前，质量系统必须报告未完成，不得给出全系统生产流程已跑通结论。

状态机验收：初始失败、durable accept、同 attempt re-lease、第一次真实外部 failure 冻结、Website 策略接受新 attempt、DISPATCHED 在原 attempt 对账、exact submit CONFIRMED 后分别注入 DOM candidate missing/ambiguous/stale、BROWSER_TARGET_INVALID、BROWSER_DOCUMENT_INVALID、channel fault、wait timeout、进程重启与 accepted-attempt-limit 已满，全部必须保存原 confirmed_submit、以 `POST_SUBMIT_READBACK_FAULT` 释放、保持同一 accepted attempt 可 claim、再次 submit mutation count 为零；只有 Provider 明确 terminal negative、业务永久撤权、submit evidence 损坏/多义允许结束该恢复资格。其余继续覆盖 research frontier 首绑/冲突、decline 零 mutation、current checkpoint 单调推进、acquire 后逐点 release、新执行恢复最远 text/image artifact、exact checkpoint 后接收器故障、任务局部隔离、staged result 待入库仍 failed、领域 admission 原子 completed。进度验收必须证明 accepted/progress seq2 只显示 attempt 已启动，Provider submit、checkpoint、article_synthesis、image 与领域入库分层显示且各自来自对应现役 Owner。

既有数据迁移验收必须构造 `origin provider/checkpoint=research + current provider=article + current_checkpoint=null` 的真实旧 row，并提供同 job/plugin 下唯一匹配 article current provider 四项身份/hash 的 task-owned exact-call artifact；cutover 后 current checkpoint 必须等于该 article receipt，下一 attempt 直接从 image ordinal 32 开始，research/article attach/write/submit 增量均为零。current provider 等于 origin 时必须先把 origin artifact/evidence/hash 读回验证再复制；旧 generated-image provider 缺直接前驱 receipt、唯一 artifact 缺失、多义或 hash 漂移时只阻断所属 task，provider/origin 均不得改变，其它 job claim 成功。正常 credential + stale lease 启动不得把精确 `GPT_CONTINUATION_CUTOVER_*` 原因覆盖成 `AGENT_PROCESS_RESTARTED`。

claim 日志验收必须证明 Website 返回合法安全 `reason_codes` 时，Runtime Log Spine 保存同一 allowlisted 机器码、claim span 只有一个真实 terminal，且 `CLAIM_REQUEST_FAILED` 事件增量为零；不安全自由文本仍在写前脱敏，但脱敏结果不得重新进入机器码校验并伪造第二失败。

智慧调度聚焦验收：无中央 Scheduler/priority/recovery bypass；唯一 FIFO 最多十个 waiter；未到 nextCheckAt 的 wait 不入队；normal/recovery 共用 FIFO；park 后其它 job 可继续；Progressive Exact Fact Replay 必须先恢复 wait 输出再构造 checkpoint/continuation inputHash，宽匹配 lookup 为零；readCallFacts 只读且无 failure/state/nextStep/Target/WAL 泄漏；pluginVersion 端到端，actionOrdinal 不进 effect/evidence identity。

恢复与幂等验收：Forensics exact-call append/readback 返回原 recordRef，同 key 异内容 fail-close，submission-locator 在单 Tab 已切换会话和进程重启后仍按 exact identity 返回原 URL/marker/user turn/prompt hash/identity 且 submit mutation count 不增加；当前 attempt 的真实 Child refs 按 ordinal 完整有序，跨 attempt 已恢复段只保留各段 verified terminal checkpoint ref。普通 continuation 仍由当前 attempt turn marker 精确读取，SEO task frontier 则只按确定性 frontier_ref 命中唯一首绑 row，重算 origin/current 文本双 hash或 original/webp image hash并验证对应 provider，旧无 frontier row、未知 ref、同 ref 异 artifact 和 owner/subject/authorization 漂移全部失败关闭；首次 persist 的 current=origin，advance 同一 CAS 更新 current provider/checkpoint 并释放 lane，persist/advance/release 覆盖 DB commit 与 return 之间崩溃；同 attempt 已有 verified evidence 的 target-local 新 Target generation mutation count 为零，原 Target 不可只读恢复时未确认/DISPATCHED effect fail-close；confirmed Provider submit 则必须保留同一 accepted attempt，在新合法 system Target/Document 按 submission-locator 只读回证且全部 Provider mutation 为零。Provider terminalAt 不可变，等待 55 分钟后重启不重获完整 timeout。

真实 Browser 验收：已选中的 `GPT-5.6 Sol` radio 与未选中 radio 都必须各只点击一次，expanded entry 点击后关闭 popup 的负例必须失败，正确动作须在 bounded DOM 条件满足时证明 popup 保留、entry collapsed、simple active、advanced absent。normal wait 每个短 probe 都必须完成 `同一 targetRef park -> 释放 FIFO -> 同一 targetRef 无聚焦 reacquire -> fresh DOM probe`，扩展不得主动 close/detach 唯一 system Tab；若真实异常 detach，最终失败必须保留浏览器原生 code/cause。SEO 必须使用真实 ChatGPT 图片 turn 实证：外层 exact assistant section 唯一、内层 `[data-message-author-role='assistant']` 为零、raw img 为三、唯一完整可见非空 alt 语义主图为一时，image wait/checkpoint 成功且 Browser receipt 的原图 hash/尺寸与该 semanticMediaId 一致。随后在 article 已 checkpoint 后制造下一 Child failure并由 Website 安全接受新 attempt；该 attempt 从 exact frontier 恢复原 research + article，research/article attach/write/submit WAL 增量全为零，直接进入 image。还必须在真实图片 submit 已唯一 `CONFIRMED + passed` 后物理关闭原 system Target或制造真实异常 debugger detach：Website 保留同一 accepted attempt，Browser 权威证明旧 Target 不存在后只建立一个 inactive 替代 system Target/Document，GPT 按 task-owned submission-locator 导航原 conversation 并重证原 user turn，research/article/image 的 attach/profile/prompt/draft/submit 增量全部为零，随后取回原图 bytes、生成 1200×630 WebP、checkpoint、staging，并由 Website 以同一 job 签发 business admission receipt。不能用图片肉眼存在、假 Browser fixture、第一步有效回答或静态测试替代上述证据。

删除验收：已选中分支的 expanded-entry mutation、把 popup 关闭误判为 simple panel 恢复的 fixture、新 attempt 无条件从 `produceResearchTurn` 发起 Provider mutation的旧消费者、图片 Child 的内层 assistant-role/text 门槛、advance 只写 provider 的旧 SQL、compare 位于 lane finally 之外的旧结构，以及 orphan lane 参与全局 ledger false 的粗门必须物理退出。十二个 Product 的既有路由和其他 Product Flow 保持不变；当前 Website task、conversation、artifact/checkpoint、Outbox 与 Browser WAL 身份保持不变，不重新提交任何已确认 turn，最终由同一 task 恢复最远 checkpoint 并取得领域入库回执。
