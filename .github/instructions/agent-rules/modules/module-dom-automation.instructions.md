---
name: "GrassEye DOM Automation Capability"
description: "Production-grade law for the six DOM Automation abilities: snapshot, locate, fill, click, upload, one-shot verify, structured failure, evidence truth, SPA/dynamic content, frame/shadow boundaries, and audit enforcement."
applyTo: "src/capabilities/dom-automation/**,src/plugins/**,src/mediator/**,src/lib/browser/**,scripts/acceptance/**,scripts/audit/**"
---

# GrassEye DOM Automation Capability

status: active
version: 2026-08-16-v5
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
- One-shot DOM state verification.

DOM Automation does not own:

- User-demand routing.
- Business job flow.
- Platform-specific decisions.
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
  "codePurityLiveness": {
    "externalEntryFiles": [
      "src/capabilities/dom-automation/index.ts"
    ],
    "externalEntryExports": [
      { "filePath": "src/capabilities/dom-automation/index.ts", "exportName": "readDomSnapshotOnce" },
      { "filePath": "src/capabilities/dom-automation/index.ts", "exportName": "locateDomElementOnce" },
      { "filePath": "src/capabilities/dom-automation/index.ts", "exportName": "fillDomElementOnce" },
      { "filePath": "src/capabilities/dom-automation/index.ts", "exportName": "uploadApprovedFileOnce" },
      { "filePath": "src/capabilities/dom-automation/index.ts", "exportName": "verifyDomStateOnce" }
    ]
  },
  "appliesTo": [
    "src/capabilities/dom-automation/**/*.{ts,tsx,js,jsx,mjs}"
  ],
  "forbidden": [
    "Amazon-specific workflow inside DOM Automation.",
    "Platform-specific workflow inside DOM Automation.",
    "Business success decision inside DOM Automation.",
    "DOM code importing src/plugins.",
    "DOM code calling AI to plan browser actions."
  ],
  "clauses": [
    {
      "clauseId": "apex-dom-001-requirement",
      "statement": "DOM Automation must remain business-neutral and must not contain platform-specific workflow logic.",
      "evidenceMode": "static",
      "ownerDomain": "dom-automation"
    }
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
  ],
  "clauses": [
    {
      "clauseId": "apex-dom-002-requirement",
      "statement": "Public consumers may import DOM Automation only through its public facade.",
      "evidenceMode": "static",
      "ownerDomain": "dom-automation"
    }
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
  ],
  "clauses": [
    {
      "clauseId": "apex-dom-003-requirement",
      "statement": "Expected DOM uncertainty must return structured statuses instead of escaping as ordinary exceptions.",
      "evidenceMode": "static",
      "ownerDomain": "dom-automation"
    }
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
  ],
  "clauses": [
    {
      "clauseId": "apex-dom-004-requirement",
      "statement": "DOM snapshots must be privacy-safe structural summaries, not raw page dumps.",
      "evidenceMode": "acceptance",
      "ownerDomain": "dom-automation"
    }
  ]
}
```

Required:

- Snapshot output is schema-validated.
- Text is clipped.
- Password and hidden values are excluded.
- File input values and file contents are never exposed.
- Detected states are page-state hints only, not business truth.

**SPA / Dynamic Content:**

- Snapshot must support capturing post-hydration DOM state (React, Vue, Angular, Svelte rendered output).
- If the page is still loading when snapshot is requested, detected state must include `loading` or return a clear observable status; fake completion is forbidden.
- Lazy-loaded content that has not yet entered the DOM must not be reported as present.
- Virtual scroll containers must report container presence and visible row count, not fabricate off-screen rows.

**Custom Component Recognition:**

- Snapshot must recognise interactive roles from common Chinese and international back-office component libraries: Ant Design, Element Plus, Arco Design, Naive UI, Bootstrap, Material UI.
- Custom dropdown triggers (`role=combobox`, `aria-haspopup`, `aria-expanded`) must be detected as `dropdown-trigger` candidates.
- Date pickers, tab panels, accordion toggles, rich-text editors, and slider controls must be reported with their semantic role, not ignored.
- Table cells that act as clickable row actions must be captured as `genericClickableElements`.

**Overlay / Modal Awareness:**

- Snapshot must report active overlay presence as `detectedStates` entries: `cookie-consent-overlay`, `promotional-overlay`, `modal-dialog`, `drawer-panel`.
- The topmost interactive layer must be identified; sub-layers behind an overlay must be marked as obscured.
- Fixed-position banners (GDPR, cookie) must not be silently omitted.

**Loading and Error States:**

- `loading-skeleton`, `empty-state`, `error-state`, `success-state`, and `rate-limited` must be detectable and expressible as `detectedStates`.
- Pagination controls must be captured so job flows can reason about multi-page content.

**Multi-language Support:**

- Snapshot must correctly capture CJK (Chinese, Japanese, Korean) text without truncation artefacts.
- Placeholder and accessible-name extraction must handle UTF-8 label text without restriction.

Forbidden:

- Full DOM serialization.
- Full page text dump.
- Cookie, token, localStorage, sessionStorage, password, or file content capture.
- Reporting skeleton or spinner state as interactive content.
- Claiming overlay-obscured elements are actionable.

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
  ],
  "clauses": [
    {
      "clauseId": "apex-dom-005-requirement",
      "statement": "DOM location must use semantic signals and revalidation, not selector-only guesswork.",
      "evidenceMode": "acceptance",
      "ownerDomain": "dom-automation"
    }
  ]
}
```

Required:

- Element references include selector, target kind, confidence, matched signals, reason, and fallback flag.
- High confidence requires semantic signals such as accessible name, label, role, placeholder, visible text, name/id, or test id.
- Ambiguity must return or map to `ambiguous`.
- CSS fallback must lower confidence and mark fallback use.
- Locator must not embed platform-specific selectors or business terms.

**Proximity-Based Location:**

- When a target cannot be identified by text or ARIA signals alone, the locator must support proximity hints: find interactive element spatially nearest to a given label, heading, or anchor text.
- Proximity match must document the anchor it used and lower confidence relative to a direct semantic match.
- Proximity fallback must never produce high-confidence false positives.

**Component Library Pattern Awareness:**

- Custom dropdown triggers must be detectable: `role=combobox`, `aria-haspopup="listbox"`, `aria-expanded`, common class-name patterns for Ant Design (`ant-select`), Element Plus (`el-select`), Arco Design (`arco-select`), Select2 (`.select2-container`).
- Tab panels: `role=tab`, `aria-selected` patterns.
- Modal/dialog triggers: `role=dialog`, `aria-modal`, common overlay class patterns.
- Rich-text editors: `contenteditable`, `role=textbox` with `aria-multiline`.
- The locator must not hardcode platform-specific class names as primary identity signals; they may be secondary fallback signals with lowered confidence.

**Dynamic Attribute Handling:**

- Hashed CSS class names (styled-components, CSS Modules, Tailwind JIT variants) must not be used as primary identity.
- Stable signals (accessible name, role, aria-*, data-testid, data-automation-id, id, name) take priority.
- If only hashed classes are available, the locator must apply semantic-role scoring and lower confidence accordingly.

**Fuzzy Text Matching:**

- Visible text matching must support case-insensitive and diacritic-insensitive comparison.
- CJK (Chinese, Japanese, Korean) text matching must not require byte-exact match when substring match is unambiguous.
- Partial match with a uniqueness score above a defined threshold is allowed as a low-confidence signal only.

Forbidden:

- `nth-of-type` fallback as production-grade high confidence.
- Silent best-guess selection when top candidates are close.
- Ignoring hidden/disabled state except for lawful file input upload.
- Hardcoded platform-specific CSS class as a primary high-confidence locator signal.
- Proximity match reporting high confidence when the anchor was itself ambiguous.

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
  ],
  "clauses": [
    {
      "clauseId": "apex-dom-006-requirement",
      "statement": "Frame and shadow DOM handling must be explicit and must not pretend unsupported scopes are supported.",
      "evidenceMode": "acceptance",
      "ownerDomain": "dom-automation"
    }
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
  ],
  "clauses": [
    {
      "clauseId": "apex-dom-007-requirement",
      "statement": "DOM fill may write only caller-approved text into a revalidated writable element.",
      "evidenceMode": "acceptance",
      "ownerDomain": "dom-automation"
    }
  ]
}
```

Required:

- `approvedText` comes from the job flow input or flow-owned business state.
- The element must be revalidated as visible, enabled, and writable.
- Password fields return `review_required`.
- Action result must include before/after evidence or fail/review.
- Filled value must be verified before success.
- Text entry must use one `fill_dom_target` command that revalidates identity and receiver, applies only approved text, dispatches the component input/change events and verifies the exact retained value before returning; split click/text entry and second verification paths are forbidden.

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
  ],
  "clauses": [
    {
      "clauseId": "apex-dom-008-requirement",
      "statement": "DOM click must be located-element-first and must block sensitive irreversible actions.",
      "evidenceMode": "acceptance",
      "ownerDomain": "dom-automation"
    }
  ]
}
```

Required:

- DOM selector, captured identity and text/kind revalidation happen inside the same `click_dom_target` command that clicks the resolved object.
- A previously observed coordinate is never accepted as DOM action identity or transport.
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
  ],
  "clauses": [
    {
      "clauseId": "apex-dom-009-requirement",
      "statement": "DOM upload may attach only a task-approved local file to a located file input.",
      "evidenceMode": "acceptance",
      "ownerDomain": "dom-automation"
    }
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

## 12. Law APEX-DOM-010-V1 — One-shot Verification Truth

```apex-law
{
  "lawId": "APEX-DOM-010-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+runtime-evidence",
  "summary": "DOM verification must report one observed page state; bounded repeated observation belongs to the owning business flow.",
  "appliesTo": [
    "src/capabilities/dom-automation/runtime/dom-verify.ts",
    "src/capabilities/dom-automation/schema.ts"
  ],
  "forbidden": [
    "Unknown state returned as success.",
    "File-selected state treated as final business success.",
    "Login or captcha state downgraded to not_found.",
    "Verification evidence ref that cannot be traced to an observed snapshot or action.",
    "Business success terms hardcoded in DOM core.",
    "An underlying DOM snapshot evaluation that can outlive the caller's governed observation deadline.",
    "A positive hint accepted while a negative, loading, stale, foreign or duplicate state remains unresolved.",
    "An unconditional observe, locate, retry or scroll loop."
  ],
  "clauses": [
    {
      "clauseId": "apex-dom-010-requirement",
      "statement": "DOM verification must report one observed page state; bounded repeated observation belongs to the owning business flow.",
      "evidenceMode": "acceptance",
      "ownerDomain": "dom-automation"
    }
  ]
}
```

Required:

- `login_required` and `captcha_or_2fa_required` outrank generic success/failure hints.
- `file_selected` is not final upload success unless the job flow explicitly expects only file selection.
- Ambiguous success and failure signals return `ambiguous`.
- A production finite-observation contract carries caller-owned positive facts and named negative exclusions; DOM core reports the observed conflict but never invents business meaning.
- A single-target locate returns success only for exactly one candidate and excludes hidden, disabled, stale, foreign-document and equal-score duplicate candidates.
- Timeouts return the latest structured observed status, not fake success.
- Every observe, locate, retry and scroll sequence ends at an explicit count or deadline; budget exhaustion never authorizes another action path.
- DOM core exposes no generic polling owner; each business flow owns its named finite observation count or deadline and calls one-shot snapshot and verification primitives.
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
  ],
  "clauses": [
    {
      "clauseId": "apex-dom-011-requirement",
      "statement": "DOM action evidence must be truthful while storage and logging ownership stay outside DOM Automation.",
      "evidenceMode": "acceptance",
      "ownerDomain": "dom-automation"
    }
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
  ],
  "clauses": [
    {
      "clauseId": "apex-dom-012-requirement",
      "statement": "DOM Automation replaces retired standalone text input, mouse click, open, screenshot, and upload action owners for DOM page work.",
      "evidenceMode": "static",
      "ownerDomain": "dom-automation"
    }
  ]
}
```

Required:

- Text entry is `fill-dom-element-once`.
- Page clicking is `click-dom-element-once` after DOM location.
- File attachment is `upload-approved-file-once`.
- DOM observation is `read-dom-snapshot-once`.
- Verification is `verify-dom-state-once`; repeated observation is an explicit bounded sequence owned by the calling Business Flow.

Forbidden:

- Retired action owners returning as top-level active architecture.
- AI-visible action codes for DOM internals.
- Coordinate grid proof as DOM action identity.

## 15. Retired Law APEX-DOM-014-V1 — Scroll-to Safety

```apex-law
{
  "lawId": "APEX-DOM-014-V1",
  "status": "retired",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+runtime-evidence",
  "summary": "DOM scroll must bring a located element into viewport before any action and must not loop infinitely.",
  "appliesTo": [
    "src/capabilities/dom-automation/runtime/dom-scroll.ts",
    "src/capabilities/dom-automation/schema.ts"
  ],
  "forbidden": [
    "Infinite scroll loop without a max-iteration budget.",
    "Claiming element is in viewport without revalidation.",
    "Scroll success without post-scroll visibility recheck.",
    "Scrolling to an element that was not previously located.",
    "Business plugin calling browser scroll primitive directly."
  ],
  "clauses": [
    {
      "clauseId": "apex-dom-014-requirement",
      "statement": "DOM scroll must bring a located element into viewport before any action and must not loop infinitely.",
      "evidenceMode": "acceptance",
      "ownerDomain": "dom-automation"
    }
  ]
}
```

Required:

- `scroll-to-element-once` accepts a `DomElementRef` from a prior `locate-dom-element-once` result; it does not accept raw selectors.
- After scrolling, the ability must revalidate that the element is within the visible viewport before returning success.
- A scroll budget must be defined: maximum pixel distance or maximum scroll steps per call; exceeding the budget returns `review_required` with reason `element-not-reachable-by-scroll`.
- Sticky headers, fixed toolbars, and anchored navigation must be accounted for in the viewport intersection check (offset calculation).
- Scroll action must capture before/after evidence (screenshot or viewport report).
- Scroll is a support primitive: it must never decide business flow order.

Forbidden:

- Scroll without a located element ref.
- Claiming scroll success when the element is still obscured by a fixed overlay.
- Triggering infinite scroll as a page navigation strategy.
- Using scroll as a business-step decision point.

## 16. Retired Law APEX-DOM-015-V1 — Select / Dropdown Safety

```apex-law
{
  "lawId": "APEX-DOM-015-V1",
  "status": "retired",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+runtime-evidence",
  "summary": "DOM option selection must handle native select and common custom dropdown patterns, verify the selection was applied, and return structured results.",
  "appliesTo": [
    "src/capabilities/dom-automation/runtime/dom-select.ts",
    "src/capabilities/dom-automation/schema.ts"
  ],
  "forbidden": [
    "Selecting arbitrary option text not from caller-approved list.",
    "Claiming selection success without verifying the displayed value changed.",
    "Using fill to set a native select element's value directly.",
    "Custom dropdown interaction without detecting its open/close state.",
    "Multi-select without explicit caller approval of each selected value."
  ],
  "clauses": [
    {
      "clauseId": "apex-dom-015-requirement",
      "statement": "DOM option selection must handle native select and common custom dropdown patterns, verify the selection was applied, and return structured results.",
      "evidenceMode": "acceptance",
      "ownerDomain": "dom-automation"
    }
  ]
}
```

Required:

- `select-option-once` accepts: the element ref (located as `select`, `combobox`, or `dropdown-trigger`), the `approvedOptionText` string from the job flow, and `matchMode` (`exact` or `contains`).
- Native `<select>` elements must use programmatic value assignment and dispatch `change` event.
- Custom dropdowns (Ant Design Select, Element Plus Select, Select2, Bootstrap Select, `role=combobox + aria-haspopup=listbox`, `aria-expanded` trigger patterns) must be operated by: (1) click the trigger to open the panel, (2) wait for the options panel to appear in the DOM, (3) locate the matching option by text, (4) click the option, (5) wait for the panel to close, (6) verify the trigger's displayed text reflects the selection.
- The selected value must be verified by reading the element's displayed text or value after the interaction. If verification fails, return `failed` with reason.
- If the option text is not found in the open panel, return `not_found`.
- If multiple options partially match and none is an exact match, return `ambiguous` with candidate evidence.
- Multi-select operations require `approvedOptionList` from the caller; selecting all vs. selecting specific items must be explicit.
- Selection evidence must include before and after screenshots or DOM state capture.

Forbidden:

- Setting `.value` on a custom dropdown container without triggering its event system.
- Assuming options are present without waiting for the panel to render (lazy option loading is common).
- Using keyboard-only navigation as the sole selection strategy on pages where ARIA keyboard support is absent.
- Hardcoding Ant Design or other library-specific class names as the option selection mechanism.

## 17. Retired Law APEX-DOM-016-V1 — Overlay Dismissal Safety

```apex-law
{
  "lawId": "APEX-DOM-016-V1",
  "status": "retired",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+runtime-evidence",
  "summary": "DOM overlay dismissal may only remove safe non-blocking consent or informational overlays and must return review_required for all ambiguous or sensitive dialogs.",
  "appliesTo": [
    "src/capabilities/dom-automation/runtime/dom-dismiss-overlay.ts",
    "src/capabilities/dom-automation/schema.ts"
  ],
  "forbidden": [
    "Dismissing authentication dialogs.",
    "Dismissing business confirmation dialogs (e.g. payment, refund, deletion).",
    "Dismissing overlays whose purpose cannot be determined from detectedState.",
    "Clicking Escape as a universal dismiss without verifying overlay type.",
    "Claiming dismiss success when the overlay is still present in the DOM."
  ],
  "clauses": [
    {
      "clauseId": "apex-dom-016-requirement",
      "statement": "DOM overlay dismissal may only remove safe non-blocking consent or informational overlays and must return review_required for all ambiguous or sensitive dialogs.",
      "evidenceMode": "acceptance",
      "ownerDomain": "dom-automation"
    }
  ]
}
```

Required:

- `dismiss-overlay-once` accepts: the detected overlay state from snapshot (`cookie-consent-overlay`, `promotional-overlay`, or `informational-banner`), and the `approvedDismissalText` string (the button/link text to click, e.g. "Accept", "Close", "Got it", "同意", "关闭").
- Before acting, the ability must re-read the current snapshot to confirm the overlay is still present and matches the expected type.
- Allowed dismissable overlay types: `cookie-consent-overlay`, `promotional-overlay`, `informational-banner`, `gdpr-consent`, `app-install-prompt`.
- Forbidden to dismiss: `modal-dialog` with unknown purpose, authentication prompts, payment confirmation dialogs, delete confirmation dialogs, or any overlay not listed as safe.
- If the detected overlay type is not in the safe allowlist, return `review_required` with reason `overlay-type-not-in-safe-dismissal-allowlist`.
- After dismissal click, the ability must wait up to a defined timeout for the overlay to disappear from the DOM and capture after evidence.
- If the overlay persists after the click, return `failed` with reason `overlay-still-present`.

Forbidden:

- Dismissing overlays whose content text suggests payment, deletion, or authentication.
- Using Escape key dismiss without first classifying the overlay type.
- Hardcoding "Accept all cookies" in DOM core; the job flow provides the approved text.
- Treating overlay dismissal as a business step; it is a page-clearing support action only.

## 18. Law APEX-DOM-020-V1 — Exact Target And Document Binding

```apex-law
{
  "lawId": "APEX-DOM-020-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance+real-chrome",
  "summary": "Every DOM ref and action must remain bound to one opaque BrowserTargetRef and one current BrowserDocumentRef.",
  "required": [
    "Every atomic action is IF plus AND then THEN: IF identifies the current exact Document and candidate, AND proves exact identity, visibility, enabled state, uniqueness and adjacent-state exclusion, and THEN performs exactly one mutation; the following action starts only after that mutation's own postcondition is resolved.",
    "Text identity that distinguishes adjacent labels such as high and extra high uses exact normalized equality rather than substring containment.",
    "Timeout and deadline only bound observation and fail closed; fixed sleep, elapsed duration or retry count cannot establish success or authorize mutation.",
    "Every DomSnapshot and DomElementRef records an opaque targetRef plus documentRef minted by the Browser owner; selectors and coordinates are never sufficient identity.",
    "Snapshot, locate, fill, click, upload and one-shot verify reject stale, foreign, navigated or mismatched document refs before side effects.",
    "DOM actions and file input use target-bound Chrome extension commands without foreground focus; native picker, clipboard and PhysicalFocusLease paths are absent.",
    "After navigation the caller must acquire a new document ref and re-read the page before any further DOM action.",
    "The uniquely clause-bound deferred real-Chrome verifier must read the Browser owner's canonical hash-chain journal, bind the current source candidate and thirty-minute window, and require one completed document observation followed by one exact click PREPARED/SEND/UNKNOWN/CONFIRMED chain on the same target and document."
  ],
  "forbidden": [
    "one postcondition or OutcomeResolutionReceipt confirming more than one mutation",
    "a second mutation while the prior mutation is unresolved",
    "substring matching used as exact identity or fixed sleep used as a production transition",
    "evaluateActiveTab or any active/current/first page fallback",
    "raw tab, target, session or window identifiers in DOM public contracts",
    "reusing an element ref after document generation changes",
    "system mouse or keyboard for ordinary DOM click or fill",
    "business plugins bypassing the DOM facade to call browser page primitives"
  ],
  "clauses": [
    {
      "clauseId": "apex-dom-020-requirement",
      "statement": "Every DOM ref and action must remain bound to one opaque BrowserTargetRef and one current BrowserDocumentRef.",
      "evidenceMode": "real-chrome",
      "ownerDomain": "dom-automation"
    }
  ]
}
```

## 19. Web Compatibility Covenant

The six active child abilities collectively must cover the interaction surface of the currently claimed web back-office interaction surface.

### Capability Coverage Map

| Web reality | Child ability |
|---|---|
| Static HTML pages | `read-dom-snapshot-once`, `locate-dom-element-once`, `fill-dom-element-once`, `click-dom-element-once` |
| React / Vue / Angular SPAs | All of the above, with SPA hydration awareness in snapshot |
| File upload fields | `upload-approved-file-once` |
| Login walls, CAPTCHA challenges | `read-dom-snapshot-once` + `verify-dom-state-once` returns `login_required` / `captcha_or_2fa_required` |
| Post-action confirmation | Business Flow bounded observation + `verify-dom-state-once` |
| iframe-hosted forms | `locate-dom-element-once` with `frameRef`, then fill/click in frame |
| Shadow DOM components | `locate-dom-element-once` with host-scoped revalidation |

### Mandatory Scope Claim

DOM Automation does not claim to handle:

- CAPTCHA solving (returns `captcha_or_2fa_required`; human or external service handles it).
- OAuth / SSO login flows (returns `login_required`; job flow decides how to proceed).
- Fully canvas-rendered UIs with no accessible DOM (returns `review_required`; DOM cannot see what is not in the DOM).
- Downloaded file content analysis (belongs to other capability groups).
- AI-based visual understanding (forbidden by GrassEye architecture law).

### Web Compatibility P0 Gate

DOM Automation must not claim web compatibility readiness unless it can demonstrably handle all rows in the Capability Coverage Map above, or explicitly documents each gap with a structured `review_required` return and a known remediation path.

## 20. Law APEX-DOM-013-V1 — Audit Enforcement

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
  ],
  "clauses": [
    {
      "clauseId": "apex-dom-013-requirement",
      "statement": "DOM Automation must have runner-visible enforcement before production readiness can be claimed.",
      "evidenceMode": "static",
      "ownerDomain": "dom-automation"
    }
  ]
}
```

Minimum DOM inspector checks:

- DOM law parses as `apex-law`.
- DOM public child ability list matches schema and facade (six legal values).
- Plugins import only the DOM public facade.
- DOM runtime does not import plugins.
- Mediator does not import DOM runtime.
- Retired action owner paths are absent.
- Locator does not use normal `throw` for `not_found` / `ambiguous` once structured locate result is implemented.
- Upload requires approved path and file input target.
- Click sensitive terms return review-required.

Minimum acceptance:

- Local DOM fixture smoke covers all six child abilities: snapshot, locate, fill, click, upload, and verify.
- Amazon invoice upload smoke remains a job-flow acceptance, not DOM-only proof.

## 21. Production Readiness Gate

DOM Automation may be called production-stable only when all are true:

- This law and the construction blueprint agree.
- All six legal child abilities exist and are exported from the public facade.
- Normal uncertainty returns structured results.
- Frame/shadow support is either implemented or explicitly returns review-required.
- Action evidence is real and traceable.
- Upload cannot use arbitrary paths.
- Sensitive clicks require review unless a business law explicitly authorizes final action.
- DOM core contains no platform-specific workflow.
- Plugins import only the public facade.
- DOM inspector is runner-visible.
- DOM acceptance smoke covers every active child ability.
- Snapshot can detect SPA post-hydration state, overlay presence, and loading states.
- Locator supports proximity hints, component library patterns, and CJK text matching.
- Web Compatibility Coverage Map shows no unaddressed gaps without a structured `review_required` return path.

## 21.1 Law APEX-DOM-021-V1 — Atomic Identity Revalidation And Mutation

```apex-law
{
  "lawId": "APEX-DOM-021-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "acceptance+real-chrome",
  "summary": "DOM click and fill must each use one dedicated exact-target Chrome command that revalidates the located identity and performs the mutation on that same resolved object without a coordinate or focus time gap.",
  "appliesTo": [
    "src/capabilities/dom-automation/**/*.{ts,tsx,js,jsx,mjs}",
    "src/lib/browser/**/*.{ts,tsx,js,jsx,mjs}",
    "scripts/acceptance/**/*.{ts,tsx,js,jsx,mjs}"
  ],
  "required": [
    "Click invokes exactly one declaration-only BrowserDomIntent click command; the Browser owner resolves one selector, compares the current DOM identity with the captured identity, validates visibility and enabled state, and clicks that same object in one atomic command.",
    "Fill invokes exactly one declaration-only BrowserDomIntent fill command; the Browser owner resolves one selector and one editable receiver, compares current and captured identities, applies only the approved text, and verifies the exact retained value before returning.",
    "Upload revalidates a supported light-DOM file input and invokes BrowserTargetLease.attachFile with only the caller-approved artifact grant; raw paths never cross the business or Browser wire boundary.",
    "Shadow or frame file-input topology that the unique Browser command cannot address returns structured review_required without a fallback path.",
    "Upload action success means the approved file selection was dispatched once to the resolved receiver; only the owning business flow may interpret its component-specific attachment postcondition.",
    "One uniquely clause-bound deferred real-Chrome verifier must read the Browser owner's canonical hash-chain journal, bind the current source candidate and thirty-minute window, and prove distinct click and fill commands with exact PREPARED/SEND/UNKNOWN/CONFIRMED phase chains, stable target/document/payload identity, authenticated extension result summaries showing one candidate/one mutation/identity revalidation and exact fill retained-value readback, transport and permit sequence receipts, owning-Plugin positive and negative evidence refs, and no fallback verifier path."
  ],
  "forbidden": [
    "A DOM child performing arbitrary evaluation before or after click/fill mutation",
    "page mutation through evaluate_target",
    "a caller-local evaluator, point observation followed by coordinate click, split click/clear/text/Tab fill, foreground-focus fallback or compatibility bridge",
    "claiming unsupported deep shadow or frame upload succeeded",
    "generic text_target, Input.insertText or later input.files retention used as DOM fill/file component commit proof"
  ],
  "clauses": [
    {
      "clauseId": "apex-dom-021-requirement",
      "statement": "DOM click and fill must each implement IF plus AND then one THEN mutation, bind exact identity revalidation and uniqueness into one Chrome command, and require that mutation's own postcondition before any next mutation; timeout only fails closed.",
      "evidenceMode": "acceptance+real-chrome",
      "ownerDomain": "dom-automation"
    }
  ]
}
```

If any item is missing, the correct status is:

```txt
DOM Automation is active but not production-stable.
```

## 22. Final Principle

```txt
DOM Automation is allowed to know the page structure.
It is not allowed to know the business mission.

DOM may snapshot, locate, fill, click, upload, and verify one observation; owning Business Flows perform any bounded repeated-observation sequence.
It may not plan, decide the workflow, forge evidence, or become a second flow.

The six child abilities are the complete hands of GrassEye on governed web pages.
Each ability does exactly one thing. Together they can handle most web pages on the market.
Strength comes from depth within boundary, not from crossing the boundary.
```
