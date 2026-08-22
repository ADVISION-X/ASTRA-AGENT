---
name: "GrassEye AI Input Gateway"
description: "Use when defining external AI feeding, provider delivery, GPT Web session control, web-chat attachment transport, raw-response proof, or provider isolation."
applyTo: "src/capabilities/ai-input-gateway/**/*.{ts,tsx,json},src/lib/browser/browser-authority-api.ts,src/lib/browser/exact-target/**,scripts/audit/domains/ai-input-gateway/**/*.{ts,json},scripts/acceptance/ai-input-gateway-*.ts,docs/法案辅助文件/GrassEye AI 投喂能立组施工图 V1.md"
---

# GrassEye AI Input Gateway

status: active  
version: 2026-08-22.automatic-technical-recovery
capabilityDomain: ai-input-gateway  
capabilityGroupId: ai-input-gateway

AI Input Gateway 只拥有把已治理的提示词与获准文件送到外部 AI、控制该 provider 页面的受治理动作、取回原始回答并形成运输与页面动作证据的权力。业务判断、提示词内容、领域输出校验仍归调用方。

唯一调用方向：

```txt
business owner
  -> AI task capability or law-owned AI stage
      -> AI Input Gateway public contract
          -> GPT Web Session Controller / provider adapter
              -> exact child action
```

```apex-law
{
  "lawId": "APEX-AI-INPUT-GATEWAY-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "ai-input-gateway",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance",
  "summary": "AI Input Gateway is the single provider-transport owner and must preserve a provider-agnostic public request contract.",
  "codePurityLiveness": {
    "auditInspectionFiles": [
      "src/capabilities/ai-input-gateway/acceptance/attachment-script-fixture-support.ts",
      "src/capabilities/ai-input-gateway/acceptance/web-chat-session-controller.acceptance-helper.ts",
      "src/capabilities/ai-input-gateway/providers/web-chat-composer-scripts.ts",
      "src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts",
      "src/capabilities/ai-input-gateway/providers/web-chat-fork-action-scripts.ts",
      "src/capabilities/ai-input-gateway/providers/web-chat-generated-image-capture.ts",
      "src/capabilities/ai-input-gateway/providers/web-chat-response-extraction-script.ts",
      "src/capabilities/ai-input-gateway/providers/web-chat-selector-prelude.ts",
      "src/capabilities/ai-input-gateway/providers/web-chat-submission-checkpoint.ts",
      "src/capabilities/ai-input-gateway/providers/web-chat-submit-attachment-verification.ts",
      "src/capabilities/ai-input-gateway/providers/web-chat-submitted-attachment-evaluation.ts"
    ],
    "lawfulDynamicRegistryConsumers": [
      {
        "consumerFilePath": "src/capabilities/ai-input-gateway/runtime/feed-gemini-api-once.ts",
        "registryFilePath": "src/capabilities/ai-input-gateway/providers/gemini-api.adapter.ts",
        "registryExportName": "geminiApiAdapter"
      },
      {
        "consumerFilePath": "src/capabilities/ai-input-gateway/runtime/feed-gemini-web-chat-once.ts",
        "registryFilePath": "src/capabilities/ai-input-gateway/providers/gemini-web-chat.adapter.ts",
        "registryExportName": "geminiWebChatAdapter"
      },
      {
        "consumerFilePath": "src/capabilities/ai-input-gateway/runtime/feed-gpt-web-chat-once.ts",
        "registryFilePath": "src/capabilities/ai-input-gateway/providers/gpt-web-chat.adapter.ts",
        "registryExportName": "gptWebChatAdapter"
      }
    ]
  },
  "required": [
    "The canonical ability-group id is ai-input-gateway and its public execute contract accepts governed prompt identity, input refs, provider kind, an exact attachment-count envelope, optional internally minted continuation proof, and for production GPT Web one hash-bound provider execution profile. It has no caller-supplied prompt character, byte or token budget and no local prompt-capacity admission gate across Plugin, Gateway, Browser transport or Extension; known 100 MB provider feeding is a regression scenario rather than a new ceiling, and only the real provider window decides whether a governed prompt can be accepted.",
    "Every provider execution returns one AiFeedResult with raw response identity and provider proof. Production GPT Web proof contains the actually observed execution profile and, when the session is title-managed, the verified conversation-title finalization proof.",
    "Business owners call only the AI Input Gateway public contract. Every production GPT Web request must already carry the one canonical hash-bound provider execution profile before Gateway admission, parsing and input hashing; missing profile or caller-supplied split model/reasoning controls fail closed, with no default, normalization, alias or compatibility branch."
  ],
  "forbidden": [
    "business plugins importing provider adapters, provider SDKs, provider DOM, browser selectors, coordinates, tab ids, or browser commands",
    "AI Input Gateway making business judgments or validating domain output meaning",
    "maxInputChars, a prompt character/byte/token ceiling, a prompt budget increase, prompt splitting, or any local prompt-capacity rejection before the real provider window",
    "a second provider transport owner, compatibility transport wrapper, provider-specific business API, parallel GPT page-control chain, or title-housekeeping worker",
    "a production profile default, legacy caller normalization, compatibility profile reader, or proof minted for a request that did not carry the canonical profile"
  ],
  "clauses": [
    {
      "clauseId": "apex-ai-input-gateway-001-requirement",
      "statement": "AI Input Gateway is the single provider-transport owner and must preserve a provider-agnostic public request contract.",
      "evidenceMode": "acceptance",
      "ownerDomain": "ai-input-gateway"
    }
  ]
}
```

```apex-law
{
  "lawId": "APEX-AI-INPUT-GATEWAY-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "ai-input-gateway",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "acceptance",
  "summary": "Web-chat provider work must use an operator-authorized authenticated Browser authority lease and exact target/document lease, fail closed on provider security barriers, and preserve exact raw response truth.",
  "required": [
    "GPT Web adapters consume the operator-authorized Browser authority lease and exact target/document lease injected through the Browser public facade; they never self-issue a Session Workspace, open a private Browser transport, or cache a legacy session. Exactly one controlled physical ChatGPT target is used at a time, while independent tasks live in separately created ChatGPT conversations rather than separate browser tabs.",
    "The serialized browser-mutation lease covers only bounded page mutations such as fresh-conversation establishment, exact conversation switching, profile control, attachment selection, prompt entry, submission proof, title finalization, DOM capture and cleanup; provider generation wait never holds that lease. Submission and patrol waiters use one SQLite ticket ledger. A Cloud-owned production submission carries an opaque owner-minted admissionRef plus immutable created_at, job_id and stage priority key; Gateway persists those values and admits the globally oldest priority key, using its monotonic local ticket only as a deterministic tie-break and accounting receipt. The same waiter and execution retain the serving window from clean-page proof through durable submission checkpoint, and ordinary patrol cannot overtake it.",
    "Independent submitted feeds may remain durably waiting for provider responses, but V5 admits exactly one Browser action in flight through the single physical tab and mutation lock. Browser capacity is fixed by the canonical V5 contract, is never caller-controlled, and has no configurable increase or alternate scheduler.",
    "A provider-side compound observation is an ordered sequence of Browser commands, not a parallel batch. Calls on the same BrowserTargetLease, including document, inspect, find, readText, navigate, attachFile and other DOM intents, must be awaited one at a time; Promise.all, allSettled, detached promises or equivalent fan-out over Browser actions is forbidden because it bypasses the single mutation lane and deterministically produces backpressure instead of a page snapshot.",
    "Every provider mutation is one IF plus AND then THEN transaction: current Document and exact semantic target are positively proved, adjacent labels and invalid states are excluded and uniqueness is one before exactly one mutation; that mutation receives its own postcondition proof and is resolved before another mutation. A page-action proof cannot drain or confirm an accumulated mutation batch.",
    "Exact semantic choices use normalized equality rather than substring containment, so adjacent labels such as high and extra high remain distinct. Fixed sleep and elapsed time never establish provider state; request deadline or timeout only stops unresolved observation safely.",
    "When a plugin-owned task acknowledges takeover, AI Input Gateway records that exact owner key, releases the single provider target to the operator, and makes all new web-chat executions wait without reacquiring the tab until that same owner explicitly resumes.",
    "Login, CAPTCHA, 2FA, risk control, account limits, ambiguous DOM, ambiguous page controls, and unproved native selection return review_required.",
    "Captured response checkpoints, model/profile proof, title proof, provider URL, timing, warnings, continuation topology and failure evidence survive later cleanup or projection failures."
  ],
  "forbidden": [
    "reading cookies, browser storage, passwords, tokens, or hidden credentials",
    "automatic login, CAPTCHA bypass, account rotation, security-barrier bypass, or unbounded retry",
    "patrol, submission or another task reacquiring the provider target while any plugin takeover owner remains active",
    "parallel or detached BrowserTargetLease commands within one provider page operation",
    "a later page-action proof resolving earlier unrelated mutations, a second mutation before the prior one is resolved, substring identity for exact semantic choices, or fixed sleep used as a production transition",
    "downgrading or erasing a completely captured provider response because later title, artifact or cleanup work failed",
    "using application activation, whichever Chrome window is foreground, accessibility window ordering, or a second physical provider tab as page identity"
  ],
  "clauses": [
    {
      "clauseId": "apex-ai-input-gateway-002-requirement",
      "statement": "Web-chat provider work must use an operator-authorized authenticated Browser authority lease and exact target/document lease, fail closed on provider security barriers, and preserve exact raw response truth.",
      "evidenceMode": "acceptance",
      "ownerDomain": "ai-input-gateway"
    }
  ]
}
```

```apex-law
{
  "lawId": "APEX-AI-INPUT-GATEWAY-005-V4",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "ai-input-gateway",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance",
  "summary": "GPT Web uses one Session Controller to bind task identity, semantic execution profile, exact conversation topology, bounded page actions and compulsory privacy-safe title finalization without making titles a routing identity.",
  "required": [
    "Every governed GPT feed resolves exactly one topology mode: fresh, same_conversation or forked_from_checkpoint. A checkpoint fork first verifies the exact parent canonical URL, parent user-turn marker and following assistant response hash, performs the provider branch action, proves a distinct child canonical URL with inherited checkpoint history, and records action evidence plus child history fingerprint before child submission. Unsupported or ambiguous fork controls fail closed and never degrade to a blank chat or uploaded summary.",
    "V5 fixes max_browser_in_flight=1. Provider generation waits do not hold the Browser mutation lease and may remain durably pending as business jobs, but no configuration, caller field, product mode or alternate scheduler may increase Browser action concurrency.",
    "Every feed owns structured taskIdentity, immutable input hash, opaque execution/attempt identity, deterministic logical-turn marker and submitted-prompt hash. Retries for the same semantic turn retain the marker; changed input receives another marker. Callers never control concurrency, title, tab id, marker, selector, coordinate, browser command or action plan.",
    "Durable provider identity is exactly canonical non-WEB /c/ URL plus unique logical-turn marker and, after capture, response hash. A transient /c/WEB: URL is anti-resubmission evidence only. A human-readable provider title is secondary operator evidence only and must never authorize routing, continuation, fork, retry, recovery, deduplication or response capture.",
    "Every production GPT feed carries one canonical gpt-web-execution-profile.v1 before input hashing. The profile binds profileRef/profileHash, provider, transport, account capability, exact model display name/family, semantic reasoning tier, executor identity, acceptance identity and optional source profile identity. Semantic reasoning tiers are medium, high, extra_high, pro_standard and pro_extended. Any noncanonical reasoning vocabulary, including xhigh or an unqualified pro value, is rejected before hashing; no alias or normalization reader exists. A fixed slider index, coordinate-derived reasoning level, silent model substitution or reasoning downgrade is forbidden.",
    "Before attachments or prompt submission, Session Controller observes the current exact provider page and enforces the requested profile. If the already selected model and reasoning tier are exact it emits no-op proof; otherwise it selects exactly one semantic model candidate and exactly one semantic reasoning candidate and then reads both back. Missing or multiple candidates, wrong provider page, document drift, unavailable account capability or read-back mismatch fail closed. The verified profile proof is persisted in the execution ledger and projected into providerProof.",
    "A fresh GPT execution is established only on the provider root with zero user turns, zero assistant turns, empty composer, no staged attachment, no pasted-text card and no active generation. If that exact clean state already exists the action is a proved no-op: no root navigation, reload or New chat click occurs. Otherwise exactly one same-origin root navigation is allowed and its replacement Document must be re-proved before any later action. Unknown user drafts are never cleared. A stale GrassEye root draft may be cleared only when one exact marker resolves to one different durable canonical submitted execution and all zero-state guards are atomically rechecked immediately before mutation.",
    "A continuation first focuses its exact parent canonical URL and, when available, verifies the parent turn marker before upload or send. A checkpoint fork verifies its parent marker and checkpoint response before branching. A send click is not submission success: success requires one exact marked user turn, canonical non-WEB conversation identity and no conflicting execution binding. Page-global turn counts are observational only and cannot authorize retries.",
    "Response capture is scoped to the unique marked user turn and the immediately following substantive assistant turn. The governed outer turn identity is [data-testid^=conversation-turn-][data-turn=user|assistant]. Legacy article/data-message-author-role selectors, page-global last assistant selection and model-marker echo are forbidden as second identity chains. Loading, shimmer, reasoning, research progress, citation verification and tool summaries are not completed answers.",
    "When expectedOutputKind is generated_image, Gateway binds the exact marked user turn to the immediately following assistant turn, waits for exactly one completed generated-image card, opens that exact HTMLElement role=button card, uses exactly one visible button[aria-label=保存] viewer action and registers one newly downloaded decodable image with original byte hash and opaque provider output ref. Screenshots, other page images, 下载/Download text fallbacks, native-button casting and more than one new download are forbidden.",
    "Immediately after a text assistant turn is complete, runtime atomically persists answer bytes, hash, byte count, capture time and provider page URL as the response checkpoint before title finalization, artifact projection or cleanup. A generated-image output records its immutable output hash before title finalization. The checkpoint protects provider-result truth and prevents resubmission, but for a title-managed production GPT execution it is not by itself publishable success.",
    "Every new fresh conversation and every provider-created fork child is title-managed. Its expected title is generated only from allowlisted task label/role mappings, persisted creation time in operator time zone Asia/Dubai and an opaque short execution trace. It must not contain prompt text, user name, birth data, phone, email, address, sourceTaskId, database key, file name, turn marker, report content or another free-text user field. The caller cannot provide the title.",
    "After the result checkpoint and canonical submission proof exist, Session Controller performs one bounded title-finalization transaction under the existing exclusive patrol lease: focus exact canonical URL plus unique marker, locate the exact canonical sidebar row, reveal only that row's options, choose exactly one Rename action, locate one title textbox, write the expected title, read it back before commit, commit, then prove canonical path, unique marker and exact title. Already-correct title is a no-op proof. The transaction records page-action evidence and a verified conversationTitleProof. It never creates a title-housekeeping worker or a second title-routing chain.",
    "same_conversation continuation does not invent a new title. Its current V5 parent must carry a verified title proof; the continuation inherits the exact expected title/hash and repairs drift during finalization. A missing or invalid parent title proof fails closed as review_required and cannot mint current success. Fork children receive a new title because they are distinct provider conversations.",
    "A title-managed execution may publish final success only after providerExecutionProfileProof and conversationTitleProof both match the immutable request/execution identity. Temporary rename-menu, textbox, sidebar-materialization, search-result or document-generation instability is recovery_pending and retains the response checkpoint, execution id, marker and provider lease evidence. Ambiguous or wrong-target controls are review_required. No title failure may erase the checkpoint or cause the provider turn to be resubmitted.",
    "GPT Web page actions are governed as one action-state contract. Each committed mutation may append bounded evidence containing registry action id, execution id, exact target/document reference hashes, before/after canonical page identity, candidate count, semantic labels, result and evidence hash. A BrowserDocumentRef change invalidates all prior observations and element references; the action must restart registry-owned observation on the same execution and may never reuse or transmit a coordinate or selector.",
    "Immediately after a same-target navigation, React hydration or document replacement may invalidate an otherwise exact DOM node before any mutation. The Session Controller must serially reacquire the current BrowserDocumentRef and repeat only the same registry-owned exact observation inside the existing bounded action window. It may not widen the selector, change target, reload, invoke another action, or create a fallback route. Exhaustion before a mutation is recovery_pending with a durable failure-ledger entry, never terminal failed solely because the transient node id became invalid.",
    "Existing conversation routing uses one registry-owned canonical-conversation action in the one physical tab. That action first resolves the exact canonical pathname from the materialized sidebar; when the exact row is not materialized, its only internal discovery step uses the exact turn marker and accepts exactly one result only when its href resolves to the already persisted canonical pathname. After either internal branch, canonical pathname plus unique marker are re-proved and the exact Search chats dialog is closed and verified. Search title matching never becomes identity authority, and no alternate routing action, fallback chain or caller choice exists.",
    "Exactly ten business/provider executions may be in flight, but the single physical submission window admits Cloud-owned production waiters by immutable created_at plus job_id plus stage ordinal, never by async registration timing; the monotonic ticket only breaks an exact priority tie. The admitted execution retains that window continuously from exact clean-page proof through profile verification, attachment stabilization, prompt entry and fsynced submission checkpoint; only then does it release the window while Provider generation continues. A production waiter is valid only when its live process registration carries the opaque admission hash minted by the owning Plugin from the current eligible Cloud job, attempt, device, lease version, fence, contract, execution and priority key. Process death removes that stale waiter; the same durable execution and checkpoint may resume only after a fresh eligible grant and then receives a different waiter and new local ticket without changing its business priority. A live waiter cannot replace its admission in place. An unresolved UNKNOWN in a live process keeps its current waiter at the head and blocks every newer submission and ordinary patrol until the owning Plugin resolves it or records review_required. After restart it is never replayed, and exact clean-page or same-execution reconciliation must fail closed before any newer task can mutate a contaminated page.",
    "Attachment stabilization before prompt entry proves the exact approved names and count, zero extra or ambiguous attachment, stable composer ownership and absence of upload-progress state. Because the prompt is intentionally still empty at this phase, a disabled send button is expected and must not cause a timeout; send readiness is proved only after the governed prompt is written.",
    "Submitted feeds release the browser-mutation lease before provider generation completes. Submission and patrol waiters use one durable SQLite ledger: admitted production submissions use immutable business-age priority plus monotonic ticket tie-break, while patrol remains strict ticket FIFO after submissions drain. Rate-limit acknowledgement remains the highest-priority process-wide survival action and never refreshes the page.",
    "Every page operation binds to the internally held exact ChatGPT BrowserTargetRef and current BrowserDocumentRef through the authenticated extension transport. After process restart, a submitted execution may reacquire only its exact persisted canonical URL: one exact-URL tab binds, multiple exact-URL tabs is identity ambiguity, absent exact URL opens that URL, unrelated same-origin tabs are ignored. After binding, normal conversation switching is sidebar DOM routing, not URL-first navigation.",
    "Every execution failure appends a bounded durable ledger entry with occurrence time, attempt id, pre-failure phase, classification, recoverability and reason. Temporary provider unavailability, capacity, rate limiting, browser extension or authority discontinuity, target/document invalidation, command backpressure, authenticated transcript discontinuity, temporary capability admission loss, temporarily absent canonical row, page hydration, profile-menu not ready, title UI not ready and bounded search discovery are recovery_pending while no mutation outcome is UNKNOWN and no immutable business failure exists. Login/captcha/2FA/security barriers or ambiguous identity require review_required. Immutable profile/input/hash mismatch is failed.",
    "Process recovery never resubmits a captured provider turn. A valid checkpoint is loaded before browser reacquisition; for title-managed production GPT, recovery continues profile/title finalization on the exact canonical URL and marker before publication. Without a checkpoint, recovery trusts only persisted input identity, ordered attachment proof, canonical conversation identity and marker, never the caller's disposable source path. Legacy execution records remain immutable history and are not readable by the active production executor; no migration reader, alias, default or compatibility path may mint current profile or title proof.",
    "When an authorized factory supersedes one proven polluted pre-submit execution, ownership transfer is explicit and atomic. A corrected runtime may recover the same unsubmitted execution; retry count and failure-ledger length never convert recoverable provider lookup into a terminal user block.",
    "A legacy execution incorrectly persisted as failed by a pre-submission BROWSER_EXTENSION_CHANNEL_UNAVAILABLE, BROWSER_LIVENESS_EXPIRED, BROWSER_SESSION_WORKSPACE_REQUIRED, BROWSER_SESSION_WORKSPACE_REVOKED, BROWSER_TARGET_INVALID, BROWSER_DOCUMENT_INVALID, BROWSER_BACKPRESSURE, BROWSER_AUTH_TRANSCRIPT_INVALID or BROWSER_CAPABILITY_REJECTED interruption may be corrected once in place only when its input and prompt hashes still match and it has no durable submission, uploaded file, attachment proof, page-action proof, UNKNOWN mutation, response checkpoint, response hash or output. The correction persists recovery_pending before execution, preserves execution id, turn marker and failure ledger, rotates only the bounded attempt id, and never creates a failed-task recovery mode, another task or another prompt.",
    "A current v3 execution created by the superseded GPT profile-readback placeholder may be corrected exactly once before submission only when its immutable input, prompt and profile hashes still match, its failure ledger contains the exact GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH rollout reason, and submission, uploaded files, attachment proof, verified profile proof, page-action proof, UNKNOWN mutation, response checkpoint and response hash are all absent. The correction appends LEGACY_PROFILE_READBACK_STATE_CORRECTION_APPLIED, preserves execution id, turn marker and failure history, rotates only the bounded attempt id, and cannot become a live review-task reset loop.",
    "There is exactly one live GPT page-control chain: web-chat-shared -> web-chat-session-controller -> semantic profile / canonical routing / title finalization actions. The retired web-chat-model-identity, web-chat-chat-title, system-title, named-title search, rename patrol and title-housekeeping implementations remain physically deleted."
  ],
  "forbidden": [
    "a global browser lease held from provider open through response capture",
    "a second physical ChatGPT tab, per-task tab lease or provider-tab pool",
    "refreshing/reloading ChatGPT after rate-limit acknowledgement or as a no-result recovery action",
    "clearing an unmarked or ambiguously owned composer, or treating a root draft as owned without exact marker evidence",
    "routing, retrying, deduplicating, continuing, forking or recovering a task from provider title text",
    "binding or routing a transient /c/WEB: URL as a canonical conversation",
    "same-origin tab fallback, active/front/first tab selection, foreground-window dependence or offscreen blind click",
    "in-memory-only submission priority, unordered submission or patrol races, preserving a dead-process waiter without a current eligible Cloud grant, releasing a live current-grant submission ticket before checkpoint or terminal recovery classification, or a second scheduler ledger",
    "fixed reasoning-slider indexes, coordinate-to-reasoning arithmetic, model fallback, reasoning downgrade, caller split model/reasoning controls after production admission, or profile proof that does not match the hash-bound request profile",
    "caller-supplied chat title, title text derived from prompt/user/report content, machine title used as primary identity, title search used as final route proof, rename debt worker, periodic title housekeeping or a second rename implementation",
    "publishing a title-managed production GPT checkpoint before exact profile/title proof exists",
    "detaching provider post-processing as fire-and-forget work after checkpoint publication",
    "using stale BrowserDocumentRef coordinates after navigation or DOM document replacement",
    "page-global last-response extraction, legacy turn selectors, screenshot-as-output, or generated-image selector fallbacks",
    "a failed execution state without durable phase/classification/recoverability/reason evidence",
    "reopening any legacy technical failure that has any submission, upload, page-action, UNKNOWN mutation, checkpoint or output proof",
    "duplicate prompt submission after process restart or after response checkpoint persistence"
  ],
  "clauses": [
    {
      "clauseId": "apex-ai-input-gateway-005-v4-requirement",
      "statement": "GPT Web feeds must use one bounded Session Controller with canonical conversation identity, semantic execution-profile proof and compulsory privacy-safe title finalization without making the title an identity authority.",
      "evidenceMode": "acceptance",
      "ownerDomain": "ai-input-gateway"
    }
  ]
}
```

```apex-law
{
  "lawId": "APEX-AI-INPUT-GATEWAY-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "ai-input-gateway",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance",
  "summary": "attach-approved-web-chat-files-once is the only web-chat attachment child and selects one fixed internal transport without caller choice or same-attempt fallback.",
  "required": [
    "The child accepts only already-governed input refs and exact maxFileCount; zero files returns skipped without opening any picker.",
    "The child selects one internal exact-target file-input batch transport and uses it once for the whole verified staging set.",
    "The extension proves the expected page URL, one unique connected document file input and the exact stable attachment names and count before the child may succeed. This pre-prompt proof excludes extra, ambiguous and still-uploading attachments but does not require the send button to be enabled while the governed prompt is still empty.",
    "For a real provider feed, the attachment child runs only inside that feed's final pre-submit composer step; the same persisted attachments_stable proof is consumed by that feed's submission decision, so each approved file reaches the provider composer exactly once.",
    "The child ends only at skipped, attachments_stable, failed, or review_required and never enters prompt text, submits a prompt, or reads an answer."
  ],
  "forbidden": [
    "transport kind, provider selector, DOM selector, coordinate, tab id, picker instruction, or fallback policy in the public request",
    "switching transport after an attachment attempt starts",
    "retrying the same file through clipboard, native picker, focus lease, OS accessibility action or any second upload path",
    "a detached provider-input-preflight caller, HTTP route, temporary chat, capacity waiter, base64 file envelope, upload-clear-reupload sequence, or any second attachment action graph",
    "an HTTP request-body or per-file byte ceiling used to admit governed provider files",
    "accepting a lower-bound attachment count or a page URL, file input, attachment name or attachment count that is not exact",
    "a local file byte ceiling, token estimate, token budget, threshold increase or file splitting rule that blocks an otherwise governed file before the real provider window decides whether it can accept it"
  ],
  "clauses": [
    {
      "clauseId": "apex-ai-input-gateway-003-requirement",
      "statement": "attach-approved-web-chat-files-once is the only web-chat attachment child and selects one fixed internal transport without caller choice or same-attempt fallback.",
      "evidenceMode": "acceptance",
      "ownerDomain": "ai-input-gateway"
    }
  ]
}
```

```apex-law
{
  "lawId": "APEX-AI-INPUT-GATEWAY-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "ai-input-gateway",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance",
  "summary": "Every attachment attempt must use an isolated verified staging set and emit one aggregate terminal proof before prompt submission.",
  "required": [
    "The child re-reads every approved source file, verifies byte count and sha256, and copies only that ordered set into a unique attempt directory.",
    "Staged display names are unique and order-prefixed, and the exact directory membership plus manifest hash are verified before selection.",
    "Success requires exact attachment count, exact staged display names, composer scope, and a continuous thirty-second stability window.",
    "One aggregate attachment proof records attempt id, fixed transport kind, expected and detected counts, manifest hash, ordered file identity, timing, terminal status, and failure reason.",
    "The attempt staging directory is removed after the terminal proof is formed."
  ],
  "forbidden": [
    "uploading arbitrary directory contents or an unverified source file",
    "count-only success without exact names and composer scope",
    "per-file progress that falsely represents a native batch selection as independently completed uploads",
    "prompt submission before attachments_stable"
  ],
  "clauses": [
    {
      "clauseId": "apex-ai-input-gateway-004-requirement",
      "statement": "Every attachment attempt must use an isolated verified staging set and emit one aggregate terminal proof before prompt submission.",
      "evidenceMode": "acceptance",
      "ownerDomain": "ai-input-gateway"
    }
  ]
}
```
