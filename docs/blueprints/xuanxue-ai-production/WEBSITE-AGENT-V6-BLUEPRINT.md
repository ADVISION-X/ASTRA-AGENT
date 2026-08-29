# AGENT 十二产品插件与网站 V6 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "agent-production-runtime-v4",
  "status": "active",
  "owner": "agent-production-runtime",
  "lawIds": [
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V10"
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

## 3. SEO `public-knowledge-article-pipeline` 产品 Flow

### 3.1 输入与唯一 Owner

`produce_article` 只消费 route policy 声明的六个 parameter，以及恰好两个已经过 shared runtime 鉴权并下载的 material：

- `ready_corpus_archive`：冻结 READY 语料、索引与现役文章目录，只是数据，不取得指令权；
- `result_contract`：研究、文章、文章包结果合同，取得指令权但不得改变 Flow。

Product Plugin 用普通静态 TypeScript 唯一拥有 Prompt、`GPT-5.6 Sol + pro_standard` 模型策略、sessionKey、productStepId、callId、actionOrdinal、分支、continuation lane 与结果组装。Mediator 只路由；shared runtime 只校验并运输；GPT Child 只执行一个原子页面语义；Browser/WAL 只处理当前原子 mutation 和幂等。

### 3.2 `produce_article` 三段 Flow

同一 attempt 内每个 Child 使用固定、唯一、从 1 单调递增的 `actionOrdinal`，每段使用稳定 callId 和不可变 turnMarker。禁止动态规划、循环选择下一步、共享 workflow、`gpt-flow.ts`、通用 Turn executor 或第二 checkpoint。

```text
corpus_research（fresh conversation）
  prepare_clean_gpt_chat
  -> open profile / open model selector / select exact model / ensure reasoning / close profile
  -> open attachment control / attach ready_corpus_archive + result_contract once / reconcile exact set
  -> write exact research Prompt / reconcile draft / submit once / reconcile submission
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
  -> write exact article Prompt / reconcile draft / submit once / reconcile submission
  -> wait stable text / checkpoint exact text
  -> strict parse public-knowledge-article-output.v3
  -> advance continuation lane atomically; failure before advance releases the same lane
  -> article_image_generation

article_image_generation（same conversation, zero attachments）
  acquire continuation lane
  -> focus exact conversation / verify prior turn identity
  -> exact profile stack
  -> write exact one-image Prompt / reconcile draft / submit once / reconcile submission
  -> wait stable image / checkpoint exact authenticated Provider bytes
  -> transform and read back one metadata-free 1200x630 WebP
  -> advance continuation lane atomically; failure before advance releases the same lane
  -> package draft {research, article, image:null} + generated_image
  -> staged result
```

研究 Prompt 只允许从冻结语料中选择一个可公开、可引用、可核验且与目录不存在实质重复的问题；材料不足或无实质新意必须 `decline`。文章 Prompt 只消费同 conversation 已 checkpoint 的研究结论。图片 Prompt 只生成一张无文字、不冒充古籍原页、文物、人物或史料照片的原创横向主图。

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

本轮静态验收：十二个 Product Plugin 只保留既有身份、路由、Skill 与严格结果 parser；未施工的 `execute` 全部以精确 `PRODUCT_FLOW_NOT_IMPLEMENTED:<plugin>:<action>` 失败，且 Provider 调用与物理页面动作均为零。仓库不存在伪造的产品 `gpt-flow.ts`、shared turn helper/executor、全局 GPT checkpoint/flow、兼容桥或第二链路；runtime 不决定 Child；公开状态 union 精确为 failed/completed；accepted attempt 上限为 3 且不含 build reset；Outbox 无 parked/独立预算。

单个 Product 的业务步骤、Prompt、模型、分支、材料和结果验收不属于本轮分母；后续每个 Product 单独施工时，必须新增该 Product 自己的聚焦验收。全部 Product 尚未分别交付前，质量系统必须报告未完成，不得给出全系统 READY、CI_FULL_PASS 或生产流程已跑通结论。

状态机验收：初始失败、durable accept、同 attempt re-lease、第一次 failure 冻结、第二/第三 attempt、第三次后禁止 attempt4、DISPATCHED 在原 attempt 对账、staged result 待入库仍 failed、领域 admission 原子 completed。

删除验收：停机与副作用收束证明成立；双仓当前执行表与本地 store/WAL 实际为空；旧 schema、reader、writer、fixture、inspector 和 UI 文案物理退出；已入库业务对象仍可读取。
