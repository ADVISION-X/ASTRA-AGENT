# GrassEye 执法系统施工图

版本：2026-05-22  
状态：active

## 统一身份与冻结边界

- 本文件是当前质检系统的建设级落地映射，不新增 lawId，不修改冻结法案。
- CI-FULL 是唯一完整质检入口。
- CI-FULL 只证明：当前真实代码是否符合当前法案文件和当前施工图。
- OWNER 只检查自己负责的真实代码。
- Code Purity 必须常开，覆盖 `src/**` 和 `scripts/**`。
- 除以上链路外，不允许恢复第二完整质检入口。

## 唯一链路

```txt
package.json ci:full
-> codex-entry-gate
-> law files
-> owner manifests
-> blueprints
-> generated registry / matrix / plan
-> CI-FULL generated-plan runner
-> owner reports
-> typecheck
-> acceptance smoke
-> ci-full-summary
```

CI-FULL 是尺子，不是机器。它不制造问题，不修改文件，不证明自己聪明，只输出 PASS / FAIL / 问题清单。

二元裁决补充：运行态没有第三种颜色，不存在 warning pass、advisory pass、partial pass。
任一 owner report 只要发出 finding，执行态就是 FAIL。

## 主矩阵

| 对象 | 当前路径 | 维护方式 |
| --- | --- | --- |
| law 文件 | `.github/instructions/agent-rules/modules` | 人工维护 |
| owner manifest | `scripts/audit/domains/<domain>/manifest.json` | 人工维护 |
| owner inspector | `scripts/audit/domains/<domain>/inspector.ts` | 人工维护 |
| artifact generator | `scripts/audit/build-audit-artifacts.ts` | 仅由 CI-FULL 第一阶段调用 |
| generated registry / matrix / plan / conflicts / coverage | `scripts/audit/generated/*.generated.*` | CI-FULL 生成 |
| generated-plan runner | `scripts/audit/core/run-generated-plan.ts` | CI-FULL 调用 |
| CI-FULL summary | `scripts/audit/generated/ci-full-summary.generated.json` | CI-FULL 生成 |

## CI-FULL 应该做

1. codex-entry-gate：先验证 law、audit、blueprint 入口可发现。
2. build audit artifacts：读取法案、manifest、施工图，生成 registry、matrix、plan、coverage。
3. run generated plan：按 executionGroup 调度 foundation、domain、meta inspectors。
4. 为每个 owner inspector 写入独立 report。
5. typecheck。
6. 现役 acceptance smoke。
7. 输出 summary。

## CI-FULL 禁止做

- 手工维护 lawId 列表。
- 手工维护 owner 执行顺序真相。
- 绕过 generated plan 直接调用 owner inspector。
- 制造平行 audit 结论。
- 恢复第二完整质检入口。

## OWNER 边界

每个 OWNER 只允许：

- 读自己的 lawIds。
- 读自己的 manifest。
- 读自己的施工图。
- 检查自己负责的真实代码。
- 输出 PASS / FAIL 与失败原因。

每个 OWNER 禁止：

- 跑 CI-FULL。
- 跑其它 OWNER。
- 重建 generated artifacts。
- 修改文件。
- 建立第二套质检链。

## audit-system 边界

audit-system 只做最小连接检查：

- generated registry、matrix、plan、coverage 是否存在且非空。
- `package.json` 的 `ci:full` 是否先经过 `codex:entry-gate`。
- generated plan 是否唯一连接 capabilityDomain -> owner inspector。
- blueprint anchor 是否存在。
- runner 是否仍硬编码 law truth 或 owner ordering truth。
- code-purity report 是否在 audit-system 前已生成。
- `static-clause-coverage.generated.json` 是否保持 100%。

audit-system 不证明业务 owner 的业务正确性，不恢复第二主链，不代替 code-purity 或能力域 owner。

## Code Purity 边界

- Code Purity 是 CI-FULL foundation-layer 常开检查。
- 扫描范围覆盖 `src/**` 和 `scripts/**`。
- `scripts/audit/**` 必须使用 ts-morph AST / symbol / anti-evasion 检查。
- zombie 检测必须 machine-blocking，至少覆盖 zombie-file、zombie-export、orphan top-level declaration、literal-dead branch。
- 合法豁免只允许来自 `package.json` 脚本入口、generated-plan owner inspector 动态装载、或现役 law 明确授权的外部入口。
- Code Purity 当前运行态只有 PASS / FAIL；不存在 warning inventory 作为第三态。
- 一条 code-purity finding 就是 FAIL；finding 里可以携带整改建议，但不会改变二元裁决。

## READY 标准

- `package.json` 只公开 `ci:full` 作为完整质检入口。
- `package.json` 的 `ci:full` 必须显式先经过 `codex:entry-gate`。
- law -> manifest -> generated artifacts -> runner -> reports -> summary 一条链完成完整质检。
- active capabilityDomain 都有唯一 owner manifest 与 owner inspector。
- audit-system 只做最小连接检查。
- Code Purity 常开，并覆盖 `src/**` 和 `scripts/**`。
- `static-clause-coverage.generated.json` 对 active laws 保持 100%。
- Code Purity 对僵尸代码、僵尸文件、僵尸段落保持零容忍；任一 zombie finding 直接阻断 READY。
- 最终 summary 只回答：当前真实代码是否符合当前法案和当前施工图。