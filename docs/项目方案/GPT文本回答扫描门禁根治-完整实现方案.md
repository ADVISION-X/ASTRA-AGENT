# GPT 文本回答扫描门禁根治－完整实现方案

状态：**CHANGE 候选已施工，待原生质检**。授权人已明确允许修改法案、施工图、代码和质检；双仓现役法案与施工图已遍历，主 Codex 对权威对齐完成两遍自检后进入代码。

## 1. 需求、终点与范围

授权人本轮只处理三项：①当前 Document 已有原 Product `turnMarker` 对应的 user turn 和相邻 assistant 回答时直接读取，不再为走到页面顶部继续滚动；②仅在目标尚未挂载时滚动，按页面实时容器几何和命令剩余时间推进，不使用固定像素高度或固定步数上限；③删除 `document.visibilityState === "visible"` 对文本回答扫描的准入限制。附件上传、续租、图片读取、Provider submit、WAL、Website 业务接纳不在本轮施工范围。

权威业务终点是同一已确认 Provider effect 的原 canonical conversation URL 上，零新增 Provider 输入地取得原 marker 的真实相邻回答，经现役 GPT checkpoint、artifact、Outbox 和 Website 同身份接纳链完成。页面答案只证明 Browser 可读；不冒充 Website 入库完成。

两个事故页面的前轮只读取证：`aiprod_5e732561…` 当前页面有原 marker、当前 user UUID 与紧邻 assistant；`aiprod_f2dd71d8…` 当前渲染 turn 未见原 marker/UUID。后者不能因扫描超限而判定原提问或回答不存在。前轮页面高度约 67,652 与 60,844 像素，是可漂移的事故观察值，不进入代码常量。施工前需重新读取真实页面、WAL 和 Website 同身份状态；不得重发原 Prompt。

## 2. 候选与现役主链

- Owner：AGENT Browser exact text observation；项目根 `/Users/nexgen/Documents/AGENT`，`main`、HEAD 与 `origin/main` 均为 `7b2c5f1e691d8c2987d99bc4d9512ae6f29bcba2`，方案写前 Git clean。相关源候选 SHA-256：`功能法案.md` `20607c1d7c5f2223c26945276ce0f30f1281e5b3cd593956c0abb34623286e06`，Browser Blueprint `a216c62647ee9e494d3da5816dabb96a2c5ab7ee84529791f920cf4b0429cdb6`，GPT Blueprint `669532af579ba4113100ac65ad53f8f2f942e862b2a8814257f74fe976277de6`，V6 Blueprint `8c2c5e67cae3283f6b94e17c3d38e92c95034e55be31e8fc3c1e3dcc40037e90`，`dom-exact-assistant-turn.ts` `9643e82627b73682b51a976666d29a50f5be3e21c429800ba08e248197933794`，定向验收 `60db23ff018a37e784812c9e24ee9f78602bb83c03843fa2408f3300185ae8ea`，Browser inspector `15f70eca802c18bc335ab154d5cf4dde9f915baba30f61b1b1469dba87a8341d`。施工前重新计算；方案文件自身单列，不算源候选。
- 同步权威仓 `/Users/nexgen/Documents/xuanxue-web` 当前 `main` HEAD `d1c7752c7b5cf538cde6858e1abf63ee977aa13c`，tracking `origin/main` 为 `348066f6cbed2d619654890928d7c3495e9597af`（behind 4）。其 `.github/instructions/agent-rules/功能法案.md` 已有用户改动；任何双仓权威同步都不得覆盖它，须先区分改动归属并重新绑定候选。Website 的 Browser 细节不是本任务的实施 Owner。
- 入口：Product `turnMarker` → GPT `checkpoint_gpt_text_response` → `readExactAssistantTurn` → Browser `executeExactAssistantTurnRead` → GPT 两门结算 → 原 artifact/Outbox/Website 接纳。原 canonical URL、已确认 effect、Target/Document/loader、marker、真实紧邻 assistant 与 observation revision 是身份骨架；原 submit UUID 仍是 WAL 收据，不改为当前 DOM 定位门禁。
- 当前 Browser 先在 `dom-exact-assistant-turn.ts:186-242` 调用物化循环，再在 `:370-385` 读取回答。`step=0` 只滚到底；`step=1..79` 最多检查 79 次；每次减 `0.8 * clientHeight`。即使途中命中 marker，只有 `atTop` 才传入 UUID；循环/12 秒预算耗尽则传空 UUID，得到 `exact-user-turn-unavailable`。`MATERIALIZE_STEP_FUNCTION:105-106` 在 hidden 文档提前返回。
- 回归来源：已落地的《GPT回答轮次身份漂移阻断-完整实现方案》把原 UUID 改为 marker，并为当时约 5.3 万像素的反向滚动页引入 80 步完整遍历；《顽固故障根治与重命名子能力退役-完整实现方案》曾以 hidden 页面不触发虚拟列表更新为由加入可见性限制。保留原改造的唯一 marker、相邻 assistant、当前 Document 和零重发不变量；本轮废止其“命中后仍须扫到顶”和 hidden 可见性准入。历史方案只说明来历，不代替当前权威。

## 3. 四维冲突与第一断裂

| 项 | 现状与直接断裂 | 目标 |
| --- | --- | --- |
| 法案 | AGENT `LAW-GPT-002-V30` 的 `FROZEN-EXACT-TARGET-POLL-RESULT-REVISION-001` 明文要求文本最多 80 步、覆盖全部可访问 user turns；`FROZEN-GPT-TEXT-RESPONSE-TWO-GATES-001` 明文禁止 visible 第三门。前两项目标与前者冲突，第三项代码与后者冲突。 | 经精确解冻批准后，原位替换文本物化段并重新冻结；保留 URL/marker/相邻 assistant/Document/零 Provider 输入等身份约束。第三项删除是履行现役两门法案。 |
| 施工图 | Browser Blueprint `:35,:61`、GPT Blueprint `:84` 镜像了 80 步/完整遍历；AGENT V6 与 Website 法案 `LAW-AI-ACCEPTANCE-013-V24`、AI Acceptance Blueprint `:152` 只规定精确定位和业务边界，不规定 80 步。 | 同步改 AGENT Browser/GPT 镜像；Website 和 AGENT V6 零修改，因为现役文字与本轮目标兼容。 |
| 实现 | `materializeExactUserTurn` 必须到顶才返回；固定 80 步把这两个现场判为不可取得。`visibilityState` 又能在 DOM 已有正确回答时提前阻断。 | 先在当前 Document 做原子 marker/相邻回答读取；未挂载才进入同一 Browser Owner 的自适应滚动；删除 visibilityState 分支。 |
| 质检 | 定向验收用 53,968 像素反向滚动样例证明旧 80 步足够，并明确断言命中但未到顶返回 unavailable。Browser inspector `dom-mechanical-facts-inspection.ts:274-278` 要求 `if (result.atTop)`。唯一原生质量入口是 `npm run quality:check -- CHANGE/READY/RELEASE`。 | 原位替换旧断言和 inspector 的旧合同 token；以长页、命中即停、hidden、缺失、重复、无进展、deadline 和零 Provider 输入验证目标语义。定向测试不宣称生产 RELEASE。 |

第一直接断裂在 Browser `materializeExactUserTurn`：已有 marker 对应的页面事实被“到顶才返回”覆盖要求拒绝；固定 80 次调用又达不到事故页顶部。其返回的 `null` 被下游解读为 user turn 不可取得，掩盖“扫描未完成”。第三项是独立的可见性提前返回，不把它冒充两个事故的已证触发原因。

## 4. 唯一目标链与分支

Browser 在现役 Target/Document/loader 和 canonical URL 身份约束下，先从当前 Document 查原 marker；若唯一 user 单元已挂载，则不写 `scrollTop`，随即由原精确回答读取函数在最终同包原子观察中核相邻 assistant 并返回回答。当前 DOM 同时命中多个 marker 则沿原 ambiguous 失败关闭；user 已找到但 assistant 尚未挂载时，本轮返回现役 `adjacent-assistant-missing` pending，下一次既有 Provider observation 再读；不能把仅找到 user 伪报为已找到答案。

只有当前 DOM 未挂载原 marker 时，才由原 `materializeExactUserTurn` 在同一次命令内读实时 `scrollHeight/clientHeight/scrollTop/flexDirection`，按当前可见区域推进并在每次样本后先检查 marker。命中即停止滚动并在同一当前 Document 做最终原子读取；到真实顶部仍未命中则 typed unavailable；容器不明、滚动无进展、Document/loader/URL 漂移或命令剩余预算不足，也只返回现役 typed unavailable/invalid，绝不借机发 Provider 输入。删除 `MATERIALIZE_STEP_MAX_COUNT` 及其固定步数验收；保留现役命令 deadline 和安全余量作为时间边界，不新增 timer、队列、第二读取路径或持久状态。滚动距离从当前容器可见高度导出，不写事故像素常量。

命中即停意味着不再扫描尚未挂载的旧轮次；若旧轮次也含相同 marker，现役“全会话恰好一次”保障会被缩窄为**最终原子当前 Document 中唯一**。这是授权人提出的行为取舍，不得在施工中悄悄声称仍证明了全历史唯一。获批权威必须明确这条取舍；验收覆盖同一 DOM 多 marker 失败关闭、当前 marker 与相邻 assistant 正确绑定。原 WAL effect 与 URL 仍约束读取归属，不能以命中 marker 签发重发资格。

不保留旧 80 步完整遍历支路，也不新建“先快速读、失败后旧扫描”的双语义 fallback；未命中时滚动属于同一个精确读取主链。图片的 48 步规则和媒体 reader 不变。Website 原结果接纳与风险授权不变，技术性 unavailable 不能自动重发。

## 5. 原子工单和验收

### W1：冻结权威精确替换（先行）

Owner：AGENT 法案/施工图 Owner。将现役 `LAW-GPT-002-V30` 中与文本完整遍历/80 步相交的规范句升为 V31，更新唯一 registry/Manifest/inspector 引用，Browser/GPT 两处施工图镜像同步；`FROZEN-GPT-TEXT-RESPONSE-TWO-GATES-001` 的 URL/marker/邻接/Document/two-gates 保持，只删除可见性第三门的实现。Website 现役法案与施工图及 AGENT V6 不规定固定步数，均零修改；Website 已有用户改动保持原样。完成门：唯一 active law/registry、所有镜像和质量检查一致；旧文本 80 步、到顶后才允许命中断言零残留。失败停止：脏文件冲突、版本/依赖不一致。

### W2：Browser 原位修复三项扫描行为

Owner：AGENT Browser；目标 `src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts`。沿原 `readExactAssistantTurn`/`executeExactAssistantTurnRead` 主链原位修改；先读当前 marker/相邻 assistant，再必要时动态滚动；删除 `visibilityState` 拦截和固定 80 计数。保留当前 URL、Target/Document/main-frame loader、role/message ID、唯一性和 revision 机械校验。读取候选不依赖 viewport、页面前台或 stop 状态；stop/正文仍由 GPT 原两门处理。文件现为 418 行、低于 500 行预算，施工需复核函数 75 行等原生红线；必要时合并/删除旧分支，不能加包装层掩盖预算。完成门：短页和两个事故高度的长页均能命中即读，`scrollTop` 在初始命中时零写入；未命中时进度/时间边界明确；Provider 输入增量为零。失败停止：Document/URL 不一致、多义或读取结果与原 effect 身份不符。

### W3：唯一质检投影同步

Owner：AGENT Browser 质检；目标 `scripts/acceptance/local-browser-exact-assistant-turn-support.ts`、`scripts/audit/domains/local-browser-session/dom-mechanical-facts-inspection.ts` 及其直接 consumer。删除 53,968 像素代表“80 步必达”的旧断言和命中仍须到顶的旧断言；加入初始命中零滚动、长反向滚动动态命中、hidden 且 DOM 已挂载可读、缺失到顶、滚动无进展、同一 DOM 多 marker、截止时间、URL/Document 漂移的正反例。Inspector 不再要求 `if (result.atTop)` 才允许命中，同时继续禁止可见性等第三门、Prompt rehash 和非原子回答投影。原生 `quality:check CHANGE` 是静态/普通验收；READY/RELEASE 仍按项目原生等级、clean commit 和动态证明执行。真实两个 job 的 URL/WAL/Website 同身份 readback 仅在另获生产操作授权时执行，不以 fixture 代替。

顺序：W1 权威对齐 → 重新绑定 AGENT/Website 相关候选与目标路径 Git 状态 → W2/W3 同一候选施工 → 原生 CHANGE → 若授权进入 READY/RELEASE，再按法案执行完整质量与真实读回。任何旧 effect 未决、页面身份不明、质量失败或候选漂移均停在原链，不清 WAL、不删除任务、不重发 Prompt。回退只作用于未进入生产的新候选；已发生的 Provider effect 和 Website receipt 不能回滚，须原身份读回。

## 6. 授权与交付边界

授权人已在本轮明确允许法案、施工图、代码和质检按既定方案执行，构成对 `FROZEN-EXACT-TARGET-POLL-RESULT-REVISION-001` 文本扫描片区的精确解冻；其余冻结语义仍有效。本方案不修改冻结的法案系统建设说明书，也不改变 Website 业务授权与接纳规则。已先完成 W1 和两遍主 Codex 权威自检，再施工 W2/W3；按用户要求继续两遍代码自检、只读独立审查和原生 CHANGE → READY → RELEASE。附件问题留到下一轮。
