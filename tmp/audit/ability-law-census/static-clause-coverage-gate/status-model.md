# Status Model

- NOT_COVERED: 没有 owner inspector source evidence。
- INSPECTOR_MAPPED: 有 owner source evidence，但 negative proof 还没接上。
- NEGATIVE_PROOF_MAPPED: negative proof 已接上，但还没有 production mutation proof。
- MUTATION_PROOF_CAPTURED: mutation proof 已有，但 owner-binding proof 还缺。
- OWNER_BINDING_PROOF_CAPTURED: owner-binding proof 已有，但 owner audit 还没通过或脚本缺失。
- OWNER_AUDIT_PASS: owner audit 已通过，但全局链路结果还未完整观测。
- OWNER_PROOF_COMPLETE_BUT_GLOBAL_CHAIN_BLOCKED: owner proof 完整，但 typecheck/lint/audit/ci/capability-group-governance 中仍有阻塞。
- ENFORCED: 只有 owner proof 完整且全局链路全部通过时才允许。
