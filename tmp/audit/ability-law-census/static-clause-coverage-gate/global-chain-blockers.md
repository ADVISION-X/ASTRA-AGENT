# Global Chain Blockers

| command | passed | exitCode | evidencePath |
| --- | --- | --- | --- |
| typecheck | false | 2 | tmp/audit/ability-law-census/audit-runs/typecheck.txt |
| lint | false | 2 | tmp/audit/ability-law-census/audit-runs/lint.txt |
| audit:capability-group-governance | false | 1 | tmp/audit/ability-law-census/audit-runs/audit-capability-group-governance.txt |
| audit | false | 1 | tmp/audit/ability-law-census/audit-runs/audit.txt |
| ci:full | false | 2 | tmp/audit/ability-law-census/audit-runs/ci-full.txt |

## Legacy Non-AI Blockers

# Non-AI CI Blockers

These blockers were observed after AI proof closure. They are not owned by AI owner and were not repaired in this AI-only loop.

| failing owner | failing lawId | failing file | failure summary | why not AI-owned | next loop recommendation |
|---|---|---|---|---|---|
| typecheck / local-app-shell | N/A | src/lib/local-app-shell/task-start-flow.ts | Object literal includes activationId not accepted by the current start-flow target type. | local-app-shell support/runtime surface, not src/capabilities/ai or ai-capability inspector. | Address in the owner/support loop that owns task start command contract drift. |
| typecheck / local-runtime | N/A | src/lib/local-runtime/workbench-status.ts | missionCommandSchema is not assignable to readiness dependency union. | local-runtime status/readiness surface, not AI owner. | Address in commander/local-runtime readiness contract loop. |
| capability-group-governance | GRASSEYE-CAPABILITY-GROUP-001-V1 | src/lib/local-runtime/workbench-status.ts | Cross-group or support-layer import bypasses owning capability public index or contract. | capability-group-governance/topology issue outside AI owner. | Run a capability-group-governance or local-runtime topology cleanup loop. |
| audit-system / code-purity | code-purity red lines | active source inventories | audit-system reports file-size/function-shape/single-role code-purity violations. | foundation audit/code-purity owner, not AI owner. | Run audit-system/code-purity loop after AI closure. |

