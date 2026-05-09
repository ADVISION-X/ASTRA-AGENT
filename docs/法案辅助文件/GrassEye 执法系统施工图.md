# GrassEye 执法系统施工图

## 统一身份与冻结边界

- 本文件是当前质检系统的建设级落地映射，不新增 lawId，不修改冻结法案。
- CI-FULL 是唯一完整质检入口。
- CI-FULL 只证明：当前真实代码是否符合当前法案文件和当前施工图。
- OWNER 只检查自己负责的真实代码。
- Code Purity 必须常开，覆盖 `src/**` 和 `scripts/**`。
- 除以上链路外，不允许恢复第二完整质检入口。

## 唯一链路

```txt
law files
-> owner manifests
-> blueprints
-> generated registry / matrix / plan
-> CI-FULL audit-build
-> CI-FULL code-purity
-> CI-FULL typecheck
-> CI-FULL foundation / map / ability owner steps
-> ci-full-summary
```

CI-FULL 是尺子，不是机器。它不制造问题，不修改文件，不证明自己聪明，只输出 PASS / FAIL / 问题清单。

## 主矩阵

| 对象 | 当前路径 | 维护方式 |
| --- | --- | --- |
| law 文件 | `.github/instructions/cursor-rules/modules` | 人工维护 |
| owner manifest | `scripts/audit/domains/<domain>/manifest.json` | 人工维护 |
| owner inspector | `scripts/audit/domains/<domain>/inspector.ts` | 人工维护 |
| artifact generator | `scripts/audit/build-audit-artifacts.ts` | 仅由 CI-FULL 第一阶段调用 |
| generated registry / matrix / plan / conflicts | `scripts/audit/generated` | CI-FULL 生成 |
| CI-FULL plan | `scripts/audit/core/ci-full-plan.ts` | 人工维护 |
| CI-FULL summary | `scripts/audit/generated/ci-full-summary.generated.json` | CI-FULL 生成 |

## CI-FULL 应该做

1. build audit artifacts：读取法案、manifest、施工图，生成 registry、matrix、plan。
2. code-purity：检查真实 `src/**` 和 `scripts/**` 的代码纯洁度。
3. typecheck。
4. foundation owner 检查。
5. map owner 检查。
6. ability owner 检查。
7. 输出 summary。

## CI-FULL 禁止做

- 修改文件。
- 制造问题。
- 生成旁路质检结论。
- 发展第二完整质检入口。
- 发展质检系统元治理。
- 用 package script 暴露 owner 质检入口。
- 证明质检系统自身复杂度。

## OWNER 边界

每个 OWNER 只允许：

- 读自己的 lawIds。
- 读自己的 manifest。
- 读自己的施工图。
- 检查自己负责的真实代码。
- 输出 PASS / FAIL / 违规文件与原因。

每个 OWNER 禁止：

- 跑 CI-FULL。
- 跑其它 OWNER。
- 重建 generated artifacts。
- 修改文件。
- 检查 package.json 的 owner 质检脚本。
- 建立第二套质检链。

## audit-system 边界

audit-system 只做最小连接检查：

- law files 是否存在。
- manifest 是否存在。
- generated registry、matrix、plan 是否存在且非空。
- audit plan 是否能把 lawId 连接到 owner inspector。
- code-purity 报告是否由 CI-FULL 的 code-purity 阶段产生。

audit-system 不证明 generated artifacts 自己，不证明 inspector 自己，不恢复第二主链。

## Code Purity 边界

- Code Purity 是 CI-FULL foundation-layer 常开检查。
- 扫描范围必须覆盖 `src/**` 和 `scripts/**`。
- `scripts/audit/**` 也是 active source truth。
- CI 文件、owner runner、audit-system、code-purity 自身复杂时，Code Purity 报错是正确结果。

## READY 标准

- `package.json` 只公开 `ci:full` 作为完整质检入口。
- CI-FULL 一条链完成完整质检。
- OWNER inspector 只能作为 CI-FULL 内部文件被调用。
- audit-system 只做最小连接检查。
- Code Purity 常开，并覆盖 `src/**` 和 `scripts/**`。
- 最终 summary 只回答：当前真实代码是否符合当前法案和当前施工图。
