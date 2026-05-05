# Law / Blueprint Mapping

## Map Package Boundary

Law file:
`.github/instructions/cursor-rules/modules/module-map-plugin-package.instructions.md`

lawId:
`GRASSEYE-MAP-PLUGIN-001-V2`

Topic:
地图插件包声明式主权边界

Requirement summary:
Map packages are declarative route data consumed by Orchestration. They are not runtime code, ability plugins, child capabilities, or new owners. Built-in packages must pass the same lifecycle as imported packages. Ordinary UI consumes taskTemplate records, not map internals.

Forbidden:
`map package as child ability`, `map package as public owner`, registry dispatching Nerve Bus, registry mutating Orchestration mission state, built-in package active by side door.

Current violation:
Runtime parsed a built-in package whose `manifest.packageKind` was `child-capability-package`.

## Map Package Lifecycle

Law file:
`.github/instructions/cursor-rules/modules/module-map-plugin-package.instructions.md`

lawId:
`GRASSEYE-MAP-PLUGIN-002-V2`

Topic:
地图包生命周期门禁

Requirement summary:
Every map package must pass import, quarantine, schema validation, dependency validation, transition closure validation, capability registry validation, prompt contract validation, security validation, dry-run validation, validation report, human approval, activation proof, activation, active registry, and rollback if needed.

Current violation:
Startup readiness allowed app shell start before a map package schema/lifecycle preflight caught the invalid built-in package.

## Map Package Schema

Law file:
`.github/instructions/cursor-rules/modules/module-map-plugin-package.instructions.md`

lawId:
`GRASSEYE-MAP-PLUGIN-003-V2`

Topic:
Schema 完整性与包治理元数据

Requirement summary:
Required manifest fields include `packageKind = operational-map-package`. The schema must prevent map packages from depending on runtime truth as authority and must enforce cross-section parity.

Current violation:
`MapPluginManifestSchema` correctly rejected `child-capability-package`, but the rejection happened during service import/health rather than during preflight/audit.

## Map Package Enforcement

Law file:
`.github/instructions/cursor-rules/modules/module-map-plugin-package.instructions.md`

lawId:
`GRASSEYE-MAP-PLUGIN-012-V2`

Topic:
Map Plugin Package 执法闭环

Requirement summary:
All active laws are P0, machine-blocking, and must close through inspector, runner, generated artifacts, and negative proof. No generated fake PASS, empty/missing negative proof, warning-only P0, detached inspector, or verify script as release truth.

Current violation:
The working tree shows `scripts/audit/domains/map-plugin-package/inspector.ts` was changed from a fake PASS negative-proof bypass to `runNegativeProofHarness()`. The previous HEAD implementation returned `mutated bypass` instead of executing negative proof.

## Orchestration Map Package Consumption

Law file:
`.github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md`

lawId:
`GRASSEYE-ORCHESTRATION-CAPABILITY-003-V3`

Topic:
作战地图是受控声明式数据包

Requirement summary:
Operational maps are governed declarative map packages. Orchestration remains the only execution owner. Operational maps are not child capabilities. Active map truth comes only from approved active map registry.

Current violation:
The Orchestration default map store called the development map plugin registry during app shell construction; an invalid package kind crashed the service before mission runtime became available.

## Audit System Closure

Law file:
`.github/instructions/cursor-rules/modules/module-audit-system.instructions.md`

lawId:
`GRASSEYE-AUDIT-SYSTEM-001-V1`

Topic:
Audit enforcement truth

Requirement summary:
The audit runner must execute owners in the generated audit plan. Generated artifacts must be rebuilt through scripts, not edited by hand. Enforcement authority belongs to inspector plus audit runner. Governed non-owner domains such as map-plugin-package must provide manifest, inspector, required-shape, forbidden-shape, boundary-attack, anti-escape, negative-proof-harness, and scorecard-gate coverage.

Current violation:
The historical map-plugin-package inspector negative-proof phase was a generated fake PASS path. Current working tree has an uncommitted change that removes that bypass, but the prior state explains why a child-capability-package regression could evade enforcement.

## Blueprint Mapping

Blueprint file:
`docs/法案辅助文件/GrassEye 地图插件包治理施工图.md`

Sections:
`4. Map Package Schema`, `16. Inspector`, `17. Negative Proof Minimum`, `18. READY 标准`

Requirements:
- Manifest requires `packageKind: operational-map-package`.
- Inspector must verify `map-plugin-package not ability group`, `maps data-only`, `no runtime/child ability behavior`, `built-ins pass lifecycle`, `activation fields complete`, and `negative proof executed`.
- Negative proof must fail/rollback/pass for `map package modeled as child ability`.
- READY requires `no runtime/child ability behavior`, `active map has validationReportRef + humanApprovalRef + activationProofRef + activationSnapshotRef + hashes`, `owner-local inspector PASS`, and `negative proof PASS`.

Current violation:
The runtime observed exactly the negative-proof mutation class: `map package modeled as child ability`. It was caught only by Zod at service construction time, not by startup preflight or a persisted audit gate.

Blueprint file:
`docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md`

Sections:
`7. Map Package Lifecycle`, `Final Readiness Gate`

Requirements:
- Orchestration consumes active approved map package only.
- Valid execution has frozen non-null `activationSnapshotRef`.
- Map package lifecycle and validation gates are enforced before runtime.

Current violation:
The service could not reach a valid running mission; activation and snapshot events never occurred.

Blueprint file:
`docs/法案辅助文件/GrassEye 结构化日志与运行证明施工图.md`

Requirement summary:
Runtime proof/log chain must expose owner, refs, activation snapshot, step/capability ids, and enough structured fields to locate failures.

Current violation:
The terminal stderr relay broke the Zod stack into line-level failure events without traceId/runId/fileName/ownerResponsible/actionableMessage.
