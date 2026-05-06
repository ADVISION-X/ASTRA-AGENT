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
- 不允许 spawned negative-proof harness 对大量 mutation 逐个重放完整 inspector。
- 不允许每个 mutation 后都重跑完整 rollback PASS；必须优先合组 mutation，并在全部 rollback 后做一次真实 PASS 证明。
- 不允许非 law metadata mutation 重建 generated artifacts；spawned nested inspector 必须支持 `--skip-build`。
- 多 mutation spawned negative proof 必须具备分组机制；高复杂 owner 应进一步传递 targeted phase 到 nested inspector。
- audit-system 必须用 ts-morph AST 检查全仓 `negative-proof-harness.ts` 的 spawn、mutation loop、rollback replay、`--skip-build` 和 grouping topology。

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
- negative-proof-harness
- scorecard-gate

执法必须覆盖：

- map package schema validation
- no code plugin enforcement
- active registry enforcement
- ordinary UI no internal map field enforcement
- negative proof for quarantine, approval, activation, rollback, and validation bypass

## 实战运行日志透明化修复补充

本节只补当前 debug-loop 的执法细节，不新增 lawId，不修改冻结法案。

owner inspector 最低要求：

- Screenshot owner inspector 必须拦截 prepare-ai-input 缺 source handoff。
- Open owner inspector 必须拦截 Workbench Open runtime 未注入 governed OpenLocalProgramPort。
- Commander Console inspector 必须拦截 local-program platform mission preflight 漏检。
- map-plugin-package inspector 必须拦截 step failureBranch / reviewBranch 未闭合。

negative proof 最低要求：

- 必须在真实生产文件中突变，并观测 owner inspector FAIL。
- rollback 后必须观测同一 owner inspector PASS。
- 删除 inspector、删除 negative proof、断开 manifest binding、generated fake PASS 必须被 anti-escape 拦截。

禁止：

- 用普通测试文件替代 negative proof。
- 用 console.log 文本替代 structured runtime proof。
- 用 grep / regex / includes 作为核心执法逻辑。
- 用 debug-loop 脚本形成第二套 runtime。

READY 标准：

- 修复后必须真实执行 `npm run grasseye:start`。
- 启动成功后必须通过 Commander Console / runtime API 的真实用户侧链路触发任务。
- 必须读取最新 runtime log。
- 必须对最新 log 重新完整执行 Phase 1 根因分析。
- 只检查原 blocker 消失不算 READY。
