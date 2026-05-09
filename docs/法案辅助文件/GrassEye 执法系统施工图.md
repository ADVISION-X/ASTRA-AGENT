# GrassEye 执法系统施工图

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 14 个 active ability groups、5 个 foundation laws、1 个 support governance domain；若与 Kernel / Index / 法案冻结基线冲突，以 Kernel / Index / 冻结基线为准。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 定位

本图只描述唯一执法链：

law file -> owner manifest -> generated registry / matrix / audit plan -> owner inspector -> audit runner -> runner summary

它不是第二法案，也不是 verify 质检链说明。

## 主矩阵

| 对象 | 当前路径 | 维护方式 |
| --- | --- | --- |
| law 文件 | .github/instructions/cursor-rules/modules | 人工维护 |
| owner manifest | scripts/audit/domains/<domain>/manifest.json | 人工维护 |
| owner inspector | scripts/audit/domains/<domain>/inspector.ts | 人工维护 |
| artifact generator | scripts/audit/build-audit-artifacts.ts | 人工维护 |
| generated registry / matrix / plan / conflicts | scripts/audit/generated | 自动生成 |
| phase gate | scripts/audit/phase-gates | 人工维护 |
| audit runner | scripts/audit/runner.ts | 人工维护 |
| runner summary | scripts/audit/generated/runner-summary.json | 自动生成 |

## 唯一规则

- inspector + generated artifacts + audit runner 是唯一执法链
- generated 文件只能通过命令重建，不能手工改
- 一个 capabilityDomain 只允许一个 owner manifest
- deleted owner 不得进入 current phase gate

## 禁止边界

- 不允许 scripts/verify 作为能力验收
- 不允许 verify-* 命令作为 inspector 替代
- 不允许测试文件、warning、美化 summary 伪装 PASS
- 不允许 spawned real-code-inspection harness 对大量 regression 逐个重放完整 inspector。
- 不允许每个 regression 后都重跑完整 re-inspect PASS；必须优先合组 regression，并在全部 re-inspect 后做一次真实 PASS 证明。
- 不允许非 law metadata regression 重建 generated artifacts；spawned nested inspector 必须支持 `--skip-build`。
- 多 regression spawned real-code-inspection 必须具备分组机制；高复杂 owner 应进一步传递 targeted phase 到 nested inspector。
- audit-system 必须用 ts-morph AST 检查全仓 `owner-inspection-harness.ts` 的 spawn、regression loop、re-inspect replay、`--skip-build` 和 grouping topology。

## 验收信号

建对表现：

- active owner 全部来自 generated audit plan
- runner summary 真实反映 blocking findings
- 法案和施工图不再写 verify 伪执法

漂移信号：

- generated 文件被手工修改
- current plan 出现 deleted owner
- 文档把 verify 脚本写成主链

## map-plugin-package domain

map-plugin-package 是受 audit-system 治理的受控包治理域，不是新的 active ability owner。

该域必须提供：

- required-shape
- forbidden-shape
- boundary-attack
- anti-escape
- owner-inspection-harness
- scorecard-gate

执法必须覆盖：

- map package schema validation
- no code plugin enforcement
- active registry enforcement
- ordinary UI no internal map field enforcement
- real-code-inspection for quarantine, approval, activation, re-inspect, and validation bypass

## 实战运行日志透明化修复补充

本节只补当前 debug-loop 的执法细节，不新增 lawId，不修改冻结法案。

owner inspector 最低要求：

- Screenshot owner inspector 必须拦截 prepare-ai-input 缺 source handoff。
- Open owner inspector 必须拦截 Workbench Open runtime 未注入 governed OpenLocalProgramPort。
- Commander Console inspector 必须拦截 local-program platform mission preflight 漏检。
- map-plugin-package inspector 必须拦截 step failureBranch / reviewBranch 未闭合。

real-code-inspection 最低要求：

- 必须在真实生产文件中突变，并观测 owner inspector FAIL。
- re-inspect 后必须观测同一 owner inspector PASS。
- 删除 inspector、删除 real-code-inspection、断开 manifest binding、generated fake PASS 必须被 anti-escape 拦截。

禁止：

- 用普通测试文件替代 real-code-inspection。
- 用 console.log 文本替代 structured owner evidence。
- 用 grep / regex / includes 作为核心执法逻辑。
- 用 debug-loop 脚本形成第二套 runtime。

READY 标准：

- 修复后必须真实执行 `npm run grasseye:start`。
- 启动成功后必须通过 Commander Console / runtime API 的真实用户侧链路触发任务。
- 必须读取最新 runtime log。
- 必须对最新 log 重新完整执行 Phase 1 根因分析。
- 只检查原 blocker 消失不算 READY。

## CI-FULL 分组与防复发补充

本节只补当前 CI-FULL fail-fast / 超时问题的执行细节，不新增 lawId，不修改冻结法案。

定位：

- CI-FULL 只有一个职责：证明当前代码按冻结法案和 owner inspector 建设。
- CI-FULL 不负责重复生成第二套 coverage 结论，不负责常驻全量生产突变证明。
- 生产突变证明只在修改 inspector、修复 P0/P1 治理漏洞、修改 public contract 或 real-code-inspection harness 时作为局部鉴权证据执行。
- 代码纯洁度是基础层第一门；若 code-purity 不通过，不得进入 map-layer 或 14 个能力组层。

正确链路：

- `ci:full` 必须表达为显式 stage graph。
- 第一层是 foundation-layer，且第一步必须是 `npm run audit:code-purity`。
- foundation-layer 继续执行 `typecheck`、`audit:build`、capability-group-governance、type-safety、security-privacy、audit-system。
- 第二层是 map-layer，只执行 `npm run audit:map-plugin-package`。
- 第三层是 ability-group-layer，执行当前 14 个 active ability group owner inspector。
- debug-loop-boundary 属于 local development governance allowlist，只能保留在 enforcement matrix、phase gate allowlist 和 audit-system 子检查中，不得进入 generated audit plan 或全局 runner-summary 主链。
- `audit` 属于 owner law-compliance 主链，必须在默认模式下跳过全量 production regression real-code-inspection。
- audit-system 内嵌 code-purity 不得作为第二次重复扫描；CI-FULL 已在 foundation-layer 第一门执行 `audit:code-purity`。
- 如需执行生产突变证明，必须显式设置 `GRASSEYE_AUDIT_RUN_NEGATIVE_PROOF=1` 或运行对应 owner 的局部证明命令，并保存证据。
- owner audit 的 timeout budget 只覆盖默认 law-compliance audit；超时属于 CI 拓扑配置缺陷，不得被解释成生产 owner 根因。
- `scripts/audit/generated/runner-summary.json` 只能由完整 `npm run audit` 写入。
- 单 owner inspector 运行结果不得覆盖全局 runner-summary；如需持久化，必须写入 `scripts/audit/generated/domain-summaries/<owner>.json` 或 `tmp/audit/domains/<owner>/`。

禁止链路：

- 禁止 `ci:full` 用纯串行 `spawnSync` 把可并行 gate 全部串起来。
- 禁止 `ci:full` 常驻执行全量 production-regression real-code-inspection。
- 禁止绕过 code-purity 进入 map-layer 或 ability-group-layer。
- 禁止在 `ci:full` 中额外重复执行 `audit:coverage` / `audit:coverage:anti-fraud` 形成第二套证明圈。
- 禁止用提高 timeout 掩盖无限循环；必须同时保留 stage 日志、fail-fast 停点、timeout 停点。
- 禁止把 `ci:full` 做成第二套 audit runner；它只能编排 package scripts。

inspector 应覆盖：

- audit-system inspector 必须用 ts-morph AST 检查 `scripts/audit/ci-full.ts` 是否使用 async `spawn` stage graph。
- 必须检查 stage 顺序为 foundation-layer -> map-layer -> ability-group-layer。
- 必须检查 foundation-layer 第一项是 `audit:code-purity`。
- 必须检查 map-layer 是 `audit:map-plugin-package`。
- 必须检查 ability-group-layer 包含且只包含当前 14 个 active ability group owner inspector。
- 必须检查 `ci:full` 不运行冗余 coverage scripts。
- 必须检查 `scripts/audit/runner.ts` 默认跳过全量 production regression real-code-inspection；code-purity 由 CI-FULL 第一门负责。
- 必须检查 owner audit timeout budget 覆盖默认 law-compliance audit。

real-code-inspection 应覆盖：

- 在真实 `scripts/audit/ci-full.ts` 中临时关闭 independent preflight parallel stage，audit-system inspector 必须 FAIL。
- 在真实 `scripts/audit/ci-full.ts` 中临时把 `audit:code-purity` 从 foundation-layer 第一项移走，audit-system inspector 必须 FAIL。
- 在真实 `scripts/audit/runner.ts` 中临时移除默认 real-code-inspection skip policy，audit-system inspector 必须 FAIL。
- re-inspect 后 audit-system inspector 必须 PASS。
- 删除 CI topology inspector、断开 governance chain、移除 real-code-inspection regression 必须被 audit-system anti-escape / wiring 检出。

结构化日志必备字段：

- stage label。
- step label。
- parallel / serial mode。
- timeoutMs。
- fail-fast stopped step。
- exit code / signal。

READY 标准：

- `npm run ci:full` 不得在 commander-console-capability 误判停住。
- `ci:full` 若停在某 owner，只能以该 owner inspector 的结构化 finding 作为根因，不得把 CI timeout 当业务根因。
- 修复后必须运行 audit-system inspector，并完成真实生产突变 FAIL 与 re-inspect PASS 证明。
- `npm run ci:full` 默认运行时间必须服务于日常迭代，不得因历史全量 regression proof 常驻而长期不可等待。
