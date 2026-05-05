# Final Report

STATIC_CLAUSE_COVERAGE_GATE_NOT_READY

## 1. 为什么旧提示词没有实现全面执法

旧链路把 tmp/audit/ability-law-census 当成了状态判定者，导致 proof bundle 存在即可推高到 ENFORCED，而 audit-system 并没有 clause 级 fail-closed gate。

## 2. APEX-style 执法链如何落到 GrassEye

现在 static-clause-coverage 作为 audit-system phase 执行，artifact 由审计生成链写出，audit-system 自己验证 artifact、writer wiring、source evidence、proof bundle 和全局链路。

## 3. 新增 gate

- generated artifact: scripts/audit/generated/static-clause-coverage.generated.json
- audit-system phase: static-clause-coverage
- anti-escape proof: audit-system static-clause-coverage negative-proof bundle

## 4. static-clause-coverage 如何校验

它逐条读取 14 个能力组 active laws，验证 matrix/plan/manifest/source evidence/proof bundle/global chain，并阻止全局链路失败时的 ENFORCED 假绿。

## 5. 当前 AI 状态

AI law counts by status: OWNER_PROOF_COMPLETE_BUT_GLOBAL_CHAIN_BLOCKED=7, NOT_COVERED=58, NEGATIVE_PROOF_MAPPED=64

## 6. one-way valve 修正

one-way valve 现在必须 FAIL，因为全局链路仍阻塞。

## 7. 当前全局阻塞

- typecheck failed or is missing fresh evidence.
- lint failed or is missing fresh evidence.
- audit:capability-group-governance failed or is missing fresh evidence.
- audit failed or is missing fresh evidence.
- ci:full failed or is missing fresh evidence.

## 8. 下一轮最小修复顺序

1. 修全局 typecheck/lint/audit/ci blocker。
2. 让当前 owner audit 状态全部刷新到真实 PASS/FAIL 结果。
3. 继续补齐缺失 source evidence 或 proof bundle 的 ability owner。
4. 全局链路通过后，再允许 law 进入 ENFORCED。
