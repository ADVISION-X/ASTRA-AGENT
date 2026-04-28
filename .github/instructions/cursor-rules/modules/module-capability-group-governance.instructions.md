---
name: "GrassEye Capability Group Governance"
description: "Use when defining GrassEye ability groups, child-ability boundaries, shared ability contracts, strength levels, debug runtime proof, or orchestration-to-ability-group authority."
applyTo: ".github/instructions/cursor-rules/GRASSEYE-KERNEL.instructions.md, .github/instructions/cursor-rules/grasseye-index.instructions.md, .github/instructions/cursor-rules/modules/module-capability-group-governance.instructions.md, docs/法案辅助文件/GrassEye 能力组与子能力总纲施工图.md"
---

# GrassEye Capability Group Governance

Scope: governs the shared contract for all GrassEye ability groups and child abilities.
Boundary: this module governs the constitutional layer only: system formula, parent-child ownership, topology contract, runtime proof minimums, and orchestration or commander boundaries.
Excludes: concrete click logic, concrete screenshot logic, AI prompt internals, storage schema internals, and any group-private business execution.
Authority: this file is authoritative only for the capability-group-governance domain.

## Law GRASSEYE-CAPABILITY-GROUP-001-V1

status: active
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: manual-first
evidenceMode: law

summary: GrassEye uses one fixed ability-group constitution and one execution chain.

### 主题

唯一能力宪法

### 法条

GrassEye = 13 active ability groups + child abilities + Nerve Bus + Orchestration + Commander Console + runtime proof + Forensics Persistence.

Required direction:
- Only the following ability groups are active owners: commander-console, orchestration, nerve-bus, ai, open, screenshot, visual-target, geometry-guard, mouse-click, mouse-scroll, post-action-verification, forensics-persistence, and page-state.
- Child abilities may exist only under one of the 13 active ability groups.
- Support boundaries may describe shell, topology, schema, logging, privacy, and audit rules, but they do not become active execution owners.
- The only execution chain is: child capability -> parent capability group -> Nerve Bus -> Orchestration -> Commander Console -> Forensics evidence.

### 禁止

FORBIDDEN:
- coordinate-action as a separate active ability group.
- agent-runtime, browse-flow, mechanical-skills, visual-action, visual-only-runtime, evidence-packet, operator-control, product-signal, comment-intelligence, or vision-boundary as active owners.
- compat, legacy, bridge, or dual-truth governance tracks.
- Commander Console, Orchestration, or support boundaries swallowing child implementation ownership.

## Law GRASSEYE-CAPABILITY-GROUP-002-V1

status: active
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: manual-first
evidenceMode: law

summary: every ability group owns one public contract and one child-boundary catalog.

### 主题

父子边界唯一

### 法条

Every ability group must expose one unified public contract that governs all of its child abilities.

Required direction:
- Every ability group must declare one stable abilityGroupId and one child catalog.
- Every child ability must declare childCapabilityId and parentAbilityGroupId.
- Shared fields must keep one spelling across laws, blueprints, types, and runtime proof.
- Parent ability groups must expose the only public entry; child implementation paths remain private.
- Child taxonomy must split by owned execution dimension rather than by input parameter variants when the underlying public contract is shared.
- Child capability implementation directories must stay under the owning parent capability root.

### 禁止

FORBIDDEN:
- child capabilities exposed as independent public owners.
- per-child private result universes that bypass the parent contract.
- duplicate ownership of page-state or post-action verification truth.
- external imports of another group's child implementation path.
- inflating child catalogs for parameter variants when one shared public contract already governs those variants.

## Law GRASSEYE-CAPABILITY-GROUP-003-V1

status: active
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: manual-first
evidenceMode: law

summary: Commander, Nerve Bus, and Orchestration each have one fixed authority boundary.

### 主题

指挥链边界

### 法条

Commander Console issues governed mission commands, Nerve Bus transports governed envelopes, and Orchestration selects the next ability group through public contracts only.

Required direction:
- Human command enters Commander Console first.
- Commander Console forwards governed mission commands through Nerve Bus transport.
- Orchestration may request a named child capability only through the owning group's public interface.
- Cross-group collaboration must happen through public contracts and structured proof.
- Cross-group imports must target the owning group's public index or declared public contract only.
- verify, capability-check, and self-check files do not count as public contract or enforcement truth.
- Commander Console remains read-model and command-entry only.
- Orchestration remains orchestration only and must not execute browser, AI, click, scroll, screenshot, or persistence internals.

### 禁止

FORBIDDEN:
- Orchestration importing child implementations directly.
- one ability group reaching into another group's private folder.
- one ability group importing another group's shared helpers, prompt shortcuts, or other non-public files.
- skill catalogs, helper universes, or adapter layers bypassing group boundaries.
- child readiness or acceptance being delegated to per-child verify scripts.
- Commander Console directly executing runtime internals.
- Orchestration importing child implementations directly.
- Nerve Bus becoming an execution owner.

## Law GRASSEYE-CAPABILITY-GROUP-004-V1

status: active
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: manual-first
evidenceMode: law

summary: runtime proof minimum fields are fixed across every governed execution.

### 主题

统一运行证明合同

### 法条

Every governed execution must leave one minimum runtime proof contract that survives success and failure.

Required direction:
- runtime proof must carry runId, missionId, capabilityId, childCapabilityId when applicable, inputSummary, outputSummary, status, errorCode, evidenceRef, and timestamp.
- proof fields must keep one spelling across laws, blueprints, types, and audit output.
- proof must exist for both success and failure.

### 禁止

FORBIDDEN:
- group-specific proof shapes that cannot be traced across capability boundaries.
- silent success.
- silent failure.

## Law GRASSEYE-CAPABILITY-GROUP-005-V1

status: active
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: manual-first
evidenceMode: law

summary: every governed execution must leave evidence, log, and trace.

### 主题

证据闭环

### 法条

Every governed capability execution must leave stable proof that can be traced to Forensics Persistence.

Required direction:
- every capability execution must leave evidence, log, and trace.
- proof, logs, and evidence must line up under one run identity.
- capability outputs must describe success, failure, or review-required branches explicitly.

### 禁止

FORBIDDEN:
- execution without evidence reference.
- execution without failure branch.
- support boundaries owning final evidence truth.

## Law GRASSEYE-CAPABILITY-GROUP-006-V1

status: active
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: manual-first
evidenceMode: law

summary: ability groups must keep hard boundaries and topology must reflect ownership.

### 主题

边界与目录宪法

### 法条

Ability groups must keep hard ownership boundaries and must not absorb support-boundary responsibilities or deleted historical owners.

Required direction:
- Shared nouns that affect more than one group must be owned by one law and referenced elsewhere.
- Each active capability group owns one canonical root under src/capabilities/<group>.
- Child capability implementation must stay under the parent capability root.
- No retired feature root, orphan capability directory, or cross-owner implementation import may survive the cutover.
- Commander Console read-model truth must enter through named Commander-facing ports.
- Visual Target finds points.
- Geometry Guard validates and normalizes executable geometry.
- Mouse Click and Mouse Scroll execute primitives.
- Post-action Verification validates action results.

### 禁止

FORBIDDEN:
- Coordinate Action old layering.
- hidden skill catalogs or browse chains.
- platform-action, local-browser-session, local-app-shell, startup-entrypoint, structured-logging, local-persistence-schema, multi-frame-evidence, or local-ai-runtime claiming ability-group sovereignty.
- src/features/local-data or src/features/platform-action surviving as public runtime roots, bridge roots, or compat roots.
- Commander Console reviving operator snapshot, browse runtime snapshot, task-run truth, or agent skill matrix as a second owner universe.
- Geometry Guard owning action planning, click execution, scroll execution, screenshot truth, or AI reasoning.
