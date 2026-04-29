# GrassEye 代码纯洁度施工图

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 13 个 active ability groups 与 4 个 active support laws，不重新分配主权。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 目标

本施工图定义当前迁移轮次中 code-purity 仅保留的红线检查，防止 fake、mock、compat bridge 和 dead code 继续污染 active source truth。

当前 owner：audit-system purity checker。
当前 inspector：scripts/audit/domains/audit-system/inspector.ts。
当前 CI 验证：npm run audit:build -> npm run audit。

## 当前硬激活范围

当前 runner 只在 `src/**` 范围执行红线扫描：

- `src/**`

## 当前最小执法项

当前 inspector 必须真实检查以下事项：

- silent catch / hidden runtime failure state
- 注释掉的实现代码
- `console.log` scatter
- TODO / FIXME hygiene
- fake/mock/demo/fixture production path leakage
- bridge / compat / legacy 风格兼容桥接文件名

核心 TS / TSX 执法必须使用 AST 或等价结构化分析，不得退化成 regex-only、includes-only、grep-only 扫描器。

## 当前豁免规则

不允许的伪豁免包括：

- active law 存在，但 capabilityDomain 不进 phase gate
- owner manifest 存在，但 generated audit plan 不含 owner
- inspector 只报 pending / gap，不做真实源码检查
- 用“以后再接”作为长期绕过路径

## 激活策略

当前冻结前顺序固定如下：

1. 先保证 `module-code-purity.instructions.md`、audit-system manifest、blueprint、audit-system inspector 同步存在
2. 然后重建 generated audit artifacts
3. 最后由 runner 通过 `audit-system-owner` 执行 purity checker

如果未来有人把这些红线从 audit-system manifest、generated audit plan 或 audit runner 中摘掉，audit-system 必须直接判定为 `FAKE ENFORCEMENT`。

## 后续扩围路线

本轮不再允许用行数、函数长度、复杂度、参数数量之类阈值阻断能力迭代。

当前只保留以下红线：

- dead code / commented-out code
- fake / mock / demo / fixture production path leakage
- console.log debug scatter
- 缺 owner、缺理由、缺 removal condition 的 TODO / FIXME
- compat / bridge / legacy 文件残留