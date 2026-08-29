# AGENT 十二产品插件与网站 V6 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "agent-production-runtime-v4",
  "status": "active",
  "owner": "agent-production-runtime",
  "lawIds": [
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V8"
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

## 1. 唯一终态

网站是业务任务、业务结果合同、V6 运输、最终入库和发布的 Owner；AGENT 是执行工厂。AGENT 只有一个 shared production runtime、一个薄 Mediator、一个 Plugin Catalog、十二个 Product Plugin，以及一个 GPT 能力组、一个 GPT Session Controller、既有 Browser Authority、SQLite/WAL 和 Outbox。

```text
网站 business task + material refs
  -> V6 session / claim / lease / fence
  -> AGENT shared production runtime
  -> Mediator(product_id + action_id + contract version)
  -> 唯一 Product Plugin
  -> Product Plugin 自己的 Product Skill 与业务 Flow
  -> 唯一共享 GPT Turn 执行器恢复或推进一个产品中性 turn
  -> GPT 能力组或其它公共 Capability 的一个原子动作
  -> result artifact + execution evidence
  -> V6 completion submission CAS
  -> 网站 delivery_pending
  -> 唯一领域 consumer 入库、发布或交付并签发 hash-bound admission receipt
  -> AGENT 对账 receipt 后本地 completed
```

任何组件只要回答“该产品下一步做什么”，它就是 Execution Owner；这个权力只属于命中的 Product Plugin。Mediator、shared runtime、Capability、网站 sender/receiver 都不得回答。

## 2. 十二个 Product Plugin

| Plugin | 网站 `product_id` | `action_id` | 网站最终消费 |
|---|---|---|---|
| `bazi-chart-interpretation` | `bazi_chart_interpretation` | `produce` | 基础解读入库与展示 |
| `bazi-ai-full-analysis` | `bazi_ai_full_analysis` | `produce` | 正式八字报告入库与交付 |
| `bazi-report-followup` | `bazi_report_followup` | `followup` | 续问记录与展示 |
| `qimen-professional-answer` | `qimen_professional_answer` | `produce` | 奇门分析与报告入库 |
| `qimen-report-followup` | `qimen_report_followup` | `followup` | 奇门续问入库与展示 |
| `hehun-ai-analysis` | `hehun_ai_analysis` | `produce` | 合婚报告入库 |
| `hehun-report-followup` | `hehun_report_followup` | `followup` | 合婚续问入库 |
| `naming-bazi-analysis-and-naming` | `naming_bazi_analysis_and_naming` | `produce` | 起名方案入库与交付 |
| `naming-from-existing-bazi-report` | `naming_from_existing_bazi_report` | `produce` | 起名方案入库与交付 |
| `public-knowledge-article-pipeline` | `public_knowledge_article_pipeline` | `produce_article` | 文章包验证、发布、sitemap 与搜索连接 |
| `localization-production` | 两个现役本地化 identity | 两个现役 action | 翻译入库、资源合并与发布 |
| `payment-screenshot-observation` | `payment_screenshot_observation` | `observe` | 网站确定性接受或拒绝 |

本地化公开映射固定为：

| `product_id` | `action_id` |
|---|---|
| `localization_report_translation` | `report_translation` |
| `localization_article_translation` | `article_translation` |

因此公开能力分母固定为：十二个 Product Plugin、十三个 primary `product_id + action_id`、每个 primary
各自两条 `accuracy_challenge`/`quality_reflection`，合计三十九条公开路由。`static_review_candidate`、
`static_review_selector`、候选 A/B、审校与选择仍是 `localization-production` 私有 Flow，禁止出现在网站产品枚举、
AGENT Catalog `accepts`、Capability Manifest、跨仓 task/result 合同或公开验收分母中。

`manual_accuracy_challenge` 与 `scheduled_quality_reflection` 不新增 Plugin。网站带上原 `subject_product_id`、subject task/result/hash、授权和 review policy，以 `accuracy_challenge` 或 `quality_reflection` 路由回原产品 Plugin；网站仍唯一拥有 schedule、review ledger、finding、人工分诊与发布裁决。

本地化的地区语义由唯一 `localization-production` Product Skill 持有：它联合读取 `source_content + target_locale + terminology + locale_policy`，把八字、奇门、合婚、起名等玄学术语表达为目标 locale 自然且专业的当地用语，同时保持事实、结构、风险强度和古典原文边界。该专业判断不是 GPT DOM 子能力，不得拆成按国家划分的 Plugin，也不得为了翻译已交付报告重新读取人物档案、命盘底层资料、FrozenSubject 或生成第二次分析；报告 id/version/hash 与 Delivery Manifest 已经冻结本次翻译的业务主体。

`bazi_basic_chart`、`bazi_pdf_export`、`qimen_basic_chart`、`qimen_professional_chart`、`hehun_case_preparation` 是网站确定性产品，禁止进入 Catalog。

## 3. 物理结构

每个产品根只按真实复杂度建设：

```text
src/plugins/<plugin-id>/
  index.ts
  <plugin-id>.plugin.ts
  SKILL.md
  flow.ts / schema.ts / result.ts / recovery.ts 仅在真实需要时出现
```

唯一最低接口：

```ts
type ProductPlugin = {
  pluginId: string;
  pluginVersion: number;
  skillHash: `sha256:${string}`;
  checkpointSchemaVersion: number;
  accepts: readonly { productId: string; actionId: string }[];
  execute(task: WebsiteAgentTask, context: SharedExecutionContext): Promise<WebsiteAgentResult>;
};
```

Product Skill 只保存专业规则、Provider-facing 指令、提示词语义、材料解释和结果质量要求；Product Plugin 只维护业务轮次、Prompt/材料角色、模型策略、fresh/continuation 意图与结果合同。GPT Provider 页面动作顺序、页面失败对账、原子 checkpoint 与重启恢复只在 `src/capabilities/gpt/` 的唯一共享 `GptTurnExecutor` 中维护一次；十二个 Plugin 不得各自保存 `gpt_flow`、child 动作数组、页面 retry/recovery，也不得互相 import、读取彼此 checkpoint 或共享可变业务步骤。

未来只有同时满足以下事实才允许新增 Product Plugin：存在独立网站业务 identity、独立输入合同、独立最终结果合同、独立成功/失败/review 语义，并且该需求不是现有 Plugin 的内部工序、也不能只靠增强产品中性 Capability 完成。不满足时必须留在现有 Plugin、现有 Capability 或网站确定性逻辑中，禁止为了目录整齐、假设复用或未来扩展增加 Plugin。

## 4. shared production runtime 与 Mediator

`src/lib/local-runtime/production/` 只承接从旧巨型 Plugin 抽出的产品中性底座：

- V6 session、heartbeat、claim、capacity、lease、renew、fence 与 control intent；
- control intent 只有一条单调序列：初始必须是 `none/0`，网站每持久化一次真实 `pause_requested|cancel_requested|handover_requested` 才把 epoch 递增为正数；AGENT 严格消费该序列，不生成、归一化或推测 epoch；
- immutable task 接受、material 下载和鉴权；
- SQLite/WAL、checkpoint、artifact、terminal 与 durable Outbox；
- job lifetime、abort/settle、全局最老 eligible 调度和单 Browser mutation lock；
- 通过唯一 `src/capabilities/gpt/session/gpt-session-controller.ts` 使用 opaque continuation、主体/授权/hash、turn marker、conversation identity 与 lane CAS；`src/lib/local-runtime/production/` 不另建第二 Controller；
- Catalog 加载、版本冻结和 Session Capability Manifest 投影；
- Shell 诊断状态，不把部分 ready 冒充端到端 ready。

V6 claim 运输包先由 shared runtime 在唯一入口校验 lease、grant 与 execution fence，随后只能单向投影出精确的 `WebsiteAgentTask` 字段。`status`、`lease_*`、`grant` 等运输控制字段到此为止，Mediator、Product Plugin 和 Skill 永远不可见。

Mediator 只执行一次严格分发：解析上述业务 task envelope，校验 `product_id + action_id + task/result contract version`，从唯一 Catalog 得到一个 Plugin，然后调用 `execute`。它不读取 Skill 内容，不选择模型，不操作 DOM/附件，不创建步骤、重试、恢复或业务终态。

## 5. GPT 能力组

GPT 是独立 Provider 能力组，公开 ID 固定为 `gpt`，当前执行方式固定为 `gpt-web`，物理根固定为 `src/capabilities/gpt/`。原 `ai-input-gateway` 在消费者迁完后物理退出，不保留 alias、wrapper、fallback、provider dispatcher 或第二页面链。未来接入其他 AI 时，只有出现真实消费者并获得授权后才建立其独立能力组；GPT 不代理其它 Provider，也不恢复通用 AI Gateway。

```text
Product Plugin 决定业务轮次、模型策略、附件、fresh/continuation 会话意图与是否续问
  -> GptAbilityGroup.executeTurn(one product-neutral turn request)
  -> 唯一 GptTurnExecutor 从现役 checkpoint 恢复或推进
  -> 一个固定 child intent
  -> Browser Authority 许可 exact Target / Document 上的 observation 或最多一次 mutation
  -> GPT Child Ability 自己完成前置、单一页面意图和唯一直接后置回读
  -> 每步持久化后继续，最终 turn receipt / typed failure 返回 Product Plugin
```

GPT 公开子能力分母固定为 23 项，不多不少：

| 类别 | 固定 childCapabilityId |
|---|---|
| 会话 | `prepare_clean_gpt_chat`、`focus_exact_gpt_conversation`、`verify_gpt_conversation_identity` |
| 执行档案 | `open_gpt_execution_profile`、`open_gpt_model_selector_v2`、`select_exact_gpt_model_v2`、`ensure_exact_gpt_reasoning_tier`、`close_gpt_execution_profile` |
| 附件 | `open_gpt_attachment_control`、`attach_approved_gpt_files_once`、`reconcile_gpt_attachment_set` |
| Prompt/提交 | `write_exact_gpt_prompt`、`reconcile_gpt_draft`、`submit_exact_gpt_turn_once`、`reconcile_gpt_turn_submission` |
| 文本回答 | `wait_for_stable_gpt_text`、`checkpoint_gpt_text_response` |
| 图片回答 | `wait_for_stable_gpt_image`、`checkpoint_gpt_generated_image` |
| Continuation | `persist_gpt_continuation`、`acquire_gpt_continuation_lane`、`advance_gpt_continuation_lane`、`release_gpt_continuation_lane` |

前三类 Browser 边界能力仍只属于 Browser Authority，不进入 GPT 分母：绑定 exact Target/Document；经 WAL 许可并执行
一次 governed mutation；按冻结 postcondition 对账 mutation outcome。标题、conversation 搜索、checkpoint fork、临时 UI、
限流/搜索弹窗、artifact 包装与 runtime checkpoint 恢复不属于生产 GPT 公共子能力；页面 find/read/click、横向滚动、
点击唯一 composer 聚焦表面关闭弹面和 selector 只属于相应元素 Owner 的 Child 内部实现。禁止把 `main` 的几何中心当作空白处；当前项目页的该点实测命中历史会话链接。真实页面无 Advanced 或第二 reasoning 弹窗时，执行档案
固定在同一弹面完成 open -> ensure exact model -> ensure exact reasoning tier -> close，不得保留旧流程。

一个页面 Child 只表达一个稳定、可独立验证的 Provider 页面意图，只允许一次有界 observation，或最多一次物理
mutation 加它唯一的直接后置回读。公共 Facade 不得在 Child 前后或失败分支追加隐藏 DOM 观察、页面动作或重试；
Child 不得调用兄弟 Child 隐藏多步 workflow。每个公开 childCapabilityId 必须绑定输入 Schema、Target/Document 条件、
元素 Owner、候选数量、Document transition、proof Schema、typed failure 与 replay policy。Product Plugin 只提交产品中性
turn request，不携带 child 数组、selector、坐标、tab、Browser command 或 Provider 私有对象。

页面变化必须精确绑定 `flow_version + step_index + input_hash + plugin_step_id + childCapabilityId + action_ordinal`，并展示 precondition、唯一 dispatch、正向/负向 postcondition、terminal 与 evidence ref/hash；failure 的 `mutation_outcome` 只能是 `no|dispatched|confirmed`。DISPATCHED 只允许在原 Target/Document 上只读补核，永不自动重放；不得持久化这三个枚举值之外的结果。selector 和语义定位只在对应页面元素合同 Owner 内维护，不建立通用 selector registry，不保留旧新双 selector fallback。真实 Chrome 动态证明未完成前，不得声称新页面已经兼容。

物理打开 ChatGPT 标签页属于 Browser Authority 的任务 Target lifecycle，不是 Product Plugin 功能，也不是 GPT DOM
Child。fresh turn 用 `prepare_clean_gpt_chat` 有界等待新建根页面 hydration 并验证干净会话；authorized continuation 在同样新建的任务页上用
`focus_exact_gpt_conversation` 进入冻结 URL 并验证 conversation identity。`click_gpt_new_chat` 与任务 Target 创建重复，
必须从能力分母、Child handler 和全部 Product Flow 物理退出。

唯一 GPT Session Controller 只拥有 opaque continuation、原 Plugin、主体/授权/hash、永久规范 conversation URL、turn marker、conversation identity 与 lane CAS；提交后短暂 URL 不得持久化，历史会话必须有界等待 marker 与 composer hydration。标题只是 Provider 自动生成的人工可读标签，不得成为路由、恢复或去重身份。GPT 能力组生成结构化 proof，并复用 Evidence、Runtime Logs、shared runtime SQLite/WAL 和 Browser mutation Owner，不建立私有数据库、日志、证据库或第二 mutation ledger。

## 6. 双向合同

网站 provider 合同 `ai-acceptance.website-agent-task-result@1` 同时定义业务 task envelope 与 result envelope；AGENT 只保存 dependency。AGENT provider 合同 `agent-production-runtime.plugin-capability-manifest@1` 只发布 Catalog 的最小能力投影；网站只保存 dependency。V6 运输由机器 block 引用的 active dependency spec 唯一定义，不因十二个 Plugin 复制。

task envelope 允许：job/source task、product/action、幂等和 request hash、task/result contract 身份、业务 Owner/subject/authorization、业务参数、material refs、必要的 parent/subject refs、不透明 continuation，以及仅在 `accuracy_challenge` 或 `quality_reflection` 时存在的 `review_policy`。

task envelope 禁止：`plugin_id`、Stage、node、dependency graph、join topology、Prompt、Provider Skill Capsule、model/reasoning profile、conversation mode、selector、browser action、retry flow、provider URL 和候选 A/B/selector 执行拓扑。

result envelope 允许：job/source task、product/action、实际 plugin/version、result contract、payload object/hash/bytes/media type、evidence refs、execution receipt hash 与必要 continuation。V6 terminal status 和 canonical terminal time 不在 result 中复制。

网站 provider 必须在同一机器合同内为全部三十九条路由发布唯一 `route policy`。每条 policy 闭合：

```text
product_id + action_id
parameter exact schema
required/forbidden material role + cardinality + media/trust/owner policy
parent/continuation/review subject relation policy
result payload schema identity + version + strict validation semantics
expected plugin_id + plugin_version（由当前 Capability Manifest 在 claim 时解析）
```

网站唯一规范机器工件是 `packages/ai-contracts/src/agent-task/website-agent-route-policies.v1.json`；AGENT 只消费逐字相同的 `src/lib/local-runtime/production/website-agent-route-policies.v1.json` dependency 投影，不另写可漂移的 route policy。跨仓生成与质检必须比较 policy 的规范化
语义和三十九条完整分母，不得只比 contractId/version、文件 hash 或 route 名称。未知、缺失、额外、字段放宽、material
role 漂移与 result parser 漂移都失败关闭。review task 必须带不可变 `subject_result`、`review_context`、locked facts、
subject task/result/hash 与授权；空材料、盲审或让 Plugin 回查可变网站状态均不得接单。

每个 Product Plugin 在 `context.complete` 前调用对应 route 的严格 parser；该 parser 必须验证 exact fields、schema version、
业务主体、父子/review 关系、hash/引用闭包及 artifact receipt。网站在 `result_payload` 首次 staging 时使用同源同版本的纯
route validator，领域 consumer 随后复用同一 domain validator 二次验证。付款观察、公开文章包、从既有报告起名、
八字分析加起名以及全部 review payload 是确定性封口分母，禁止退回通用 JSON-object 校验。

## 7. 材料与安全

每份材料必须按 `material_id + ordinal + role + NFC display_name + object_ref + sha256 + bytes + media_type + storage_class + owner_scope_hash + trust_class + may_issue_instruction` 精确鉴权。显示名来自稳定业务事实，不得含路径，不得依赖 attempt、临时目录或当前时间；集合内必须唯一。大文件和古籍使用既有 object ref 与 sealed manifest，不内嵌任务，也不在 Plugin 内部步骤反复复制。

材料内容默认是数据而非指令；只有网站明确授权 `may_issue_instruction` 的可信业务材料才能影响专业 Skill，且不能改写 Product Plugin 的权限、合同或恢复边界。日志、错误和 receipt 不得泄漏 token、cookie、用户输入或附件内容。

公开知识文章的 `generated_image` 必须使用 Provider 返回的精确原始 bytes，不得以截图、DOM URL、页面外直接请求或
`raw_text` 代替。Browser Authority 只可在当前 exact Target/Document、精确 assistant turn 和现有已鉴权页面会话内取得
语义主图原始 bytes，并把 Target/Document、conversation/turn、content hash、bytes、media type、width/height 绑定进下载
receipt。原始 bytes 只进入 task-owned 临时对象，复用现有 `sharp` 生成无 metadata 的 `1200x630 image/webp`，再经网站
现役 `generated_image` output-artifact 路由与同一 Outbox 上传；文章 payload、result envelope 和 completion submission
共同绑定原图下载 receipt、变换 receipt、artifact/object ref、SHA-256、bytes、media type、width/height 与上传 receipt hash。
该图片在 completion submission 后仍是 staged，只有公开知识领域 consumer 的文章入库事务有权 admission。
不新增图片服务、对象库、下载链或第二上传链。

GPT 原子 proof 只通过现役 `ForensicsPersistenceAbilityGroup` 落正式证据。底层 File Storage 必须按
`idempotencyKey + canonical content hash` 内容寻址：同 key 同内容返回同 ref，同 key 不同内容失败；record/artifact ref
必须可读并完成 hash readback。生产 runtime 向 GPT 注入 `onProof`，只有 append 成功且 readback 一致的脱敏 ref 才按调用
顺序进入 `evidence_refs`；现有 `execution_receipt_hash` 绑定该有序集合，无需 Evidence Manifest、第二证据表或第二证据库。
持久 proof 只允许 target/document hash、URL hash/page type、受控语义、mutation outcome、postcondition、code 和 evidence hash；
raw URL/HTML/selector、Browser 私有 identity、用户输入、Prompt、附件内容与本地路径不得落盘。外部 mutation 后证据写失败
固定进入 `RECONCILE_ONLY`、保留 Browser WAL 且不重放；持续无法证明时保持故障现场、公开精确 code 并等待修复，WAL 保留原事实，不得把网站任务收束成失败终态。Runtime Logs 只记录 authority ref/hash，不保存 proof 正文或取得证据主权。

## 8. durable identity、状态与恢复

首次 durable accept 必须在同一事务冻结：

```text
catalog_hash
plugin_id
plugin_version
skill_hash
checkpoint_schema_version
request_hash
```

该身份采用 claim 时实际 Catalog/Manifest 解析出的 `plugin_id + plugin_version`；result envelope 与 completion submission 必须逐项相等。
Plugin 实现代码有语义变化时必须递增 `plugin_version`、生成新 Catalog hash 并 drain 旧任务；质检保留“代码变化但版本未变”
mutant。`agent_build_hash` 继续只绑定 worker session，不增加到六字段 Durable Identity，也不建立 source/build 第二身份链。

本地不可变接单记录写入成功即是 durable accept 的边界；不得延迟到远程 checkpoint 成功之后才认定。此后任何 checkpoint、下载或网络失败只能进入现役唯一恢复链，不得释放成“未接单”并重新解释。

checkpoint、恢复、result 与 execution receipt 都绑定同一组合。Browser WAL 是物理 mutation 是否发送的先行权威；共享
`GptTurnExecutor` 通过现役 checkpoint 保存 `flow_version + step_index + input_hash + proof + mutation_state + Target/Document identity + conversation identity`，
checkpoint 只能单调追平 WAL，不能把已 DISPATCHED/CONFIRMED 降级为未发生。
发布新 Catalog/Plugin/Skill 前先 drain 已接受任务。若历史失败完成已由网站正式退役，且本地该 job 没有 result/staged result、Provider step、continuation、Browser mutation、active lease 或未知 Outbox，则在一个事务中删除旧 checkpoint/lease/材料执行片区，保留退役 Outbox 原文，并在现役 Outbox 追加一份不可投递的本地重构凭据，冻结 job、时间、原因、旧/新完整 Plugin 身份及 hash、原失败和被退役 checkpoint 引用，再以现役 Plugin 身份重建原 job。该凭据只用于尸检，不参与 Cloud 状态、不得被后续 running 清除，也不新建第二台账。任一条件不成立都禁止重建和新 mutation，不设置兼容 reader、旧 Plugin 分支或第二身份链。重启先读取未终态 durable job、原冻结执行身份、GPT step checkpoint、Browser WAL 与当前 Document：
已确认且仍相容的步骤越过；已 dispatch 的上传、提交或媒体取得只执行对应对账；明确未 dispatch 且前置仍成立才允许
原 action ordinal 继续；输入、主体、授权、Document 或页面事实冲突则失败关闭并保留原事实。禁止整轮 replay、用新代码
静默续跑或保留第二 Plugin 兼容路径。

GPT flow version 切换不保留旧 flow reader。旧 step 只有在 `status=failed`、没有 result、任务没有 result/staged result，且
Browser WAL 证明该 job + plugin step 不存在 DISPATCHED，也不存在已 CONFIRMED/REJECTED 的 Provider effect 时，才允许在一个
事务中物理删除该旧 step，并在现役 Outbox 写入已本地验收的 `gpt-flow-execution-slice-reconstruction.v1` 凭据；凭据绑定旧/新
flow、旧/新 input hash、旧 mutation state 与 WAL 安全结论。任一上传/提交外部 effect 或结果事实存在即拒绝重构，不得改写旧
checkpoint、伪造 v2 或用兼容分支解释 v1。

V6 继续唯一拥有 transport state、lease/fence、control、completion submission 和重放语义。Plugin 私有 checkpoint 不成为第二 Cloud 状态机。DISPATCHED 物理动作永不再次 dispatch；已失去 lease/fence 后停止新 mutation，等待原执行 settle；同 request/outbox payload 只以原幂等键重试。

artifact 与 completion submission 都先在 SQLite/WAL 持久化确定性 intent 和 idempotency key，再发网络；每次远端响应/receipt 先原子保存，
随后才推进本地状态。一个持续运行的串行 flusher 按权威顺序投递，不等待 `active.size===0`。启动时必须对账
remote-completion/local-noncompleted、business admission receipt 缺失与旧 fence；只有 authoritative stale-lease/fence code 或 delivered receipt 才能终结旧写入，DISPATCHED
不得重放。网站现役 device-job status 同时公开 artifact/checkpoint/completion receipt、business admission receipt 与 consumer error，不新建 ledger。

切换后的历史隔离只有一个窄条件：现役 device-job status 对某 job 明确返回 404，且 AGENT 本地该 job 已经是
`completed` 不可变终态。此时只能将该 job 尚无回执的旧 Outbox
标记为 `REMOTE_JOB_ABSENT_HISTORICAL` 并退出发送集合；标记不是远端 receipt、不得改写本地状态，也不得继续阻断
无关新 job。任一本地非终态、远端仍可见但内容漂移、Browser DISPATCHED 或缺失对账事实都不得进入该隔离。

typed failure 从 GPT child 到共享 GPT Turn 执行器、Plugin、runtime 和 Outbox 始终保持同一事实：

```text
code + mutation_outcome + evidence_ref/evidence_hash + cause（存在时）
```

禁止异常文本正则、自由字符串分类和冗余 `retryable` 布尔。每次 attempt 以 `job_id + attempt_id + lease_version`
幂等追加现役 failure history，并在 Runtime Log 同时记录时间、组件/步骤、Plugin/version、typed code、责任 Owner、mutation outcome、evidence ref/hash 与容量影响。Browser/postcondition 失败、页面未 hydration、提交后的短暂 conversation URL、request
placeholder、回答仍在生成都只是 step/attempt 事实，必须保存 checkpoint 并精确选择从 checkpoint 继续或只读补核，
不得直接裁决任务完成。确定性合同不可满足、授权或安全边界拒绝同样只是必须公开的故障现场：记录精确 typed failure，保持
`recovery_pending`，待代码、权限或外部条件修复后继续原 job。每轮执行结果只取 `success / failed`；网站任务唯一完成态是
`completed`，且必须绑定领域 consumer 已提交的入库回执。取消只停止当前执行，不得把 failed 冒充完成。

任务 durable create 只冻结单次 `max_provider_turns` 安全上限并随 claim grant 下发。网站按当前 worker session 的 `agent_build_hash` 拥有唯一自动执行预算：每次 grant 形成一个 attempt，每次 failed checkpoint 必须立即释放 lease 与业务容量；第一次失败退避 5 秒，第二次退避 15 秒，第三次失败后该 build 不得再 claim 此 job。网站任务仍保持 `recovery_pending`，不产生 failed terminal；新的 `agent_build_hash` 才能开启新的三次预算。三次是自动执行熔断，不是业务终态或交付期限。Browser mutation
五种物理状态不变，另以
`logical_mutation_id = hash(job_id + plugin_step_id + action_ordinal + request_hash)` 跨 attempt 防重；同一 logical mutation 已
CONFIRMED/DISPATCHED/REJECTED 时不得再发。

attempt 裁决只看冻结现场与 typed failure：`mutation_outcome=dispatched` 或 reconciliation attempt 固定进入
`RECONCILE_ONLY`，其余失败固定进入 `RETRY_FROM_CHECKPOINT`。Cloud Outbox 拒绝必须把原生业务 `code` 写入本地 authority
并在日志中公开责任组件、影响和恢复动作。每个 Outbox intent 的自动交付预算同样绑定原 `agent_build_hash`：第一次失败后退避 5 秒，第二次失败后退避 15 秒，第三次失败后持久化为 `parked` 并停止该 intent 的网络重放；同 build 重启不得清零，只有新的 build hash 才能恢复三次预算。Outbox 停车只隔离该 intent，不得阻断其他 Outbox、其他 job 或网站入口。每次任务失败都要先持久化现场再释放 lease，第三次后停车该 build，同时让无关任务继续领取；不得生成 `FINAL_FAILED` 或远端 failed completion。结果上传成功后，本地仍保持
交付等待，直到 device-job status 返回与 result hash 绑定的 `business_admission_receipt`，才原子写本地 `completed`。

`ledger_reconciled` 在每次 Store、Browser WAL、checkpoint、artifact/completion Outbox、continuation、proof 或远端 authority
变化时先失效，再由现有只读 authority 连续派生。结构损坏、无 Owner 的孤儿记录、或 completed job 缺少自己的 receipt/evidence 时必须为 false。普通 job 的 pending/failed Outbox 和 Browser DISPATCHED 只阻断该 job 的同一 logical mutation、主体与授权范围，绝不能阻断其他产品 claim；合法 busy lane 只表示忙，不表示 ledger 不一致。按 authoritative stale-lease/fence code 隔离的旧 Outbox 仍以失败标记保留原事实，绝不冒充 delivered receipt。

Browser Authority 只拥有一条最多十个 waiter 的有界 FIFO mutation lane。waiter 绑定精确 job Target，并感知 lease、deadline、abort；
等待期间持续 renew，取消后确定性移除；DISPATCHED 锁住原现场和冻结后置判据直到只读补核收束或期限耗尽，禁止用人工猜测裁决。heartbeat 的 lane/busy 来自 Browser Authority 真实队列与
owner，不从 `active.size` 猜测。某个 waiter、Outbox 或 Product Plugin 失败不得冻结该队列中的其他 job，也不得把网站入口改成不可用。上述边界闭合后业务 capacity 才按 `10 - active jobs` 派生，不能用 `availableCapacity()=1`
把单 Browser lane 冒充整机容量。

GPT Session Controller 不理解业务内容、不决定何时续问。提交后的短暂 conversation URL 不得写入 continuation；聚焦历史
会话后必须有界等待页面 hydration、精确 turn marker、composer 与 conversation identity，不能因 URL 先到而 DOM 尚未出现就
判会话不存在。无法证明原会话、主体、授权、Plugin 或 lane CAS 时进入统一 attempt 决策；明确未 dispatch 才允许原步骤
继续，已 dispatch 只读补核，确定性不可满足时保留故障现场并等待修复，不得静默新开会话冒充续接。

## 9. Capability Manifest 与准入

唯一 Catalog 直接生成：

```json
{
  "schema_version": "agent-plugin-capability-manifest.v1",
  "catalog_hash": "sha256:...",
  "plugins": [
    {
      "plugin_id": "bazi-ai-full-analysis",
      "plugin_version": 1,
      "accepts": [
        {
          "product_id": "bazi_ai_full_analysis",
          "action_id": "produce"
        }
      ],
      "task_contract_version": 1,
      "result_contract_version": 1
    }
  ]
}
```

该公开 Manifest 顶层只含 `schema_version + catalog_hash + plugins`；每项 Plugin 只含 `plugin_id + plugin_version + accepts + task_contract_version + result_contract_version`，每个 accepts 项只含 `product_id + action_id`。`skill_hash` 与 `checkpoint_schema_version` 只属于 AGENT durable accept 身份，不得作为网站准入字段或第二激活真相发布。

Manifest 绑定当前 session 与 attestation generation。网站只用它判断 job eligibility，不读取 Skill bytes、Prompt、Flow、Provider URL 或会话策略。不支持的 job 保持不 eligible，但不能阻断队列中其他受支持 job。

App Shell 的十二项支持表和质检分母必须直接消费这一份 Catalog 投影，不保存第二手写表、提交态 `plugin-status.json` 或人工开关。只有存在不可替代的构建消费者时才可生成进程内或临时投影，且不得取得新的持久真源身份。

Manifest 生效的同一删除片区必须物理退出 product bundle/canary 产品准入、`blocked -> canary_only -> open` 状态机及其字段、脚本、UI 和 claim 判断。V6 session/attestation 准入继续保留；十二个 Plugin journey、十三个真实主任务与三十九条公开路由的 RELEASE Dynamic Proof 只属于发布证据，不是永久 canary。

## 10. Shell、Browser 与启动

`grasseye:start` 只建立 AGENT 自有 production Shell、shared runtime、状态诊断和安全清理本仓 listener；普通重启不
enrollment、不创建任务、不认领 Target、不运行 CI。固定 Extension 自行更新并配对 Browser Authority；空闲 Target
absent 合法。exact browser-required job durable accept 后，首个 Browser 原子动作才后台创建一个任务专属 ChatGPT
Target；绝不查询或复用操作者既存 ChatGPT 页面。页面完成加载并复核精确 Origin 后才 claim。GPT turn settle 且无
DISPATCHED 后关闭该任务 Target 并释放 Workspace；存在 DISPATCHED 时保留唯一补核现场和冻结判据。

Shell、Cloud contract/session、Browser Authority、Target、claim eligibility、queue/outbox 和端到端 proof 是独立状态维。Cloud、Provider、Browser 或凭证失败时 Shell 必须保留诊断面，只让相应 execution/claim 失败关闭；HTTP 200、空队列、进程存活或 Authority READY 都不是完整生产通过。

AGENT 始终运行在用户本地 Mac；网站与 PostgreSQL 当前同在这台 Mac，未来共同迁到网站服务器。这个网络位置变化不授予网站 AGENT 进程、浏览器或 Provider 的所有权。

## 11. 删除式切换

施工按产品垂直片区完成“新 Plugin + 网站发单/收单 + 领域 consumer + 旧路径删除”，禁止先造十二个空壳或保留兼容桥。全部消费者迁出后，必须物理删除：

- `src/plugins/xuanxue-ai-production/**` 巨型 Plugin、旧 route、旧 workbench handle 和 re-export；
- AGENT 手写 product-to-Stage topology、Stage scheduler、Profile、join/conversation map、本地网站 Stage 镜像；
- product bundle/canary 产品准入；
- 第二 worker、mediator、transport、queue、ledger、GPT Session Controller、通用 AI Gateway；
- alias、adapter、fallback、compatibility、bridge、shadow、dual reader/writer。

旧路径不得保留为历史可执行代码；历史只存在于 Git。不可逆点在 durable accept 或任何外部 mutation 之前。切换失败后只允许定点数据修复或向前修复，不恢复整个数据库，不重开旧主链。

## 12. 验收

静态检查必须证明：Catalog 恰好十二个 Plugin、十三个 primary、二十六个 review、三十九条公开路由；每个 Plugin 恰好一份 Skill；两个静态本地化 review 产品从公开面物理为零；五个确定性产品不在 Catalog；shared runtime 无产品语义；Mediator 无 Prompt/DOM/model/stage sequence；网站任务无执行字段；GPT 能力组恰好一份公共 Facade、一个 Session Controller、完整原子 child 分母；旧 `ai-input-gateway`、巨型 Plugin、Stage/Graph、product bundle/canary 和第二链物理为零。

合同检查必须证明：双向 provider/dependency 身份与三十九条 route policy 语义匹配；网站 task/result 与 V6 各一份；AGENT Capability Manifest 一份；未知字段、错误 route/parameter/material/relation/payload/plugin/version 失败关闭；material、result、evidence、completion submission、business admission、session/attestation 与 durable execution identity 精确绑定。

动态证明必须先在真实 Chrome/ChatGPT 上逐项证明 GPT Target/Document、当前同一弹面的模型与推理档位读取/必要切换、
真实附件、Prompt、一次发送、短暂 URL 到永久 conversation identity、request placeholder 到稳定回答、continuation hydration、
精确 assistant turn 的已鉴权原始图片 bytes、每步 checkpoint、进程重启从首个未完成步骤继续和 fail-closed；再从网站正常
sender 创建十三个真实主任务，并对每个 primary 各创建两类真实 review，覆盖全部三十九条公开路由。每条均经历真实材料
上传、AGENT claim、唯一 Plugin、真实 GPT/Browser、严格 payload parser、result/image artifact、持久 evidence ref、网站 staging、
completion submission、delivery_pending、领域入库/发布、business admission receipt 和 AGENT 本地完成对账。先以全新本地化任务证明范例，再完成其余路由；不得用
fixture、HTTP 200、空队列、截图、直接资源 URL 或模拟结果代替。

核心黑盒验收：从网站 Task 中完全删除 Stage、Prompt、Provider Profile、Conversation 与 Join，只保留业务类型、输入、授权和材料引用，AGENT 仍能完成产品。若失败，说明执行真相仍未回到 Product Plugin，验收固定 FAIL。

恢复证明覆盖：在模型、附件、draft、提交、回答等待、文本 checkpoint、图片 checkpoint 各安全边界重启，断网、
lease/fence 丢失、DISPATCHED receipt 丢失与只读补核、短暂 conversation URL、历史会话 hydration、Outbox 重放、result
consumer 中断、续问并发、Plugin/Skill 升级、Plugin-local failure 与 shared-authority failure。每次恢复必须保持原任务、
原幂等身份、原不可变执行版本，从首个未完成且获准的原子步骤继续，并保持每个逻辑动作最多一次物理 dispatch。
