# APEX Style Gap Analysis

## 1. APEX-style 链路

APEX-style 的关键不是出一份 coverage 报告，而是让 static-clause-coverage 进入 audit-system 的 machine-blocking phase，并绑定 generated registry、enforcement matrix、audit plan、owner manifest、owner inspector source、negative proof、mutation proof、owner-binding proof 以及全局链路结果。

## 2. GrassEye 之前缺什么

之前 tmp ability-law-census 直接从 proof 文件和 inspector 存在性推导 ENFORCED，audit-system 自身并没有 clause 级 gate，也没有把全局 typecheck/lint/audit/ci 失败纳入 ENFORCED 硬门槛。

## 3. 为什么 AI 15 条 law 之前不能算 ENFORCED

当前全局链路未通过，因此 AI law 最多只能停留在 OWNER_PROOF_COMPLETE_BUT_GLOBAL_CHAIN_BLOCKED 或更早状态。

## 4. 哪些检查已上升到 audit-system meta inspector

- static-clause-coverage artifact 是否存在且未手改。
- 14 ability groups active law 是否全部进入 generated ledger。
- 每条 law 是否有 owner inspector source evidence。
- mutation proof / owner-binding proof / owner audit script 是否齐全。
- 全局链路失败时是否仍有人为标 ENFORCED。

## 5. tmp 报告的地位

tmp 报告现在只作为 evidence 输出；真正的判定来源是 audit-system phase 和 static-clause-coverage.generated.json。

## Historical Loop Evidence

# LOOP-1-ai-proof-closure Report

## 1. 本轮目标

- 只治理 AI owner。
- 不进入 visual-target。
- 不创建第二套执法系统。

## 2. AI law status before / after

| lawId | before | after | mutation proof | owner-binding proof |
|---|---|---|---|---|
| GRASSEYE-AI-CAPABILITY-001-V1 | PARTIALLY_ENFORCED | ENFORCED | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-001-V1/proof-summary.md | tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/owner-binding-proof-summary.md |
| GRASSEYE-AI-CAPABILITY-002-V1 | PARTIALLY_ENFORCED | ENFORCED | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-002-V1/proof-summary.md | tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/owner-binding-proof-summary.md |
| GRASSEYE-AI-CAPABILITY-003-V1 | PARTIALLY_ENFORCED | ENFORCED | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-003-V1/proof-summary.md | tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/owner-binding-proof-summary.md |
| GRASSEYE-AI-CAPABILITY-004-V1 | PARTIALLY_ENFORCED | ENFORCED | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-004-V1/proof-summary.md | tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/owner-binding-proof-summary.md |
| GRASSEYE-AI-CAPABILITY-005-V1 | PARTIALLY_ENFORCED | ENFORCED | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-005-V1/proof-summary.md | tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/owner-binding-proof-summary.md |
| GRASSEYE-AI-CAPABILITY-005B-V2 | PARTIALLY_ENFORCED | ENFORCED | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-005B-V2/proof-summary.md | tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/owner-binding-proof-summary.md |
| GRASSEYE-AI-CAPABILITY-006-V1 | PARTIALLY_ENFORCED | ENFORCED | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-006-V1/proof-summary.md | tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/owner-binding-proof-summary.md |
| GRASSEYE-AI-CAPABILITY-007-V1 | PARTIALLY_ENFORCED | ENFORCED | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-007-V1/proof-summary.md | tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/owner-binding-proof-summary.md |
| GRASSEYE-AI-CAPABILITY-008-V1 | PARTIALLY_ENFORCED | ENFORCED | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-008-V1/proof-summary.md | tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/owner-binding-proof-summary.md |
| GRASSEYE-AI-CAPABILITY-009-V1 | PARTIALLY_ENFORCED | ENFORCED | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-009-V1/proof-summary.md | tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/owner-binding-proof-summary.md |
| GRASSEYE-AI-CAPABILITY-010-V1 | PARTIALLY_ENFORCED | ENFORCED | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-010-V1/proof-summary.md | tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/owner-binding-proof-summary.md |
| GRASSEYE-AI-CAPABILITY-011-V1 | PARTIALLY_ENFORCED | ENFORCED | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-011-V1/proof-summary.md | tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/owner-binding-proof-summary.md |
| GRASSEYE-AI-CAPABILITY-012-V1 | PARTIALLY_ENFORCED | ENFORCED | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-012-V1/proof-summary.md | tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/owner-binding-proof-summary.md |
| GRASSEYE-AI-CAPABILITY-013-V1 | PARTIALLY_ENFORCED | ENFORCED | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-013-V1/proof-summary.md | tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/owner-binding-proof-summary.md |
| GRASSEYE-AI-CAPABILITY-014-V1 | PARTIALLY_ENFORCED | ENFORCED | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-014-V1/proof-summary.md | tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/owner-binding-proof-summary.md |

## 3. 每条 law 的 proof bundle

| lawId | scenarioId | mutated file | fail output | rollback pass output | proof summary |
|---|---|---|---|---|---|
| GRASSEYE-AI-CAPABILITY-001-V1 | forbidden-import-mutation | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-001-V1/mutated-file.patch | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-001-V1/inspector-fail-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-001-V1/inspector-pass-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-001-V1/proof-summary.md |
| GRASSEYE-AI-CAPABILITY-002-V1 | input-gate-mutation | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-002-V1/mutated-file.patch | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-002-V1/inspector-fail-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-002-V1/inspector-pass-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-002-V1/proof-summary.md |
| GRASSEYE-AI-CAPABILITY-003-V1 | forbidden-import-mutation | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-003-V1/mutated-file.patch | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-003-V1/inspector-fail-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-003-V1/inspector-pass-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-003-V1/proof-summary.md |
| GRASSEYE-AI-CAPABILITY-004-V1 | public-index-helper-mutation | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-004-V1/mutated-file.patch | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-004-V1/inspector-fail-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-004-V1/inspector-pass-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-004-V1/proof-summary.md |
| GRASSEYE-AI-CAPABILITY-005-V1 | paid-execute-mutation | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-005-V1/mutated-file.patch | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-005-V1/inspector-fail-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-005-V1/inspector-pass-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-005-V1/proof-summary.md |
| GRASSEYE-AI-CAPABILITY-005B-V2 | forbidden-action-output-mutation | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-005B-V2/mutated-file.patch | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-005B-V2/inspector-fail-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-005B-V2/inspector-pass-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-005B-V2/proof-summary.md |
| GRASSEYE-AI-CAPABILITY-006-V1 | as-any-mutation | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-006-V1/mutated-file.patch | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-006-V1/inspector-fail-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-006-V1/inspector-pass-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-006-V1/proof-summary.md |
| GRASSEYE-AI-CAPABILITY-007-V1 | public-index-helper-mutation | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-007-V1/mutated-file.patch | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-007-V1/inspector-fail-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-007-V1/inspector-pass-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-007-V1/proof-summary.md |
| GRASSEYE-AI-CAPABILITY-008-V1 | second-prompt-truth-mutation | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-008-V1/mutated-file.patch | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-008-V1/inspector-fail-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-008-V1/inspector-pass-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-008-V1/proof-summary.md |
| GRASSEYE-AI-CAPABILITY-009-V1 | second-prompt-truth-mutation | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-009-V1/mutated-file.patch | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-009-V1/inspector-fail-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-009-V1/inspector-pass-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-009-V1/proof-summary.md |
| GRASSEYE-AI-CAPABILITY-010-V1 | forbidden-import-mutation | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-010-V1/mutated-file.patch | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-010-V1/inspector-fail-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-010-V1/inspector-pass-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-010-V1/proof-summary.md |
| GRASSEYE-AI-CAPABILITY-011-V1 | prompt-registry-throw-mutation | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-011-V1/mutated-file.patch | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-011-V1/inspector-fail-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-011-V1/inspector-pass-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-011-V1/proof-summary.md |
| GRASSEYE-AI-CAPABILITY-012-V1 | runtime-signal-mutation | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-012-V1/mutated-file.patch | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-012-V1/inspector-fail-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-012-V1/inspector-pass-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-012-V1/proof-summary.md |
| GRASSEYE-AI-CAPABILITY-013-V1 | proof-chain-mutation | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-013-V1/mutated-file.patch | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-013-V1/inspector-fail-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-013-V1/inspector-pass-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-013-V1/proof-summary.md |
| GRASSEYE-AI-CAPABILITY-014-V1 | forbidden-action-output-mutation | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-014-V1/mutated-file.patch | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-014-V1/inspector-fail-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-014-V1/inspector-pass-output.txt | tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-014-V1/proof-summary.md |

## 4. owner-binding proof

- delete-inspector-fail.txt: tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/delete-inspector-fail.txt
- delete-negative-proof-fail.txt: tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/delete-negative-proof-fail.txt
- manifest-unbind-fail.txt: tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/manifest-unbind-fail.txt
- runner-unbind-fail.txt: tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/runner-unbind-fail.txt
- warning-only-fail.txt: tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/warning-only-fail.txt
- empty-negative-proof-fail.txt: tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/empty-negative-proof-fail.txt
- ci-unbind-fail.txt: tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/ci-unbind-fail.txt

## 5. 修改文件

- production code: AI anti-escape/clock-port fixes from LOOP-1 remain in src/capabilities/ai/*. This closure did not add new production mutations as lasting changes.
- inspector code: scripts/audit/domains/capability-group-governance/run-package-audit-script-checks.ts strengthened required ability audit script detection.
- negative proof code: scripts/audit/domains/ai-capability/negative-proof-harness.ts now writes proof bundles and blocks empty mutation sets.
- shared audit utility: scripts/audit/domains/_shared/production-mutation-proof-writer.ts added as proof writer used by the existing AI negative-proof harness.
- docs blueprint: NONE.
- generated report: tmp/audit/ability-law-census/* regenerated by tmp/audit/ability-law-census/build-census.mjs; AI regression proof files added under tmp/audit/ability-law-census/regression-proofs/ai/.

## 6. 命令结果

| command | result | duration | output |
|---|---|---|---|
| npm run audit:ai | PASS | 170786ms | tmp/audit/ability-law-census/loops/01-ai-proof-closure/audit-ai.txt |
| npm run audit:capability-group-governance | FAIL | 6542ms | tmp/audit/ability-law-census/loops/01-ai-proof-closure/capability-group-governance.txt |
| npm run audit:build | PASS | 277ms | tmp/audit/ability-law-census/loops/01-ai-proof-closure/audit-build.txt |
| npm run typecheck | FAIL | 7333ms | tmp/audit/ability-law-census/loops/01-ai-proof-closure/typecheck.txt |
| npm run lint | FAIL | 7642ms | tmp/audit/ability-law-census/loops/01-ai-proof-closure/lint.txt |
| npm run audit | FAIL | 318236ms | tmp/audit/ability-law-census/loops/01-ai-proof-closure/audit.txt |
| npm run ci:full | FAIL | 7732ms | tmp/audit/ability-law-census/loops/01-ai-proof-closure/ci-full.txt |
| git diff --check | PASS | 38ms | tmp/audit/ability-law-census/loops/01-ai-proof-closure/git-diff-check.txt |

## 7. 非 AI 阻塞

See tmp/audit/ability-law-census/loops/01-ai-proof-closure/non-ai-ci-blockers.md.

Current non-AI blockers include typecheck failures in local-app-shell/local-runtime files and capability-group-governance/audit-system failures outside AI owner scope.

## 8. 最终状态

LOOP_1_AI_PROOF_CLOSURE_NOT_READY

