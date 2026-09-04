---
artifact_type: owner_local_implementation_work_order
status: BROWSER_IMPLEMENTED_REAL_ENVIRONMENT_PENDING
role: SUBORDINATE_BROWSER_OWNER_WORK_ORDER
master_work_order: /Users/nexgen/Documents/AGENT/docs/项目方案/生产级子能力稳定性建设规则-实施工单.md
source_scheme: /Users/nexgen/Documents/AGENT/docs/项目方案/Browser DOM 生产级方案.md
source_scheme_sha256: c5b949ab46f0f0c8600aa45995fef1d1f7c43c58a6c5f7a5e19451590642258d
construction_baseline: 0fa543643dab853a8d773cfd6bbc21dcea8339ed
generated_at: 2026-09-04T00:00:00+04:00
browser_evidence_pass: DETERMINISTIC_EVIDENCE_PASS_REAL_ENVIRONMENT_PENDING
master_verdict: NOT_OWNED
---

# Browser DOM 生产级方案实施工单

## 0. 工单身份

这不是第二张总工单。它只施工 Browser Owner 内部底座，并把 Browser 原生证据交给现役唯一质量链消费。

唯一关系：

    本工单（Browser Owner 内部施工）
        ↓ 只输出 Browser 原生证据
    现役唯一 quality verdict

本工单不得：

- 修改 27 个 GPT Child 的业务语义、Profile 或 Product 顺序；
- 修改 Runtime/Website 业务完成规则；
- 越过用户本次授权修改 active law、Blueprint 或 law registry；法案/施工图必须先行对齐，自检未达 98% 不得进入代码；
- 创建第二 Browser Authority、第二 transport、第二 WAL、第二 DOM reader、第二调度器或第二 verdict；
- 扩大 Browser payload 法案 V14 封闭许可的载荷范围，或让明文进入 Browser 日志、WAL、proof、diagnostic、error。

## 1. 开工基线

| 对象 | 绑定值 | 开工规则 |
| --- | --- | --- |
| Repo | `/Users/nexgen/Documents/AGENT` | 只在本仓库施工 |
| Branch | `main` | 不自行切换分支 |
| Git baseline | `0fa543643dab853a8d773cfd6bbc21dcea8339ed` | 用户已有改动不得覆盖；本工单产生的改动不是漂移 |
| Browser law | `LAW-LOCAL-BROWSER-SESSION-001-V4`、`002-V6`、`003-V20`、`004-V19`、`005-V6`、`006-V14` | 本次按授权对发生规范语义变化的 003/004/006 依法继任升版；不增加第二法案链 |
| GPT law | `LAW-GPT-001-V23` | 只用于校验边界，不由 Browser 实现 GPT 语义 |
| Browser Blueprint | V13 | 唯一现役 Browser 施工图 |
| GPT Blueprint | V15 | 不创建第二 Child 入口 |
| Website/Agent Blueprint | V18 | 只增补 Runtime 作为 task-owned 临时材料 producer 的公开绑定边，不越界取得 Browser/Website Owner |

开工前必须读取 `git status --short`。出现非本工单、非用户明确授权的重叠改动时停止；不得覆盖、恢复或移动。

## 2. 冲突处置结果

| Conflict ID | 处置 | 工单影响 |
| --- | --- | --- |
| C-01：26/27 分母不一致 | Browser 不维护 Child 名单，只引用总工单 27 | CLOSED |
| C-02：旧 law/Blueprint/commit | 重绑 Browser 003 V20 / 004 V19 / 006 V14、GPT V23、Browser Blueprint V13、GPT Blueprint V15、Runtime Blueprint V18 与施工 baseline | CLOSED |
| C-03：两个工单互相越界施工 | 本工单只施工 Browser Owner，子能力由另一任务施工 | CLOSED |
| C-04：fork 单/双 Child | 服从现役两 Child；Browser 只提供单动作原语 | CLOSED_FOR_BROWSER |
| C-05：第二状态和错误词典 | 删除旧设计，复用现役 outcome/cause/WAL | CLOSED |
| C-06：REJECTED 一律算动作 | 按资格拒绝与动作后失败分开 | CLOSED_IN_IMPLEMENTATION |
| C-07：layout/semantic/actionability 混合 | 字段已拆分，并返回固定、不泄密的候选淘汰原因 | CLOSED_IN_IMPLEMENTATION |
| C-08：两工单重复施工 | Browser 源码仅由本工单修改，总工单只消费证据 | CLOSED |
| C-09：Prompt/raw DOM/file path wire 法案冲突 | 现役 Browser payload 法案 V14 已封闭裁定：只走唯一鉴权加密 WebSocket 的 typed request/reply 调用期载荷，不落 Browser 持久面 | CLOSED_BY_ACTIVE_LAW |
| C-10：recovery park 保留原 Document 却释放同 Tab FIFO | normal park 释放；unresolved DISPATCHED 用现有 lane 隔离 Browser 物理动作，不占 Website 业务槽 | CLOSED_IN_IMPLEMENTATION |
| C-11：`REPLY.errorCode` 被折叠成 receipt missing | 明确 error reply 必须 REJECTED；无 reply 才 DISPATCHED | CLOSED_IN_IMPLEMENTATION |
| C-12：Browser artifact 复制并无生产 registration consumer | Runtime task-owned 临时文件 -> Browser execution-scoped 内存绑定；删除 Browser 复制/长期 registry | CLOSED_IN_IMPLEMENTATION |

## 3. 当前事实与 GAP

| Fact ID | 当前源码事实 | GAP |
| --- | --- | --- |
| BF-001 | `browser-dom-intent.ts` 已有 typed query/mutation 和 observation packet | 可复用，不新增 public capability |
| BF-002 | Browser DOM 原有大文件接近 code-purity 红线 | 已按真实消费者分出 coherent candidate、mutation receipt 和 acceptance support；没有第二 Owner/reader |
| BF-003 | connected/layout/display/visibility/opacity/hidden 与 ariaHidden/inert/disabled 已分开 | 已闭合；不再以 box 或 ARIA 代替渲染事实 |
| BF-004 | display、visibility、opacity 已沿祖先链采集 | 已闭合；no-layout 仍是普通机械事实 |
| BF-005 | observation 使用一条 `Runtime.callFunctionOn`，服务端生成 exact call hash | 已补 canonical revision、Document 失效、字段完备性、candidateIndex 唯一/互斥、observationIdentityHash、扩展与接收端双重整包候选预算和完整固定淘汰原因验证 |
| BF-006 | `inspect` 按 Browser payload 法案 V14 通过唯一加密 reply 调用期转交 `outerHtml`/`semanticText` | Browser 不持久化原文，不扩散第二 reader/store |
| BF-007 | mutation 已区分零动作资格拒绝与动作后失败 | 已闭合四种结算；命令先落 DISPATCHED 再发，候选由同步资格器锁定，每次物理输入紧前重验 current Document；候选集失败与唯一候选动作资格失败分别落 exact typed cause |
| BF-008 | file input 使用一条 typed batch command | 已补 approvedFiles 精确集合、SHA-256、签发 maxBytes 整数与防篡改、accept/fresh readback，以及 Agent 端按 command/terminal exact key set 严格解码，额外字段整包拒绝 |
| BF-009 | 现役 terminal/property/DOM intent 测试框架可复用 | 已在原框架补齐字段、加密双向线路、file-input 反例，并通过 deterministic fake DOM 实际执行捕获的同步函数 |
| BF-010 | Target claim、navigate 和 diagnostic 原有静默裁切 | 已删除无消费者的 wire title；diagnostic 只允许固定枚举、受控 ref 和数值计数，越界整帧拒绝 |
| BF-011 | WebSocket 曾把明确 `REPLY.errorCode` 作为普通 Promise rejection，command actor 再误写成 `BROWSER_COMMAND_RECEIPT_MISSING` | 已用 authenticated terminal-reply 类型贯通真实 WebSocket -> actor -> WAL；明确 error 结算 REJECTED，只有无 reply 保持 DISPATCHED |
| BF-012 | 真实 WAL 仍有两条 target_local `DISPATCHED + dispatched`，同 Target 却是不同 Document | 已实现 lane quarantine 与 Browser-authenticated current claim/物理缺失收束；现存 row 在获得真实 Target/Document 权威前保持原样，不重放、不直接改 SQLite |
| BF-013 | 旧 `BrowserArtifactRegistry.registerArtifact` 只有测试调用，生产启动为空 Map，且复制到 Browser 私有目录 | 已物理删除 registry/copy/private directory；Runtime 生产 executor 通过 public facade 建立 execution-scoped 内存绑定，Browser 在 grant 与 dispatch 紧前重验 |
| BF-014 | Browser 诊断曾将 authority ref 直接前缀 `sha256:`，certificateHash 使用 transcript hash | 已分别计算 authorityRef SHA-256 与完整 authority certificate hash；诊断合同形状未改变 |

## 4. Browser 内部合同

### 4.1 Observation 输入

只接受 Browser 源码冻结的有界 JSON：scope、selector、cardinality、字段枚举、maxMatches。禁止调用方 JavaScript、predicate tree、评分、fallback 和任意脚本。

### 4.2 Observation 输出

一次同步调用返回：

- exactCallIdentityHash；
- Target/Document 的安全 hash；
- observedAt；
- Browser 计算的 observationRevisionHash；
- 每条 query 的 rawCandidateCount、eligibleCandidateCount、预算内完整 rejections、带 candidateIndex/observationIdentityHash 的 mechanical matches、nativeCause、stage。

机械字段必须分开表达 connected、layout、display、visibility、effective opacity、hidden、ariaHidden、inert、disabled、ariaDisabled、role、name/label 的受控投影、testId、value、checked、type。viewport/hitTest 不是观察字段，只允许在物理指针动作紧前内部计算。

### 4.3 Mutation 结算

| 情况 | Browser outcome | mutation_outcome | mutation count |
| --- | --- | --- | --- |
| 合同允许且目标已满足 | CONFIRMED | no | 0 |
| 机械资格不成立 | REJECTED | no | 0 |
| 输入发生且直接读回成立 | CONFIRMED | confirmed | 1 |
| 已鉴权 reply 明确返回 errorCode | REJECTED | no 或 dispatched | 保留 typed cause；不得改写为 receipt missing |
| deadline 前无任何终局 reply | DISPATCHED | dispatched | 0 或 1 未能安全终结 |

输入发生但直接读回失败时，必须保留真实输入事实并终结为 REJECTED；不得改写成零动作资格拒绝。

## 5. 施工动作

<!-- browser-work-order:actions -->
| Action ID | Owner | 目标路径/符号 | 施工内容 | 依赖 | 删除/退役 | 证据 | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BD-001 | local-browser-session | 本工单绑定对象 | 重算方案 hash、HEAD、现役 law/Blueprint marker、工作树重叠范围；确认本工单只是 Browser 从属工单 | NONE | 旧 Browser 总工单身份和第二 verdict | BE-001 | PASS |
| BD-002 | local-browser-session | `dom-mechanical-facts.ts`、query/intent runtime、必要同 Owner 分片 | 分离 connected/layout/render/ARIA/inert/disabled/actionability；pointer facts 仅物理指针动作按需采集 | BD-001 | connected 常量、box=visible、ARIA/inert 混合、通用 hit-test | BE-002 | PASS |
| BD-003 | local-browser-session | `browser-dom-intent.ts`、`dom-coherent-observation.ts`、`dom-coherent-candidate.ts` | 单条 callFunctionOn coherent packet/资格器；完整 rejections；candidate index/local hash；正文不截断；Document/畸形/候选超限整包失败 | BD-002 | 跨调用拼包、自报 revision、静默截断、长期 snapshot | BE-003 | PASS |
| BD-004 | local-browser-session | WebSocket、command actor/receipt、mutation store、extension target authority | PREPARED→DISPATCHED-before-send→同步资格→每次输入紧前 Document 重验→fresh readback；明确 error reply 与真实 no-reply 分开；unresolved DISPATCHED 隔离唯一 Browser lane | BD-003 | send-before-WAL、伪成功、typed cause 丢失、重放分支、同 Tab 越过未决现场 | BE-004 | PASS |
| BD-005 | local-browser-session + agent-production-runtime public caller | Browser public artifact binding、extension file-input runtime、mutation receipt | Runtime 把 task-owned 已校验文件绑定当前 execution；Browser 不复制、仅内存重验并签发一条 batch grant；settle/abort 释放 | BD-004 | Browser 私有复制目录、无生产 consumer 的 registry、逐文件 dispatch、路径落持久面 | BE-005 | PASS |
| BD-006 | local-browser-session | 现役 inspector/acceptance | 原有 DOM/WAL 分母加上 explicit error/no reply/disconnect/late reply 矩阵、错 reply token/错 permit sequence 反例、lost-Document 单次 Runtime Log 投影、双任务 lane 隔离、生产 artifact consumer 可达和 settle 清理 | BD-002, BD-003, BD-004, BD-005 | 只跑 happy path、静态 token/符号存在冒充真实调用图 | BE-002, BE-003, BE-004, BE-005 | PASS |
| BD-007 | local-browser-session | 真实登录 current Chrome、Browser Authority 安全投影 | 证明 exact Target/current Document、Browser-only observation/mutation/WAL、extension build、operator tab unchanged | BD-006 | 用 Browser 成功冒充 GPT/Provider/Runtime/Website 完成，或拿空白 Chromium 充数 | BE-006 | NOT_RUN_REAL_ENVIRONMENT |
| BD-008 | local-browser-session | 唯一质量链的 Browser evidence 消费入口 | Browser 证据已按 BE-001..BE-006 分层，可由总工单读取；本任务不修改子能力工单、不签发第二 verdict | BD-006 | Browser 自行宣布全系统 PASS | BE-007 | HANDOFF_READY_NOT_EXECUTED |
| BD-009 | local-browser-session | Browser active law + V13 Blueprint + V4 方案/本工单 | 先行收敛调度、回执、历史 WAL 收束与附件边界；双仓两遍对照后自检不低于 98% | NONE | 矛盾条款、漏挂 law 001、历史 100/100 当当前结论 | BE-008 | PASS_SELF_CHECK_56_OF_56_AFTER_DENOMINATOR_EXPANSION; LAW_BLUEPRINT_REAUDIT_40_OF_40 |
| BD-010 | local-browser-session | diagnostics hash + GPT Browser import | 真实 canonical hash；GPT 只从 Browser public facade 导入 | BD-009 | 伪 hash、私有模块跨 Owner import | BE-009 | PASS |
| BD-011 | local-browser-session | 当前两条 WAL 现场 | 只经新 Browser-authoritative reconciliation 收束 target_local；provider_effect 继续 locator/receipt 对账 | BD-004 | 直接改 SQLite、删 job、重放 | BE-010 | IMPLEMENTED; CURRENT_ROWS_AWAIT_AUTHENTICATED_TARGET_FACT |
| BD-012 | quality single verdict | 现役 `npm run quality:check` | BD-004..BD-011 + 独立只读完成度>=90% | 第二 quality verdict/平行 full suite | BE-011 | AUTHORIZED_BY_INDEPENDENT_AUDIT_100_OF_100 |

## 6. 证据动作

<!-- browser-work-order:evidence -->
| Evidence ID | 类型 | 必须证明 | 不证明 | 失败条件 | Result |
| --- | --- | --- | --- | --- | --- |
| BE-001 | STATIC | source hash、HEAD、authority marker、从属关系、无重叠用户改动 | 代码正确 | 任一绑定漂移或第二 Owner | PASS：方案 hash `c5b949ab...90642258d`；施工 HEAD、Browser 003 V20 / 004 V19 / 006 V14、GPT V23、Browser Blueprint V13、GPT Blueprint V15、Runtime Blueprint V18 已重绑 |
| BE-002 | FAULT | 每个机械字段独立、祖先样式、no-layout、raw/eligible、观察不执行 pointer hit-test | GPT 语义 | 字段混合、固定 connected、box=visible、通用 hit-test | PASS：Browser 定向 TypeScript、DOM/terminal/property/mutant、extension build 与 code-purity 已通过 |
| BE-003 | FAULT/INTEGRATION | 同步 observation/qualification、canonical revision、完整淘汰原因、正文不截断、Document 漂移整次作废 | Child 语义全通过 | 跨 revision 拼接、caller code/DSL、slice 前缀 | PASS：loader 前后重验、双端 256 预算、candidate identity、完整淘汰原因、长正文和实际同步函数行为反例通过 |
| BE-004 | PROPERTY/FAULT | WAL-before-send、四结算、每次输入紧前 Document 守卫、explicit error/no reply 分类、reply token/permit sequence 双重绑定、lane quarantine、crash/late reply/new generation 禁重放 | Provider 接受 | send-before-WAL、第二 dispatch、伪造 terminal、同 Tab 越过 unresolved DISPATCHED | PASS：真实 WebSocket->actor->WAL error/no-reply；错 token/错 permit 均不得终结或二次发送；restart quarantine、跨 job 零 acquisition、current claim/lost Document settlement 及其单次 `BROWSER_MUTATION_REJECTED` 持久投影均通过 |
| BE-005 | FAULT | Runtime 生产 material consumer -> Browser public binding、file input 一条 typed command、grant 数值/防篡改、fresh hash/size/accept、settle/abort 清理 | 上传业务最终完成 | Browser 复制/持久、无生产 consumer、逐文件 dispatch、路径泄漏 | PASS：Runtime executor 真调用；bind/grant/dispatch 前重验、篡改拒绝、settle release、restart empty、不复制均通过 |
| BE-006 | REAL_ENVIRONMENT | 真实登录 current Chrome Browser-only exact Target/Document、0/1 输入、WAL terminal、安全投影、operator tab unchanged | GPT/Provider/Runtime/Website 层 | 空白 Chromium 充数、原始 Prompt/DOM 入证据、未结算动作、操作员页被改变 | NOT_RUN_REAL_ENVIRONMENT |
| BE-007 | HANDOFF | 唯一质量链可逐项消费 Browser 原生 evidence，且仍只有一个最终 verdict | 整体生产完成 | 复制第二验收裁决或把 Browser PASS 升格 | HANDOFF_READY_NOT_EXECUTED |
| BE-008 | STATIC/SELF-CHECK | 双仓 active law/Blueprint 两遍遍历；law 依赖、Blueprint 引用、Owner、调度/回执/附件语义自检 >=98% | 代码正确 | 断裂 ID、重复 Owner、矛盾条款、遗漏 active Browser law | PASS：双仓两遍；法案/施工图 40/40；独立审计推翻原 51 分母后，将 5 组遗漏边界纳入当前代码/边界复核 56/56；最终独立只读核销 100/100，P0/P1/P2=0 |
| BE-009 | STATIC/FAULT | authority/certificate 真实 hash；GPT 只通过 Browser public facade | 真实 Chrome | 伪 hash、GPT 私有 Browser import | PASS：authorityRef 与完整 certificate 各自真实 hash；GPT 私有 import 已物理删除 |
| BE-010 | STATE-MACHINE/STORAGE | 两条历史 target_local DISPATCHED 经 Browser 权威收束，原 row/job/attempt 保留，mutation 增量为零 | Website 入库 | 直改 SQLite、重放、删除任务 | IMPLEMENTATION_PASS；生产库两条原 row 保持 DISPATCHED，等待新进程取得 authenticated current Target/Document 或物理缺失事实后由 Browser 自动终结 |
| BE-011 | UNIQUE QUALITY VERDICT | 独立只读完成度 >=90% 后，现役唯一 `npm run quality:check` 运行一次 | READY/RELEASE/业务完成 | 并行第二 full suite、以历史报告代替 | AUTHORIZED：INDEPENDENT_READ_ONLY_AUDIT_100_OF_100; P0/P1/P2=0 |

历史独立只读复审曾对固定 40 files 快照给出 `100/100`。当前 BF-011..BF-014 已证明该历史结论的分母不完整，因此不再是当前候选证据；本次必须在代码收敛后重新独立只读审查，不得沿用旧分数。

原 51 项代码/边界自检被独立审计证明分母不完整，不再继承。当前 56 项分母额外纳入了 5 组可失败检查：GPT 不得导入 Browser 私有类型；Product 的 task-local path 只能用于自身单次解析且不得传入 GPT/Browser；Runtime 只通过 Browser public facade 消费事实；`REJECTED + dispatched` 必须贯通 Browser→GPT 证据→Runtime 持久化→Website 入站合同；伪造 token/permit 不得终结且 lost-Document 必须有单次 Runtime Log 投影。

## 7. 阻断与停工条件

### 7.1 尚缺的真实环境证据

| Evidence gap | 描述 | 影响范围 | 解除条件 |
| --- | --- | --- | --- |
| REAL-CHROME-001 | 尚未在用户真实登录、已连接 GrassEye 插件的 Chrome 上执行 Browser-only 实证 | 不影响确定性源码建设完成；阻止宣称 Browser 已完成生产现场验收 | 在真实会话上证明 exact Target/current Document、加密 wire、0/1 输入、WAL terminal、安全投影和 operator tab unchanged |

### 7.2 本工单立即停工

- exact baseline 或 active authority 漂移；
- 发现重叠且来源不明的用户改动；
- 施工需要修改 GPT/Product/Runtime/Website 业务 Owner；
- 施工需要第二 transport、第二 WAL、第二 reader、第二状态词典或兼容桥；
- touched production source 超过现役 code-purity 红线且不能通过删除/同 Owner 必要分片解决；
- 动态测试会发送 Prompt、用户输入、原始 DOM/HTML、可变本地路径或改变非一次性真实业务数据。

## 8. 完成门

BD-009/BE-008 只允许放行代码施工。BD-004..BD-006、BD-010..BD-012 和 BE-004/005/008..011 全部闭合后，仍只能标记 `BROWSER_IMPLEMENTED_REAL_ENVIRONMENT_PENDING`。只有 BD-007/BE-006 的真实登录 Chrome 证据通过后，才可标记 `BROWSER_OWNER_COMPLETE`。该状态仍只表示 Browser Owner 内部完成，不能替代：

- 27/27 Child 语义验收；
- Provider 直接后置；
- Runtime terminal；
- Website durable admission；
- 现役唯一 quality verdict。

现役 V13 已在法案/施工图与确定性代码层收敛调度、回执、附件和公开边界；唯一质量裁决与真实 Chrome 未实证前仍不得宣称 Browser 生产现场完成。任何 Browser 通过都不得升格为全系统完成。
