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
- owner-boundary / zombie graph 是否把 import 与 re-export 一并纳入主裁。

audit-system 不证明业务 owner 的业务正确性，不恢复第二主链，不代替 code-purity 或能力域 owner。

## Code Purity 边界

- Code Purity 是 CI-FULL foundation-layer 常开检查。
- 扫描范围覆盖 `src/**` 和 `scripts/**`。
- 数字门是统一红线，不按文件角色区分 target / hard / disaster；任一红线超限即 FAIL。
- 当前数字红线：文件 500 行、函数 75 行、参数 7、return 8、嵌套 5、圈复杂度 16、await 10、import declarations 28、import sources 24、named exports 24、class/object members 30。
- `scripts/audit/**` 必须使用 ts-morph AST / symbol / anti-evasion 检查。
- zombie 检测必须 machine-blocking，至少覆盖 zombie-file、zombie-export、orphan top-level declaration、literal-dead branch。
- 活性必须从 lawful roots reachability 判定，不得把 zombie 文件的入边当作活性证明。
- 合法豁免只允许来自 `package.json` 脚本入口、generated-plan owner inspector 动态装载、或现役 law 明确授权的外部入口。
- 不允许按 `index.ts`、`contract.ts`、`schema.ts`、type-contract 等文件类别整类豁免。
- owner-boundary 检查必须覆盖 import、re-export、dynamic import、side-effect import；barrel laundering 视为同级违法。
- Code Purity 当前运行态只有 PASS / FAIL；不存在 warning inventory 作为第三态。
- 一条 code-purity finding 就是 FAIL；finding 里可以携带整改建议，但不会改变二元裁决。

## Code Purity 僵尸面深度执法链路

1. 收集 governed files。
2. 收集 lawful live entry surfaces。
3. 建立 AST module graph。
4. 建立 symbol usage graph。
5. 区分 type/runtime symbol。
6. 从 entrypoints 做 reachability。
7. 从 reachable graph 做 export live proof。
8. 检测 namespace property-level usage。
9. 检测 re-export barrel laundering。
10. 检测 orphan declarations。
11. 检测 const-folded dead branches。
12. 检测 commented-out executable code。
13. 检测 anti-evasion surfaces。
14. 输出 fail inventory。
15. 接入 ci-full。

补充约束：

- 正则不属于僵尸结构判断工具。
- 若某个活性无法通过 AST / symbol / manifest 证明，则必须 FAIL。
- namespace import 只能证明被访问 property 对应的 export 活；整文件豁免无效。
- re-export 或 barrel forwarding 本身不构成最终消费证明。
- dynamic import、side-effect import、manifest load、generated-plan owner load 只允许走显式 lawful entry manifest 或 owner contract。
- non-literal dynamic import 不是可接受柔性写法；在 governed source 中必须直接 FAIL。
- side-effect import 不得作为隐形 keepalive 或 owner-boundary 逃逸边。
- commented-out old implementation 不是可接受备份；一旦能从 comment trivia 解析出可执行或声明结构，就必须 FAIL。

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

## CI 真绿硬边界链路

1. audit-system 负责 law / manifest / generated artifact / runner 主链完整性。
2. audit-truth 负责 owner inspector 的 AST-first 执法真值与 generated-plan owner coverage 真值。
3. code-purity 负责 active source 的结构真值。
4. runtime-truth 负责 completed evidence contract 真值。
5. ci-full-summary 只汇报已真实执行的步骤与结果，不制造第二真相。

补充要求：

- owner inspector 不使用 `context.project` 视为执法真值缺失。
- generated plan 漏接真实 owner inspector 视为 CI 真绿硬边界失效。
- 旧 summary、旧 report、旧 generated artifact 不得被当作当前 run 的通过证明。
