---
name: "GrassEye Open Capability"
description: "Use when governing the independent Open Ability Group, target opening, navigation attempt proof, real Chrome session handoff, URL safety, target policy, idempotency, timeout/cancellation, raw open observation handoff, and the boundary that prevents platform adapters/startup/runtime from owning open truth."
applyTo: ".github/instructions/cursor-rules/modules/module-open-capability.instructions.md, src/capabilities/open/**, docs/法案辅助文件/GrassEye Open 能力组施工图.md, scripts/audit/domains/open-capability/**"
---

# GrassEye Open Capability FINAL

Scope: governs the independent Open Ability Group, target opening, navigation attempt proof, target policy, real browser session handoff, and raw open observation handoff.
Boundary: this module governs opening only. It does not own page readiness, page meaning, retired chain truth, retired selection choices, or mission branching.
Authority: this file is authoritative only for the open-capability domain.

Core doctrine:
- Open opens governed targets.
- AI owns readiness, safety, and page-kind judgment.
- Open may return raw open observation handoff refs only.

Open must not depend on page-state-capability.
Open may return raw post-open browser observation refs only.
AI remains the only owner of readiness, safety, page-kind, blocker, login/captcha/feed/video/comment interpretation.

Current active Open child capabilities:
- open-platform-entry-once
- open-local-workbench-once

Facebook / TikTok / other platform entries are target profiles (targetProfileRef), not child capabilities.
open-facebook, open-tiktok, open-local-program are retired as child capabilities.

## Law GRASSEYE-OPEN-CAPABILITY-001-V2

status: active
tier: P0
capabilityDomain: open-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Open input must carry short-chain mission truth plus governed target identity only.

### 主题

Open 输入合同

### 法条

Every OpenAbilityInput must be traceable to the governed mission chain that requested the open.

Required input fields:
- missionId
- runId
- sessionId when applicable
- roundId when applicable
- stepId
- capabilityCallId
- nerveBusEnvelopeId
- requestedBy
- targetProfileRef or targetUrl
- inputRef
- idempotencyKey
- timeoutMs when applicable

Required:
- missing stepId, capabilityCallId, nerveBusEnvelopeId, or inputRef must fail closed.
- targetUrl may be used only through governed target policy.
- Open success must return raw open observation handoff refs only (rawBrowserObservationRef / postOpenObservationRef).

Forbidden:
- retired selection field, retired selection version field, retired package field, retired package version field, retired binding field, retired branch-token field, or retired deterministic flow planning fields.
- default target URL fallback as runtime truth.
- Open claiming page readiness, page correctness, or semantic action success.
- page-state handoff / pageStateHandoffRef in any Open output or proof field.

## Law GRASSEYE-OPEN-CAPABILITY-002-V2

status: active
tier: P0
capabilityDomain: open-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Open proof must preserve navigation attempt truth and short-chain refs only.

### 主题

Open 证明短链化

### 法条

Open proof must preserve navigation attempt truth without reviving retired map fields.

Required proof fields:
- missionId
- runId
- roundId when applicable
- stepId
- capabilityCallId
- targetProfileRef or targetUrlSource
- resultRef
- rawBrowserObservationRef when available (replaces retired pageStateHandoffRef)
- postOpenObservationRef when available
- status
- failureReason or reviewRequiredReason when applicable

Forbidden:
- retired binding field in open proof.
- retired selection field or retired selection version field in open proof.
- retired package field or retired package version field in open proof.
- retired branch-token field or retired deterministic flow planning as open result truth.
- pageStateHandoffRef or pageStateRef in any proof field.
- page readiness, page correctness, login/captcha/feed/video/comment semantic in any proof field.

## Final Readiness Gate

The Open law is ready only when opening truth is target-policy plus short-chain mission refs and AI remains the only owner of page meaning.
