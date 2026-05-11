---
name: "GrassEye Code Purity"
description: "Use when governing source-file atomicity, god-file prevention, function size, complexity, nesting depth, class/object purity, owner-boundary purity, import/export limits, dead code removal, fake/mock production leakage, compatibility-bridge red lines, and refactor boundaries."
applyTo: ".github/instructions/cursor-rules/modules/module-code-purity.instructions.md, src/**/*.{ts,tsx,js,jsx,mjs}, scripts/**/*.{ts,tsx,js,jsx,mjs}"
---

# GrassEye Code Purity

Scope: governs source-file atomicity, god-file prevention, function-shape limits, class/object limits, owner-boundary purity, import/export limits, dead code removal, fake/mock production leakage, compatibility-bridge red lines, and refactor boundaries across active source truth.

Boundary: this module is a mandatory audit-system red-line sub-contract. It is not an independent runtime ability group, and its inspectors and generated artifacts exist only to enforce this law rather than to become a second runtime or second architecture model.

Authority: this file is the single authoritative Code Purity Phase 3.5 baseline. Any older blueprint, script, generated artifact, or working-tree rule that conflicts with this file is invalid until updated to match this file. Generated artifacts are support evidence only and do not outrank this file.

Core doctrine:
- No god files.
- No god classes.
- No god functions.
- No hidden second systems.
- No compatibility bridges that preserve obsolete architecture.
- No fake pass.
- No mock/fake/placeholder execution leaking into production truth.
- No growing oversized touched files.
- No owner-mixing hidden behind neutral names.
- No broad `src/lib` dumping to make feature files look clean.
- No active law without real enforcement.
- No inspector without runner participation.
- No P0/P1 purity rule without real-code-inspection.
- Quality inspection is a simple guardrail, not a second system.

---

## Law GRASSEYE-QUALITY-GATE-SIMPLE-GUARDRAIL-V1

status: active  
tier: P0  
capabilityDomain: audit-system  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: quality inspection exists to protect the simple capability-machine mainline and must not become a second runtime, second architecture model, or report universe.

### 主题

简单护栏，不得再造第二系统

### 法条

Quality inspection exists to block concrete regressions in the simple capability machine. It must not become a second runtime, second architecture model, or generated-matrix universe.

Required direction:
- Every inspector must answer one clear blocking question.
- PASS output should stay short.
- FAIL output must name file, lawId, minimal reason, and fix direction.
- Generated artifacts are support evidence only.
- Inventories or reports may be emitted only when violations exist or a targeted local audit explicitly asks for them.
- Any emitted inventory must stay small, actionable, and owner-local.
- If an inspector cannot be explained in one sentence, it must be split or deleted.
- If a report does not drive a blocking decision or a concrete remediation path, it must be deleted or downgraded to support evidence.
- Audit output must not preserve retired map/package/PAV lifecycle semantics as if they were current runtime truth.

### 禁止

FORBIDDEN:
- building a second runtime model inside QA.
- building a second architecture model inside QA.
- default inventory or report universes on PASS.
- large descriptive output without a blocking decision.
- treating generated matrices, summaries, or inventories as authority truth.
- using QA to keep retired map, package, workflow, or mandatory-PAV narratives alive.

---

## Global Phase 3.5 Code Purity Baseline

This module replaces and invalidates older weak thresholds such as:
- 2000-line god-file threshold.
- 60-member god-object threshold.
- 8-owner-boundary mixing threshold.
- Any doctrine claiming that code-purity excludes file length, function length, complexity, or maintainability thresholds.

### File-size hard limits

Production implementation files:

| File category | Target | Hard limit |
|---|---:|---:|
| Ordinary production implementation file | ≤ 200 lines | 300 lines |
| Runtime / implementation file | ≤ 220 lines | 300 lines |
| App handler / API handler | ≤ 180 lines | 250 lines |
| Orchestration dispatcher / runtime coordinator | ≤ 220 lines | 300 lines |
| Audit inspector aggregation file | ≤ 200 lines | 250 lines |
| Audit phase file | ≤ 250 lines | 350 lines |
| Schema / type file | ≤ 300 lines | 500 lines |
| JSON map / prompt contract file | ≤ 400 lines | 700 lines |

Generated files:
- Must be explicitly generated.
- Must not be manually edited.
- Must not contain runtime logic.
- Must not be used as an excuse to hide active source truth.

### Function hard limits

| Function metric | Target | Hard limit |
|---|---:|---:|
| Physical lines | ≤ 25 | 40 |
| Effective statements | ≤ 20 | 35 |
| Parameters | ≤ 3 | 4 |
| Return branches | ≤ 3 | 5 |
| Nesting depth | ≤ 2 | 3 |
| Cyclomatic complexity | ≤ 6 | 8 |
| switch cases | ≤ 5 | 8 |
| if / else-if chain | ≤ 3 | 5 |

### Class / object hard limits

| Class metric | Target | Hard limit |
|---|---:|---:|
| Methods | ≤ 8 | 12 |
| Fields | ≤ 8 | 12 |
| Total members | ≤ 16 | 24 |
| Constructor parameters | ≤ 4 | 6 |
| Public methods | ≤ 6 | 10 |

### Import / export hard limits

| Import / export metric | Target | Hard limit |
|---|---:|---:|
| Import declarations | ≤ 10 | 15 |
| Import sources | ≤ 8 | 12 |
| Cross-owner imports | ≤ 1 | 2 |
| Owner boundaries | ≤ 2 | 3 |
| Exports | ≤ 5 | 8 |

Absolute import/export bans:
- `export *` is forbidden.
- `require` is forbidden.
- Dynamic import is forbidden unless explicitly governed by a dedicated law and inspector.
- Default export is forbidden unless a specific module law explicitly allows it.

### Escape hatch bans

FORBIDDEN:
- `as any`
- `as unknown as`
- `@ts-ignore`
- `@ts-expect-error`
- `eslint-disable`
- Naked `throw` escaping public execute/runtime boundaries.
- Catch-and-swallow error handling.
- `return null` as success.
- no-op success.
- fake success.
- fallback success.
- TODO success.
- console.log debug scatter in governed runtime paths.
- Warning-only inspector.
- Empty inspection harness.
- Active law without inspector coverage.
- Inspector not connected to runner.
- Generated fake PASS.

---

## Law GRASSEYE-CODE-PURITY-001-V1

status: active  
tier: P0  
capabilityDomain: audit-system  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: active source files must stay atomic and must not exceed Code Purity Phase 3.5 file-size limits.

### 主题

源文件原子性与上帝文件禁止

### 法条

GrassEye active source truth must be physically small, owner-clear, and responsibility-atomic.

Required direction:
- Ordinary production implementation files must stay within 300 lines.
- App/API handlers must stay within 250 lines.
- Runtime / implementation / orchestration coordinator files must stay within 300 lines.
- Audit inspector aggregation files must stay within 250 lines.
- Audit phase files must stay within 350 lines.
- Schema/type files must stay within 500 lines.
- JSON map/prompt contract files must stay within 700 lines.
- A file that exceeds its hard limit is not a style issue; it is a governance violation.
- Oversized files must be split by owner, role, and runtime responsibility.
- A file must not hide multiple systems behind neutral naming.

### 禁止

FORBIDDEN:
- 2000-line threshold as the active god-file baseline.
- Keeping oversized files active without remediation.
- Adding new logic to an oversized touched file.
- Treating existing oversized files as historical exemptions.
- Moving messy logic into a shared file to bypass file-size limits.
- Creating one large “utils”, “runtime”, “manager”, “service”, “handler”, or “workbench” file that owns multiple responsibilities.

---

## Law GRASSEYE-CODE-PURITY-002-V1

status: active  
tier: P0  
capabilityDomain: audit-system  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: touched oversized files must be split before new logic is added.

### 主题

Touched File Rule

### 法条

Any production source file touched in the current task must satisfy its Code Purity Phase 3.5 hard limit before the task may be considered complete.

Required direction:
- If a touched file exceeds its hard limit, the task must split it before adding or preserving new logic.
- No task may add logic to an oversized touched file and call the result acceptable.
- If the file cannot be split in the current task, the task must stop and report BLOCKED_BY_GOD_FILE.
- Existing oversized files must not be treated as safe history.
- Touched-file compliance is stricter than passive inventory.

### 禁止

FORBIDDEN:
- “Only adding a small change” inside an oversized file.
- “Legacy file, leave it for later” after touching the file.
- Adding one more method to a god class.
- Adding one more branch to a god function.
- Adding one more responsibility to a mixed-owner file.
- Marking a task PASS while a touched file remains above its hard limit.

---

## Law GRASSEYE-CODE-PURITY-003-V1

status: active  
tier: P0  
capabilityDomain: audit-system  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: functions must stay small, shallow, and single-purpose.

### 主题

函数尺寸、复杂度与嵌套深度

### 法条

GrassEye functions must be physically small and structurally simple enough for safe audit, AI-assisted edits, and owner-local reasoning.

Required direction:
- A function must not exceed 40 physical lines.
- A function must not exceed 35 effective statements.
- A function must not exceed 4 parameters.
- A function must not exceed 5 return branches.
- A function must not exceed nesting depth 3.
- A function must not exceed cyclomatic complexity 8.
- Switch statements must not exceed 8 cases.
- If/else-if chains must not exceed 5 branches.
- Complex decision logic must be extracted into a decision function.
- Execution logic must be separated from validation, parsing, result building, and proof building.

### 禁止

FORBIDDEN:
- Large “do everything” functions.
- Deep nested if/else chains.
- Combining input parsing, policy decision, execution, persistence, and response building in one function.
- Catch blocks that swallow errors.
- Naked throws escaping public runtime boundaries.
- Adding new branches to functions already over the hard limit.

---

## Law GRASSEYE-CODE-PURITY-004-V1

status: active  
tier: P0  
capabilityDomain: audit-system  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: classes and objects must not become god objects.

### 主题

上帝类与对象膨胀禁止

### 法条

GrassEye classes and object modules must represent narrow roles, not hidden subsystems.

Required direction:
- A class must not exceed 24 total members.
- A class must not exceed 12 methods.
- A class must not exceed 12 fields.
- A class must not exceed 6 constructor parameters.
- A class must not expose more than 10 public methods.
- Large classes must be physically split into narrow components:
  - input gate
  - policy gate
  - executor
  - result builder
  - proof builder
  - read model
  - storage adapter
  - debug emitter
- A “workbench”, “manager”, “service”, “runtime”, or “handler” class must not own multiple domains.

### 禁止

FORBIDDEN:
- 60-member god-object threshold as active baseline.
- A class managing mission readiness, logs, AI debug, Forensics, human commands, candidate review, and runtime wiring together.
- Hiding multiple objects inside one class through private helper methods.
- Adding members to a class already over its hard limit.
- Treating constructor dependency explosion as acceptable wiring.

---

## Law GRASSEYE-CODE-PURITY-005-V1

status: active  
tier: P0  
capabilityDomain: audit-system  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: owner boundaries must be counted at real capability-owner granularity.

### 主题

真实 owner 边界与混装禁止

### 法条

GrassEye owner-boundary analysis must use real capability and governance owner boundaries, not broad directory buckets.

Required direction:
- `src/capabilities/ai` is owner `ai`.
- `src/capabilities/orchestration` is owner `orchestration`.
- `src/capabilities/nerve-bus` is owner `nerve-bus`.
- `src/capabilities/open` is owner `open`.
- `src/capabilities/screenshot` is owner `screenshot`.
- `src/capabilities/visual-target` is owner `visual-target`.
- `src/capabilities/geometry-guard` is owner `geometry-guard`.
- `src/capabilities/mouse-click` is owner `mouse-click`.
- `src/capabilities/text-input` is owner `text-input`.
- `src/capabilities/mouse-scroll` is owner `mouse-scroll`.
- `src/capabilities/post-action-verification` is owner `post-action-verification`.
- `src/capabilities/forensics-persistence` is owner `forensics-persistence`.
- `src/capabilities/page-state` is owner `page-state`.
- `src/capabilities/commander-console` is owner `commander-console`.
- `scripts/audit/domains/code-purity` is owner `code-purity`.
- `scripts/audit/domains/*` must be treated as separate audit-domain owners when crossing domain boundaries.
- A file must not cross more than 3 owner boundaries.
- A file must not use more than 2 cross-owner imports.
- Owner-mixing must be remediated by ports, contracts, adapters, read models, or composition roots.

### 禁止

FORBIDDEN:
- Treating `src/capabilities` as one owner.
- Treating `src/features` as one owner.
- Treating `src/lib` as one owner when runtime domains are mixed.
- 8-owner-boundary threshold as active baseline.
- Hiding owner mixing inside neutral files such as `utils`, `helpers`, `runtime`, `manager`, or `workbench`.
- Moving domain-private helpers into `src/lib` without two real cross-domain call sites.

---

## Law GRASSEYE-CODE-PURITY-006-V1

status: active  
tier: P0  
capabilityDomain: audit-system  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: imports and exports must not create hidden broad ownership or barrel laundering.

### 主题

Import / Export 纯洁度

### 法条

GrassEye import/export structure must preserve narrow ownership and prevent hidden broad coupling.

Required direction:
- Import declarations must not exceed 15.
- Import sources must not exceed 12.
- Exports must not exceed 8.
- Cross-owner imports must not exceed 2.
- Barrel exports must be narrowly governed.
- Public exports must reflect a deliberate contract.
- Shared helpers must prove real cross-domain reuse before entering shared scope.

### 禁止

FORBIDDEN:
- `export *`.
- Broad barrel export laundering.
- Importing many owners into one active runtime file.
- Creating central files that re-export unrelated owners.
- Using `index.ts` to hide owner mixing.
- Default export unless explicitly governed by a domain law.

---

## Law GRASSEYE-CODE-PURITY-007-V1

status: active  
tier: P0  
capabilityDomain: audit-system  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: files must have one role and must not mix schema, runtime, validation, execution, persistence, and decision responsibilities.

### 主题

单文件角色纯洁度

### 法条

Each active source file must have one primary role.

Allowed narrow roles include:
- schema
- contract
- input-gate
- policy-gate
- executor
- runner
- adapter
- result-builder
- proof-builder
- read-model
- writer
- validator
- inspector
- manifest
- index
- type-only

Required direction:
- Schema files must not execute runtime logic.
- Runtime files must not define broad schemas.
- Validators must not execute actions.
- Executors must not validate map schemas.
- API handlers must not own business logic.
- Forensics writers must not make business decisions.
- AI prompt files must not execute browser actions.
- Orchestration files must not execute primitives.
- Nerve Bus files must not make business decisions.

### 禁止

FORBIDDEN:
- schema + runtime in one file.
- validator + executor in one file.
- API handler + business workflow + persistence in one file.
- AI prompt + action execution in one file.
- map validation + prompt generation + activation in one file.
- storage writer + decision logic in one file.
- Orchestration + primitive action in one file.

---

## Law GRASSEYE-CODE-PURITY-008-V1

status: active  
tier: P0  
capabilityDomain: audit-system  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: dead code, fake runtime paths, mocks, placeholders, and temporary bypasses must not survive in active source truth.

### 主题

死代码、调试残留与临时绕路清理

### 法条

GrassEye source truth must stay clean and must not preserve abandoned implementation paths inside active code.

Required direction:
- Dead code must be deleted rather than preserved.
- Commented-out implementation code must be deleted.
- Temporary debug logs must be removed or routed through a governed logging boundary.
- TODO comments are allowed only when they include owner, reason, and target phase or removal condition.
- Deprecated paths must be physically removed unless explicitly archived outside active source truth.
- Mock, fake, placeholder, or fixture execution must not be presented as real runtime behavior.
- Old deleted-owner paths must be physically removed from active source truth rather than hidden behind neutral naming.

### 禁止

FORBIDDEN:
- Commented-out old implementations.
- console.log debug scatter in governed runtime paths.
- TODO comments without owner and removal condition.
- FIXME later as permanent source truth.
- Temporary bypasses that survive phase acceptance.
- Fake PASS.
- Fake AI result.
- Fake storage result.
- Fake platform action result.
- Fake runtime success.
- Placeholder execution in production path.
- Mock objects used as real runtime dependencies.

---

## Law GRASSEYE-CODE-PURITY-009-V1

status: active  
tier: P0  
capabilityDomain: audit-system  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: refactors must reduce ownership, file size, complexity, and active paths rather than adding compatibility bridges.

### 主题

重构方向与兼容桥接禁止

### 法条

GrassEye refactors must simplify ownership and remove obsolete routes.

Required direction:
- Refactors must reduce file size.
- Refactors must reduce owner mixing.
- Refactors must reduce complexity.
- Refactors must remove obsolete paths.
- Extraction must produce narrow files with clear owner boundaries.
- Physical deletion is preferred over compatibility bridges when a path is no longer part of the approved route.
- Shared helpers must prove cross-domain reuse before entering `src/lib`.
- Domain-private helpers must stay inside the owning domain.
- Refactor reports must state which files were split, deleted, simplified, or left as debt.

### 禁止

FORBIDDEN:
- Adding adapters only to preserve obsolete architecture.
- Keeping old path and new path both active.
- Creating bridge files that hide unresolved ownership conflict.
- Moving messy code into `src/lib` to make feature files look clean.
- Creating abstraction layers before two real call sites prove the need.
- Refactoring by renaming only while preserving the same mixed responsibility.
- Adding compatibility shims that become permanent source truth.

---

## Law GRASSEYE-CODE-PURITY-010-V1

status: active  
tier: P0  
capabilityDomain: audit-system  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: disaster files must be identified, blocked, and physically split before meaningful feature debugging continues.

### 主题

灾难文件与物理切割队列

### 法条

A disaster file is any active production implementation file that satisfies one or more of the following:
- More than 800 lines.
- Class total members greater than 24.
- Owner boundaries greater than 3.
- Cross-owner imports greater than 2.
- Touched file above its hard limit.
- Mixed runtime roles that hide multiple owners.
- Known blocker for audit, AI-assisted edits, or runtime debugging.

Required direction:
- Disaster files must produce blocking findings with file, lawId, minimal reason, and split direction.
- A small owner-local support inventory may be emitted only when a disaster file exists.
- Disaster files must not receive new feature logic.
- Feature debugging after disaster-file discovery must not proceed until the impacted path is split or explicitly blocked.

### 禁止

FORBIDDEN:
- Treating disaster files as historical exceptions.
- Continuing feature work inside disaster files.
- Lowering thresholds to make disaster files pass.
- Hiding disaster files under generated or shared classification.
- Calling the system ready while known disaster files block the active runtime path.

---

## Law GRASSEYE-CODE-PURITY-011-V1

status: active  
tier: P0  
capabilityDomain: audit-system  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: all active code-purity laws must be enforced by CI-FULL, generated audit artifacts, and real-code-inspection.

### 主题

All Active Code Purity Laws Real Enforcement

### 法条

Every active code-purity law must be represented in real enforcement.

Required direction:
- Every active code-purity law must have inspector coverage.
- Every P0/P1 code-purity law must have real-code-inspection.
- Code-purity must run as a mandatory CI-FULL foundation step.
- Generated audit artifacts may include code-purity coverage support evidence, but they must not replace inspector verdicts.
- CI-FULL summary must record the code-purity step result with minimal PASS/FAIL and blocking context.
- Real-code-inspection must inspect current src/** and scripts/** source truth.
- Audit-system must fail if code-purity enforcement is removed, bypassed, warning-only, or disconnected.

### 禁止

FORBIDDEN:
- Active law without inspector.
- Code-purity disconnected from CI-FULL.
- CI-FULL without real-code-inspection for P0/P1 purity law.
- Inspection harness that does not inspect current real code.
- Generated fake PASS.
- Manual-only claims as enforcement.
- Warning-only purity findings for P0 violations.
- Writing stricter documents without stricter enforcement.
- Writing stricter enforcement without updating law and blueprint truth.

---

## Law GRASSEYE-CODE-PURITY-012-V1

status: active  
tier: P0  
capabilityDomain: audit-system  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: type-safety and escape hatches must not be used to bypass purity enforcement.

### 主题

类型逃逸与反逃逸

### 法条

Code purity enforcement must detect and block type escapes, alias laundering, and wrapper hiding.

Required direction:
- `as any` must fail.
- `as unknown as` must fail.
- `@ts-ignore` must fail.
- `@ts-expect-error` must fail unless explicitly governed by a dedicated type-safety exception law and real-code-inspection.
- `eslint-disable` must fail unless explicitly governed by a dedicated audit exception law and real-code-inspection.
- Inspectors must use AST / symbol / type analysis, not text matching as final judgment.
- Alias laundering, re-export laundering, barrel laundering, and wrapper hiding must be inspected.

### 禁止

FORBIDDEN:
- `as any`.
- `as unknown as`.
- `@ts-ignore`.
- Unreviewed `@ts-expect-error`.
- `eslint-disable`.
- Inspector using grep / regex / includes / match / split as final structural judgment.
- Hiding forbidden calls behind wrappers.
- Hiding broad owners behind barrels.
- Hiding god-file responsibilities behind neutral naming.

---

## Law GRASSEYE-CODE-PURITY-013-V1

status: active  
tier: P0  
capabilityDomain: audit-system  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: code-purity enforcement must produce blocking findings first and emit only minimal violation-driven support artifacts.

### 主题

阻断 finding 优先，support evidence 从属

### 法条

Code-purity enforcement must not merely fail. It must produce blocking findings that point directly to action.

Required output:
- Blocking finding with file.
- Blocking finding with lawId.
- Minimal reason.
- Concrete fix direction.
- Small owner-local support inventory only when violations exist or a targeted local audit explicitly asks for it.

If a support inventory is emitted, each item must include:
- file
- minimal violation type
- owner-local scope
- concrete fix direction

Severity levels:
- BLOCKING
- DISASTER

### 禁止

FORBIDDEN:
- failing without a blocking finding.
- default big inventory emission on PASS.
- inventory without a concrete fix direction.
- descriptive report output that does not drive a blocking decision.
- Marking known god files as harmless.
- Hiding god files as legacy history.

---

## Law GRASSEYE-CODE-PURITY-014-V1

status: active  
tier: P0  
capabilityDomain: audit-system  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: code-purity remediation must use physical deletion and physical splitting, not cosmetic renaming.

### 主题

物理删除与物理切割

### 法条

GrassEye code-purity remediation must physically remove or split problematic code.

Required direction:
- Dead code must be deleted.
- Obsolete paths must be deleted.
- Oversized files must be split into smaller files by role and owner.
- Mixed-owner files must be split into owner-local modules.
- God classes must be split into narrow collaborators.
- God functions must be split into parser, gate, decision, executor, result builder, and proof builder.
- Refactor reports must name every file split, deleted, and simplified.

### 禁止

FORBIDDEN:
- Cosmetic renaming.
- Moving code without reducing responsibility.
- Moving code into `src/lib` without proven reuse.
- Creating bridge modules that preserve old and new routes.
- Leaving old path and new path both active.
- Wrapper files that hide the same mixed responsibility.
- “Facade” files that become new god files.

---

## Law GRASSEYE-RETIRED-AUTHORITY-NO-REGRESSION-V1

status: active
tier: P0
capabilityDomain: audit-system
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: active source truth must not contain retired authority vocabulary as positive runtime shapes.

### 主题

旧主权词不得以正向形态回归

### 法条

Active source files must not contain retired authority vocabulary presented as positive runtime shapes, required schema fields, or active governance truth.

Required direction:
- Retired authority token fragments may appear only inside negative/forbidden checks, comments marking them as retired, or audit regression tests that assert they are absent.
- A single simple scan using AST-backed identifier inspection must detect known retired token fragments and treat any active positive usage as a blocking finding.
- Blocking output must name file, retired token, and concrete removal direction.
- No inventory or report is emitted on PASS.

Retired authority token fragments (use as negative detection targets only):
- `routePlan`, `route_plan`, `branch_token`, `branchToken`
- `mapId`, `mapTemplateId`, `templateActivation`, `mapBinding`, `mapLifecycle`
- `taskTemplate`, `templateSelector`, `legacyTemplate`
- `packageChain`, `packageGovernance`, `semanticPackage`, `workflowPackage`
- `candidateDisposition`, `candidateApprove`, `candidateReject`, `candidateContinuation`
- `productPresenceJudgment`, `product_presence_judgment`
- `commentSignalSummary`, `comment_signal_summary`
- `productSignalSummary`, `product_signal_summary`
- `evidencePacketAnalysis`, `evidence_packet_analysis`
- `universalMandatoryPAV`, `mandatory_pav`, `globalPAV`

### 禁止

FORBIDDEN:
- Retired token fragments appearing as required schema field names in active production types.
- Retired token fragments appearing as required enum values in active production schemas.
- Retired token fragments appearing as active positive method names or property names in production runtime.
- Creating new file paths, classes, or module exports that use retired token names as their primary identifier.
- Treating retired governance vocabulary as transitional residue that can remain indefinitely.

---

## Module Boundary Declaration

This law file governs:
- File-size thresholds.
- Function-shape thresholds.
- Class/object thresholds.
- Owner-boundary purity.
- Import/export limits.
- Dead code removal.
- Fake/mock production leakage.
- Compatibility-bridge red lines.
- Refactor boundaries.
- Touched-file rule.
- Disaster-file rule.
- Minimal violation-driven support evidence.
- All active code-purity law enforcement.

This law file does not govern:
- Which runtime actions are allowed.
- Which AI model is selected.
- How product signals are scored.
- How evidence is retained or exported.
- Business-specific runtime decisions.

However:
- Any runtime action, AI selection, product scoring, or evidence path implemented in active source truth must still obey this module’s file, function, class, owner, import/export, and anti-escape requirements.

---

## Required Enforcement

The audit-system must enforce this module using AST / symbol / type-aware inspection.

Required enforcement dimensions:
- Source file line count.
- Function line count.
- Function statement count.
- Function parameter count.
- Function complexity.
- Nesting depth.
- Class method count.
- Class field count.
- Class total members.
- Constructor parameter count.
- Import declaration count.
- Import source count.
- Cross-owner import count.
- Owner-boundary count.
- Export count.
- Forbidden `export *`.
- Forbidden `as any`.
- Forbidden `as unknown as`.
- Forbidden directives.
- Forbidden `require`.
- Forbidden unmanaged dynamic import.
- Role mixing.
- Dead code.
- Fake success.
- Mock/fake/placeholder production leakage.
- Compatibility bridges.
- Oversized touched files.
- Disaster files.
- Minimal violation output.
- Real-code-inspection.

Forbidden enforcement shortcuts:
- grep as final judgment.
- regex as final judgment.
- string includes as final judgment.
- warning-only P0 findings.
- manual-only proof.
- generated fake PASS.
- detached inspector.
- empty inspection harness.

---

## Required Real-Code Inspection

The code-purity audit domain must prove the following owner-inspection regressions:

- Reject any attempt to restore the 2000-line active source baseline.
- Reject any attempt to restore the 60-member class baseline.
- Reject any attempt to restore the 8-owner-boundary baseline.
- Reject collapsing `src/capabilities` into one owner bucket.
- Reject removal of the touched-file rule.
- Reject removal of the disaster-file rule.
- Reject removal of the active-law enforcement rule.
- Reject a 301-line touched production file.
- Reject a 41-line function.
- Reject a class with 25 members.
- Reject cross-owner imports above 2.
- Reject `export *`.
- Reject `as any`.
- Reject `as unknown as`.
- Reject `@ts-ignore`.
- Reject `eslint-disable`.
- Reject fake success.
- Reject no-op success.
- Reject removal of owner-inspection invocation.
- Reject warning-only inspector mode.

No code-purity audit result is valid unless real-code-inspection is executed and reported.

---

## Final Readiness Gate

Code Purity Phase 3.5 is READY only when all conditions are true:

- This law file, the code-purity blueprint, audit scripts, and runner output agree; generated artifacts remain subordinate support evidence when present.
- Weak 2000 / 60 / 8 thresholds are removed as active governance baselines.
- 300 / 40 / 24 / 3 final limits are enforced.
- Owner-boundary mapping uses real capability owner granularity.
- Code-purity inspector executes in runner.
- Audit-system proves active-law enforcement coverage.
- Real-code-inspection executes and reports owner-code regressions.
- PASS output stays short and FAIL output stays actionable.
- Inventories are emitted only when violations exist or targeted audit mode asks for them.
- Existing oversized files are not treated as historical exemptions.
- Touched oversized files are not allowed to grow.
- No feature debugging proceeds through a known disaster file without physical split or explicit BLOCKED result.
