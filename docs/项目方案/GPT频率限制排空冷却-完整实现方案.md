# GPT 频率限制排空冷却完整实现方案

> 状态：**设计阻断**
>
> 需求 Owner：AGENT GPT 生产执行链；Website 是工单授权、冷却和最终业务接纳 Owner。
>
> 唯一产物：本文件。
> 本文件只定义施工方案，不授权修改法案、施工图、合同、代码、数据库、Browser、生产状态或执行发布。

## 1. 需求、权威终点与范围

### 1.1 本次必须同时成立的结果

1. GPT 页面出现已知“请求过于频繁”弹窗后，系统先读取当前 Document 的实时 DOM，且只在精确识别唯一弹窗、唯一可操作“明白了”按钮时点击。
2. 除同一次精确识别后紧接的一次“明白了”确认外，ChatGPT 页面上两个相邻逻辑访问周期的起始时间必须全账号、全 Tab 共用同一节拍且相隔至少 1.5 秒；50ms、25–250ms、1 秒 deadline 尾读等会导致亚 1.5 秒重观测的路径全部物理退出。一次逻辑访问周期内部完成同一 coherent observation 或同一原子输入所必需的 CDP primitives 不被错误拆成多次等待。
3. “明白了”是唯一紧急例外：从完成该次 DOM 分类到发出一次点击，正常链路目标不超过 1 秒；点击必须占用当前唯一 Browser lane 并在同一次 target/document 绑定内完成，不能排到普通任务后面。例外只豁免 detection→ack 这一对动作，点击后的首次 readback 仍遵守现役 2.5 秒 settlement。
4. 点击之前，本地先关闭“新 claim / 新 Provider submit”门并持久保存同一限频通知；点击确认后才把通知交给 Website。
5. Website 收到并持久化一个新的限频事故后立即停止向该生产设备发放无关新工单，并在同一事务把 Website 唯一当前 N 从 `Ncurrent` 调整为 `max(1, Ncurrent-1)`。首次冷却 5 分钟；恢复后再次发生依次为 10、15、20、25、30 分钟，之后仍为 30 分钟。活动事故窗口内其它 Tab 的同类弹窗只是同一事故的并发证据，不重复 N−1、不升级冷却。
6. 第一次事故冻结该稳定周期的原始 `N0`；每次真正恢复发送后又出现的新事故再执行一次 N−1，直至 N=1。N=1 只有在最后一次冷却结束、事故前已提交任务全部收尾、并从这两个条件同时成立的时点起连续至少 6 小时没有新的精确限流事件时，才原子恢复到 N0；任何新事件重置这 6 小时。恢复 N0 时同时结束本次惩罚周期并把下一次事故重新视为 5 分钟第一阶。
7. 冷却只阻止新工单和尚未发生的 Provider submit，不得停止 lease 续期、同一 Provider effect 的回答读回、已有结果交付、Website consumer 接纳和持久化回读。
8. 限频前已经发生或结果未知的 Provider submit 全部任务必须沿原 `job_id + attempt_id + result_revision + provider_effect_identity_hash` 收敛；事故期间只允许为这些原任务签发零重发读回/交付所需的同身份恢复授权，不得签发无关新工单，不得强制失败、换任务、换 Tab 重发或留在半截状态。
9. 最终完成条件不是弹窗消失、HTTP 200、Outbox delivered 或 terminal completed，而是每次限频事件纳入 cohort 的全部已提交任务均取得 Website 领域 admission receipt 和持久化 readback。

完成分母定义为：

```text
rate_limit_job_cohort
  = 每次新的精确限流事故关闭 submit 门时，本设备全部已获 Website grant 或已被 AGENT durable accept、但尚未 Website admission 的 job 去重集合，与当前未闭合集合取并集

effect_recovery_subset
  = rate_limit_job_cohort 中 submit 已 CONFIRMED 或 DISPATCHED/unknown 的 job；它们只能零 submit 读回同一 effect

unsent_resume_subset
  = rate_limit_job_cohort 中权威证明 mutation_outcome=no 的 job；它们在冷却结束后仍保留同一 job demand，并按降低后的 N 取得 Website 新 attempt 授权后继续完成

closure_remaining
  = rate_limit_job_cohort
    - website_admitted_and_read_back_set

本事故闭环完成 <=> closure_remaining = empty
```

`mutation_outcome=no` 只决定该 job 可以合法取得新 attempt，不是业务完成；不能把它从闭环分母删除。若 Website 依法判定某一已稳定结果 `RESULT_SETTLED_UNUSABLE`，只能复用现役结果拒绝与新 `result_revision` 授权；这仍属于同一 `job_id` 的最终收敛，不允许把旧 Provider effect 当作未发生。只有用户另行作出的现役永久取消/删除/撤权可以合法终止 demand，但这种 job 不能被本事故报告成“成功入库”。

### 1.2 范围

- AGENT：GPT DOM 观察、`checkpoint_gpt_text_response`、Browser typed intent/WAL、Runtime 新 claim/submit 门、现有 `production_outbox`、恢复和验收。
- Website：V6 限频通知合同、持久冷却 Owner、claim 裁决、收据/readback、控制室观察与验收。
- 跨仓：同一合同身份、无兼容桥的 drain/cutover、两仓各自原生质检和真实生产动态证明。

### 1.3 明确非目标

- 不在 AGENT、Browser、环境变量、session 或 heartbeat 复制当前 N；自动 N−1 和 6 小时后恢复 N0 都只能由 Website 在 `ai_production_devices.max_in_flight` 的同一 Owner 行上原子执行。
- 不停止工单创建者写入 queued demand；“停止发送新工单”精确指 Website 不再向设备签发无关新 `job_id` 的 lease/grant。事故 cohort 的原 job 同 attempt/effect 零 submit 恢复授权不属于新工单。
- 不把所有名为 `*Ms` 的协议期限、HTTP deadline、lease、heartbeat 或内部计时机械改写成秒单位；本需求约束的是 ChatGPT 页面访问频率。现役 2 秒附件观察、2.5 秒 action→read settlement、5 秒以上 hydration、40 秒提交后静默门和全设备至少 60 秒 Provider observation 均不降低；任何 deadline 剩余不足 1.5 秒时直接以最后一次事实超时关闭，不为“赶 deadline”补一次亚 1.5 秒 DOM 尾读。
- “秒点”从第一次合规 DOM 观察完成时计算，不虚构页面出现到系统尚未观察之间的时间保证，也不把唯一紧急 ack 扩张成普通 DOM 高频例外。
- 不增加第二 Browser lane、第二 scheduler、第二 retry policy、第二 Outbox、第二冷却表、产品私有暂停机制或人工点击 fallback。
- 不把普通网络中断、登录失败、usage limit 或未知弹窗误判成该已知限频弹窗。

## 2. 输入证据与事实边界

### 2.1 用户截图与本轮实时 DOM

- 用户截图：`/var/folders/wg/jqx8m72j5t73k7b8stzs_kpc0000gn/T/codex-clipboard-a5ebedd6-9f78-4059-aad4-44ce59cca071.png`，SHA-256 `0b8bc089d42ed7750770238959d1c557581f73d217416c99d3039d8a55339a1a`。
- 2026-09-15 本轮只读取得同一 Chrome 会话当前 DOM：恰好一个 `role=dialog`；标题为“请求过于频繁”；正文依次为“你的请求过于频繁。为保障数据安全，我们已暂时限制你访问对话记录。”和“请稍等几分钟后再重试。”；恰好一个启用的按钮“明白了”。
- 当前按钮没有稳定 `data-testid` 或 `aria-label`，dialog 使用生成的 Radix `aria-labelledby`。因此实现不得依赖坐标、生成 id、全页文本扫描或截图 OCR。
- 本轮没有点击按钮、没有刷新页面、没有修改 Browser/Website 生产状态。以上只证明当前弹窗结构，不证明目标代码已经处理它。

### 2.2 用户提供的日志

- AGENT 日志 `/Users/nexgen/.codex/attachments/ab74c195-fe55-493c-adf8-6f42f5ebc51c/pasted-text.txt`，SHA-256 `960f6a71300c6c22d047c8c90bbbca9157684c2e60b81946ccfe2ff6a701220e`；303 个物理行中可独立解析 293 个 JSON event，时间范围 `2026-09-14T19:28:21.575Z` 至 `20:35:39.330Z`。
- 该日志记录 25 次 `job.durable-accept`、19 次 `job.execute` 成功及对应 19 次 `result.upload`/`job.terminal` 成功、5 次 `job.execute` 失败、43 次 `cloud.claim` terminal；第 17 行一次 claim 同时 grant 3 个 job，证明事故现场实际以 N=3 推进，而非单工单串行。
- 第 29—295 行出现 21 个不同 job 的 `GPT_PROVIDER_WAIT_ACTIVE`。相邻 wait event 最小间隔为 5.662 秒，只有一组小于 60 秒；但该 event 在排队观察前发出，不能证明真实 DOM observation 的间距。现役日志没有完整 Browser DOM read 事件，所以不能从日志反推出所有真实页面访问次数。
- 第 44/55/74 行分别首先出现 3 个 Browser `BROWSER_PROVIDER_EFFECT_IDENTITY_DRIFT`；第 230 行首先出现一次 `GPT_ATTACHMENT_UPLOAD_TIMEOUT`；它们各自的 Product/Runtime 失败是后果，不是新的独立根因。
- 同文件第 296 行首先记录 `CLOUD_TRANSPORT_UNAVAILABLE / ECONNREFUSED`，第 297—299 行的 `BROWSER_WAIT_ABORTED` 与下游失败是其后果，第 300 行才是人工 `Ctrl+C` shutdown。
- Website 日志 `/Users/nexgen/.codex/attachments/80c20bb8-fb9e-4365-b519-da69da14dc99/pasted-text.txt`，SHA-256 `bf1fb636e35eece7ed94a1d01d9188a2867ad265168a4f30e3f7b311b0398e71`；它记录 Website 自身的 renew、heartbeat、claim、控制室查询和 terminal 流量，不是 ChatGPT 页面或 `chatgpt.com` 网络流量。
- 两份日志都没有 `Network.*`、ChatGPT HTTP 请求、完整 DOM read 计数或“请求过于频繁”的结构化事件。这不是“没有发生限频”的证据，而是现役代码没有该 DOM 事实与事件合同；“过密页面访问是第一怀疑对象”与代码事实相符，但仍是待 RELEASE 动态证明的因果假设，不能写成日志已证明的唯一根因。
- 日志中的网络中断是另一条直接故障，不能拿它冒充本次限频根因；本方案不顺手修网络问题。

### 2.3 当前页面频率代码事实

- `src/lib/browser/chrome-extension/dom-mutation-postcondition.ts:35-38` 与 `dom-intent-runtime.ts:68-71` 的循环等待上限为 50ms；一个 5 秒 postcondition 理论上可触发约 101 轮逻辑重观测。这是当前最明确的亚 1.5 秒高频入口。
- `open_gpt_execution_profile/handler.ts:51-66` 与 `open_gpt_attachment_control/observation.ts:150-165` 在 5 秒 hydration 内使用 25–250ms 自适应等待；理论上可产生数十次重读，必须退出。
- `reconcile_gpt_attachment_set/observation.ts:219-235` 正常序列从 2 秒起；`prepare_clean_gpt_chat/handler.ts:27-50` 从 5 秒起；`production-browser-lifecycle.ts` 的 Provider observation 为全局至少 60 秒；这些已高于 1.5 秒，但 deadline 尾部仍不得用 `min(remaining, scheduled)` 制造小于 1.5 秒的最后一次重读。
- `debugger-runtime.ts:8,199-220` 已在页面 action 后等待 2.5 秒才允许 read；`browser-command-postcondition.ts:142-163` 已在 Provider submit 后静默 40 秒。两者保留，且 1.5 秒新门不能覆盖或缩短更长的现役门。
- Browser heartbeat 20 秒、Website lease renew/session heartbeat/claim 等控制流不读取 ChatGPT DOM，不属于页面交互节拍；为它们改单位不会降低 Provider 压力，反而会破坏 lease 和收尾，所以明确排除。

### 2.4 既有设计线索

- Website 历史方案 `docs/项目方案/GPT_WEB页面动作与会话重命名终态统一方案.md` 曾列出 `acknowledge_known_rate_limit`，但它不是现役法案/代码事实。
- 当前 AGENT 审计把 `src/capabilities/gpt/web/children/rate-limit-dialog.ts` 列为退役且必须物理不存在；本方案不得复活该路径或建立换名兼容壳。

## 3. Scoped candidate 绑定

### 3.1 AGENT

- realpath：`/Users/nexgen/Documents/AGENT`
- branch：`main`
- HEAD：`49ce44258313c6ad614bc22adeb3af5c66913cdf`；tracking `origin/main`：`406211abf3aa1bebfbcca6b8004946ddecf03057`，本地因已完成的 GPT 聊天重命名提交领先 1 commit。
- 当前工作树：现役法案、GPT/Browser/Runtime 代码与 Blueprint 已由 `49ce4425` 收口为 clean；`N 标签工单独占轮巡模式方案.md` 和 `合婚栏目技能方案.md` 仍有未提交用户改动，另有本文件及两个无关方案 untracked。本文件是此前由当前 Codex 创建并仅由本任务继续修改的唯一方案；冻结 CI 窗口期间已停止写入，恢复后没有改动或重写 `49ce4425`。
- 关键当前字节：
  - `.github/instructions/agent-rules/功能法案.md`：`sha256:18c98aba202c93f8a66df0665a58ddcbc9a432da0103dbd38f3f592a35037db1`
  - `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md`：`sha256:a4e43b12fac94028af4c98ec01f462aaa912ec0a3c7baf8d8beefa33c4915944`
  - `docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md`：`sha256:9edf275f3e1eccb30fc9fd2ab56c1fa981b7e08179ac8f6ea5398e898e5a089f`
  - `docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md`：`sha256:2022745be07d088432527fb2ecfa4c051cfe7a44b0dce7c28e34e41513319e8c`
  - `docs/项目方案/N 标签工单独占轮巡模式方案.md`：`sha256:2f307fc20b362937dfc5768976d15cc9f0c480999bbba2d2a16d92a64cda05ec`
  - `src/capabilities/gpt/children/checkpoint_gpt_text_response/handler.ts`：`sha256:1ad14c615867913cd5227c440f694025c69be7c95e3fdf9322f35e3892f3ad36`
  - `src/capabilities/gpt/web/gpt-dom-observation.ts`：`sha256:918dc1a1fb4cb4e8c7d0f2621ad4cf59a999d32c6fc035b547a244edce425f8e`
  - `src/capabilities/gpt/production-browser-lifecycle.ts`：`sha256:f2ff4c2f04d23a7ccf6f771b6049c14c1fac542bd661bf4b832fbf39b343ce72`
  - `src/capabilities/gpt/children/open_gpt_execution_profile/handler.ts`：`sha256:7634b9f92cf0bba49a906c0e3f05f475d74c83f2cb95d2489af2d760dd799343`
  - `src/capabilities/gpt/children/open_gpt_attachment_control/observation.ts`：`sha256:48427bd11685043a2d07361c5339a29d5db827579c8e29082d17c06e4e8539ae`
  - `src/capabilities/gpt/children/reconcile_gpt_attachment_set/observation.ts`：`sha256:5adc94b1d4a9db258a087ad3a4351b4cacafc23563bebbb87724f7e384e7be9f`
  - `src/capabilities/gpt/children/prepare_clean_gpt_chat/handler.ts`：`sha256:db984c6ea8da8a364001685326887936389899b016fda7c7a36ad48dd7812516`
  - `src/lib/browser/chrome-extension/dom-mutation-postcondition.ts`：`sha256:ef94b687dee83445f5f171ef56a2d91fd79f6c9d0666712bb9313f1d8613a434`
  - `src/lib/browser/chrome-extension/dom-intent-runtime.ts`：`sha256:683c69110fd5b322b6b569d0619946cd347ec861d0ee9117154d90cad9be1926`
  - `src/lib/browser/chrome-extension/debugger-runtime.ts`：`sha256:f2ddb8843d73ecd3f53fac6a292cfab7b388a9650d05c38080334f6b48f0dc7c`
  - `src/lib/browser/exact-target/browser-command-postcondition.ts`：`sha256:427bc6d13857992b4ec82ed4e3effaf8339735581c57d5c3434c34b2edb4daf3`
  - `src/capabilities/gpt/children/rename_settled_gpt_conversation/handler.ts`：`sha256:9c7a611f805a07110f195f09b7134d16efd1af575a110ef7659422bb966d7d72`
  - `src/lib/browser/chrome-extension/gpt-conversation-rename-runtime.ts`：`sha256:74fd6abaef40f8a2c85719737b76903648ad8025cb50c5bb2a7641c543014290`
  - `src/lib/local-runtime/production/runtime-loops.ts`：`sha256:ec2638c9134ed5b1adbe90277de934880b9fa3e323fefa30ef94350ead27d248`
  - `src/lib/local-runtime/production/runtime-startup.ts`：`sha256:0d2ffecceaeea0fee0f861324e21f8491fae3573643fa0a598dee462036e3625`
  - `src/lib/local-runtime/production/store-outbox.ts`：`sha256:4aa0e4798484eea662e11ebc4719f31273e99a8d84a9f9ffeab5ab22515ff98f`

### 3.2 Website

- realpath：`/Users/nexgen/Documents/xuanxue-web`
- branch：`main`
- HEAD / `origin/main`：`53648354d60a266b67bc745ce14fd26d6810f9fd`
- 当前工作树：clean。
- 关键当前字节：
  - `.github/instructions/agent-rules/功能法案.md`：`sha256:954051b78910b0d0a094437958258e0882e5b69fa3df6d344df0375134795792`
  - `docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md`：`sha256:09756bbf62c0d76d80250876e3f89c32f9df39aeab3bc4a46e0d4b751686bc5e`
  - `data/migrations/commercial/0137_ai_production_dynamic_n_tab_capacity.sql`：`sha256:21ea4237fd9261fd7405d7430e3e27de2d30b1133f14321fe5752b417e07775e`
  - `services/api/src/ai-production/job-claim-repository.ts`：`sha256:5463bc96256b23fdedf36c8f10fbce7bedd36cd6e85d8559520cecaeceadf351`
  - `services/api/src/ai-production/device-auth.ts`：`sha256:dddbe23593eefc409d8bea4547ee8cb561390c0e7befed2c4e838233c11db50f`
  - `services/api/src/ai-production/control-plane-status.ts`：`sha256:7a1ba83d65a94a08c04166836e65b6c13cd3bccd4c439d3222d43a43ef3e1c04`
  - 当前 commercial migration 尾号：`0138`；施工时只在重新绑定后裁决下一 migration 名称。

任一关键字节、HEAD、分支或相关 dirty overlay 变化，都必须重新计算受影响的设计段；不得照抄本方案中的文件清单施工。

## 4. 四维映射与第一直接断裂

| 维度 | 当前权威/实现 | 当前 GAP | 目标落点 |
|---|---|---|---|
| 法案系统 | AGENT `LAW-GPT-001-V51`、`LAW-GPT-002-V12`、`LAW-LOCAL-BROWSER-SESSION-003-V36/004-V39/006-V30`、Runtime `001-V59` 至 `008-V33`；Website `LAW-AI-ACCEPTANCE-001-V6/002-V24/003-V8/004-V24/012-V26/013-V8` | 未授权 GPT 对该弹窗做目标内确认；未定义全账号页面访问至少 1.5 秒、Provider 冷却、自动 N−1、N=1 稳定 6 小时复原和“冷却不杀已提交任务” | 获得用户独立 law-amendment 授权后，精确替换相关 major 并重建唯一 registry |
| 施工图 | 一 job 一 system Tab、一 Browser lane、Website 独占当前 N/attempt/admission、正常回答同 effect 读回 | `N 标签`方案把限频列为 NO-GO 且明确禁止自动降 N；与本次新需求直接冲突，没有生产处置主链 | 在现役 GPT、Browser、V6 和 AI-acceptance 蓝图各自 Owner 段落补同一合同，并同步替换 N 标签方案的冲突断言，不新建竞争蓝图 |
| 代码 | Browser action→read 已有 2.5 秒、Provider observation 60 秒，但 postcondition 仍以 50ms、两个 hydration 以 25–250ms 重读；Runtime `state.draining` 会在 shutdown abort 全部 active job；Website 当前 N 只在 device row，draining 能挡 claim | 没有全账号 1.5 秒页面访问门、弹窗 DOM fact、原子确认、持久通知、Provider 冷却门、自动 N−1/N0 恢复；现有 shutdown drain 不能复用 | 复用 Browser lane/现有等待 Owner 收口节拍；checkpoint 增已知 blocker 分支；现有 Outbox 增一种写；Website device row 原子改当前 N，控制单例只存惩罚周期必要事实；claim 同事务拒绝新 grant |
| 质检 | 两仓各有唯一 `quality:check`，现有 GPT/Browser/Runtime/AI acceptance 与 real proof | 没有 1.5 秒全局页面访问证据、DOM、阶梯、N−1/6小时复原、并发、崩溃恢复、已提交全入库分母 | 扩展现有 domain inspector/acceptance/dynamic proof；不建专属第二质检入口 |

**第一直接断裂分为同一事故链的两个相邻入口：** Browser/GPT 已经允许 50ms 与 25–250ms 的 ChatGPT DOM 重观测，缺少全账号至少 1.5 秒的频率门；当 Provider 已弹出限频 dialog 后，`gpt-dom-observation.ts` 和 `checkpoint_gpt_text_response` 又只把页面解释成“回答 pending/settled”，没有 typed fact、一次确认或通知 Website claim/N Owner 的合法路径。前者使过密访问风险真实存在，后者使事故发生后页面阻塞与继续签发无法闭环。日志不能证明前者是唯一网络根因，但代码足以证明两处合同 GAP 都必须修。

## 5. Identity spine 与有限状态分母

### 5.1 身份

限频事件：

```text
provider_scope = chatgpt_account_on_authorized_browser
incident_request_id
incident_observed_at
incident_dialog_hash
incident_level
penalty_epoch_id
baseline_n
new_current_n
trigger_job_id
trigger_attempt_id
trigger_result_revision
trigger_exact_call_id
browser_target_ref_hash
browser_document_ref_hash
dom_observation_hash
browser_ack_receipt_hash
website_cooldown_receipt_hash
```

任务收尾继续使用现役身份：

```text
job_id
attempt_id
lease_version + fence_token
result_revision
provider_effect_identity_hash
user_turn_id
result_payload_hash
terminal_receipt_hash
business_admission_receipt_hash
domain_storage_readback_hash
```

跨仓通知不传 conversation URL、原始回答、原始弹窗正文或 Browser 私有 WAL；只传固定 reason code、身份、计数、时间和 hash。

### 5.2 分支表

| 事件发生时状态 | 唯一决定 | 冷却期间允许 | 禁止 | 最终落点 |
|---|---|---|---|---|
| submit 已 CONFIRMED、答案 pending | 保留同 attempt/effect | lease renew、精确 Tab observation、确认弹窗、同 effect 回答读回、交付/admission | 重发、换 Tab、attempt failure | Website admission + storage readback |
| submit DISPATCHED、结果未知 | 先按现役 WAL/receipt/postcondition 零 submit 对账 | exact readback、同身份恢复 regrant | 盲点发送、创建替代任务 | CONFIRMED 后同上；否则由现役 authority 证明 `mutation_outcome=no` 并从 cohort 关闭 |
| 已有 staged/terminal、admission pending | 继续现有 Outbox 和 consumer | delivery、receipt hydrate、consumer retry/readback | 释放业务席位 | Website admission + storage readback |
| 已 claim 但 submit 未 DISPATCHED | 纳入 job cohort，本地 submit 门关闭 | lease/control 协调、必要的无副作用清理 | 冷却中 prompt submit、从闭环分母删除 | Website 持久 `WAIT_NEW_ATTEMPT`，冷却后按降低后的 N 为原 job 新授权并最终 admission |
| 尚未 claim | Website 返回 `DRAINING` + 冷却/旧任务排空原因 | queued 保留 | 无关新 grant | 冷却到期且 cohort 清零后再参与正常 claim |
| 点击结果未知 | 以 Browser WAL/postcondition 对账 | 只读确认 dialog 是否仍存在 | 盲点第二次 | 一次 confirmed ack 或 typed unknown 阻断 |
| 通知 HTTP 结果未知 | 现有 Outbox + Website write receipt 对账 | 同 request id receipt hydrate | 新 request id 重复升级 | Website 同一 receipt readback |
| 冷却期内多个 Tab 报同类弹窗 | Website 合并为同一活动冷却窗口 | 每个 Tab 可各自确认自己的唯一 dialog | 把并发观察算多次升级 | 返回相同步阶与 `cooldown_until` |
| 冷却到期、旧 cohort 全部入库并已实际恢复 grant/submit 后再次出现 | 原子 `level=min(level+1,6)` 且 `N=max(1,N-1)` | 新窗口，同步把本次全部在途 job 并入 cohort | 重置为 5 分钟或杀死超额在途任务 | 10/15/20/25/30/30 分钟，恢复后按新 N grant |
| N 已降到 1 | 保持 N=1，新的独立事故继续按当前/最高阶冷却并重置稳定计时 | 旧任务收尾；冷却和 cohort 清零后以 N=1 正常工作 | 自动升容、按多 Tab 通知重复扣 N | 建立 `stable_since` 或保持 null |
| N=1 且冷却已过、cohort=0 | 第一次满足时持久写 `stable_since=server_now` | 以 N=1 正常 claim/执行/入库 | 静默无工作时伪造 Provider 成功 | 连续无精确限流事件计时 |
| N=1 连续稳定满 6 小时 | 原子 CAS `max_in_flight:1→N0`，关闭 penalty epoch，level 归零 | 正常 N0 | 分步猜 N0、保留旧惩罚阶梯、提前复原 | 下一独立事故从 5 分钟与 N0−1 重新开始 |

`N0` 只在惩罚周期第一次事故时冻结；`ai_production_devices.max_in_flight` 始终是当前 N 的唯一真相。6 小时从“最后一次冷却结束”与“该事故 cohort 全部权威收尾”二者中较晚者开始；任何新的精确限流事件把 `stable_since` 清空。恢复 N0 时同步将阶梯归零，是把连续 6 小时稳定解释为一个新稳定周期的唯一有限规则，避免遗留一个没有终止条件的 30 分钟惩罚状态。

## 6. DOM 与 Browser 动作合同

### 6.1 全账号 1.5 秒页面访问门

Browser 是该频率的唯一 Owner，复用现有单 lane 与 extension runtime，不把节拍复制到各 Product Child。定义：

```text
ordinary_chatgpt_page_access
  = 对 chatgpt.com 当前授权 Document 发起的一次逻辑 DOM observation、Tab/page activation、navigation 或页面 mutation

对任意两个不属于同一 atomic cycle 的 ordinary_chatgpt_page_access：
  next.started_at_monotonic - previous.started_at_monotonic >= 1500ms

唯一 atomic cycle 例外：
  exact rate-limit observation -> 同 Document revalidate -> one acknowledgement click
```

- “逻辑 observation”是一次 typed Browser intent 取得 coherent fact 的完整调用；其中为保证同一快照而执行的 `DOM.getDocument/query/describe/Runtime.callFunctionOn` 等 primitives 不是新的轮询周期，不在它们之间插入 1.5 秒破坏一致性。
- 跨 job、跨 Tab、跨 Product 共用同一 `chatgptPageAccessNotBefore`，不能每个 Child 各自计时。Browser/extension 重启后的第一次普通页面访问也先等待 1.5 秒，因而 crash 不能清空节拍。
- 若更长门同时存在，实际准入取最大值：`max(1.5秒全局门, 2.5秒 action→read, 40秒 post-submit quiet, 60秒 Provider observation, 具体业务 backoff)`。
- deadline 剩余不足 1.5 秒时不再读取 DOM；直接以最后一次 observation 形成 typed timeout。禁止用 `Math.min(remaining, interval)` 在 deadline 尾部补 1–1499ms 的最后一读。
- 协议字段可以继续用整数毫秒表达，避免无价值的跨层单位迁移；质检裁决的是实际相邻页面周期 `elapsed>=1500ms`，不是变量名是否含 `Ms`。

现役路径的目标裁决：

| 当前路径 | 当前事实 | 目标 |
|---|---|---|
| `dom-mutation-postcondition.ts` 与 `dom-intent-runtime.ts` | 重试等待最多 50ms，且有两份同义 helper | 只保留 Browser Owner 下的一份 1.5 秒有界重观测规则；另一份物理删除，不留 alias |
| execution-profile hydration | 25–250ms | 初读后每次重读至少 1.5 秒；5 秒总预算内至多 3 次后续读，尾部不足 1.5 秒不读 |
| attachment-control hydration | 25–250ms | 同上 |
| attachment upload settlement | 2/3/5/7/9/11秒 | 保留序列；任何缩短的 deadline 尾部不触发亚 1.5 秒读 |
| clean-chat hydration | 5/10/15/30秒 | 保留序列；尾部规则同上 |
| Provider response checkpoint | 全局至少 60秒 | 保留，不被 1.5 秒门缩短 |
| action→read settlement | 2.5秒 | 保留；ack 后也适用 |

### 6.2 精确识别

`KnownGptRateLimitDialogFact` 只有同时满足以下条件才成立：

1. 当前 target/document 仍等于该 job 的 system Target 和 fresh current Document；
2. `role=dialog` 数量精确为 1；
3. dialog 内 heading 规范化文本精确为“请求过于频繁”；
4. 两段正文按顺序精确相等；
5. dialog 内按钮数量精确为 1，规范化文本精确为“明白了”，且 `disabled=false`、可见、可交互；
6. 观察包只输出固定枚举、计数、hash、target/document identity，不输出整页 DOM。

缺一、多一、Document stale 或出现未知文案，均返回 typed mismatch；不得按坐标、按钮序号、全页“明白了”或模糊关键词点击。

### 6.3 原子动作

复用现有 `checkpoint_gpt_text_response`，不新增 Product Child：

```text
fresh readExactAssistantTurn observation
  -> exact known rate-limit fact
  -> Runtime 同步关闭新 claim/submit 门并 enqueue immutable control intent
  -> Browser 在当前 lane/lease 上 revalidate 同一 fact
  -> click 唯一“明白了”一次
  -> fresh postcondition: dialog count = 0, target 不变
  -> Browser WAL settled receipt
  -> Runtime 在点击 receipt 后 deliver Website notice
  -> checkpoint 继续只读同一 assistant turn
```

动作预算：`physical_input_count=1`，navigation=0，submit=0，Tab switch=0。分类完成到 click dispatch 的正常链 SLO `<=1000ms`；该 detection→ack 原子周期不人为等待 1.5 秒。质检同时记录 p50/p95/max，任一超过 1000ms 的受控样本使该 SLO 失败；ack 之后的 readback 至少等待现役 2.5 秒。持久存储不可写时，Runtime 总门已经因 ledger 不健康而失败关闭；Browser 仍只允许确认该精确 dialog，并发出高优先级 fatal evidence，但不得恢复 claim/submit。

旧 `web/children/rate-limit-dialog.ts` 继续不存在；也不新增同义 helper、第二 Child 或插件级特殊分支。

## 7. 唯一目标链与 handoff 合同

```text
GPT checkpoint fresh DOM
  -> Browser: global account page-access gate (ordinary cycle >=1.5s)
  -> Browser: exact dialog fact
  -> Runtime: local provider gate CLOSED + existing Outbox control intent
  -> Browser WAL: exact one-click acknowledgement receipt
  -> Runtime -> Website: immutable provider-rate-limit notice
  -> Website transaction: freeze N0 if needed + current N=max(1,N-1) + cooldown/cohort receipt
  -> Website claim: 冷却中只允许 cohort effect 的零 submit收尾；冷却后按新 N 继续 cohort unsent jobs
  -> effect subset: renew -> exact readback -> result -> existing Outbox
  -> unsent subset after cooldown: same job -> authorized new attempt -> normal submit/result
  -> Website terminal -> domain consumer -> admission receipt -> durable readback
  -> closure_remaining = empty
  -> cooldown expired AND closure_remaining empty: unrelated normal claim lazily resumes at reduced N
  -> N=1 stable_since + 6h without new incident: atomic restore N0 and reset penalty epoch
```

### 7.1 Browser → GPT

- 输入：exact target/document、fresh observation、known-dialog contract version。
- 输出：`absent | exact_present | mismatch`；确认动作输出 Browser WAL logical mutation id、前后 observation hash、postcondition、physical input count。
- unknown：WAL 已 DISPATCHED 时只做 postcondition/readback，不重点击。
- Browser command/receipt 同时给出本次逻辑页面访问 ordinal、单调起始时间差和实际命中的更长节拍；不得记录 DOM 正文。除 detection→ack 原子例外外，任何 `<1500ms` 都 typed fail closed。

### 7.2 GPT → Runtime

- checkpoint 报告触发 job 身份和 dialog hash；Runtime 在允许 Browser click 前必须先用现有 SQLite transaction 写入 immutable Outbox intent，并关闭 claim/submit gate。
- gate 冻结事故时全部在途 job identity；阻止无关新 business claim 和任何未获 cohort 恢复裁决的 `submit_exact_gpt_turn_once`。effect subset 的 exact readback、交付和 admission 始终允许；unsent subset 在 Website 冷却期内不得 submit，冷却后只有匹配降低后 N 的新 attempt 授权才可继续。不得把 `state.draining=true` 当作实现，因为现有 shutdown 会 abort 全部 active job。
- gate 的 restart truth 由现有 `production_outbox` 中未完成/已回执的 `provider_cooldown` 写和 Website receipt 派生，不新增第二本地表。

### 7.3 Runtime → Website

- 扩展现有 `ProductionOutboxWrite.kind` 和 Website write receipt 枚举，唯一新增 kind：`provider_cooldown`。
- 路径绑定触发 job，例如 `POST /internal/ai-production/v6/jobs/{job_id}/provider-cooldown`；请求绑定当前 attempt/lease/fence 和 `incident_request_id`。
- 只有 Browser ack receipt 已 settled 后才 external deliver；如果 ack 失败/未知，本地 gate 仍关闭，通知携带 ack outcome，Website 仍进入冷却，因为精确限频 DOM 已成立。
- HTTP unknown 使用现有设备 job status `write_receipts` 对账并 hydrate 同一 Outbox；不得建立专属重试队列。对账证明远端无 receipt 后，也只能重送同一 immutable request id/body。

### 7.4 Website 冷却与 claim

- 冷却、N 调整和事故排空唯一 Owner：Website AI acceptance。当前 N 继续只存在 `ai_production_devices.max_in_flight`；`ai_production_control_protocol_state` singleton 只保存惩罚周期的正交事实。
- 在控制 singleton 增加当前必要的最小五项：`provider_rate_limit_level`、`provider_rate_limit_until`、`provider_rate_limit_baseline_n`、`provider_rate_limit_stable_since`、有界 `provider_rate_limit_job_cohort_json`。最新 incident/receipt hash 从现有 write receipt 按时间读取，不在控制行复制；cohort 最多受合同安全上限 N=4 限制，只保存 job/effect/result revision 身份，不建新表。
- Website 先按 `incident_request_id + payload_hash` 幂等回读 write receipt；新惩罚周期第一次事件在同一事务锁定 control singleton 与 exact device row，冻结 `baseline_n=current max_in_flight`，随后把当前 N 原子写为 `max(1,current-1)`，设置 level=1、until=server_now+5分钟、stable_since=null、冻结全部在途 job，并写 receipt。
- 活动冷却、cohort 未清零、或此前尚未实际恢复过一次新 grant/submit 时收到其它 Tab 的通知，只返回同一 level/N/until，不延长、不升级。只有此前事故已经到期、cohort 全部入库且 Website receipt 能证明已经恢复过正常授权后出现的新事件，才在同一事务执行 `level=min(level+1,6)`、`N=max(1,N-1)` 和新 cooldown。
- claim 在读取设备容量和选择 job 前锁/读同一控制行。事故排空期间只能重授 cohort 原 job 的 `ACTIVE_ATTEMPT` / `CONSUME_CURRENT_RESULT` 零 submit 恢复；不得选择无关 job。没有可恢复 cohort job 时持久返回 `DRAINING`、空 jobs，并按事实给出 `PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE` 或 `PROVIDER_RATE_LIMIT_DRAIN_REMAINING`、step、server time 和 cooldown until。
- `server_now >= provider_rate_limit_until` 只解除时间门：effect subset 继续零 submit 读回；unsent subset 与依法取得新 result revision 的 cohort job 可在降低后的 N 内取得精确新 attempt/submit 授权。无论是否曾 `mutation_outcome=no`，只有每个 cohort job 都 admission/readback 后 `closure_remaining` 才清零；之后 Website 才恢复无关新 grant。
- 缩容不杀在途：若事故发生时 Website/AGENT 在途数大于新 N，旧 job 保持 lease/recovery/admission 权利，新 grant capacity 固定为 0，直到在途自然收敛到新 N 以下；不得 abort、failure、重复计数或迁移 Tab 来强行符合 N。
- 当当前 N=1、cooldown 已结束且 `closure_remaining=0`，Website 首次把 `stable_since=server_now`；此后仍按 N=1 正常工作。`server_now >= stable_since+6小时` 且期间无新精确限流事件时，在 control+device 同一事务 CAS `max_in_flight:1→baseline_n`，并清空 level/until/baseline/stable/cohort 活动态。任一新事件先清空 stable_since 并进入当前阶冷却。管理员 capacity endpoint 在惩罚周期内拒绝手工改 N，避免双 Owner；紧急止血仍使用现役 `admission_state=draining`。
- heartbeat、renew、terminal、artifact、device job status 和 business consumer 路径不受此 claim gate 阻断。
- 冷却到期不需要 timer/service：下一次现有 heartbeat/claim 以 Website server time 惰性判定；AGENT 使用 receipt 中的 `cooldown_until` 避免无意义 30 秒 claim 空转。正常 claim 恢复条件固定为 `server_now >= cooldown_until AND closure_remaining=0`。

### 7.5 业务完成 readback

- Website 控制室必须能读取当前 cooldown level/until/reason、`baseline_n`、唯一当前 N、`stable_since`、恢复 N0 的最早时点、触发 receipt hash、设备无关新 grant=0、`rate_limit_job_cohort_count`、`effect_recovery_subset_count`、`closure_remaining_count`。
- `closure_remaining_count` 只从 Website 持久 job/consumer/admission 状态计算，不信任 AGENT 日志或进程内集合。
- 只有冷却到期且 `closure_remaining_count=0` 才能恢复无关新工单并宣告“这次限频没有留下半截任务”；单独冷却到期、`mutation_outcome=no`、本地 terminal 或 N 已降低都不代表旧任务已收尾。

## 8. 原子工单与施工顺序

### WO-0：权威解冻与候选重绑

- Owner：两仓各自 law-system；需用户另行明确批准 law amendment。
- 修改范围：只替换本方案点名的相关 active law major、对应 Manifest/唯一 registry 和现役蓝图/跨仓 spec 引用。
- 必须冻结：精确 DOM 确认、Provider 冷却 Owner、冷却不杀已提交任务、Website admission 终点、无第二链。
- 完成门：两仓 active law/Manifest/registry 分母一致；相关 dirty overlay 已由用户处理或在授权候选中精确归属。

### WO-1：Website 持久冷却 Owner

- Owner：Website AI acceptance。
- 路径片区：`data/migrations/commercial/**`、`packages/ai-production-contracts/**`、`services/api/src/ai-production/**`、该 domain 既有 audit/acceptance。
- 动作：控制 singleton 最小列迁移；typed notice/receipt；冻结有界 effect cohort；原子阶梯；cohort-only recovery claim；控制室 readback。
- 验收：并发 notice 只升一次；5/10/15/20/25/30/30；活动窗口不延长；无关新 grant=0；cohort 同身份恢复、renew/terminal/admission 全部可用；时间已满但 cohort 非空仍不放新工单。
- 回退：保留已经持久的冷却/receipt 事实，回退到匹配的 Website commit；不得删 receipt 或重新开放 claim 来伪造恢复。

### WO-2：AGENT Runtime 持久门与通知

- Owner：Agent production runtime。
- 路径片区：现有 production contracts、`store-foundation/outbox`、cloud client/reconciliation、runtime loops/state、既有验收与审计。
- 动作：Outbox 增 `provider_cooldown`；在关闭 submit 门后冻结全部 CONFIRMED/unknown effect cohort；本地 provider gate；click 后交付；remote receipt hydrate；restart 重建 gate；无关新 claim 与 submit 双门。
- 验收：进程在 enqueue 后、click 后、HTTP dispatch 后分别 crash，重启均不产生新 claim/submit；同 request 最终只一个 Website receipt。
- 禁止：复用 shutdown abort、增加 cooldown SQLite 表、第二 retry worker 或环境变量调步长。

### WO-3：Browser/GPT 精确确认与原回答续跑

- Owner：Browser 拥有 DOM 事实/WAL/物理点击；GPT checkpoint 拥有业务语义调用和同回答继续读取。
- 路径片区：`gpt-dom-observation.ts`、现有 checkpoint handler/support、现有 Browser DOM intent/schema/WAL、对应审计/acceptance/real proof。
- 动作：有界 dialog fact；同 lane revalidate+click+postcondition；ack receipt；checkpoint 继续同 effect readback。
- 验收：精确 DOM 一次点击且 SLO 达标；0/2 dialog、2 buttons、stale Document、文案漂移全部零点击；确认后同 job 不重 submit并最终产出原结果。
- 禁止：复活退役 rate-limit 文件、增加 Product action、扫描整页或保存原始对话内容。

### WO-4：跨仓空窗切换

禁止兼容桥，按以下顺序：

1. 用 Website 现役 control plane 进入 `admission_state=draining`，只停止新 grant；保持 AGENT 运行。
2. 等待 Website 权威读回：active execution=0、admission pending=0、unknown Provider effect=0、现有 Outbox 未决=0。若任一非零，不得停 Runtime或部署。
3. 停止旧 Runtime，固定两仓合同 hash 和 clean release commits。
4. 先迁移/部署 Website 新合同与持久 Owner；在 admission 仍 draining 下验证 endpoint/receipt/claim。
5. 再部署匹配的 AGENT；启动后完成 manifest/session handshake，仍不得 claim。
6. 运行受控静态/fixture/crash 验收后再把 Website admission 恢复 open。
7. 任一步失败保持 draining，回退到两仓匹配 commits；不得以旧/新双收、feature flag 或版本 fallback 穿越空窗。

这一步的部署 drain 与事故后的 Provider cooldown 是两个正交事实：前者只用于无兼容桥发布，后者是本方案新增的生产事件；不得合并成一个含义不清的状态。

### WO-5：真实动态闭环

- Owner：两仓 RELEASE 各自按 active law dynamic proof 声明执行；Website admission readback 是共同业务终点，不是跨仓第二 verdict。
- 在受控真实 Chrome/GPT、真实 Website 上取得一次自然发生的限频事件；不得通过高频轰炸故意诱发。
- 事件发生前准备至少：2 个 submit 已 CONFIRMED 的 job、1 个已 claim 未 submit 的 job、1 个 queued job。
- 必须证明：唯一 DOM 精确点击；无关新 submit/claim=0；两个已提交 job 均原 effect 入库；未 submit job 没有 Provider 输入；queued job 无 grant；即使 5 分钟先到、cohort 非空也不恢复新工单；cohort 清零后恢复；下一次自然事件为 10 分钟。
- 当前截图和本轮 live DOM 只能作为设计输入，不能替代未来候选的 RELEASE 证据。

## 9. 分层验收

### 9.1 静态与合同

- 旧 `rate-limit-dialog.ts` 及同义兼容路径为零。
- Product facade 不出现新的用户可调用确认动作。
- 只有一个 cooldown Owner、一个 Outbox、一个 Browser lane、一个 claim gate、一个质量 verdict。
- 双仓 schema/version/hash、枚举、required/optional、unknown-field、canonical hash 完全按新合同闭合。

### 9.2 DOM/Browser fixture

- 精确中文 dialog：1 次物理点击，postcondition dialog=0。
- 错字、少一段正文、按钮 disabled、两个按钮、两个 dialog、stale Document：0 次点击，typed failure。
- ack DISPATCHED 后 crash：WAL readback，不二次点击。
- observation complete → click dispatch：每个受控样本 `<=1000ms`。

### 9.3 Runtime/Website 状态性质

- N=1..4 均满足冷却中 grant=0，Browser lane<=1。
- 任意并发通知顺序，活动窗口只产生一步和一份每 request receipt。
- 阶梯精确为 `[5,10,15,20,25,30,30]` 分钟。
- clock 只使用 Website `server_now`；本地时钟漂移不提前开门。
- crash 点覆盖 enqueue 前后、Browser dispatch 前后、Website HTTP 前后、receipt hydrate 前后。

### 9.4 业务闭环

- 事件快照的 `pre_incident_effect_cohort` 有确定 job/effect 分母，且冻结后无遗漏、无扩张。
- 每个 job 都能从 provider effect 追到 result hash、terminal receipt、业务 consumer、admission receipt 和 storage readback。
- 冷却期间 admission throughput 不被误挡；`closure_remaining_count` 单调降到 0。
- 人工 stop、Runtime shutdown 或网络中断不能把未闭合 job 伪装为已完成。

### 9.5 原生质量入口

- AGENT：使用仓库唯一 `npm run quality:check -- <CHANGE|READY|RELEASE>` 及 active law 声明的既有 GPT/Browser/Runtime focused acceptance/real proof。
- Website：使用仓库唯一 `pnpm run quality:check -- <CHANGE|READY|RELEASE>` 及 AI acceptance 既有 exam/dynamic proof。
- CHANGE、READY、RELEASE 分开；低层 PASS、HTTP 成功或真实点击均不得冒充 Website 入库。

## 10. 停止、恢复与失败关闭

1. DOM 不精确：零点击、零猜测；本次不能声称发生已知限频。若已由其它精确 Tab 建立冷却，继续遵守该冷却。
2. Outbox/ledger 不可写：claim/submit 失败关闭；精确 dialog 仍允许一次确认以解除当前已提交任务的页面阻塞，但必须保留 fatal evidence，恢复前不得开新请求。
3. ack 失败或结果未知：Website 冷却仍成立；先查 Browser WAL和实时 postcondition，不盲点第二次。
4. Website 通知不可达：本地 gate 永不因本地计时自行打开；先以同 request read-only receipt 对账，再接回现有 Outbox交付。
5. cooldown 到期但 `closure_remaining>0`：仍禁止无关新 claim；只允许 Website 精确授权的 cohort 原 job 恢复，直到旧任务全部入库回读或权威证明该 DISPATCHED effect 实际未发生。
6. lease/control 要求取消某 job：遵守 Website 现役业务 authority，但已经发生/未知 Provider effect 仍先零 submit对账；不得因限频自动取消。
7. 生产人工停机不是恢复措施。若必须停机，先由 Website draining 并证明全部已提交/admission pending/unknown effect 已归零。

## 11. 删除反事实裁决

| 结构单元 | 保留理由与删除后具体失败 | 更短复用裁决 |
|---|---|---|
| checkpoint 内 known dialog 分支 | 删除后第一直接断裂仍在，弹窗继续卡住已提交回答 | 复用现有 Child，不新增 Child |
| 一个 Browser typed ack intent + WAL receipt | 删除后不能证明只点一次、Document 未漂移或 crash 后不重点击 | 复用现有 Browser WAL/lane |
| Outbox `provider_cooldown` kind | 删除后 click 与 Website 通知之间 crash 会丢失关门事实 | 复用现有 Outbox/receipt/hydration，不建表/队列 |
| Runtime claim+submit gate | 只挡 Website claim 仍可能让已经领取但未 submit 的 job 发出新请求 | 从同一 Outbox/Website receipt 派生，不建第二状态机 |
| Website 控制单例五个字段 | 删除后阶梯、截止时间、冻结 cohort、并发合并和 readback 无 durable Owner | 复用现有 singleton，不建 cooldown table |
| 一个 typed notice endpoint/receipt | 删除后 Website 无法原子关闭 grant并回读通知 | 归入现有 V6 job/write receipt 路由 |

已删除/拒绝的结构：旧 rate-limit helper、第二 Child、第二 cooldown 表、第二队列、timer service、产品私有 pause、自动降 N、强制 abort active jobs、重发 recovery、兼容桥、feature flag、原始 DOM/URL台账、专属 quality 命令和新的 Agent。

## 12. 施工准入与执行 Codex 重绑定

当前保持“设计阻断”，原因有二：

1. 目标行为必须修改两仓 active law、蓝图和跨仓合同；本次“制定方案”不等于 law-amendment 或 construction 授权。
2. AGENT 与施工面重叠的现役用户改动尚未提交，无法为后续实现安全区分目标差异；Website 虽 clean，也不能单仓先行造成合同空窗。

执行 Codex 开工前必须：

1. 取得用户对两仓相关 active law 解冻/替换以及随后施工的明确授权；
2. 重新读取两仓 `AGENTS.md`、治理说明书、active law、Manifest、registry、蓝图、spec、实现和质量入口；
3. 重查 branch/HEAD/upstream/dirty/untracked，并由用户明确处理或归属当前 AGENT 重叠改动；
4. 重新读取实时 DOM；Provider 文案/结构若漂移，先更新本方案 DOM 合同，不猜；
5. 逐张执行 WO-0 至 WO-5；每仓只使用自己的 clean commit 和原生质量 verdict；
6. 最终报告必须分别写明 CHANGE、READY、RELEASE，以及 `closure_remaining=0` 的 Website 持久 readback。任何一项未取得都如实失败关闭。
