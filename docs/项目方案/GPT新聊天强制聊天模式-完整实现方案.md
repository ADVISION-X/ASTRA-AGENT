# GPT 新聊天强制聊天模式－完整实现方案

## 0. 方案身份

- 状态：**可施工**。本文件是本需求的唯一施工方案；施工仍须重新绑定 candidate 并取得单独的代码变更授权，不代表 CHANGE、READY、RELEASE、Provider 提交或 Website 业务完成。
- 需求：每个必须从全新 GPT 根页开始的 Product 调用，只能在 Provider 的“聊天”界面继续；若页面显示“工作”，必须由现役新聊天准备 Child 在发送任何业务输入前一次切换并读回“聊天”已选中。
- 明确非目标：已有 conversation、`provider_continuation`、模型/推理档位、附件、提示词、提交、Browser Target 获取、Website task/attempt/retry/admission，以及新增 Child、队列、状态、持久化或兼容路径。

## 1. scoped candidate 与施工门

设计绑定仓库 `/Users/nexgen/Documents/AGENT`、分支 `main`、HEAD `10bf9ddc777b357b354cd2445f844d75b423a40f`、remote `origin=git@github.com:ADVISION-X/AGENT.git`。

生产施工面当前干净：

- `src/capabilities/gpt/children/prepare_clean_gpt_chat/{selectors,observation,handler}.ts`
- `src/capabilities/gpt/{contract,child-types}.ts`
- `src/capabilities/gpt/acceptance/gpt-exact-target.acceptance.ts`

`.agents/skills/gpt-page-operation-evidence/references/page-operation-matrix.json` 与 `docs/项目方案/GPT页面操作子能力实证资料.json` 已有其它未提交的工具改动；它们不属于本方案施工面，必须原样保留。本方案不把 mode switch 写入该矩阵的 required live transition：现役状态分母只凭 `resultStatus + mutationOutcome + capturePhase` 派生，不能区分本 Child 的“清旧草稿”和“工作→聊天”两个互斥 confirmed 分支。没有真实、可验证的 production trace 分支身份前，强行加入会制造永远无法 complete 的报告要求。

## 2. 现役事实与第一直接断裂

### 2.1 真实页面 DOM

Chrome 扩展会话在 `https://chatgpt.com/` 的新聊天根页读到：

- 唯一 `div[role="radiogroup"][aria-label="选择聊天界面"]`；
- 其中唯一 `button[role="radio"][data-tpp-toggle-value="chatgpt"]`，`aria-checked="true"`；
- 其中唯一 `button[role="radio"][data-tpp-toggle-value="work"]`，`aria-checked="false"`；
- 这组控件不属于已有 `/c/<conversation>` 会话。

该观察是设计用真实 DOM，不是任何 Product 的 production trace，不能写入或替代唯一页面实证报告。

### 2.2 当前实现

`prepare_clean_gpt_chat` 是所有 fresh Product flow 的首个页面 Child。它同一 coherent observation 只读取根 URL、composer、历史 user/assistant turn、附件与 generating；只有其它状态已经 fresh 且 composer 有旧 draft 时才执行一次 `fill("")`。它没有读取或选择“聊天 / 工作”，因此把“工作”当成可继续的 fresh root 放行。这是本需求的第一直接断裂。

`open_gpt_execution_profile`、`open_gpt_model_selector_v2` 与 `select_exact_gpt_model_v2` 只拥有 profile/model 控件，不能承担新聊天模式责任。Product 只决定 Child 顺序；Browser 只机械执行 typed action/WAL/readback。

## 3. 四维裁决与唯一 Owner

| 维度 | 当前依据 | 本次裁决 |
| --- | --- | --- |
| 法案 | `LAW-GPT-001-V56`、`LAW-GPT-002-V20`、`LAW-CAPABILITY-GOVERNANCE-001-V15` | 一个 Child 至多一次物理输入，且不得取得 Product Flow 或业务完成权。 |
| Blueprint | `GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md`、`LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md` | 同一 coherent packet 判定；Browser 的点击必须经唯一 lane/WAL 和直接后置读回。 |
| 实现 | `prepare_clean_gpt_chat` 的 selector/observation/handler、14-Child registry 和 Product 的 `fresh-chat` 调用 | 在原 Child 内补充根页模式判定与一次切换，不新增 Child 或 Product call。 |
| 质检 | `acceptance:gpt` 与唯一 `quality:check` | 以 exact radio 拓扑、零/一次输入和同包 `aria-checked` 读回验收；静态通过不等于 Provider 或 Website 业务完成。 |

原子责任记录：

```text
canonical_owner: gpt / prepare_clean_gpt_chat
authority_inputs: Browser 同一 current Target/Document 的根页 coherent observation
single_decision: 此 fresh root 是否已是聊天模式；必要时只切到聊天一次
typed_output: 现役 success 或 typed failed
consumer: 已有 Product fresh-chat 调用，之后才可继续 profile/attachment/prompt
failure_owner: GPT Child；Browser action failure 仍由 Browser WAL/receipt 产生
readback: 同包唯一 chat radio 的 aria-checked=true，work radio=false
forbidden_adjacent_owners: Product 不点页面；Browser 不决定聊天语义；Runtime/Website 不持有页面模式
```

删除反事实：移除此判定后，`aria-checked="false"` 的“工作”页面会被现役 fresh Child 成功放行，后续 Product 输入可落入用户禁止的模式；故必须保留。新建 `ensure_gpt_chat_mode` 会重复同一 fresh-root 输入、Consumer 与成功判据，故禁止。

## 4. 唯一目标链与状态分母

```text
Browser fresh acquisition
  -> prepare_clean_gpt_chat coherent observation
     -> 聊天已选：现役空聊天/旧草稿分支
     -> 工作已选且其余条件完整：一次点击聊天 + 同包读回
     -> 其它模式拓扑：typed failed，零输入
  -> 既有 Product profile / attachment / prompt / submit 链
```

模式仅在根页是判据；`/c/...` conversation 与 continuation 绝不查询、点击或要求它。

为遵守一次 Child 调用至多一次物理输入，分母严格如下：

1. 聊天已选且 composer 为空：`DONE`，零输入。
2. 聊天已选且仅旧 draft 非空：保留现役一次 `fill("")`，再读回。
3. 工作已选、composer 已空且无 turn/附件/generating：一次点击“聊天”，同一 mutation packet 读回 chat=true/work=false；成功。
4. 工作已选且旧 draft 同时存在：typed failed、零输入。不得在同一调用既点击 radio 又清 composer；由 Website 的现役 attempt/恢复 Owner 决定后续，不建立 GPT 自动重试。
5. root 非法、任一 radio 缺失或多义、checked 非布尔、两项不是互补状态、点击后读回不等：typed failed、零输入或保留该一次已确认 Browser outcome；绝不盲点第二次。

## 5. 原子工单

### M1：在现役 Child 内补齐模式观察

允许路径：

- `src/capabilities/gpt/children/prepare_clean_gpt_chat/selectors.ts`
- `src/capabilities/gpt/children/prepare_clean_gpt_chat/observation.ts`

新增根页 chat-radio、work-radio 的两条冻结 selector；两者以当前 DOM 的互斥 `data-tpp-toggle-value` 精确定位，用已有 `BrowserDomObservationQuery` 的 `ariaChecked` 字段读取，不增加 Browser API、scope、任意 selector 输入或页面快照。观察投影只扩展 `ConversationState` 的局部机械事实。

模式组暂缺、节点 stale、`NO_LAYOUT_BOX` 或无矛盾 partial topology 才可复用既有 stage 1/2 确认；多义、文本/checked 值失配或根 URL 失配直接 HARD_FAIL。

完成门：每次裁决仍来自同一 observation revision；UI 原文不进入日志、任务、Outbox 或持久化。

### M2：扩展 `prepare_clean_gpt_chat` 的唯一动作分支

允许路径：

- `src/capabilities/gpt/children/prepare_clean_gpt_chat/handler.ts`
- `src/capabilities/gpt/contract.ts`
- `src/capabilities/gpt/child-types.ts`（仅当已有结果结构必须表达现役事实；无真实 Consumer 时不新增结果字段）

在现有 stale-draft `fill` 之前裁决模式。仅第 3 类状态允许发出：精确 chat radio、`expectedMatches=1` 的一次 click。postcondition 必须同包读取 chat/work 两行，并要求被点击节点 `aria-checked=true`、两项候选仍各一且 work=false。复用现役 target-local replay/WAL/failure 投影；不得把模式选择升级为 provider-effect-once。

合同只更新 semantic intent、precondition、action qualification 与正/负后置文字；Child ID、输入 schema、Product action ordinal、Browser Target 身份和 provider-effect identity 均保持不变。

### M3：现役验收与工具投影

允许路径：

- `src/capabilities/gpt/acceptance/gpt-exact-target.acceptance.ts`
- `src/capabilities/gpt/acceptance/gpt-exact-target-browser-fixture.ts`

fixture 为 chat-radio、work-radio 提供可控 raw/eligible/`ariaChecked` facts；work-to-chat responder 必须返回现役 `clickedCandidateAttributeReadback` 与同包 `postconditionObservation`。验收必须覆盖：chat-selected zero-action、work-to-chat exactly-one click/readback、radio 缺失或多义、非法 checked、双选/双未选、切换后读回失败、work+draft zero-action failure，以及原有 hydration/dirty-draft 分支不退化。

本工单不修改页面实证矩阵或唯一报告。work-to-chat 的点击/回读由 exact-target fixture 证明；真实页面证据只记录 future `actualTrace` 已实际出现的状态。只有 production source 未来提供不可推断、可验证的 mode-branch identity，才可另行设计矩阵分母的分支表达；不得拿 `mutationOutcome=confirmed`、当前 DOM 或手工点击猜测该身份。

## 6. 验收、停止与动态证明

施工顺序：目标 acceptance → `npm run acceptance:gpt` → `npm run audit:build` → `npm run audit:projection:check` → `npm run quality:check -- CHANGE`。

真实 Browser proof 的前置条件是：`production-source.mjs` 已对同一真实 task/material/attempt 校验出 `sourceKind=PRODUCTION_RUNTIME_DURABLE_TASK`、`synthetic=false`、非空且可验证的 `actualTrace`，并且 Browser 已为该 job 创建 system-owned Target。任一前置不满足（尤其 artifact-only runtime 的 `actualTrace=[]`）即以 `PRODUCT_TRACE_UNAVAILABLE` 停在浏览器之前，只保留工具缺口。条件齐备时才只证明 fresh root 的 chat-selected 零输入和 work-to-chat 一次输入/读回，并在 prompt 写入、附件、submit 前停止。不得接管操作者标签页、创建业务夹具、发送 Provider 内容或把该 proof 说成 Website admission。

任一模式拓扑、Browser receipt、Target/Document、candidate 或 scoped candidate 漂移即停止；已确认一次点击只按现役 WAL/readback 收尾，不重放。Website 业务闭环仍保持原链：Product result → Runtime Outbox → Website staging → Domain admission receipt/readback；本方案不改变它。

## 7. 施工重新绑定要求

进入 M1 前重新读取本文件、根 `AGENTS.md`、适用 law/Blueprint、目标文件 Git 状态、14-Child registry 和全部 fresh Product callers。页面证据工具的 dirty overlay 不得进入候选。若未来要求真实 Browser proof，还须重新确认同一 task/attempt 的 `production-source.mjs` trace gate；任一条件不成立即停止对应施工或证明，不创建平行方案或兼容实现。
