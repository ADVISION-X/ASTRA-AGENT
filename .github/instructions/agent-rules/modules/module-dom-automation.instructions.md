---
name: "GrassEye DOM Automation Capability"
description: "Production-grade law for the DOM Automation ability group: snapshot, locate, fill, click, upload, wait, verify, structured failure, evidence truth, frame/shadow boundaries, and audit enforcement."
applyTo: "src/capabilities/dom-automation/**,src/plugins/**,src/mediator/**,src/lib/browser/**,scripts/acceptance/**,scripts/audit/**"
---

# GrassEye DOM Automation Capability

status: active
version: 2026-05-21
capabilityDomain: dom-automation
constructionBlueprint: `docs/法案辅助文件/GrassEye_DOM自动化生产稳定态施工图.md`

## 0. Identity / 身份

DOM Automation is the browser-page action ability group for GrassEye.

It exists to make web back-office automation production-stable without restoring a universal agent, visual mission loop, coordinate-first controller, or business-specific browser script.

DOM Automation owns same-kind browser-page primitives:

- DOM snapshot summary.
- Semantic element location.
- Approved text fill.
- Located element click.
- Approved file upload.
- DOM state wait.
- DOM state verification.

DOM Automation does not own:

- User-demand routing.
- Business job flow.
- Amazon / Facebook / platform-specific decisions.
- AI planning.
- Browser session lifecycle.
- Evidence store truth.
- Runtime log ownership.
- Workflow planning or next action selection.

## 1. Highest Rule

DOM Automation may perform only bounded child abilities on caller-approved inputs.

```txt
Job Flow
  -> DOM public facade
      -> one DOM child ability
          -> structured action / verification result
              -> evidence refs / failure reason
```

Any DOM code that decides business process order, invents the next action, imports a plugin, or executes a platform-specific workflow is a P0 violation.

## 2. Legal Child Ability List

The only active DOM child abilities are:

```txt
read-dom-snapshot-once
locate-dom-element-once
fill-dom-element-once
click-dom-element-once
upload-approved-file-once
wait-for-dom-state-once
verify-dom-state-once
```

No new DOM child ability may be added until this law and its construction blueprint are updated first.

## 3. Law APEX-DOM-001-V1 — Business Neutrality

```apex-law
{
  "lawId": "APEX-DOM-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "DOM Automation must remain business-neutral and must not contain platform-specific workflow logic.",
  "appliesTo": [
    "src/capabilities/dom-automation/**/*.{ts,tsx,js,jsx,mjs}"
  ],
  "forbidden": [
    "Amazon-specific workflow inside DOM Automation.",
    "Facebook-specific workflow inside DOM Automation.",
    "Business success decision inside DOM Automation.",
    "DOM code importing src/plugins.",
    "DOM code calling AI to plan browser actions."
  ]
}
```

Required:

- Business hints, platform terms, order IDs, invoice numbers, and success copy belong to the job plugin.
- DOM code may receive caller-approved hints but must not own their business meaning.
- DOM outputs are action or verification facts, not final business result.

Forbidden:

- DOM deciding Amazon upload success.
- DOM knowing Seller Central business step order.
- DOM importing plugin files.
- DOM calling AI.
- DOM emitting workflow, next action, or action plan fields.

## 4. Law APEX-DOM-002-V1 — Public Facade Only

```apex-law
{
  "lawId": "APEX-DOM-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast",
  "summary": "Public consumers may import DOM Automation only through its public facade.",
  "appliesTo": [
    "src/plugins/**/*.{ts,tsx,js,jsx,mjs}",
    "src/mediator/**/*.{ts,tsx,js,jsx,mjs}",
    "src/app/**/*.{ts,tsx,js,jsx,mjs}"
  ],
  "forbidden": [
    "Consumer importing src/capabilities/dom-automation/runtime.",
    "Consumer importing DOM private contract internals.",
    "Mediator importing any DOM runtime file.",
    "App shell importing any DOM runtime file."
  ]
}
```

Required:

- Job flows import from `src/capabilities/dom-automation/index.ts`.
- DOM runtime internals remain private to the ability group.
- `index.ts` exports only public schemas, public types, and public child ability functions.

Forbidden:

- `src/plugins/**` importing `src/capabilities/dom-automation/runtime/**`.
- `src/mediator/**` calling DOM children directly.
- Public facade hiding a second private facade.

## 5. Law APEX-DOM-003-V1 — Structured Failure

```apex-law
{
  "lawId": "APEX-DOM-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+typecheck",
  "summary": "Expected DOM uncertainty must return structured statuses instead of escaping as ordinary exceptions.",
  "appliesTo": [
    "src/capabilities/dom-automation/**/*.{ts,tsx}"
  ],
  "forbidden": [
    "Locator not_found thrown as normal control flow.",
    "Locator ambiguous thrown as normal control flow.",
    "Fill/click/upload/verify returning success after unverified uncertainty.",
    "Catch-and-swallow inside DOM runtime."
  ]
}
```

Required:

- Normal uncertainty returns `not_found`, `ambiguous`, `review_required`, `failed`, `login_required`, or `captcha_or_2fa_required`.
- Fatal programmer or browser-transport errors may throw only at internal boundaries and must be mapped by the public child ability boundary when possible.
- Review-required must include a reason.
- Failure must include a reason.

Forbidden:

- Throwing `not_found` or `ambiguous` as the normal locator API result.
- Returning `ok: true` without action verification.
- Treating screenshot failure as successful action evidence.

## 6. Law APEX-DOM-004-V1 — Snapshot Safety

```apex-law
{
  "lawId": "APEX-DOM-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+runtime-evidence",
  "summary": "DOM snapshots must be privacy-safe structural summaries, not raw page dumps.",
  "appliesTo": [
    "src/capabilities/dom-automation/runtime/dom-snapshot.ts",
    "src/capabilities/dom-automation/schema.ts"
  ],
  "forbidden": [
    "Snapshot returning full HTML.",
    "Snapshot returning cookies or storage.",
    "Snapshot returning password values.",
    "Snapshot returning full file input values.",
    "Snapshot returning unbounded page text."
  ]
}
```

Required:

- Snapshot output is schema-validated.
- Text is clipped.
- Password and hidden values are excluded.
- File input values and file contents are never exposed.
- Detected states are page-state hints only, not business truth.

Forbidden:

- Full DOM serialization.
- Full page text dump.
- Cookie, token, localStorage, sessionStorage, password, or file content capture.

## 7. Law APEX-DOM-005-V1 — Locator Stability

```apex-law
{
  "lawId": "APEX-DOM-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+runtime-evidence",
  "summary": "DOM location must use semantic signals and revalidation, not selector-only guesswork.",
  "appliesTo": [
    "src/capabilities/dom-automation/runtime/dom-locator.ts",
    "src/capabilities/dom-automation/schema.ts"
  ],
  "forbidden": [
    "Selector-only element identity.",
    "CSS fallback marked as high confidence.",
    "Ambiguous candidates returned as success.",
    "Frame hint ignored when frame support is requested.",
    "Business-specific selector hardcoding in DOM core."
  ]
}
```

Required:

- Element references include selector, target kind, confidence, matched signals, reason, and fallback flag.
- High confidence requires semantic signals such as accessible name, label, role, placeholder, visible text, name/id, or test id.
- Ambiguity must return or map to `ambiguous`.
- CSS fallback must lower confidence and mark fallback use.
- Locator must not embed platform-specific selectors or business terms.

Forbidden:

- `nth-of-type` fallback as production-grade high confidence.
- Silent best-guess selection when top candidates are close.
- Ignoring hidden/disabled state except for lawful file input upload.

## 8. Law APEX-DOM-006-V1 — Frame / Shadow Boundary

```apex-law
{
  "lawId": "APEX-DOM-006-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+runtime-evidence",
  "summary": "Frame and shadow DOM handling must be explicit and must not pretend unsupported scopes are supported.",
  "appliesTo": [
    "src/capabilities/dom-automation/**/*.{ts,tsx}"
  ],
  "forbidden": [
    "Returning frameRef without action support.",
    "Ignoring frameRef during fill/click/upload.",
    "Pretending cross-origin frame contents were inspected.",
    "Shadow DOM action without host-level revalidation."
  ]
}
```

Required:

- If snapshot reports frames, it must distinguish frame metadata from inspected frame content.
- If an element has `frameRef`, fill/click/upload must either execute in that frame or return `review_required`.
- Cross-origin frames may be reported as frame summaries but must not be treated as inspected DOM.
- Shadow DOM access must remain host-scoped and revalidated before action.

Forbidden:

- Fake frame support.
- Cross-origin frame scraping.
- Acting on a frame element using active-document selector only.

## 9. Law APEX-DOM-007-V1 — Fill Safety

```apex-law
{
  "lawId": "APEX-DOM-007-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+runtime-evidence",
  "summary": "DOM fill may write only caller-approved text into a revalidated writable element.",
  "appliesTo": [
    "src/capabilities/dom-automation/runtime/dom-fill.ts",
    "src/capabilities/dom-automation/schema.ts"
  ],
  "forbidden": [
    "Filling password inputs.",
    "Filling empty or AI-generated business values.",
    "Filling hidden or disabled elements.",
    "Success without value verification.",
    "Fill without before and after evidence."
  ]
}
```

Required:

- `approvedText` comes from the job flow input or flow-owned business state.
- The element must be revalidated as visible, enabled, and writable.
- Password fields return `review_required`.
- Action result must include before/after evidence or fail/review.
- Filled value must be verified before success.

## 10. Law APEX-DOM-008-V1 — Click Safety

```apex-law
{
  "lawId": "APEX-DOM-008-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+runtime-evidence",
  "summary": "DOM click must be located-element-first and must block sensitive irreversible actions.",
  "appliesTo": [
    "src/capabilities/dom-automation/runtime/dom-click.ts",
    "src/capabilities/dom-automation/schema.ts"
  ],
  "forbidden": [
    "Coordinate-first click as DOM action identity.",
    "Clicking hidden or disabled elements.",
    "Sensitive irreversible click without review_required.",
    "Click success without after evidence.",
    "Expected text mismatch treated as success."
  ]
}
```

Required:

- DOM selector and text/kind revalidation happen before the click.
- Coordinates may be used only as browser execution transport after DOM target selection.
- Dangerous text or irreversible action terms must return `review_required` unless an explicit domain law authorizes the flow.
- After evidence is required for success.

Forbidden:

- Restoring mouse-click ability as a top-level owner.
- AI-visible coordinates.
- Raw browser click from job flow when DOM click should be used.

## 11. Law APEX-DOM-009-V1 — Approved Upload Safety

```apex-law
{
  "lawId": "APEX-DOM-009-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast+runtime-evidence",
  "summary": "DOM upload may attach only a task-approved local file to a located file input.",
  "appliesTo": [
    "src/capabilities/dom-automation/runtime/dom-upload.ts",
    "src/capabilities/dom-automation/schema.ts",
    "src/lib/browser/**/*.{ts,tsx}"
  ],
  "forbidden": [
    "Arbitrary file path upload.",
    "Upload target not located as file input.",
    "Reading file content into AI or DOM snapshot.",
    "Upload success without before and after evidence.",
    "Business plugin directly using browser file-input private implementation."
  ]
}
```

Required:

- Approved file path must match the task-approved path after resolution.
- File must exist and be a file.
- Extension must be allowlisted.
- File input target kind must be `file-input`.
- Browser file-input support is a low-level port; business plugins call DOM upload, not browser private upload code.
- Upload returns structured success/failure/review-required.

## 12. Law APEX-DOM-010-V1 — Wait / Verify Truth

```apex-law
{
  "lawId": "APEX-DOM-010-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+runtime-evidence",
  "summary": "DOM wait and verify must report observed page state, not business completion fiction.",
  "appliesTo": [
    "src/capabilities/dom-automation/runtime/dom-wait.ts",
    "src/capabilities/dom-automation/runtime/dom-verify.ts",
    "src/capabilities/dom-automation/schema.ts"
  ],
  "forbidden": [
    "Unknown state returned as success.",
    "File-selected state treated as final business success.",
    "Login or captcha state downgraded to not_found.",
    "Verification evidence ref that cannot be traced to an observed snapshot or action.",
    "Business success terms hardcoded in DOM core."
  ]
}
```

Required:

- `login_required` and `captcha_or_2fa_required` outrank generic success/failure hints.
- `file_selected` is not final upload success unless the job flow explicitly expects only file selection.
- Ambiguous success and failure signals return `ambiguous`.
- Timeouts return the latest structured observed status, not fake success.
- Verification evidence must reference a real observation when the evidence store supports it; synthetic ids are temporary only and must be inventory-tracked.

## 13. Law APEX-DOM-011-V1 — Evidence and Logging Boundary

```apex-law
{
  "lawId": "APEX-DOM-011-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast+runtime-evidence",
  "summary": "DOM action evidence must be truthful while storage and logging ownership stay outside DOM Automation.",
  "appliesTo": [
    "src/capabilities/dom-automation/**/*.{ts,tsx}",
    "src/lib/runtime-logs/**/*.{ts,tsx}",
    "src/capabilities/forensics-persistence/**/*.{ts,tsx}"
  ],
  "forbidden": [
    "DOM runtime owning evidence storage truth.",
    "DOM runtime creating a private log system.",
    "Forged screenshot or snapshot evidence.",
    "Stale evidence reused as fresh proof.",
    "Sensitive data logged from DOM snapshots or actions."
  ]
}
```

Required:

- DOM may request browser evidence captures.
- DOM may return evidence refs.
- Evidence store owns persistence truth.
- Runtime logs own log transport and redaction.
- Evidence refs must correspond to real attempted actions or observations.

Forbidden:

- DOM appending private JSONL logs.
- DOM saving its own evidence database.
- DOM logging cookies, tokens, passwords, full HTML, localStorage, sessionStorage, file contents, or private PDF contents.

## 14. Law APEX-DOM-012-V1 — Replacement of Retired Action Owners

```apex-law
{
  "lawId": "APEX-DOM-012-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "DOM Automation replaces retired standalone text input, mouse click, open, screenshot, and upload action owners for DOM page work.",
  "appliesTo": [
    "src/**/*.{ts,tsx,js,jsx,mjs}",
    "scripts/**/*.{ts,js,mjs}",
    "package.json"
  ],
  "forbidden": [
    "Standalone text-input ability owner resurrection.",
    "Standalone mouse-click ability owner resurrection.",
    "Coordinate-first page action owner resurrection.",
    "Open/screenshot/upload standalone workflow owner resurrection.",
    "Muscle-memory or platform registry as DOM workflow truth."
  ]
}
```

Required:

- Text entry is `fill-dom-element-once`.
- Page clicking is `click-dom-element-once` after DOM location.
- File attachment is `upload-approved-file-once`.
- DOM observation is `read-dom-snapshot-once`.
- Verification is `verify-dom-state-once` or `wait-for-dom-state-once`.

Forbidden:

- Retired action owners returning as top-level active architecture.
- AI-visible action codes for DOM internals.
- Coordinate grid proof as DOM action identity.

## 15. Law APEX-DOM-013-V1 — Audit Enforcement

```apex-law
{
  "lawId": "APEX-DOM-013-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "hybrid",
  "summary": "DOM Automation must have runner-visible enforcement before production readiness can be claimed.",
  "appliesTo": [
    "scripts/audit/**/*.{ts,js,mjs,json}",
    "scripts/acceptance/**/*.{ts,js,mjs}",
    "package.json"
  ],
  "forbidden": [
    "Claiming DOM production readiness without DOM audit coverage.",
    "DOM inspector detached from CI or audit plan.",
    "Warning-only P0 DOM findings.",
    "Acceptance smoke that uses fake success instead of real DOM actions.",
    "Generated audit artifacts hand-edited to include DOM pass."
  ]
}
```

Minimum DOM inspector checks:

- DOM law parses as `apex-law`.
- DOM public child ability list matches schema and facade.
- Plugins import only the DOM public facade.
- DOM runtime does not import plugins.
- Mediator does not import DOM runtime.
- Retired action owner paths are absent.
- Locator does not use normal `throw` for `not_found` / `ambiguous` once structured locate result is implemented.
- Upload requires approved path and file input target.
- Click sensitive terms return review-required.

Minimum acceptance:

- Local DOM fixture smoke covers snapshot, locate, fill, click, upload, wait, and verify.
- Amazon invoice upload smoke remains a job-flow acceptance, not DOM-only proof.

## 16. Production Readiness Gate

DOM Automation may be called production-stable only when all are true:

- This law and the construction blueprint agree.
- All seven legal child abilities exist and are exported from the public facade.
- Normal uncertainty returns structured results.
- Frame/shadow support is either implemented or explicitly returns review-required.
- Action evidence is real and traceable.
- Upload cannot use arbitrary paths.
- Sensitive clicks require review unless a business law explicitly authorizes final action.
- DOM core contains no platform-specific workflow.
- Plugins import only the public facade.
- DOM inspector is runner-visible.
- DOM acceptance smoke covers every child ability.

If any item is missing, the correct status is:

```txt
DOM Automation is active but not production-stable.
```

## 17. Final Principle

```txt
DOM Automation is allowed to know the page structure.
It is not allowed to know the business mission.

DOM may locate, fill, click, upload, wait, and verify.
It may not plan, decide the workflow, forge evidence, or become a second flow.
```
