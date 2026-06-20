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
- Blind chart images must include a 50px blank trailing margin on the right side beyond the last data point, creating a visible "next-point space" that signals to the AI that the series is incomplete and a continuation is expected.
- Hundreds, tens, and ones must be generated as separate isolated image families.
- Image payloads sent to AI must be one image at a time.
- Blind images must not contain target draw number, date, answer digit, axis label, title, or text hint.
- Because the image has no axis labels, all prompt text sent to the AI must refer to the midline as the visual red dashed horizontal line, never as a numeric value such as "4.5". Naming an unlabeled axis position as a number gives the AI an unverifiable anchor it cannot check against the image, and invites false-precision reasoning (e.g. claiming a point is a specific numeric distance from a value it has no axis to measure against). The midline's numeric position may still appear in implementation specs that describe how the red dashed line is rendered (image generation code, blueprint pixel math); the restriction applies only to text the AI reads.
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
- Pick3 Playbook training follows a two-phase methodology. Phase 1 is evidence-mandatory exploration — AI must analyze every chart, name specific visual grammar shape words, state L80 zone weight, and derive a direction conclusion from that named evidence; guessing without named evidence is forbidden. Phase 2 is evidence-calibrated mode — built from Phase 1 correct-prediction evidence plus corrected wrong-prediction evidence.
- Pick3 may run a separate `free_analysis_strict_reasoning` experiment mode when explicitly requested. This mode must provide no direction rules, no fixed visual vocabulary, no position-specific mapping, and no shape-to-label playbook constraints; it must still require strict chart analysis before conclusion.
- The Workbench must expose `free_analysis_strict_reasoning` as an AI analysis mode for non-next-stability historical scoring runs by submitting `mode = full_pipeline` plus `promptMode = free_analysis_strict_reasoning`; it must not create a separate `free_analysis` task mode or second pipeline.
- Free Analysis Strict Reasoning output must include `chartReading`, `recentBehavior`, `supportingEvidence`, `counterEvidence`, and `decisionLogic`; parser validation must reject missing or shallow analysis instead of allowing random lower/upper guesses.
- Free Analysis Strict Reasoning output must additionally include three probing fields that force verifiable inspection instead of an impression-based narrative: `zoneCount` (two non-negative integers — how many visible points the AI can confidently classify above vs below the midline, counted not estimated), `patternRecurrence` (how many times the pattern named in `supportingEvidence` actually recurs in the visible window, and how many of those recurrences were followed by the predicted direction), and `weakestLink` (the single weakest assumption in the AI's own reasoning chain). These three fields guide the AI to deeper inspection through self-checking questions — they do not impose a fixed vocabulary or a direction rule, and must not be confused with the V1 evidence fields (`tailShapes`, `zoneWeight`, `drivingEvidence`, `discountedEvidence`).
- Free Analysis Strict Reasoning must stay in the same Pick3 Prompt Exchange, one-image blind prediction, sealed prediction, reveal, and scoring chain. It must not create a second AI transport, second prediction table, second scoring path, or ungoverned manual answer path.
- Phase 1 Playbook must require AI to name specific visual grammar shape words for every prediction and state zone weight across the L80 window. A prediction without named visual evidence is invalid.
- Phase 1 AI output contract must include four structured evidence fields in addition to predictionLabel and confidence: `tailShapes` (array of named grammar words observed in the tail), `zoneWeight` ("lower_weighted" | "upper_weighted" | "balanced"), `drivingEvidence` (one sentence naming the specific shape that drove the direction conclusion), and `discountedEvidence` (one sentence naming any opposing signal that was observed but not allowed to override the conclusion, or null if no opposing signal was noticed). These fields are mandatory for every prediction including abstain.
- `tailShapes` values must be drawn exclusively from the named vocabulary defined in visual-grammar.md (motion words and shape words). Informal descriptors such as "rise", "climb", "ascending", "drop", "descend", or any word not defined in the visual-grammar vocabulary are invalid in `tailShapes` and must cause parse failure. The valid word list is: `surge_up`, `rise`, `slow_rise`, `hold`, `slow_fall`, `upper_fall`, `kill_down`, `sharp_top`, `sharp_bottom`, `bare_low`, `upward_inertia`, `downward_inertia`, `shoulder_return`, `shoulder_reject`, `shoulder_hold`, `high_pressure`, `low_pressure`, `high_to_shoulder_edge`, `oscillation_hold_upper`, `disordered_chop`.
- The `reason` field in Phase 1 must contain the full analytical chain — not one sentence. It must describe tail shapes observed, L80 zone weight, and how they produced the conclusion.
- `tailShapes`, `zoneWeight`, `drivingEvidence`, and `discountedEvidence` must be stored in the prediction record and persisted to the database alongside predictionLabel and confidence. These are the V2 evidence extraction fields.
- `discountedEvidence` purpose: when a prediction is wrong, this field reveals which opposing signal the AI noticed but overrode — enabling V2 correction rules without hindsight rationalization. `discountedEvidence` must be null when no opposing signal was observed, not an empty string.
- When a position playbook applies a contrarian override (e.g., Stream B treats `shoulder_hold` as lower evidence instead of upper), the standard grammar interpretation being overridden IS the discounted evidence. `discountedEvidence` must NOT be null in this case — it must name the standard grammar signal that was overridden and why the contrarian rule replaced it. Example: "Standard grammar classifies shoulder_hold as upper evidence; Stream B contrarian overrides this because high_pressure is absent."
- Parser must treat a response as parse_failed if tailShapes is missing or empty, or if zoneWeight is not one of the three valid values.
- Phase 1 Playbook must NOT mechanically force abstain for bare_low, kill_down, or any single-stroke shape — these are lower-leaning signals and must produce a lower conclusion when no named upper evidence of equal weight is present.
- Phase 1 confidence range is 0.51–0.75. Confidence 0.51 means one named evidence item with no contradiction — this is a valid analysis conclusion derived from that evidence, not a guess.
- Phase 1 abstain is only valid when the analysis identifies both a named lower signal and a named upper signal of equal weight that directly cancel each other. Weak or sparse evidence produces a low-confidence prediction, not abstain.
- Playbook versions must be hash-addressed and persisted before prediction use.
- AI chat interaction must follow the Pick3 Prompt Exchange chain: send package, capture raw output, parse, persist interaction, then seal prediction.
- Manual web-chat AI usage is allowed only as an AI Input Gateway sender/capture surface that returns raw output and provider proof into the same Pick3 Prompt Exchange chain.
- Pick3 full pipeline may use `gpt-web-chat` or `gemini-web-chat`; provider-specific DOM selectors, upload, submit, answer extraction, and error handling must stay inside the provider adapter layer and must not be mixed into one GPT/Gemini selector blob.
- Pick3 web-chat proof must capture two screenshots per image for both GPT and Gemini web-chat providers: prompt submitted and answer captured.
- Pick3 GPT web-chat feeds must reuse one fixed AI Input Gateway workspace tab; each image starts a fresh ChatGPT conversation inside that same tab instead of opening a new browser tab.
- Pick3 Gemini web-chat feeds must also reuse one fixed AI Input Gateway workspace tab, but every image must first navigate that tab to `https://gemini.google.com/app` so the submitted image cannot see previous Pick3 prompts, images, or answers.
- Pick3 Gemini web-chat prompt entry must use the verified Gemini composer focus plus real clipboard paste immediately after image upload; it must not burn the generic 20-second GPT clipboard-paste verification window before diagnosing Gemini prompt entry.
- Pick3 Gemini web-chat prompt paste failure must retry inside the `gemini_clipboard_prompt_paste` stage with verified composer focus and replacing clipboard paste before escalating to one-image retry.
- Pick3 Gemini web-chat must skip the pre-submit assistant snapshot after upload because every image is already isolated in a fresh `https://gemini.google.com/app` conversation; burning the response-stability wait before prompt entry is forbidden.
- Pick3 Gemini web-chat composer readiness must treat a single active-tab DOM probe timeout as retryable inside the 60-second composer-ready window and must emit terminal-visible provider_composer_ready logs before escalating.
- Pick3 web-chat workspace URL persistence must tolerate one active-tab DOM probe timeout by falling back to the browser session current URL instead of aborting a completed provider response.
- Pick3 web-chat provider-page assertion may reopen the provider home in the same workspace tab only when the active page is `chrome-error://...` before attachment upload; after upload or prompt submission it must fail instead of clearing an in-flight prompt.
- Pick3 Gemini web-chat upload-to-prompt stages must emit terminal-visible AI Input Gateway timing logs for upload, pre-submit snapshot skip, prompt prepare, attachment verify, and prompt submit so a human can diagnose whether delay is upload, prompt entry, or provider submission.
- Pick3 GPT workspace tab reuse must be host/workspace based, not exact conversation URL based; `/c/<conversation>` URLs may be recorded only in the conversation ledger, never saved as the workspace tab anchor.
- Pick3 Gemini workspace tab reuse must record `https://gemini.google.com/app/<conversation>` URLs in the provider-specific conversation ledger after response capture so history cleanup can preserve the current and immediately previous Gemini conversations; the ledger must retain enough entries for a full 25-batch three-position run plus margin, and stale tab closure must not truncate the history-deletion ledger.
- Pick3 GPT workspace opening must use `reuse-host-tab` or an equivalent host-level workspace lease; it must not use `reuse-exact-url` against saved `/c/<conversation>` URLs.
- Pick3 prompt packages must include a non-secret `imageId` and `promptPackageId` identity binding, and GPT output must echo both values exactly.
- Pick3 GPT web-chat transport must verify after submit that the last submitted user message contains the expected bound image attachment before accepting any GPT JSON output.
- Composer-level or global attachment counts are only pre-submit readiness hints; they are not Pick3 proof that the image was bound to the submitted user message.
- If the last submitted Pick3 user message is missing the bound image, the runner must delete/abandon that failed ChatGPT conversation, reopen a new chat in the same workspace tab, resend the same governed one-image prompt and image once, and stop as `review_required` if it persists.
- Pick3 AI-visible prediction labels must be `lower`, `upper`, and `abstain` only; `front` and `back` are internal reveal/scoring labels only.
- Pick3 Prompt Exchange must map AI-visible `lower -> front`, `upper -> back`, and `abstain -> abstain` after identity validation and before sealing.
- Pick3 parsing must reject any response whose echoed `imageId` or `promptPackageId` does not match the active one-image request.
- Pick3 prompt package metadata, rendered prompt output contract, parser, acceptance, and audit must agree on the same AI-visible label contract; mismatch is a blocking failure.
- Pick3 Prompt Exchange may retry an empty web-chat raw output once inside the current one-image send attempt before creating the Pick3 interaction record. If that one-image send still fails, the batch must not stop immediately; the same request must be deferred into the existing Pick3 Prompt Exchange completion queue while remaining images/repeats continue. The completion queue may run bounded same-chain recovery rounds, must not create a second transport, route, runner, prediction table, or scoring path, and must persist only final per-request parsed interactions or final unresolved interactions after completion rounds are exhausted. If structured JSON puts an explicit directional synonym in `predictionLabel` (`rise`, `rising`, `up`, `upward`, `upper`, `fall`, `falling`, `down`, `downward`, or `lower`), it must normalize through a fixed directional alias whitelist before confidence/evidence validation. If the invalid label is explicitly non-directional (`hold`, `neutral`, `flat`, `sideways`, `unclear`, or `no_direction`), it must be normalized to internal `abstain` with null confidence and a non-directional abstain reason; it must never be mapped to lower/upper. If `predictionLabel` is another unrecognized shape word, Pick3 Prompt Exchange may retry `pick3_prediction_label_invalid` once inside the current one-image send attempt before deferring that request to the completion queue. Non-empty invalid JSON, identity mismatch, and prompt package mismatch must not be guessed or repaired, but they may be retried only through the bounded same-chain completion queue.
- Pick3 Prompt Exchange must emit a terminal stdout line via `process.stdout.write` with prefix `[GRASSEYE][PICK3][EXCHANGE]` for every image at these moments: send_started (imageId, position, targetPhase, seq N/total), send_result (status, rawLen, boundVerify, boundCount, recoveryStatus), empty_output WARN (reviewReason, failureReason), retry_started (attempt, reason), and parse_result (parseStatus, parseFailureReason, predictionLabel, confidence).
- Pick3 Prompt Exchange completion queue must emit terminal-visible `deferred_retry_scheduled` lines with imageId, position, repeatIndex, nextCompletionRound, and reason, and the Prompt Exchange result must expose expectedCount, completedCount, deferredRetryCount, and unresolvedCount for flow/stability status proof.
- Pick3 Prompt Exchange terminal stdout must allow a human to reconstruct the exact send/receive/parse sequence for every image in a batch without opening any artifact file.
- When Pick3 Prompt Exchange rawLen=0 appears in terminal stdout, the log must include the gateway status, reviewRequiredReason, and failureReason so the empty-output cause is diagnosable from the terminal alone.
- Pick3 Prompt Exchange may keep an already captured raw GPT response when post-response source page restoration fails, but provider proof must record `restoredSourcePage=false`; this exception exists only because Pick3 does not use the restored source page for a downstream DOM action.
- Pick3 failure review must classify current visual-grammar terms, including rebound/bottom, top/exhaustion, shoulder, and inertia/momentum families, before falling back to `unknown`.
- Pick3 GPT Prompt Exchange must detect ChatGPT rate-limit dialogs such as `请求过于频繁` / `请稍等几分钟后再重试` / too-many-requests before parsing output.
- When a Pick3 GPT rate-limit dialog appears, the runner must immediately enter a silent 10-minute backoff without clicking the dialog first; each allowed recovery window is 10 minutes, not an escalating 10/30/60 minute chain.
- Pick3 GPT rate-limit backoff must emit Runtime Log Spine recovery events when detected, when backoff starts, during bounded heartbeat progress, when the wait elapses, when acknowledgement starts/completes/fails, when ChatGPT refresh starts/completes, when new chat is reopened, and when the same payload resend starts.
- Pick3 GPT rate-limit backoff must also emit a terminal stdout line (via process.stdout.write) every 30 seconds showing attempt number, elapsed status, and remaining seconds; terminal visibility is mandatory, not optional.
- Pick3 GPT rate-limit Runtime Log Spine events and terminal stdout must include `imageId`, `promptPackageId`, `missionKey`, `attempt`, `totalWaitSec`, `elapsedSec`, `remainingSec`, and `recoveryAction` so a human can prove which image is waiting and what will happen next.
- Pick3 GPT rate-limit waiting must not be one opaque long sleep; it must be chunked into observable heartbeat waits without increasing request frequency.
- After each Pick3 GPT rate-limit backoff expires, the runner must click the dialog acknowledgement, refresh/reopen ChatGPT in the same workspace tab, open a new chat, and resend the same governed one-image prompt and image.
- If Pick3 GPT rate limiting persists after the third backoff wait, the batch must stop as `review_required` before prediction sealing, reveal, or scoring.
- Pick3 GPT workspace cleanup must close only stale conversation tabs that were previously recorded by the Pick3 workspace ledger, preserving the current and immediately previous conversation.
- Pick3 GPT workspace cleanup must also delete stale ChatGPT sidebar conversation history entries recorded by the Pick3 workspace ledger, preserving the current and immediately previous conversation records.
- Pick3 GPT workspace cleanup must delete stale visible ChatGPT sidebar history entries whose title matches the controlled Pick3 training title allowlist: `Pick3 Blind Eval`, `Blind Eval`, `Blind Chart`, `Blind Time-Series`, `Blind Series`, or `Visual Pattern Prediction`, while preserving the current and immediately previous protected workspace URLs.
- Pick3 web-chat history cleanup must refresh/reopen the provider home sidebar after deletion and treat any remaining non-protected Pick3 training history entry as cleanup failure; ChatGPT must use `https://chatgpt.com/`, and Gemini must use `https://gemini.google.com/app`.
- Pick3 GPT history cleanup must only execute deletions when the stale entry count reaches 15 or more; below this threshold the cleanup must be skipped (returning a deferred status) and training must continue uninterrupted.
- Pick3 GPT history cleanup must delete at most 3 stale entries per training run, even when the total stale count exceeds the threshold, to avoid triggering ChatGPT's history access rate limit.
- Pick3 Gemini history cleanup must use the same governed sidebar delete flow as GPT after DOM verification: open the conversation actions menu, choose `Delete`, confirm the `Delete chat?` dialog, and verify the stale visible Pick3 training title no longer remains in Gemini Recent.
- Pick3 Gemini history cleanup must open the Gemini sidebar before discovering or verifying Recent entries; collapsed Gemini navigation is not proof that history is empty.
- Pick3 Gemini history cleanup must detect an already-open row action menu and use its `Delete` item directly instead of clicking `More options` again, because clicking `More options` on an open Gemini row menu closes the menu.
- Pick3 Gemini history cleanup may delete up to 80 stale Pick3 training entries per run through the verified Gemini Recent DOM path; it must not inherit ChatGPT's 3-entry safety cap because that cap exists for ChatGPT history rate-limit risk and causes Gemini blind training to stop under normal batch history volume.
- Pick3 Gemini history cleanup must rediscover Gemini Recent after each deletion pass because deleting visible rows can reveal older hidden Pick3 training rows; those newly visible rows must be deleted within the same governed cleanup run until no non-protected Pick3 history remains or the Gemini cap is exhausted.
- Pick3 Gemini pre-image history cleanup must run before attachment upload for every new Gemini Pick3 image, keep only the immediately previous completed Gemini Pick3 conversation because the new current conversation has not been created yet, and continue deleting stale Gemini Pick3 history until Gemini Recent confirms no N-2-or-older Pick3 conversation remains visible.
- Pick3 Gemini pre-image history cleanup must emit terminal-visible `pre_image_history_cleanup` timing logs with `keepRecentCount=1`, `triggerThreshold=1`, and the Gemini cleanup cap; if any non-protected N-2-or-older Gemini Pick3 history remains visible or the governed Gemini Recent delete flow reports a real deletion failure before upload, the run must stop as `review_required` instead of sending a possibly contaminated image.
- Pick3 Gemini pre-image history cleanup is Gemini-only and must not change ChatGPT's threshold-15 / max-3 history cleanup policy.
- Pick3 training must preserve parsed prediction results when post-response history cleanup reports deletion failure; cleanup failure is provider-proof hygiene evidence and must be logged, but it must not overwrite `parseStatus=parsed` or become `parse_failed_raw_available` after the AI answer already parsed.
- Pick3 GPT sidebar history menu hover must dispatch JS `mouseenter` and `mouseover` events on the target conversation row as a mandatory co-trigger alongside any native hover, because native browser.move is optional-chained and may silently no-op; JS dispatch ensures the "…" menu button renders in the DOM.
- Pick3 GPT sidebar history menu hover wait must be at least 600ms (not 250ms) after hover events before checking for the "…" button, and must poll for the button up to 1000ms total.
- Pick3 GPT composer focus must dispatch an Escape keyboard event and blur the active element to dismiss any floating menus or context menus before calling focusComposer, because sidebar hover events can leave floating menus open that intercept keyboard input.
- Pick3 GPT composer focus must allow up to 5000ms (not 2000ms) for the composer to register as focused after the focus call.
- Pick3 full pipeline must stop before reveal/scoring only after the same-chain Prompt Exchange completion queue is exhausted and any one-image request remains unresolved; transient one-image failures must not stop the batch before other images/repeats have been attempted.
- Pick3 full pipeline must stop before interaction persistence, prediction sealing, reveal, or scoring when the provider cannot prove the submitted user message contains the current image.
- Pick3 may run `next_prediction_stability` only after the latest official sync has succeeded with full official coverage; if latest official draw data is not fully confirmed, the mode must stop before image generation and AI feed.
- Pick3 `next_prediction_stability` generates exactly one next-period blind L80 image per selected position from the latest confirmed 80 official draws; there is no target answer, no reveal, no scoring, and no accuracy claim in this mode.
- Pick3 `next_prediction_stability` must use the existing `free_analysis_strict_reasoning` prompt mode for every repeat; it must not use the position-specific playbook prompt package.
- Pick3 `next_prediction_stability` treats `batchSize` as the repeat-send count for the same single image per position; it must not create `batchSize` different target images for one position.
- Pick3 `next_prediction_stability` must send every repeat through the existing Pick3 Prompt Exchange and AI Input Gateway one-image path, preserving one image per AI payload and raw interaction proof for every repeat.
- Pick3 `next_prediction_stability` output may display only per-position, per-repeat AI-visible result fields and proof refs; it must not compute, recommend, or persist a final user choice.
- Pick3 Workbench may expose an official trend display for human review, but it must read only stored official `pick3_draws` facts from the existing Pick3 storage chain.
- Pick3 trend display must render a fixed 80-draw window by default from the latest stored official data.
- Pick3 trend display must show hundreds, tens, and ones as three separated rows, never as one mixed-position line.
- Pick3 trend hover must expose the full draw information for the pointed draw: phase, official drawn numbers, and expected prize time.
- Pick3 trend drag may move the historical window across older stored official draws, but the visible window size must remain fixed at 80 draws.
- Pick3 trend display is a human UI read model only; it must not change blind image generation, AI payloads, prediction sealing, reveal, scoring, or next_prediction_stability output.
- Pick3 full_pipeline Playbook-mode failed positions must automatically create position-specific Playbook lesson records after reveal/scoring.
- Playbook lesson records must be stored in a dedicated lesson store, separate from task history, sealed predictions, reveals, and active Playbook payloads.
- Playbook lessons must be separated by position (`hundreds`, `tens`, `ones`); different positions must never be merged into one shared lesson bucket or aggregate count.
- Automatic Playbook review must return the failed image, historical prompt, raw AI reply, sealed prediction, revealed answer, and failure note to AI for post-mortem root-cause analysis only.
- Manual Playbook review must remain available from the History surface for any failed full_pipeline position.
- Playbook lessons may become candidate experience records only. Active Playbook rule changes require a later aggregation step after N position-specific lessons and must not be applied automatically.
- Free Analysis Strict Reasoning results must not enter the Playbook lesson store.

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
- No next-period prediction run without confirmed latest official UAE Lottery Pick 3 data.
- No majority-vote recommendation, wager advice, or system-chosen final Pick3 decision in `next_prediction_stability`.
- No generating multiple images for the same position to satisfy `next_prediction_stability` batchSize; batchSize is repeat-send count only.
- No Pick3 trend data from external mirrors, browser DOM scraping, localStorage, fixture rows, or `/Users/nexgen/Documents/trend-intuition-brain`.
- No trend display that changes the blind L80 image payload or leaks phase/date/answer text into AI blind images.
- No Playbook lesson generated for free_analysis_strict_reasoning.
- No Playbook lesson store that merges hundreds, tens, and ones into one shared bucket.
- No automatic Playbook mutation from a single failure review or candidate lesson.
- No Playbook review prompt that asks AI to re-predict the historical phase.

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
    "Empty web-chat raw output is retried once inside the current one-image attempt before Pick3 interaction persistence; unresolved one-image requests are deferred to the bounded same-chain Prompt Exchange completion queue while remaining images/repeats continue.",
    "Prompt Exchange exposes expectedCount, completedCount, deferredRetryCount, and unresolvedCount so full_pipeline and next_prediction_stability can prove batch convergence before completion.",
    "Pick3 GPT rate-limit dialogs trigger a 10-minute silent backoff before acknowledgement, refresh, new chat, and retry of the same governed one-image prompt; repeated allowed recovery windows remain 10 minutes each.",
    "Pick3 GPT rate-limit backoff emits Runtime Log Spine RECOVERY_STARTED, RECOVERY_PROGRESS, RECOVERY_COMPLETED, and RECOVERY_FAILED events for waiting, acknowledgement, refresh, new-chat reopen, and same-payload resend.",
    "Pick3 GPT rate-limit waiting is chunked into heartbeat waits and is not one opaque long sleep.",
    "Persistent Pick3 GPT rate limiting after the third backoff wait stops the batch before prediction sealing, reveal, or scoring.",
    "Pick3 GPT cleanup is ledger-scoped and may close only stale recorded Pick3 provider tabs, keeping the current and immediately previous conversation.",
    "Pick3 GPT cleanup deletes stale recorded Pick3 ChatGPT sidebar conversation records, keeping the current and immediately previous conversation.",
    "Pick3 GPT legacy sidebar cleanup is limited to visible controlled training titles outside the current and immediately previous protected workspace URLs.",
    "Pick3 web-chat history cleanup refreshes the correct provider home after deletion and fails the training run when non-protected Pick3 training history remains visible.",
    "Pick3 Gemini web-chat training uses the same governed sidebar-history cleanup flow as GPT, with Gemini DOM selectors and `Delete chat?` confirmation.",
    "Only final unresolved parse_failed_raw_available interactions after Prompt Exchange completion rounds are exhausted block reveal and scoring for the batch."
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
  "lawId": "GRASSEYE-PICK3-TREND-DISPLAY-010-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "pick3-is-blind-eval",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "official-storage+app-shell+acceptance+chrome",
  "summary": "Pick3 trend display must be a local Workbench read model over official pick3_draws with a fixed L80 visible window, three separated position rows, full hover draw facts, and drag navigation without altering blind AI execution.",
  "required": [
    "Trend data comes from existing Pick3 storage table pick3_draws through the Pick3 plugin owner.",
    "The local route is /api/pick3-is-blind-eval/trend and is admitted by the existing Workbench API Boundary as local UI only.",
    "The App Shell exposes a Pick3 Trend surface inside the existing Pick3 workspace.",
    "The visible trend window size is fixed at 80 draws.",
    "Hundreds, tens, and ones render as three separated rows.",
    "Hover exposes phase, official drawn numbers, and expected prize time.",
    "Mouse drag changes the historical start index while preserving the 80-draw window."
  ],
  "forbidden": [
    "External mirror, DOM scraping, localStorage, fixture rows, or trend-intuition-brain as trend truth.",
    "Second HTTP server, route bus, or trend-specific data store.",
    "Mixed-position single-line trend display.",
    "Trend UI mutating blind images, AI payloads, sealed predictions, reveal, or scoring."
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-PICK3-NEXT-PREDICTION-STABILITY-008-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "pick3-is-blind-eval",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "official-sync+prompt-exchange+acceptance+audit",
  "summary": "Pick3 next-period stability mode must first prove latest official data, then send the same single next-period image per selected position multiple times through the existing Prompt Exchange and display only per-repeat results.",
  "required": [
    "The mode id is next_prediction_stability.",
    "The latest official UAE Lottery Pick 3 sync must pass full official coverage before any next-period image or AI feed is created.",
    "Each selected position produces exactly one next-period blind L80 image from the latest confirmed 80 official draws.",
    "Every repeat uses the existing free_analysis_strict_reasoning prompt mode, not the position-specific playbook prompt package.",
    "batchSize is the repeat-send count for that same image, not the number of generated target images.",
    "Every repeat uses the existing Pick3 Prompt Exchange and AI Input Gateway one-image payload path.",
    "The persisted/displayed stability result lists position, imageId, repeat index, interaction id, prediction label, confidence, parse status, and raw proof ref for each repeat.",
    "The system must not produce a final selected label, majority-vote recommendation, betting advice, or user-choice instruction."
  ],
  "forbidden": [
    "Running next-period stability without confirmed latest official data.",
    "Generating multiple same-position images for the repeat count.",
    "Using position-specific playbook prompts for next-period stability.",
    "Creating a second AI transport, prediction table, scoring path, route, or result chain.",
    "Reveal, scoring, hit rate, or accuracy claims for next-period stability before the official answer exists.",
    "System-generated final recommendation or majority vote decision."
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-PICK3-HUMAN-REVIEW-HISTORY-009-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "pick3-is-blind-eval",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "task-history+raw-ai-answer+acceptance+chrome",
  "summary": "Pick3 next-period stability runs must produce a human review history that shows the phase context, same-image repeat proof, every repeat result, and the full AI answer without generating a buying or voting recommendation.",
  "required": [
    "Workbench exposes a Pick3 History surface for persisted next_prediction_stability task records.",
    "History rows show task id, batch id, status, created time, newest official phase, target phase, selected positions, provider, repeat count, and evidence completeness.",
    "Task detail shows each generated next-period image with position, image id, image sha256, target phase, visible start phase, and visible end phase.",
    "Task detail shows every repeat result with position, image id, repeat index, interaction id, prediction label, visible label, confidence, parse status, raw response hash, and raw proof ref.",
    "The AI answer viewer shows raw_response_text, rendered prompt, prompt package id, prompt contract id, provider proof, raw response hash, and raw output ref from the existing pick3_ai_interactions record.",
    "The primary source for AI answer review is the existing pick3_ai_interactions.raw_response_text field; raw output artifact refs are proof links only.",
    "The human review surface may show observed distribution counts but must not compute or display a final selected label, majority-vote instruction, buying advice, or betting advice.",
    "Observed distribution counts must be grouped by position. When a task selects more than one position, counts for different positions must never be summed into one shared total — mixing positions into a single count would let a human misread it as repeats of one position."
  ],
  "forbidden": [
    "History visible only through latest-task.json or filesystem manual inspection.",
    "History rows without newest official phase and target phase.",
    "Repeat detail without full raw AI answer access.",
    "Creating a second task history store, second AI answer store, or second result chain for human review.",
    "System-generated buy, bet, wager, majority choice, final pick, or recommendation text."
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-PICK3-PLAYBOOK-LESSON-STORE-011-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "pick3-is-blind-eval",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "lesson-store+prompt-exchange+history-ui+acceptance+audit",
  "summary": "Pick3 full_pipeline Playbook failures must automatically and manually produce position-specific post-mortem lesson records, saved separately from predictions and active Playbook payloads until enough lessons are aggregated for a later rule-version proposal.",
  "required": [
    "After full_pipeline reveal/scoring, every failed Playbook-mode position creates an automatic Playbook lesson review.",
    "History must also expose a manual Playbook review action for failed full_pipeline positions.",
    "The review evidence package includes the failed image, historical rendered prompt, historical raw AI reply, sealed prediction, revealed answer, failure review note, playbook version id, prompt package id, phase, and position.",
    "Review prompts are post-mortem analysis prompts and must explicitly forbid a new prediction.",
    "Lesson records are persisted in a dedicated pick3_playbook_lessons store.",
    "Each lesson records position as hundreds, tens, or ones and has an aggregate key beginning with that position.",
    "Lesson records preserve source as auto_review or manual_review and status as candidate, accepted, rejected, or promoted.",
    "Candidate lessons do not mutate active Playbook files or active Playbook payloads.",
    "Playbook rule-version proposals require a later N-lesson aggregation step."
  ],
  "forbidden": [
    "Generating Playbook lessons from free_analysis_strict_reasoning.",
    "Merging hundreds, tens, and ones lessons into one shared bucket.",
    "Writing lesson results into ai_predictions, ai_reveals, or pick3_ai_interactions as if they were blind predictions.",
    "Automatically modifying active Playbook files or active playbook payloads from a single lesson.",
    "Review prompts that ask the AI to predict the historical answer again.",
    "Second AI transport, second scoring path, second prediction table, or second history chain for lesson review."
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-PICK3-HISTORY-PHYSICAL-DELETE-010-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "pick3-is-blind-eval",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "physical-delete+native-confirm+acceptance+chrome",
  "summary": "Pick3 human review history deletion must be a deliberate irreversible physical delete guarded by a real browser confirmation dialog.",
  "required": [
    "Workbench History exposes a delete action for the selected Pick3 next_prediction_stability task.",
    "Delete action must show a native browser confirmation dialog before any backend delete request is sent.",
    "The confirmation copy must state that this is a physical delete, irreversible, and includes task evidence and AI answers.",
    "Canceling the confirmation dialog must send no delete request and must leave the history record readable.",
    "Confirming delete must physically remove the task directory and task.json.",
    "Confirming delete must remove matching SQLite rows for the task batch from pick3_ai_interactions, ai_predictions, ai_reveals, failure_reviews, is_blind_images, and is_blind_batches.",
    "Confirming delete must remove the task-owned artifact directory and raw output refs recorded by the task interactions when those paths are inside GrassEye runtime data.",
    "If latest-task.json points to the deleted task, it must be physically removed or rewritten from the newest remaining task record.",
    "Deleted task detail API must return not found after successful delete."
  ],
  "forbidden": [
    "Soft delete, hide-only, archive-only, or deleted flag storage.",
    "Custom in-page modal used as the only irreversible-delete confirmation.",
    "Deleting without a native browser confirmation.",
    "Leaving raw AI answer rows readable after a confirmed delete.",
    "Deleting paths outside GrassEye runtime data.",
    "Creating a second delete ledger, second history chain, or recoverable trash folder."
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
