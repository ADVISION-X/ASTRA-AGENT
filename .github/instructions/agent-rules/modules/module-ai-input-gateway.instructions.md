---
name: "GrassEye AI Input Gateway"
description: "Use when defining external AI feeding, provider delivery, web-chat attachment transport, raw-response proof, or provider isolation."
applyTo: "src/capabilities/ai-input-gateway/**/*.{ts,tsx,json},src/lib/browser/current-chrome-native-multi-file-picker.ts,scripts/audit/domains/ai-input-gateway/**/*.{ts,json},scripts/acceptance/ai-input-gateway-*.ts,docs/法案辅助文件/GrassEye AI 投喂能立组施工图 V1.md"
---

# GrassEye AI Input Gateway

status: active
version: 2026-07-26
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
    "The serialized browser-mutation lease covers only opening a new conversation in that tab, attachment selection, prompt entry, submission proof, completed-chat manual-style rename, exact chat switching, DOM capture and cleanup; provider generation wait never holds that lease. Accepted tasks still waiting to submit have priority over ordinary response patrol, so already submitted conversations cannot starve a later attachment-and-prompt submission.",
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
  "lawId": "APEX-AI-INPUT-GATEWAY-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "ai-input-gateway",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance+real-chrome",
  "summary": "GPT Web feeds use bounded actual parallel conversations with serialized attachment and submit mutations, exact turn identity, durable recovery and no full-response global lock.",
  "required": [
    "Runtime capacity is operator-owned, positive, bounded and configurable without becoming a caller field or a product-mode switch; the default capacity supports at least ten independent in-flight GPT conversations.",
    "Every GPT feed owns an opaque internal attempt id, random turn marker, submitted prompt hash and unique human-readable system chat title. The title uses one internal allowlisted task label, UTC month-day and minute, plus a short opaque trace, for example SEO文章｜07-26 04:40Z｜A9F193A3-489B; it never copies prompt text, user names, report content or caller-supplied title text. After submit the runtime records the canonical conversation URL plus exact marker and immediately releases the submit slot, then after the provider answer is complete it clicks the exact non-WEB sidebar row, opens only that row's options menu, renames it, and proves the exact title plus marker before publishing the captured answer.",
    "Response capture is scoped to the unique marked user turn and the assistant turn after it, and never relies on the page-global last assistant message or model marker echo.",
    "Submitted feeds release the browser-mutation lease before provider generation completes; while any accepted task still awaits submit, ordinary response patrol yields. After all queued submissions are recorded, the patrol loop clicks the exact non-WEB sidebar row selected by captured canonical conversation identity and verifies the exact marker; a not-yet-materialized automatic sidebar title, a row that is visible but not yet focusable, and the same condition encountered during response-capture preflight or before-poll routing are retryable waiting_provider states rather than terminal failure. They must release the short patrol lease, wait until the next patrol, and must not persist review_required. After rename it clicks the exact system title and verifies the marker. Each patrol acquires only the short mutation lease.",
    "A ChatGPT answer remains generating whenever the exact assistant turn lacks its completion action or the live DOM exposes a visible thinking, reasoning, loading or shimmer progress node; intermediate research prose, tool summaries and citation-verification text are never treated as a completed answer.",
    "Whenever ChatGPT shows the ordinary request-frequency dialog, one process-wide unrouted watcher serves the single physical ChatGPT tab for every in-flight task. The highest-priority survival action is fixed: immediately click the unique acknowledgement such as 明白了, remain on the current conversation without page refresh or reload, and wait for the live DOM to recover before any title search, prompt action or response capture resumes.",
    "Process recovery resumes the exact captured conversation inside the same physical tab without resubmission; a completed but not-yet-renamed conversation must finish its row-scoped rename before answer publication. Once attachments_stable and a canonical submitted user turn have both been recorded, restart recovery trusts only the persisted input hash, ordered attachment proof, exact conversation URL, and marker; it never reads or uploads the caller's disposable source path again. Missing, duplicate or mismatched title, marker, attachment identity, hash, or byte count returns review_required."
  ],
  "forbidden": [
    "a global lease held from provider open through response capture",
    "a second physical ChatGPT tab, a per-task tab lease, or a provider-tab pool",
    "searching chats, sending, parsing, opening a new chat, resubmitting or waiting while an ordinary request-frequency dialog remains visible",
    "refreshing or reloading a ChatGPT page after rate-limit acknowledgement or as a no-result recovery action",
    "routing an existing ChatGPT task by browser URL open instead of clicking its exact sidebar DOM row",
    "treating a transient /c/WEB: sidebar row or the page-header conversation menu as the rename target",
    "holding the submit mutation slot while waiting for a running answer to expose its sidebar rename menu",
    "allowing per-task acknowledgement watchers or ordinary patrol to starve an accepted task that is still waiting to submit",
    "persisting review_required merely because an exact submitted sidebar row is temporarily absent, visible but not yet focusable, or still materializing during response-capture preflight or before-poll routing",
    "treating visible loading, shimmer, citation verification, tool progress or research progress as a completed answer",
    "caller-supplied concurrency, chat title, tab id, turn marker, selector or browser command",
    "machine-only titles made entirely from hashes, UUIDs or transport vocabulary, or titles copied from prompt text, user names or report content",
    "automatic provider titles as durable identity, duplicate prompt submission after restart, or unscoped last-response extraction",
    "legacy serial mode, compatibility bridge, shadow scheduler or per-request transport mode"
  ],
  "clauses": [
    {
      "clauseId": "apex-ai-input-gateway-005-requirement",
      "statement": "GPT Web feeds use bounded actual parallel conversations with serialized attachment and submit mutations, exact turn identity, durable recovery and no full-response global lock.",
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
    "The child ends only at skipped, attachments_stable, failed, or review_required and never enters prompt text, submits a prompt, or reads an answer."
  ],
  "forbidden": [
    "transport kind, provider selector, DOM selector, coordinate, tab id, native-picker instruction, or fallback policy in the public request",
    "switching transport after an attachment attempt starts",
    "retry-pasting the same file, silently falling back, or accepting a lower-bound attachment count",
    "provider or business vocabulary in the generic native multi-file picker primitive"
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
