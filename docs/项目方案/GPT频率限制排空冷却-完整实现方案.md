# GPT 频率限制排空冷却完整实现方案

> 设计状态：**设计中（2026-09-21 精确测试落点迭代中）**
>
> 需求 Owner：AGENT GPT 生产执行链；Website 是工单授权、冷却和最终业务接纳 Owner。
>
> 执行授权边界：2026-09-15 的历史施工授权解释既有系统来源；2026-09-20 只授权制定和迭代方案；2026-09-21 本轮只授权严格重绑、迭代本唯一方案并进行独立只读审计。即使设计状态转为“可施工”，代码、测试、Browser、Website、生产和发布仍等待用户新的明确执行指令；冻结母说明书不修改。

## 0. 2026-09-20 DOM 识别回归与 2026-09-21 candidate 重绑裁决

> 本节是本方案唯一的现役识别迭代增量，覆盖下文 WO-3 中“精确识别”的施工细节，但不改变冷却、N−1、Outbox、Website receipt、cohort 或发布边界。设计状态与执行授权严格分离；截至 2026-09-21 仍未开始代码、测试、Browser、Website 或生产动作。

### 0.0 2026-09-21 写前重绑与连续性

- AGENT 当前绑定：`/Users/nexgen/Documents/AGENT`，branch=`main`，HEAD=`12c1c6578927c12d891e2f88db0c5470cd759ca6`，tracking=`origin/main@12c1c6578927c12d891e2f88db0c5470cd759ca6`，ahead/behind=`0/0`。本方案写前 SHA-256=`ca731b5a791fcb9225769f48cedd7c2299c23550faebd749d8ed44e0951d10b8`，作为文档基线单独记录，不进入 source candidate。
- 当前唯一无关 dirty 是 `docs/项目方案/GPT Provider效果跨恢复单调性与限流冷却门根治-完整实现方案.md`；它归用户所有，本方案的写入、质检与未来施工均不得格式化、恢复、覆盖或纳入该文件。目标生产源、acceptance、manifest、active law 与 Blueprint 全部 clean。
- 连续性裁决：从旧绑定 `af9883f6663ab8d96a12722fc77788320125f6ad` 到当前 HEAD 的提交虽调整过 GPT exact-target acceptance 与 `prepare_clean_gpt_chat` 相邻 consumer，但本轮十个已存在的 scoped source/authority/config 文件字节哈希均与 3.1 记录一致，无 detector、central preflight、rate-limit contract、Playwright 依赖、law 或 Blueprint 变更；不引入新 Owner、新状态或新生产施工面。
- Website 当前绑定：`/Users/nexgen/Documents/xuanxue-web`，branch=`main`，HEAD=`8a71d36402cd6b797be1eed80308e1f0fc967e6b`，tracking=`origin/main@8a71d36402cd6b797be1eed80308e1f0fc967e6b`，ahead/behind=`0/0`，工作树 clean。Website 仍只是未来 RELEASE/readback candidate，不进入 WO-3A 施工差异。

### 0.1 当前候选与第一直接断裂

- 需求 Owner 与唯一实现 Owner：AGENT Browser Authority；Website、Product Plugin 和 Runtime 不拥有弹窗 DOM 分类。
- 当前绑定以 0.0 和 3.1 为准。施工前必须重新读取 HEAD、tracking、完整 status 与本节列出的 source hash；任一相关文件漂移则只重算受影响段并再审计，命中施工面的未归属改动则关闭施工准入。方案文件只记独立文档 hash，不冒充 source candidate。
- 当前实现 `src/lib/browser/chrome-extension/gpt-rate-limit-dialog.ts` 的 `DETECTOR` 用 `dialog.textContent` 与 `[title, body1, body2, ack].join(" ")` 做整段等值，同时要求唯一可见 dialog 和唯一可见、启用的 button。实际页面肉眼呈现冻结文案时，DOM 元素之间仍可能没有 `textContent` 空格，或包含不渲染的隐藏文本，因此可见结构正确也会落入现役实现的 `unknown_present`，上抛 `BROWSER_GPT_DIALOG_UNRECOGNIZED`。这是本轮第一直接断裂；后续未关闭 submit 门、未进入 ack Child、未生成 cooldown receipt 都是其下游后果。施工时必须把内部 `unknown_present` 物理替换为现役法案定义的 `mismatch`；不得保留 alias 或双状态，外层错误码保持不变。
- 现有 `scripts/acceptance/local-browser-auto-pairing.acceptance.ts` 只把 `Runtime.callFunctionOn` 返回值直接 stub 为 `absent | unknown_present | exact_present`，验证了 fail-close 与零物理输入，却没有执行真实 `DETECTOR`，所以没有覆盖“可见文字正确、`textContent` 拼接不同”的回归。
- 当前截图和旧日志能证明用户看到的是目标弹窗以及当前链返回了 typed mismatch；由于本轮无法读取真实 DOM，不能把“缺空格”“隐藏节点”中的任一种宣告为已经单独实证的唯一 DOM 差异。方案修复的是已确定存在的错误判定边界：分类必须依据可见语义结构，不得依据包含隐藏内容和节点拼接偶然性的整段 `textContent`。

### 0.2 历史连续性裁决

- `a97d7a3c05e325f441f784bf2a26c01fee3c63ec`（2026-06-21）是历史线索：Pick3 当时读取 dialog `innerText` 并避免把弹窗当作 GPT 输出；它同时含 `textContent` fallback、宽正则、portal、`role=button`、最后按钮 fallback 和 500ms watcher，不能证明本轮精确算法成立。
- `93af7fbf0010031c5333a3e694d05cde1babe735`（2026-07-26）继续提供“读取可见文字”的历史线索；`23b03c6254fbfc6cece846bdedf704c18cc032df` 及后续提交仍改造过共享 watcher，因此不得把 `93af7fb`称为退役前最后字节。
- `d8df235c5ac4d31a1bba4734995048833ad842bc`（2026-08-15）删除 Pick3 专用文件和 Pick3 watcher，但保留并迁移共享 `web-chat-rate-limit-dialog.ts`。后续共享旧链最终也已退役；本轮不得恢复任何旧文件、500ms timer、模糊正则、`[data-radix-portal]`/整页 fallback、按钮序号 fallback、无限点击或 Product 私有恢复链。
- 本轮只恢复仍符合现役权威的一项不变量：**分类读取渲染后的可见文字，而不是整段原始 `textContent`**。现役中央 preflight、唯一 `role=dialog`、冻结文案、唯一按钮、Target/Document identity、一次 ack、1.5秒普通访问门、2.5秒 post-click readback 和 Browser WAL 全部保留。

### 0.3 唯一目标识别算法

`gpt-rate-limit-dialog.ts` 仍是唯一 Owner，原位修改现有 `DETECTOR`，不新增生产文件或第二 helper：

1. 只在当前精确 Target/Document 内查询 `[role='dialog']`，并用唯一 mechanical reader 的 rendered visibility（connected、layout、display、visibility、opacity、`hidden`）形成可见候选；`aria-hidden`/`inert` 但仍渲染的 dialog 仍进入可见基数，并因不满足 exact actionability 归为 `mismatch`。可见候选零个返回 `absent`，多于一个返回 `mismatch`。
2. `aria-labelledby` 必须存在且规范化后恰好包含一个非空 ID token；该 token 在当前 `document` 中必须恰好解析一个 connected Element，该节点必须位于当前 dialog 内、可见、非 `aria-hidden`、不在 `inert` 树内。标题节点 `innerText` 规范化后必须精确等于“请求过于频繁”。生成 id 只用于本次 Document 内解引用，不持久化、不进入 wire 或 receipt。
3. 只读取 `dialog.innerText` 的渲染语义并做 NFC、连续空白折叠和首尾清理。规范化后的可见文本必须精确等于 `标题 + 正文1 + 正文2 + 明白了` 的冻结顺序；不得使用模糊关键词，也不得因隐藏节点或 DOM 元素间缺少 `textContent` 空格而误判。
4. dialog 内 raw `button` 逐个复用 `dom-mechanical-facts.ts` 的 `BROWSER_MECHANICAL_FACTS_READER_SOURCE` 分类；只有 `facts.visible=false` 的真正不渲染项不进入可见按钮基数。仅 `aria-hidden`/`inert` 但仍渲染的 button 继续进入可见基数和 `dialog.innerText`，并因 actionability 不成立归为 `mismatch`。可见按钮必须恰好一个，其 `innerText` 规范化后精确等于“明白了”，并以 `includePointerFacts=true` 在同一 coherent call 内证明 connected、layout、visible、非 `aria-hidden`、非 `inert`、非 disabled、非 `aria-disabled`、位于 viewport、`pointer-events!='none'` 且 center hit-test 命中自身或后代；任一不成立均为 `mismatch`。不接受“确定/OK/Got it”、`[role=button]` 或最后一个按钮 fallback，也不得复制第二份近似 actionability 实现。
5. exact 命中仍只返回冻结 dialog hash、Target/Document/observation identity 和时间；`absent|mismatch` 只返回固定枚举与许可计数，不返回 DOM、全文或生成 id。现有外层错误码 `BROWSER_GPT_DIALOG_UNRECOGNIZED` 保持不变，避免新增跨层合同。
6. 命中后的控制链完全复用现役 `extension-target-authority.ts → knownGptRateLimitBlockerReceipt → ProviderRateLimitControlPort → acknowledge_known_gpt_rate_limit → acknowledgeKnownGptRateLimit intent`；本轮不修改冷却、Outbox、Website 合同或业务完成分母。

### 0.4 原子工单 WO-3A：可见语义分类与真实 detector 验收

- 修改范围精确为 `src/lib/browser/chrome-extension/gpt-rate-limit-dialog.ts`、`scripts/acceptance/local-browser-auto-pairing.acceptance.ts`、新文件 `scripts/acceptance/local-browser-rate-limit-dialog-support.ts` 和 `scripts/audit/domains/local-browser-session/manifest.json`。不得修改 Website、Runtime cooldown、Product Plugin、旧 Pick3 路径或任何届时存在的无关 dirty/untracked overlay。
- 结构约束：生产文件当前 237 行，原位替换 `DETECTOR`，不得新增生产抽象；`local-browser-auto-pairing.acceptance.ts` 当前 485 行、接近 500 行红线，不得在主文件内展开 fixture。唯一测试落点固定为 `scripts/acceptance/local-browser-rate-limit-dialog-support.ts`：它只导出一个由主 acceptance 单次调用的验收函数，使用本地无网络 Playwright 页面执行生产 detector，并必须纳入 `scripts/audit/domains/local-browser-session/manifest.json`。不得把该 fixture 塞入只拥有配对职责的 `local-browser-auto-pairing-support.ts`，不得使用 `node:vm/FakeElement` 伪造 `innerText`/layout/hit-test，也不新增 npm/质检入口或第二 verdict。
- 验收必须执行生产 `Runtime.callFunctionOn.functionDeclaration` 本身，而不是继续伪造 detector state。复用仓库现有 Playwright 依赖创建本地、无网络 HTML fixture，至少覆盖：
  1. 冻结标题/两段正文/按钮分别位于独立元素，`textContent` 无目标拼接空格但 `innerText` 可见顺序正确，必须 `exact_present`；
  2. dialog 内存在隐藏文本节点但可见结构精确，必须 `exact_present`；
  3. 标题、任一正文或按钮文字漂移，必须 `mismatch` 且零物理输入；
  4. 零可见 dialog 为 `absent`；两个可见 dialog、两个可见 button、唯一可见 button 为 disabled/aria-disabled/aria-hidden/inert、viewport 外、`pointer-events:none` 或 center hit-test 被遮挡均为 `mismatch`；一个完整可交互 button 加 `display:none`、`visibility:hidden`、`hidden` 或经 fixture 证明不贡献 `innerText` 的无 layout button 仍必须为 `exact_present`；`opacity:0`、`aria-hidden` 或 `inert` 的额外 button 只要文字仍进入 `dialog.innerText` 就必须为 `mismatch`；
  5. 缺失、空值、多 token、解析零/多个元素、指向 dialog 外节点、标题节点 hidden/aria-hidden/inert 或标题漂移的 `aria-labelledby` 均为 `mismatch`；
  6. 现役 `unknown_present` 与测试 stub 必须物理退出，只保留 `absent | mismatch | exact_present`；exact 命中仍阻断原 Child 动作且 `physicalInputCount=0`，只有现役内部 ack intent 可以执行一次点击；现有 1.5秒/1秒/2.5秒时序断言继续通过。
- 原生质检：先运行本 domain 现有 `npm run acceptance:local-browser-terminal`；随后只使用全仓唯一 `npm run quality:check -- CHANGE`。READY/RELEASE 仍服从本方案原有门槛，fixture PASS 不得冒充真实 Chrome 或 Website readback。
- 动态停止条件：若未来真实 DOM 证明目标弹窗不是唯一可见 `role=dialog`、没有可解析的单一 `aria-labelledby` 标题，或可见文案已变，停止并记录 typed mismatch；不得临场扩大 selector、恢复模糊匹配或人工坐标点击。取得新的只读 DOM 证据后，先更新同一方案和冻结 hash，再决定是否需要法案变更。

### 0.5 删除反事实与完成门

- 删除旧 Pick3 watcher、模糊词表、portal/alertdialog fallback、第二 detector、第二状态机和新持久化后，本轮仍能通过中央 preflight 完成识别，因此它们全部不进入方案。
- 若删除 `innerText` 可见语义分类，当前正确可见弹窗仍可能因 `textContent` 节点拼接或隐藏文本失败；因此该原位替换不可删除。
- 若删除 `scripts/acceptance/local-browser-rate-limit-dialog-support.ts` 中的真实 detector fixture，现有 stub 仍会让同类回归静态通过；因此该精确文件是唯一必要新增测试结构。
- 本迭代完成只表示：冻结可见弹窗被中央 preflight 稳定判为 `exact_present`，未知结构继续 fail-close，原请求零物理输入，后续复用现役 ack/cooldown 链。未取得真实 Browser ack receipt、Website cooldown receipt、cohort admission 和持久化 readback前，不得声明 RELEASE 或事故业务闭环。

## 1. 需求、权威终点与范围

### 1.1 本次必须同时成立的结果

1. GPT 页面出现已知“请求过于频繁”弹窗后，系统先读取当前 Document 的实时 DOM，且只在精确识别唯一弹窗、唯一可操作“明白了”按钮时点击。
2. 除同一次精确识别后紧接的一次“明白了”确认外，ChatGPT 页面上两个相邻逻辑访问周期的起始时间必须全账号、全 Tab 共用同一节拍且相隔至少 1.5 秒；50ms、25–250ms、1 秒 deadline 尾读等会导致亚 1.5 秒重观测的路径全部物理退出。一次逻辑访问周期内部完成同一 coherent observation 或同一原子输入所必需的 CDP primitives 不被错误拆成多次等待。
3. “明白了”是唯一紧急例外：从完成该次 DOM 分类到发出一次点击，正常链路目标不超过 1 秒；点击必须占用当前唯一 Browser lane 并在同一次 target/document 绑定内完成，不能排到普通任务后面。例外只豁免 detection→ack 这一对动作，点击后的首次 readback 仍遵守现役 2.5 秒 settlement。
4. 点击之前，本地先关闭“新 claim / 新 Provider submit”门并持久保存同一限频通知；点击确认后才把通知交给 Website。
5. Website 收到并持久化一个新的限频事故后立即停止向该生产设备发放无关新工单，并在同一事务把 Website 唯一当前 N 从 `Ncurrent` 调整为 `max(1, Ncurrent-1)`。首次冷却 5 分钟；恢复后再次发生依次为 10、15、20、25、30 分钟，之后仍为 30 分钟。活动事故窗口内其它 Tab 的同类弹窗只是同一事故的并发证据，不重复 N−1、不升级冷却。
6. 第一次事故冻结该稳定周期的原始 `N0`；每次真正恢复发送后又出现的新事故再执行一次 N−1，直至 N=1。N=1 只有在最后一次冷却结束、事故时全部在途任务均已收尾入库、并从这两个条件同时成立的时点起连续至少 6 小时没有新的精确限流事件时，才原子恢复到 N0；任何新事件重置这 6 小时。恢复 N0 时同时结束本次惩罚周期并把下一次事故重新视为 5 分钟第一阶。
7. 冷却只阻止新工单和尚未发生的 Provider submit，不得停止 lease 续期、同一 Provider effect 的回答读回、已有结果交付、Website consumer 接纳和持久化回读。
8. 限频前已经发生或结果未知的 Provider submit 全部任务必须沿原 `job_id + attempt_id + result_revision + provider_effect_identity_hash` 收敛；事故期间只允许为这些原任务签发零重发读回/交付所需的同身份恢复授权，不得签发无关新工单，不得强制失败、换任务、换 Tab 重发或留在半截状态。
9. 最终完成条件不是弹窗消失、HTTP 200、Outbox delivered 或 terminal completed，而是每次限频事件纳入 cohort 的全部在途任务均取得 Website 领域 admission receipt 和持久化 readback。

完成分母定义为：

```text
rate_limit_job_cohort
  = 每次新的精确限流事故关闭 submit 门时，本设备全部已获 Website grant 或已被 AGENT durable accept、但尚未 Website admission 的 job 去重集合，与当前未闭合集合取并集

effect_recovery_subset
  = rate_limit_job_cohort 中 submit 已 CONFIRMED 或 DISPATCHED/unknown 的 job；它们只能零 submit 读回同一 effect

unsent_resume_subset
  = rate_limit_job_cohort 中权威证明 mutation_outcome=no 的 job；它们在冷却结束后仍保留同一 job demand，并按降低后的 N 取得 Website 新 attempt 授权后继续完成

closure_admitted
  = rate_limit_job_cohort 中已取得 Website admission receipt + durable storage readback 的 job

closure_user_terminated
  = rate_limit_job_cohort 中事后由用户依现役永久取消/删除/撤权 authority 明确终止 demand 的 job

closure_pending
  = rate_limit_job_cohort
    - closure_admitted
    - closure_user_terminated

本事故无半截任务 <=> closure_pending = empty
本事故全部成功入库 <=> closure_pending = empty AND closure_user_terminated = empty
```

`mutation_outcome=no` 只决定该 job 可以合法取得新 attempt，不是业务完成；不能把它从闭环分母删除。若 Website 依法判定某一已稳定结果 `RESULT_SETTLED_UNUSABLE`，只能复用现役结果拒绝与新 `result_revision` 授权；这仍属于同一 `job_id` 的最终收敛，不允许把旧 Provider effect 当作未发生。限频机制自身无权取消任何 job。只有用户事后另行作出的现役永久取消/删除/撤权可以把 job 从 `closure_pending` 移到 `closure_user_terminated`；它结束半截状态，但必须单独计数且绝不能被事故报告成“成功入库”。

### 1.2 范围

- AGENT：GPT DOM 观察、`checkpoint_gpt_text_response`、Browser typed intent/WAL、Runtime 新 claim/submit 门、现有 `production_outbox`、恢复和验收。
- Website：V6 限频通知合同、持久冷却 Owner、claim 裁决、收据/readback、控制室观察与验收。
- 跨仓：同一合同身份、无兼容桥的 drain/cutover、两仓各自原生质检和真实生产动态证明。

### 1.3 明确非目标

- 不在 AGENT、Browser、环境变量、session 或 heartbeat 复制当前 N；自动 N−1 和 6 小时后恢复 N0 都只能由 Website 在 `ai_production_devices.max_in_flight` 的同一 Owner 行上原子执行。
- 不停止工单创建者写入 queued demand；“停止发送新工单”精确指 Website 不再向设备签发无关新 `job_id` 的 lease/grant。事故 cohort 的原 job 同 attempt/effect 零 submit 恢复授权不属于新工单。
- 不把所有名为 `*Ms` 的协议期限、HTTP deadline、lease、heartbeat 或内部计时机械改写成秒单位；本需求约束的是 ChatGPT 页面访问频率。现役 2 秒附件观察、2.5 秒 action→read settlement、5 秒以上 hydration、40 秒提交后静默门和Browser每轮一次抽取的70—90秒全局Provider observation间隔均不降低；任何 deadline 剩余不足 1.5 秒时直接以最后一次事实超时关闭，不为“赶 deadline”补一次亚 1.5 秒 DOM 尾读。
- “秒点”从第一次合规 DOM 观察完成时计算，不虚构页面出现到系统尚未观察之间的时间保证，也不把唯一紧急 ack 扩张成普通 DOM 高频例外。
- 不增加第二 Browser lane、第二 scheduler、第二 retry policy、第二 Outbox、第二冷却表、产品私有暂停机制、Product 可调用的确认能力或人工点击 fallback。唯一内部 ack Child 只为把一次物理点击绑定到 Browser WAL/replay identity，不能被 Product Flow 调用。
- 不把普通网络中断、登录失败、usage limit 或未知弹窗误判成该已知限频弹窗。

## 2. 输入证据与事实边界

### 2.1 用户截图与 2026-09-15 历史只读 DOM

- 用户截图：`/var/folders/wg/jqx8m72j5t73k7b8stzs_kpc0000gn/T/codex-clipboard-a5ebedd6-9f78-4059-aad4-44ce59cca071.png`，SHA-256 `0b8bc089d42ed7750770238959d1c557581f73d217416c99d3039d8a55339a1a`。
- 2026-09-15 曾只读取得同一 Chrome 会话当时的 DOM：恰好一个可见 `role=dialog`；标题为“请求过于频繁”；正文依次为“你的请求过于频繁。为保障数据安全，我们已暂时限制你访问对话记录。”和“请稍等几分钟后再重试。”；恰好一个启用按钮“明白了”。这不是 2026-09-20 当前 DOM readback。
- 当时按钮没有稳定 `data-testid` 或 `aria-label`，dialog 使用生成的 Radix `aria-labelledby`。因此实现不得依赖坐标、生成 id、全页文本扫描或截图 OCR。
- 2026-09-15 没有点击按钮、刷新页面或修改 Browser/Website 生产状态；2026-09-20 与 2026-09-21 同样没有取得新的真实 DOM。历史证据只定义 fixture 和 fail-close 停止条件，不证明当前在线结构或目标代码已处理它。

### 2.2 用户提供的日志

- AGENT 日志 `/Users/nexgen/.codex/attachments/ab74c195-fe55-493c-adf8-6f42f5ebc51c/pasted-text.txt`，SHA-256 `960f6a71300c6c22d047c8c90bbbca9157684c2e60b81946ccfe2ff6a701220e`；303 个物理行中可独立解析 293 个 JSON event，时间范围 `2026-09-14T19:28:21.575Z` 至 `20:35:39.330Z`。
- 该日志记录 25 次 `job.durable-accept`、19 次 `job.execute` 成功及对应 19 次 `result.upload`/`job.terminal` 成功、5 次 `job.execute` 失败、43 次 `cloud.claim` terminal；第 17 行一次 claim 同时 grant 3 个 job，证明事故现场实际以 N=3 推进，而非单工单串行。
- 第 29—295 行出现 21 个不同 job 的 `GPT_PROVIDER_WAIT_ACTIVE`。相邻 wait event 最小间隔为 5.662 秒，只有一组小于 60 秒；但该 event 在排队观察前发出，不能证明真实 DOM observation 的间距。现役日志没有完整 Browser DOM read 事件，所以不能从日志反推出所有真实页面访问次数。
- 第 44/55/74 行分别首先出现 3 个 Browser `BROWSER_PROVIDER_EFFECT_IDENTITY_DRIFT`；第 230 行首先出现一次 `GPT_ATTACHMENT_UPLOAD_TIMEOUT`；它们各自的 Product/Runtime 失败是后果，不是新的独立根因。
- 同文件第 296 行首先记录 `CLOUD_TRANSPORT_UNAVAILABLE / ECONNREFUSED`，第 297—299 行的 `BROWSER_WAIT_ABORTED` 与下游失败是其后果，第 300 行才是人工 `Ctrl+C` shutdown。
- Website 日志 `/Users/nexgen/.codex/attachments/80c20bb8-fb9e-4365-b519-da69da14dc99/pasted-text.txt`，SHA-256 `bf1fb636e35eece7ed94a1d01d9188a2867ad265168a4f30e3f7b311b0398e71`；它记录 Website 自身的 renew、heartbeat、claim、控制室查询和 terminal 流量，不是 ChatGPT 页面或 `chatgpt.com` 网络流量。
- 两份日志都没有 `Network.*`、ChatGPT HTTP 请求、完整 DOM read 计数或“请求过于频繁”的结构化事件。这不是“没有发生限频”的证据，而是现役代码没有该 DOM 事实与事件合同；“过密页面访问是第一怀疑对象”与代码事实相符，但仍是待 RELEASE 动态证明的因果假设，不能写成日志已证明的唯一根因。
- 日志中的网络中断是另一条直接故障，不能拿它冒充本次限频根因；本方案不顺手修网络问题。

### 2.3 事故勘察时 HEAD/base 的页面频率代码事实

以下事实来自本方案开始时绑定的 AGENT HEAD/base；最终核验时并行 writer 已进入部分 Runtime/Browser 实现，因此它们只能证明该 base 存在第一直接断裂，不能替代 construction 前对最终 clean candidate 的重新读取。

- `src/lib/browser/chrome-extension/dom-mutation-postcondition.ts:35-38` 与 `dom-intent-runtime.ts:68-71` 的循环等待上限为 50ms；一个 5 秒 postcondition 理论上可触发约 101 轮逻辑重观测。这是当前最明确的亚 1.5 秒高频入口。
- `open_gpt_execution_profile/handler.ts:51-66` 与 `open_gpt_attachment_control/observation.ts:150-165` 在 5 秒 hydration 内使用 25–250ms 自适应等待；理论上可产生数十次重读，必须退出。
- `reconcile_gpt_attachment_set/observation.ts:219-235` 正常序列从 2 秒起；`prepare_clean_gpt_chat/handler.ts:27-50` 从 5 秒起；`production-browser-lifecycle.ts` 只给出Provider observation至少70秒的最早资格，Browser再按每轮一次抽取的70—90秒全局间隔裁决；这些已高于 1.5 秒，但 deadline 尾部仍不得用 `min(remaining, scheduled)` 制造小于 1.5 秒的最后一次重读。
- `debugger-runtime.ts:8,199-220` 已在页面 action 后等待 2.5 秒才允许 read；`browser-command-postcondition.ts:142-163` 已在 Provider submit 后静默 40 秒。两者保留，且 1.5 秒新门不能覆盖或缩短更长的现役门。
- Browser heartbeat 20 秒、Website lease renew/session heartbeat/claim 等控制流不读取 ChatGPT DOM，不属于页面交互节拍；为它们改单位不会降低 Provider 压力，反而会破坏 lease 和收尾，所以明确排除。

### 2.4 既有设计线索

- Website 历史方案 `docs/项目方案/GPT_WEB页面动作与会话重命名终态统一方案.md` 曾列出 `acknowledge_known_rate_limit`，但它不是现役法案/代码事实。
- 当前 AGENT 审计把 `src/capabilities/gpt/web/children/rate-limit-dialog.ts` 列为退役且必须物理不存在；本方案不得复活该路径或建立换名兼容壳。

## 3. Scoped candidate 绑定

### 3.1 AGENT

- realpath：`/Users/nexgen/Documents/AGENT`
- branch：`main`
- HEAD：`12c1c6578927c12d891e2f88db0c5470cd759ca6`
- tracking：`origin/main@12c1c6578927c12d891e2f88db0c5470cd759ca6`，ahead/behind=`0/0`。
- 本轮 source candidate 精确为：修改 `src/lib/browser/chrome-extension/gpt-rate-limit-dialog.ts`、`scripts/acceptance/local-browser-auto-pairing.acceptance.ts`、`scripts/audit/domains/local-browser-session/manifest.json`；新增 `scripts/acceptance/local-browser-rate-limit-dialog-support.ts`；只读复用/校验 `src/lib/browser/chrome-extension/dom-mechanical-facts.ts`、`src/lib/browser/chrome-extension/extension-target-authority.ts`、`package.json`、`package-lock.json`、`.github/instructions/agent-rules/功能法案.md`、`docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md`、`docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md`。本方案只是唯一文档产物，单独记录 hash，不进入 source candidate。
- 施工面外当前唯一 dirty 为 `docs/项目方案/GPT Provider效果跨恢复单调性与限流冷却门根治-完整实现方案.md`。它归用户所有，不得读取为本方案 authority，不得格式化、恢复、覆盖或纳入本轮质检修复。施工时以届时完整 status 为准，不把当前 dirty 集合冻结成永久前置。
- 当前 active authority 已完成并进入 HEAD，不再需要 law amendment：`.github/instructions/agent-rules/功能法案.md:738,1073,1139`、`docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md:39`、`docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md:17` 已共同冻结中央 preflight、唯一 `role=dialog`、冻结文案、完整可交互按钮、一次 ack、1.5秒普通门、2.5秒 readback、单 lane/WAL 和无旧 helper。
- 设计时关键 hash：`gpt-rate-limit-dialog.ts=a900c39c5eca6a45ce8a9860f51bdc5d4bec6e8f5c4f0b133135cbbf672a7af9`；`dom-mechanical-facts.ts=d80fd5e7554e2d66fa702dfc3df72d9aa85a8747c23b1d9038927d68d98b26e9`；`extension-target-authority.ts=f7b1f8da7bc9e31c47e7184cf7bc6a698afa6ac1ec49dd7c066a1d5f62c5f8bb`；`local-browser-auto-pairing.acceptance.ts=6fbcc0792ba8a2ca6790dbc6c7a6d450a9da22178808c26d561ca7af7ce7cb8a`；`local-browser-session/manifest.json=5d05ddbd30cc5d1b1a55c49c570bc959520d00f59235130d17e1dff306362d81`；`package.json=9ac78c31c2dd3497581d977f748f3fe8733905f14d6cb36363d7f4e4c9e3533d`；`package-lock.json=6fe1e4f698c168342de122c3725801fae1c081d550144cc638d8dc935b26d3c3`；`LOCAL-BROWSER...BLUEPRINT.md=61d76c07a26f08f16e7104ff0980c47a086841cc1d7db4c5c1ffada1f7da8804`；`GPT-CAPABILITY...BLUEPRINT.md=d6c649ae3e20e3fc221802bf7e9064b12da7a7f2da2a904117598226b94b6f76`；`功能法案.md=ed20318549900d6b3755566bb40448ae15b42eb5bc5519cceea9cc164ed52ca0`。`scripts/acceptance/local-browser-rate-limit-dialog-support.ts` 设计时必须不存在，因而无 prior hash；它只能由现有 `local-browser-auto-pairing.acceptance.ts` 单次调用、加入现役 manifest，且不得新增 npm/quality 入口。施工前任一已存在 source/authority/config hash 漂移必须重算受影响段；该新文件若已由其它 writer 创建则停止并裁决归属。

### 3.2 Website

- realpath：`/Users/nexgen/Documents/xuanxue-web`
- branch：`main`
- HEAD：`8a71d36402cd6b797be1eed80308e1f0fc967e6b`；tracking=`origin/main@8a71d36402cd6b797be1eed80308e1f0fc967e6b`，ahead/behind=`0/0`，工作树 clean。
- Website 已实现的 cooldown/receipt/cohort 主链是本轮 detector 修正的下游消费者，本轮零修改、零 migration、零合同版本变化。Website 不属于本轮 source candidate，当前 clean 也不得被冒充为新的 RELEASE 结论；本轮不得切仓追改 Website。
- 只有未来进入本方案原有 RELEASE 动态闭环时，才重新绑定 Website clean candidate，并复证 Browser exact fact 经现役 Runtime/Outbox 到 Website receipt/admission readback；这不阻塞 AGENT 内 WO-3A 的 CHANGE 施工与本域 acceptance。

任一 AGENT source candidate、active authority、HEAD、分支或相关 dirty overlay 变化，都必须重新计算受影响的设计段；Website 变化只在跨仓 RELEASE/readback 阶段重新绑定，不扩大 WO-3A。

## 4. 四维映射与第一直接断裂

| 维度 | 当前权威/实现 | 当前 GAP | 目标落点 |
|---|---|---|---|
| 法案系统 | AGENT active law 已冻结中央 preflight、`absent\|exact_present\|mismatch`、唯一精确 dialog、完整可交互按钮、一次 ack、单 lane/WAL；Website cooldown 权威保持现役 | 无法案缺口；当前实现仍输出 `unknown_present` 且 detector 未执行完整可交互分类 | 不改法案；让 `gpt-rate-limit-dialog.ts` 精确服从现役 major，并物理删除旧状态名 |
| 施工图 | GPT 与 Local Browser Blueprint 已定义 Browser fact → Runtime gate → 内部 ack Child → 2.5秒 absent readback → 现役 cooldown/receipt 主链 | 施工图已闭合，当前 detector 对 `textContent` 偶然结构过拟合，无法稳定进入主链 | 只原位修复 Browser Owner 的分类算法；不新增 watcher、Child、handoff 或跨仓版本 |
| 代码 | 中央 preflight、1.5秒门、WAL、ack intent、Runtime cooldown 与 Website consumer 均已存在；`gpt-rate-limit-dialog.ts` 用整段 `textContent`，acceptance 仅 stub 返回值 | 可见结构正确时可能被错判；exact_present 也尚未在 detector 阶段证明完整 pointer actionability | 复用 `BROWSER_MECHANICAL_FACTS_READER_SOURCE`，用 `innerText` 冻结顺序和精确标题/按钮完成同一 coherent classification |
| 质检 | 唯一 `acceptance:local-browser-terminal` 与全仓 `quality:check` 已存在，并已覆盖 fail-close、零物理输入和时序 | 没有执行生产 `functionDeclaration` 的 DOM fixture，导致同类回归可静态通过 | 在精确新文件 `scripts/acceptance/local-browser-rate-limit-dialog-support.ts` 中执行生产 detector，由现有 acceptance 单次调用；不建新 npm 入口或第二 verdict |

**本轮第一直接断裂只有一处：** Browser Authority 的 `gpt-rate-limit-dialog.ts::DETECTOR` 把原始 `textContent` 整段拼接等值当作可见语义结构，且没有在 exact_present 阶段复用现役完整 pointer actionability。中央 preflight、一次确认、Runtime gate、Outbox、Website cooldown 与最终 admission 主链已经存在，本轮全部复用；不得把历史已闭合的 1.5秒门、冷却或跨仓合同重新扩成施工范围。

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
| submit DISPATCHED、结果未知 | 先按现役 WAL/receipt/postcondition 零 submit 对账 | exact readback、同身份恢复 regrant | 盲点发送、创建替代任务 | CONFIRMED 后同上；若权威证明 `mutation_outcome=no`，转入 unsent subset，仍须同 job 最终入库 |
| 已有 staged/terminal、admission pending | 继续现有 Outbox 和 consumer | delivery、receipt hydrate、consumer retry/readback | 释放业务席位 | Website admission + storage readback |
| 已 claim 但 submit 未 DISPATCHED | 纳入 job cohort，本地 submit 门关闭 | lease/control 协调、必要的无副作用清理 | 冷却中 prompt submit、从闭环分母删除 | Website 持久 `WAIT_NEW_ATTEMPT`，冷却后按降低后的 N 为原 job 新授权并最终 admission |
| 尚未 claim | Website 返回 `DRAINING` + 冷却/旧任务排空原因 | queued 保留 | 无关新 grant | 冷却到期且 cohort 清零后再参与正常 claim |
| 点击结果未知 | 以 Browser WAL/postcondition 对账 | 只读确认 dialog 是否仍存在 | 盲点第二次 | 一次 confirmed ack 或 typed unknown 阻断 |
| 通知 HTTP 结果未知 | 现有 Outbox + Website write receipt 对账 | 同 request id receipt hydrate | 新 request id 重复升级 | Website 同一 receipt readback |
| 冷却期内多个 Tab 报同类弹窗 | Website 合并为同一活动冷却窗口 | 每个 Tab 可各自确认自己的唯一 dialog | 把并发观察算多次升级 | 返回相同步阶与 `cooldown_until` |
| 前一事故 ack 后已确认 dialog absent，且冷却结束、Website 已按降低 N 允许旧 cohort 恢复后又出现 `absent→exact_present`（旧 cohort 可以仍有 pending） | 原子 `level=min(level+1,6)` 且 `N=max(1,N-1)` | 新窗口，把旧集合与本次全部在途 job 去重并入同一 cohort | 把旧 cohort pending 误当活动窗口、重置为 5 分钟或杀死超额在途任务 | 10/15/20/25/30/30 分钟，恢复后按新 N grant |
| N 已降到 1 | 保持 N=1，新的独立事故继续按当前/最高阶冷却并重置稳定计时 | 旧任务收尾；冷却和 cohort 清零后以 N=1 正常工作 | 自动升容、按多 Tab 通知重复扣 N | 建立 `stable_since` 或保持 null |
| N=1 且冷却已过、cohort=0 | 第一次满足时持久写 `stable_since=server_now` | 有 demand 时以 N=1 正常 claim/执行/入库；无 demand 不造任务 | 以人工改时钟或本地时钟提前恢复 | 连续无精确限流事件的 Website 墙钟计时 |
| N=1 连续稳定满 6 小时 | 原子 CAS `max_in_flight:1→N0`，关闭 penalty epoch，level 归零 | 正常 N0 | 分步猜 N0、保留旧惩罚阶梯、提前复原 | 下一独立事故从 5 分钟与 N0−1 重新开始 |

`N0` 只在惩罚周期第一次事故时冻结；`ai_production_devices.max_in_flight` 始终是当前 N 的唯一真相。6 小时从“最后一次冷却结束”与“该事故 cohort 全部权威收尾”二者中较晚者开始；任何新的精确限流事件把 `stable_since` 清空。恢复 N0 时同步将阶梯归零，是把连续 6 小时稳定解释为一个新稳定周期的唯一有限规则，避免遗留一个没有终止条件的 30 分钟惩罚状态。

## 6. DOM 与 Browser 动作合同

### 6.1 全账号 1.5 秒页面访问门

Browser 是该频率的唯一 Owner；现役单 lane、site policy 与 extension runtime 已拥有只对 `https://chatgpt.com` 生效的逻辑访问准入。本轮只把它作为不可回归边界，不修改节拍实现、不把节拍复制到各 Product Child。现役定义：

```text
ordinary_chatgpt_page_access
  = 对 chatgpt.com 当前授权 Document 发起的一次逻辑 DOM observation、Tab/page activation、navigation 或页面 mutation

对任意两个不属于同一 atomic cycle 的 ordinary_chatgpt_page_access：
  next.started_at_monotonic - previous.started_at_monotonic >= 1500ms

唯一 atomic cycle 例外：
  exact rate-limit observation -> 同 Document revalidate -> one acknowledgement click
```

- “逻辑 observation”是一次 typed Browser intent 取得 coherent fact 的完整调用；其中为保证同一快照而执行的 `DOM.getDocument/query/describe/Runtime.callFunctionOn` 等 primitives 不是新的轮询周期，不在它们之间插入 1.5 秒破坏一致性。一次 fill 内为完成同一文本输入所需的 focus/clear/insert primitives 也算一个逻辑 mutation；菜单点击、菜单项点击、fill、Enter 等彼此仍是不同逻辑访问，不能借 compound command 绕过 1.5 秒。
- 跨 job、跨 Tab、跨 Product 共用同一 `chatgptPageAccessNotBefore`，不能每个 Child 各自计时。Browser/extension 重启后的第一次普通页面访问也先等待 1.5 秒，因而 crash 不能清空节拍。
- 若更长门同时存在，实际准入取最大值：`max(1.5秒全局门, 2.5秒 action→read, 40秒 post-submit quiet, Browser本轮70—90秒Provider observation间隔, 具体业务 backoff)`。
- deadline 剩余不足 1.5 秒时不再读取 DOM；直接以最后一次 observation 形成 typed timeout。禁止用 `Math.min(remaining, interval)` 在 deadline 尾部补 1–1499ms 的最后一读。
- 协议字段可以继续用整数毫秒表达，避免无价值的跨层单位迁移；质检裁决的是实际相邻页面周期 `elapsed>=1500ms`，不是变量名是否含 `Ms`。

现役路径的已闭合裁决（本轮只做回归验证，零修改）：

| 当前路径 | 现役事实 | 本轮裁决 |
|---|---|---|
| `dom-mutation-postcondition.ts` 与 `dom-intent-runtime.ts` | 已受 Browser Owner 的逻辑访问门约束 | 保持，不重新实现 |
| execution-profile hydration | 已服从中央逻辑访问门 | 保持，不修改 Child |
| attachment-control hydration | 已服从中央逻辑访问门 | 保持，不修改 Child |
| attachment upload settlement | 2/3/5/7/9/11秒 | 保留序列；任何缩短的 deadline 尾部不触发亚 1.5 秒读 |
| clean-chat hydration | 5/10/15/30秒 | 保留序列；尾部规则同上 |
| Provider response checkpoint | Browser每轮一次抽取70—90秒全局间隔；真实相邻观察至少70秒 | 保留，不被1.5秒门缩短 |
| action→read settlement | 2.5秒 | 保留；ack 后也适用 |

### 6.2 精确识别

Browser 对 `chatgpt.com` 的现役中央 site-policy preflight 已让每一次既有 ChatGPT 逻辑读/动作周期先在同一个 coherent observation 内取得固定 dialog 机械事实；它不是新增轮询或独立 probe。本轮只修正该 preflight 内 detector 的可见语义与 actionability 分类。对 observation intent，blocker fact 继续合并进同一次页面函数调用；对 mutation intent，任何物理输入前仍必须先分类，命中时原请求保持 `physical_input_count=0`。即使 assistant 尚未出现，也必须先返回 `absent | exact_present | mismatch`。`KnownGptRateLimitDialogFact` 只有同时满足 0.3 及以下条件才成立：

1. 当前 target/document 仍等于该 job 的 system Target 和 fresh current Document；
2. rendered-visible `[role='dialog']` 候选恰好为 1；零候选为 `absent`，多于 1 为 `mismatch`。只有 `facts.visible=false` 的真正不渲染 dialog 不进入基数；仍渲染但 `aria-hidden`/`inert` 的 dialog 进入基数并因 exact 条件不成立返回 `mismatch`；
3. dialog 内 heading 规范化文本精确为“请求过于频繁”；
4. 两段正文按顺序精确相等；
5. dialog 内 raw `button` 经唯一 mechanical reader 排除 `facts.visible=false` 的真正不渲染项后，可见候选恰好为 1；该项规范化文本精确为“明白了”，并满足 0.3 的全部 pointer actionability；仍渲染的 `aria-hidden`/`inert` 项不得排除；
6. 观察包只输出固定枚举、计数、规范化固定文案 hash、target/document identity，不输出 dialog HTML 或整页 DOM；现役 assistant 节点原始 DOM 仍只按当前专用合同交 task-owned evidence Owner。

零 rendered-visible dialog 只按第2项返回 `absent`。已有唯一可见 dialog 后，标题、正文或可见按钮候选缺一/多一、actionability 不完整、Document stale 或未知文案均返回 typed `mismatch`；只有真正不渲染的额外 dialog/button 不改变可见基数。不得按坐标、按钮序号、全页“明白了”或模糊关键词点击。

### 6.3 原子动作

Browser 中央 preflight 是唯一 detector；所有 Production GPT Child 的既有 Browser reply 可携带同一 typed blocker，并由 `ProductionGptChildTools` 的现役单一内部拦截点消费。`checkpoint_gpt_text_response` 只是 post-submit consumer。现役 Product 不可见 `acknowledge_known_gpt_rate_limit` 内部 Child 继续只负责把一次确认点击绑定到独立 Browser atomic identity/WAL；本轮不新增或修改该 Child。

```text
任一 Production GPT Child 的既有逻辑页面访问
  -> Browser central preflight/coherent observation
  -> exact known rate-limit fact
  -> 原 Child 本次预定物理输入为 0，并返回 typed blocker
  -> ProductionGptChildTools 内部拦截该 typed blocker（不返回 Product Flow）
  -> Runtime control port 先以现有 SQLite transaction enqueue immutable incident intent；该未决事实本身同步关闭 claim/submit 门
  -> internal ack Child 在当前 lane/lease 上 revalidate 同一 target/document/fact
  -> click 唯一“明白了”一次，独立 WAL identity
  -> fresh postcondition: dialog count = 0, target 不变
  -> Browser WAL settled receipt
  -> Runtime enqueue 同 incident 派生的 immutable clearance intent
  -> 现有 Outbox 严格按 incident→clearance 顺序 deliver Website；没有 clearance 行时后台发送器不得抢先发送 incident
  -> ProductionGptChildTools 按原阶段恢复：已发生 effect 继续 checkpoint/readback；未发生 submit 等待 Website 冷却后新 attempt 授权；非阻断 rename 可跳过但不得阻断 admission
```

ack 动作预算：`physical_input_count=1`，navigation=0，submit=0，Tab switch=0。分类完成到 click dispatch 的正常链 SLO `<=1000ms`；该 detection→ack 原子周期不人为等待 1.5 秒。中央 preflight 对普通动作的 fail-closed 不得拦住这一个内部 ack intent：ack Child 只能携带刚取得的 exact blocker identity，在同一 lane 内 revalidate 后消费它，不能成为通用 bypass。质检同时记录 p50/p95/max，任一超过 1000ms 的受控样本使该 SLO 失败；ack 之后的 readback 至少等待现役 2.5 秒。持久存储不可写时，Runtime 总门必须失败关闭并保持零点击；只有 immutable Outbox intent 已持久且 claim/submit 门可从它重建后，Browser 才允许确认该精确 dialog。

旧 `web/children/rate-limit-dialog.ts` 继续不存在；现役内部 Child 位于 `src/capabilities/gpt/children/**` 主链，只接受内部固定输入且从 `ProductGptChildCapabilityId` 排除。不得新增同义 helper、第二 ack Child、插件级特殊分支或旧路径兼容壳。

## 7. 现役唯一主链与本轮 handoff 边界

下列链已经存在，是 WO-3 detector 修正必须接回且不得改写的 consumer 主链；箭头不表示本轮新增 Runtime、Outbox、Website 合同、字段、migration 或状态。

```text
任一 Production GPT Child 的既有 ChatGPT 逻辑访问
  -> Browser: global account page-access gate (ordinary cycle >=1.5s)
  -> Browser central preflight: exact dialog fact; 原请求零物理输入
  -> Runtime: local provider gate CLOSED + existing Outbox control intent
  -> GPT internal ack Child -> Browser WAL: exact one-click acknowledgement receipt
  -> Runtime -> Website: immutable provider-rate-limit notice
  -> Website transaction: freeze N0 if needed + current N=max(1,N-1) + cooldown/cohort receipt
  -> Website claim: 冷却中只允许 cohort effect 的零 submit收尾；冷却后按新 N 继续 cohort unsent jobs
  -> effect subset: renew -> exact readback -> result -> existing Outbox
  -> unsent subset after cooldown: same job -> authorized new attempt -> normal submit/result
  -> Website terminal -> domain consumer -> admission receipt -> durable readback
  -> closure_pending = empty
  -> cooldown expired AND closure_pending empty: unrelated normal claim lazily resumes at reduced N
  -> N=1 stable_since + 6h without new incident: atomic restore N0 and reset penalty epoch
```

### 7.1 Browser → GPT

- 检测输入：exact target/document、execution binding 与 known-dialog contract version；user turn 只在 assistant checkpoint 场景需要。Browser 每次既有 ChatGPT logical access 的中央 preflight 都输出 `absent | exact_present | mismatch` blocker fact；需要 assistant fact 的路径在同一 coherent observation 合并输出，不另起 DOM 周期。
- ack 输入：只来自 GPT production tools 内部的 `incident_request_id + dialog_observation_hash`，Product API 不暴露；确认动作输出 Browser WAL logical mutation id、前后 observation hash、postcondition、physical input count。
- unknown：WAL 已 DISPATCHED 时只做 postcondition/readback，不重点击。
- Browser command/receipt 同时给出本次逻辑页面访问 ordinal、单调起始时间差和实际命中的更长节拍；不得记录 DOM 正文。除 detection→ack 原子例外外，任何 `<1500ms` 都 typed fail closed。

### 7.2 GPT → Runtime

- checkpoint 报告触发 job 身份和 dialog hash；`ProductionGptChildTools` 在结果交给 Product 前拦截，调用 Runtime 注入的单一 `ProviderRateLimitControlPort`。该 port 在允许内部 ack Child 前必须先用现有 SQLite transaction 写入 immutable incident Outbox intent，并由这条未决记录关闭 claim/submit gate；ack WAL settled 后再写同 `incident_request_id` 派生的 immutable clearance intent。现有后台 Outbox 只有看见匹配 clearance 行后才可按 incident→clearance 发送，避免“事故通知先到 Website、点击尚未发生”的竞态；它不是 Product action、第二 scheduler 或第二状态机。
- Runtime 同时附上本地去重 in-flight attestation 供 Website 核对，但 Website 从自己的 accepted/grant/admission 状态冻结权威 `rate_limit_job_cohort`；AGENT 本地集合不得成为分母真相。
- gate 阻止无关新 business claim 和任何未获 cohort 恢复裁决的 `submit_exact_gpt_turn_once`。effect subset 的 exact readback、交付和 admission 始终允许；unsent subset 在 Website 冷却期内不得 submit，冷却后只有匹配降低后 N 的新 attempt 授权才可继续。不得把 `state.draining=true` 当作实现，因为现有 shutdown 会 abort 全部 active job。
- submit gate 必须在 Product 调用准入和 Browser `providerInputGuard` 即将产生第一次物理输入时各校验同一 Runtime 状态；与限流检测并发的另一个 job 若已越过物理输入门，则纳入 Website cohort 并按已发生/unknown effect 收尾，不能假装未发送。
- gate 的 restart truth 由现有 `production_outbox` 中未完成/已回执的 `provider_cooldown` 写和 Website receipt 派生，不新增第二本地表。

### 7.3 Runtime → Website

- 现役 `ProductionOutboxWrite.kind` 和 Website write receipt 已包含唯一 `provider_cooldown`；本轮只消费，不扩展枚举。
- 路径绑定触发 job，例如 `POST /internal/ai-production/v6/jobs/{job_id}/provider-cooldown`；请求携带事故发生时的 attempt/lease/fence 和 `incident_request_id`。控制通知以当前已认证 device/session epoch 授权；attempt/lease/fence 是不可变触发证据，Website 核验该 job 在事故时确属该 device，但不得仅因通知送达时 lease 已到期而拒绝事故通知。该写只改变 Provider 控制状态，不冒充 job terminal/result/admission 写。
- 正常链只有 Browser ack receipt 已 `CONFIRMED` 后才 external deliver。若物理点击已进入 WAL `DISPATCHED` 但结果未知，或 revalidate 后动作资格失败，本地 gate 仍关闭，并按固定幂等body先交付incident再交付`not_cleared`；Website 仍进入冷却，因为精确限频 DOM 已成立。事故 receipt 的 clearance 状态必须是 `confirmed_absent | pending_unknown | not_cleared`，只有第一种携带 absent observation hash。恢复继续使用首次`observed_at+1s`截止点；同Target/Document重验后dialog已不存在时允许零点击absent readback闭合。unknown 只能读回同一 ack postcondition，不能为满足“点击后通知”而盲点第二次。ack在唯一logical page queue中只取得当前周期之后的最高优先级，不抢占当前CDP primitive、不并发建立第二lane。
- 第一次检测创建 `incident_request_id` 并随 Outbox durable 保存；事故正文同时绑定原 grant 的 `capability_manifest_hash`、worker instance、session-open request、attempt/lease/fence、target/document 与 dialog observation。crash 后 Runtime 只能用原 worker instance + session-open request 幂等重开同一 Website session，并从同一未决/已回执 Outbox、同一 `bound-observation` Browser target 和同一内部 ack Child 恢复；Browser WAL 已确认时只读回，不得第二次点击，也不能因新的 observation revision 创建第二事故。其它 Tab 可以产生各自 ack receipt/request，但 Website 在同一活动事故门内只减一次 N。
- HTTP unknown 使用现有设备 job status `write_receipts` 对账并 hydrate 同一 Outbox；不得建立专属重试队列。失败待重试的 `provider_cooldown` 仍计入 pending/ledger truth，不能被 `last_error` 从健康状态分母中隐去。对账证明远端无 receipt 后，也只能重送同一 immutable request id/body。若初始 clearance 是 `pending_unknown/not_cleared`，后续只沿同一 `incident_request_id + Browser WAL identity` 做 postcondition readback；取得 absent 后，用同一 `provider_cooldown` kind 和 endpoint 写一次确定的 `phase=clearance` immutable 事件，其 phase request id固定派生自 `incident_request_id`，只把同一事故的 clearance receipt hydrate 为 `confirmed_absent`，绝不创建新事故、重复点击、延长冷却或再次 N−1。若同一ack WAL已经是`REJECTED`或`DISPATCHED`，不可篡改旧终态、也不可让通用原子入口先抛错而永久卡门；恢复必须使用同一Browser facade、同一lane和原Target/Document执行普通1.5秒节流的专用只读`readKnownGptRateLimitClearance`，它不写第二WAL且零物理输入。仅精确absent认证事实可闭合原incident；仍存在、mismatch或身份漂移一律保持`not_cleared`。若资格失败但 WAL 证明零物理点击，只有新的 exact target/document preflight 仍命中时才可按同一活动事故创建该 Document 自己的唯一 ack identity。

### 7.4 Website 冷却与 claim

- 冷却、N 调整和事故排空唯一 Owner：Website AI acceptance。当前 N 与该设备的惩罚周期都只属于 exact `ai_production_devices` 行；全局 `ai_production_control_protocol_state` singleton 不参与本合同，避免多设备串扰。
- exact device row 现役五项 `provider_rate_limit_level`、`provider_rate_limit_until`、`provider_rate_limit_baseline_n`、`provider_rate_limit_stable_since`、`provider_rate_limit_job_cohort_json` 与 `max_in_flight` 同 Owner、同锁、同事务；本轮零 schema/字段变化。最新 incident/receipt hash 与 distinct-incident 证据链继续从现有 write receipt 读取，不在 device row 复制；cohort 与守恒 readback 保持现役合同。
- Website 先按 `incident_request_id + payload_hash` 幂等回读 write receipt；新惩罚周期第一次事件在同一事务锁定 exact device row，冻结 `baseline_n=current max_in_flight`，随后把当前 N 原子写为 `max(1,current-1)`，设置 level=1、until=server_now+5分钟、stable_since=null、冻结全部在途 job，并写 receipt。
- 第一次事故 receipt 固定记录当前 clearance 枚举；`confirmed_absent` 才带 ack 后 dialog absent observation hash，`pending_unknown/not_cleared` 必须沿 7.3 的同事故 clearance hydrate 收敛。后续新 incident 只有在前一 cooldown 已到期且现役 write receipt 已证明前一 clearance 为 `confirmed_absent` 时，才在同一 device-row 事务执行 `level=min(level+1,6)`、`N=max(1,N-1)` 和新 cooldown；旧 `closure_pending>0` 不是活动窗口，必须把旧 cohort 与当前全部未 admission 在途 job 按 job 去重取并集。只有 `server_now<cooldown_until` 的活动窗口、前一 clearance 未确认或同 request 重放才只读回同一步，不延长、不升级。
- claim 在读取设备容量和选择 job 前锁/读同一控制行。事故排空期间只能重授 cohort 原 job 的 `ACTIVE_ATTEMPT` / `CONSUME_CURRENT_RESULT` 零 submit 恢复；不得选择无关 job。没有可恢复 cohort job 时持久返回 `DRAINING`、空 jobs，并按事实给出 `PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE` 或 `PROVIDER_RATE_LIMIT_DRAIN_REMAINING`、step、server time 和 cooldown until。
- `server_now >= provider_rate_limit_until` 只解除时间门：effect subset 继续零 submit 读回；unsent subset 与依法取得新 result revision 的 cohort job 可在降低后的 N 内取得精确新 attempt/submit 授权。若此时再次出现精确弹窗，即使旧 cohort 尚有 pending 也属于下一 distinct incident并再次升级。无论是否曾 `mutation_outcome=no`，job 都只能在 admission/readback 后进入 `closure_admitted`，或在用户事后独立、明确、合规的永久终止后进入 `closure_user_terminated`；`closure_pending=0` 后 Website 才恢复无关新 grant。
- 缩容不杀在途：若事故发生时 Website/AGENT 在途数大于新 N，旧 job 保持 lease/recovery/admission 权利，新 grant capacity 固定为 0，直到在途自然收敛到新 N 以下；不得 abort、failure、重复计数或迁移 Tab 来强行符合 N。
- 当当前 N=1、cooldown 已结束且 `closure_pending=0`，Website 首次在 exact device row 把 `stable_since=server_now`；此后仍按 N=1 正常工作。`server_now >= stable_since+6小时` 且期间无新精确限流事件时，在同一 device-row 事务 CAS `max_in_flight:1→baseline_n`，并清空 level/until/baseline/stable/cohort 活动态。任一新事件先清空 stable_since 并进入当前阶冷却。管理员 capacity endpoint 在惩罚周期内拒绝手工改 N，避免双 Owner；紧急止血仍使用现役 `admission_state=draining`。
- heartbeat、renew、terminal、artifact、device job status 和 business consumer 路径不受此 claim gate 阻断。
- 冷却到期不需要 timer/service：下一次现有 claim 以 Website server time 惰性判定。provider receipt 必须自哈希绑定 `server_now/cooldown_until`；活动窗口内每份 claim receipt 都携带固定 `PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE` reason。AGENT 只在通知送达后用现有 claim 作权威探测，并仅接受时间不早于最新 provider receipt `server_now` 且不再含该 reason 的 Website claim receipt开 submit 门；本机 `Date.now()`、休眠或 Website 不可达均不能开门。无关正常 claim 恢复条件固定为 `server_now >= cooldown_until AND closure_pending=0`。
- `0139_ai_production_provider_rate_limit_cooldown.sql` 是现役历史 migration，本轮不得重跑、改写或新增后继 migration；未来 RELEASE 只读回现有 registry、五列和约束。

### 7.5 业务完成 readback

- Website 控制室必须按 exact device 读取当前 cooldown level/until/reason、`baseline_n`、唯一当前 N、`stable_since`、恢复 N0 的最早时点、触发 receipt hash、设备无关新 grant=0、`rate_limit_job_cohort_count`、`effect_recovery_subset_count`、`closure_admitted_count`、`closure_user_terminated_count`、`closure_pending_count`。
- 三个 closure count 只从 Website 持久 job/consumer/admission/用户终止 authority 状态计算，不信任 AGENT 日志或进程内集合；三者互斥且并集恒等于 cohort。
- 只有冷却到期且 `closure_pending_count=0` 才能恢复无关新工单并宣告“这次限频没有留下半截任务”；只有同时 `closure_user_terminated_count=0` 才能再宣告“全部成功入库”。单独冷却到期、`mutation_outcome=no`、本地 terminal 或 N 已降低都不代表旧任务已收尾。

## 8. 原子工单与施工顺序

### WO-0：当前权威与候选重绑

- Owner：AGENT Browser Authority；本工单不修改 law-system。
- 当前事实：本方案需要的 active law、GPT Blueprint、Local Browser Blueprint 与 Runtime/Website 下游合同均已在现役 HEAD 定义，不存在等待解冻或另行 law amendment 的前置。
- 施工动作：代码修改前重新读取 AGENT HEAD、tracking、完整 status、本节 source hash 与 active authority hash；当时存在的无关用户 dirty/untracked overlay 只记录并排除，不格式化、恢复、覆盖或纳入本轮差异；目标生产文件、acceptance 和 manifest 如有未归属改动则停止。
- 完成门：届时 scoped source/authority hash 与 3.1 记录一致，且完整 status 无施工面未归属改动；HEAD、tracking 或无关 overlay 变化不得通过恰好匹配历史 dirty 集合伪造准入。若相关 source/authority 漂移，只重算受影响段并再次独立审计，不得进入代码。Website 只在未来 RELEASE/readback 阶段重绑。

### WO-1：Website 持久冷却 Owner（现役基线，本轮零修改）

- Owner：Website AI acceptance。
- 路径片区：`data/migrations/commercial/**`、`packages/ai-contracts/src/agent-task/{website-agent-route-policies.v1.json,website-agent-route-policy.ts,website-agent-task-result.ts}`、`services/api/src/ai-production/**`、`scripts/audit/domains/ai-acceptance/{check.ts,manifest.json}`、`tests/exam/ai-production-v6-contract.test.ts` 与该 domain 既有 dynamic proof。
- 本轮裁决：上述结构已经是 detector exact fact 的现役下游消费者，本轮不得修改、迁移或复制。未来 RELEASE 只复证既有 receipt/cohort/readback，不重做 migration 或合同。
- 验收：并发 notice 只升一次/只减一次 N；5/10/15/20/25/30/30；活动窗口不延长；N 按事件 `3→2→1` 或 `4→3→2→1` 且不低于 1；缩容不杀超额在途；无关新 grant=0；effect subset 同身份恢复、unsent subset 冷却后继续、renew/terminal/admission 全部可用；时间已满但 cohort 非空仍不放无关新工单；ack unknown 必须以同 incident/WAL 从 `pending_unknown→confirmed_absent`，其后新 `exact_present` 才升级且只升级一次；N=1 满足稳定门前不升，连续满 6 小时后一次恢复 N0 并把下一事故重置为第一阶。
- 回退：保留已经持久的冷却/receipt 事实，回退到匹配的 Website commit；不得删 receipt 或重新开放 claim 来伪造恢复。

### WO-2：AGENT Runtime 持久门与通知（现役基线，本轮零修改）

- Owner：Agent production runtime。
- 路径片区：现有 production contracts、`store-foundation/outbox`、cloud client/reconciliation、runtime loops/state、既有验收与审计。
- 本轮裁决：现役 Outbox、provider gate、receipt hydrate 与 restart truth 全部复用；本轮只让 Browser detector 能正确产生既有 exact blocker fact，不修改 Runtime 状态、存储、队列、通知或恢复逻辑。
- 验收：进程在 enqueue 后、click 后、HTTP dispatch 后分别 crash，重启均不产生新 claim/submit；同 request 最终只一个 Website receipt。
- 禁止：复用 shutdown abort、增加 cooldown SQLite 表、第二 retry worker 或环境变量调步长。

### WO-3：Browser 可见语义精确识别

- Owner：Browser 拥有 DOM 事实/WAL/物理点击；GPT checkpoint 拥有业务语义调用和同回答继续读取。
- 路径片区：修改 `src/lib/browser/chrome-extension/gpt-rate-limit-dialog.ts`、`scripts/acceptance/local-browser-auto-pairing.acceptance.ts`、`scripts/audit/domains/local-browser-session/manifest.json`，新增 `scripts/acceptance/local-browser-rate-limit-dialog-support.ts`；只读复用/验证 `dom-mechanical-facts.ts`、`extension-target-authority.ts`、`package.json`、`package-lock.json`、GPT Child、Runtime、Outbox 和 Website consumer。
- 动作：按 0.3 原位替换 detector；复用现役 mechanical facts reader；把 `unknown_present` 物理替换为 `mismatch`；在 `scripts/acceptance/local-browser-rate-limit-dialog-support.ts` 实现执行生产 functionDeclaration 的无网络 Playwright fixture，由主 acceptance 单次调用并将新文件加入现役 manifest。不得新增生产 helper、watcher、selector fallback、状态、接口或持久化。
- 验收：0.4 全部分支通过；现有中央 preflight、零原动作输入、单 ack、`>=1500ms` 普通门、`observation→dispatch<=1000ms`、ack 后 `>=2500ms` fresh readback 的既有断言无回归。
- 禁止：修改或复活退役 rate-limit 文件、增加 Product action、扫描整页、保存原始对话内容，或在 detector 与 click runtime 各维护一套 actionability。

### WO-4：发布与跨仓 readback 边界

- 本轮不改变跨仓合同、Website schema、Runtime通知或部署顺序，因此不存在新旧合同空窗，不执行 Website migration或部署。
- AGENT READY 必须使用包含 WO-3 的 clean commit；RELEASE 前按现役发布程序绑定 AGENT 与 Website 各自 clean candidate。若 Website 仍有未归属 dirty，RELEASE 阻断，但不得把它吸收到本轮修复。
- 真实自然限频事件发生时，复用现役 Runtime/Outbox/Website 主链取得 cooldown receipt、cohort admission 与 storage readback；失败保持现役 gate，不允许兼容桥、feature flag、第二 endpoint 或双写。

### WO-5：真实动态闭环

- Owner：两仓 RELEASE 各自按 active law dynamic proof 声明执行；Website admission readback 是共同业务终点，不是跨仓第二 verdict。
- 在受控真实 Chrome/GPT、真实 Website 上取得一次自然发生的限频事件；不得通过高频轰炸故意诱发。
- 事件发生前准备至少：2 个 submit 已 CONFIRMED 的 job、1 个已 claim 未 submit 的 job、1 个 queued job；不得为造样本故意提高页面频率或轰炸 Provider。
- 必须证明：全账号普通页面访问实测无 `<1500ms`；唯一 DOM 精确点击且 detection→ack 不被节拍延误；无关新 submit/claim=0；两个已提交 job 均原 effect 入库；未 submit job 冷却中无 Provider 输入、冷却后仍是同 job 并最终入库；queued job 在旧 cohort 全部闭合前无 grant；即使 5 分钟先到、cohort 非空也不恢复无关新工单；cohort 闭合后以 N0−1 恢复；下一次自然 `absent→exact_present` 即使发生在 submit 之前，也必须成为 10 分钟且再 N−1 的 distinct incident。
- 6 小时恢复证明不得真实占用 6 小时阻塞 CI：状态机/property 用 Website 可控 server clock 覆盖 `6h-1ms` 不恢复、`6h` 才可恢复、期间新事故清零 stable_since；RELEASE 另以真实 N=1 连续运行窗口和服务器时间戳/readback 证明至少 6 小时。若没有这段真实窗口，只能声明 CHANGE/READY，不能声明自动复原已生产证明。
- 当前截图和 2026-09-15 历史只读 DOM 只能作为设计输入，不能替代未来候选的 RELEASE 证据；截至 2026-09-21 尚无新的 live DOM readback。

## 9. 分层验收

### 9.1 静态与合同

- 旧 `rate-limit-dialog.ts` 及同义兼容路径为零。
- 本轮生产差异只允许 `gpt-rate-limit-dialog.ts` 原位 detector 修正；`dom-mechanical-facts.ts` 只复用不复制，Product、GPT Child、Runtime、Outbox、Website 生产代码零差异。
- 测试差异只允许 `scripts/acceptance/local-browser-auto-pairing.acceptance.ts`、新增 `scripts/acceptance/local-browser-rate-limit-dialog-support.ts` 和 `scripts/audit/domains/local-browser-session/manifest.json`；`package.json`/`package-lock.json` 只读复用现有 Playwright，依赖差异必须为零。
- detector 状态只剩 `absent | mismatch | exact_present`；`unknown_present` 在生产和测试中均为零。
- Product facade 不出现新的确认动作；只有一个 detector、一个 Browser lane、一个 ack Child、一个 cooldown Owner、一个 Outbox 和一个质量 verdict。
- active law、Blueprint、跨仓 schema/version/hash 零修改；本轮没有“新合同”。

### 9.2 DOM/Browser fixture

- 精确中文 dialog：detector 返回 `exact_present`；现役内部 ack 链保持最多 1 次物理点击，postcondition dialog=0。
- profile、附件、发送资格、submit/navigation preflight、assistant checkpoint 或 rename 中任一业务节点尚未满足但精确 dialog 已出现：同一次中央 preflight/coherent observation 必须先返回 blocker fact，原请求零物理输入；Runtime durable gate 早于 ack dispatch。
- 错字、少一段正文、唯一可见按钮 disabled/aria-disabled/aria-hidden/inert/viewport外/pointer-events none/hit-test遮挡、两个可见按钮、两个可见 dialog、stale Document：0 次点击，typed mismatch/failure；一个完整可交互按钮加 `display:none`、`visibility:hidden`、`hidden` 或已证明不贡献 `innerText` 的无 layout button 仍为 exact；`opacity:0`、`aria-hidden`、`inert` 额外按钮的文字若进入 `dialog.innerText` 则为 mismatch。
- ack DISPATCHED 后 crash：WAL readback，不二次点击。
- observation complete → click dispatch：每个受控样本 `<=1000ms`。
- 除上述唯一 detection→ack 例外，跨 job、Tab、Product、普通读/动作、重命名以及 extension restart 的相邻逻辑页面访问全部 `>=1500ms`；deadline 剩余 1–1499ms 时 observation 增量为 0。
- 更长节拍不退化：action→read `>=2500ms`、post-submit quiet `>=40000ms`、Provider每轮抽样计划值位于`70000..90000ms`且真实相邻observation `>=70000ms`。

### 9.3 Runtime/Website 状态性质

- N=1..4 均满足冷却中 grant=0，Browser lane<=1。
- 任意并发通知顺序，活动窗口只产生一步、一次 N−1 和一份每 request receipt。
- 阶梯精确为 `[5,10,15,20,25,30,30]` 分钟。
- N 序列对任意 N0∈[1,4] 精确为重复 `max(1,N-1)`；N=1 后不再下降。缩容时旧在途数可暂时高于新 N，但新 grant=0 且旧 job 不被失败/取消。
- N=1 只有在 cooldown expired、`closure_pending=0` 后才建立 `stable_since`；`stable_since+6h-1ms` 不恢复，`+6h` 才 CAS 恢复 N0；期间任一新事故重置，恢复后 level=0，下一事故重新 5 分钟。
- clock 只使用 Website `server_now`；本地时钟漂移不提前开门。
- crash 点覆盖 enqueue 前后、Browser dispatch 前后、Website HTTP 前后、receipt hydrate 前后。

### 9.4 业务闭环

- 事件快照的 `rate_limit_job_cohort` 有确定 job 分母，effect/unsent 子集互斥且并集完整；后续新事故只按当时新增在途 job 并入，不遗漏、不重复。
- effect subset 每个未被用户事后独立终止的 job 都能从原 provider effect 追到 result hash、terminal receipt、业务 consumer、admission receipt 和 storage readback；unsent subset 必须从同一 job demand、新 attempt 授权继续到同一终点，`mutation_outcome=no` 不能冒充完成。
- `closure_admitted/closure_user_terminated/closure_pending` 互斥且并集完整；用户终止为零时才可报告全部成功入库，用户终止非零时只可报告无半截并逐 job 披露终止。冷却期间 admission throughput 不被误挡；`closure_pending_count` 单调降到 0。
- 人工 stop、Runtime shutdown 或网络中断不能把未闭合 job 伪装为已完成。

### 9.5 原生质量入口

- AGENT：使用仓库唯一 `npm run quality:check -- <CHANGE|READY|RELEASE>` 及 active law 声明的既有 GPT/Browser/Runtime focused acceptance/real proof。
- Website：本轮 CHANGE/READY 零修改且不运行 Website 施工质检；只有未来 RELEASE/readback 绑定 clean Website candidate 后，才使用其唯一 `pnpm run quality:check -- RELEASE` 与现役 AI acceptance proof。
- CHANGE、READY、RELEASE 分开；低层 PASS、HTTP 成功或真实点击均不得冒充 Website 入库。

## 10. 停止、恢复与失败关闭

1. DOM 不精确：零点击、零猜测；本次不能声称发生已知限频。若已由其它精确 Tab 建立冷却，继续遵守该冷却。
2. Outbox/ledger 不可写：claim/submit 失败关闭且精确 dialog 保持零点击；只有同一 incident intent 已在现役 `production_outbox` durable readback 成功、并能由它重建本地总门后，才允许唯一 ack Child 确认一次。恢复前不得开新请求。
3. ack 失败或结果未知：Website 冷却仍成立；先查 Browser WAL和实时 postcondition，不盲点第二次。
4. Website 通知不可达：本地 gate 永不因本地计时自行打开；先以同 request read-only receipt 对账，再接回现有 Outbox交付。
5. cooldown 到期但 `closure_pending>0`：仍禁止无关新 claim；effect subset 只允许同 effect 零 submit 收敛，unsent subset 才允许 Website 精确授权的新 attempt；即使权威证明某 effect 实际未发生，该 job 仍留在 pending，直到最终入库回读或用户事后另行作出合规永久终止。
6. lease/control 要求取消某 job：遵守 Website 现役业务 authority，但已经发生/未知 Provider effect 仍先零 submit对账；不得因限频自动取消。
7. 生产人工停机不是恢复措施。若必须停机，先由 Website draining 并证明本次 `closure_pending=0`、所有未被用户独立终止的 cohort job 已 admission/readback，且未知 Provider effect 为零。
8. 惩罚周期内管理员试图改 N：Website 拒绝，不以人工值覆盖 baseline/current；若需紧急全停，使用现役 admission draining，恢复后仍接回同一 penalty epoch。

## 11. 删除反事实裁决

| 结构单元 | 保留理由与删除后具体失败 | 更短复用裁决 |
|---|---|---|
| Browser 每次既有 ChatGPT logical access 的中央 known-dialog preflight | 删除后 profile/附件/submit/导航等 checkpoint 之前的弹窗仍会漏检并卡住任务 | 合并进既有 coherent observation/action preflight，不加独立轮询或 probe Child；checkpoint 只是消费者 |
| Browser 全账号 1.5 秒访问门 | 删除后各 Child 与各 Tab 仍可分别以 50ms/25–250ms 重读，无法兑现降频 | 复用单 lane/extension runtime；删除各处同义快速 helper |
| 一个 Product 不可见的内部 ack Child + Browser typed intent/WAL receipt | 删除后 observation-only checkpoint 不能安全承载 mutation，无法证明只点一次、Document 未漂移或 crash 后不重点击 | 复用现有 Child registry与 Browser WAL/lane；不暴露 Product action，不建第二 ack |
| Outbox `provider_cooldown` kind | 删除后 click 与 Website 通知之间 crash 会丢失关门事实 | 复用现有 Outbox/receipt/hydration，不建表/队列 |
| Runtime claim+submit gate | 只挡 Website claim 仍可能让已经领取但未 submit 的 job 发出新请求 | 从同一 Outbox/Website receipt 派生，不建第二状态机 |
| GPT→Runtime 单一 control port | 删除后 GPT 的 DOM detector 要么越界写 Runtime store，要么先点后关门；两者都破坏 Owner 与事故顺序 | 只注入关闭门、持久 intent、交付 receipt 三项窄能力，不暴露 Product，不建 service |
| exact device row 五个惩罚字段 + 当前 N 同行原子 CAS | 删除后阶梯、截止时间、N0、6小时稳定门、冻结 cohort 和 readback 无 durable Owner；放全局 singleton 会与 per-device N 作用域错位并串设备 | 复用现有 device row，不建 cooldown table，不改全局 singleton |
| 一个 typed notice endpoint/receipt | 删除后 Website 无法原子关闭 grant并回读通知 | 归入现有 V6 job/write receipt 路由 |

已删除/拒绝的结构：旧 rate-limit helper、独立 probe Child、第二 ack Child、第二 cooldown 表、第二队列、timer service、产品私有 pause、AGENT/Browser 的 N 副本、逐 job 频率门、强制 abort active jobs、重发 recovery、兼容桥、feature flag、原始 DOM/URL台账、专属 quality 命令和新的 Agent。现役唯一内部 ack Child、Runtime gate、Outbox、Website cooldown/N−1 与 cohort 是 detector 的既有真实消费者，本轮只复用不修改；本轮唯一新增测试结构精确为 `scripts/acceptance/local-browser-rate-limit-dialog-support.ts`，删除它会使生产 detector 的真实 `innerText`/layout/hit-test 回归无法被现有 stub 发现；它只由现有 acceptance 单次调用，不形成新入口或新 verdict。

## 12. 施工准入与执行 Codex 重绑定

本轮唯一施工顺序冻结为：

1. 执行 WO-0，只重绑 3.1 的 AGENT source candidate、active authority 和届时完整 status；保护并排除所有无关 dirty/untracked overlay，不修改法案、Blueprint、跨仓 spec、registry、Runtime 或 Website。
2. 执行 WO-3：原位修正 detector，复用唯一 mechanical reader，物理删除 `unknown_present`；新增 `scripts/acceptance/local-browser-rate-limit-dialog-support.ts` 承载生产 functionDeclaration 的无网络 Playwright fixture，由 `scripts/acceptance/local-browser-auto-pairing.acceptance.ts` 单次调用，并将新文件加入 `scripts/audit/domains/local-browser-session/manifest.json`。
3. 运行 `npm run acceptance:local-browser-terminal`，再运行仓库唯一 `npm run quality:check -- CHANGE`；失败只围绕同一 detector GAP 修复，不扩大到无关 dirty或跨仓。
4. CHANGE 通过后重新核对 diff：生产差异仅 `gpt-rate-limit-dialog.ts`；其余只允许 `local-browser-auto-pairing.acceptance.ts`、新增 `local-browser-rate-limit-dialog-support.ts`、`local-browser-session/manifest.json` 和本方案，`package.json`/`package-lock.json` 差异为零。独立子智能体只读复审零阻断后，才能形成 clean AGENT commit进入 READY。
5. READY/RELEASE 分开。RELEASE 前绑定 clean Website candidate，但不部署 Website 新合同或 migration；只用自然发生的真实事件复证现役 receipt/cohort/admission/readback。

Provider 文案、`role=dialog`、单一 `aria-labelledby` 或 actionability 结构若在未来真实证据中漂移，必须 `mismatch`、零点击失败关闭并回到同一方案，禁止扩大 selector或猜测。最终报告分别写明 CHANGE、READY、RELEASE；没有真实 Browser ack receipt 与 Website 持久 readback，不得声明事故闭环。
