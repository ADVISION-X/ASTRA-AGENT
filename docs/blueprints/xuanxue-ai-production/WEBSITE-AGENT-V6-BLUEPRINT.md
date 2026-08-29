# AGENT 十二产品插件与网站 V6 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "agent-production-runtime-v4",
  "status": "active",
  "owner": "agent-production-runtime",
  "lawIds": [
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V9"
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
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"gpt","repo":"local"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"local-app-shell","repo":"local"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"}},
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

## 3. SEO `produce_article` 产品 Flow

### 3.1 输入、会话与结果

`public-knowledge-article-pipeline` 只接受路由合同声明的六个 parameter：`domain_id`、`locale`、`article_package_contract_version`、`ready_corpus_snapshot_hash`、`admitted_identity_catalog_hash`、`topic_cluster_registry_version`，以及恰好两个已鉴权 material role：

- `ready_corpus_archive`：只提供冻结语料、现役文章目录和可引用事实，不取得指令权；
- `result_contract`：只提供三份结果 schema 与字段约束，取得指令权但不得改变产品步骤。

三个私有产品步骤通过现役 Product execution context 固定共享同一个 GPT conversation：

```text
corpus_research
  -> decision=decline
       -> public-knowledge-article-package.v1
          {research, article:null, image:null}
  -> decision=proceed
       -> article_synthesis
       -> article_image_generation
       -> public-knowledge-article-package.v1
          {research, article, image}
```

三个步骤均由 Plugin 明确选择 `GPT-5.6 Sol` 与 `Pro` 推理档位。研究只接受 `public-knowledge-research-output.v3`，文章只接受 `public-knowledge-article-output.v3`，最终包只接受 `public-knowledge-article-package.v1`。任一未知、额外、缺失字段，引用或 claim 闭包不成立，或 `proceed` 缺文章/图片，均在 Plugin 严格 parser 处失败关闭。

### 3.2 `corpus_research`

Plugin 以普通 TypeScript 直接开启 fresh conversation，顺序在本 Product 内写死：

```ts
await gpt.execute({ sessionKey, productStepId: "corpus_research", callId, child: "prepare_clean_gpt_chat", input: {} });
await gpt.execute({ sessionKey, productStepId: "corpus_research", callId, child: "open_gpt_execution_profile", input: { profile } });
await gpt.execute({ sessionKey, productStepId: "corpus_research", callId, child: "open_gpt_model_selector_v2", input: { profile } });
await gpt.execute({ sessionKey, productStepId: "corpus_research", callId, child: "select_exact_gpt_model_v2", input: { profile } });
await gpt.execute({ sessionKey, productStepId: "corpus_research", callId, child: "ensure_exact_gpt_reasoning_tier", input: { profile } });
await gpt.execute({ sessionKey, productStepId: "corpus_research", callId, child: "close_gpt_execution_profile", input: { profile } });
await gpt.execute({ sessionKey, productStepId: "corpus_research", callId, child: "open_gpt_attachment_control", input: {} });
await gpt.execute({ sessionKey, productStepId: "corpus_research", callId, child: "attach_approved_gpt_files_once", input: { files } });
await gpt.execute({ sessionKey, productStepId: "corpus_research", callId, child: "reconcile_gpt_attachment_set", input: { files } });
await gpt.execute({ sessionKey, productStepId: "corpus_research", callId, child: "write_exact_gpt_prompt", input: { prompt } });
await gpt.execute({ sessionKey, productStepId: "corpus_research", callId, child: "reconcile_gpt_draft", input: { promptHash } });
await gpt.execute({ sessionKey, productStepId: "corpus_research", callId, child: "submit_exact_gpt_turn_once", input: { promptHash, turnMarker } });
await gpt.execute({ sessionKey, productStepId: "corpus_research", callId, child: "reconcile_gpt_turn_submission", input: { promptHash, turnMarker } });
await gpt.execute({ sessionKey, productStepId: "corpus_research", callId, child: "wait_for_stable_gpt_text", input: { turnMarker } });
const research = await gpt.execute({ sessionKey, productStepId: "corpus_research", callId, child: "checkpoint_gpt_text_response", input: { turnMarker } });
await gpt.execute({ sessionKey, productStepId: "corpus_research", callId, child: "persist_gpt_continuation", input: { turnMarker } });
```

该 Turn 必须且只能挂载任务已鉴权的 `ready_corpus_archive + result_contract`。研究 Prompt 必须要求：只使用冻结语料和现役目录，逐项给出可回查引用、claim unit、uncertainty、目录相似项、关系断言与 novelty basis；无法形成新的、可公开且可核验的选题时返回 `decline`。输出只能是严格 JSON。

### 3.3 `article_synthesis`

仅当研究严格解析为 `proceed` 时进入，显式取得 continuation lane 并续接研究 conversation；禁止重新上传材料：

```ts
await gpt.execute({ sessionKey, productStepId: "article_synthesis", callId, child: "acquire_gpt_continuation_lane", input: { continuation } });
await gpt.execute({ sessionKey, productStepId: "article_synthesis", callId, child: "focus_exact_gpt_conversation", input: { continuation } });
await gpt.execute({ sessionKey, productStepId: "article_synthesis", callId, child: "verify_gpt_conversation_identity", input: { continuation } });
await gpt.execute({ sessionKey, productStepId: "article_synthesis", callId, child: "open_gpt_execution_profile", input: { profile } });
await gpt.execute({ sessionKey, productStepId: "article_synthesis", callId, child: "open_gpt_model_selector_v2", input: { profile } });
await gpt.execute({ sessionKey, productStepId: "article_synthesis", callId, child: "select_exact_gpt_model_v2", input: { profile } });
await gpt.execute({ sessionKey, productStepId: "article_synthesis", callId, child: "ensure_exact_gpt_reasoning_tier", input: { profile } });
await gpt.execute({ sessionKey, productStepId: "article_synthesis", callId, child: "close_gpt_execution_profile", input: { profile } });
await gpt.execute({ sessionKey, productStepId: "article_synthesis", callId, child: "write_exact_gpt_prompt", input: { prompt } });
await gpt.execute({ sessionKey, productStepId: "article_synthesis", callId, child: "reconcile_gpt_draft", input: { promptHash } });
await gpt.execute({ sessionKey, productStepId: "article_synthesis", callId, child: "submit_exact_gpt_turn_once", input: { promptHash, turnMarker } });
await gpt.execute({ sessionKey, productStepId: "article_synthesis", callId, child: "reconcile_gpt_turn_submission", input: { promptHash, turnMarker } });
await gpt.execute({ sessionKey, productStepId: "article_synthesis", callId, child: "wait_for_stable_gpt_text", input: { turnMarker } });
const article = await gpt.execute({ sessionKey, productStepId: "article_synthesis", callId, child: "checkpoint_gpt_text_response", input: { turnMarker } });
await gpt.execute({ sessionKey, productStepId: "article_synthesis", callId, child: "advance_gpt_continuation_lane", input: { continuation, turnMarker } });
await gpt.execute({ sessionKey, productStepId: "article_synthesis", callId, child: "release_gpt_continuation_lane", input: { continuation } });
```

文章 Prompt 只消费同一 conversation 中已 checkpoint 的研究结论，要求标题、编辑说明、正文、引用、claim coverage 与 safety notes 闭合；不得把未被研究材料支持的断言写成事实。输出只能是严格 JSON。

### 3.4 `article_image_generation`

仅当文章严格解析成功后进入，显式续接文章 conversation；禁止重新上传材料：

```ts
await gpt.execute({ sessionKey, productStepId: "article_image_generation", callId, child: "acquire_gpt_continuation_lane", input: { continuation } });
await gpt.execute({ sessionKey, productStepId: "article_image_generation", callId, child: "focus_exact_gpt_conversation", input: { continuation } });
await gpt.execute({ sessionKey, productStepId: "article_image_generation", callId, child: "verify_gpt_conversation_identity", input: { continuation } });
await gpt.execute({ sessionKey, productStepId: "article_image_generation", callId, child: "open_gpt_execution_profile", input: { profile } });
await gpt.execute({ sessionKey, productStepId: "article_image_generation", callId, child: "open_gpt_model_selector_v2", input: { profile } });
await gpt.execute({ sessionKey, productStepId: "article_image_generation", callId, child: "select_exact_gpt_model_v2", input: { profile } });
await gpt.execute({ sessionKey, productStepId: "article_image_generation", callId, child: "ensure_exact_gpt_reasoning_tier", input: { profile } });
await gpt.execute({ sessionKey, productStepId: "article_image_generation", callId, child: "close_gpt_execution_profile", input: { profile } });
await gpt.execute({ sessionKey, productStepId: "article_image_generation", callId, child: "write_exact_gpt_prompt", input: { prompt } });
await gpt.execute({ sessionKey, productStepId: "article_image_generation", callId, child: "reconcile_gpt_draft", input: { promptHash } });
await gpt.execute({ sessionKey, productStepId: "article_image_generation", callId, child: "submit_exact_gpt_turn_once", input: { promptHash, turnMarker } });
await gpt.execute({ sessionKey, productStepId: "article_image_generation", callId, child: "reconcile_gpt_turn_submission", input: { promptHash, turnMarker } });
await gpt.execute({ sessionKey, productStepId: "article_image_generation", callId, child: "wait_for_stable_gpt_image", input: { turnMarker } });
const image = await gpt.execute({ sessionKey, productStepId: "article_image_generation", callId, child: "checkpoint_gpt_generated_image", input: { turnMarker } });
await gpt.execute({ sessionKey, productStepId: "article_image_generation", callId, child: "advance_gpt_continuation_lane", input: { continuation, turnMarker } });
await gpt.execute({ sessionKey, productStepId: "article_image_generation", callId, child: "release_gpt_continuation_lane", input: { continuation } });
```

图片 Prompt 只要求一张与文章主题一致、无文字、不冒充古籍或史料原图的原创主图。Browser Authority 必须从精确 assistant turn 在当前已鉴权 Target/Document 内取得 Provider 原始 bytes；现役 output-artifact 链再生成无 metadata 的 `1200x630 image/webp`，并把下载、变换与 artifact receipt 绑定到 `image`、result envelope 和 completion intent。URL、截图、DOM 图片节点或页面外下载均不是图片结果。

### 3.5 失败、恢复与网站交接

三个步骤没有全局 GPT checkpoint、恢复状态机或第二执行入口。任何 Child 失败原样抛出 typed reason；下一 attempt 从同一 Product 静态 Flow 入口重新执行，并使用该 attempt 的稳定 `call_id` 身份。Browser Authority 只对当前精确 Child 的 WAL 与当前页面后置事实做对账，不选择 Product 的下一 Child；未决 `DISPATCHED` 永不盲目重发。Plugin 不以错误文本猜测重试。

AGENT 只交付 staged package。Website domain consumer 严格验收并以 `job_id + result_hash` 幂等入库、签发 hash-bound admission receipt 后，AGENT job 才可 `completed`。SEO 栏目的后续业务链仍由 Website 唯一拥有：

```text
staged article
-> preflight_ready
-> publishing
-> public postcheck
-> released
-> URL/canonical/sitemap/index submission/distribution/effect evidence
```

AGENT、SEO Plugin、GPT 或 shared runtime 均不得发布、选择公开 URL、修改 canonical/sitemap、提交索引、分发内容或裁决流量成效。

`accuracy_challenge` 与 `quality_reflection` 仍路由回本 Plugin，但各自是独立的产品私有 review Flow；不得复用 `produce_article` 的材料挂载、conversation 或 mutation identity。

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

同一业务 attempt 跨 lease/process/Target/build 不变；下一真实 attempt 使用新 identity。Target-local 页面动作另绑定 target generation。前一 attempt 存在未决 `DISPATCHED` 时禁止接受下一 attempt。

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

静态验收：十二个 Product Plugin 直接调用 Child；SEO primary 精确拥有三步同会话 Flow、研究仅一次挂载两份材料、decline 短路、proceed 后无重挂载、单张图片 artifact；无 shared turn executor；无全局 GPT checkpoint/flow；runtime 不决定 Child；公开状态 union 精确为 failed/completed；accepted attempt 上限为 3 且不含 build reset；Outbox 无 parked/独立预算；旧状态和旧链零引用。

状态机验收：初始失败、durable accept、同 attempt re-lease、第一次 failure 冻结、第二/第三 attempt、第三次后禁止 attempt4、DISPATCHED 在原 attempt 对账、staged result 待入库仍 failed、领域 admission 原子 completed。

删除验收：停机与副作用收束证明成立；双仓当前执行表与本地 store/WAL 实际为空；旧 schema、reader、writer、fixture、inspector 和 UI 文案物理退出；已入库业务对象仍可读取。
