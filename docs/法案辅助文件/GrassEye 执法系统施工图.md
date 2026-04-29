# GrassEye 执法系统施工图

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 13 个 active ability groups 与 4 个 active support laws，不重新分配主权。
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

## 验收信号

建对表现：

- active owner 全部来自 generated audit plan
- runner summary 真实反映 blocking findings
- 法案和施工图不再写 verify 伪执法

漂移信号：

- generated 文件被手工修改
- current plan 出现 deleted owner
- 文档把 verify 脚本写成主链
