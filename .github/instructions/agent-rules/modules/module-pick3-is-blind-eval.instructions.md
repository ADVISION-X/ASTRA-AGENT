---
description: "GrassEye Pick3 IS blind-evaluation executor law: official UAE Lottery Pick 3 sync, L80 isolated image batches, sealed AI predictions, reveal scoring, and prompt failure repair."
applyTo: "src/plugins/pick3-is-blind-eval/**/*.ts,scripts/audit/domains/pick3-is-blind-eval/**/*.ts,scripts/acceptance/pick3-is-blind-eval.acceptance.ts,docs/法案辅助文件/GrassEye Pick3 IS Blind Eval 施工图.md"
---

# GrassEye Pick3 IS Blind Eval Law

Scope: `pick3-is-blind-eval` is the only GrassEye owner for UAE Lottery Pick 3 official result synchronization and IS visual blind-evaluation execution.

This domain is not a betting module. It is an executor for a research workflow:

```text
UAE Lottery Pick 3 official source
-> immutable draw storage
-> L80 isolated hundreds/tens/ones image generation
-> one-image blind AI prediction
-> sealed prediction record
-> answer reveal and scoring
-> failed-case prompt review
-> prompt version repair
-> failure replay marked not valid for accuracy
```

## Required

- The job id is `pick3-is-blind-eval`.
- The plugin root is `src/plugins/pick3-is-blind-eval/`.
- The only official source is `https://www.theuaelottery.ae`.
- The official Pick 3 lottery type is `72`.
- First sync must support full historical backfill from official API bounds.
- Later sync must support incremental update without duplicating draws.
- A successful sync must prove full official coverage: local oldest draw date is at or before official `startTime`, local newest draw date is at or after official `endTime`, and every calendar date in the official `startTime`/`endTime` range has a stored official draw.
- Draw numbers, dates, and digits must be stored as official-source facts.
- Pick 3 digits must be mapped as `nums[0] -> hundreds`, `nums[1] -> tens`, `nums[2] -> ones`.
- The image window for this Pick3 executor is `L=80`.
- Hundreds, tens, and ones must be generated as separate isolated image families.
- Image payloads sent to AI must be one image at a time.
- Blind images must not contain target draw number, date, answer digit, axis label, title, or text hint.
- Blind images and image file names must contain no readable chart number, point count, phase, date, answer, position leak, or sequence id that can help prediction.
- Each AI prediction must record provider, exact model id, temperature, image detail setting, system prompt version, business prompt version, and prompt hashes.
- The result report must compare hit rate against random baseline for each position and for three-position combination.
- Random baseline is 50% for one position front/back and 12.5% for three-position front/back/back-family combination.
- A profitable-signal watch threshold must be explicit: three-position combination hit rate above 25%, approximately requiring each isolated position to be stable above 63%.
- Confidence output is subjective model strength only. It must not be stored or displayed as real draw probability.
- Calibration must be computed separately to test whether high-confidence predictions are actually more accurate.
- AI output must support `abstain` for unclear/noisy shapes, and scoring must report coverage separately from accuracy.
- AI predictions must be persisted before any answer reveal.
- Reveal must compare the sealed prediction against the stored official answer.
- Failure review may inspect only failed image, prompt version, sealed prediction, and revealed answer.
- Prompt rewrite must create a new prompt version instead of mutating historical prompts.
- Failure replay must be recorded as `mode = failure_replay` and `not_valid_for_accuracy = true`.
- BrowserController/Chrome verification must exist for official page drift checks and DOM/API consistency evidence.
- The AGENT-owned Pick3 Playbook is the only IS brain source for this executor.
- Active Playbook assets must live under `src/plugins/pick3-is-blind-eval/playbooks/`.
- Playbook content may teach visual grammar, decision rules, confidence discipline, and abstain rules.
- Playbook content sent to blind prediction must not contain concrete historical failed-case answers, target phase, date, answer digit, answer label, or future results.
- Playbook content sent to blind prediction must describe an anonymous time-series chart, not a lottery, Pick3, UAE draw, digit game, or betting source.
- Failure library and replay records may store revealed answers, but they must not be merged into the active blind Playbook payload.
- Playbook versions must be hash-addressed and persisted before prediction use.
- AI chat interaction must follow the Pick3 Prompt Exchange chain: send package, capture raw output, parse, persist interaction, then seal prediction.
- Manual GPT chat usage is allowed only as an AI Input Gateway sender/capture surface that returns raw output and provider proof into the same Pick3 Prompt Exchange chain.
- Pick3 GPT web-chat feeds must reuse one fixed AI Input Gateway workspace tab; each image starts a fresh ChatGPT conversation inside that same tab instead of opening a new browser tab.
- Pick3 GPT workspace tab reuse must be host/workspace based, not exact conversation URL based; `/c/<conversation>` URLs may be recorded only in the conversation ledger, never saved as the workspace tab anchor.
- Pick3 GPT workspace opening must use `reuse-host-tab` or an equivalent host-level workspace lease; it must not use `reuse-exact-url` against saved `/c/<conversation>` URLs.
- Pick3 prompt packages must include a non-secret `imageId` and `promptPackageId` identity binding, and GPT output must echo both values exactly.
- Pick3 GPT web-chat transport must verify after submit that the last submitted user message contains the expected bound image attachment before accepting any GPT JSON output.
- Composer-level or global attachment counts are only pre-submit readiness hints; they are not Pick3 proof that the image was bound to the submitted user message.
- If the last submitted Pick3 user message is missing the bound image, the runner must delete/abandon that failed ChatGPT conversation, reopen a new chat in the same workspace tab, resend the same governed one-image prompt and image once, and stop as `review_required` if it persists.
- Pick3 AI-visible prediction labels must be `lower`, `upper`, and `abstain` only; `front` and `back` are internal reveal/scoring labels only.
- Pick3 Prompt Exchange must map AI-visible `lower -> front`, `upper -> back`, and `abstain -> abstain` after identity validation and before sealing.
- Pick3 parsing must reject any response whose echoed `imageId` or `promptPackageId` does not match the active one-image request.
- Pick3 prompt package metadata, rendered prompt output contract, parser, acceptance, and audit must agree on the same AI-visible label contract; mismatch is a blocking failure.
- Pick3 Prompt Exchange may retry an empty web-chat raw output once before creating the Pick3 interaction record; non-empty invalid JSON must not be guessed or repaired.
- Pick3 Prompt Exchange must emit a terminal stdout line via `process.stdout.write` with prefix `[GRASSEYE][PICK3][EXCHANGE]` for every image at these moments: send_started (imageId, position, targetPhase, seq N/total), send_result (status, rawLen, boundVerify, boundCount, recoveryStatus), empty_output WARN (reviewReason, failureReason), retry_started (attempt, reason), and parse_result (parseStatus, parseFailureReason, predictionLabel, confidence).
- Pick3 Prompt Exchange terminal stdout must allow a human to reconstruct the exact send/receive/parse sequence for every image in a batch without opening any artifact file.
- When Pick3 Prompt Exchange rawLen=0 appears in terminal stdout, the log must include the gateway status, reviewRequiredReason, and failureReason so the empty-output cause is diagnosable from the terminal alone.
- Pick3 failure review must classify current visual-grammar terms, including rebound/bottom, top/exhaustion, shoulder, and inertia/momentum families, before falling back to `unknown`.
- Pick3 GPT Prompt Exchange must detect ChatGPT rate-limit dialogs such as `请求过于频繁` / `请稍等几分钟后再重试` / too-many-requests before parsing output.
- When a Pick3 GPT rate-limit dialog appears, the runner must immediately enter silent escalating backoff without clicking the dialog first: first 10 minutes, second 30 minutes, third 60 minutes.
- Pick3 GPT rate-limit backoff must emit Runtime Log Spine recovery events when detected, when backoff starts, during bounded heartbeat progress, when the wait elapses, when acknowledgement starts/completes/fails, when ChatGPT refresh starts/completes, when new chat is reopened, and when the same payload resend starts.
- Pick3 GPT rate-limit backoff must also emit a terminal stdout line (via process.stdout.write) every 30 seconds showing attempt number, elapsed status, and remaining seconds; terminal visibility is mandatory, not optional.
- Pick3 GPT rate-limit Runtime Log Spine events and terminal stdout must include `imageId`, `promptPackageId`, `missionKey`, `attempt`, `totalWaitSec`, `elapsedSec`, `remainingSec`, and `recoveryAction` so a human can prove which image is waiting and what will happen next.
- Pick3 GPT rate-limit waiting must not be one opaque long sleep; it must be chunked into observable heartbeat waits without increasing request frequency.
- After each Pick3 GPT rate-limit backoff expires, the runner must click the dialog acknowledgement, refresh/reopen ChatGPT in the same workspace tab, open a new chat, and resend the same governed one-image prompt and image.
- If Pick3 GPT rate limiting persists after the third backoff wait, the batch must stop as `review_required` before prediction sealing, reveal, or scoring.
- Pick3 GPT workspace cleanup must close only stale conversation tabs that were previously recorded by the Pick3 workspace ledger, preserving the current and immediately previous conversation.
- Pick3 GPT workspace cleanup must also delete stale ChatGPT sidebar conversation history entries recorded by the Pick3 workspace ledger, preserving the current and immediately previous conversation records.
- Pick3 GPT workspace cleanup must delete stale visible ChatGPT sidebar history entries whose title matches the controlled Pick3 training title allowlist: `Pick3 Blind Eval`, `Blind Eval`, `Blind Chart`, `Blind Time-Series`, `Blind Series`, or `Visual Pattern Prediction`, while preserving the current and immediately previous protected workspace URLs.
- Pick3 GPT history cleanup must refresh/reopen the ChatGPT home sidebar after deletion and treat any remaining non-protected Pick3 training history entry as cleanup failure.
- Pick3 GPT history cleanup must only execute deletions when the stale entry count reaches 15 or more; below this threshold the cleanup must be skipped (returning a deferred status) and training must continue uninterrupted.
- Pick3 GPT history cleanup must delete at most 3 stale entries per training run, even when the total stale count exceeds the threshold, to avoid triggering ChatGPT's history access rate limit.
- Pick3 training must stop before the next prompt when sidebar cleanup reports a deletion failure, because stale training conversations can pollute future ChatGPT context and make the history list explode.
- Pick3 GPT sidebar history menu hover must dispatch JS `mouseenter` and `mouseover` events on the target conversation row as a mandatory co-trigger alongside any native hover, because native browser.move is optional-chained and may silently no-op; JS dispatch ensures the "…" menu button renders in the DOM.
- Pick3 GPT sidebar history menu hover wait must be at least 600ms (not 250ms) after hover events before checking for the "…" button, and must poll for the button up to 1000ms total.
- Pick3 GPT composer focus must dispatch an Escape keyboard event and blur the active element to dismiss any floating menus or context menus before calling focusComposer, because sidebar hover events can leave floating menus open that intercept keyboard input.
- Pick3 GPT composer focus must allow up to 5000ms (not 2000ms) for the composer to register as focused after the focus call.
- Pick3 full pipeline must stop before reveal/scoring when any one-image GPT response fails JSON parsing or identity binding.
- Pick3 full pipeline must stop before interaction persistence, prediction sealing, reveal, or scoring when the provider cannot prove the submitted user message contains the current image.

## Forbidden

- No China lottery, 福彩 3D, or non-UAE Pick 3 source in this domain.
- No betting, ticket purchase, stake sizing, or wager recommendation.
- No login, cookies, local storage, password, payment, or user account handling.
- No third-party lottery mirror as source of truth.
- No mixed-position prompt or image batch for hundreds/tens/ones.
- No contact-sheet batch sent to AI as a blind-prediction payload.
- No chart number, point count, phase, date, answer, label, axis, title, or readable text in blind images.
- No model-version omission in prediction records.
- No treating model confidence as开奖概率 or calibrated probability.
- No hiding abstain cases inside misses or hits.
- No answer reveal before prediction sealing.
- No overwriting original predictions after reveal.
- No claiming failure replay accuracy as future/blind accuracy.
- No synthesizing missing official draws.
- No generic shared lottery owner hiding this domain.
- No runtime dependency on `/Users/nexgen/Documents/trend-intuition-brain`.
- No external Playbook fallback, bridge, mirror, or prompt path outside the Pick3 plugin owner.
- No direct manual response ingestion into `ai_predictions` without a persisted Pick3 AI interaction record.
- No one-GPT-tab-per-image behavior for Pick3 training.
- No sealed prediction when GPT output omits or changes the active `imageId` or `promptPackageId`.
- No accepting GPT JSON from a ChatGPT conversation where the last user message has no bound image attachment.
- No using global ChatGPT attachment count as final Pick3 image-delivery proof.
- No `front` / `back` labels in the AI-visible output contract, prompt package `allowedLabels`, or rendered GPT prompt.
- No failure-review classifier that treats current Playbook visual grammar as mostly `unknown`.
- No broad ChatGPT tab cleanup that closes user-owned or untracked provider tabs.

## Law IDs

```apex-law
{
  "lawId": "GRASSEYE-PICK3-IS-BLIND-EVAL-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "pick3-is-blind-eval",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+acceptance",
  "summary": "Pick3 IS blind eval must be a single UAE Lottery Pick 3 executor domain with official-source sync, isolated L80 image generation, sealed predictions, reveal scoring, and failure replay boundaries.",
  "forbidden": [
    "China lottery or 福彩 3D source mixing",
    "betting or account handling",
    "third-party lottery source of truth",
    "contact-sheet blind payloads",
    "answer reveal before prediction sealing",
    "failure replay counted as future accuracy"
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-PICK3-AI-PROMPT-EXCHANGE-007-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "pick3-is-blind-eval",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "prompt-exchange+interaction+acceptance+audit",
  "summary": "Pick3 AI prediction must use a Deep-Research-style prompt exchange: governed prompt package, gateway sender capture, raw provider proof persistence, schema parse, interaction record, then sealed prediction.",
  "required": [
    "Each one-image prompt package is sent through a Pick3 Prompt Exchange sender compatible with AI Input Gateway proof semantics.",
    "Raw GPT/web-chat output is persisted as a Pick3 AI interaction before business prediction sealing.",
    "Parse status is stored separately from prediction records.",
    "Only parsed interactions may create sealed ai_predictions.",
    "Manual GPT chat remains a capture surface, not a direct prediction write path.",
    "Pick3 GPT web-chat feeds reuse one fixed AI Input Gateway workspace tab while starting a fresh ChatGPT conversation for each image.",
    "Pick3 GPT workspace tab reuse is host/workspace based; conversation URLs are ledger facts only and must not become the saved workspace tab anchor.",
    "Pick3 GPT workspace opening uses reuse-host-tab or an equivalent host-level workspace lease, never reuse-exact-url against /c/<conversation> URLs.",
    "Every Pick3 prompt and GPT output carries matching imageId and promptPackageId identity fields before prediction sealing.",
    "Pick3 GPT web-chat transport verifies the last submitted user message contains the expected bound image attachment before accepting GPT JSON output.",
    "A missing bound image causes one same-workspace new-chat resend, then review_required if it persists.",
    "AI-visible labels are lower, upper, and abstain only; front/back exist only after parser mapping for internal reveal/scoring.",
    "Prompt package metadata, rendered prompt, parser, acceptance, and audit must agree on lower/upper/abstain.",
    "AI-visible Playbook payload is de-lotteried and frames the image as an anonymous time-series chart.",
    "Empty web-chat raw output is retried once before Pick3 interaction persistence; non-empty invalid JSON remains review_required.",
    "Pick3 GPT rate-limit dialogs trigger 10-minute, 30-minute, then 60-minute silent backoff before acknowledgement, refresh, new chat, and retry of the same governed one-image prompt.",
    "Pick3 GPT rate-limit backoff emits Runtime Log Spine RECOVERY_STARTED, RECOVERY_PROGRESS, RECOVERY_COMPLETED, and RECOVERY_FAILED events for waiting, acknowledgement, refresh, new-chat reopen, and same-payload resend.",
    "Pick3 GPT rate-limit waiting is chunked into heartbeat waits and is not one opaque long sleep.",
    "Persistent Pick3 GPT rate limiting after the third backoff wait stops the batch before prediction sealing, reveal, or scoring.",
    "Pick3 GPT cleanup is ledger-scoped and may close only stale recorded Pick3 provider tabs, keeping the current and immediately previous conversation.",
    "Pick3 GPT cleanup deletes stale recorded Pick3 ChatGPT sidebar conversation records, keeping the current and immediately previous conversation.",
    "Pick3 GPT legacy sidebar cleanup is limited to visible controlled training titles outside the current and immediately previous protected workspace URLs.",
    "Pick3 GPT history cleanup refreshes ChatGPT home after deletion and fails the training run when non-protected Pick3 training history remains visible.",
    "Any parse_failed_raw_available interaction blocks reveal and scoring for the batch."
  ],
  "forbidden": [
    "Writing ai_predictions directly from pasted GPT text without an interaction record.",
    "Treating provider transport success as business prediction success.",
    "Dropping parse-failed raw output.",
    "Treating a ChatGPT rate-limit dialog as model prediction output.",
    "Continuing to send Pick3 GPT prompts while a rate-limit dialog is visible.",
    "Creating a second prediction/scoring table or second AI transport chain.",
    "Opening a new GPT browser tab for every Pick3 image.",
    "Using exact /c/<conversation> URL matching as the Pick3 workspace tab reuse mechanism.",
    "Accepting a GPT response whose imageId or promptPackageId does not match the active request.",
    "Accepting GPT JSON when the last submitted user message does not contain the expected bound image attachment.",
    "Treating composer/global attachment counts as final Pick3 image-delivery proof.",
    "Allowing front/back to leak into the AI-visible output contract or prompt package allowedLabels.",
    "Continuing Pick3 training after sidebar history cleanup reports failed deletion.",
    "Closing untracked or user-owned ChatGPT tabs during Pick3 cleanup."
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-PICK3-IS-BRAIN-006-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "pick3-is-blind-eval",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "playbook+storage+acceptance+audit",
  "summary": "Pick3 IS brain must be AGENT-owned: active Playbook assets live inside the Pick3 plugin, are versioned and hash-addressed, and blind prediction payloads must not depend on trend-intuition-brain or leak concrete answers.",
  "required": [
    "Active Playbook assets live under src/plugins/pick3-is-blind-eval/playbooks/.",
    "Playbook versions are persisted with content hash before prediction use.",
    "Blind prompt packages include only visual grammar, decision rules, confidence discipline, abstain rules, and one image reference.",
    "Failure examples with revealed answers stay in failure review records or candidate repair notes, not in active blind Playbook payloads."
  ],
  "forbidden": [
    "Runtime dependency on /Users/nexgen/Documents/trend-intuition-brain.",
    "External Playbook fallback or prompt bridge.",
    "Active blind Playbook containing target phase, date, answer digit, answer label, or future results.",
    "Failure replay or revealed-answer memory counted as future blind accuracy."
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-PICK3-IS-BLIND-EVAL-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "pick3-is-blind-eval",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "source-contract+acceptance",
  "summary": "Pick3 source sync must use the verified UAE Lottery official pages and API contracts, including lotteryType 72 and 660301 draw-history pagination.",
  "required": [
    "Official site is https://www.theuaelottery.ae.",
    "Pick3 lotteryType is 72.",
    "660201 reads current lottery metadata.",
    "660104 reads official history bounds.",
    "660301 reads draw history and cursor pages.",
    "A successful sync refuses to pass when official startTime/endTime coverage is incomplete or has a date gap.",
    "Chrome DOM first row must be comparable with API first row.",
    "Digits map nums[0], nums[1], nums[2] to hundreds, tens, ones."
  ],
  "forbidden": [
    "Non-official lottery source of truth.",
    "Manual result edits without official evidence.",
    "Synthesized missing draws.",
    "Success status with missing earliest history, missing latest history, or an official date gap.",
    "Digit position remapping by prompt preference."
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-PICK3-IS-BLIND-EVAL-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "pick3-is-blind-eval",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "blind-boundary+acceptance",
  "summary": "Pick3 image and AI execution must preserve blind-test integrity: L80 windows, separated positions, one-image AI payloads, sealed predictions, and no answer leakage.",
  "required": [
    "Image window is L=80.",
    "Position families are hundreds, tens, ones.",
    "AI payload contains exactly one blind image.",
    "Prediction is persisted before reveal.",
    "Reveal refuses to run when prediction is missing.",
    "Failed cases are reviewed against a prompt version."
  ],
  "forbidden": [
    "Target draw/date/answer text in image.",
    "Axis/title/label text in image.",
    "Chart number or point count text in image.",
    "File name leaks target phase, position answer, or sequence clue.",
    "Mixed-position image or prompt.",
    "Contact-sheet AI payload.",
    "Post-reveal prediction overwrite."
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-PICK3-IS-BLIND-EVAL-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "pick3-is-blind-eval",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "model-metadata+baseline+calibration+acceptance",
  "summary": "Pick3 evaluation records must be reproducible and statistically honest: model settings are recorded, random baselines are reported, confidence is not probability, and abstain coverage is separated from accuracy.",
  "required": [
    "Prediction records include provider, model id, temperature, image detail, system prompt version, business prompt version, and prompt hashes.",
    "Reports include one-position 50% random baseline.",
    "Reports include three-position 12.5% random baseline.",
    "Reports include the 25% three-position watch threshold and the approximate 63% per-position stability threshold.",
    "Confidence calibration is reported separately from hit rate.",
    "Abstain is an allowed prediction label and coverage is reported separately."
  ],
  "forbidden": [
    "Provider-only model records.",
    "Confidence presented as real开奖概率.",
    "Accuracy report without random baseline comparison.",
    "Abstain counted as hit or miss without separate coverage accounting."
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-PICK3-IS-BLIND-EVAL-004-V1",
  "status": "active",
  "tier": "P1",
  "capabilityDomain": "pick3-is-blind-eval",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "prompt-version+audit",
  "summary": "Prompt repair must be versioned and failure replay must be marked as diagnostic only, never as valid future accuracy evidence.",
  "required": [
    "Prompt rewrite creates a new prompt version.",
    "Failure replay records original prediction id.",
    "Failure replay records repaired prompt version.",
    "Failure replay sets not_valid_for_accuracy true."
  ],
  "forbidden": [
    "Historical prompt mutation.",
    "Failure replay reported as blind accuracy.",
    "Replay overwrites original prediction or reveal."
  ]
}
```
