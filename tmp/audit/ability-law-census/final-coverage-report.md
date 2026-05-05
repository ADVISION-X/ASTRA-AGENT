# Final Coverage Report

## commander-console

### 法条清单

| lawId | 主题 | active | tier | enforcementMode | status |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V2 | 人类命令入口主权唯一 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2 | HumanCommandEnvelope 机器门禁 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V2 | 控制台只读真相边界 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V2 | 总司令边界纯洁度 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-005-V2 | 唯一 canonical root 与真实子能力 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V2 | 控制台 proof 与结果完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-007-V2 | 地图包导入与任务模板 UX 边界 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-008-V2 | Commander 执法唯一入口 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |

### 执法覆盖

| lawId | inspector | check type | negative proof | mutation proof | coverageStatus |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V2 | scripts/audit/domains/commander-console-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/commander-console-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/commander-console/GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2 | scripts/audit/domains/commander-console-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/commander-console-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/commander-console/GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V2 | scripts/audit/domains/commander-console-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/commander-console-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/commander-console/GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V2 | scripts/audit/domains/commander-console-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/commander-console-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/commander-console/GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-005-V2 | scripts/audit/domains/commander-console-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/commander-console-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/commander-console/GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-005-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V2 | scripts/audit/domains/commander-console-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/commander-console-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/commander-console/GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-007-V2 | scripts/audit/domains/commander-console-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/commander-console-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/commander-console/GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-007-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-008-V2 | scripts/audit/domains/commander-console-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/commander-console-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/commander-console/GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-008-V2/ | PARTIALLY_ENFORCED |

### 缺口

- GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/commander-console-capability/inspector.ts, scripts/audit/domains/commander-console-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/commander-console/GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/commander-console-capability/inspector.ts, scripts/audit/domains/commander-console-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/commander-console/GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/commander-console-capability/inspector.ts, scripts/audit/domains/commander-console-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/commander-console/GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/commander-console-capability/inspector.ts, scripts/audit/domains/commander-console-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/commander-console/GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-005-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/commander-console-capability/inspector.ts, scripts/audit/domains/commander-console-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/commander-console/GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-005-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/commander-console-capability/inspector.ts, scripts/audit/domains/commander-console-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/commander-console/GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-007-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/commander-console-capability/inspector.ts, scripts/audit/domains/commander-console-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/commander-console/GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-007-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-008-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/commander-console-capability/inspector.ts, scripts/audit/domains/commander-console-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/commander-console/GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-008-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO

### 本组运行结果

- audit command: npm run audit:commander-console
- result: PASS
- duration: 3442ms
- findings: see tmp/audit/ability-law-census/audit-runs/audit-commander-console.txt

## orchestration

### 法条清单

| lawId | 主题 | active | tier | enforcementMode | status |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-ORCHESTRATION-CAPABILITY-001-V3 | 总调度主权唯一 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-ORCHESTRATION-CAPABILITY-002-V3 | 作战地图是受控声明式数据包 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-ORCHESTRATION-CAPABILITY-003-V3 | 冻结激活快照与禁止 latest lookup | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-ORCHESTRATION-CAPABILITY-004-V3 | Nerve Bus 调度出口唯一 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3 | 地图驱动步骤执行与转移闭环 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-ORCHESTRATION-CAPABILITY-006-V3 | Prompt 选择服从冻结地图 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-ORCHESTRATION-CAPABILITY-007-V3 | Forensics 只记账，不替总调度裁决 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-ORCHESTRATION-CAPABILITY-008-V3 | 总调度结果与运行证明完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-ORCHESTRATION-CAPABILITY-009-V3 | 子能力只做 mission lifecycle 与 transition | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-ORCHESTRATION-CAPABILITY-010-V3 | Orchestration 执法唯一入口 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |

### 执法覆盖

| lawId | inspector | check type | negative proof | mutation proof | coverageStatus |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-ORCHESTRATION-CAPABILITY-001-V3 | scripts/audit/domains/orchestration-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/orchestration-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-001-V3/ | PARTIALLY_ENFORCED |
| GRASSEYE-ORCHESTRATION-CAPABILITY-002-V3 | scripts/audit/domains/orchestration-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/orchestration-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-002-V3/ | PARTIALLY_ENFORCED |
| GRASSEYE-ORCHESTRATION-CAPABILITY-003-V3 | scripts/audit/domains/orchestration-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/orchestration-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-003-V3/ | PARTIALLY_ENFORCED |
| GRASSEYE-ORCHESTRATION-CAPABILITY-004-V3 | scripts/audit/domains/orchestration-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/orchestration-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-004-V3/ | PARTIALLY_ENFORCED |
| GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3 | scripts/audit/domains/orchestration-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/orchestration-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3/ | PARTIALLY_ENFORCED |
| GRASSEYE-ORCHESTRATION-CAPABILITY-006-V3 | scripts/audit/domains/orchestration-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/orchestration-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-006-V3/ | PARTIALLY_ENFORCED |
| GRASSEYE-ORCHESTRATION-CAPABILITY-007-V3 | scripts/audit/domains/orchestration-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/orchestration-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-007-V3/ | PARTIALLY_ENFORCED |
| GRASSEYE-ORCHESTRATION-CAPABILITY-008-V3 | scripts/audit/domains/orchestration-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/orchestration-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-008-V3/ | PARTIALLY_ENFORCED |
| GRASSEYE-ORCHESTRATION-CAPABILITY-009-V3 | scripts/audit/domains/orchestration-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/orchestration-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-009-V3/ | PARTIALLY_ENFORCED |
| GRASSEYE-ORCHESTRATION-CAPABILITY-010-V3 | scripts/audit/domains/orchestration-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/orchestration-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-010-V3/ | PARTIALLY_ENFORCED |

### 缺口

- GRASSEYE-ORCHESTRATION-CAPABILITY-001-V3: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/orchestration-capability/inspector.ts, scripts/audit/domains/orchestration-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-001-V3/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-ORCHESTRATION-CAPABILITY-002-V3: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/orchestration-capability/inspector.ts, scripts/audit/domains/orchestration-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-002-V3/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-ORCHESTRATION-CAPABILITY-003-V3: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/orchestration-capability/inspector.ts, scripts/audit/domains/orchestration-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-003-V3/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-ORCHESTRATION-CAPABILITY-004-V3: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/orchestration-capability/inspector.ts, scripts/audit/domains/orchestration-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-004-V3/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/orchestration-capability/inspector.ts, scripts/audit/domains/orchestration-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-ORCHESTRATION-CAPABILITY-006-V3: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/orchestration-capability/inspector.ts, scripts/audit/domains/orchestration-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-006-V3/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-ORCHESTRATION-CAPABILITY-007-V3: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/orchestration-capability/inspector.ts, scripts/audit/domains/orchestration-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-007-V3/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-ORCHESTRATION-CAPABILITY-008-V3: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/orchestration-capability/inspector.ts, scripts/audit/domains/orchestration-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-008-V3/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-ORCHESTRATION-CAPABILITY-009-V3: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/orchestration-capability/inspector.ts, scripts/audit/domains/orchestration-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-009-V3/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-ORCHESTRATION-CAPABILITY-010-V3: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/orchestration-capability/inspector.ts, scripts/audit/domains/orchestration-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/orchestration/GRASSEYE-ORCHESTRATION-CAPABILITY-010-V3/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO

### 本组运行结果

- audit command: npm run audit:orchestration
- result: PASS
- duration: 28715ms
- findings: see tmp/audit/ability-law-census/audit-runs/audit-orchestration.txt

## nerve-bus

### 法条清单

| lawId | 主题 | active | tier | enforcementMode | status |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-NERVE-BUS-CAPABILITY-001-V2 | 传输主权唯一 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-NERVE-BUS-CAPABILITY-002-V2 | Envelope 链路字段完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-NERVE-BUS-CAPABILITY-003-V2 | 六条传输通道与通道纯洁度 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-NERVE-BUS-CAPABILITY-004-V2 | 传输不做决策 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-NERVE-BUS-CAPABILITY-005-V2 | 固定传输流水线 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-NERVE-BUS-CAPABILITY-006-V2 | 传输结果语义 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-NERVE-BUS-CAPABILITY-007-V2 | Transfer Proof 完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-NERVE-BUS-CAPABILITY-008-V2 | AI 传输只传 Prompt Contract 引用 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-NERVE-BUS-CAPABILITY-009-V2 | 子能力窄通道绑定 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-NERVE-BUS-CAPABILITY-010-V2 | Nerve Bus 执法唯一入口 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |

### 执法覆盖

| lawId | inspector | check type | negative proof | mutation proof | coverageStatus |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-NERVE-BUS-CAPABILITY-001-V2 | scripts/audit/domains/nerve-bus-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-001-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-NERVE-BUS-CAPABILITY-002-V2 | scripts/audit/domains/nerve-bus-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-002-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-NERVE-BUS-CAPABILITY-003-V2 | scripts/audit/domains/nerve-bus-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-003-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-NERVE-BUS-CAPABILITY-004-V2 | scripts/audit/domains/nerve-bus-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-004-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-NERVE-BUS-CAPABILITY-005-V2 | scripts/audit/domains/nerve-bus-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-005-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-NERVE-BUS-CAPABILITY-006-V2 | scripts/audit/domains/nerve-bus-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-006-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-NERVE-BUS-CAPABILITY-007-V2 | scripts/audit/domains/nerve-bus-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-007-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-NERVE-BUS-CAPABILITY-008-V2 | scripts/audit/domains/nerve-bus-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-008-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-NERVE-BUS-CAPABILITY-009-V2 | scripts/audit/domains/nerve-bus-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-009-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-NERVE-BUS-CAPABILITY-010-V2 | scripts/audit/domains/nerve-bus-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-010-V2/ | PARTIALLY_ENFORCED |

### 缺口

- GRASSEYE-NERVE-BUS-CAPABILITY-001-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/nerve-bus-capability/inspector.ts, scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-001-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-NERVE-BUS-CAPABILITY-002-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/nerve-bus-capability/inspector.ts, scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-002-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-NERVE-BUS-CAPABILITY-003-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/nerve-bus-capability/inspector.ts, scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-003-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-NERVE-BUS-CAPABILITY-004-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/nerve-bus-capability/inspector.ts, scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-004-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-NERVE-BUS-CAPABILITY-005-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/nerve-bus-capability/inspector.ts, scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-005-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-NERVE-BUS-CAPABILITY-006-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/nerve-bus-capability/inspector.ts, scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-006-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-NERVE-BUS-CAPABILITY-007-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/nerve-bus-capability/inspector.ts, scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-007-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-NERVE-BUS-CAPABILITY-008-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/nerve-bus-capability/inspector.ts, scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-008-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-NERVE-BUS-CAPABILITY-009-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/nerve-bus-capability/inspector.ts, scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-009-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-NERVE-BUS-CAPABILITY-010-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/nerve-bus-capability/inspector.ts, scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/nerve-bus/GRASSEYE-NERVE-BUS-CAPABILITY-010-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO

### 本组运行结果

- audit command: npm run audit:nerve-bus
- result: PASS
- duration: 72693ms
- findings: see tmp/audit/ability-law-census/audit-runs/audit-nerve-bus.txt

## ai

### 法条清单

| lawId | 主题 | active | tier | enforcementMode | status |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-AI-CAPABILITY-001-V1 | AI 大脑主权 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-002-V1 | AI 子能力按提供者与运行通道治理 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-003-V1 | AI 只思考不动手 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-004-V1 | local-ai-runtime 是内部执行边界，不是第二套 AI 主权 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-005-V1 | 付费与未来 API 子能力默认关闭且失败封闭 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-005B-V2 | AI 输出进入 Forensics 前必须清洗 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-006-V1 | AI 公开合同与私有实现硬隔离 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-007-V1 | AI 执法入口唯一 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-008-V1 | Prompt Contract 主权与唯一真相 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-009-V1 | Prompt Contract 完整合同 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-010-V1 | Prompt 只能提问，不能指挥动作 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-011-V1 | Prompt 执行按合同路由，运行链必须 typed failure | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-012-V1 | AI 超时、取消、并发与熔断必须治理 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-013-V1 | AI 结果与证明必须完整可复盘 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-014-V1 | AI 输出边界禁止动作权 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |

### 执法覆盖

| lawId | inspector | check type | negative proof | mutation proof | coverageStatus |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-AI-CAPABILITY-001-V1 | scripts/audit/domains/ai-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/ai-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-001-V1/ | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-002-V1 | scripts/audit/domains/ai-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/ai-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-002-V1/ | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-003-V1 | scripts/audit/domains/ai-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/ai-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-003-V1/ | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-004-V1 | scripts/audit/domains/ai-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/ai-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-004-V1/ | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-005-V1 | scripts/audit/domains/ai-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/ai-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-005-V1/ | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-005B-V2 | scripts/audit/domains/ai-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/ai-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-005B-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-006-V1 | scripts/audit/domains/ai-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/ai-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-006-V1/ | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-007-V1 | scripts/audit/domains/ai-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/ai-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-007-V1/ | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-008-V1 | scripts/audit/domains/ai-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/ai-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-008-V1/ | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-009-V1 | scripts/audit/domains/ai-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/ai-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-009-V1/ | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-010-V1 | scripts/audit/domains/ai-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/ai-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-010-V1/ | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-011-V1 | scripts/audit/domains/ai-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/ai-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-011-V1/ | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-012-V1 | scripts/audit/domains/ai-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/ai-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-012-V1/ | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-013-V1 | scripts/audit/domains/ai-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/ai-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-013-V1/ | PARTIALLY_ENFORCED |
| GRASSEYE-AI-CAPABILITY-014-V1 | scripts/audit/domains/ai-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/ai-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-014-V1/ | PARTIALLY_ENFORCED |

### 缺口

- GRASSEYE-AI-CAPABILITY-001-V1: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/ai-capability/inspector.ts, scripts/audit/domains/ai-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-001-V1/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-AI-CAPABILITY-002-V1: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/ai-capability/inspector.ts, scripts/audit/domains/ai-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-002-V1/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-AI-CAPABILITY-003-V1: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/ai-capability/inspector.ts, scripts/audit/domains/ai-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-003-V1/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-AI-CAPABILITY-004-V1: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/ai-capability/inspector.ts, scripts/audit/domains/ai-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-004-V1/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-AI-CAPABILITY-005-V1: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/ai-capability/inspector.ts, scripts/audit/domains/ai-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-005-V1/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-AI-CAPABILITY-005B-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/ai-capability/inspector.ts, scripts/audit/domains/ai-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-005B-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-AI-CAPABILITY-006-V1: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/ai-capability/inspector.ts, scripts/audit/domains/ai-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-006-V1/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-AI-CAPABILITY-007-V1: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/ai-capability/inspector.ts, scripts/audit/domains/ai-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-007-V1/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-AI-CAPABILITY-008-V1: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/ai-capability/inspector.ts, scripts/audit/domains/ai-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-008-V1/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-AI-CAPABILITY-009-V1: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/ai-capability/inspector.ts, scripts/audit/domains/ai-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-009-V1/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-AI-CAPABILITY-010-V1: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/ai-capability/inspector.ts, scripts/audit/domains/ai-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-010-V1/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-AI-CAPABILITY-011-V1: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/ai-capability/inspector.ts, scripts/audit/domains/ai-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-011-V1/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-AI-CAPABILITY-012-V1: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/ai-capability/inspector.ts, scripts/audit/domains/ai-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-012-V1/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-AI-CAPABILITY-013-V1: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/ai-capability/inspector.ts, scripts/audit/domains/ai-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-013-V1/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-AI-CAPABILITY-014-V1: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/ai-capability/inspector.ts, scripts/audit/domains/ai-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-014-V1/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO

### 本组运行结果

- audit command: npm run audit:ai
- result: FAIL
- duration: 6248ms
- findings: see tmp/audit/ability-law-census/audit-runs/audit-ai.txt

## open

### 法条清单

| lawId | 主题 | active | tier | enforcementMode | status |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-OPEN-CAPABILITY-001-V2 | 唯一打开主权 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-OPEN-CAPABILITY-002-V2 | 纯打开边界 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-OPEN-CAPABILITY-003-V2 | Open 输入链路完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-OPEN-CAPABILITY-004-V2 | Open 单链执行管线 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-OPEN-CAPABILITY-005-V2 | Page State handoff 必须存在但不得越权 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-OPEN-CAPABILITY-006-V2 | Open 结果与运行证明完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-OPEN-CAPABILITY-007-V2 | 子能力窄职责与统一运行链 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-OPEN-CAPABILITY-008-V2 | Open 执法唯一入口 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |

### 执法覆盖

| lawId | inspector | check type | negative proof | mutation proof | coverageStatus |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-OPEN-CAPABILITY-001-V2 | scripts/audit/domains/open-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/open-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-001-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-OPEN-CAPABILITY-002-V2 | scripts/audit/domains/open-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/open-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-002-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-OPEN-CAPABILITY-003-V2 | scripts/audit/domains/open-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/open-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-003-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-OPEN-CAPABILITY-004-V2 | scripts/audit/domains/open-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/open-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-004-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-OPEN-CAPABILITY-005-V2 | scripts/audit/domains/open-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/open-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-005-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-OPEN-CAPABILITY-006-V2 | scripts/audit/domains/open-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/open-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-006-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-OPEN-CAPABILITY-007-V2 | scripts/audit/domains/open-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/open-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-007-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-OPEN-CAPABILITY-008-V2 | scripts/audit/domains/open-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/open-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-008-V2/ | PARTIALLY_ENFORCED |

### 缺口

- GRASSEYE-OPEN-CAPABILITY-001-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/open-capability/inspector.ts, scripts/audit/domains/open-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-001-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-OPEN-CAPABILITY-002-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/open-capability/inspector.ts, scripts/audit/domains/open-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-002-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-OPEN-CAPABILITY-003-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/open-capability/inspector.ts, scripts/audit/domains/open-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-003-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-OPEN-CAPABILITY-004-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/open-capability/inspector.ts, scripts/audit/domains/open-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-004-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-OPEN-CAPABILITY-005-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/open-capability/inspector.ts, scripts/audit/domains/open-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-005-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-OPEN-CAPABILITY-006-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/open-capability/inspector.ts, scripts/audit/domains/open-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-006-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-OPEN-CAPABILITY-007-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/open-capability/inspector.ts, scripts/audit/domains/open-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-007-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-OPEN-CAPABILITY-008-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/open-capability/inspector.ts, scripts/audit/domains/open-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-008-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO

### 本组运行结果

- audit command: npm run audit:open
- result: PASS
- duration: 4601ms
- findings: see tmp/audit/ability-law-census/audit-runs/audit-open.txt

## screenshot

### 法条清单

| lawId | 主题 | active | tier | enforcementMode | status |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-SCREENSHOT-CAPABILITY-001-V2 | 截图主权唯一 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-SCREENSHOT-CAPABILITY-002-V2 | 纯截图边界 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-SCREENSHOT-CAPABILITY-003-V2 | 截图输入链路完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-SCREENSHOT-CAPABILITY-004-V2 | coordinateSpace 与 scaleMapping 硬门禁 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-SCREENSHOT-CAPABILITY-005-V2 | 截图单链执行管线 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-SCREENSHOT-CAPABILITY-006-V2 | 截图结果与运行证明完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-SCREENSHOT-CAPABILITY-007-V2 | 子能力窄职责与统一运行链 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-SCREENSHOT-CAPABILITY-008-V2 | Screenshot 执法唯一入口 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-SCREENSHOT-CAPABILITY-ARTIFACT-LIFECYCLE-V1 | Artifact Lifecycle / Screenshot Retention 治理 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |

### 执法覆盖

| lawId | inspector | check type | negative proof | mutation proof | coverageStatus |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-SCREENSHOT-CAPABILITY-001-V2 | scripts/audit/domains/screenshot-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/screenshot-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-001-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-SCREENSHOT-CAPABILITY-002-V2 | scripts/audit/domains/screenshot-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/screenshot-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-002-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-SCREENSHOT-CAPABILITY-003-V2 | scripts/audit/domains/screenshot-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/screenshot-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-003-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-SCREENSHOT-CAPABILITY-004-V2 | scripts/audit/domains/screenshot-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/screenshot-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-004-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-SCREENSHOT-CAPABILITY-005-V2 | scripts/audit/domains/screenshot-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/screenshot-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-005-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-SCREENSHOT-CAPABILITY-006-V2 | scripts/audit/domains/screenshot-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/screenshot-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-006-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-SCREENSHOT-CAPABILITY-007-V2 | scripts/audit/domains/screenshot-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/screenshot-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-007-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-SCREENSHOT-CAPABILITY-008-V2 | scripts/audit/domains/screenshot-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/screenshot-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-008-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-SCREENSHOT-CAPABILITY-ARTIFACT-LIFECYCLE-V1 | scripts/audit/domains/screenshot-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/screenshot-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-ARTIFACT-LIFECYCLE-V1/ | PARTIALLY_ENFORCED |

### 缺口

- GRASSEYE-SCREENSHOT-CAPABILITY-001-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/screenshot-capability/inspector.ts, scripts/audit/domains/screenshot-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-001-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-SCREENSHOT-CAPABILITY-002-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/screenshot-capability/inspector.ts, scripts/audit/domains/screenshot-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-002-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-SCREENSHOT-CAPABILITY-003-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/screenshot-capability/inspector.ts, scripts/audit/domains/screenshot-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-003-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-SCREENSHOT-CAPABILITY-004-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/screenshot-capability/inspector.ts, scripts/audit/domains/screenshot-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-004-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-SCREENSHOT-CAPABILITY-005-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/screenshot-capability/inspector.ts, scripts/audit/domains/screenshot-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-005-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-SCREENSHOT-CAPABILITY-006-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/screenshot-capability/inspector.ts, scripts/audit/domains/screenshot-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-006-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-SCREENSHOT-CAPABILITY-007-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/screenshot-capability/inspector.ts, scripts/audit/domains/screenshot-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-007-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-SCREENSHOT-CAPABILITY-008-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/screenshot-capability/inspector.ts, scripts/audit/domains/screenshot-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-008-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-SCREENSHOT-CAPABILITY-ARTIFACT-LIFECYCLE-V1: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/screenshot-capability/inspector.ts, scripts/audit/domains/screenshot-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-ARTIFACT-LIFECYCLE-V1/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO

### 本组运行结果

- audit command: npm run audit:screenshot
- result: PASS
- duration: 80828ms
- findings: see tmp/audit/ability-law-census/audit-runs/audit-screenshot.txt

## visual-target

### 法条清单

| lawId | 主题 | active | tier | enforcementMode | status |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V2 | 视觉目标主权唯一 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V2 | 纯视觉定位边界 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V2 | 输入链路与受治理候选完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V2 | 坐标空间与非可执行 handoff | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-VISUAL-TARGET-CAPABILITY-005-V2 | 单链门禁与模糊失败 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-VISUAL-TARGET-CAPABILITY-006-V2 | 结果与运行证明完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-VISUAL-TARGET-CAPABILITY-007-V2 | 子能力窄职责与统一运行链 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-VISUAL-TARGET-CAPABILITY-008-V2 | Visual Target 执法唯一入口 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |

### 执法覆盖

| lawId | inspector | check type | negative proof | mutation proof | coverageStatus |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V2 | scripts/audit/domains/visual-target-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/visual-target-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/visual-target/GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V2 | scripts/audit/domains/visual-target-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/visual-target-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/visual-target/GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V2 | scripts/audit/domains/visual-target-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/visual-target-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/visual-target/GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V2 | scripts/audit/domains/visual-target-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/visual-target-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/visual-target/GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-VISUAL-TARGET-CAPABILITY-005-V2 | scripts/audit/domains/visual-target-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/visual-target-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/visual-target/GRASSEYE-VISUAL-TARGET-CAPABILITY-005-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-VISUAL-TARGET-CAPABILITY-006-V2 | scripts/audit/domains/visual-target-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/visual-target-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/visual-target/GRASSEYE-VISUAL-TARGET-CAPABILITY-006-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-VISUAL-TARGET-CAPABILITY-007-V2 | scripts/audit/domains/visual-target-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/visual-target-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/visual-target/GRASSEYE-VISUAL-TARGET-CAPABILITY-007-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-VISUAL-TARGET-CAPABILITY-008-V2 | scripts/audit/domains/visual-target-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/visual-target-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/visual-target/GRASSEYE-VISUAL-TARGET-CAPABILITY-008-V2/ | PARTIALLY_ENFORCED |

### 缺口

- GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/visual-target-capability/inspector.ts, scripts/audit/domains/visual-target-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/visual-target/GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/visual-target-capability/inspector.ts, scripts/audit/domains/visual-target-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/visual-target/GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/visual-target-capability/inspector.ts, scripts/audit/domains/visual-target-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/visual-target/GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/visual-target-capability/inspector.ts, scripts/audit/domains/visual-target-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/visual-target/GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-VISUAL-TARGET-CAPABILITY-005-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/visual-target-capability/inspector.ts, scripts/audit/domains/visual-target-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/visual-target/GRASSEYE-VISUAL-TARGET-CAPABILITY-005-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-VISUAL-TARGET-CAPABILITY-006-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/visual-target-capability/inspector.ts, scripts/audit/domains/visual-target-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/visual-target/GRASSEYE-VISUAL-TARGET-CAPABILITY-006-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-VISUAL-TARGET-CAPABILITY-007-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/visual-target-capability/inspector.ts, scripts/audit/domains/visual-target-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/visual-target/GRASSEYE-VISUAL-TARGET-CAPABILITY-007-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-VISUAL-TARGET-CAPABILITY-008-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/visual-target-capability/inspector.ts, scripts/audit/domains/visual-target-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/visual-target/GRASSEYE-VISUAL-TARGET-CAPABILITY-008-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO

### 本组运行结果

- audit command: npm run audit:visual-target
- result: FAIL
- duration: 5254ms
- findings: see tmp/audit/ability-law-census/audit-runs/audit-visual-target.txt

## geometry-guard

### 法条清单

| lawId | 主题 | active | tier | enforcementMode | status |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V3 | 几何安全门禁唯一主权 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-GEOMETRY-GUARD-CAPABILITY-002-V3 | 合同纯度与旧类型隔离 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-GEOMETRY-GUARD-CAPABILITY-003-V3 | 输入链路与证据完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-GEOMETRY-GUARD-CAPABILITY-004-V3 | 坐标空间、映射、边界与点击安全执法 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V3 | 单链管线与无副作用 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-GEOMETRY-GUARD-CAPABILITY-006-V3 | 结果与运行证明完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-GEOMETRY-GUARD-CAPABILITY-007-V3 | 下游执行边界 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-GEOMETRY-GUARD-CAPABILITY-008-V3 | Geometry Guard 执法唯一入口 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |

### 执法覆盖

| lawId | inspector | check type | negative proof | mutation proof | coverageStatus |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V3 | scripts/audit/domains/geometry-guard-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/geometry-guard-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V3/ | PARTIALLY_ENFORCED |
| GRASSEYE-GEOMETRY-GUARD-CAPABILITY-002-V3 | scripts/audit/domains/geometry-guard-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/geometry-guard-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-002-V3/ | PARTIALLY_ENFORCED |
| GRASSEYE-GEOMETRY-GUARD-CAPABILITY-003-V3 | scripts/audit/domains/geometry-guard-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/geometry-guard-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-003-V3/ | PARTIALLY_ENFORCED |
| GRASSEYE-GEOMETRY-GUARD-CAPABILITY-004-V3 | scripts/audit/domains/geometry-guard-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/geometry-guard-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-004-V3/ | PARTIALLY_ENFORCED |
| GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V3 | scripts/audit/domains/geometry-guard-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/geometry-guard-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V3/ | PARTIALLY_ENFORCED |
| GRASSEYE-GEOMETRY-GUARD-CAPABILITY-006-V3 | scripts/audit/domains/geometry-guard-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/geometry-guard-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-006-V3/ | PARTIALLY_ENFORCED |
| GRASSEYE-GEOMETRY-GUARD-CAPABILITY-007-V3 | scripts/audit/domains/geometry-guard-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/geometry-guard-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-007-V3/ | PARTIALLY_ENFORCED |
| GRASSEYE-GEOMETRY-GUARD-CAPABILITY-008-V3 | scripts/audit/domains/geometry-guard-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/geometry-guard-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-008-V3/ | PARTIALLY_ENFORCED |

### 缺口

- GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V3: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/geometry-guard-capability/inspector.ts, scripts/audit/domains/geometry-guard-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V3/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-GEOMETRY-GUARD-CAPABILITY-002-V3: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/geometry-guard-capability/inspector.ts, scripts/audit/domains/geometry-guard-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-002-V3/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-GEOMETRY-GUARD-CAPABILITY-003-V3: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/geometry-guard-capability/inspector.ts, scripts/audit/domains/geometry-guard-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-003-V3/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-GEOMETRY-GUARD-CAPABILITY-004-V3: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/geometry-guard-capability/inspector.ts, scripts/audit/domains/geometry-guard-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-004-V3/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V3: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/geometry-guard-capability/inspector.ts, scripts/audit/domains/geometry-guard-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V3/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-GEOMETRY-GUARD-CAPABILITY-006-V3: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/geometry-guard-capability/inspector.ts, scripts/audit/domains/geometry-guard-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-006-V3/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-GEOMETRY-GUARD-CAPABILITY-007-V3: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/geometry-guard-capability/inspector.ts, scripts/audit/domains/geometry-guard-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-007-V3/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-GEOMETRY-GUARD-CAPABILITY-008-V3: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/geometry-guard-capability/inspector.ts, scripts/audit/domains/geometry-guard-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-008-V3/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO

### 本组运行结果

- audit command: npm run audit:geometry-guard
- result: FAIL
- duration: 4133ms
- findings: see tmp/audit/ability-law-census/audit-runs/audit-geometry-guard.txt

## mouse-click

### 法条清单

| lawId | 主题 | active | tier | enforcementMode | status |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V2 | 点击执行主权唯一 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V2 | 纯点击边界 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V2 | 点击输入链路与 Geometry Guard 授权完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V2 | 单链门禁与单次 primitive click | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V2 | 点击结果语义与 PAV handoff | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-CLICK-CAPABILITY-006-V2 | 点击结果与运行证明完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-CLICK-CAPABILITY-007-V2 | 子能力窄职责与统一运行链 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-CLICK-CAPABILITY-008-V2 | Mouse Click 执法唯一入口 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |

### 执法覆盖

| lawId | inspector | check type | negative proof | mutation proof | coverageStatus |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V2 | scripts/audit/domains/mouse-click-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/mouse-click-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V2 | scripts/audit/domains/mouse-click-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/mouse-click-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V2 | scripts/audit/domains/mouse-click-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/mouse-click-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V2 | scripts/audit/domains/mouse-click-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/mouse-click-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V2 | scripts/audit/domains/mouse-click-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/mouse-click-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-CLICK-CAPABILITY-006-V2 | scripts/audit/domains/mouse-click-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/mouse-click-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-006-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-CLICK-CAPABILITY-007-V2 | scripts/audit/domains/mouse-click-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/mouse-click-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-007-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-CLICK-CAPABILITY-008-V2 | scripts/audit/domains/mouse-click-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/mouse-click-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-008-V2/ | PARTIALLY_ENFORCED |

### 缺口

- GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/mouse-click-capability/inspector.ts, scripts/audit/domains/mouse-click-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/mouse-click-capability/inspector.ts, scripts/audit/domains/mouse-click-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/mouse-click-capability/inspector.ts, scripts/audit/domains/mouse-click-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/mouse-click-capability/inspector.ts, scripts/audit/domains/mouse-click-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/mouse-click-capability/inspector.ts, scripts/audit/domains/mouse-click-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-MOUSE-CLICK-CAPABILITY-006-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/mouse-click-capability/inspector.ts, scripts/audit/domains/mouse-click-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-006-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-MOUSE-CLICK-CAPABILITY-007-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/mouse-click-capability/inspector.ts, scripts/audit/domains/mouse-click-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-007-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-MOUSE-CLICK-CAPABILITY-008-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/mouse-click-capability/inspector.ts, scripts/audit/domains/mouse-click-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-008-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO

### 本组运行结果

- audit command: npm run audit:mouse-click
- result: PASS
- duration: 78352ms
- findings: see tmp/audit/ability-law-census/audit-runs/audit-mouse-click.txt

## text-input

### 法条清单

| lawId | 主题 | active | tier | enforcementMode | status |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-TEXT-INPUT-CAPABILITY-001-V2 | 写字主权唯一 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-TEXT-INPUT-CAPABILITY-002-V2 | 纯写字边界 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-TEXT-INPUT-CAPABILITY-003-V2 | 输入链路与受批准文本合同 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-TEXT-INPUT-CAPABILITY-004-V2 | 端口边界与执行流水线 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-TEXT-INPUT-CAPABILITY-005-V2 | 敏感文本与剪贴板生命周期 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-TEXT-INPUT-CAPABILITY-006-V2 | 结果真相分离与 PAV handoff | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-TEXT-INPUT-CAPABILITY-007-V2 | Runtime Proof 全链路完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-TEXT-INPUT-CAPABILITY-008-V2 | 六个子能力窄绑定 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-TEXT-INPUT-CAPABILITY-009-V2 | Text Input 执法唯一入口 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |

### 执法覆盖

| lawId | inspector | check type | negative proof | mutation proof | coverageStatus |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-TEXT-INPUT-CAPABILITY-001-V2 | scripts/audit/domains/text-input-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/text-input-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-001-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-TEXT-INPUT-CAPABILITY-002-V2 | scripts/audit/domains/text-input-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/text-input-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-002-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-TEXT-INPUT-CAPABILITY-003-V2 | scripts/audit/domains/text-input-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/text-input-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-003-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-TEXT-INPUT-CAPABILITY-004-V2 | scripts/audit/domains/text-input-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/text-input-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-004-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-TEXT-INPUT-CAPABILITY-005-V2 | scripts/audit/domains/text-input-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/text-input-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-005-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-TEXT-INPUT-CAPABILITY-006-V2 | scripts/audit/domains/text-input-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/text-input-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-006-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-TEXT-INPUT-CAPABILITY-007-V2 | scripts/audit/domains/text-input-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/text-input-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-007-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-TEXT-INPUT-CAPABILITY-008-V2 | scripts/audit/domains/text-input-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/text-input-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-008-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-TEXT-INPUT-CAPABILITY-009-V2 | scripts/audit/domains/text-input-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/text-input-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-009-V2/ | PARTIALLY_ENFORCED |

### 缺口

- GRASSEYE-TEXT-INPUT-CAPABILITY-001-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/text-input-capability/inspector.ts, scripts/audit/domains/text-input-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-001-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-TEXT-INPUT-CAPABILITY-002-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/text-input-capability/inspector.ts, scripts/audit/domains/text-input-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-002-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-TEXT-INPUT-CAPABILITY-003-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/text-input-capability/inspector.ts, scripts/audit/domains/text-input-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-003-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-TEXT-INPUT-CAPABILITY-004-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/text-input-capability/inspector.ts, scripts/audit/domains/text-input-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-004-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-TEXT-INPUT-CAPABILITY-005-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/text-input-capability/inspector.ts, scripts/audit/domains/text-input-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-005-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-TEXT-INPUT-CAPABILITY-006-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/text-input-capability/inspector.ts, scripts/audit/domains/text-input-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-006-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-TEXT-INPUT-CAPABILITY-007-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/text-input-capability/inspector.ts, scripts/audit/domains/text-input-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-007-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-TEXT-INPUT-CAPABILITY-008-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/text-input-capability/inspector.ts, scripts/audit/domains/text-input-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-008-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-TEXT-INPUT-CAPABILITY-009-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/text-input-capability/inspector.ts, scripts/audit/domains/text-input-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-009-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO

### 本组运行结果

- audit command: npm run audit:text-input-capability
- result: PASS
- duration: 92693ms
- findings: see tmp/audit/ability-law-census/audit-runs/audit-text-input-capability.txt

## mouse-scroll

### 法条清单

| lawId | 主题 | active | tier | enforcementMode | status |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V2 | 滚动执行主权唯一 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V2 | 纯滚动边界 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V2 | 滚动输入链路与 Geometry Guard 授权完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V2 | 滚动幅度是输入参数，不是子能力 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-SCROLL-CAPABILITY-005-V2 | 单链门禁与 primitive scroll | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-SCROLL-CAPABILITY-006-V2 | 滚动结果语义与 PAV handoff | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-SCROLL-CAPABILITY-007-V2 | 滚动结果与运行证明完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-SCROLL-CAPABILITY-008-V2 | 子能力窄职责与统一运行链 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-SCROLL-CAPABILITY-009-V2 | Mouse Scroll 执法唯一入口 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |

### 执法覆盖

| lawId | inspector | check type | negative proof | mutation proof | coverageStatus |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V2 | scripts/audit/domains/mouse-scroll-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V2 | scripts/audit/domains/mouse-scroll-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V2 | scripts/audit/domains/mouse-scroll-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V2 | scripts/audit/domains/mouse-scroll-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-SCROLL-CAPABILITY-005-V2 | scripts/audit/domains/mouse-scroll-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-005-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-SCROLL-CAPABILITY-006-V2 | scripts/audit/domains/mouse-scroll-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-006-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-SCROLL-CAPABILITY-007-V2 | scripts/audit/domains/mouse-scroll-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-007-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-SCROLL-CAPABILITY-008-V2 | scripts/audit/domains/mouse-scroll-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-008-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-MOUSE-SCROLL-CAPABILITY-009-V2 | scripts/audit/domains/mouse-scroll-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-009-V2/ | PARTIALLY_ENFORCED |

### 缺口

- GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/mouse-scroll-capability/inspector.ts, scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/mouse-scroll-capability/inspector.ts, scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/mouse-scroll-capability/inspector.ts, scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/mouse-scroll-capability/inspector.ts, scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-MOUSE-SCROLL-CAPABILITY-005-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/mouse-scroll-capability/inspector.ts, scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-005-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-MOUSE-SCROLL-CAPABILITY-006-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/mouse-scroll-capability/inspector.ts, scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-006-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-MOUSE-SCROLL-CAPABILITY-007-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/mouse-scroll-capability/inspector.ts, scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-007-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-MOUSE-SCROLL-CAPABILITY-008-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/mouse-scroll-capability/inspector.ts, scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-008-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-MOUSE-SCROLL-CAPABILITY-009-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/mouse-scroll-capability/inspector.ts, scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-009-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO

### 本组运行结果

- audit command: npm run audit:mouse-scroll
- result: PASS
- duration: 188301ms
- findings: see tmp/audit/ability-law-census/audit-runs/audit-mouse-scroll.txt

## post-action-verification

### 法条清单

| lawId | 主题 | active | tier | enforcementMode | status |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V2 | 动作结果验证主权唯一 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-002-V2 | 纯验证边界 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V2 | 验证输入链路完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V2 | before/after 与观察证据门禁 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-005-V2 | 验证决策唯一类型 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-006-V2 | 验证运行证明链路完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-007-V2 | 子能力窄职责与统一执行链 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-008-V2 | PAV 执法唯一入口 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |

### 执法覆盖

| lawId | inspector | check type | negative proof | mutation proof | coverageStatus |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V2 | scripts/audit/domains/post-action-verification-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-002-V2 | scripts/audit/domains/post-action-verification-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-002-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V2 | scripts/audit/domains/post-action-verification-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V2 | scripts/audit/domains/post-action-verification-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-005-V2 | scripts/audit/domains/post-action-verification-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-005-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-006-V2 | scripts/audit/domains/post-action-verification-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-006-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-007-V2 | scripts/audit/domains/post-action-verification-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-007-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-008-V2 | scripts/audit/domains/post-action-verification-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-008-V2/ | PARTIALLY_ENFORCED |

### 缺口

- GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/post-action-verification-capability/inspector.ts, scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-002-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/post-action-verification-capability/inspector.ts, scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-002-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/post-action-verification-capability/inspector.ts, scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/post-action-verification-capability/inspector.ts, scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-005-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/post-action-verification-capability/inspector.ts, scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-005-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-006-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/post-action-verification-capability/inspector.ts, scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-006-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-007-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/post-action-verification-capability/inspector.ts, scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-007-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-008-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/post-action-verification-capability/inspector.ts, scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-008-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO

### 本组运行结果

- audit command: npm run audit:post-action-verification
- result: PASS
- duration: 18803ms
- findings: see tmp/audit/ability-law-census/audit-runs/audit-post-action-verification.txt

## forensics-persistence

### 法条清单

| lawId | 主题 | active | tier | enforcementMode | status |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-FORENSICS-PERSISTENCE-001-V2 | 取证记账主权唯一 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-FORENSICS-PERSISTENCE-002-V2 | 子能力按写账行为治理 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-FORENSICS-PERSISTENCE-003-V2 | 只写账，不判断，不动作 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-FORENSICS-PERSISTENCE-004-V2 | Forensics public contract 原生化 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-FORENSICS-PERSISTENCE-005-V2 | 链路证据完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-FORENSICS-PERSISTENCE-006-V2 | 通用 record-store port | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-FORENSICS-PERSISTENCE-007-V2 | 写账门禁与幂等 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-FORENSICS-PERSISTENCE-008-V2 | Forensics 执法唯一入口 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-FORENSICS-PERSISTENCE-ARTIFACT-PROMOTION-V1 | Artifact Promotion / Final Retention Sovereignty | true | P0 | machine-blocking | PARTIALLY_ENFORCED |

### 执法覆盖

| lawId | inspector | check type | negative proof | mutation proof | coverageStatus |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-FORENSICS-PERSISTENCE-001-V2 | scripts/audit/domains/forensics-persistence-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/forensics-persistence/GRASSEYE-FORENSICS-PERSISTENCE-001-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-FORENSICS-PERSISTENCE-002-V2 | scripts/audit/domains/forensics-persistence-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/forensics-persistence/GRASSEYE-FORENSICS-PERSISTENCE-002-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-FORENSICS-PERSISTENCE-003-V2 | scripts/audit/domains/forensics-persistence-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/forensics-persistence/GRASSEYE-FORENSICS-PERSISTENCE-003-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-FORENSICS-PERSISTENCE-004-V2 | scripts/audit/domains/forensics-persistence-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/forensics-persistence/GRASSEYE-FORENSICS-PERSISTENCE-004-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-FORENSICS-PERSISTENCE-005-V2 | scripts/audit/domains/forensics-persistence-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/forensics-persistence/GRASSEYE-FORENSICS-PERSISTENCE-005-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-FORENSICS-PERSISTENCE-006-V2 | scripts/audit/domains/forensics-persistence-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/forensics-persistence/GRASSEYE-FORENSICS-PERSISTENCE-006-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-FORENSICS-PERSISTENCE-007-V2 | scripts/audit/domains/forensics-persistence-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/forensics-persistence/GRASSEYE-FORENSICS-PERSISTENCE-007-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-FORENSICS-PERSISTENCE-008-V2 | scripts/audit/domains/forensics-persistence-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/forensics-persistence/GRASSEYE-FORENSICS-PERSISTENCE-008-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-FORENSICS-PERSISTENCE-ARTIFACT-PROMOTION-V1 | scripts/audit/domains/forensics-persistence-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/forensics-persistence/GRASSEYE-FORENSICS-PERSISTENCE-ARTIFACT-PROMOTION-V1/ | PARTIALLY_ENFORCED |

### 缺口

- GRASSEYE-FORENSICS-PERSISTENCE-001-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/forensics-persistence-capability/inspector.ts, scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/forensics-persistence/GRASSEYE-FORENSICS-PERSISTENCE-001-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-FORENSICS-PERSISTENCE-002-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/forensics-persistence-capability/inspector.ts, scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/forensics-persistence/GRASSEYE-FORENSICS-PERSISTENCE-002-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-FORENSICS-PERSISTENCE-003-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/forensics-persistence-capability/inspector.ts, scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/forensics-persistence/GRASSEYE-FORENSICS-PERSISTENCE-003-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-FORENSICS-PERSISTENCE-004-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/forensics-persistence-capability/inspector.ts, scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/forensics-persistence/GRASSEYE-FORENSICS-PERSISTENCE-004-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-FORENSICS-PERSISTENCE-005-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/forensics-persistence-capability/inspector.ts, scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/forensics-persistence/GRASSEYE-FORENSICS-PERSISTENCE-005-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-FORENSICS-PERSISTENCE-006-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/forensics-persistence-capability/inspector.ts, scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/forensics-persistence/GRASSEYE-FORENSICS-PERSISTENCE-006-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-FORENSICS-PERSISTENCE-007-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/forensics-persistence-capability/inspector.ts, scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/forensics-persistence/GRASSEYE-FORENSICS-PERSISTENCE-007-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-FORENSICS-PERSISTENCE-008-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/forensics-persistence-capability/inspector.ts, scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/forensics-persistence/GRASSEYE-FORENSICS-PERSISTENCE-008-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-FORENSICS-PERSISTENCE-ARTIFACT-PROMOTION-V1: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/forensics-persistence-capability/inspector.ts, scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/forensics-persistence/GRASSEYE-FORENSICS-PERSISTENCE-ARTIFACT-PROMOTION-V1/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO

### 本组运行结果

- audit command: npm run audit:forensics-persistence
- result: FAIL
- duration: 4223ms
- findings: see tmp/audit/ability-law-census/audit-runs/audit-forensics-persistence.txt

## page-state

### 法条清单

| lawId | 主题 | active | tier | enforcementMode | status |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-PAGE-STATE-CAPABILITY-001-V2 | 当前页面状态主权唯一 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-PAGE-STATE-CAPABILITY-002-V2 | 页面状态边界纯洁 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-PAGE-STATE-CAPABILITY-003-V2 | 输入链路与观察证据完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-PAGE-STATE-CAPABILITY-004-V2 | 观察来源与证据绑定门禁 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-PAGE-STATE-CAPABILITY-005-V2 | 输出证据支撑与非动作验证 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-PAGE-STATE-CAPABILITY-006-V2 | 页面状态运行证明完整性 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-PAGE-STATE-CAPABILITY-007-V2 | 子能力窄职责与统一执行链 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |
| GRASSEYE-PAGE-STATE-CAPABILITY-008-V2 | Page State 执法唯一入口 | true | P0 | machine-blocking | PARTIALLY_ENFORCED |

### 执法覆盖

| lawId | inspector | check type | negative proof | mutation proof | coverageStatus |
| --- | --- | --- | --- | --- | --- |
| GRASSEYE-PAGE-STATE-CAPABILITY-001-V2 | scripts/audit/domains/page-state-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/page-state-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/page-state/GRASSEYE-PAGE-STATE-CAPABILITY-001-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-PAGE-STATE-CAPABILITY-002-V2 | scripts/audit/domains/page-state-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/page-state-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/page-state/GRASSEYE-PAGE-STATE-CAPABILITY-002-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-PAGE-STATE-CAPABILITY-003-V2 | scripts/audit/domains/page-state-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/page-state-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/page-state/GRASSEYE-PAGE-STATE-CAPABILITY-003-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-PAGE-STATE-CAPABILITY-004-V2 | scripts/audit/domains/page-state-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/page-state-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/page-state/GRASSEYE-PAGE-STATE-CAPABILITY-004-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-PAGE-STATE-CAPABILITY-005-V2 | scripts/audit/domains/page-state-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/page-state-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/page-state/GRASSEYE-PAGE-STATE-CAPABILITY-005-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-PAGE-STATE-CAPABILITY-006-V2 | scripts/audit/domains/page-state-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/page-state-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/page-state/GRASSEYE-PAGE-STATE-CAPABILITY-006-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-PAGE-STATE-CAPABILITY-007-V2 | scripts/audit/domains/page-state-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/page-state-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/page-state/GRASSEYE-PAGE-STATE-CAPABILITY-007-V2/ | PARTIALLY_ENFORCED |
| GRASSEYE-PAGE-STATE-CAPABILITY-008-V2 | scripts/audit/domains/page-state-capability/inspector.ts | Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof | scripts/audit/domains/page-state-capability/negative-proof-harness.ts | tmp/audit/ability-law-census/regression-proofs/page-state/GRASSEYE-PAGE-STATE-CAPABILITY-008-V2/ | PARTIALLY_ENFORCED |

### 缺口

- GRASSEYE-PAGE-STATE-CAPABILITY-001-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/page-state-capability/inspector.ts, scripts/audit/domains/page-state-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/page-state/GRASSEYE-PAGE-STATE-CAPABILITY-001-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-PAGE-STATE-CAPABILITY-002-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/page-state-capability/inspector.ts, scripts/audit/domains/page-state-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/page-state/GRASSEYE-PAGE-STATE-CAPABILITY-002-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-PAGE-STATE-CAPABILITY-003-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/page-state-capability/inspector.ts, scripts/audit/domains/page-state-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/page-state/GRASSEYE-PAGE-STATE-CAPABILITY-003-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-PAGE-STATE-CAPABILITY-004-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/page-state-capability/inspector.ts, scripts/audit/domains/page-state-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/page-state/GRASSEYE-PAGE-STATE-CAPABILITY-004-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-PAGE-STATE-CAPABILITY-005-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/page-state-capability/inspector.ts, scripts/audit/domains/page-state-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/page-state/GRASSEYE-PAGE-STATE-CAPABILITY-005-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-PAGE-STATE-CAPABILITY-006-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/page-state-capability/inspector.ts, scripts/audit/domains/page-state-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/page-state/GRASSEYE-PAGE-STATE-CAPABILITY-006-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-PAGE-STATE-CAPABILITY-007-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/page-state-capability/inspector.ts, scripts/audit/domains/page-state-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/page-state/GRASSEYE-PAGE-STATE-CAPABILITY-007-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO
- GRASSEYE-PAGE-STATE-CAPABILITY-008-V2: 缺口类型=PARTIALLY_ENFORCED; 为什么没覆盖=缺少逐法条生产突变证明/删除绑定失败证明的完整证据; 需要修复文件=scripts/audit/domains/page-state-capability/inspector.ts, scripts/audit/domains/page-state-capability/negative-proof-harness.ts, tmp/audit/ability-law-census/regression-proofs/page-state/GRASSEYE-PAGE-STATE-CAPABILITY-008-V2/; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO

### 本组运行结果

- audit command: npm run audit:page-state
- result: PASS
- duration: 21408ms
- findings: see tmp/audit/ability-law-census/audit-runs/audit-page-state.txt
