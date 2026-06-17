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
    "Chrome DOM first row must be comparable with API first row.",
    "Digits map nums[0], nums[1], nums[2] to hundreds, tens, ones."
  ],
  "forbidden": [
    "Non-official lottery source of truth.",
    "Manual result edits without official evidence.",
    "Synthesized missing draws.",
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
