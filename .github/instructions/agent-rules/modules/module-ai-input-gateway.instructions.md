---
name: "GrassEye AI Input Gateway"
description: "Use when defining external AI feeding, provider delivery, web-chat attachment transport, raw-response proof, or provider isolation."
applyTo: "src/capabilities/ai-input-gateway/**/*.{ts,tsx,json},src/lib/browser/current-chrome-browser-controller-execution.ts,scripts/audit/domains/ai-input-gateway/**/*.{ts,json},scripts/acceptance/ai-input-gateway-*.ts,docs/法案辅助文件/GrassEye AI 投喂能立组施工图 V1.md"
---

# GrassEye AI Input Gateway

status: active
version: 2026-08-16.7
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
  "codePurityLiveness": {
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
    "The canonical ability-group id is ai-input-gateway and its public execute contract accepts governed prompt identity, input refs, provider kind, an exact attachment-count envelope, and optional internally minted continuation proof. It has no caller-supplied prompt character, byte or token budget and no local prompt-capacity admission gate; only the real provider window decides whether a governed prompt can be accepted.",
    "Every provider execution returns one AiFeedResult with raw response identity and provider proof.",
    "Business owners call only the AI Input Gateway public contract."
  ],
  "forbidden": [
    "business plugins importing provider adapters, provider SDKs, provider DOM, browser selectors, coordinates, tab ids, or browser commands",
    "AI Input Gateway making business judgments or validating domain output meaning",
    "maxInputChars, a prompt character/byte/token ceiling, a prompt budget increase, prompt splitting, or any local prompt-capacity rejection before the real provider window",
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
    "The serialized browser-mutation lease covers only opening a new conversation in that tab, attachment selection, prompt entry, submission proof, exact canonical-conversation switching, DOM capture and cleanup; provider generation wait never holds that lease. Within the bounded admitted production window, tasks still waiting to submit have priority over ordinary response patrol. Submission and patrol waiters use one SQLite ticket ledger, and patrol admission is strict FIFO after the admitted submission set is drained.",
    "Independent submitted feeds may wait for provider responses concurrently up to the operator-owned runtime capacity, which is not caller-controlled and is not a fixed product constant.",
    "When a plugin-owned task acknowledges takeover, AI Input Gateway records that exact owner key, releases the single provider target to the operator, and makes all new web-chat executions wait without reacquiring the tab until that same owner explicitly resumes.",
    "Login, CAPTCHA, 2FA, risk control, account limits, ambiguous DOM, and unproved native selection return review_required.",
    "Captured raw response text, hash, provider URL, timing, warnings, and continuation proof survive later cleanup failures."
  ],
  "forbidden": [
    "reading cookies, browser storage, passwords, tokens, or hidden credentials",
    "automatic login, CAPTCHA bypass, account rotation, or unbounded retry",
    "patrol, submission or another task reacquiring the provider target while any plugin takeover owner remains active",
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
  "lawId": "APEX-AI-INPUT-GATEWAY-005-V3",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "ai-input-gateway",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance",
  "summary": "GPT Web feeds bind a governed task identity to bounded parallel conversations and expose exact fresh, same-conversation or provider-verified checkpoint-fork topology without fallback.",
  "required": [
    "Every governed GPT feed resolves exactly one topology mode: fresh, same_conversation or forked_from_checkpoint. A checkpoint fork first verifies the exact parent URL, parent user-turn marker and following assistant response hash, performs the provider branch action, proves a distinct child URL with the inherited checkpoint history, and records the action evidence hash plus child history fingerprint before child submission.",
    "Fresh proof records zero pre-submit user and assistant turns with no continuation or fork parent. Same-conversation proof records exact parent and actual URL, parent raw hash, prior marker and new marker. Fork proof records parent checkpoint identity, action evidence, distinct child URL, initial history fingerprint and first child marker. Unsupported, missing or ambiguous provider fork controls fail closed and never degrade to a blank chat or uploaded summary.",
    "Runtime capacity is operator-owned, positive, bounded and configurable without becoming a caller field or a product-mode switch; the default capacity supports at least ten independent in-flight GPT conversations.",
    "Every feed request carries one structured taskIdentity containing an allowlisted labelKey plus bounded sourceProject, taskKind and sourceTaskId machine identifiers. This identity is input-hash-bound and never becomes provider-visible housekeeping. Every GPT feed owns an opaque internal attempt id, a deterministic logical-turn marker derived from immutable task identity and input hash, and a submitted prompt hash. Retries for the same semantic turn keep one marker while changed input receives another; callers never control the marker. Durable provider identity is exactly the canonical conversation URL plus the unique logical-turn marker and, after capture, the response hash. Automatic provider titles are observational only. AGENT must never open a provider rename surface, write a chat title, persist rename debt or run a title-housekeeping worker. As soon as the exact marked user turn exists, the runtime persists its transient URL, ordered attachment proof and turn identity before any post-submit attachment inspection, canonical-URL wait or response polling. A transient /c/WEB: URL is anti-resubmission evidence only: it may never become a routing identity, may never trigger sidebar routing, URL reacquisition or canonical-path validation, and may not replace the still-live exact target while canonicalization is being observed. Only a verified non-WEB canonical /c/ URL may enter the routable conversation binding. A later transient inspection failure resumes the captured turn and may never submit the same semantic turn again. After canonicalization the runtime records the formal conversation URL and releases the submit slot.",
    "A fresh GPT execution is established only on the root path with zero user turns, zero assistant turns, an empty composer, no staged attachment, no pasted-text card and no active generation. When that clean state already exists, the runtime must not issue a redundant New chat click; otherwise the current governed zh-CN ChatGPT DOM accepts only one actionable sidebar anchor whose data-testid is create-new-chat-button, visible text is exactly 新聊天 or New chat, resolved href is the provider root, data-sidebar-item is true, pointer-events is not none, and center-point hit testing resolves back to that same test-id anchor. Responsive duplicates with pointer-events none are non-actionable renderings of the same logical control and are excluded before uniqueness; a history/project section trailing anchor whose aria-label says 新聊天 is a different action and is forbidden as fallback. Any future identity drift requires fresh real-Chrome evidence. After clicking the unique actionable sidebar anchor, the runtime re-proves the complete clean state. ChatGPT may preserve a submitted GrassEye draft in the root composer after the provider has already moved that exact marked turn into a durable canonical conversation. The Gateway may clear that abandoned draft only when the same target atomically proves root path, zero user and assistant turns, no attachment or pasted-text card, no generation, exactly one well-formed internal GrassEye marker in the composer, and the execution ledger resolves that marker to exactly one different GPT execution with a durable non-WEB canonical submission. The guarded clear must recheck the same marker and zero-state boundaries immediately before mutation and then re-prove the empty clean root. A missing, foreign, malformed, duplicate, unsubmitted, transient-only or ambiguously owned marker is never cleared; an unmarked composer is treated as an unknown user draft and must remain untouched. Initial clean-root establishment is one bounded browser transaction whose probes are no faster than once per second. A still-hydrating root, a pending clean-state observation, a composer that is not ready, or zero or multiple actionable sidebar candidates before any click is proven is recovery_pending: it releases the short browser lease, retains the same execution id and may not be persisted as a terminal pre-submit identity fault. Low-level repeated observations do not create new business events; runtime logs report the bounded transaction and state transitions rather than turning every probe into a task restart. A continuation must first prove that its exact parent URL, at least one prior user turn, at least one prior assistant turn and the prior answer have finished hydrating; an empty or partial parent snapshot is recovery_pending before upload or send. A send click is not submission success. Success exists only when exactly one user turn in the exact conversation contains the prepared prompt prefix and exact logical-turn marker suffix, that marked turn is the latest user turn, the canonical /c/ URL is durable, and the URL is not already bound to another fresh execution. Page-global user-turn counts are observational only because provider hydration can change them; they are forbidden as submission identity or retry authority. A provider rebound to a foreign marked turn, duplicate same marker or occupied canonical conversation is discarded as internal recovery and may never be published as a successful send.",
    "Response capture is scoped to the unique marked user turn and the assistant turn after it, and never relies on the page-global last assistant message or model marker echo. In the current Chrome provider DOM, the only governed outer turn identity is one [data-testid^=conversation-turn-][data-turn=user|assistant] element. A provider shell with no non-empty screenshot content and no non-empty image source is not a substantive turn: it is ignored while waiting and can neither become the bound assistant response nor make a completed conversation appear advanced. Legacy article tags, nested data-message-author-role attributes and selector fallbacks are forbidden as a second turn-identity chain.",
    "When expectedOutputKind is generated_image, Gateway does not wait for or persist a text-response checkpoint. It locates exactly one user turn carrying the immutable marker, binds only the immediately following assistant turn, waits until that turn exposes exactly one completed generated-image card and no active generation state, opens that exact card, uses the image viewer's unique save action, and registers exactly one newly downloaded decodable image with original byte hash and an opaque provider output ref. The current generated-image card is governed by its unique visible HTMLElement role=button identity and is not assumed to be a native button tag. The current governed zh-CN viewer save identity is exactly one visible button[aria-label=保存]; title, text aggregation and the retired 下载/Download labels are not fallback identities. Zero such buttons stays pending, more than one fails closed, and any future DOM drift requires new real-Chrome evidence before changing this identity. DOM elements never cross the extension transport boundary; evaluation returns only bounded scalar status, reason and click coordinates. It rejects an advanced conversation, multiple logical image sources, ambiguous viewer actions or multiple new downloads. Page images outside that assistant turn and screenshots are never output artifacts. Resume follows the same image-card-to-viewer-to-save path and never resubmits the marked turn.",
    "Submitted feeds release the browser-mutation lease before provider generation completes; while any admitted task still awaits submit, ordinary response patrol yields. Submission and patrol waiter identity, kind and monotonically increasing ticket persist in one SQLite scheduler ledger, stale process waiters are reclaimed, and patrols enter strictly by the oldest durable patrol ticket. After all admitted submissions are recorded, the patrol loop clicks the exact non-WEB sidebar row selected only by captured canonical conversation identity and verifies the exact marker; a not-yet-materialized automatic sidebar title, a row that is visible but not yet focusable, and the same condition encountered during response-capture preflight or before-poll routing are retryable waiting_provider states rather than terminal failure. They must release the short patrol lease, wait until the next patrol, and must not persist review_required. The operator-owned WEB_CHAT_PATROL_INTERVAL_MS is bounded from one to sixty seconds and defaults to five seconds; it is never a caller field. Each patrol acquires only the short mutation lease.",
    "A ChatGPT answer remains generating whenever the exact assistant turn lacks its completion action or the current main conversation exposes a visible thinking, reasoning, loading or shimmer progress node. A page-global aria-busy owned by sidebar, navigation, composer, upload UI or another non-conversation surface is never generation evidence. Intermediate research prose, tool summaries and citation-verification text are never treated as a completed answer.",
    "Whenever ChatGPT shows the ordinary request-frequency dialog, one process-wide unrouted watcher serves the single physical ChatGPT tab for every in-flight task. The highest-priority survival action is fixed: immediately click the unique acknowledgement such as 明白了, remain on the current conversation without page refresh or reload, and wait for the live DOM to recover before any page operation resumes.",
    "Every web-chat page operation binds to the internally held exact ChatGPT BrowserTargetRef and current BrowserDocumentRef. DOM evaluation, CDP mouse events, CDP text input, CDP scroll, screenshot and file input use the Chrome extension transport without activating Chrome or depending on the foreground tab. The one physical provider tab is transport identity, never conversation identity. After an AGENT process restart, a submitted execution with no in-memory target may reacquire only the exact persisted canonical conversation URL. Exact URL reuse is deterministic: one exact URL tab binds, multiple exact URL tabs is identity ambiguity, and an absent exact URL opens that exact URL; unrelated same-origin tabs are ignored. After binding the physical target, the execution routes only by its exact canonical sidebar pathname.",
    "A sidebar row is actionable only after target-bound DOM evaluation proves its href matches the exact canonical conversation pathname and it is inside the exact ChatGPT target viewport. Multiple visible DOM anchors with the same normalized canonical pathname are duplicate renderings of one logical conversation route, not multiple conversation identities: the runtime must collapse them to that one pathname, choose one actionable rendering by a stable geometry order, click it, then prove the browser pathname equals the persisted canonical pathname and the persisted marker occurs exactly once. Two or more persisted markers, different canonical pathnames claiming the same execution, or multiple physical exact-url tabs remain identity ambiguity and fail closed. If every exact rendering is outside the viewport, the runtime performs target-bound CDP scrolling in that sidebar, re-locates the same canonical route, then dispatches the click to the same target and verifies the marker. DOM existence outside the viewport, provider-title matching, physical wheel fallback, current-active-tab selection and URL-first routing are never click proof.",
    "Immediately after the exact assistant turn is complete, the runtime atomically persists the answer bytes, hash, byte count, capture time and provider page URL as a response checkpoint before artifact projection or cleanup. The execution ledger persists the real capacity lease as soon as it is acquired. The durable checkpoint is already the completed provider result: gateway execution races provider post-processing against the checkpoint and must publish the checkpointed bytes and persisted provider lease as soon as the checkpoint exists. The checkpoint patrol is owned by that race and is stopped in a finally path on provider success, provider failure or checkpoint publication; no failed provider attempt may leave a fifty-millisecond checkpoint poller alive. Artifact projection or cleanup may continue after publication, and any failure appends evidence while preserving response_captured. A legacy checkpoint that predates lease persistence may receive one deterministic checkpoint-recovery lease only after execution id, attempt id, input hash, response hash and checkpoint bytes all match; that recovery lease is persisted before publication. An error after checkpoint persistence may never downgrade that result or return the task to provider polling.",
    "Every execution failure appends a bounded durable failure ledger entry containing occurrence time, attempt id, pre-failure phase, classification, recoverability and a bounded reason. A process exit or later successful recovery never erases the prior failure evidence.",
    "Temporary provider unavailability before or after submission, including an absent or not-yet-acquired controlled provider target, a composer that has not become ready, an incompletely hydrated parent conversation, bounded capacity or rate limiting, browser disconnection, transient network failure, an exact submitted conversation that is not currently locatable, and a pre-submit target-evaluation transport failure, is recovery_pending and retains the same execution id, input hash, logical-turn marker, canonical conversation identity and failure evidence. A target-evaluation syntax failure remains visible as an implementation defect and is blocked by executable-script acceptance, but after a corrected runtime is deployed its unsubmitted persisted execution is recovered with the same execution id rather than being stranded or replaced. Every accumulated failure entry is reclassified independently on recovery; any number of recoverable entries remains recoverable. A newly emitted terminal-state error must append the last real root reason in the same durable error, and recovery must classify that root rather than the terminal wrapper. A legacy unsubmitted execution whose bounded ledger contains only one attempt's synthetic terminal-state echoes without a root has no positive terminal cause: those echoes are evidence only and authorize exactly one same-execution recovery attempt, retaining the execution id and logical-turn marker instead of creating a replacement id. A second rootless attempt is not another restart authority. Retry count and failure-ledger length never promote recoverable provider lookup into a terminal user block. Each individual lookup is bounded and releases the browser lease before the next scheduled recovery. Login, captcha, two-factor, security barriers, multiple physical provider tabs or identity ambiguity require review_required inside the generic gateway; an authorized product factory keeps those conditions as internal recovery_pending while showing its user only processing. If multiple physical tabs are detected after durable submission, the gateway records the exact submitted URL in failure proof and retains the same execution and marker; monitor interference may never authorize a second provider submission. Invalid immutable input identity remains failed.",
    "When an authorized factory discards a polluted or terminal provider attempt and creates a fresh execution id for the same round and input hash, the gateway accepts it only when the internal execute option names the exact currently registered execution id being superseded. The rate ledger atomically transfers ownership to the fresh id; unrelated duplicate owners remain rejected, and neither a ten-second retry loop nor a process restart may be required to clear the old in-memory owner.",
    "Process recovery publishes a valid persisted response checkpoint before attempting to locate the physical tab and never resubmits that provider turn. Without a checkpoint, restart recovery trusts only the persisted input hash, ordered attachment proof, exact canonical conversation URL and marker, then resumes response or generated-image capture on that exact identity. It never reads or uploads the caller's disposable source path again. Missing or mismatched checkpoint input identity, attachment identity, hash or byte count returns review_required. Provider-title drift, absence or duplication is irrelevant because titles are neither queried nor mutated.",
    "Chat search is one bounded UI transaction. Before opening search, before attachment selection and before prompt focus, the provider adapter may close only one visible dialog that contains exactly one Search chats or 搜索聊天 textbox and exactly one Close or 关闭 action. Every search exit, including target-not-found and interruption, must close that exact dialog and verify it disappeared before releasing the browser-mutation lease. Missing or ambiguous classification returns review_required."
    ,"A feed with providerContinuationRef must focus and verify its exact parent providerPageUrl before submission. Missing, mismatched or unreachable parent identity returns review_required; the open-new-conversation path is forbidden for that feed."
  ],
  "forbidden": [
    "a global lease held from provider open through response capture",
    "a second physical ChatGPT tab, a per-task tab lease, or a provider-tab pool",
    "searching chats, sending, parsing, opening a new chat, resubmitting or waiting while an ordinary request-frequency dialog remains visible",
    "refreshing or reloading a ChatGPT page after rate-limit acknowledgement or as a no-result recovery action",
    "clearing an unmarked or ambiguously owned provider composer, clearing a composer whose marker lacks one durable canonical submission owner, or treating a root-path draft as owned without exact marker evidence",
    "routing an existing ChatGPT task by browser URL open instead of clicking its exact sidebar DOM row",
    "binding, routing, reacquiring or canonical-path-validating a transient /c/WEB: submission URL as though it were a durable canonical conversation identity",
    "using a same-origin fallback, active/current/front/first selection or unrelated-tab navigation while reacquiring the one shared physical provider tab after process restart",
    "opening any provider chat-title menu, editing a provider chat title, persisting title-rename debt, or running a title-housekeeping worker",
    "using application activation, accessibility window 1, or whichever Chrome window happens to be foreground as the physical target after DOM evaluation",
    "clicking an offscreen sidebar DOM rectangle or treating DOM existence outside the viewport as a committed chat switch",
    "allowing per-task acknowledgement watchers or ordinary patrol to starve an admitted task that is still waiting to submit",
    "in-memory-only submission priority, unordered patrol races or a second scheduler ledger",
    "persisting review_required merely because an exact submitted sidebar row is temporarily absent, visible but not yet focusable, or still materializing during response-capture preflight or before-poll routing",
    "requiring a live provider tab, marker lookup, artifact decoration or cleanup before publishing a valid durable response checkpoint",
    "leaving a checkpoint patrol timer alive after the provider branch succeeds or throws",
    "publishing a checkpointed success with a missing provider lease, fabricating a lease without verifying checkpoint bytes and immutable identities, or replacing an existing provider lease during recovery",
    "treating visible loading, shimmer, citation verification, tool progress or research progress as a completed answer",
    "caller-supplied concurrency, chat title, tab id, turn marker, selector or browser command",
    "caller free-text task names or task identity omitted from the feed input hash",
    "automatic provider titles as durable identity, duplicate prompt submission after restart, or unscoped last-response extraction",
    "capturing a generated image from the page-global last message, another assistant turn, more than one logical source, more than one new download, a screenshot or an unbound preview",
    "casting a role=button image card to HTMLButtonElement or returning any DOM element through the extension transport",
    "recognizing the generated-image viewer save action through title/text aggregation, 下载, Download or any selector fallback instead of the one current exact button[aria-label=保存] identity",
    "treating an empty provider placeholder shell as a substantive user or assistant turn, or retaining article/data-message-author-role as a legacy turn-identity fallback",
    "a failed execution state without a durable phase, classification, recoverability and reason ledger",
    "treating one unsubmitted attempt's rootless synthetic terminal-state echoes as a proven terminal cause, granting those echoes more than one same-execution recovery attempt, or minting a replacement execution id from them",
    "restarting a fresh execution into an in-memory duplicate-input loop, clearing the loop only by restarting the AGENT process, or replacing a rate-ledger owner without the exact superseded execution id",
    "promoting an exact submitted conversation lookup to terminal review_required only because a retry counter was exhausted, or holding the browser lease in an unbounded search loop",
    "legacy serial mode, compatibility bridge, shadow scheduler or per-request transport mode",
    "leaving a chat-search dialog open after routing, opening the native file picker behind a visible chat-search dialog, or pressing Escape as an unclassified universal dialog action",
    "opening a blank new conversation when providerContinuationRef was requested"
    ,"treating a send-button click, prompt-prefix similarity, root-path appearance or an old marked user turn as successful fresh-task submission"
    ,"binding a fresh execution to a canonical GPT conversation already owned by another fresh execution"
    ,"treating raw DOM anchor multiplicity for one exact canonical pathname as multiple conversation identities, or accepting a clicked row without the post-click pathname plus unique-marker proof"
  ],
  "clauses": [
    {
      "clauseId": "apex-ai-input-gateway-005-v3-requirement",
      "statement": "A GPT Web feed must prove its exact fresh, same-conversation or provider checkpoint-fork topology and may never substitute a blank chat, summary replay or mutable parent tail.",
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
    "Zero approved files return skipped without opening an attachment surface.",
    "GPT Web Chat with any approved file count uses exact_target_file_input_batch through the loaded Chrome extension and the exact governed tab.",
    "The extension proves the expected page URL, one unique connected document file input and the exact stable attachment names and count before the child may succeed.",
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
