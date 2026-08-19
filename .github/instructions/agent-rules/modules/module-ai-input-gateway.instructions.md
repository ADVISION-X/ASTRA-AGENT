---
name: "GrassEye AI Input Gateway"
description: "Use when defining external AI feeding, provider delivery, GPT Web session control, web-chat attachment transport, raw-response proof, or provider isolation."
applyTo: "src/capabilities/ai-input-gateway/**/*.{ts,tsx,json},src/lib/browser/current-chrome-browser-controller-execution.ts,scripts/audit/domains/ai-input-gateway/**/*.{ts,json},scripts/acceptance/ai-input-gateway-*.ts,docs/法案辅助文件/GrassEye AI 投喂能立组施工图 V1.md"
---

# GrassEye AI Input Gateway

status: active  
version: 2026-08-19.1  
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
    "The canonical ability-group id is ai-input-gateway and its public execute contract accepts governed prompt identity, input refs, provider kind, an exact attachment-count envelope, optional internally minted continuation proof, and for production GPT Web one hash-bound provider execution profile. It has no caller-supplied prompt character, byte or token budget and no local prompt-capacity admission gate; only the real provider window decides whether a governed prompt can be accepted.",
    "Every provider execution returns one AiFeedResult with raw response identity and provider proof. Production GPT Web proof contains the actually observed execution profile and, when the session is title-managed, the verified conversation-title finalization proof.",
    "Business owners call only the AI Input Gateway public contract. Legacy production callers that omit the profile may be normalized exactly once at Gateway admission into one canonical hash-bound default profile before request parsing and input hashing; caller-supplied split model/reasoning controls are never promoted."
  ],
  "forbidden": [
    "business plugins importing provider adapters, provider SDKs, provider DOM, browser selectors, coordinates, tab ids, or browser commands",
    "AI Input Gateway making business judgments or validating domain output meaning",
    "maxInputChars, a prompt character/byte/token ceiling, a prompt budget increase, prompt splitting, or any local prompt-capacity rejection before the real provider window",
    "a second provider transport owner, compatibility transport wrapper, provider-specific business API, parallel GPT page-control chain, or title-housekeeping worker"
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
    "The serialized browser-mutation lease covers only bounded page mutations such as fresh-conversation establishment, exact conversation switching, profile control, attachment selection, prompt entry, submission proof, title finalization, DOM capture and cleanup; provider generation wait never holds that lease. Submission and patrol waiters use one SQLite ticket ledger and admitted submissions have priority over ordinary response patrol.",
    "Independent submitted feeds may wait for provider responses concurrently up to the operator-owned runtime capacity, which is not caller-controlled and is not a fixed product constant.",
    "When a plugin-owned task acknowledges takeover, AI Input Gateway records that exact owner key, releases the single provider target to the operator, and makes all new web-chat executions wait without reacquiring the tab until that same owner explicitly resumes.",
    "Login, CAPTCHA, 2FA, risk control, account limits, ambiguous DOM, ambiguous page controls, and unproved native selection return review_required.",
    "Captured response checkpoints, model/profile proof, title proof, provider URL, timing, warnings, continuation topology and failure evidence survive later cleanup or projection failures."
  ],
  "forbidden": [
    "reading cookies, browser storage, passwords, tokens, or hidden credentials",
    "automatic login, CAPTCHA bypass, account rotation, security-barrier bypass, or unbounded retry",
    "patrol, submission or another task reacquiring the provider target while any plugin takeover owner remains active",
    "downgrading or erasing a completely captured provider response because later title, artifact or cleanup work failed",
    "using application activation, whichever Chrome window is foreground, accessibility window ordering, or a second physical provider tab as page identity"
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
  "summary": "GPT Web uses one Session Controller to bind task identity, semantic execution profile, exact conversation topology, bounded page actions and compulsory privacy-safe title finalization without making titles a routing identity.",
  "required": [
    "Every governed GPT feed resolves exactly one topology mode: fresh, same_conversation or forked_from_checkpoint. A checkpoint fork first verifies the exact parent canonical URL, parent user-turn marker and following assistant response hash, performs the provider branch action, proves a distinct child canonical URL with inherited checkpoint history, and records action evidence plus child history fingerprint before child submission. Unsupported or ambiguous fork controls fail closed and never degrade to a blank chat or uploaded summary.",
    "Runtime capacity is operator-owned, positive, bounded and configurable without becoming a caller field or product-mode switch; the default capacity supports at least ten independent in-flight GPT conversations. Browser mutations remain globally serialized while provider generation waits do not hold the mutation lease.",
    "Every feed owns structured taskIdentity, immutable input hash, opaque execution/attempt identity, deterministic logical-turn marker and submitted-prompt hash. Retries for the same semantic turn retain the marker; changed input receives another marker. Callers never control concurrency, title, tab id, marker, selector, coordinate, browser command or action plan.",
    "Durable provider identity is exactly canonical non-WEB /c/ URL plus unique logical-turn marker and, after capture, response hash. A transient /c/WEB: URL is anti-resubmission evidence only. A human-readable provider title is secondary operator evidence only and must never authorize routing, continuation, fork, retry, recovery, deduplication or response capture.",
    "Every production GPT feed carries one canonical gpt-web-execution-profile.v1 before input hashing. The profile binds profileRef/profileHash, provider, transport, account capability, exact model display name/family, semantic reasoning tier, executor identity, acceptance identity and optional source profile identity. Semantic reasoning tiers are medium, high, extra_high, pro_standard and pro_extended. Legacy xhigh/pro vocabulary is normalized before hashing; a fixed slider index, coordinate-derived reasoning level, silent model substitution or reasoning downgrade is forbidden.",
    "Before attachments or prompt submission, Session Controller observes the current exact provider page and enforces the requested profile. If the already selected model and reasoning tier are exact it emits no-op proof; otherwise it selects exactly one semantic model candidate and exactly one semantic reasoning candidate and then reads both back. Missing or multiple candidates, wrong provider page, document drift, unavailable account capability or read-back mismatch fail closed. The verified profile proof is persisted in the execution ledger and projected into providerProof.",
    "A fresh GPT execution is established only on the provider root with zero user turns, zero assistant turns, empty composer, no staged attachment, no pasted-text card and no active generation. If that exact clean state already exists no New chat click occurs; otherwise only the unique actionable data-testid=create-new-chat-button sidebar anchor resolving to provider root is allowed. Unknown user drafts are never cleared. A stale GrassEye root draft may be cleared only when one exact marker resolves to one different durable canonical submitted execution and all zero-state guards are atomically rechecked immediately before mutation.",
    "A continuation first focuses its exact parent canonical URL and, when available, verifies the parent turn marker before upload or send. A checkpoint fork verifies its parent marker and checkpoint response before branching. A send click is not submission success: success requires one exact marked user turn, canonical non-WEB conversation identity and no conflicting execution binding. Page-global turn counts are observational only and cannot authorize retries.",
    "Response capture is scoped to the unique marked user turn and the immediately following substantive assistant turn. The governed outer turn identity is [data-testid^=conversation-turn-][data-turn=user|assistant]. Legacy article/data-message-author-role selectors, page-global last assistant selection and model-marker echo are forbidden as second identity chains. Loading, shimmer, reasoning, research progress, citation verification and tool summaries are not completed answers.",
    "When expectedOutputKind is generated_image, Gateway binds the exact marked user turn to the immediately following assistant turn, waits for exactly one completed generated-image card, opens that exact HTMLElement role=button card, uses exactly one visible button[aria-label=保存] viewer action and registers one newly downloaded decodable image with original byte hash and opaque provider output ref. Screenshots, other page images, 下载/Download text fallbacks, native-button casting and more than one new download are forbidden.",
    "Immediately after a text assistant turn is complete, runtime atomically persists answer bytes, hash, byte count, capture time and provider page URL as the response checkpoint before title finalization, artifact projection or cleanup. A generated-image output records its immutable output hash before title finalization. The checkpoint protects provider-result truth and prevents resubmission, but for a title-managed production GPT execution it is not by itself publishable success.",
    "Every new fresh conversation and every provider-created fork child is title-managed. Its expected title is generated only from allowlisted task label/role mappings, persisted creation time in operator time zone Asia/Dubai and an opaque short execution trace. It must not contain prompt text, user name, birth data, phone, email, address, sourceTaskId, database key, file name, turn marker, report content or another free-text user field. The caller cannot provide the title.",
    "After the result checkpoint and canonical submission proof exist, Session Controller performs one bounded title-finalization transaction under the existing exclusive patrol lease: focus exact canonical URL plus unique marker, locate the exact canonical sidebar row, reveal only that row's options, choose exactly one Rename action, locate one title textbox, write the expected title, read it back before commit, commit, then prove canonical path, unique marker and exact title. Already-correct title is a no-op proof. The transaction records page-action evidence and a verified conversationTitleProof. It never creates a title-housekeeping worker or a second title-routing chain.",
    "same_conversation continuation does not invent a new title. If the parent carries a verified title proof, the continuation inherits the exact expected title/hash and repairs drift during finalization; if a legacy parent predates this protocol and has no title proof, the continuation remains legacy-unmanaged and no fake title success is minted. Fork children receive a new title because they are distinct provider conversations.",
    "A title-managed execution may publish final success only after providerExecutionProfileProof and conversationTitleProof both match the immutable request/execution identity. Temporary rename-menu, textbox, sidebar-materialization, search-result or document-generation instability is recovery_pending and retains the response checkpoint, execution id, marker and provider lease evidence. Ambiguous or wrong-target controls are review_required. No title failure may erase the checkpoint or cause the provider turn to be resubmitted.",
    "GPT Web page actions are governed as one action-state contract. Each committed mutation may append bounded evidence containing action id, execution id, exact target/document reference hashes, before/after URL, candidate count, semantic labels, result and evidence hash. A BrowserDocumentRef change invalidates old coordinates and observations; the action must restart observation on the same execution rather than reusing stale coordinates.",
    "Existing conversation routing first uses exact canonical pathname in the one physical tab and verifies the unique marker after the click. When the exact older sidebar row is not materially available, chat search is a bounded discovery fallback: search uses the exact turn marker, a result is accepted only if its href resolves to the already persisted canonical pathname, and after click canonical pathname plus unique marker are re-proved. Search title matching may never become identity authority. Every search exit closes and verifies the exact Search chats dialog.",
    "Submitted feeds release the browser-mutation lease before provider generation completes. Admitted submissions retain priority over ordinary response patrol; submission and patrol waiters use one durable SQLite ticket ledger with strict FIFO patrol admission after submissions drain. Rate-limit acknowledgement remains the highest-priority process-wide survival action and never refreshes the page.",
    "Every page operation binds to the internally held exact ChatGPT BrowserTargetRef and current BrowserDocumentRef through the authenticated extension transport. After process restart, a submitted execution may reacquire only its exact persisted canonical URL: one exact-URL tab binds, multiple exact-URL tabs is identity ambiguity, absent exact URL opens that URL, unrelated same-origin tabs are ignored. After binding, normal conversation switching is sidebar DOM routing, not URL-first navigation.",
    "Every execution failure appends a bounded durable ledger entry with occurrence time, attempt id, pre-failure phase, classification, recoverability and reason. Temporary provider unavailability, capacity, rate limiting, browser disconnection, temporarily absent canonical row, page hydration, profile-menu not ready, title UI not ready and bounded search discovery are recovery_pending. Login/captcha/2FA/security barriers or ambiguous identity require review_required. Immutable profile/input/hash mismatch is failed.",
    "Process recovery never resubmits a captured provider turn. A valid checkpoint is loaded before browser reacquisition; for title-managed production GPT, recovery continues profile/title finalization on the exact canonical URL and marker before publication. Without a checkpoint, recovery trusts only persisted input identity, ordered attachment proof, canonical conversation identity and marker, never the caller's disposable source path. Legacy v2 execution records are migrated to v3 without fabricating providerExecutionProfileProof or conversationTitleProof.",
    "When an authorized factory supersedes one proven polluted pre-submit execution, ownership transfer is explicit and atomic. A corrected runtime may recover the same unsubmitted execution; retry count and failure-ledger length never convert recoverable provider lookup into a terminal user block.",
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
    "in-memory-only submission priority, unordered patrol races or a second scheduler ledger",
    "fixed reasoning-slider indexes, coordinate-to-reasoning arithmetic, model fallback, reasoning downgrade, caller split model/reasoning controls after production admission, or profile proof that does not match the hash-bound request profile",
    "caller-supplied chat title, title text derived from prompt/user/report content, machine title used as primary identity, title search used as final route proof, rename debt worker, periodic title housekeeping or a second rename implementation",
    "publishing a title-managed production GPT checkpoint before exact profile/title proof exists",
    "detaching provider post-processing as fire-and-forget work after checkpoint publication",
    "using stale BrowserDocumentRef coordinates after navigation or DOM document replacement",
    "page-global last-response extraction, legacy turn selectors, screenshot-as-output, or generated-image selector fallbacks",
    "a failed execution state without durable phase/classification/recoverability/reason evidence",
    "duplicate prompt submission after process restart or after response checkpoint persistence"
  ],
  "clauses": [
    {
      "clauseId": "apex-ai-input-gateway-005-v3-requirement",
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
