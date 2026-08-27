# AGENT 十二产品插件与网站 V6 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "agent-production-runtime-v1",
  "status": "active",
  "owner": "agent-production-runtime",
  "lawIds": [
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V2"
  ],
  "contractRefs": [
    "docs/specs/agent-production-runtime/agent-plugin-capability-manifest.provider.spec.json",
    "docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json",
    "docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json"
  ],
  "dependencyEdges": [
    {"contractRef":"docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json","from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"ai-acceptance","repo":"ADVISION-X/xuanxue-web"}},
    {"contractRef":"docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json","from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"ai-acceptance","repo":"ADVISION-X/xuanxue-web"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"gpt","repo":"local"}}
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
  -> Product Plugin 自己的 Product Skill 与私有 Flow
  -> GPT 能力组或其它公共 Capability 的一个原子动作
  -> result artifact + execution evidence
  -> V6 first-terminal CAS
  -> 网站 business-result-ready
  -> 唯一领域 consumer 入库、发布或交付
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
| `localization-production` | 四个现役本地化 identity | 四个现役 action | 翻译入库、资源合并与发布 |
| `payment-screenshot-observation` | `payment_screenshot_observation` | `observe` | 网站确定性接受或拒绝 |

本地化的四个映射固定为：

| `product_id` | `action_id` |
|---|---|
| `localization_report_translation` | `report_translation` |
| `localization_article_translation` | `article_translation` |
| `localization_static_review_candidate` | `static_review_candidate` |
| `localization_static_review_selector` | `static_review_selector` |

`manual_accuracy_challenge` 与 `scheduled_quality_reflection` 不新增 Plugin。网站带上原 `subject_product_id`、subject task/result/hash、授权和 review policy，以 `accuracy_challenge` 或 `quality_reflection` 路由回原产品 Plugin；网站仍唯一拥有 schedule、review ledger、finding、人工分诊与发布裁决。

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

Product Skill 只保存专业规则、Provider-facing 指令、提示词语义、材料解释和结果质量要求；可执行步骤、状态机、Browser 原子动作顺序、模型选择、checkpoint 与恢复只在 Plugin 代码中维护一次。Plugin 不互相 import，不读取彼此 checkpoint，不共享可变业务步骤。

未来只有同时满足以下事实才允许新增 Product Plugin：存在独立网站业务 identity、独立输入合同、独立最终结果合同、独立成功/失败/review 语义，并且该需求不是现有 Plugin 的内部工序、也不能只靠增强产品中性 Capability 完成。不满足时必须留在现有 Plugin、现有 Capability 或网站确定性逻辑中，禁止为了目录整齐、假设复用或未来扩展增加 Plugin。

## 4. shared production runtime 与 Mediator

`src/lib/local-runtime/production/` 只承接从旧巨型 Plugin 抽出的产品中性底座：

- V6 session、heartbeat、claim、capacity、lease、renew、fence 与 control intent；
- immutable task 接受、material 下载和鉴权；
- SQLite/WAL、checkpoint、artifact、terminal 与 durable Outbox；
- job lifetime、abort/settle、全局最老 eligible 调度和单 Browser mutation lock；
- 通过唯一 `src/capabilities/gpt/session/gpt-session-controller.ts` 使用 opaque continuation、主体/授权/hash、turn marker、conversation identity 与 lane CAS；`src/lib/local-runtime/production/` 不另建第二 Controller；
- Catalog 加载、版本冻结和 Session Capability Manifest 投影；
- Shell 诊断状态，不把部分 ready 冒充端到端 ready。

Mediator 只执行一次严格分发：解析 task envelope，校验 `product_id + action_id + task/result contract version`，从唯一 Catalog 得到一个 Plugin，然后调用 `execute`。它不读取 Skill 内容，不选择模型，不操作 DOM/附件，不创建步骤、重试、恢复或业务终态。

## 5. GPT 能力组

GPT 是独立 Provider 能力组，公开 ID 固定为 `gpt`，当前执行方式固定为 `gpt-web`，物理根固定为 `src/capabilities/gpt/`。原 `ai-input-gateway` 在消费者迁完后物理退出，不保留 alias、wrapper、fallback、provider dispatcher 或第二页面链。未来接入其他 AI 时，只有出现真实消费者并获得授权后才建立其独立能力组；GPT 不代理其它 Provider，也不恢复通用 AI Gateway。

```text
Product Plugin 决定业务步骤、模型策略、附件、会话拓扑与是否续问
  -> GptAbilityGroup.execute(one child intent)
  -> Browser Authority 许可 exact Target / Document 上的 observation 或最多一次 mutation
  -> GPT Child Ability 验证唯一直接后置条件
  -> proof / typed failure 返回 Product Plugin
```

GPT 能力组首批公开子能力按九类组成：

| 子能力类 | 原子动作边界 |
|---|---|
| Target/Document | 绑定、观察和验证唯一 GPT Target、Document、Workspace；获准人工流程可恢复原来源页 |
| 临时 UI | 每次只处置一个已知且归属明确的限流、搜索或临时 UI |
| 会话拓扑 | 新会话、干净验证、规范 URL 聚焦、搜索打开/写入/选择、checkpoint fork、conversation identity 验证各自独立 |
| 执行档案 | 观察、打开模型/推理选择器、选择精确值、终态回读各自独立 |
| 附件 | 打开附件入口、一次挂载获准集合、直接验证全部且仅有精确附件各自独立 |
| Composer/提交 | 聚焦、写入、回读、发送、提交后 user turn 验证各自独立 |
| 回答/Artifact | 定位 assistant turn、有界等待、文本 checkpoint、图片 checkpoint、单 artifact 捕获各自独立 |
| 标题 | 打开标题入口、写入、提交、标题与真实会话身份回读各自独立 |
| 连续性/恢复 | continuation 保存、lane acquire/advance/release、response checkpoint 恢复各自独立且不执行 DOM mutation |

一个 Child Ability 只允许一次有界 observation，或最多一次物理 mutation 加它唯一的直接后置回读；不得调用兄弟 Child Ability 隐藏多步 workflow。每个公开 childCapabilityId 必须绑定输入 Schema、Target/Document 条件、元素 Owner、候选数量、Document transition、proof Schema、typed failure 与 replay policy。Product Plugin 只按私有 Flow 请求原子动作，不携带 selector、坐标、tab、Browser command 或 Provider 私有对象。

页面变化必须精确失败为带 childCapabilityId 的 precondition、element ambiguous、document changed、postcondition 或 mutation outcome unknown；UNKNOWN 永不自动重放。selector 和语义定位只在对应页面元素合同 Owner 内维护，不建立通用 selector registry，不保留旧新双 selector fallback。真实 Chrome 动态证明未完成前，不得声称新页面已经兼容。

唯一 GPT Session Controller 只拥有 opaque continuation、原 Plugin、主体/授权/hash、规范 conversation URL、turn marker、conversation identity 与 lane CAS；标题只是人工可读标签，不得成为路由、恢复或去重身份。GPT 能力组生成结构化 proof，并复用 Evidence、Runtime Logs、shared runtime SQLite/WAL 和 Browser mutation Owner，不建立私有数据库、日志、证据库或第二 mutation ledger。

## 6. 双向合同

网站 provider 合同 `ai-acceptance.website-agent-task-result@1` 同时定义业务 task envelope 与 result envelope；AGENT 只保存 dependency。AGENT provider 合同 `agent-production-runtime.plugin-capability-manifest@1` 只发布 Catalog 的最小能力投影；网站只保存 dependency。V6 `ai-acceptance.xuanxue-ai-production-v6@6` 继续是唯一运输协议，不因十二个 Plugin 复制。

task envelope 允许：job/source task、product/action、幂等和 request hash、task/result contract 身份、业务 Owner/subject/authorization、业务参数、material refs、必要的 parent/subject refs、不透明 continuation，以及仅在 `accuracy_challenge` 或 `quality_reflection` 时存在的 `review_policy`。

task envelope 禁止：`plugin_id`、Stage、node、dependency graph、join topology、Prompt、Provider Skill Capsule、model/reasoning profile、conversation mode、selector、browser action、retry flow、provider URL 和候选 A/B/selector 执行拓扑。

result envelope 允许：job/source task、product/action、实际 plugin/version、result contract、payload object/hash/bytes/media type、evidence refs、execution receipt hash 与必要 continuation。V6 terminal status 和 canonical terminal time 不在 result 中复制。

## 7. 材料与安全

每份材料必须按 `material_id + ordinal + role + NFC display_name + object_ref + sha256 + bytes + media_type + storage_class + owner_scope_hash + trust_class + may_issue_instruction` 精确鉴权。显示名来自稳定业务事实，不得含路径，不得依赖 attempt、临时目录或当前时间；集合内必须唯一。大文件和古籍使用既有 object ref 与 sealed manifest，不内嵌任务，也不在 Plugin 内部步骤反复复制。

材料内容默认是数据而非指令；只有网站明确授权 `may_issue_instruction` 的可信业务材料才能影响专业 Skill，且不能改写 Product Plugin 的权限、合同或恢复边界。日志、错误和 receipt 不得泄漏 token、cookie、用户输入或附件内容。

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

checkpoint、恢复、result 与 execution receipt 都绑定同一组合。发布新 Catalog/Plugin/Skill 前先 drain 已接受任务；版本或 checkpoint schema 不兼容时，在零新 Browser/Provider mutation 下进入 `review_required`，禁止用新代码静默续跑，也不保留第二 Plugin 兼容路径。

V6 继续唯一拥有 transport state、lease/fence、control、terminal 和重放语义。Plugin 私有 checkpoint 不成为第二 Cloud 状态机。UNKNOWN 物理动作永不自动重放；已失去 lease/fence 后停止新 mutation，等待原执行 settle；同 request/outbox payload 只以原幂等键重试。

GPT Session Controller 不理解业务内容、不决定何时续问。无法证明原会话、主体、授权、Plugin 或 lane CAS 时失败关闭为 `review_required`，不得静默新开会话冒充续接。

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

Manifest 生效的同一删除片区必须物理退出 product bundle/canary 产品准入、`blocked -> canary_only -> open` 状态机及其字段、脚本、UI 和 claim 判断。V6 session/attestation 准入继续保留；十二条真实任务是 RELEASE Dynamic Proof，不是永久 canary。

## 10. Shell、Browser 与启动

`grasseye:start` 只建立 AGENT 自有 production Shell、shared runtime、状态诊断和安全清理本仓 listener；普通重启不 enrollment、不创建任务、不认领 Target、不运行 CI。固定 Extension 自行更新并配对 Browser Authority；空闲 Target absent 合法。exact browser-required job durable accept 后，首个 Browser 原子动作才创建或认领 Target。

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

静态检查必须证明：Catalog 恰好十二个 Plugin；每个 Plugin 恰好一份 Skill；五个确定性产品不在 Catalog；shared runtime 无产品语义；Mediator 无 Prompt/DOM/model/stage sequence；网站任务无执行字段；GPT 能力组恰好一份公共 Facade、一个 Session Controller、完整原子 child 分母；旧 `ai-input-gateway`、巨型 Plugin、Stage/Graph、product bundle/canary 和第二链物理为零。

合同检查必须证明：双向 provider/dependency 身份匹配；网站 task/result 与 V6 各一份；AGENT Capability Manifest 一份；未知字段失败关闭；material、result、terminal、session/attestation 与 durable execution identity 精确绑定。

动态证明必须先在真实 Chrome/ChatGPT 上逐项证明 GPT Target/Document、模型读取与必要切换、附件、Prompt、发送、回答、continuation/fork、标题和 fail-closed；再从网站正常 sender 创建十二条真实任务。每条均经历真实材料上传、AGENT claim、唯一 Plugin、真实 GPT/Browser、result artifact、网站 first-terminal、business-result-ready 和领域入库/发布。先以全新本地化任务证明范例，再完成其余十一条；不得用 fixture、HTTP 200、空队列或模拟结果代替。

核心黑盒验收：从网站 Task 中完全删除 Stage、Prompt、Provider Profile、Conversation 与 Join，只保留业务类型、输入、授权和材料引用，AGENT 仍能完成产品。若失败，说明执行真相仍未回到 Product Plugin，验收固定 FAIL。

恢复证明覆盖：重启、断网、lease/fence 丢失、UNKNOWN、Outbox 重放、result consumer 中断、续问并发、Plugin/Skill 升级、Plugin-local failure 与 shared-authority failure。每次恢复必须保持原任务、原幂等身份、原不可变执行版本和最多一次物理动作。
