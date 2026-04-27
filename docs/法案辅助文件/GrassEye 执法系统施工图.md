# 《GrassEye 执法系统施工图》

## 基本身份

- 从属权威：
  - .github/instructions/cursor-rules/modules/module-audit-system.instructions.md
  - .github/instructions/cursor-rules/modules/module-code-topology.instructions.md
- 角色：GrassEye 执法系统对象落位与主链映射，不是第二法案
- 原则：疑问以上位法案、manifest、generated artifacts 为准；本图只描述已存在对象
- 版本：1.0

## 范围声明

本施工图只记录：
1. 执法系统对象当前放在哪里
2. 主链对象之间如何衔接
3. 哪些对象人工维护，哪些对象生成器产出
4. 当前 phase gate 如何控制执行窗口

本施工图不重复法案禁令，不单列独立裁决，不替代 inspector 或 runner 实现说明。

## 主矩阵：执法系统对象落位图

| 对象 | 当前路径 | 维护方式 | 备注 |
| --- | --- | --- | --- |
| law 文件 | .github/instructions/cursor-rules/modules/ | 人工维护 | 规则来源 |
| owner manifest | scripts/audit/domains/<domain>/manifest.json | 人工维护 | 能力域归属记录 |
| owner inspector | scripts/audit/domains/<domain>/inspector.ts | 人工维护 | 由 generated audit plan 调度 |
| inspector components | scripts/audit/domains/<domain>/components/ | 人工维护 | 仅作为 owner 内部依赖 |
| artifacts 生成器 | scripts/audit/build-audit-artifacts.ts | 人工维护 | 生成 registry、matrix、plan、conflicts |
| generated artifacts | scripts/audit/generated/ | 自动生成 | 运行真相 |
| phase gate | scripts/audit/phase-gates/ | 人工维护 | 当前阶段执行窗口 |
| audit-system meta inspector | scripts/audit/domains/audit-system/ | 人工维护 | 检查执法系统主链 |
| runner | scripts/audit/runner.ts | 人工维护 | 读取 generated audit plan 并执行 |
| runner summary | scripts/audit/generated/runner-summary.json | 自动生成 | 本次运行结果 |

## 真相链矩阵

| 对象 | 写入方式 | 读取关系 | 说明 |
| --- | --- | --- | --- |
| law | 人工 | artifact generator | 规则源 |
| manifest | 人工 | artifact generator / meta inspector | owner 归属源 |
| generated registry | 自动 | meta inspector / runner context | 法案解析结果 |
| generated matrix | 自动 | meta inspector / runner context | law-owner 绑定结果 |
| generated audit plan | 自动 | runner | 执行输入 |
| generated conflicts | 自动 | meta inspector / review | 冲突快照 |
| runner summary | 自动 | 人工 review / CI | 执行结果 |

## 验收线

| 对象 | 建对表现 | 漂移信号 |
| --- | --- | --- |
| law home | active law 可解析 | law 无 metadata |
| manifest | 每个 capabilityDomain 一个 owner | 多 owner / 无 owner |
| generated artifacts | 全部由 generator 生成 | 人工编辑 generated |
| runner | 消费 generated plan | 内置脚本顺序 |
| inspector | 单 domain owner | 跨域执法 |
| audit-system | 检查主链 | fake PASS |

## 质量门禁权威

- GrassEye 的质量门禁权威只有 scripts/audit 主链。
- repository 内的 tests 目录、*.test.* 文件、npm test、以及 mock-first 验证路径都不属于发布真相。
- 执法系统必须把测试文件存在本身视为违规，而不是把测试通过视为质量成立。