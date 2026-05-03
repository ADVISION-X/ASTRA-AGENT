---
name: "GrassEye Code Topology"
description: "Use when defining the capability-group topology contract, canonical capability roots, child-capability placement, or retired path deletion under capability-group governance."
applyTo: ".github/instructions/cursor-rules/modules/module-code-topology.instructions.md, src/lib/local-runtime/runtime-executor.ts, src/lib/local-runtime/runtime-bootstrap.ts, src/lib/local-runtime/runtime-state.ts, src/lib/local-runtime/runtime-step-support.ts"
---

# GrassEye Code Topology

Scope: governs the directory constitution for capability-group governance.
Boundary: this module governs canonical path ownership and retired-path deletion only as a capability-group-governance child sub-contract, not as an independent owner.
Excludes: business logic, runtime policy, scoring rules, and type-validation semantics.
Authority: this file is authoritative only for the capability-group-governance domain as the topology sub-contract.

## Law GRASSEYE-CODE-TOPOLOGY-001-V1

status: retired
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: manual-first
evidenceMode: law

summary: code-topology is a capability-group-governance child sub-contract for canonical roots, not an active owner.

### 主题

能力组根目录唯一

### 法条

Each active ability group must own exactly one canonical root under src/capabilities/<ability-group>.

Required direction:
- commander-console, orchestration, nerve-bus, ai, open, screenshot, visual-target, geometry-guard, mouse-click, mouse-scroll, post-action-verification, forensics-persistence, and page-state each own one canonical root under src/capabilities.
- Public contracts, child registries, and group-private implementations must live under the owning ability-group root.
- Laws and blueprints must reference the same canonical root.
- src/lib must remain infrastructure-only and must not host a replacement execution chain or shell-side runtime execution slice such as src/lib/local-runtime/runtime-executor.ts, runtime-bootstrap.ts, runtime-state.ts, or runtime-step-support.ts.
- The AI canonical root includes contract.ts, ability-group.ts, registry.ts, task-router.ts, model-roster.ts, schema-validation.ts, runtime-adapters/local-ai-runtime-adapter.ts, shared/*, and children/*/implementation.ts.
- AI prompt-contract shortcut files and AI-local legacy result translators are not canonical topology.
- Commander Console child abilities must live under src/capabilities/commander-console/children/<child-id>/implementation.ts rather than a flat children.ts pseudo-catalog.
- Commander Console canonical topology includes contract.ts, ability-group.ts, registry.ts, command-builder.ts, read-models.ts, ports/*, shared/*, and children/*/implementation.ts with no second command or dashboard root.
- Mouse Click canonical topology includes contract.ts, ability-group.ts, registry.ts, primitive-port.ts, index.ts, shared/click-policy.ts, shared/click-result.ts, shared/click-failure.ts, shared/runtime-proof.ts, shared/coordinate.ts, and only children/click-browser-coordinate/implementation.ts plus children/click-desktop-coordinate/implementation.ts.
- Mouse Scroll canonical topology includes contract.ts, ability-group.ts, registry.ts, primitive-port.ts, index.ts, shared/scroll-policy.ts, shared/scroll-result.ts, shared/scroll-failure.ts, shared/scroll-magnitude.ts, shared/runtime-proof.ts, shared/coordinate.ts, and only children/scroll-browser-viewport/implementation.ts plus children/scroll-desktop-screen/implementation.ts plus children/scroll-region/implementation.ts.
- Geometry Guard canonical topology includes contract.ts, ability-group.ts, registry.ts, index.ts, shared/*, and children/*/implementation.ts.
- Geometry Guard child implementations must stay under src/capabilities/geometry-guard/children/<child-id>/implementation.ts.

### 禁止

FORBIDDEN:
- second roots, bridge roots, compat roots, or legacy mirrors for an active ability group.
- src/features or src/lib becoming a second public root for an ability group.
- src/lib/local-runtime/runtime-executor.ts, runtime-bootstrap.ts, runtime-state.ts, or runtime-step-support.ts becoming an execution owner for mission flow, AI dispatch, persistence finalization, or runtime branch truth.
- runtime-task-execution.ts, capability-check.ts, or verify* surviving inside an active ability-group canonical root.
- prompt-contract.ts or LocalAi legacy result mapping surviving as active files inside the AI canonical root.
- runtime-skill-catalog.ts, runtime-skill-resolution.ts, build-runtime-skill-matrix-snapshot.ts, build-browse-runtime-snapshot.ts, or build-pending-analysis-candidate.ts surviving under Commander Console as canonical topology.
- commander-console-v2, commander-console-legacy, or any second console root preserving old operator/workbench naming as active topology.
- click-left-point, click-right-point, double-click-left-point, click-screen-coordinate, or any other retired Mouse Click child root surviving after topology cutover.
- vertical-wheel-scroll, horizontal-wheel-scroll, browser-viewport-scroll, desktop-screen-scroll, region-wheel-scroll, capability-check.ts, or verify* surviving inside the Mouse Scroll canonical root after topology cutover.
- external files importing geometry-guard child implementation paths.

## Law GRASSEYE-CODE-TOPOLOGY-002-V1

status: retired
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: manual-first
evidenceMode: law

summary: feature and support paths are consumers or boundaries, not owners.

### 主题

特征层与支持层不得抢权

### 法条

Feature folders and support folders may host shells, adapters, consumers, storage ports, and infrastructure, but they must not own active ability-group sovereignty.

Required direction:
- src/app hosts route entry and local shell integration.
- src/features/local-data and src/features/platform-action are retired roots and must not remain after migration.
- Storage-port implementations belong under src/capabilities/forensics-persistence or neutral storage infrastructure.
- Platform profiles, hints, identity rules, and view descriptions belong under the owning ability-group shared/profile paths.
- src/lib/local-ai hosts AI internal runtime adapters only.
- src/lib/browser hosts browser primitives and session infrastructure only.
- .github/instructions/cursor-rules hosts laws, and docs/法案辅助文件 hosts blueprints.
- AI child implementations are private to AI and must not become cross-group import targets.
- Cross-group consumers must not import another ability group's shared/private helpers when a public index or contract exists.

### 禁止

FORBIDDEN:
- src/features/agent, src/features/platform-action, src/features/local-data, src/lib/browser, src/lib/local-ai, or src/lib/local-runtime/runtime-executor.ts, runtime-bootstrap.ts, runtime-state.ts, runtime-step-support.ts claiming public ability ownership.
- deleted historical owner names being preserved as canonical paths.

## Law GRASSEYE-CODE-TOPOLOGY-003-V1

status: retired
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: manual-first
evidenceMode: law

summary: retired feature roots must be physically deleted after migration.

### 主题

旧 feature 根目录必须物理删除

### 法条

Retired feature roots must not remain as placeholder folders, index files, re-export wrappers, or hidden mirrors after ownership migration.

Required direction:
- src/features/local-data must be physically deleted after its useful storage material migrates into Forensics Persistence storage-port modules.
- src/features/platform-action must be physically deleted after its useful platform profiles and hints migrate into the owning ability groups.
- No compat, bridge, legacy, alias, or dynamic-import mirror may preserve either retired root.

### 禁止

FORBIDDEN:
- src/features/local-data/index.ts, src/features/platform-action/index.ts, or any other old-root wrapper.
- Re-exporting retired-root symbols from new folders.
- Dynamic imports or alias paths that hide the retired roots.

---

## Law GRASSEYE-CODE-TOPOLOGY-004-V2

status: retired
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: manual-first
evidenceMode: law

summary: Forensics Persistence must use one clean internal topology and must physically delete old runtime/store roots.

### 主题

Forensics 内部拓扑必须干净，旧 runtime/store 根必须物理删除。

### 法条

The only allowed Forensics canonical topology is contract.ts, ability-group.ts, registry.ts, storage-ports.ts, record-id.ts, index.ts, shared/*, and children/*/implementation.ts.

### 禁止

FORBIDDEN:
- src/capabilities/forensics-persistence/runtime.
- src/capabilities/forensics-persistence/shared/store.
- compat, bridge, legacy, alias, or v2 roots under src/capabilities/forensics-persistence.
- src/lib/local-runtime becoming the owner of persistence finalization.
