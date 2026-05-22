---
name: "GrassEye Code Purity Governance"
description: "GrassEye 代码纯洁度法案：以 99/100 严苛度管理 job-flow 自动化系统的文件尺寸、职责边界、owner 归属、类型安全、证据真实性、审计可信度，以及僵尸代码/文件/段落的零容忍删除。"
applyTo: "src/**/*.{ts,tsx,js,jsx,mjs,json},scripts/**/*.{ts,js,mjs,json},package.json,.github/instructions/agent-rules/**/*.md"
---

# GrassEye Code Purity Governance

status: active
version: 2026-05-21
strictness: 99/100
capabilityDomain: code-purity

## 0. Identity / 身份

GrassEye is a job-oriented automation execution system, not a website, not a universal agent, and not a general workflow engine.

This law governs active source truth for:

- `src/app/**`
- `src/mediator/**`
- `src/plugins/**`
- `src/capabilities/**`
- `src/lib/**`
- `src/types/**`
- `scripts/startup/**`
- `scripts/acceptance/**`
- `scripts/audit/**`
- `package.json`
- active GrassEye law files

This law does not govern visual design taste, website storefront routes, Shopify truth, React Server Components, CSS modules, or Next.js route performance unless a future architecture law explicitly turns GrassEye into a website system.

## 1. Core Doctrine

Code purity is not style. Code purity is the structural condition that lets GrassEye stay editable after many Codex turns.

The doctrine:

- No god files.
- No god functions.
- No zombie files.
- No zombie exports.
- No orphan top-level declarations.
- No literal-dead code branches kept in active source.
- No hidden second system.
- No compatibility bridge.
- No legacy dual path.
- No fake success.
- No mock, demo, placeholder, fixture, or no-op production path.
- No business workflow hidden inside `src/lib`.
- No ability group polluted by job-specific business flow.
- No mediator that secretly executes actions.
- No child ability that secretly becomes a workflow.
- No audit fake pass.
- No generated artifact as hand-written truth.
- No type escape to silence the compiler.
- No broad helper, service, manager, facade, bridge, common, shared, or utils bucket unless its owner and two lawful call sites are proven.

One sentence:

```txt
Every active file must prove its owner, its role, and why it exists.
```

## 2. Strictness Model

This law is intentionally near-maximal.

### P0 blocking

P0 rules block completion and CI readiness. They cover structures that rot the system quickly:

- architecture bypass
- owner boundary violation
- fake runtime success
- type escape
- zombie file / export / declaration / dead branch
- touched disaster growth
- bridge / compatibility / legacy dual truth
- audit fake pass
- generated artifact manual truth

### P1 required remediation

P1 is a remediation-priority label inside a FAIL result. It is not a third runtime verdict.

- oversized but not disaster files
- over-complex functions
- single-caller helper files
- broad import surfaces
- unclear role files
- incomplete inventory

### P2 advisory hygiene

P2 is planning prose only. It must not appear as a runtime verdict tier, warning grade, or executable PASS-with-caveat state.

- naming polish
- small extraction suggestions
- non-critical duplicated comments
- future split opportunities

Codex must not downgrade P0 to P1 by calling it "legacy", "temporary", "small change", "later", or "only for CI".

## 3. File Size Budget

Line count is not the only purity signal, but it is a hard binary enforcement fence once a clause is wired into the executable inspector.

| File category | Target | Hard limit | Disaster |
|---|---:|---:|---:|
| Job flow file `src/plugins/<job-id>/*.flow.ts` | 180 | 280 | 420 |
| Job step / support file | 150 | 240 | 360 |
| Job schema / result / type file | 220 | 360 | 520 |
| Mediator route file | 100 | 160 | 240 |
| Ability group public facade | 120 | 200 | 300 |
| Child ability runtime file | 140 | 240 | 360 |
| Browser / DOM runtime primitive | 170 | 300 | 450 |
| Evidence / runtime log file | 150 | 260 | 400 |
| Local app shell file | 140 | 240 | 360 |
| `src/lib` infrastructure file | 150 | 260 | 400 |
| Script / startup file | 170 | 280 | 420 |
| Acceptance smoke file | 180 | 320 | 480 |
| Audit owner inspector | 180 | 320 | 480 |
| Audit helper / phase file | 140 | 240 | 360 |
| JSON config / generated summary | 300 | 600 | 900 |
| Law file | 600 | 1200 | 1800 |

Required:

- New files should target the target budget.
- Touched files must not cross the hard limit.
- Touched files already over the hard limit must not receive new logic unless the same task reduces or splits them.
- Disaster files must not receive feature logic.
- A disaster file on the current task path blocks completion unless the user explicitly authorizes a narrow emergency exception.

Allowed exception:

- A law file may exceed normal source limits because it is the written authority, but it must stay structured, parseable, and domain-specific.

## 4. Function / Object Budget

| Function metric | Target | Hard limit |
|---|---:|---:|
| Physical lines | 24 | 40 |
| Parameters | 3 | 5 |
| Return branches | 3 | 5 |
| Nesting depth | 2 | 4 |
| Cyclomatic complexity | 6 | 10 |
| Await points | 4 | 7 |
| Direct side-effect calls | 3 | 6 |

| Object / class metric | Target | Hard limit |
|---|---:|---:|
| Fields | 8 | 14 |
| Methods | 8 | 14 |
| Total members | 14 | 24 |
| Constructor parameters | 4 | 6 |

Required:

- Parsing, validation, policy decision, execution, evidence writing, logging, and result building must be separable.
- Long action pipelines must be split by real runtime role, not by cosmetic wrapper.
- Error mapping must be explicit at public boundaries.

Forbidden:

- Catch-and-swallow.
- `return null` as success.
- Naked throw escaping public mediator, app-shell, job-flow, or runtime boundaries.
- Adding new branches to an already over-limit function.

## 5. Import / Export Budget

| Import / export metric | Target | Hard limit |
|---|---:|---:|
| Import declarations | 10 | 16 |
| Import sources | 8 | 14 |
| Cross-owner imports | 2 | 4 |
| Named exports | 6 | 10 |

Absolute bans:

- `export *`
- `require` in active source
- dynamic import without an owner-local reason
- barrel laundering that hides private imports
- importing private runtime internals across owners
- default export unless a tool or framework requires it

Allowed:

- Narrow `index.ts` files that explicitly export public contracts.
- Type-only exports that preserve owner boundaries.

## 6. Owner Model

GrassEye owner boundaries are:

- `src/app/**` owns local app shell only.
- `src/mediator/**` owns user-demand routing only.
- `src/plugins/<job-id>/**` owns one explicit business job flow.
- `src/capabilities/<ability-group-id>/**` owns one same-kind reusable ability group.
- `src/capabilities/<ability-group-id>/runtime/**` owns child ability implementation.
- `src/lib/browser/**` owns browser primitives and local session foundation.
- `src/lib/storage/**` owns low-level storage.
- `src/lib/runtime-logs/**` owns structured runtime logging.
- `src/lib/local-runtime/**` owns local assembly and workbench support.
- `src/lib/online-ai/**` owns external AI transport only.
- `src/types/**` owns shared type contracts only.
- `scripts/startup/**` owns startup.
- `scripts/acceptance/**` owns acceptance proof.
- `scripts/audit/**` owns inspection.

Forbidden:

- Treating `src/lib` as owner-neutral.
- Treating `src/plugins` as one owner.
- Treating `src/capabilities` as one owner.
- Hiding owner mixing behind `utils`, `helpers`, `common`, `shared`, `service`, `manager`, `facade`, `bridge`, or `adapter`.
- A capability importing a plugin.
- A mediator importing browser click, fill, upload, DOM runtime, or private child ability files.
- A child ability importing unrelated ability groups.

## 7. Law APEX-CODE-PURITY-001-V1 — Source Atomicity

```apex-law
{
  "lawId": "APEX-CODE-PURITY-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "fs+ast",
  "summary": "Active source files must remain owner-clear, role-clear, and small enough for safe Codex iteration."
}
```

Every active source file must have one primary owner and one primary role.

Required:

- A file name must reveal its role.
- A file must belong to the architecture chain.
- A file must not exist only to forward calls.
- A file must not mix business flow, runtime primitive, evidence persistence, logging, and audit logic.
- Existing oversized files must enter inventory.

Forbidden:

- God files.
- Single file owning multiple systems.
- Cosmetic split that keeps the same mixed responsibility.
- Moving mess into `src/lib` or `src/types`.

## 8. Law APEX-CODE-PURITY-002-V1 — Touched File Rule

```apex-law
{
  "lawId": "APEX-CODE-PURITY-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "fs+ast",
  "summary": "Touched files must not get dirtier and must not cross hard purity limits."
}
```

Required:

- If a touched file is under target, keep it under target when reasonable.
- If a touched file is between target and hard limit, new logic must be narrow and justified.
- If a touched file is over hard limit, split or reduce it before adding logic.
- If a touched file is disaster-level, block or physically split.

Forbidden:

- "One small patch" on a dirty file.
- "Legacy later."
- "Temporary until CI passes."
- Adding logic to a touched disaster file.

## 9. Law APEX-CODE-PURITY-003-V1 — Role Purity

```apex-law
{
  "lawId": "APEX-CODE-PURITY-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "ast",
  "summary": "Files must not mix incompatible GrassEye runtime roles."
}
```

Allowed narrow roles:

- mediator-route
- job-flow
- job-step
- job-schema
- job-result
- job-hints
- ability-group
- child-ability
- runtime-primitive
- browser-primitive
- evidence-writer
- log-writer
- storage-adapter
- app-shell
- startup-script
- acceptance-smoke
- audit-inspector
- audit-phase
- type-contract
- law-file

Forbidden mixes:

- mediator + runtime action
- job-flow + browser primitive implementation
- ability-group + job-specific business decision
- child-ability + multi-step business workflow
- evidence writer + business success decision
- audit inspector + generated artifact mutation
- startup script + business flow
- schema/type file + runtime execution

## 10. Law APEX-CODE-PURITY-004-V1 — Job Flow Purity

```apex-law
{
  "lawId": "APEX-CODE-PURITY-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "fs+ast",
  "summary": "Each job flow must own one business demand and must not become a generic workflow engine."
}
```

Required:

- One mature user demand maps to one explicit `src/plugins/<job-id>` flow.
- Flow owns step order, business state, review-required decision, failure decision, and final result.
- Flow calls ability public APIs only from root facades, not non-facade ability files or private runtime internals.
- Flow writes or requests evidence through lawful evidence/log APIs.

Forbidden:

- Flow for multiple unrelated jobs.
- Generic planner.
- Runtime next-action engine.
- AI-generated step list.
- Cross-job shared workflow engine.
- Importing unrelated plugin owner code.
- Importing non-facade ability source files.
- Copying child ability implementation into the flow.

## 11. Law APEX-CODE-PURITY-005-V1 — Mediator Purity

```apex-law
{
  "lawId": "APEX-CODE-PURITY-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "ast",
  "summary": "The mediator may route user demands but must not execute business steps or browser actions."
}
```

The mediator may only:

- receive user demand
- identify job type
- validate input schema
- call the matching job flow
- return job result

Forbidden:

- Direct click, fill, upload, DOM read, screenshot, or browser primitive call.
- Amazon-specific or Facebook-specific step logic.
- Business state persistence.
- Workflow engine behavior.
- Dispatcher resurrection under a neutral name.

## 12. Law APEX-CODE-PURITY-006-V1 — Ability Group Purity

```apex-law
{
  "lawId": "APEX-CODE-PURITY-006-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "fs+ast",
  "summary": "Ability groups must own same-kind reusable actions and must not absorb business workflow."
}
```

Required:

- Ability group APIs must be public, typed, and narrow.
- Runtime children must perform same-kind actions.
- Results must be structured action results, not business final results.

Forbidden:

- Importing `src/plugins/**`.
- Importing unrelated capability owners.
- Deciding Amazon upload success.
- Deciding whether a product video is valuable.
- Calling unrelated ability groups as hidden orchestration.
- Becoming a small job flow.

## 13. Law APEX-CODE-PURITY-007-V1 — Child Ability Atomicity

```apex-law
{
  "lawId": "APEX-CODE-PURITY-007-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "ast",
  "summary": "Child abilities must remain atomic and must not hide multi-step business workflow."
}
```

Required:

- One child ability performs one atomic action.
- It returns structured action evidence or failure reason.
- It does not choose the next business step.

Forbidden:

- Full Amazon upload inside one child ability.
- Full browser mission loop.
- Multi-job behavior.
- Hidden planner.
- Sensitive final action without flow-owned decision.

## 14. Law APEX-CODE-PURITY-008-V1 — Type Escape Ban

```apex-law
{
  "lawId": "APEX-CODE-PURITY-008-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "ast+typecheck",
  "summary": "Type escapes must not bypass GrassEye contracts, schemas, or runtime safety."
}
```

Forbidden:

- `any`
- `as any`
- `as unknown as`
- unvalidated JSON at public boundaries
- `@ts-ignore`
- ungoverned `@ts-expect-error`
- ungoverned `eslint-disable`
- alias laundering to hide forbidden calls

Required:

- External input must be schema-validated.
- `unknown` must be narrowed through a schema or guard.
- Public result types must model success, failure, and review-required states.

## 15. Law APEX-CODE-PURITY-009-V1 — Fake Runtime Ban

```apex-law
{
  "lawId": "APEX-CODE-PURITY-009-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "fs+ast",
  "summary": "Fake, mock, placeholder, no-op, demo, and fallback runtime paths must not survive in active source truth."
}
```

Forbidden in active runtime paths:

- fake success
- no-op success
- fallback success
- mock production result
- placeholder business result
- demo execution branch
- commented-out old implementation
- compatibility branch preserving retired behavior
- debug logs scattered outside governed runtime logging

Allowed only in explicitly named test or archive contexts:

- fixture data
- local scratch notes
- deleted migration notes
- forbidden-regression examples

## 16. Law APEX-CODE-PURITY-010-V1 — Bridge / Legacy Ban

```apex-law
{
  "lawId": "APEX-CODE-PURITY-010-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "fs+ast",
  "summary": "Bridge, compatibility, legacy, shadow, and dual-truth structures are forbidden unless an active law explicitly authorizes them."
}
```

Forbidden active architecture names and behaviors:

- `bridge`
- `compatibility`
- `legacy`
- `v1-v2-dual`
- `shadow`
- `fallback`
- `universal-agent`
- `planner`
- `nextAction`
- `actionPlan`
- `mission-loop`
- `nerve-bus`
- `commander-console`

These terms may appear only in law text, migration notes, archive notes, deletion reports, or forbidden-regression checks.

## 17. Law APEX-CODE-PURITY-011-V1 — Shared Scope Discipline

```apex-law
{
  "lawId": "APEX-CODE-PURITY-011-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "fs+ast",
  "summary": "Shared files must prove infrastructure ownership and must not become dumping grounds."
}
```

Required:

- `src/lib/**` must be infrastructure only.
- Shared helpers must have at least two lawful real call sites or a clear public boundary role.
- Shared contracts must not import runtime implementations.
- `src/types/**` must remain type-only.

Forbidden:

- Business workflow in `src/lib`.
- Job-specific decisions in shared helpers.
- Ability implementation in `src/lib`.
- Shared file importing capability-owned source.
- Helper created merely to avoid splitting the correct owner file.
- Shared file importing plugins.

## 18. Law APEX-CODE-PURITY-012-V1 — Evidence / Log Truth

```apex-law
{
  "lawId": "APEX-CODE-PURITY-012-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "fs+ast",
  "summary": "Evidence, logs, and result records must be truthful and must not be forged to satisfy acceptance."
}
```

Required:

- Runtime evidence must correspond to a real attempted action.
- Failure reasons must be explicit and structured.
- Review-required results must not be coerced into success.
- Logs must use governed structured logging and redaction.

Forbidden:

- Writing success evidence before the action succeeds.
- Reusing stale screenshot or DOM references as fresh proof.
- Swallowing failure and returning success.
- Fabricating acceptance evidence.
- Logging secrets, cookies, tokens, file contents, or private screenshots without redaction.

## 19. Law APEX-CODE-PURITY-013-V1 — Audit Truth

```apex-law
{
  "lawId": "APEX-CODE-PURITY-013-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "Code-purity enforcement must be real, runner-visible, and unable to fake PASS."
}
```

Required:

- Code-purity inspector must be owned by the code-purity domain when implemented.
- Runner participation must be visible before a code-purity PASS is claimed.
- Executable code-purity verdicts must be binary: `PASS` or `FAIL` only.
- Any emitted executable finding must block PASS.
- Generated audit artifacts must be reproducible.
- Generated artifacts must not be manually edited.
- TypeScript-facing checks must use ts-morph AST, symbol resolution, or explicit anti-evasion guards as the primary judgment path.

Forbidden:

- Fake generated PASS.
- Warning-only P0.
- `warning`, `advisory`, `partial-pass`, or `pass-with-findings` as executable code-purity verdicts.
- Detached inspector.
- Runner-owned manual law binding truth.
- Inspector mutating source to pass itself.
- Regex as final structural judgment for TypeScript owner or import rules.

Allowed phased enforcement:

- New clause coverage may be wired incrementally, but every active executable check must still produce only PASS or FAIL.
- Missing future coverage must not be disguised as warning-grade PASS.

## 20. Law APEX-CODE-PURITY-014-V1 — Generated Artifact Truth

```apex-law
{
  "lawId": "APEX-CODE-PURITY-014-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "fs",
  "summary": "Generated artifacts are evidence outputs, not hand-written source truth."
}
```

Generated artifacts:

- Must be marked or located as generated.
- Must be reproducible from source laws, manifests, or inspectors.
- Must not contain active runtime logic.
- Must not be hand-edited to satisfy CI.
- Must not hide an owner boundary violation.

## 21. Law APEX-CODE-PURITY-015-V1 — Inventory / Remediation

```apex-law
{
  "lawId": "APEX-CODE-PURITY-015-V1",
  "status": "active",
  "tier": "P1",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "fs+ast",
  "summary": "Code-purity enforcement should produce actionable inventories and split recommendations without pretending every inventory item is a P0 blocker."
}
```

Required inventory when inspector maturity allows:

- oversized files
- disaster files
- touched oversized files
- over-limit functions
- owner boundary violations
- fake runtime surfaces
- bridge / legacy surfaces
- shared-scope risks
- audit truth risks
- first recommended split

Inventory items must include:

- file
- owner
- role
- reason
- recommended remediation
- verification command

Runtime rule:

- If an executable code-purity report emits an inventory item, the verdict is `FAIL`.
- Inventory text may explain remediation ordering, but must not create a third runtime state.

Forbidden:

- Vague failure without file path.
- Inventory without remediation.
- Downgrading proven P0 to inventory-only.
- Executable severities such as `warning`, `advisory`, `remediation-only`, or `pass-with-findings`.

## 22. Law APEX-CODE-PURITY-016-V1 — Physical Remediation

```apex-law
{
  "lawId": "APEX-CODE-PURITY-016-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "Purity remediation must simplify the real structure, not hide the same mess behind another file."
}
```

Allowed remediation:

- DELETE
- DELETE_AND_REWRITE
- PHYSICAL_SPLIT
- OWNER_LOCAL_EXTRACTION
- RUNTIME_ROLE_SPLIT
- FLOW_STEP_SPLIT
- CHILD_ABILITY_SPLIT
- AUDIT_PHASE_SPLIT

Forbidden remediation:

- Cosmetic rename.
- Wrapper hiding.
- Facade hiding.
- Bridge retaining old path.
- Keeping old and new paths active.
- Moving mess into `src/lib`.
- Moving forbidden logic into `index.ts`.
- Commenting code out instead of deleting it.
- Lowering thresholds to pass.

## 23. Law APEX-CODE-PURITY-017-V1 — Zombie Surface Zero Tolerance

```apex-law
{
  "lawId": "APEX-CODE-PURITY-017-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "fs+ast+import-graph",
  "summary": "Active source must not keep zombie files, zombie exports, orphan top-level declarations, or literal-dead code branches."
}
```

Zombie surface means active code that cannot prove reachability from a lawful live entry surface, a live consumer, or a live branch.

Executable maturity must fail when it finds:

- a file that is not reachable from a lawful live entry surface
- an export with no active importer or lawful namespace consumer from the reachable live graph
- a non-exported top-level declaration with no live identifier usage
- a literal-dead `if` / `else` / ternary / loop branch
- a zombie-to-zombie import or re-export chain that is falsely treated as proof of life
- a public boundary, contract, schema, index file, or type-contract treated as automatically live by file category
- dormant code kept as "maybe later", "temporary backup", or hard-coded false branch cargo

Allowed exemptions:

- package-script entry files declared in `package.json`
- generated-plan loaded owner inspectors and only their dynamic export contract
- exports consumed through lawful namespace import from a reachable importer
- external entry files explicitly owned by current runtime law

Public boundary files, `index.ts`, `contract.ts`, `schema.ts`, and type-contract files are not blanket exemptions.

Forbidden:

- keeping dormant code for confidence
- parking code behind hard-coded `false` or unreachable alternate branch
- preserving unused exports "for later"
- keeping orphan top-level declarations inside active runtime files
- treating an inbound edge from an unreachable zombie file as proof of life
- claiming zombie cleanup may wait until after CI turns green

## 24. Enforcement Roadmap

The code-purity inspector should mature in phases.

### Phase 1 P0 guard

Must catch:

- forbidden roots and retired architecture terms
- `any`, `as any`, `as unknown as`, `@ts-ignore`
- `export *`
- bridge / compatibility / legacy active paths
- fake / mock / placeholder / no-op success language in active runtime
- touched disaster file growth
- capability importing plugins
- mediator importing runtime primitives
- generated artifact manual truth indicators

### Phase 2 structural guard

Must catch:

- file size budgets
- import / export budgets
- owner-boundary import violations
- role mixing
- function size and complexity
- shared-scope single-caller risks

### Phase 3 full graph guard

Must catch before READY may be claimed:

- zombie files not reachable from lawful live entry surfaces
- zombie exports with no active consumer from the reachable graph
- orphan top-level declarations
- literal-dead branches in active source
- re-export / barrel laundering that hides owner or liveness truth
- pass-through wrappers
- hidden chain lengthening
- stale evidence chains
- audit-system self-exemption
- remediation queue quality

No phase may claim full readiness until its required checks are runner-visible and failure-tested during development.

## 25. Final Readiness Gate

GrassEye code purity may be called READY only when:

- active law file is GrassEye-specific
- website-only rules are not active blockers
- P0 guard runs in CI for all currently wired executable checks
- no touched disaster file gained logic
- no fake runtime path exists in active source truth
- no bridge / compatibility / legacy dual path exists
- no zombie file, zombie export, orphan declaration, or literal-dead branch remains in active source truth
- no type escape was introduced
- no generated artifact was hand-edited as truth
- audit output is runner-visible
- remediation inventory, when emitted, appears only inside a FAIL result

Forbidden:

- PASS with fake success.
- PASS with any emitted executable finding.
- PASS by deleting evidence.
- PASS by weakening the law silently.
- PASS by moving forbidden logic into another owner.

## 26. Final Principle

```txt
If a file cannot explain its owner, it will become a dumping ground.
If a flow can call anything, it will become an engine.
If an ability can know business truth, it will become a second flow.
If evidence can be forged, every green result becomes suspect.
If zombie code is tolerated, every later edit will keep feeding the graveyard.
If Codex can patch dirty files without paying down structure, the system will rot in days.

Therefore: strict owner boundaries first, zombie deletion second, truthful runtime third, small files fourth, full automation fifth.
```
