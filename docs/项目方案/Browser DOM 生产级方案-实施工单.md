---
artifact_type: owner_local_implementation_work_order
status: WORK_ORDER_BLOCKED
role: SUBORDINATE_BROWSER_OWNER_WORK_ORDER
master_work_order: /Users/nexgen/Documents/AGENT/docs/项目方案/生产级子能力稳定性建设规则-实施工单.md
source_scheme: /Users/nexgen/Documents/AGENT/docs/项目方案/Browser DOM 生产级方案.md
source_scheme_sha256: ecbe54232fcd880b9d0c145fe784e2b637c06f6f8d9eb39be4532c6cee6bc771
construction_baseline: 1e2db9c9a2ae59bef4f3c0b8aeb659bec1cdbae9
generated_at: 2026-09-02T00:00:00+04:00
browser_evidence_pass: PARTIAL
master_verdict: NOT_OWNED
---

# Browser DOM 生产级方案实施工单

## 0. 工单身份

这不是第二张总工单。它只施工 Browser Owner 内部底座，由同一个施工人执行，并把 Browser 原生证据交回《生产级子能力稳定性建设规则-实施工单.md》。

唯一关系：

    子能力总工单（唯一总集成与最终验收入口）
        ↓ consumes Browser evidence
    本工单（Browser Owner 内部施工）

本工单不得：

- 修改 27 个 GPT Child 的业务语义、Profile 或 Product 顺序；
- 修改 Runtime/Website 业务完成规则；
- 修改 active law、Blueprint 或 law registry；
- 创建第二 Browser Authority、第二 transport、第二 WAL、第二 DOM reader、第二调度器或第二 verdict；
- 处理 `BLK-WIRE-001` 涉及的 Prompt、用户输入、原始 DOM/HTML 或可变本地路径过线问题。

## 1. 开工基线

| 对象 | 绑定值 | 开工规则 |
| --- | --- | --- |
| Repo | `/Users/nexgen/Documents/AGENT` | 只在本仓库施工 |
| Branch | `main` | 不自行切换分支 |
| Git baseline | `1e2db9c9a2ae59bef4f3c0b8aeb659bec1cdbae9` | 用户已有改动不得覆盖；本工单产生的改动不是漂移 |
| Browser law | `LAW-LOCAL-BROWSER-SESSION-004-V16`、V4/V6/V19/V6/V11 | 只读绑定，不修改 |
| GPT law | `LAW-GPT-001-V18` | 只用于校验边界，不由 Browser 实现 GPT 语义 |
| Browser Blueprint | V10 | 不创建第二架构 |
| GPT Blueprint | V10 | 不创建第二 Child 入口 |
| Website/Agent Blueprint | V17 | 不越界取得 Runtime/Website Owner |

开工前必须读取 `git status --short`。出现非本工单、非用户明确授权的重叠改动时停止；不得覆盖、恢复或移动。

## 2. 冲突处置结果

| Conflict ID | 处置 | 工单影响 |
| --- | --- | --- |
| C-01：26/27 分母不一致 | Browser 不维护 Child 名单，只引用总工单 27 | CLOSED |
| C-02：旧 V15/V17/旧 commit | 重绑 V16/V18/当前 baseline | CLOSED |
| C-03：两个总工单 | 本工单降为 Browser 从属工单 | CLOSED |
| C-04：fork 单/双 Child | 服从现役两 Child；Browser 只提供单动作原语 | CLOSED_FOR_BROWSER |
| C-05：第二状态和错误词典 | 删除旧设计，复用现役 outcome/cause/WAL | CLOSED |
| C-06：REJECTED 一律算动作 | 按资格拒绝与动作后失败分开 | CLOSED_IN_DESIGN |
| C-07：layout/semantic/actionability 混合 | 本工单 BD-002 施工 | OPEN_ACTION |
| C-08：两工单重复施工 | Browser 源码仅由本工单修改，总工单只消费证据 | CLOSED |
| C-09：Prompt/raw DOM/file path wire 法案冲突 | `BLK-WIRE-001` 交总工单阻断；本工单不碰 | EXCLUDED_BLOCKER |

## 3. 当前事实与 GAP

| Fact ID | 当前源码事实 | GAP |
| --- | --- | --- |
| BF-001 | `browser-dom-intent.ts` 已有 typed query/mutation 和 observation packet | 可复用，不新增 public capability |
| BF-002 | `dom-query-runtime.ts` 与 `dom-intent-runtime.ts` 各接近 500 行 | 新逻辑必须同 Owner 分片或删除旧逻辑，不能继续膨胀 |
| BF-003 | `visible` 同时排除了 `aria-hidden`、`inert`，把渲染与语义/动作资格混在一起 | BD-002 |
| BF-004 | opacity 只读当前节点，未证明祖先链 effective opacity | BD-002 |
| BF-005 | observation 已使用一条 `Runtime.callFunctionOn`，服务端生成 exact call hash | 需要验证 canonical revision、Document 失效和字段完备性 |
| BF-006 | `inspect` 旧路径仍返回 `outerHtml`/`semanticText` | 不在本工单扩散；依赖 raw DOM 的替换受 `BLK-WIRE-001` 阻断 |
| BF-007 | mutation receipt 强制 `mutationCount===1`，且所有 `REJECTED` 被映射成 confirmed | 无法表达资格拒绝零动作，BD-004 |
| BF-008 | file input 与普通 mutation 仍有重复/内联结算风险，且现役 `resolvedFilePaths` 已经跨过 Browser wire | BD-005 被 `BLK-WIRE-001` 阻断 |
| BF-009 | 当前测试已覆盖部分 terminal、property model、DOM intent | 需要增加本工单字段/四结算/迁移 mutant，不得创建第二测试框架 |

## 4. Browser 内部合同

### 4.1 Observation 输入

只接受 Browser 源码冻结的有界 JSON：scope、selector、cardinality、字段枚举、maxMatches。禁止调用方 JavaScript、predicate tree、评分、fallback 和任意脚本。

### 4.2 Observation 输出

一次同步调用返回：

- exactCallIdentityHash；
- Target/Document 的安全 hash；
- observedAt；
- Browser 计算的 observationRevisionHash；
- 每条 query 的 rawCandidateCount、eligibleCandidateCount、有界 mechanical matches、nativeCause、stage。

机械字段必须分开表达 connected、layout、display、visibility、effective opacity、hidden、ariaHidden、inert、disabled、ariaDisabled、role、name/label 的受控投影、testId、value、checked、type，以及命令需要时的 viewport/hitTest。

### 4.3 Mutation 结算

| 情况 | Browser outcome | mutation_outcome | mutation count |
| --- | --- | --- | --- |
| 合同允许且目标已满足 | CONFIRMED | no | 0 |
| 机械资格不成立 | REJECTED | no | 0 |
| 输入发生且直接读回成立 | CONFIRMED | confirmed | 1 |
| 回复或终局证据不足 | DISPATCHED | dispatched | 0 或 1 未能安全终结 |

输入发生但直接读回失败时，必须保留真实输入事实并终结为 REJECTED；不得改写成零动作资格拒绝。

## 5. 施工动作

<!-- browser-work-order:actions -->
| Action ID | Owner | 目标路径/符号 | 施工内容 | 依赖 | 删除/退役 | 证据 | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BD-001 | local-browser-session | 本工单绑定对象 | 重算方案 hash、HEAD、现役 law/Blueprint marker、工作树重叠范围；确认本工单只是 Browser 从属工单 | NONE | 旧 Browser 总工单身份和第二 verdict | BE-001 | PASS |
| BD-002 | local-browser-session | `src/lib/browser/chrome-extension/dom-query-runtime.ts`、`dom-intent-runtime.ts`、必要的同 Owner 分片 | 分离 connected/layout/render/ARIA/inert/disabled/actionability；祖先链 display/visibility/effective opacity；no-layout 为正常事实；字段按命令稀疏采集 | BD-001 | connected 常量、box=visible、ARIA/inert 混合、重复 reader | BE-002 | PASS |
| BD-003 | local-browser-session | `browser-dom-intent.ts`、query/intent runtime、`browser-command-actor.ts` | 固定单条 callFunctionOn coherent packet；canonical revision 由 Browser 计算；Document 改变/畸形/超限整包失败；两个现役消费者所需字段可表达 | BD-002 | 跨调用拼包、自报 revision、长期 snapshot | BE-003 | IMPLEMENTED_EVIDENCE_PARTIAL |
| BD-004 | local-browser-session | `browser-command-actor.ts`、`browser-target-lease-manager.ts`、mutation store/row/schema、extension target authority | 实现 PREPARED→DISPATCHED→扩展重绑重验→0/1 输入→fresh readback；四种结算正交；非空 WAL 无损演进；DISPATCHED 禁重放 | BD-003 | `mutationCount===1` 强制、terminal 推断 outcome、重放分支 | BE-004 | PASS |
| BD-005 | local-browser-session | extension file-input runtime 与现役 typed intent | file input 只走一条 typed 命令，一次提交完整 grant 集合；局部 scope、唯一 input、accept/multiple/disabled 重验；统一结算 | BD-004 | 内联第二实现、逐文件 dispatch、可变路径过线 | BE-005 | BLOCKED_BY_BLK-WIRE-001 |
| BD-006 | local-browser-session | 现役 local-browser-session inspector/acceptance | 增加字段、coherence、四结算、crash/reply-loss/new-generation、非空 WAL、file-input mutant；不创建第二 verdict | BD-002, BD-003, BD-004, BD-005 | 只跑 happy path、固定次数代替状态覆盖 | BE-002, BE-003, BE-004, BE-005 | PARTIAL |
| BD-007 | local-browser-session | current Chrome、Browser Authority 安全投影 | 只证明 exact Target/current Document、Browser-only observation/mutation/WAL、extension build、operator tab unchanged；不执行被 `BLK-WIRE-001` 阻断的 Prompt/raw DOM/file path 过线动作 | BD-006 | 用 Browser 成功冒充 GPT/Provider/Runtime/Website 完成 | BE-006 | NOT_RUN |
| BD-008 | local-browser-session | 总工单 Browser evidence rows | 将 BE-001..BE-006 的原生引用回填总工单对应 evidence；不签发第二 verdict | BD-007 | Browser 自行宣布全系统 PASS | BE-007 | NOT_RUN |

## 6. 证据动作

<!-- browser-work-order:evidence -->
| Evidence ID | 类型 | 必须证明 | 不证明 | 失败条件 | Result |
| --- | --- | --- | --- | --- | --- |
| BE-001 | STATIC | source hash、HEAD、authority marker、从属关系、无重叠用户改动 | 代码正确 | 任一绑定漂移或第二 Owner | PASS：方案 hash、HEAD、V16/V18、V10/V17 与 clean 起始范围已重绑 |
| BE-002 | FAULT | 每个机械字段独立、祖先样式、no-layout、raw/eligible count；旧伪事实 mutant 全死亡 | GPT 语义 | 字段混合、固定 connected、box=visible、英文全文依赖 | PASS：typecheck、DOM intent support、Browser extension build、完整 local-browser terminal/property/mutant 套件及隔离 Playwright fixture 均通过 |
| BE-003 | FAULT/INTEGRATION | 单次同步 observation、canonical revision、Document 失效整包失败、两个真实消费者字段闭合 | 21 个 Child 全通过 | 第二 CDP read、跨 revision 拼接、caller code/DSL | PARTIAL：Browser 单调用、loader 前后重验、revision/hash、超限和 raw text 拒绝已通过；两个 GPT 消费者闭合尚未施工 |
| BE-004 | PROPERTY/FAULT | 四种 mutation 结算、单动作门、crash/reply loss/new generation 禁重放、非空 WAL 无损 | Provider 接受 | 第二 dispatch、丢 WAL、资格拒绝被算作 confirmed | PASS：零动作与资格拒绝均保留 `mutation_outcome=no`；动作后终局、reply-loss、不重放、非空旧 WAL 前向迁移和 owning-plugin 对账不反推物理动作均通过 |
| BE-005 | FAULT | file input 一条 typed command、唯一 scope/input、完整批准集合、fresh readback | 上传业务最终完成 | 内联旁路、逐文件 dispatch、可变路径泄漏 | BLOCKED：现役命令携带 `resolvedFilePaths`，与 Browser V11 冲突；未新增旁路 |
| BE-006 | REAL_ENVIRONMENT | current Chrome Browser-only exact Target/Document、0/1 输入、WAL terminal、安全投影、operator tab unchanged | GPT/Provider/Runtime/Website 层 | 原始 Prompt/DOM 入证据、未结算动作、操作员页被改变 | NOT_RUN |
| BE-007 | HANDOFF | 总工单逐项消费 Browser 原生 evidence ref，且仍只有一个最终 verdict | 整体生产完成 | 复制第二验收裁决或把 Browser PASS 升格 | NOT_RUN |

## 7. 阻断与停工条件

### 7.1 外部阻断

| Blocker ID | 描述 | 影响范围 | 解除条件 |
| --- | --- | --- | --- |
| BLK-WIRE-001 | GPT V18/Blueprint 要求 Browser 写 exact Prompt、读取 checkpoint DOM并设置获准本地文件；Browser V11 禁止 Prompt、用户输入、DOM/HTML和可变本地路径进入 Browser wire。当前 `approvedText`、`outerHtml`、`resolvedFilePaths` 均命中 | 阻断依赖这些过线内容的总工单动作和本工单 BD-005；其余已完成 Browser 内部施工保留 | 授权人对 active law 作明确、单一、无旁路的权威裁定，随后只重生成受影响工单动作 |

### 7.2 本工单立即停工

- exact baseline 或 active authority 漂移；
- 发现重叠且来源不明的用户改动；
- 施工需要修改 GPT/Product/Runtime/Website 业务 Owner；
- 施工需要第二 transport、第二 WAL、第二 reader、第二状态词典或兼容桥；
- touched production source 超过现役 code-purity 红线且不能通过删除/同 Owner 必要分片解决；
- 动态测试会发送 Prompt、用户输入、原始 DOM/HTML、可变本地路径或改变非一次性真实业务数据。

## 8. 完成门

只有 BD-001..BD-008 和 BE-001..BE-007 全部通过，本工单才可标记 `BROWSER_OWNER_COMPLETE`。该状态只表示 Browser Owner 内部施工完成；它必须回交总工单，不能替代：

- 27/27 Child 语义验收；
- Provider 直接后置；
- Runtime terminal；
- Website durable admission；
- 现役唯一 quality verdict。

在 `BLK-WIRE-001` 未解除时，总工单不得宣称整体完成，即使本 Browser 工单其余项目全部通过。
