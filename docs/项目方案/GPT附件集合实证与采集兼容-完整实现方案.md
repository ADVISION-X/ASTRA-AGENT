# GPT 附件集合实证与采集兼容-完整实现方案

## 状态与目标

状态：设计中；不得据此重放 `aiprod_2839cd99-d9d7-4fb6-8ad0-eb53a66a4b73`、重传其材料或提交任何 ChatGPT turn。

目标是让下一次由 Website 正式签发的本地化任务同时满足两件事：

1. 上传前传给 Browser 的真实文件路径 basename 与 GPT 唯一 Owner 计算的 `providerDisplayName` 精确一致，且上传后的四张卡只、全量地匹配该集合；
2. 唯一页面证据报告必须只接受现役可验证的 task/material/terminal/Browser receipt；没有现役逐 Child trace 时固定记录为未采集，而不是把手工复现或已废止账本冒充历史调用。

这不是“上传四个文件即可成功”的问题。业务终点仍是 Website 接受并持久化 domain result/readback；本方案只先关闭其前置的 GPT 附件身份与可审计证据断裂。

## 已确认事实与边界

- 失败任务当前 attempt 为 `b65bdfd1-0cff-4f00-be6f-6d9ec95eea57`，durable task 行仍保存四份精确材料及 `attempt_failure_json`；失败码为 `GPT_ATTACHMENT_SET_MISMATCH`，最终观察显示四张卡已就绪但 `missing=4, unexpected=4, dup=0, shape=UNRELATED×4`。
- 真实 Chrome 的用户授权定向复现：同一四份任务材料上传至一个新建、未发送的 ChatGPT 会话后，composer 中有 4 张 ready card，显示标签分别是原始 `source_content.json`、`terminology.json`、`locale_policy.json`、`render_policy.json`。按当前 GPT 正规化规则，它们与该 job/material identity 计算出的四个 tokenized provider name 全部不相等，故为 `missing=4/unexpected=4`。这证明 Provider 展示的是本地文件 basename，不能接受原文件名作为等价附件身份；它不证明历史任务的 `UNRELATED` 四项各自实际标签是什么。
- 当前产品路径 `src/plugins/localization-production/flow.ts` 把原始 material input 交给 GPT child；两个 attachment child 再用 `gptAttachmentProviderDisplayName(displayName, jobId, artifactRef)` 计算 tokenized name。`src/lib/local-runtime/production/executor.ts` 现役源码已以 hard link materialize 同 inode 的 tokenized provider alias，Browser broker 也校验 alias basename。因此“当前源码完全没生成 alias”并未被证实；需先证明故障 attempt 的实际运行构件/实际 grant 是否走了这条链。
- `LAW-GPT-002-V20` 的 `FROZEN-GPT-ATTACHMENT-PROVIDER-DUPLICATE-SUFFIX-001` 只允许 exact provider name，或最后一个无空格十进制 `(<n>)` 去尾后 exact；原名、空格、扩展名变化与模糊匹配都必须失败关闭。不得为了消除报错放宽 normalizer。
- `LAW-FORENSICS-PERSISTENCE-CAPABILITY-*` 已冻结 artifact-only 存储并物理退役 `records-*` Child/合同；历史目录中即使残留旧文件也不是现役证据来源。当前 attempt 没有可验证的逐 Child trace，只能以 task/material/failure receipt 生成不完整 source，不能把新建标签页复现绑定为历史调用。
- Skill 自身已就地修复为现行 runtime schema：不再读取已不存在的 `identity_json` 或 `production_attempt_failures`，只在 current attempt 读取同一任务行的 immutable `attempt_failure_json`，并补齐当前 14 个 GPT page child 的采集矩阵。该工具变更不触及生产 runtime。

## scoped candidate

设计时绑定：仓库 `/Users/nexgen/Documents/AGENT`，`main`，`10bf9ddc777b357b354cd2445f844d75b423a40f`，`origin` 为 `git@github.com:ADVISION-X/AGENT.git`。以下是本方案的施工面，施工前必须逐项重新绑定：

- 法案/施工图：`.github/instructions/agent-rules/功能法案.md` 的 `LAW-GPT-002-V20`，以及 `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md`。
- GPT identity/上传：`src/capabilities/gpt/schema.ts`、`src/capabilities/gpt/children/attach_approved_gpt_files_once/`、`src/capabilities/gpt/children/reconcile_gpt_attachment_set/`、`src/lib/browser/infrastructure/browser-authority-broker.ts`。
- Runtime artifact handoff：`src/lib/local-runtime/production/executor.ts`、其直接构造/绑定调用方与现役 runtime 原生验收。
- Product consumer：`src/plugins/localization-production/flow.ts` 与 `src/plugins/localization-production/index.ts`。
- 证据工具（已变更）：`.agents/skills/gpt-page-operation-evidence/` 与唯一 JSON 报告。

工作区已有无关 dirty overlay；禁止覆盖它们。方案文件不属于 source candidate。

## 四维裁决与 identity spine

| 维度 | 现役事实 | 本次要求 |
| --- | --- | --- |
| 法案 | GPT 是 provider visible name 的唯一 Owner；Browser 只机械执行；失败关闭 | 不改 suffix 语义，不加 raw-name fallback、第二附件身份、重传或双路径 |
| 施工图 | `material → GPT providerDisplayName → Browser file grant → attach → reconcile → submit` | 在 grant basename、Browser command receipt 和 post-upload label 间保留同一 name identity |
| 实现 | Product/GPT/Broker/Executor 已有一条 alias 主链；历史运行的 trace 缺失，实际执行构件未被绑定 | 先证实实际 grant/alias/receipt 是否与源码一致，再只修复第一个不一致 Owner |
| 质检 | `npm run acceptance:gpt`、`npm run acceptance:agent-production-runtime`、`npm run quality:check` 是原生入口；页面报告有自己的离线验收 | 附件正反验收 + runtime artifact alias 验收 + 新 Website task 的真实 Chrome/readback；不把静态测试说成业务成功 |

identity spine：`job_id + attempt_id + artifactRef → providerDisplayName → provider alias basename → Browser grant/exact-call receipt → attachment aria-label set → submit precondition`。forensics trace 以 `job_id + attempt_id + traceEntryId` 绑定到该 spine；它不能由当前源码、手工表或新会话逆推。

## 第一直接断裂与有限分母

已确认的第一拒绝是 `reconcile_gpt_attachment_set`：它在 settled four-card 页面发现批准集合与观察集合不相等，正确产生 `GPT_ATTACHMENT_SET_MISMATCH`。这不是后续插件、运行时或 Website failure 的根因。

造成不相等的历史实际 handoff 尚未闭合：当前源码存在 alias materialization，历史 record 又不可用，故不能把“手工上传原文件显示原名”直接升级为“executor 当前实现失效”。有限分母仅包括：

`material → provider name → alias/grant → file input → card label → reconcile failure/success → submit guard`，以及其审计支路 `forensics trace → source manifest → Chrome scene → canonical report`。

成功分支：集合 exact（仅允许 frozen duplicate suffix）→ submit guard 才有资格继续。失败分支：任一 alias/grant/label 不等 → typed failure → Website 依据现役契约签发或拒绝新 attempt；AGENT 不自行 retry。审计分支：trace 缺失 → `DURABLE_ATTEMPT_TERMINAL_UNAVAILABLE`/报告缺口，不能回填。

## 原子工单与顺序

### W1：锁定历史/新任务的运行构件与 attachment identity（诊断门）

Owner：GPT + local runtime；范围限于上述 attachment/runtime 路径及实际 Browser receipt/forensics writer/retention path。目标不是修改。

1. 对一个 Website 明确签发的**新** attempt，在 upload 调用前后读取既有 Browser grant/receipt：每个 `artifactRef`、计算的 provider name hash、实际 alias basename hash、content hash、exact-call identity 和 card label hash 必须按同一 ordinal 一一对应。
2. 同时确认运行进程加载的源码/构件身份与 `executor.ts` alias 实现一致；若不一致，定位发布/启动 Owner，不在 GPT normalizer 或 Product 中补偿。
3. 验证取证只使用现役 artifact-only 合同；若没有逐 Child trace，source/report 必须保留 `PARTIAL` 与准确缺口。不得恢复 record ledger、镜像 trace 或以 Skill fallback 补造调用顺序。

完成门槛：对每个四项附件给出 existing durable receipt/hash 链，或明确唯一 first mismatching handoff。失败停止：未知/多义/已发生 provider effect 一律不重传、不 submit、不重放。

### W2：只修复 W1 确认的唯一 Owner

前置：W1 已给出单一断裂位置和 scoped candidate 未漂移。

- 若断裂在 runtime artifact materialization：在 `src/lib/local-runtime/production/executor.ts` 的既有 `materializeUploadAlias` Owner 内修复，不改变 `gptAttachmentProviderDisplayName`、Product input schema 或 Broker 合同；保留同 inode、alias basename、release identity 的 fail-closed 读回。
- 若断裂在 Browser grant/command handoff：只在现有 broker/Browser execution Owner 内保证传入的是已校验的 provider alias path；不得把 raw material path 作为第二 fallback。
- 若断裂在 deployed stale construct：只修复该启动/发布绑定，代码主链无业务补丁；部署后重新以新 Website attempt 证明加载身份。

完成门槛：原始 raw name、错误扩展名、空格括号、非数字 suffix、外来 card 均失败；精确 tokenized alias 和唯一允许的 duplicate suffix 成功；失败不会触发自动上传或 submit。

### W3：真实新 attempt 的证据与业务闭环

前置：W2 已通过原生质量，Website 明确签发一个新 attempt，并单独授权该外部 Provider action。

1. 使用该新 attempt 的真实四份 materials，先运行页面 evidence Skill 的 `production-source.mjs`；它只读取现役 task/material/terminal/Browser receipt。若该 attempt 未有逐 Child trace，报告保持 `NOT_CAPTURED/PARTIAL`，不得为了完成率补造调用。
2. 只有 `production-source.mjs` 输出的 trace 已由现役持久事实验证且非空，才可在专用 Chrome tab 依该 trace 操作；否则固定停止在 `PARTIAL/NOT_CAPTURED`，不得打开 Chrome、装配或合并。即使进入 Chrome，也只上传/核对；只有 submit 条件全部满足且该新 attempt 的授权包含 submit 时才发送。
3. 仅在第 2 步 trace gate 通过后，才用 `assemble-live-capture.mjs` 和 `report-tool.mjs merge` 原子替换唯一报告的 `localization_article_translation/article_translation` slice；再 `validate`。历史本次 job 保持未合并的缺口，不被改写。
4. 若新任务完成，再按 Website 的唯一 admission receipt 与 durable domain-object readback 验收；Provider 卡片、HTTP、queue 或 report PASS 都不等于业务完成。

失败停止：任何 card mismatch、trace missing、receipt mismatch、页面输入 binding gap 或 Website rejection 均停止在当前事实；不通过另一个 tab、下载目录文件或手工改 JSON 绕过。

## 删除审判

不新增 alias store、附件映射表、宽松 label normalizer、重传/retry worker、第二 forensics repo 或第二页面报告。它们没有当前必要消费者，且会与 GPT 唯一 name Owner、Browser 唯一 WAL 和 runtime 两表 authority 冲突。现有 executor alias、broker grant 和 canonical report 已分别有真实消费者，故保留并在其 Owner 内修复。

## 验收层级与回退

施工阶段按影响范围运行：目标 unit/acceptance → `npm run acceptance:gpt` → `npm run acceptance:agent-production-runtime` → `npm run quality:check`。页面 evidence Skill 同时运行其 `production-source.acceptance.mjs`、`report-tool.acceptance.mjs`、`pipeline.acceptance.mjs`；它们仅验证工具，不替代生产质量。

运行时 alias 失败或 Browser receipt 失配时，保留原 typed failure 并停止；不要删除原始材料、failure receipt 或 forensics artifact。页面逐 Child trace 不可用时只报告证据缺口，不得恢复 retired record ledger。发布后若新 attempt 未证明 exact attachment set，则回退到上一个已验证构件/配置状态，并由 Website 的现役新 attempt 机制决定是否继续，AGENT 不自行恢复。

## 施工重新绑定要求

进入任何 W2/W3 前重新读取本方案 scoped candidate、目标文件 Git 状态、现役 law/Blueprint、运行构件身份和唯一 quality entry。若当前 source 已满足 W1 而只有旧部署不一致，禁止修改 GPT/Product；若 W1 找不到唯一 first break，本方案停在设计阻断，等待可读 runtime/retention evidence。
