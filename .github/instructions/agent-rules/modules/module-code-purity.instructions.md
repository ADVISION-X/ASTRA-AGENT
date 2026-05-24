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

Executable code-purity verdicts are binary:

```txt
PASS = every numeric gate is within the red line and no structural veto law is violated.
FAIL = any numeric red line is exceeded or any structural veto law is violated.
```

Code size gates are binary, coarse, and secondary. They exist only to stop obvious structural swelling. They must not replace architecture boundary, owner boundary, zombie, fake runtime, generated truth, AI boundary, or runtime log spine laws.

No target.
No hard/disaster split.
No warning.
No remediation-only numeric state.
No pass-with-findings.

Codex must not downgrade structural violations by calling them "legacy", "temporary", "small change", "later", or "only for CI".

## 3. File Size Budget

Line count is not the only purity signal, but it is a binary red line once a clause is wired into the executable inspector.

| Metric | Red line |
|---|---:|
| Active executable source file physical lines | 500 |

Required:

- A file under 500 lines can still FAIL if it violates owner, boundary, zombie, fake runtime, AI planner, generated truth, or runtime log spine laws.
- A file over 500 lines FAILS because it is too large to remain safely editable by Codex.
- Touched files over the red line must be split or reduced before receiving new logic.

Allowed exception:

- A law file may exceed normal executable source limits because it is the written authority, but it must stay structured, parseable, and domain-specific.

## 4. Function / Object Budget

| Function metric | Red line |
|---|---:|
| Physical lines | 75 |
| Parameters | 7 |
| Return branches | 8 |
| Nesting depth | 5 |
| Cyclomatic complexity | 16 |
| Await points | 10 |

| Object / class metric | Red line |
|---|---:|
| Total members | 30 |

Required:

- Parsing, validation, policy decision, execution, evidence writing, logging, and result building must be separable.
- Long action pipelines must be split by real runtime role, not by cosmetic wrapper.
- Error mapping must be explicit at public boundaries.

Forbidden:

- Catch-and-swallow.
- `return null` as success.
- Naked throw escaping public mediator, app-shell, job-flow, or runtime boundaries.
- Adding new branches to an already over-line function.

## 5. Import / Export Budget

| Import / export metric | Red line |
|---|---:|
| Import declarations | 28 |
| Import sources | 24 |
| Named exports | 24 |

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
- Existing over-line files must enter inventory.

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

- If a touched file is under the red line, keep it under the red line.
- If a touched file is over the red line, split or reduce it before adding logic.

Forbidden:

- "One small patch" on an over-line file.
- "Legacy later."
- "Temporary until CI passes."
- Adding logic to a touched over-line file.

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
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "fs+ast",
  "summary": "Code-purity enforcement must produce actionable inventories and every executable inventory item must block PASS."
}
```

Required inventory when inspector maturity allows:

- over-line files
- touched over-line files
- over-line functions
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
  "evidenceMode": "fs+ast+symbol-graph+anti-evasion",
  "summary": "Active source must not keep zombie files, zombie exports, orphan top-level declarations, literal-dead code branches, or any surface whose liveness cannot be proven."
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

Executable zombie detection must be stricter than the written minimum law.
When liveness cannot be proven through AST + symbol graph + lawful entry manifest, the surface must fail as zombie-risk.

Regular expressions are forbidden in code-purity zombie detection implementation.
The inspector must use ts-morph AST, TypeChecker symbols, and explicit anti-evasion guards.

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

## 24. Law APEX-CODE-PURITY-018-V1 — Zombie Inspector Anti-Evasion

```apex-law
{
  "lawId": "APEX-CODE-PURITY-018-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "ast+symbol-graph+anti-evasion",
  "summary": "Zombie inspection must be AST-level, symbol-level, and anti-evasion strict; unproven liveness fails."
}
```

Zombie detection must be AST-level, symbol-level, and anti-evasion level.

It must reject:

- namespace import laundering
- barrel re-export laundering
- type-only/runtime confusion
- public-boundary auto-liveness
- zombie-to-zombie proof chains
- dynamic import without explicit lawful live entry manifest
- identifier-count fallback
- regex-based structural judgment
- commented-out executable code
- const-gated dead branches

Required:

- namespace imports only prove property-level symbol usage that can be traced through AST and symbol references
- re-export chains only prove life when a final reachable consumer uses the traced symbol
- type-only liveness and runtime-value liveness remain separate proofs
- commented-out executable code must fail when comment trivia can be parsed into executable or declarative syntax
- same-file orphan declarations must use symbol references; symbol resolution failure must fail instead of falling back to name counts
- lawful dynamic entry surfaces must be declared explicitly and validated by owner-bound manifests

Forbidden:

- blanket liveness for `index.ts`, `schema.ts`, `contract.ts`, `types.ts`, or similar file names
- namespace object spreading, iteration, or dynamic property access as silent proof of life
- treating re-export forwarding alone as final consumption proof
- using source-text regex, string identifier counts, or naming conventions as fake liveness proof

## 25. Law APEX-CODE-PURITY-019-V1 — Side-Effect Import Manifest Proof

```apex-law
{
  "lawId": "APEX-CODE-PURITY-019-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "ast+module-graph+manifest",
  "summary": "Side-effect imports must not act as hidden liveness or boundary proof without explicit lawful manifest ownership."
}
```

Side-effect import is runtime-rooted and therefore cannot be treated as harmless background wiring.

Required:

- side-effect import must be declared explicitly by consumer file and target file in the lawful manifest when it is needed
- side-effect import must still obey the same owner-boundary law that applies to normal imports
- zombie reachability must not accept a side-effect import edge unless lawful manifest proof exists

Forbidden:

- using side-effect import as silent keepalive or zombie laundering
- treating side-effect import as boundary-free because it exposes no bindings
- keeping active side-effect imports that have no explicit owner-local reason

## 26. Law APEX-CODE-PURITY-020-V1 — Dynamic Import Literal Truth

```apex-law
{
  "lawId": "APEX-CODE-PURITY-020-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "ast+module-graph+manifest",
  "summary": "Dynamic imports must remain literal, resolvable, manifest-declared, and owner-boundary lawful."
}
```

Dynamic import is allowed only as an explicit owner-known runtime edge.

Required:

- dynamic import specifier must be a literal string or no-substitution template literal
- governed dynamic import targets must resolve through AST/module resolution, not source-text guessing
- lawful dynamic imports must be declared explicitly in the owner-local manifest
- dynamic import owner-boundary checks must be identical to static import owner-boundary checks

Forbidden:

- non-literal dynamic import in governed source
- runtime-computed dynamic import used to hide target ownership
- treating unresolved dynamic import as ignorable because the target cannot be proven

## 27. Law APEX-CODE-PURITY-021-V1 — Owner Boundary Edge Completeness

```apex-law
{
  "lawId": "APEX-CODE-PURITY-021-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "ast+module-graph",
  "summary": "Owner-boundary enforcement must cover import, re-export, dynamic import, and side-effect import uniformly."
}
```

Owner-boundary truth is about dependency edges, not syntax comfort.

Required:

- boundary scanners must judge import, re-export, dynamic import, and side-effect import from the same resolved edge graph
- an edge kind that reaches the same forbidden target must fail under the same owner law
- barrel or side-effect syntax must not create a second owner-boundary lane

Forbidden:

- checking only import and re-export while leaving dynamic or side-effect edges outside the owner boundary verdict
- allowing side-effect or dynamic syntax to bypass plugin/capability/mediator/shared-scope rules

## 28. Law APEX-CODE-PURITY-022-V1 — Runtime-Rooted Declaration Liveness

```apex-law
{
  "lawId": "APEX-CODE-PURITY-022-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "ast+symbol-graph+declaration-graph",
  "summary": "Reachable files must still prove declaration-level liveness from runtime or type roots; dead export helper chains and dead internal subgraphs must fail."
}
```

File reachability is necessary but insufficient.

Required:

- top-level declarations in reachable files must be judged by a runtime-rooted or type-rooted declaration graph
- live roots may come only from lawful top-level executable code, final live export consumers, lawful manifest entry exports, or lawful type consumers
- helper declarations referenced only by dead exports must fail as dead-export helper subgraphs
- helper declarations referenced only inside dead internal chains must fail as dead internal declaration subgraphs
- symbol resolution failure must fail as unproven runtime-rooted liveness rather than silently keeping the declaration alive

Forbidden:

- treating any same-file reference as proof of life
- allowing a dead export to keep its helper chain alive
- allowing a reachable file to keep dead internal declaration islands because one neighboring export is live

## 29. Law APEX-CODE-PURITY-023-V1 — Registry / Object Bag Property-Level Liveness

```apex-law
{
  "lawId": "APEX-CODE-PURITY-023-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "ast+symbol-graph+property-usage+manifest",
  "summary": "Object bags, registries, and handler maps must prove liveness at property level; whole-bag imports do not keep every entry alive."
}
```

Bag-level reachability is not property-level proof.

Required:

- exported object bags, registries, and handler maps must prove which properties are actually consumed
- `handlers.foo` may prove only `foo`; it must not keep sibling entries alive
- dynamic bag access must fail unless the consumer, registry file, and registry export are declared explicitly in a lawful manifest
- lawful dynamic registry consumers are strict exemptions, not generic false-positive trash bins

Forbidden:

- treating `import { handlers }` as proof that all handler entries are live
- allowing `Object.keys`, `Object.values`, `Object.entries`, computed indexing, or other dynamic bag reads to bypass property-level proof without lawful manifest ownership
- using registry or handler bags as laundering surfaces for dead flows

## 30. Enforcement Roadmap

The code-purity inspector should mature in phases.

### Phase 1 P0 guard

Must catch:

- forbidden roots and retired architecture terms
- `any`, `as any`, `as unknown as`, `@ts-ignore`
- `export *`
- bridge / compatibility / legacy active paths
- fake / mock / placeholder / no-op success language in active runtime
- touched over-line file growth
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

## 31. Final Readiness Gate

GrassEye code purity may be called READY only when:

- active law file is GrassEye-specific
- website-only rules are not active blockers
- P0 guard runs in CI for all currently wired executable checks
- no touched over-line file gained logic
- no fake runtime path exists in active source truth
- no bridge / compatibility / legacy dual path exists
- no zombie file, zombie export, orphan declaration, or literal-dead branch remains in active source truth
- no dead-export helper subgraph, dead internal declaration subgraph, unused object-bag entry, or dynamic registry laundering remains in active source truth
- no type escape was introduced
- no generated artifact was hand-edited as truth
- audit output is runner-visible
- remediation inventory, when emitted, appears only inside a FAIL result

Executable enforcement is a floor, not a ceiling.
If the written law does not name an obvious rot surface yet the inspector can prove the rot through the same owner truth, the inspector must still fail it.

Forbidden:

- PASS with fake success.
- PASS with any emitted executable finding.
- PASS by deleting evidence.
- PASS by weakening the law silently.
- PASS by moving forbidden logic into another owner.

## 32. Final Principle

```txt
If a file cannot explain its owner, it will become a dumping ground.
If a flow can call anything, it will become an engine.
If an ability can know business truth, it will become a second flow.
If evidence can be forged, every green result becomes suspect.
If zombie code is tolerated, every later edit will keep feeding the graveyard.
If Codex can patch dirty files without paying down structure, the system will rot in days.

Therefore: strict owner boundaries first, zombie deletion second, truthful runtime third, small files fourth, full automation fifth.
```

The written law is the minimum contract.
Code Purity enforcement must be stricter than the text when the same AST / symbol / manifest evidence can prove a stronger corruption surface.
