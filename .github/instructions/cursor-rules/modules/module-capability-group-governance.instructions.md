---
name: "Website Code Purity Extreme Governance"
description: "全网站代码纯洁度终局法案：管理 src、app、components、styles、config、scripts、audit-system、generated artifacts 与 CI 质量门。用于阻断上帝文件、混 owner、性能污染、CSS 膨胀、伪通过、执法漂移、补丁缝合和调试污染。"
applyTo: "src/**/*.{ts,tsx,js,jsx,mjs,css,scss,mdx,json},app/**/*.{ts,tsx,js,jsx,mjs,css,scss,mdx,json},components/**/*.{ts,tsx,js,jsx,mjs,css,scss},lib/**/*.{ts,tsx,js,jsx,mjs},scripts/**/*.{ts,tsx,js,jsx,mjs,json},styles/**/*.{css,scss},middleware.{ts,js},next.config.{js,mjs,ts},tailwind.config.{js,ts},postcss.config.{js,mjs},package.json,.github/workflows/**/*.{yml,yaml}"
---

# Website Code Purity Extreme Governance

## 0. Identity / 身份

Scope: this law governs the entire website system source truth, including storefront code, admin code, API handlers, CSS, config, scripts, audit system, generated audit artifacts, and CI quality gates.

Boundary: this law does not decide business policy, product copy, tax logic, Shopify truth, order truth, payment truth, or visual design taste. However, every implementation of those domains must obey this law's code-purity, file-shape, owner-boundary, CSS, performance-safety, and auditability rules.

Authority: this file is the single authoritative website code-purity law. Any older code-purity blueprint, weak threshold, script exception, generated artifact, or inspector behavior that conflicts with this file is invalid until updated to match this file.

Core doctrine:

- No god files.
- No god components.
- No god functions.
- No god CSS.
- No hidden second systems.
- No compatibility bridges that preserve obsolete routes.
- No fake pass.
- No mock/fake/placeholder production leakage.
- No owner mixing hidden in neutral names.
- No broad `src/lib`, `components`, `utils`, `styles`, or `globals.css` dumping.
- No audit-system self-exemption.
- No active law without real AST/symbol enforcement.
- No inspector without runner participation.
- New or revised P0/P1 purity enforcement must be failure-validated during WHY-stage work without installing a standing negative-proof platform.
- No feature debugging through known disaster files.
- No user-side performance optimization on top of dirty code.

One sentence:

```txt
Code purity is not style. Code purity is the foundation for speed, debugging, maintainability, and truthful enforcement.
```

Code purity is also not a line-count-only rule. Line limits are hard guardrails, but a code-purity judgment must ask whether the file or chain makes the user load more, makes requests wait longer, crosses owner boundaries, introduces fake wrappers, creates single-caller helper files, lengthens a short path, or makes future Codex edits harder.

## 1. Global Extreme Baseline

This module replaces and invalidates all weaker baselines, including:

- 2000-line god-file thresholds.
- 800-line tolerance for active runtime files.
- 60-member god-object thresholds.
- 8-owner-boundary thresholds.
- Rules that exclude CSS from purity.
- Rules that exclude audit scripts from purity.
- Rules that treat generated artifacts as proof without runner execution.
- Rules that permit warning-only P0 findings.
- Rules that allow touched oversized files to keep growing.
- Rules that treat user-side speed as separate from code hygiene.

### 1.1 File-size hard limits

| File category | Target | Hard limit |
|---|---:|---:|
| Ordinary production implementation file | ≤ 140 lines | 220 lines |
| Runtime / coordinator / service file | ≤ 140 lines | 200 lines |
| App route page / layout / route shell | ≤ 120 lines | 180 lines |
| API / route handler | ≤ 100 lines | 160 lines |
| Server action file | ≤ 100 lines | 160 lines |
| React server component | ≤ 100 lines | 160 lines |
| React client component | ≤ 90 lines | 140 lines |
| Custom hook file | ≤ 70 lines | 110 lines |
| Store / context file | ≤ 90 lines | 140 lines |
| Schema / type / contract file | ≤ 220 lines | 350 lines |
| DAL / repository file | ≤ 120 lines | 180 lines |
| Adapter / gateway file | ≤ 120 lines | 180 lines |
| Result builder / proof builder | ≤ 80 lines | 120 lines |
| CSS module file | ≤ 180 lines | 260 lines |
| Global CSS file | ≤ 160 lines | 240 lines |
| Design token CSS file | ≤ 220 lines | 360 lines |
| JSON config / map / prompt file | ≤ 300 lines | 500 lines |
| Audit inspector aggregation file | ≤ 120 lines | 180 lines |
| Audit phase file | ≤ 160 lines | 240 lines |
| Audit shared utility file | ≤ 120 lines | 180 lines |
| Script / migration / one-off tool | ≤ 140 lines | 220 lines |

Generated files:

- Must be explicitly marked generated.
- Must not be manually edited.
- Must not contain runtime logic.
- Must not hide active source truth.
- Must not be used to bypass file-size or owner-boundary checks.

File-size findings remain binary. They are not sufficient as the only code-purity signal unless the rule is an absolute hard limit, disaster file rule, or touched-file hard-limit rule.

### 1.2 Function hard limits

| Function metric | Target | Hard limit |
|---|---:|---:|
| Physical lines | ≤ 20 | 30 |
| Effective statements | ≤ 16 | 24 |
| Parameters | ≤ 3 | 4 |
| Return branches | ≤ 2 | 4 |
| Nesting depth | ≤ 2 | 3 |
| Cyclomatic complexity | ≤ 5 | 7 |
| Switch cases | ≤ 4 | 6 |
| If / else-if chain | ≤ 2 | 4 |
| Await points in one function | ≤ 3 | 5 |
| Direct side-effect calls in one function | ≤ 2 | 4 |

### 1.3 React component hard limits

| Component metric | Target | Hard limit |
|---|---:|---:|
| JSX physical lines | ≤ 70 | 110 |
| Conditional render branches | ≤ 3 | 5 |
| Hooks per client component | ≤ 4 | 6 |
| useEffect per component | ≤ 1 | 2 |
| Prop count | ≤ 8 | 12 |
| Local state variables | ≤ 3 | 5 |
| Nested JSX depth | ≤ 5 | 7 |
| Imported feature owners | ≤ 1 | 2 |

### 1.4 Class / object hard limits

| Class metric | Target | Hard limit |
|---|---:|---:|
| Methods | ≤ 6 | 10 |
| Fields | ≤ 6 | 10 |
| Total members | ≤ 12 | 18 |
| Constructor parameters | ≤ 3 | 5 |
| Public methods | ≤ 4 | 7 |

### 1.5 Import / export hard limits

| Import / export metric | Target | Hard limit |
|---|---:|---:|
| Import declarations | ≤ 8 | 12 |
| Import sources | ≤ 6 | 10 |
| Cross-owner imports | ≤ 1 | 2 |
| Owner boundaries | ≤ 2 | 3 |
| Named exports | ≤ 4 | 6 |

Absolute import/export bans:

- `export *` is forbidden.
- `require` is forbidden.
- Ungoverned dynamic import is forbidden.
- Default export is forbidden unless framework-required or explicitly allowed by domain law.
- Barrel export laundering is forbidden.
- Cross-owner private imports are forbidden.

### 1.6 CSS hard limits

| CSS metric | Target | Hard limit |
|---|---:|---:|
| Global CSS selectors | ≤ 80 | 140 |
| CSS module selectors | ≤ 60 | 100 |
| Selector nesting depth | ≤ 2 | 3 |
| Specificity score | ≤ 0-3-1 | 0-4-2 |
| `!important` occurrences | 0 | 0 unless exception law exists |
| Keyframes per file | ≤ 2 | 4 |
| Media queries per file | ≤ 8 | 14 |
| Duplicate declaration blocks | 0 | 0 |
| Unused CSS classes | 0 | 0 |
| Global class leakage from page-specific styles | 0 | 0 |

### 1.7 Smart chain / user-cost purity signals

Every chain-complexity finding must be backed by ts-morph AST inspection, import graph traversal, and symbol-level or owner-level evidence. Text grep, filename-only guesses, and warning-only deferrals are forbidden for P0/P1 enforcement.

Required smart signals:

- User load increased: client boundary, heavy client import, global asset/CSS pollution, or unnecessary client-chain expansion.
- Request wait increased: server/data/action/route path adds an avoidable hop or serial wait point.
- Cross-owner chain: route or feature chain crosses owner boundaries beyond the allowed owner budget.
- Fake wrapper: exported function/component forwards to another local symbol without auth, route, locale, cache, metadata, error, or policy responsibility.
- Single-caller file: helper/DTO/contract/registry/strategy/facade/runtime file has one inbound caller and no public boundary role.
- Short chain lengthened: page/route/feature flow adds pass-through files without a real runtime boundary.
- Future Codex edit surface increased: the same user-visible behavior requires edits across avoidable files or owners.

Binary result rule:

- If smart AST/import-graph evidence proves a chain-complexity violation, the finding is `fatal`.
- Generated inventory may explain the violation, but it must not downgrade a proven P0/P1 finding to warning-only or deferred.
- Each chain-complexity finding must include `riskScore` and `riskSignals`.
- A chain finding is invalid if it cannot name the concrete file, owner signal, and structural reason.

---

## 2. Law APEX-CODE-PURITY-001-V1 — Source Atomicity

```apex-law
{
  "lawId": "APEX-CODE-PURITY-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "Active source files must remain physically small, owner-clear, and responsibility-atomic."
}
```

### Subject

源文件原子性与上帝文件禁止。

### Law

Every active website source file must remain small enough and structurally direct enough for safe review, safe Codex editing, fast debugging, and reliable user-side optimization.

Required:

- Every active source file must comply with the file-size hard limits in section 1.1.
- Every active source chain must comply with the smart chain / user-cost purity signals in section 1.7.
- A file must have one primary role.
- A file must have one owner.
- A file must not hide multiple systems behind names such as `utils`, `helpers`, `manager`, `service`, `runtime`, `shell`, `bridge`, `facade`, or `workbench`.
- A file must not exist only to lengthen a route, request, owner, or Codex edit chain.
- Oversized files must be physically split by owner, runtime role, UI role, data role, or audit phase.
- Existing oversized files must enter inventory and remediation queue.
- Touched oversized files must be split before task completion.

Forbidden:

- Treating line count as the only purity question.
- Treating oversized files as history exemptions.
- Adding new logic to an oversized touched file.
- Moving messy logic into `src/lib`, `components`, or `styles` to hide file growth.
- Calling a task complete while a touched file remains over its hard limit.

---

## 3. Law APEX-CODE-PURITY-002-V1 — Touched File Rule

```apex-law
{
  "lawId": "APEX-CODE-PURITY-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "Any touched active source file must satisfy hard limits before completion."
}
```

### Subject

Touched file 立即合规。

### Law

Any file modified in the current task must pass all applicable code-purity hard limits before the task can pass.

Required:

- If a touched file is oversized, split it before adding or preserving new logic.
- If a touched function exceeds limits, split it before completion.
- If a touched class/object exceeds limits, split it before completion.
- If a touched CSS file exceeds limits, split it by page, component, token, layout, or theme role.
- If a touched inspector exceeds limits, split it into owner-local audit phases.
- If safe splitting is blocked by parallel dirty work, return `BLOCKED_BY_DIRTY_FILE`, not PASS.

Forbidden:

- “Only one small change.”
- “Legacy file, later.”
- “Temporary patch.”
- “Performance first, purity later.”
- “Add logic now, split after debugging.”

---

## 4. Law APEX-CODE-PURITY-003-V1 — Function Shape

```apex-law
{
  "lawId": "APEX-CODE-PURITY-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "Functions must remain small, shallow, typed, and single-purpose."
}
```

### Subject

函数尺寸、复杂度与职责纯洁度。

### Law

Functions must be small enough for deterministic review and safe refactor.

Required:

- Functions must comply with section 1.2.
- Parsing, validation, policy decision, execution, persistence, response building, and proof building must be split.
- Complex UI decision logic must be extracted into named decision functions.
- Async pipelines must be split into input gate, data call, mapping, result builder, and error mapper.

Forbidden:

- Large do-everything functions.
- Deep nested branching.
- Catch-and-swallow.
- Naked throw escaping public route/action/runtime boundaries.
- Adding new branches to already over-limit functions.

---

## 5. Law APEX-CODE-PURITY-004-V1 — Component Purity

```apex-law
{
  "lawId": "APEX-CODE-PURITY-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "React components must remain small, render-pure, hydration-safe, and owner-local."
}
```

### Subject

React 组件纯洁度。

### Law

Website components must be small UI units, not hidden runtime systems.

Required:

- Components must comply with section 1.3.
- Server components must not import client-only hooks or browser APIs.
- Client components must be isolated as small islands.
- Pages and layouts must be route shells, not business workflow owners.
- Component files must not own DAL, cache policy, payment policy, order truth, Shopify truth, or audit logic.
- `useEffect` must be cleanup-safe and must not manufacture first-frame churn.
- Heavy interactive logic must move into owner-local hooks or action gates.

Forbidden:

- Page file as whole feature owner.
- Client component as data owner.
- UI component importing server-only modules.
- Render-time side effects.
- Hydration-unstable first frame branching.
- Component-level direct access to private DAL or raw Shopify adapters.

---

## 6. Law APEX-CODE-PURITY-005-V1 — CSS Purity

```apex-law
{
  "lawId": "APEX-CODE-PURITY-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "CSS must remain scoped, small, reusable by role, and user-speed safe."
}
```

### Subject

CSS 上帝文件、全局污染与样式性能污染禁止。

### Law

CSS is active source truth and must be governed like code.

Required:

- CSS files must comply with section 1.6.
- `globals.css` may contain only reset, tokens, font-face policy, minimal base elements, and global app shell primitives.
- Page-specific or component-specific styles must live in owner-local CSS modules.
- Design tokens must live in a token file, not page modules.
- Animation CSS must be page/component scoped unless it is a tokenized global primitive.
- Unused selectors must be deleted.
- Duplicate declaration blocks must be extracted or deleted.
- CSS module class names must be referenced by owning component.
- Global CSS must not import page-specific styling.

Forbidden:

- `globals.css` as style warehouse.
- Page-specific classes in global CSS.
- `!important` without dedicated exception law.
- Deep selector chains.
- CSS duplication to avoid component cleanup.
- Hidden full-page style systems in one module.
- Styling that forces all routes to load single-page CSS.

---

## 7. Law APEX-CODE-PURITY-006-V1 — Owner Boundary Granularity

```apex-law
{
  "lawId": "APEX-CODE-PURITY-006-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "Owner boundaries must be counted at real website domain granularity, not broad directory buckets."
}
```

### Subject

真实 owner 边界与混装禁止。

### Law

Owner-boundary analysis must use real website owner granularity.

Required owner examples:

- `src/app` = route shell / routing owner, not business owner.
- `src/features/homepage` = homepage owner.
- `src/features/pdp` = PDP owner.
- `src/features/cart` = cart owner.
- `src/features/checkout` = checkout owner.
- `src/features/order-status` = order status owner.
- `src/features/on-the-way` = fulfillment tracking owner.
- `src/features/user-orders` = user order projection owner.
- `src/features/video-commerce` = video commerce owner.
- `src/features/mission-control` = admin mission control owner.
- `src/features/auth` = auth owner.
- `src/features/i18n` = i18n owner.
- `src/features/customer-support` = customer support owner.
- `src/lib/shopify` = Shopify adapter owner.
- `src/lib/cache` = cache infra owner.
- `src/lib/observability` = observability infra owner.
- `src/lib/security` = security infra owner.
- `scripts/audit/domains/*` = separate audit-domain owners.
- `styles/tokens` = design token owner.

Required:

- A file must not cross more than 3 owner boundaries.
- A file must not use more than 2 cross-owner imports.
- Cross-owner access must go through ports, contracts, adapters, read models, or route shell composition.
- `src/lib` must prove real cross-domain reuse before accepting shared helpers.

Forbidden:

- Treating `src/features` as one owner.
- Treating `src/lib` as one owner.
- Treating `components` as owner-neutral dumping ground.
- Hiding owner mixing behind `utils`, `shared`, `common`, `helpers`, `bridge`, or `facade`.

---

## 8. Law APEX-CODE-PURITY-007-V1 — Import / Export Purity

```apex-law
{
  "lawId": "APEX-CODE-PURITY-007-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "Imports and exports must preserve narrow ownership and prevent barrel laundering."
}
```

### Subject

Import / export 纯洁度。

### Law

Import/export structure must reveal actual ownership.

Required:

- Public exports must be explicit and deliberate.
- Index files must remain narrow and owner-local.
- Shared helpers must prove two real lawful call sites before entering shared scope.
- Server-only modules must not be imported into client components.
- Client-only modules must not be imported into server execution paths.

Forbidden:

- `export *`.
- Broad barrel files.
- Importing many owners into one runtime file.
- Default export unless framework-required or law-allowed.
- Re-export laundering to hide private imports.
- Importing feature internals from another feature.

---

## 9. Law APEX-CODE-PURITY-008-V1 — Role Purity

```apex-law
{
  "lawId": "APEX-CODE-PURITY-008-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "Files must have one primary role and must not mix UI, data, validation, runtime, persistence, and audit responsibilities."
}
```

### Subject

单文件角色纯洁度。

### Law

Each file must have one primary role.

Allowed narrow roles:

- route-shell
- page-shell
- server-component
- client-component
- hook
- schema
- contract
- input-gate
- policy-gate
- executor
- adapter
- repository
- read-model
- mapper
- result-builder
- proof-builder
- style-module
- design-token
- validator
- inspector
- audit-phase
- config
- type-only

Forbidden mixes:

- UI + DAL.
- UI + payment/order truth.
- Schema + runtime execution.
- Validator + executor.
- API handler + workflow + persistence.
- CSS tokens + page-specific style.
- Cache policy + product mapper + route response.
- Shopify adapter + PDP component.
- Audit inspector + generated artifact mutation.
- Performance measurement + business workflow mutation.

---

## 10. Law APEX-CODE-PURITY-009-V1 — Dead Code / Fake Runtime Ban

```apex-law
{
  "lawId": "APEX-CODE-PURITY-009-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "Dead code, fake runtime paths, mocks, placeholders, and temporary bypasses must not survive in active website source truth."
}
```

### Subject

死代码、伪运行路径与调试残留清理。

### Law

Website source truth must not preserve abandoned or fake execution paths.

Required:

- Dead code must be deleted.
- Commented-out implementation code must be deleted.
- Deprecated routes must be physically removed or archived outside active source truth.
- Mock/fake/placeholder execution must not be presented as production behavior.
- TODO comments are allowed only with owner, reason, target phase, and removal condition.
- Temporary debug logs must be removed or routed through governed observability.

Forbidden:

- Fake success.
- Fallback success.
- No-op success.
- Placeholder data as production truth.
- Mock Shopify result in production path.
- Fake order/payment/cart result.
- Commented old implementation.
- Compatibility branch that keeps deleted architecture alive.
- `console.log` scatter in governed runtime paths.

---

## 11. Law APEX-CODE-PURITY-010-V1 — Type Escape Ban

```apex-law
{
  "lawId": "APEX-CODE-PURITY-010-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "Type escapes and suppression directives must not bypass code purity."
}
```

### Subject

类型逃逸与反逃逸。

### Law

TypeScript must be used as a governance surface, not bypassed.

Forbidden:

- `as any`.
- `as unknown as`.
- `@ts-ignore`.
- Ungoverned `@ts-expect-error`.
- Ungoverned `eslint-disable`.
- Catch-and-swallow.
- `return null` as success.
- Naked throw escaping public route/action/runtime boundaries.
- Alias laundering.
- Wrapper hiding forbidden calls.

Required:

- Inspectors must use AST, symbol, and type-aware analysis.
- Every exception must have law-backed exception metadata.
- `unknown` must be narrowed through schema or guard before use.

---

## 12. Law APEX-CODE-PURITY-011-V1 — RSC / Client Boundary Purity

```apex-law
{
  "lawId": "APEX-CODE-PURITY-011-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "Next.js server/client boundaries must remain narrow, serializable, and speed-safe."
}
```

### Subject

RSC / Client Component 边界纯洁度。

### Law

Server/client boundaries must protect first render, hydration stability, and bundle size.

Required:

- `use client` files must be small client islands.
- Server components must pass only serializable props to client components.
- Client components must not import server-only modules, DAL, secret config, or Node APIs.
- Server components must not use browser APIs or client hooks.
- Data loading must remain server-side unless interactivity requires client fetch.
- Route shell must not become client-only unless explicitly justified.

Forbidden:

- `use client` at broad page/layout/root scope without exception.
- Passing functions, class instances, Dates, Maps, Sets, or non-serializable objects across RSC boundary.
- Hydration-unstable first frame.
- Client bundle importing admin/backoffice/Shopify private adapters.

---

## 13. Law APEX-CODE-PURITY-012-V1 — User-Side Speed Purity

```apex-law
{
  "lawId": "APEX-CODE-PURITY-012-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "Code purity must protect user-side speed by preventing critical-path bloat, heavy imports, and global asset pollution."
}
```

### Subject

用户侧速度纯洁度。

### Law

Code structure must not make performance optimization impossible.

Required:

- Storefront critical path must not import admin code.
- Above-fold route shell must not import non-critical video/player/admin/debug modules.
- Heavy libraries must be behind lawful dynamic boundaries or server-only boundaries.
- Route-level bundle report must identify top contributors.
- Critical CSS must remain minimal and scoped.
- Images/video/posters must use governed components or adapters.
- Third-party scripts must be isolated and justified.
- Debug panels and audit UI must not enter storefront bundle.

Forbidden:

- Importing full icon libraries into storefront client components.
- Importing admin/mission-control into user routes.
- Importing whole animation frameworks into non-animated routes.
- Loading video runtime on routes without video.
- Global CSS that makes all pages pay for one page.
- Bundling debug-only code into production storefront.

---

## 14. Law APEX-CODE-PURITY-013-V1 — API / Server Action Purity

```apex-law
{
  "lawId": "APEX-CODE-PURITY-013-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "API handlers and server actions must be thin boundaries, not hidden workflow owners."
}
```

### Subject

API Handler / Server Action 纯洁度。

### Law

API routes and server actions must remain thin boundary adapters.

Required:

- API handlers must split request parsing, auth gate, input schema, owner call, error mapping, and response building.
- Server actions must call owner services through contracts.
- Handlers must not own commerce truth, order truth, cache truth, or UI mapping.
- Public error responses must use governed error contracts.
- Private error details must not leak to clients.

Forbidden:

- Handler as business workflow.
- Handler importing multiple feature internals.
- Handler building giant response maps.
- Handler catching errors and returning fake success.
- Server action mutating unrelated owners.

---

## 15. Law APEX-CODE-PURITY-014-V1 — Audit-System Self Governance

```apex-law
{
  "lawId": "APEX-CODE-PURITY-014-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "The audit system is fully governed by code-purity and cannot exempt itself."
}
```

### Subject

执法系统自我治理。

### Law

Audit code is active source truth and must obey the same or stricter purity rules.

Required:

- Every inspector must be owner-local.
- Inspector aggregation files must stay below hard limits.
- Inspector phases must be physically split by required-shape, forbidden-shape, boundary, anti-escape, CSS, performance, and permanent-pollution-ban roles.
- Audit utilities must prove reuse before entering shared audit scope.
- Inspectors must use ts-morph AST, symbol, type checker, import graph, and export graph as final judgment.
- Text scanning may only support file discovery or non-structural hints; it cannot be final structural judgment.
- Code-purity inspector must inspect code-purity inspector files.

Forbidden:

- Audit-system self-exemption.
- Regex/grep/includes as final TypeScript judgment.
- Warning-only P0.
- Detached inspector.
- Runner not executing inspector.
- Generated fake PASS.
- Standing mutation harness inside the audit chain.
- One inspector acting as total police for unrelated domains.

---

## 16. Law APEX-CODE-PURITY-015-V1 — Generated Artifact Truth

```apex-law
{
  "lawId": "APEX-CODE-PURITY-015-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "Generated artifacts must reflect law and runner truth and must not become manual or fake truth."
}
```

### Subject

Generated artifact 真实性。

### Law

Generated artifacts are evidence, not source law.

Required:

- Generated artifacts must be reproducible.
- Generated artifacts must include code-purity coverage.
- Runner output must prove code-purity execution.
- Generated timestamps must not be older than their input law/manifest changes in final acceptance.
- Generated files must not be manually edited.
- Generated artifacts must identify law coverage, inspector coverage, and runner coverage.

Forbidden:

- Manual matrix truth.
- Runner-owned law bindings.
- Fake generated PASS.
- Editing generated artifacts to pass.
- Generated files hiding active runtime logic.

---

## 17. Law APEX-CODE-PURITY-016-V1 — WHY-Stage Verification Discipline

```apex-law
{
  "lawId": "APEX-CODE-PURITY-016-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "New or revised code-purity enforcement must be validated during WHY-stage work without installing permanent mutation fixtures or a standing negative-proof platform."
}
```

### Subject

WHY 阶段验证纪律，而不是常驻反证平台。

### Law

Code-purity enforcement must prove that newly added or revised checks can fail when their protected condition is deliberately broken.
This proof belongs to WHY-stage development and review.
It must not become a permanent production-source fixture, permanent CI mutation system, or standing audit subsystem.

Required:

- When a code-purity inspector or check is added or materially revised, the author must perform a temporary failure validation during the WHY HAPPEN workflow.
- Temporary validation may delete, weaken, or locally mutate the new check or a minimal target fixture to confirm the check fails closed.
- Temporary validation must be completed in a scratch branch, local working tree, or bounded throwaway harness.
- Temporary validation artifacts must be removed before final delivery.
- The final committed audit system must contain the real inspector or check, not a permanent mutation platform.
- Final delivery evidence may describe the temporary validation result in the report, but must not require generated negative-proof artifacts to pass CI.

Forbidden:

- Permanent `__code-purity-negative-proof__` directories under `src/`, `app/`, `components/`, `lib/`, or any production source tree.
- Permanent probe registries that write fake route, page, layout, component, route-handler, or runtime files into production-shaped paths.
- CI or `audit:runner` automatically mutating source files as a normal execution step.
- Generated negative-proof reports as a required PASS condition.
- Treating every P0/P1 law as requiring a standing mutation probe.
- Storing fake pages, fake layouts, fake components, fake routes, fake server actions, or fake runtime files as enforcement assets.
- Allowing mutation or rollback machinery to become a second audit subsystem.
- Claiming PASS because a mutation platform passed while the real inspector is weak.

Acceptance:

- The committed repository contains no permanent production-shaped negative-proof fixture files.
- The audit runner does not execute mutation probes.
- The code-purity owner may enforce that no forbidden negative-proof directories or permanent probe systems exist.
- WHY-stage reports may include a short validation note, but the validation note is not a generated runtime truth source.

---

## 18. Law APEX-CODE-PURITY-017-V1 — Inventory / Remediation Queue

```apex-law
{
  "lawId": "APEX-CODE-PURITY-017-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "Code-purity enforcement must produce actionable inventories and physical split plans, not vague failure lists."
}
```

### Subject

Inventory、Dossier 与物理切割队列。

### Law

Code-purity audit must produce actionable remediation artifacts.

Required outputs:

- God File Inventory.
- Disaster File Inventory.
- Chain Depth Inventory.
- Pass-through Wrapper Inventory.
- Single-caller File Inventory.
- Feature Chain Inventory.
- God Component Inventory.
- God CSS Inventory.
- Owner Mixing Inventory.
- Oversized Touched File Inventory.
- Function Over-limit Inventory.
- Class/Object Over-limit Inventory.
- Import/Export Over-limit Inventory.
- RSC Boundary Violation Inventory.
- CSS Violation Inventory.
- Performance Bloat Inventory.
- Audit-System Violation Inventory.
- Remediation Queue.
- First Physical Split Plan.

Each item must include:

- file
- owner
- fileType
- lines
- riskScore
- riskSignals
- overLimitBy
- functionsOverLimit
- componentsOverLimit
- cssSelectorsOverLimit
- classMembers
- importCount
- crossOwnerImports
- ownerBoundaries
- roleMixingSignals
- userSideSpeedImpact
- requestWaitImpact
- chainDepth
- inboundCallers
- passThroughTarget
- severity
- recommendedSplit
- verificationCommand

Allowed severity:

- BLOCKING
- DISASTER
- REMEDIATION

Forbidden:

- `FULL_GRAPH_DEFERRED_WITH_REASON` or equivalent deferred labels for proven P0/P1 code-purity violations.
- Inventory-only downgrade for AST/import-graph-proven chain violations.
- Chain findings without `riskScore` and `riskSignals`.
- Chain findings produced by filename-only or text-only heuristics.
- Failing without actionable inventory.
- Inventory without split recommendation.
- Remediation queue without severity.
- Marking known god files as harmless.

---

## 19. Law APEX-CODE-PURITY-018-V1 — Physical Remediation Only

```apex-law
{
  "lawId": "APEX-CODE-PURITY-018-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "Code-purity remediation must use physical deletion, physical split, and owner-local extraction, not cosmetic patches."
}
```

### Subject

物理删除、物理切割与禁止补丁缝合。

### Law

Violations must be remediated by real structural simplification.

Allowed remediation:

- DELETE.
- DELETE_AND_REWRITE.
- PHYSICAL_SPLIT.
- OWNER_LOCAL_EXTRACTION.
- ROUTE_SHELL_SPLIT.
- CLIENT_ISLAND_SPLIT.
- CSS_SCOPE_SPLIT.
- INSPECTOR_PHASE_SPLIT.

Forbidden remediation:

- Cosmetic rename.
- Wrapper hiding.
- Facade hiding.
- Bridge retaining old path.
- Keeping old and new routes active.
- Moving mess into `src/lib`.
- Moving CSS mess into `globals.css`.
- `index.ts` barrel laundering.
- Commenting code out instead of deletion.
- Lowering thresholds.

---

## 20. Law APEX-CODE-PURITY-019-V1 — Disaster File Rule

```apex-law
{
  "lawId": "APEX-CODE-PURITY-019-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "Disaster files must block feature debugging until physically split or explicitly reported as blocked."
}
```

### Subject

灾难文件阻断。

### Law

A disaster file is any active source file satisfying one or more:

- More than 500 lines for production implementation.
- More than 700 lines for CSS.
- More than 18 class/object members.
- More than 3 owner boundaries.
- More than 2 cross-owner imports.
- Route/page/component file loading unrelated major subsystems.
- Audit inspector acting as multi-domain police.
- Known blocker for speed optimization, debugging, or Codex safe edits.

Required:

- Disaster files must enter Disaster File Inventory.
- Disaster files must enter Remediation Queue.
- Disaster files must not receive new feature logic.
- Current user-side critical path disaster files must be split before performance tuning.
- If not safely splittable in current task, output `BLOCKED_BY_DISASTER_FILE`.

Forbidden:

- Treating disaster files as historical exceptions.
- Continuing feature debugging through disaster files.
- Lowering thresholds to pass.
- Calling system ready while current critical path depends on disaster files.

---

## 21. Law APEX-CODE-PURITY-020-V1 — Final Readiness Gate

```apex-law
{
  "lawId": "APEX-CODE-PURITY-020-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "Website code-purity is ready only when laws, blueprint, inspectors, generated artifacts, runner, permanent negative-proof bans, and inventories agree."
}
```

### Subject

最终准入门。

### Law

Website code-purity is READY only when all are true:

- Law file and blueprint agree.
- Inspector thresholds match this law.
- Generated artifacts include all active code-purity laws.
- Runner executes code-purity inspector.
- No permanent negative-proof pollution remains in source roots or the audit chain.
- The audit runner does not execute mutation probes or require generated negative-proof artifacts.
- No weak old baseline remains active.
- File/function/component/CSS/import thresholds are enforced.
- Owner mapping uses real website owner granularity.
- Audit-system is inside scope.
- God File Inventory is produced.
- Disaster File Inventory is produced.
- CSS Inventory is produced.
- Performance Bloat Inventory is produced.
- Remediation Queue is produced.
- First Physical Split Plan is produced.
- Touched oversized files do not grow.
- Current critical path disaster files are blocked or split.
- No fake pass.
- No warning-only P0.
- No detached inspector.

Forbidden:

- PASS without code-purity runner result.
- PASS with permanent negative-proof pollution.
- PASS with a standing mutation platform in `audit:runner` or CI.
- PASS with active touched oversized file.
- PASS with fake success.
- PASS with audit-system self-exemption.
- PASS with storefront critical path loading admin/debug code.

---

## 22. Required Enforcement

The audit-system must enforce this law using AST / symbol / type-aware inspection.

Required structural inspection:

- Source file line count.
- Function line count.
- Function statement count.
- Function parameter count.
- Function complexity.
- Nesting depth.
- Await points.
- Side-effect count.
- Component size.
- Component hook count.
- JSX nesting.
- RSC boundary violations.
- Class method count.
- Class field count.
- Class total members.
- Constructor parameters.
- Import declaration count.
- Import source count.
- Cross-owner import count.
- Owner-boundary count.
- Export count.
- Forbidden `export *`.
- Forbidden default export when not framework-required.
- Forbidden `as any`.
- Forbidden `as unknown as`.
- Forbidden directives.
- Forbidden `require`.
- Forbidden unmanaged dynamic import.
- CSS file size.
- CSS selector count.
- CSS specificity.
- CSS global leakage.
- CSS duplicate declaration blocks.
- CSS unused class references.
- `!important` usage.
- Role mixing.
- Dead code.
- Fake success.
- Mock/fake/placeholder production leakage.
- Compatibility bridges.
- Admin/debug code in storefront bundle path.
- Oversized touched files.
- Disaster files.
- Inventory output.
- Permanent negative-proof pollution bans.

Forbidden enforcement shortcuts:

- grep as final TypeScript judgment.
- regex as final TypeScript judgment.
- string includes as final structural judgment.
- warning-only P0.
- narrative-only proof in place of executable enforcement.
- generated fake PASS.
- detached inspector.
- standing negative-proof harness.

Text scanning is allowed only for CSS tokenization, file discovery, and supplementary hints where AST is not applicable.

---

## 22. Law APEX-CODE-PURITY-021-V1 — P0 User Route Chain Census

```apex-law
{
  "lawId": "APEX-CODE-PURITY-021-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "code-purity",
  "enforcementMode": "auto",
  "evidenceMode": "ast",
  "summary": "The eight P0 user routes must be fully counted, budgeted, and blocked when their real render chains grow hidden external reads."
}
```

### Subject

P0 user route blocking-path census and hard stop enforcement.

### Law

The eight P0 user routes must be fully included in code-purity chain census, and each route must publish real blocking-path evidence before it can pass.

Required:

- The route list is exactly `/`, `/products/[handle]`, `/watch`, `/watch/[productHandle]`, `/cart`, `/checkout`, `/checkout/cod`, and `/order-status`.
- Census traversal must not stop merely because a file contains `server-only`, `use client`, `use server`, `read`, `get`, `build`, `cache`, or framework primitive naming.
- Each route must output longest blocking path, external read counts, forbidden symbols, required route signals, duplicate source reads, and sequential external loop status.
- Each route must satisfy its configured blocking-depth and external-read budgets.
- Each route must reject configured forbidden symbols in its blocking path.
- Each route must reject awaited external reads inside serial loops.
- Missing `scripts/audit/generated/p0-user-route-chain-census.generated.json` is fatal.
- Passing by deleting user-visible function, replacing real data with permanent empty values, lowering budgets, or moving hidden IO into uncounted paths is forbidden.

Forbidden:

- Removing any of the eight P0 routes from the census.
- Adding primitive-boundary stops that hide route-owned server reads.
- Treating sequential per-item external reads as acceptable P0 route behavior.
- Publishing a generated census report that omits failing route entries.

---

## 23. Final Principle

```txt
If the website is dirty, speed tuning becomes guesswork.
If the files are huge, debugging becomes archaeology.
If CSS is global trash, user-side speed cannot be stable.
If audit is fake, every green result is poison.
If Codex can keep patching god files, the system will rot again.

Therefore: clean code first, owner clarity second, user-side speed third, full debugging last.
```
