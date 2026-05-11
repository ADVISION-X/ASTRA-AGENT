---
name: "GrassEye Capability Group Governance"
 description: "Use when defining GrassEye ability groups, child-ability boundaries, shared ability contracts, strength levels, debug evidence, or orchestration-to-ability-group authority."
applyTo: ".github/instructions/cursor-rules/GRASSEYE-KERNEL.instructions.md, .github/instructions/cursor-rules/grasseye-index.instructions.md, .github/instructions/cursor-rules/modules/module-capability-group-governance.instructions.md, docs/法案辅助文件/GrassEye 能力组与子能力总纲施工图.md"
---

# GrassEye Capability Group Governance

Scope: governs the shared contract for all GrassEye ability groups and child abilities.
Boundary: this module governs the constitutional layer only: system formula, parent-child ownership, topology contract, owner evidence minimums, and orchestration or commander boundaries.
Excludes: concrete click logic, concrete screenshot logic, AI prompt internals, storage schema internals, and any group-private business execution.
Authority: this file is authoritative only for the capability-group-governance domain.

## Law GRASSEYE-CAPABILITY-GROUP-001-V1

status: active
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: GrassEye uses one fixed ability-group constitution and one execution chain.

### 主题

唯一能力宪法

### 法条

GrassEye = 14 active ability groups + child abilities + Nerve Bus + Orchestration + Commander Console + Forensics Persistence.

Required direction:
- Only the following ability groups are active owners: commander-console, orchestration, nerve-bus, ai, open, screenshot, visual-target, geometry-guard, mouse-click, text-input, mouse-scroll, post-action-verification, forensics-persistence, and page-state.
- Child abilities may exist only under one of the 14 active ability groups.
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
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: every ability group owns one public contract and one child-boundary catalog.

### 主题

父子边界唯一

### 法条

Every ability group must expose one unified public contract that governs all of its child abilities.

Required direction:
- Every ability group must declare one stable abilityGroupId and one child catalog.
- Every child ability must declare childCapabilityId and parentAbilityGroupId.
- Shared fields must keep one spelling across laws, blueprints, types, and owner evidence.
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
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

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
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: owner evidence minimum fields are fixed across every governed execution.

### 主题

统一运行证明合同

### 法条

Every governed execution must leave one minimum owner evidence contract that survives success and failure.

Required direction:
- owner evidence must carry runId, missionId, capabilityId, childCapabilityId when applicable, inputSummary, outputSummary, status, errorCode, evidenceRef, and timestamp.
- evidence fields must keep one spelling across laws, blueprints, types, and audit output.
- evidence must exist for both success and failure.

### 禁止

FORBIDDEN:
- group-specific proof shapes that cannot be traced across capability boundaries.
- silent success.
- silent failure.

## Law GRASSEYE-CAPABILITY-GROUP-005-V1

status: active
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

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
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

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
- Text Input writes approved text into verified input targets through governed ports.
- Post-action Verification validates action results.

### 禁止

FORBIDDEN:
- Coordinate Action old layering.
- hidden skill catalogs or browse chains.
- platform-action, local-browser-session, local-app-shell, startup-entrypoint, structured-logging, local-persistence-schema, multi-frame-evidence, or local-ai-runtime claiming ability-group sovereignty.
- src/features/local-data or src/features/platform-action surviving as public runtime roots, bridge roots, or compat roots.
- Commander Console reviving operator snapshot, browse runtime snapshot, task-run truth, or agent skill matrix as a second owner universe.
- Geometry Guard owning action planning, click execution, scroll execution, screenshot truth, or AI reasoning.

## Law GRASSEYE-CAPABILITY-GROUP-007-V1

status: active
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Capability Catalog and MuscleMemoryCatalog are generated read models, not new owners.

### 主题

Capability Registry 只读不立组

### 法条

Capability Catalog is a generated read model from active ability group registries and child ability contracts. MuscleMemoryCatalog is the governed capability registry exposed to AI and governed runtime. Neither is a new ability group, business-flow owner, or semantic shortcut owner.

## Law GRASSEYE-CAPABILITY-GROUP-008-V1

status: active
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: AI-generated retired-flow drafting must use the governed capability catalog.

### 主题

退役流程草案不得编造能力

### 法条

AI-generated retired-flow drafting must use the capability catalog and must not invent unknown ability groups or child capabilities.

## Law GRASSEYE-CAPABILITY-GROUP-009-V1

status: active
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: non-AI body groups and support layers must not own video-change cognition or revive verify-video-changed-after-scroll.

### 主题

非 AI 视频变化判断禁令

### 法条

AI is the brain. Non-AI ability groups and support layers may capture observations, execute primitives, validate geometry, and transport proof, but they must not determine whether media or video content changed.

Required direction:
- Only AI may judge whether before/after video content is the same, changed, ambiguous, or semantically different.
- Post-action Verification must not expose or revive `verify-video-changed-after-scroll`.
- Browser or runtime support may observe page URL, DOM identity, screenshot refs, or video identity refs, but those observations must be handed to AI or downstream governed proof instead of becoming a local changed/unchanged verdict.
- Mouse Scroll success remains primitive execution truth only; it must not claim video-change truth.

### 禁止

FORBIDDEN:
- `verify-video-changed-after-scroll` as a child capability, expected outcome type, dispatch route, or support helper.
- DOM, URL, perceptual hash, pixel diff, threshold, or hand-written rule deciding whether the video changed outside AI.
- Browser support helpers that compare before/after video identity and return local video-change truth.

## Law GRASSEYE-CAPABILITY-GROUP-010-V1

status: active
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: non-AI open, scroll, page-state, post-action-verification, screenshot, text-input, and visual-target surfaces must not publish AI-owned cognition.

### 主题

非 AI 页面认知命名禁令

### 法条

AI is the brain. Open, Mouse Scroll, Page State, Post-action Verification, Screenshot, Text Input, and Visual Target may execute primitives, preserve observations, transport proof, and normalize governed evidence, but they must not publish cognition-labelled surfaces that decide or classify page readiness, login state, safety review, freshness, sensitive-text verdict, page/domain truth, target ranking, ambiguity thresholds, or local visual-target selection policy.

Required direction:
- Mouse Scroll may expose primitive execution status, safety gate metadata, and proof refs only.
- Open may expose navigation attempt status and post-open observation handoff refs only.
- Page State may preserve governed observations, source binding, and observation packaging only.
- Post-action Verification may package before/after evidence and observation refs only; final action-outcome judgment belongs to AI.
- Screenshot may expose governed capture state and handoff proof only; it must not emit login-wall or wrong-domain verdict truth.
- Text Input may consume approved sensitiveTextPolicy and redact payload proof only; it must not heuristically detect or classify sensitive text.
- Visual Target may normalize governed candidates, bind source proof, and build Geometry Guard handoff only; it must not publish detect child ids, local threshold/freshness/ambiguity policy, or non-AI target-selection judgment surfaces.
- Readiness, safety, stability, freshness, login, domain, sensitive-text, and page-kind judgment must be emitted by AI through an AI-owned contract instead of non-AI child ids, classification fields, or local verdict helpers.

### 禁止

FORBIDDEN:
- `detect-*` child capabilities or child ids under non-AI cognition surfaces.
- `classificationDecision`, `classificationSource`, `freshnessDecision`, `proceedDecision`, `alreadyOnTargetFreshnessDecision`, `detectSensitiveText`, `minimumConfidence`, `minimumAmbiguityGap`, `freshnessTtlMs`, `freshnessPolicy`, `maxSnapshotAgeMs`, `maxObservationAgeMs`, `maxObservationSkewMs`, `confidencePolicy`, `selectionPolicy`, `ambiguityPolicy`, `coordinatePolicy`, or `dataQualityPolicy` under non-AI cognition purge targets.
- `post-open-state`, `state-classification`, or `proceed-decision` runtime gates outside AI.
- `login_wall`, `wrong_domain`, or `security_wall` as exported non-AI verdict literals.
- Hand-written readiness, safety, stability, freshness, login, domain, sensitive-text, platform-kind, target-ranking, or ambiguity-threshold truth being published by non-AI groups.
- Product-presence low-confidence or frame-count based truth being decided by production code. Production code may fail mechanically when required evidence is missing, but only AI output may decide product_yes/product_no.

## Law GRASSEYE-CAPABILITY-GROUP-011-V1

status: active
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: MuscleMemoryCatalog is the governed capability registry and must not become a workflow, package, or semantic-shortcut library.

### 主题

肌肉记忆只能是能力登记册

### 法条

GrassEye Muscle Memory is the governed capability registry.
It is not a workflow library.
It is not a package library.
It is not a business-flow catalog.
It is not a semantic-shortcut catalog.

Required direction:
- MuscleMemoryCatalog may register only system-owned executable abilities, their input boundaries, output proof shape, execution owner, and failure semantics.
- MuscleMemoryCatalog is the AI-visible ability manual and the system-visible dispatch registry.
- MuscleMemoryCatalog entries must point to atomic child capabilities or to clearly marked transitional aliases that are not final authority.
- MuscleMemoryCatalog must not own user-intent judgment, business-flow routing, or semantic packaging truth.

### 禁止

FORBIDDEN:
- treating MuscleMemoryCatalog as a package catalog, workflow catalog, semantic-shortcut catalog, or business-flow catalog.
- storing multi-step business procedures as final registry truth.
- letting composite, package, or flow entries become the final authority over child capabilities.
- defining muscle memory as both a capability registry and a workflow-or-package library at the same time.

## Law GRASSEYE-CAPABILITY-GROUP-012-V1

status: active
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: every capability group is an owner department that provides one class of executable child capabilities.

### 主题

能力组是能力提供部门

### 法条

Capability Group is the owner department of a class of executable abilities. A capability group owns schemas, contracts, child capability registry, execution boundary, proof shape, and failure semantics for its child capabilities.

Required direction:
- A capability group provides real executable child capabilities only for its own execution dimension.
- A capability group must not decide user intent, own business-process packages, or replace AI semantic judgment.
- A capability group must keep child capability input schema, forbidden input, output proof, and failure policy explicit.
- Owner evidence, contracts, and runtime dispatch must align with the capability-group boundary.

### 禁止

FORBIDDEN:
- treating a capability group as a business-process owner, route-plan owner, or task-package owner.
- letting a capability group mix AI judgment with primitive execution ownership.
- hiding cross-department business flow inside one capability group's child registry.

## Law GRASSEYE-CAPABILITY-GROUP-013-V1

status: active
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: every child capability must be the smallest governed executable action and must stay atomic, concrete, and behaviorally unambiguous.

### 主题

子能力只能是最小原子动作

### 法条

Child Capability is the smallest governed executable action owned by a capability group. A child capability must be atomic, concrete, and behaviorally unambiguous.

Required direction:
- A child capability must represent one irreducible executable action such as one click, one key press, one text input, one capture, one open, one evidence write, or one governed stop/review handoff.
- A child capability must define explicit input schema, forbidden inputs, output proof or refs, and failure semantics.
- A child capability may be reused by AI composition and system scheduling only after its atomic boundary is clear.
- Behavior names must describe executable action truth rather than business outcome truth.

### 禁止

FORBIDDEN:
- business flows, semantic shortcuts, or multi-step packages being defined as child capabilities.
- names such as `LIKE_CURRENT_VIDEO`, `OPEN_COMMENTS`, `NEXT_VIDEO`, `SAVE_PRODUCT_AND_LIKE`, `YES_SEEDING_VIDEO_FLOW`, or `NO_SEEDING_VIDEO_FLOW` being treated as final atomic child-capability truth.
- mixing multiple business judgments and multiple execution steps into one child capability.

## Law GRASSEYE-CAPABILITY-GROUP-014-V1

status: active
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: AI composes registered atomic capabilities while the system validates, injects, dispatches, and records evidence.

### 主题

AI 负责组合，系统负责安全执行

### 法条

AI receives the capability registry as an ability manual. AI may compose multiple registered atomic capabilities according to the user requirement and current visual evidence. The system validates the proposed capability sequence, injects system-owned refs, resolves executable geometry through Geometry Guard, dispatches governed child capabilities, and records evidence.

Required direction:
- AI must use only registry-exposed capabilities and must not invent unknown capability groups, child capabilities, or semantic package names.
- AI must not output raw coordinates or bypass the governed registry to call owner internals.
- The system must validate whether each proposed capability is registered and whether each input matches the governed contract.
- The system may inject system fields and refs, resolve gridCell through Geometry Guard, dispatch the owning capability group, and persist evidence.
- The system must not replace AI by composing business packages or performing user-intent judgment.

### 禁止

FORBIDDEN:
- AI inventing capabilities outside the registry.
- AI outputting raw x/y or direct owner-internal invocation payloads.
- system-owned business-package composition replacing AI composition.
- system validators, schedulers, or registries owning business-process truth.

## Law GRASSEYE-CAPABILITY-GROUP-015-V1

status: active
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: semantic actions, package entries, and flow entries may exist only as transitional residue and must not define final registry truth.

### 主题

语义套餐只能过渡不得立法

### 法条

Composite, package, workflow, and semantic-action vocabulary may appear only as historical transition residue, anti-examples, or code-gap tracking. They must not define final MuscleMemoryCatalog authority, final child-capability truth, or final AI-manual truth.

Required direction:
- Any surviving semantic or composite entry must be marked transitional, historical, or pending code-level retirement.
- Blueprints and laws must prefer atomic registry entries over package or flow wording.
- Inspectors must later block business-flow packages from being accepted as atomic child capabilities.

### 禁止

FORBIDDEN:
- positive final-direction descriptions for composite action, package, workflow, business flow, or semantic shortcut inside active law and blueprint authority.
- treating semantic action names as mandatory retained capability definitions.
- allowing package legality gates or workflow compilers to replace the simpler capability-registry definition.

## Law GRASSEYE-CAPABILITY-STRENGTH-001-V1

status: active
tier: P0
capabilityDomain: capability-group-governance
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: every child capability exposed to the capability registry or AI composition must prove atomic executable strength.

### 主题

子能力强度准入

### 法条

Every child capability that is exposed to MuscleMemoryCatalog or AI composition must first be an atomic executable action and must prove strength through owner contract, owner schema, owner runtime registry, implementation, governed dispatch reachability, and audit evidence.

Required direction:
- A child capability must be atomic and behaviorally unambiguous before it is eligible for MuscleMemoryCatalog or AI composition.
- A child capability is not eligible for AI action planning unless it is declared in owner contract, declared in owner schema union, registered in owner runtime registry, implemented, reachable through governed dispatch, and able to return governed success, failed, or review_required output.
- A child capability that performs side effects must also prove a Forensics record path.
- Capability-group-governance audit must generate a child capability strength inventory and machine findings for missing registry, schema drift, missing execute, fake success, naked public throw, missing dispatch coverage, and AI action child gaps.
- MuscleMemoryCatalog and AI action planning must not expose metadata-only or non-executable children.

### 禁止

FORBIDDEN:
- metadata-only child capability in MuscleMemoryCatalog.
- fake success child capability.
- throw-only public execute boundary.
- child existing in catalog but missing from runtime.
- AI-allowed action path without executable child coverage.
- side-effecting child without a Forensics record path.
- semantic package or business-flow residue being graded as an atomic strong child capability.
