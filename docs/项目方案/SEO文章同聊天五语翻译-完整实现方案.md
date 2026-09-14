# SEO 文章同聊天五语翻译—完整实现方案

## 0. 方案状态与授权边界

- 状态：`CHANGE_PASS / READY_PENDING`（2026-09-15 已完成双仓现役法案/施工图对齐、主 Codex 两轮代码前审计、双仓实现与原生 CHANGE；独立只读审计完成度/准确度均为 98%、无阻断 finding；不代表 READY 或 RELEASE）
- 需求 Owner：AGENT 的 GPT/Browser 生产执行链；Website 继续独占文章本地化需求、顺序、业务接纳、持久化与公开版本真相。
- 唯一方案路径：`/Users/nexgen/Documents/AGENT/docs/项目方案/SEO文章同聊天五语翻译-完整实现方案.md`
- 当前授权：用户已明确授权按本方案迭代双仓法案、施工图、代码、质检与必要数据库操作，并要求法案非必要不扩张、无兼容桥/第二链、成功入库才完成；`ci-full-governance` Skill保持冻结。
- 解阻事实：双仓母本、现役law corpus与blueprint已由主Codex诚实遍历；只精准替换`public_knowledge_article_pipeline/produce_article -> localization_article_translation/article_translation`五语链的绝对fresh禁令，其它产品仍fresh且零跨任务continuation状态。
- 代码前门：双仓`audit:build`与`audit:projection:check`均已从新权威重建并通过；两轮主Codex审计均为100%，达到并超过98%门槛。

当前候选已达到进入 READY 的门槛；只有 clean commit 上的原生 READY、母本第79节独立核销与 RELEASE 全部闭合后，才能升级结论，且真实五语 Website admission/readback 仍是业务完成终点。

## 1. 需求、业务终点与语义澄清

目标行为是：

```text
1 个 GPT conversation
  = 1 个已接纳的 zh-CN SEO 文章生产任务
  + zh-HK 翻译
  + zh-TW 翻译
  + en-US 翻译
  + ja-JP 翻译
  + ko-KR 翻译
```

“1 次中文生成”表示一张中文文章业务任务，不要求删除该任务现役的 `corpus_research -> article_synthesis -> article_image_generation` 三段 Provider flow。五次翻译必须在该中文任务的 canonical conversation URL 中按固定顺序原地追加，但每次翻译仍是一张独立 Website localization job、独立 AI task、独立结果、独立语义验证、独立业务 admission 和独立 locale edition。

每次翻译的内容源都必须是同一份 Website 已接纳的 zh-CN canonical article 及其 `article_markdown_hash`；不得把前一种语言的译文作为后一种语言的源。前序翻译任务只提供“允许回到同一 Provider conversation”的直接父身份，不提供翻译内容真相。

唯一业务完成终点不是“GPT 页面出现五个回答”，而是 Website 对五个目标 locale 分别完成：

1. exact task/result 合同接收；
2. localization Domain 校验；
3. durable admission receipt 写入；
4. translation binding、locale payload 与 `released` edition 同事务持久化；
5. 按同一 article/version/hash/locale readback；
6. 五个 locale 全部成立。

## 2. 范围与明确非目标

### 2.1 本次范围

- 仅 `public_knowledge_article_pipeline + produce_article` 的已接纳 zh-CN 文章，派生到 `localization_article_translation + article_translation` 的五个目标 locale。
- Website 唯一文章本地化 sender 从“一次创建所有缺口”改为“一次最多创建下一个合法 locale”。
- Website 在 task 现有父三元组中签发直接前序身份。
- AGENT 仅对 route policy 明确授权的文章翻译任务，从现有 Browser WAL 读取前序工单唯一 canonical conversation URL，并给当前工单取得一张新的、当前 job 独占的 system Target，导航到该 URL 后执行一个翻译 turn。
- 保留当前同一 provider effect 的零 submit 恢复语义。

### 2.2 非目标

- 不改变报告翻译、静态 catalog、accuracy challenge、quality reflection、八字/奇门/合婚 follow-up 或任何其它产品的 fresh-chat 边界。
- 不把六张业务工单合并为一张，不把五个 locale 合并为一个 Provider prompt 或一个 aggregate result。
- 不改变 SEO 中文任务内部三段 flow、文章 Prompt、图片生成、模型选择或文章 admission。
- 不新增数据库表/列、conversation store、continuation ledger、frontier、CAS、队列、worker、scheduler、第二 Browser lane、第二 WAL、兼容桥、fallback、dual-read/write 或 feature flag。
- 不用侧栏标题、最近聊天、页面顺序、时间或搜索猜测 conversation；标题继续是非权威显示信息。
- 不迁移或改写已经接纳的历史 locale edition。

## 3. 输入证据与 scoped candidate

### 3.1 仓库绑定

| 仓库 | realpath | branch | HEAD | tracking ref | 状态 |
| --- | --- | --- | --- | --- | --- |
| AGENT | `/Users/nexgen/Documents/AGENT` | `main` | `2479b2002c808c3433aae6eabff460eea30bd4f8` | `origin/main` 同值 | 本工单开始前仅有不相关的 `GPT频率限制排空冷却-完整实现方案.md` 用户改动；本工单不覆盖该文件 |
| Website | `/Users/nexgen/Documents/xuanxue-web` | `main` | `53648354d60a266b67bc745ce14fd26d6810f9fd` | `origin/main` 同值 | clean |

AGENT既有dirty overlay属于用户，不能覆盖、回退、移动或假定已完成。代码施工必须在当前checkout继续，并持续证明不相关的`GPT频率限制排空冷却-完整实现方案.md`未被本工单改写。本方案文件随授权状态原位更新，不创建竞争版本。

### 3.2 关键文件内容绑定

以下 SHA-256 是本方案设计事实的 scoped candidate，不是全仓冻结：

| 仓库 | 路径 | SHA-256 |
| --- | --- | --- |
| AGENT | `.github/instructions/agent-rules/功能法案.md` | `18c98aba202c93f8a66df0665a58ddcbc9a432da0103dbd38f3f592a35037db1` |
| AGENT | `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md` | `1ad12a901bb58df3ee5c512fd7019993eba5fb81648a0006c15f9e95cf4ea932` |
| AGENT | `docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md` | `9edf275f3e1eccb30fc9fd2ab56c1fa981b7e08179ac8f6ea5398e898e5a089f` |
| AGENT | `docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md` | `2022745be07d088432527fb2ecfa4c051cfe7a44b0dce7c28e34e41513319e8c` |
| AGENT | `src/mediator/product-plugin-contract.ts` | `3d712e0f3b44cbc363ad8ebef105606c19bcdef1fb89b31b2593922de2238655` |
| AGENT | `src/plugins/public-knowledge-article-pipeline/seo-gpt-calls.ts` | `c98c3ce22757a147e178758100bd6788ce55fe31d0ab7a10d1eae1e07fbc6371` |
| AGENT | `src/plugins/localization-production/flow.ts` | `0020a81a4ea3a7cc8d95b872b5567230ae5e57fc5bd64b16416914468f71f78a` |
| AGENT | `src/capabilities/gpt/production-browser-lifecycle.ts` | `9082b38e436f1f44270ee4495aa1919481de9bed74a69d7a552ed4d940dfaa65` |
| AGENT | `src/lib/browser/exact-target/browser-mutation-store.ts` | `355561d135ba101944e882294dd39909313684940f278bd6221790b0e336c459` |
| AGENT | `src/lib/local-runtime/production/website-agent-route-policies.v1.json` | `7845f9570c2b29dafa77561eac4c509fe36f02b3395165c236e916b66c2bfaf1` |
| Website | `.github/instructions/agent-rules/功能法案.md` | `954051b78910b0d0a094437958258e0882e5b69fa3df6d344df0375134795792` |
| Website | `docs/blueprints/SYSTEM-BLUEPRINT.md` | `5110c0e3e923d21b26ceff26b2b5f24a27b0e6bf09f2cfcfd09ef1dc2a584e44` |
| Website | `packages/i18n/src/locale-contract.ts` | `2cfb3188769d85b98abf82abeabd1c51b74a56de799ec5081e010114e8faab2b` |
| Website | `packages/ai-contracts/src/agent-task/website-agent-route-policy.ts` | `292af6a366fabeb4e89d5c698d61080861bf2b7231f33add0e8dff412b1d27b4` |
| Website | `packages/ai-contracts/src/agent-task/website-agent-route-policies.v1.json` | `7845f9570c2b29dafa77561eac4c509fe36f02b3395165c236e916b66c2bfaf1` |
| Website | `packages/ai-contracts/src/agent-task/website-agent-task-result.ts` | `eae267d9af9fb1c4b2e51f7ca280d5ee6dce513e241a64b69f4ddb17e082e718` |
| Website | `services/api/src/localization/article-localization-owner.ts` | `bcd4d65e62bb0120dcca8040625bb5f86d15e8cea466bc306bda3315a9588739` |
| Website | `services/api/src/localization/localization-composition-root.ts` | `0fedaacbd691fd62b46eb78116c19c8b2069d6fa9491d727527e3a7c8a222540` |
| Website | `services/api/src/localization/localization-job-repository.ts` | `ddcd45fa733653d05817eb77fc2be35bcdc775ca2e84971b65415173d00c3577` |
| Website | `services/api/src/public-knowledge/worker.ts` | `7c9db95608c425022d3b0b6bb8c160a5c1036c5d8a394f67c0e82534fce75b67` |

### 3.3 当前实现事实

- `seo-gpt-calls.ts:56-177` 对同一中文文章 task/attempt 复用一个 sessionKey，只在首段执行 `prepare_clean_gpt_chat`；现役三段已经位于同一 conversation。
- `localization-production/flow.ts:89-100,257-282,347-356` 为每张本地化 task 创建自己的 sessionKey，并在没有本工单 confirmed submit 时固定执行 `prepare_clean_gpt_chat`，所以每种语言必开新聊天。
- Website `article-localization-owner.ts:21-72` 按 `targetLocales` 找缺口后在一个循环中立即创建全部缺口；`locale-contract.ts:1-12` 固定目标顺序为 `zh-HK -> zh-TW -> en-US -> ja-JP -> ko-KR`。
- Website task wire 与 repository 已支持完整 `parent_task_ref + parent_result_ref + parent_result_hash`；无需新增 task 字段或父关系表。
- AGENT/Website route policy 当前 `relation_kind` 只有 `primary | followup | review`；没有一种语义可以同时表达“本任务必须回到 direct parent conversation”并保持现有 Bazi 等 follow-up 继续 fresh。
- Browser WAL 已对每个 CONFIRMED provider effect 加密保存 canonical conversation URL 和 exact user turn；普通业务 admission 后只释放 job-bound Target，不清除 WAL。当前 store 只能按本工单/精确 call 读回，没有“按已授权前序 job 取得唯一 conversation locator”的窄读口。
- 当前每个 job 独占一张 system Target。这个边界无需改变：跨任务只复用 conversation URL，不复用、转让或保留前序 tab。
- Website migration `0054_ai_production_localization_contract_manifest.sql:60` 虽已有 `predecessor_ai_production_job_id`，当前主链没有真实消费者；本方案不为了“看起来相关”而启用它。
- 每张本地化任务仍只有一个 Provider turn，现役 `max_provider_turns=8` 无需改变。

## 4. 四维映射与权威冲突

| 维度 | 当前权威/事实 | 真实 GAP | 目标裁决 |
| --- | --- | --- | --- |
| 法案系统 | AGENT `LAW-ARCHITECTURE-BOUNDARY-001-V9`、`LAW-CAPABILITY-GOVERNANCE-001-V13`、`LAW-GPT-001-V51`、`LAW-GPT-002-V12`、`LAW-LOCAL-BROWSER-SESSION-003-V36`、`LAW-LOCAL-BROWSER-SESSION-006-V30`；Website `LAW-AI-ACCEPTANCE-009-V6`、`LAW-AI-ACCEPTANCE-012-V26`、`LAW-LOCALIZATION-013-V11`、`014-V2`、`015-V2`、`019-V6` 均冻结 fresh/零跨任务 continuation | 本需求与 P0/Tombstone 直接冲突，普通代码施工不能合法实现 | 先获明确解冻；只为精确文章五语链建立例外并立即重新冻结。其它 route 不变 |
| 施工图 | AGENT 三份 blueprint 与 Website `SYSTEM-BLUEPRINT.md:318,341,439-463` 明示每张动态翻译 fresh single-stage | 没有“Website 父身份授权 -> Browser 前序 WAL locator -> 当前 job 新 Target”的 handoff | 双仓同步画出唯一 continuation 主链，并保留 Website admission 作为每一步门 |
| 代码 | Website 同时建五张任务；AGENT 每张翻译都 fresh；Browser 无前序 locator 窄读 | 第一个直接断裂在 Website producer：未等待前序 admission 且未签发 parent；随后 AGENT 无合法依据只能 fresh | sender 串行；现有 parent 三元组签发；route policy 授权；Browser 内部精确读 WAL；Product 不再 fresh |
| 质检 | 两仓各自唯一 `quality:check`；现役 acceptance 反向断言动态翻译零 continuation | 当前绿灯会把目标行为判错；尚无同 URL 六任务与五次 Website readback 证明 | 同步替换冲突断言；各仓独立质量 verdict；最后用真实 Browser + Website admission/readback 证明 |

需要替换的是精确冲突条款，不是删除总体隔离原则。目标新冻结语义应是：跨任务 Provider continuation 默认物理不存在；唯一例外是 route policy=`provider_continuation`、当前 route=`localization_article_translation/article_translation`、父三元组完整且 Website 已接纳 direct parent、Browser WAL 对 parent 只能解析出一个 canonical conversation URL 的五语派生链。

## 5. 第一直接断裂

第一处直接断裂位于 Website `services/api/src/localization/article-localization-owner.ts:68-72`：唯一 sender 得到五个缺口后立即创建全部任务，没有等待前一个 locale 的 Website admission，也没有给下一个任务签发 direct parent result identity。

下游后果是：五张任务彼此独立可领取；AGENT `localization-production/flow.ts:277` 对每张任务合法地执行 `prepare_clean_gpt_chat`；Browser 也没有任何跨任务会话授权。因此截图中的频繁新聊天不是页面偶发现象，而是现役 producer、route contract、Product flow 和 Browser authority 一致导出的结果。

只删除 `prepare_clean_gpt_chat` 不能修复：任务仍可能并发、没有父身份、进程重启后找不到 exact conversation，并会把当前页面误当父聊天。只把五次翻译塞进中文 Product 也不能修复：它会绕过五张 Website localization job、五次独立 validation/admission/recovery 和 durable locale readback。

## 6. Identity spine 与有限闭环分母

### 6.1 贯穿身份

```text
canonical article identity
  = article_id + canonical_version + article_markdown_hash

locale business identity
  = public_knowledge_article + canonical identity
    + target_locale + policy_version

AI task identity
  = localization_job.job_id
    -> ai_production_jobs.job_id
    -> source_task_id/request_hash/result_revision

direct continuation authority
  = parent_task_ref
    + parent_result_ref
    + parent_result_hash
    + route relation_kind=provider_continuation

Provider locator identity
  = Browser WAL[parent_task_ref]
    -> exactly one decrypted canonical conversation URL

final business truth
  = Website localization admission receipt
    + released locale edition readback
```

固定 locale 序列只有五项：`zh-HK(1) -> zh-TW(2) -> en-US(3) -> ja-JP(4) -> ko-KR(5)`。第 1 项 direct parent 是中文文章 AI job；第 2-5 项 direct parent 是上一 locale 的 AI job。不得跳项、回环、按 latest 猜父节点或把任意历史翻译接入。

### 6.2 分母状态与终态

| 当前状态/事件 | 唯一 Owner | 转换与输出 | 终态/恢复接点 |
| --- | --- | --- | --- |
| zh-CN 未 Website admitted/released | public-knowledge Owner | 不创建翻译 | 保持原文章主链 |
| zh-CN admitted，五语均缺失 | localization sender | 只创建 zh-HK，parent=中文 AI result | 等 zh-HK admission |
| 当前 locale task 已存在且未业务接纳 | ai-acceptance/localization Owner | 不创建后序、不建重复 task | 原 task attempt/recovery 主链 |
| 当前 locale 已业务接纳并精确 readback | localization sender | 只创建下一固定 locale，parent=当前 locale result | 下一 locale 或五语完成 |
| locale 缺口顺序不构成严格前缀 | localization Owner | typed fail-close，零新 task | 人工阻断；不得猜测或补跳 |
| parent 三元组缺失/不一致/未接纳 | Website task producer | typed fail-close，零 task 或零 claim | 修复 Website 权威事实后重入 sender |
| parent WAL 为零、多个 URL、损坏或有 unresolved effect | Browser Owner | typed fail-close，零导航、零 submit | 当前 job 失败；Website 决定合法新 attempt，仍精确读同一 parent |
| 当前 job 尚无 confirmed submit，准备失败且物理输入为零 | Website/Browser 现役 recovery | 新 attempt 可重新取得同一 parent conversation | 回到当前 locale，不创建后序 |
| 当前 job 已 DISPATCHED/CONFIRMED 或结果未知 | Browser WAL + Website recovery | 只做本 effect 的零 submit readback | 取得同一结果或保持阻断 |
| Provider 回答已解析但 Website 拒绝 result revision | Website | 同一 job 新 result revision；在同一 conversation 追加一次修正 turn | 仍是当前 locale；不得创建后序 |
| 每个 locale Website admitted | localization/public-knowledge Owners | 同事务发布该 locale edition | 允许 sender 创建下一 locale |
| ko-KR admitted 且五个 readback 全部成立 | Website | 链完成 | 唯一业务成功终点 |
| 取消/永久撤销/管理员删除 | Website | 使用现役 terminal/revocation/purge；已发生 effect 不重放 | 现役终态；不得自动建 successor |

正常成功路径恰好新增五个翻译 Provider turn。Website 合法拒绝后的 result revision 可能为当前 locale 增加修正 turn；这是异常恢复，不得伪称“正常仍只有五 turn”。

## 7. 合同 handoff

### H1：public-knowledge admission -> localization sender

- Producer：Website public-knowledge Owner。
- Consumer：Website article localization sender。
- 输入必须同时证明 `public_knowledge_runs.status='admitted'`、非空 `admission_receipt_hash`、对应 `ai_production_job_id` 的 completed result ref/hash、同 article 的 zh-CN publication=`released`。
- 输出：固定 canonical article identity 与中文 AI job/result 三元组。
- 任一缺失即零翻译 task；仅看 released 页面或 HTTP 成功不够。

### H2：locale predecessor -> next locale task

- Producer：Website localization Domain Consumer。
- Consumer：同一 Website sender/task repository。
- 前四个 locale 必须有 `localization_jobs.state='completed'`、exact bound AI job、completed result ref/hash、business consumption/admission receipt 和已 released locale edition readback。
- 新 task 复用现有顶层 `parent_task_ref/result_ref/result_hash`，不把 conversation URL 放入 Website、task、material、参数、日志或数据库。
- 新 task 的 source material 仍由同一 zh-CN canonical article 生成；不附加父译文。

### H3：Website task -> AGENT route authorization

- 双仓同一 canonical route projection 把唯一文章翻译 primary route 的 `relation_kind` 从 `primary` 改为新枚举 `provider_continuation`。
- Task schema 对该 exact product/action 要求完整 parent 三元组；报告翻译 primary 禁止 parent；review 继续使用 subject 三元组；其它 follow-up 规则不变。
- Runtime 只机械消费 route policy，不按 product/action 写第二白名单。未知 relation kind、缺字段、额外字段、projection/hash 不同一律 claim 前失败。

### H4：AGENT Runtime/GPT -> Browser continuation acquisition

- Runtime 创建 GPT execution 时只下传 task 已验真的 `parent_task_ref` 与 route policy relation kind；Product 不接触 URL。
- `ProductionGptBrowserLifecycle` 的第一次 browser acquire 对 `provider_continuation` 使用新 target mode `authorized-continuation`；普通 route 仍是 `fresh`，本 effect 恢复仍是 `confirmed-readback`。
- Browser Authority 内部从唯一 BrowserMutationStore 按 parent job 读取所有已确认 provider-effect terminal payload：必须无 unresolved mutation、至少一条 CONFIRMED、所有可用 canonical URL 去重后恰好一项、URL 通过现役 ChatGPT web policy。中文任务的三段 submit 应得到同一 URL；任一漂移都失败关闭。
- Extension 为当前 job 创建/取得一张新的 job-bound system Target；仅在新建时以加密 request-only payload 导航到该 exact URL，2500ms 总闸门后 fresh current Document readback 必须相等，再发布当前 job claim。不得复用前序 tab 或把 URL写入日志/reply/第二 WAL。

### H5：Product turn -> Website admission

- `localization-production` 只有 exact `provider_continuation` route 物理删除首个 `prepare_clean_gpt_chat` 调用；profile、四份材料、Prompt、一次 submit、checkpoint、解析与 output schema 不变。
- 本次 submit 的 Browser WAL 继续在当前 job 下记录同一 canonical URL 与新 userTurnId，成为下一 locale 的唯一 locator 来源。
- AGENT completion/Outbox/HTTP 仍是中间态；Website localization consumer 的 admission receipt 与 locale edition readback 才开启下一任务。

## 8. 删除审判后的唯一目标链

```text
Website 接纳并发布 zh-CN 文章
  -> 唯一 sender 读取五语严格前缀
  -> 创建唯一 next locale task + direct parent result 三元组
  -> 双仓 route policy 机械确认 provider_continuation
  -> Browser 从现有 WAL 解析 parent 唯一 URL
  -> 为 current job 建立自己的 system Target 并精确导航/readback
  -> localization Product 用同一 zh-CN source 执行一次 translation turn
  -> 当前 job WAL 确认新 turn 和同一 URL
  -> AGENT 交付 result
  -> Website 校验、admit、持久化、released edition readback
  -> 回到同一 sender 创建下一 locale
  -> ko-KR readback 后五语闭环
```

没有第二 orchestrator：Website 现有 worker 继续调用同一 sender；sender 每轮最多前进一步。没有 Browser conversation store：现有 provider-effect WAL 是唯一 locator 事实。没有 tab handoff：每个 job 仍有自己的 tab，只打开同一 URL。没有翻译链：五次都消费相同 zh-CN source hash。

当前 dirty overlay 中的 `rename_settled_gpt_conversation` 继续仅处理非权威标题。本方案不新增“链标题 Owner”或延迟重命名状态；即使同一 URL 在各 job settlement 后发生显示标题变化，continuation 只能按 WAL URL 定位，验收不得读取标题。

## 9. 原子工单

### WO-01：双仓 authority 精准解冻、替换并重新冻结

- 当前必要性：没有该工单，目标行为直接违反现役 P0/Tombstone。
- Owner/仓库：AGENT governance Owner 与 Website governance Owner，各自只修改自己的现役法案、依赖版本、registry projection 和 blueprint。
- AGENT 允许范围：`功能法案.md` 中第 4 节列出的直接冲突 law 及机械依赖版本；三份相关 blueprint；现有 manifest/inspector/generated registry。
- Website 允许范围：第 4 节列出的 acceptance/localization laws、`SYSTEM-BLUEPRINT.md` 及现有 registry/inspection projection。
- 动作：把“全局零跨任务 continuation”收窄为默认禁止 + exact article localization exception；同时冻结 parent 权威、五语顺序、同源 hash、Browser URL 私密边界、每 job 独占 Target、Website admission 门和其它 route 继续 fresh。
- 完成门：两仓现役 law corpus/registry/blueprint 无旧绝对禁止与新例外并存；未获得用户明确解冻授权前本工单不得启动。

### WO-02：Website 串行 sender 与 direct parent task 合同

- Owner/仓库：Website localization Owner，`/Users/nexgen/Documents/xuanxue-web`。
- 允许修改：`article-localization-owner.ts`、`localization-composition-root.ts`、task relation schema/route policy canonical projection，以及直接验收/审计文件。
- 动作：
  1. sender 在事务性 snapshot 中验证五语现状是固定序列的严格前缀；
  2. 一次调用最多创建第一个缺口；已有当前任务则零创建；
  3. 第一个 locale 的 parent 从 exact admitted public-knowledge run/result 取得；后续 parent 从 exact previous locale admitted task/result 取得；
  4. `createTerminalLocalization` 对文章 continuation 要求完整父三元组并写入现有 task；报告调用面不变；
  5. task validator 精确允许 article translation parent，并继续拒绝 partial/extra relation。
- 权威输出：一张现有 identity 下的 localization job 与一张含 exact parent 的 Website task。
- Consumer readback：同事务回读 task/request hash、localization-to-AI binding；下一轮 sender 只能在业务 admission 后前进。
- 物理删除：删除文章 sender 的 `for (const locale of snapshot.missing)` 全量创建路径和任何按缺口跳序的逻辑；不留开关/旧路径。

### WO-03：双仓 route policy 单一合同切换

- Owner：Website canonical route policy；AGENT 只消费由受控构建产生的同值 projection。
- 动作：现有 relation enum 新增且只新增 `provider_continuation`；只把 `localization_article_translation/article_translation` primary route 改为该值。参数、四个 material role、result contract 与 max turns 不变。
- 完成门：Website canonical JSON 与 AGENT projection 字节/hash 相等；全路由枚举证明仅一条 route 获得该权限；所有未知或错误 parent 组合在 Website 创建或 AGENT claim 前失败。
- 物理删除：原 article route 的 `primary` 语义；不得保留兼容接受两种 relation kind。

### WO-04：Browser 前序 WAL locator 与 authorized-continuation Target

- Owner/仓库：AGENT Browser Owner。
- 允许修改：现有 mutation store、target lease/wait、lane coordinator、target acquirer、WebSocket typed acquisition、Extension target authority 与直接 acceptance/audit；不新增模块层级或 store。
- 动作：
  1. 在现有 `BrowserMutationStore` 新增一个内部窄读：输入 exact predecessor job id，输出恰好一个已解密、已校验 canonical conversation URL；
  2. target mode 增加 `authorized-continuation`，且必须同时携带当前 execution binding 与 predecessor job identity；
  3. coordinator/acquirer 在唯一 FIFO/lane 内解析 URL，Extension 只接收加密 request-only URL；
  4. Extension 创建当前 job 独占 tab，精确导航、2500ms gate、fresh URL readback 后才 claim；已为当前 job 停驻的 Target 只可原位 reacquire，不重复导航；
  5. URL、parent id 与页面正文不得进入日志、proof、reply、artifact 或 Website。
- 失败门：零/多 URL、损坏密文、父 job unresolved mutation、URL policy 不符、导航/回读不等、Target 歧义全部在任何 Prompt/submit 前失败；不得退回 fresh chat。
- 验收：中文三段同 URL 可唯一收敛；不同 URL 必拒绝；前序 tab 已关闭仍可新建当前 tab并到同 URL；两个 job 的 target/jobRefHash 绝不相等。

### WO-05：GPT lifecycle 与 localization Product 接线

- Owner/仓库：AGENT GPT Owner 与 localization Product Owner；同仓分两个原子提交面，不互相复制职责。
- 允许修改：`executor.ts`、`production-child-tools.ts`、`production-browser-lifecycle.ts`、`localization-production/flow.ts` 及直接 tests/audits。
- Runtime/GPT 动作：把 route relation 与 parent job id 注入当前 GPT execution；第一次 acquire 机械选择 fresh 或 authorized-continuation；confirmed current effect 始终优先走现役 confirmed-readback，绝不再次 submit。
- Product 动作：article continuation flow 删除 fresh-chat Child；其它动态/静态本地化 flows 保持原调用序列。所有 translation Prompt 继续绑定同一 source/locale/material hashes。
- 完成门：正常 article locale 的 `prepare_clean_gpt_chat` 调用数为 0、submit 为 1；report translation fresh 调用数仍为 1；当前 job confirmed recovery 的 submit 增量为 0。
- dirty overlay 门：聊天自动重命名代码必须保留且验证其标题不参与 locator；不得用覆盖或回退方式解决共享路径冲突。

### WO-06：跨仓质检、切换与生产闭环

- Owner：每仓各自 quality Owner；Website 是最终业务证明 Owner。
- AGENT 原生入口：Node `>=24`，`npm run quality:check -- CHANGE`，clean candidate 后按现役规则进入 READY/RELEASE。
- Website 原生入口：`npm run quality:check -- CHANGE`，clean candidate 后按现役规则进入 READY/RELEASE。
- 静态/acceptance 分母见第 11 节；生产 proof 必须使用一篇切换后新接纳的文章，记录六张 task 的 URL hash/turn 顺序和五次 Website admission/readback，不泄露 URL 正文。
- 完成门：两仓独立 quality verdict 通过、合同 hash 同值、真实 Browser 五个翻译 turn 位于源文章同一 conversation、Website 五语全部 durable readback。任一低层绿灯不得替代该门。

## 10. 跨仓施工、drain、cutover 与回退

### 10.1 施工前置

1. 取得第 0 节明确解冻授权。
2. 重新记录两仓 realpath/branch/HEAD/upstream/status 和第 3.2 节全部相关 hash；任何相关漂移只重算受影响方案。
3. 对 AGENT dirty overlay 逐文件归属，确认可原位合并；无法区分用户改动时停止施工。
4. 两仓分别形成 clean commit；不得用 dirty checkout 宣称 READY。

### 10.2 无兼容桥切换

1. 由现役 Owner 停止新的 public-knowledge 文章投产与文章 localization sender/claim，不改库猜状态。
2. 只读盘点切换 fence 之前全部 released zh-CN 文章。每个版本必须已经五语全部 Website admitted/readback；所有旧 article-translation task 必须没有 queued/claimed、未消费 completed result、DISPATCHED/unknown Browser effect 或待恢复状态。
3. 若存在旧欠账，继续用旧版本原主链 drain；不能合法完成的对象保持阻断并另行取得清理/恢复授权。本方案不修改 immutable task，不删除历史，不建立旧/新双路。
4. claims 保持停止时部署两仓 canonical contract/实现；中间 hash 不一致期禁止领取任务，因此无需兼容解析。
5. 重新建立 Website-AGENT session，验证 canonical route projection/control contract hash 相等；验证 Browser mutation store 可读且 unresolved 分母为零。
6. 先恢复 Website/AGENT 基础握手，再恢复 public-knowledge 新文章与唯一 sender。只有 fence 后新接纳的文章进入新链。
7. 对第一篇 canary 完成六任务同 URL与五次 Website readback 后，才恢复常态吞吐。

### 10.3 回退边界

- 第一张新合同任务发生任何 Provider submit 之前：停止 claims，删除尚未对外产生 effect 的新 task 只能走现役、明确授权的删除 Owner；两仓回退到各自 cutover commit 前 clean 点并重新验证旧合同 hash。
- 第一张新合同任务一旦 DISPATCHED/CONFIRMED：该链进入 roll-forward-only。停止新 claims，保留 task/result/WAL，按同一 contract 修复并从 confirmed readback 或当前 locale 重入；不得降级旧 AGENT、fresh-chat fallback、删除 WAL 或重放 submit。
- 已 Website admitted 的 locale 永不回滚或改写。后续未创建 locale 只保持缺口，待同合同恢复后由原 sender 接回。

## 11. 分层验收

### 11.1 Authority/contract 静态验收

- 两仓 active law、registry、blueprint 对唯一 exception 完全一致，不再同时存在“全局物理禁止”和 article exception。
- route 总分母中 `provider_continuation` 恰好一条：`localization_article_translation/article_translation`。
- Task parent 三元组要么全有要么全无；article continuation 必须全有；report/review/其它 route 误带必须拒绝。
- Website 与 AGENT route policy 文件及依赖 spec hash 精确一致。
- 负向扫描证明没有 conversation URL/continuation token 进入 Website schema、DB、material、task、Outbox 或日志。

### 11.2 Website 验收

- 五语全缺时只创建 zh-HK；重复、并发 sender 仍只有同一 durable job/task。
- zh-HK 未 admission 时零 zh-TW；admission/readback 后只创建 zh-TW；依序覆盖五项。
- 缺口为非严格前缀时 typed fail-close，零新 task。
- 每张 task 的 parent 指向直接前序，首张指向中文 source AI job；parent result hash 与数据库 completed/admitted result 精确相等。
- 五份 source material 的 canonical article id/version/hash 全相等；任何前序译文均未成为 source。
- 每个 locale 独立拒绝、revision、receipt、released edition 与 readback；某 locale 失败时后序为零。

### 11.3 AGENT/Browser 验收

- parent job 具有 1 条或多条同 URL CONFIRMED effect 时解析为一个 locator；零条、多 URL、unresolved 或密文损坏均零导航/零 submit。
- authorized-continuation 为当前 job 新建独占 Target；前序/current jobRefHash、targetRef 不混用，页面 URL fresh readback 相等。
- article locale 不执行 fresh-chat Child，其它 Product 的现役 fresh 行为逐项不变。
- 正常当前 locale 物理 submit 恰好 1；当前 effect DISPATCHED/CONFIRMED 恢复物理 submit 增量 0。
- Provider 返回错误、超时、页面丢失或 Website 拒绝都不创建第二 conversation store、第二 queue 或 fresh fallback。
- settled rename 可成功或 cleanup-fail，但标题永不参与 acquire、submit、recovery 和验收。

### 11.4 真实端到端终验

选择一篇 cutover 后新生成、最终 Website admitted 的 zh-CN SEO 文章：

1. 证明中文任务与五张 locale task 的 confirmed canonical URL hash 相同；原始 URL 不进入公开证据。
2. 证明五个 locale 的 user turn 顺序严格为 `zh-HK, zh-TW, en-US, ja-JP, ko-KR`，且每次 Prompt/source hash 都绑定同一 zh-CN canonical hash。
3. 证明正常路径五张翻译 task 的 Provider submit 总数各 1、合计 5；没有额外 clean-chat submit。
4. 从 Website 分别 readback 五张 localization job、AI result、domain admission receipt、translation binding、locale payload、released edition。
5. 对同一文章的六个 locale 公开读取做 exact article/version/locale readback；仅当五个目标 locale 全部成立，需求才完成。

Browser/Provider 页面成功、AGENT result settled、HTTP 2xx、Outbox 到达或 quality:check 绿色均不能单独满足第 5 项。

## 12. 删除反事实裁决

| 目标结构 | 当前必要性与真实消费者 | 删除后的具体失败 | 裁决 |
| --- | --- | --- | --- |
| Website 串行 sender | 下一 locale 必须等待前序 admission；task producer 直接消费 | 五任务并发，无法形成同聊天确定顺序 | 保留，替换全量循环 |
| 现有 parent 三元组 | Website 签发、AGENT lifecycle 消费 exact direct parent | Browser 只能猜当前/最近聊天 | 复用，不新增字段 |
| `provider_continuation` relation kind | Runtime 需要区分唯一可续接 route 与仍需 fresh 的 follow-up | 复用 `followup` 会误授权其它产品；产品硬编码会产生第二白名单 | 只新增该枚举值 |
| Browser WAL 窄读 | Browser acquirer 需要 parent exact URL | 重启/关 tab 后不能确定回到哪里 | 在现有 store 原位新增读口 |
| authorized-continuation target mode | 当前 job 要在 claim 前精确到 parent URL | 删除后只能 fresh 或滥用 confirmed current-effect 恢复 | 保留一个新 mode |
| 新表/continuation ledger | 无真实消费者；parent task + WAL 已覆盖 | 删除后主链仍完整 | 禁止新增 |
| tab 转让/长期保留 | URL 可在新 job tab 精确恢复 | 删除后主链仍完整且隔离更强 | 禁止新增 |
| 五语 aggregate task/result | Website 必须逐 locale 接纳 | 删除后反而恢复现役业务边界 | 禁止新增 |
| 兼容桥/feature flag/双读 | claims 停止时可原子切合同 | 删除后 cutover 仍闭合 | 禁止新增 |
| 使用 dormant predecessor attempt 列 | task parent 已是唯一业务关系，当前无消费者 | 删除后无 handoff 缺口 | 不启用 |
| 链级标题状态 | canonical URL 已是 authority | 删除后定位与完成均不受影响 | 禁止新增 |

经删除门禁后，新增面只剩：一个 route enum 值、一个 Website 串行决定、现有 task parent 字段的一个新合法消费者、现有 Browser store 的一个窄读和一个 Target acquisition mode。再删除任一项都会在真实 handoff 中失去顺序、授权或 exact locator。

## 13. 反向攻击与施工 Codex 重绑定要求

从最终五语 Website readback 反查，施工 Codex 必须逐项证明：

- 五个 edition 各自来自同 article/version/hash，而不是译文链或另一篇文章；
- 每张后序 task 的 direct parent 已业务接纳，不是仅 Provider finished 或 HTTP delivered；
- 每次 Browser 进入的是 parent WAL 唯一 URL，且 Target 属于 current job；
- 当前 effect 已发生/未知时没有第二次 submit；
- source/locale/task/request/result/admission 任一身份漂移均在后序创建前关闭；
- 旧全量 sender、article fresh-chat 路径、双 relation 接受、URL fallback 和第二 store 均物理为零；
- 两仓 candidate、dirty overlay、law registry、route projection 与唯一 quality verdict 都在执行时重新绑定。

本文件已在施工开始前原位更新为`可施工`并记录授权、双仓candidate与dirty overlay裁决；不得创建`v2/final/修订版`竞争方案。若用户改变locale顺序、允许范围、历史欠账处理或任务边界，必须重开本文件受影响部分，而不是边施工边猜测。
