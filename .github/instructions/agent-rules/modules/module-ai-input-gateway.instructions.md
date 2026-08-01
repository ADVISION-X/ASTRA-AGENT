---
name: "GrassEye AI Input Gateway"
description: "Use when defining external AI feeding, provider delivery, web-chat attachment transport, raw-response proof, or provider isolation."
applyTo: "src/capabilities/ai-input-gateway/**/*.{ts,tsx,json},src/lib/browser/current-chrome-native-multi-file-picker.ts,src/lib/browser/current-chrome-browser-controller-execution.ts,scripts/audit/domains/ai-input-gateway/**/*.{ts,json},scripts/acceptance/ai-input-gateway-*.ts,docs/法案辅助文件/GrassEye AI 投喂能立组施工图 V1.md"
---

# GrassEye AI Input Gateway

status: active
version: 2026-07-29
capabilityDomain: ai-input-gateway
capabilityGroupId: ai-input-gateway

AI Input Gateway 只拥有把已治理的提示词与获准文件送到外部 AI、取回原始回答并形成运输证据的权力。业务判断、提示词内容、领域输出校验仍归调用方。

唯一调用方向：

```txt
business owner
  -> AI task capability or law-owned AI stage
      -> AI Input Gateway public contract
          -> provider adapter
              -> attach-approved-web-chat-files-once
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
  "required": [
    "The canonical ability-group id is ai-input-gateway and its public execute contract accepts governed prompt identity, input refs, provider kind, limits, and optional internally minted continuation proof.",
    "Every provider execution returns one AiFeedResult with raw response identity and provider proof.",
    "Business owners call only the AI Input Gateway public contract."
  ],
  "forbidden": [
    "business plugins importing provider adapters, provider SDKs, provider DOM, browser selectors, coordinates, tab ids, or browser commands",
    "AI Input Gateway making business judgments or validating domain output meaning",
    "a second provider transport owner, compatibility wrapper, or public transport-selection API"
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
  "evidenceMode": "law+blueprint+ast+acceptance",
  "summary": "Web-chat provider work must use an operator-authorized BrowserController, fail closed on provider security barriers, and preserve exact raw response truth.",
  "required": [
    "GPT Web adapters reuse one operator-authorized BrowserController and exactly one controlled physical ChatGPT tab; independent tasks live in separately created ChatGPT conversations, never separate browser tabs.",
    "The serialized browser-mutation lease covers only opening a new conversation in that tab, attachment selection, prompt entry, submission proof, completed-chat manual-style rename, exact chat switching, DOM capture and cleanup; provider generation wait never holds that lease. Within the bounded admitted production window, tasks still waiting to submit have priority over ordinary response patrol. Submission and patrol waiters use one SQLite ticket ledger, and patrol admission is strict FIFO after the admitted submission set is drained.",
    "Independent submitted feeds may wait for provider responses concurrently up to the operator-owned runtime capacity, which is not caller-controlled and is not a fixed product constant.",
    "Login, CAPTCHA, 2FA, risk control, account limits, ambiguous DOM, and unproved native selection return review_required.",
    "Captured raw response text, hash, provider URL, timing, warnings, and continuation proof survive later cleanup failures."
  ],
  "forbidden": [
    "reading cookies, browser storage, passwords, tokens, or hidden credentials",
    "automatic login, CAPTCHA bypass, account rotation, or unbounded retry",
    "downgrading or erasing a completely captured provider response because later cleanup failed"
  ],
  "clauses": [
    {
      "clauseId": "apex-ai-input-gateway-002-requirement",
      "statement": "Web-chat provider work must use an operator-authorized BrowserController, fail closed on provider security barriers, and preserve exact raw response truth.",
      "evidenceMode": "acceptance",
      "ownerDomain": "ai-input-gateway"
    }
  ]
}
```

```apex-law
{
  "lawId": "APEX-AI-INPUT-GATEWAY-005-V2",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "ai-input-gateway",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance+real-chrome",
  "summary": "GPT Web feeds bind a governed task identity to bounded parallel conversations; a feed carrying continuation proof must use that exact parent URL and may never fall back to a blank new conversation.",
  "required": [
    "Runtime capacity is operator-owned, positive, bounded and configurable without becoming a caller field or a product-mode switch; the default capacity supports at least ten independent in-flight GPT conversations.",
    "Every feed request carries one structured taskIdentity containing an allowlisted labelKey plus bounded sourceProject, taskKind and sourceTaskId machine identifiers. This identity is input-hash-bound; callers cannot supply a chat title. Every first GPT feed owns an opaque internal attempt id, a deterministic logical-turn marker derived from immutable task identity and input hash, a submitted prompt hash and a unique human-readable system chat title. Retries for the same semantic turn therefore keep one marker while changed input receives another; callers never control the marker. The title is derived only from taskIdentity.labelKey, UTC month-day and minute, plus a short opaque trace, for example SEO资料研究｜07-26 04:40Z｜A9F193A3-489B; it never copies prompt text, user names, report content, scenario text or caller-supplied title text. Every continuation on an exact canonical parent conversation inherits that parent conversation's earliest verified system title, or its earliest persisted title while rename is unfinished; one whole order therefore has one parent chat and one durable title, while its second, third or Nth turn receives a new marker but never mints or competes for a stage-specific chat title. Legacy stage-specific verified titles on that same canonical URL are deterministically collapsed to the earliest verified title and never block or restart a user order, because the canonical URL remains the stronger identity. As soon as the exact marked user turn exists, the runtime persists its transient URL, ordered attachment proof and turn identity before any post-submit attachment inspection, canonical-URL wait or response polling. A later transient inspection failure therefore resumes the captured turn and may never submit the same semantic turn again. After canonicalization the runtime records the formal conversation URL and releases the submit slot.",
    "A fresh GPT execution is established only on the root path with zero user turns, zero assistant turns, an empty composer, no staged attachment, no pasted-text card and no active generation. When that clean state already exists, the runtime must not issue a redundant New chat click; otherwise it uses one uniquely identified visible New chat control and re-proves the complete clean state. A continuation must first prove that its exact parent URL, at least one prior user turn, at least one prior assistant turn and the prior answer have finished hydrating; an empty or partial parent snapshot is recovery_pending before upload or send. A send click is not submission success. Success exists only when exactly one user turn in the exact conversation contains the prepared prompt prefix and exact logical-turn marker suffix, that marked turn is the latest user turn, the canonical /c/ URL is durable, and the URL is not already bound to another fresh execution. Page-global user-turn counts are observational only because provider hydration can change them; they are forbidden as submission identity or retry authority. A provider rebound to a foreign marked turn, duplicate same marker or occupied canonical conversation is discarded as internal recovery and may never be published as a successful send.",
    "Response capture is scoped to the unique marked user turn and the assistant turn after it, and never relies on the page-global last assistant message or model marker echo.",
    "When expectedOutputKind is generated_image, Gateway locates exactly one user turn carrying the immutable marker, binds only the immediately following assistant turn, rejects an advanced conversation, multiple logical image sources or ambiguous download controls, and registers exactly one newly downloaded decodable image with original byte hash and an opaque provider output ref. Page images outside that assistant turn and screenshots are never output artifacts.",
    "Submitted feeds release the browser-mutation lease before provider generation completes; while any admitted task still awaits submit, ordinary response patrol yields. Submission and patrol waiter identity, kind and monotonically increasing ticket persist in one SQLite scheduler ledger, stale process waiters are reclaimed, and patrols enter strictly by the oldest durable patrol ticket. After all admitted submissions are recorded, the patrol loop clicks the exact non-WEB sidebar row selected by captured canonical conversation identity and verifies the exact marker; a not-yet-materialized automatic sidebar title, a row that is visible but not yet focusable, and the same condition encountered during response-capture preflight or before-poll routing are retryable waiting_provider states rather than terminal failure. They must release the short patrol lease, wait until the next patrol, and must not persist review_required. The operator-owned WEB_CHAT_PATROL_INTERVAL_MS is bounded from one to sixty seconds and defaults to five seconds; it is never a caller field. After rename it clicks the exact system title and verifies the marker. Each patrol acquires only the short mutation lease.",
    "A ChatGPT answer remains generating whenever the exact assistant turn lacks its completion action or the current main conversation exposes a visible thinking, reasoning, loading or shimmer progress node. A page-global aria-busy owned by sidebar, navigation, composer, upload UI or another non-conversation surface is never generation evidence. Intermediate research prose, tool summaries and citation-verification text are never treated as a completed answer.",
    "Whenever ChatGPT shows the ordinary request-frequency dialog, one process-wide unrouted watcher serves the single physical ChatGPT tab for every in-flight task. The highest-priority survival action is fixed: immediately click the unique acknowledgement such as 明白了, remain on the current conversation without page refresh or reload, and wait for the live DOM to recover before any title search, prompt action or response capture resumes.",
    "DOM evaluation and physical mouse or keyboard input must bind to the same exact Chrome automation window. Before every physical action the runtime matches the automation window to exactly one accessibility window by full bounds, raises that exact window with AXRaise, and fails closed when the match is missing or ambiguous. A zero-match caused by the bounded Chrome-to-accessibility synchronization race receives only one sub-second stabilization loop against the same full bounds; ambiguity still fails immediately, and this focus handoff may never turn a visibly completed response into minutes of blind provider polling. Application activation or an unrelated profile chooser, logged-out window or foreground Chrome window is never accepted as proof of physical focus.",
    "A sidebar row is clickable only when its target point is inside the visible browser viewport. If the exact canonical URL or system-title row exists below or above the viewport, the runtime performs a real wheel scroll anchored in the sidebar, re-locates the same row, and only then clicks and verifies the marker. DOM existence or a positive rectangle outside the viewport is never click proof.",
    "Immediately after the exact assistant turn is complete, the runtime atomically persists the answer bytes, hash, byte count, capture time and provider page URL as a response checkpoint before attempting chat rename, artifact projection or cleanup. The same execution record atomically persists chatTitleRename=pending when the canonical GPT title has not yet been verified; this is durable housekeeping debt, not provider-result state. The execution ledger persists the real capacity lease as soon as it is acquired. The durable checkpoint is already the completed provider result: gateway execution races provider post-processing against the checkpoint and must publish the checkpointed bytes and persisted provider lease as soon as the checkpoint exists, even while title rename, artifact decoration or cleanup remains blocked. The checkpoint patrol is owned by that race and is stopped in a finally path on provider success, provider failure or checkpoint publication; no failed provider attempt may leave a fifty-millisecond checkpoint poller alive. Those post-processing actions may continue under their existing lease after publication, and any failure appends evidence while preserving response_captured. A legacy checkpoint that predates lease persistence may receive one deterministic checkpoint-recovery lease only after execution id, attempt id, input hash, response hash and checkpoint bytes all match; that recovery lease is persisted before publication. An error after checkpoint persistence may never downgrade that result or return the task to provider polling. Row-scoped rename and other browser housekeeping are bounded post-processing only and can never withhold the user's captured answer.",
    "Every execution failure appends a bounded durable failure ledger entry containing occurrence time, attempt id, pre-failure phase, classification, recoverability and a bounded reason. A process exit or later successful recovery never erases the prior failure evidence.",
    "Temporary provider unavailability before or after submission, including an absent controlled tab, a composer that has not become ready, an incompletely hydrated parent conversation, bounded capacity or rate limiting, browser disconnection, transient network failure, and an exact submitted conversation that is not currently locatable, is recovery_pending and retains the same execution id, input hash, logical-turn marker, task title and failure evidence. Every accumulated failure entry is reclassified independently on recovery; any number of recoverable entries remains recoverable. A newly emitted terminal-state error must append the last real root reason in the same durable error, and recovery must classify that root rather than the terminal wrapper. A legacy synthetic terminal-state echo that lacks a root is evidence only and receives one bounded recovery pass rather than becoming a new blocking cause or an infinite restart authority. Retry count and failure-ledger length never promote recoverable provider lookup into a terminal user block. Each individual lookup is bounded and releases the browser lease before the next scheduled recovery. Login, captcha, two-factor, security barriers, multiple physical provider tabs or identity ambiguity require review_required inside the generic gateway; an authorized product factory keeps those conditions as internal recovery_pending while showing its user only processing. If multiple physical tabs are detected after durable submission, the gateway records the exact submitted URL in failure proof and retains the same execution and marker; monitor interference may never authorize a second provider submission. Invalid immutable input identity remains failed.",
    "When an authorized factory discards a polluted or terminal provider attempt and creates a fresh execution id for the same round and input hash, the gateway accepts it only when the internal execute option names the exact currently registered execution id being superseded. The rate ledger atomically transfers ownership to the fresh id; unrelated duplicate owners remain rejected, and neither a ten-second retry loop nor a process restart may be required to clear the old in-memory owner.",
    "Process recovery publishes a valid persisted response checkpoint before attempting to locate the physical tab and never resubmits that provider turn. Only response_captured executions are eligible for the independent title-housekeeping worker; response_checkpointed executions must first republish their answer. On every AGENT start, every checkpoint recovery and every post-publication browser failure, one process-local coordinator scans durable chatTitleRename=pending debt and resumes it without reacquiring provider capacity or invoking the model. Each debt attempt retains the original execution id, canonical URL, inherited whole-order title and turn marker, uses bounded exponential retry backoff, and changes only the submission title proof plus housekeeping state. A verified transaction atomically persists chatTitleRename=verified and chatTitleVerifiedAt. Temporary tab absence, window-focus synchronization, sidebar hydration, missing rename controls and unreflected commits remain pending across any number of restarts; only canonical identity, title or marker ambiguity changes the housekeeping debt to review_required, while the published answer remains response_captured. The complete rename transaction from exact canonical-URL focus through row options, title textbox write, Enter commit and canonical-URL-plus-title-plus-marker verification holds one short exclusive patrol lease so another task cannot switch the single tab between steps. One rename patrol slice is capped at fifteen seconds, the shortest bound proven sufficient by the real Chrome restart acceptance. If the transaction is not yet complete, it releases the lease and requeues the whole transaction; a queued submission or continuation step therefore enters before another rename patrol and may never wait through a long title-control timeout. Recovery must also detect and finish a rename menu or title textbox left open by a process interruption, but it must first prove the exact canonical URL and unique turn marker; an open menu is reusable only when its aria-labelledby or aria-controls identity points back to that exact conversation row trigger. A rename control or textbox that has not appeared, a click that has not committed, or a title commit that is not visible yet releases that lease and records bounded housekeeping evidence without discarding, downgrading or withholding the already published checkpoint; every rename attempt is bounded and may not occupy production capacity forever. Once attachments_stable and a canonical submitted user turn have both been recorded, restart recovery trusts only the persisted input hash, ordered attachment proof, exact conversation URL, marker and optional response checkpoint; it never reads or uploads the caller's disposable source path again. Missing or mismatched checkpoint input identity, attachment identity, hash or byte count returns review_required; a temporarily missing rename surface does not.",
    "Chat search is one bounded UI transaction. Before opening search, before attachment selection and before prompt focus, the provider adapter may close only one visible dialog that contains exactly one Search chats or 搜索聊天 textbox and exactly one Close or 关闭 action. Every search exit, including target-not-found and interruption, must close that exact dialog and verify it disappeared before releasing the browser-mutation lease. Missing or ambiguous classification returns review_required."
    ,"A feed with providerContinuationRef must focus and verify its exact parent providerPageUrl before submission. Missing, mismatched or unreachable parent identity returns review_required; the open-new-conversation path is forbidden for that feed."
  ],
  "forbidden": [
    "a global lease held from provider open through response capture",
    "a second physical ChatGPT tab, a per-task tab lease, or a provider-tab pool",
    "searching chats, sending, parsing, opening a new chat, resubmitting or waiting while an ordinary request-frequency dialog remains visible",
    "refreshing or reloading a ChatGPT page after rate-limit acknowledgement or as a no-result recovery action",
    "routing an existing ChatGPT task by browser URL open instead of clicking its exact sidebar DOM row",
    "treating a transient /c/WEB: sidebar row or the page-header conversation menu as the rename target",
    "holding the submit mutation slot while waiting for a running answer to expose its sidebar rename menu",
    "splitting one completed-chat rename transaction into independently locked clicks that allow another task to switch conversations between row options, textbox write and commit verification",
    "holding one rename patrol lease for more than fifteen seconds or letting title housekeeping overtake a queued first send or continuation send",
    "minting or applying a different system chat title for the second, third or later turn of one exact parent conversation",
    "using application activation, accessibility window 1, or whichever Chrome window happens to be foreground as the physical target after DOM evaluation",
    "clicking an offscreen sidebar DOM rectangle or treating DOM existence outside the viewport as a committed chat switch",
    "allowing per-task acknowledgement watchers or ordinary patrol to starve an admitted task that is still waiting to submit",
    "in-memory-only submission priority, unordered patrol races or a second scheduler ledger",
    "persisting review_required merely because an exact submitted sidebar row is temporarily absent, visible but not yet focusable, or still materializing during response-capture preflight or before-poll routing",
    "discarding a captured answer or persisting review_required merely because a rename menu, title textbox, click commit or renamed-title reflection is temporarily not ready",
    "requiring a live provider tab, marker lookup, title rename, artifact decoration or cleanup before publishing a valid durable response checkpoint",
    "leaving a checkpoint patrol timer alive after the provider branch succeeds or throws",
    "publishing a checkpointed success with a missing provider lease, fabricating a lease without verifying checkpoint bytes and immutable identities, or replacing an existing provider lease during recovery",
    "an unbounded completed-chat rename loop that can hold a task capacity slot forever",
    "an in-memory-only post-response rename promise without durable pending debt, startup recovery and bounded retry evidence",
    "marking chatTitleVerifiedAt from title text alone without exact canonical URL and exact turn marker proof",
    "treating visible loading, shimmer, citation verification, tool progress or research progress as a completed answer",
    "caller-supplied concurrency, chat title, tab id, turn marker, selector or browser command",
    "caller free-text task names or task identity omitted from the feed input hash",
    "machine-only titles made entirely from hashes, UUIDs or transport vocabulary, or titles copied from prompt text, user names or report content",
    "automatic provider titles as durable identity, duplicate prompt submission after restart, or unscoped last-response extraction",
    "capturing a generated image from the page-global last message, another assistant turn, more than one logical source, more than one new download, a screenshot or an unbound preview",
    "a failed execution state without a durable phase, classification, recoverability and reason ledger",
    "restarting a fresh execution into an in-memory duplicate-input loop, clearing the loop only by restarting the AGENT process, or replacing a rate-ledger owner without the exact superseded execution id",
    "promoting an exact submitted conversation lookup to terminal review_required only because a retry counter was exhausted, or holding the browser lease in an unbounded search loop",
    "legacy serial mode, compatibility bridge, shadow scheduler or per-request transport mode",
    "leaving a chat-search dialog open after routing, opening the native file picker behind a visible chat-search dialog, or pressing Escape as an unclassified universal dialog action",
    "opening a blank new conversation when providerContinuationRef was requested"
    ,"treating a send-button click, prompt-prefix similarity, root-path appearance or an old marked user turn as successful fresh-task submission"
    ,"binding a fresh execution to a canonical GPT conversation already owned by another fresh execution"
  ],
  "clauses": [
    {
      "clauseId": "apex-ai-input-gateway-005-v2-requirement",
      "statement": "A GPT Web feed with continuation proof must submit only in the exact verified parent conversation and must never fall back to a blank new conversation.",
      "evidenceMode": "real-chrome",
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
  "evidenceMode": "law+blueprint+ast+acceptance+real-chrome",
  "summary": "attach-approved-web-chat-files-once is the only web-chat attachment child and selects one fixed internal transport without caller choice or same-attempt fallback.",
  "required": [
    "Zero approved files return skipped without opening an attachment surface.",
    "GPT Web Chat with one approved file uses ordered_clipboard.",
    "GPT Web Chat with two or more approved files uses native_picker_batch.",
    "Gemini Web Chat with approved files uses ordered_clipboard.",
    "The child ends only at skipped, attachments_stable, failed, or review_required and never enters prompt text, submits a prompt, or reads an answer.",
    "Before native_picker_batch sends any keyboard action, it re-reads and raises the exact controlled Chrome window, then requires window bounds equality, one outer picker sheet, one nested Go to Folder sheet and one text field inside that nested sheet. It sets and verifies focus on that exact field, retries only the bounded Go to Folder opening action when the nested sheet has not appeared, verifies the nested sheet closes after Enter, and never treats an arbitrary AXFocusedUIElement as the folder field."
  ],
  "forbidden": [
    "transport kind, provider selector, DOM selector, coordinate, tab id, native-picker instruction, or fallback policy in the public request",
    "switching transport after an attachment attempt starts",
    "retry-pasting the same file, silently falling back, or accepting a lower-bound attachment count",
    "provider or business vocabulary in the generic native multi-file picker primitive",
    "selecting accessibility window 1 without first rebinding it to the exact controlled Chrome bounds, or accepting an arbitrary focused text field as the native picker folder target"
  ],
  "clauses": [
    {
      "clauseId": "apex-ai-input-gateway-003-requirement",
      "statement": "attach-approved-web-chat-files-once is the only web-chat attachment child and selects one fixed internal transport without caller choice or same-attempt fallback.",
      "evidenceMode": "real-chrome",
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
  "evidenceMode": "law+blueprint+ast+acceptance+real-chrome",
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
      "evidenceMode": "real-chrome",
      "ownerDomain": "ai-input-gateway"
    }
  ]
}
```
