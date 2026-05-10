---
name: "GrassEye Page State Capability"
description: "Use when governing the independent Page State Ability Group as raw page/runtime observation packaging only, and the boundary that prevents Page State, open, runtime, PAV, Screenshot, Visual Target, or adapters from claiming visual/page/business interpretation."
applyTo: ".github/instructions/cursor-rules/modules/module-page-state-capability.instructions.md, src/capabilities/page-state/**, docs/法案辅助文件/GrassEye Page State 页面状态感知能力组施工图.md, scripts/audit/domains/page-state-capability/**"
---

# GrassEye Page State Capability FINAL

Scope: governs raw page/runtime observation packaging, evidence-backed observation output, and page-state owner evidence.
Boundary: this module governs raw observation only. It does not own page meaning, readiness, retired chain truth, or semantic action success.
Authority: this file is authoritative only for the page-state-capability domain.

Core doctrine:
- Page State packages raw observations only.
- AI is the only owner of current-page, blocker, readiness, and business interpretation.
- Page State must not revive retired selection choices, retired binding states, retired branch tokens, or page heuristics.

## Law GRASSEYE-PAGE-STATE-CAPABILITY-001-V3

status: active
tier: P0
capabilityDomain: page-state-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Page State input must carry short-chain mission truth plus raw observation refs only.

### 主题

页面原始观察打包边界唯一

### 法条

Page State Ability Group is the owner of governed raw page/runtime observation packaging only.

Required input fields:
- missionId
- runId
- sessionId when applicable
- roundId when applicable
- stepId
- capabilityCallId
- nerveBusEnvelopeId
- inputRef
- openHandoffRef when applicable
- currentUrl when available
- currentTitle when available
- browserLoginState when available
- rawRuntimeSignals
- snapshotProof

Required:
- Page State packages currentUrl, currentTitle, browserLoginState, source refs, open handoff refs, and raw runtime signals only.
- Page State result may be consumed by AI, Orchestration, PAV, Commander, and Forensics as raw observation/proof only.

Forbidden:
- retired selection field, retired selection version field, retired package field, retired package version field, retired binding field, retired branch-token field, or retired deterministic flow planning fields.
- feedReady, pageReady, pageCorrect, pageStateType = platform_feed, or semantic decision fields.
- Page State judging action success.

## Law GRASSEYE-PAGE-STATE-CAPABILITY-002-V3

status: active
tier: P0
capabilityDomain: page-state-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Page State proof must preserve raw observation truth and short-chain mission refs only.

### 主题

Page State 证明短链化

### 法条

Page State proof must preserve raw observation truth without retired map fields.

Required proof fields:
- missionId
- runId
- roundId when applicable
- stepId
- capabilityCallId
- observationRef
- status
- failureReason or reviewRequiredReason when applicable

Forbidden:
- retired binding field in page-state proof.
- retired selection field or retired selection version field in page-state proof.
- retired package field or retired package version field in page-state proof.
- retired branch-token field or retired deterministic flow planning as page-state truth.

## Final Readiness Gate

The Page State law is ready only when page-state output remains raw observation packaging and never becomes semantic truth.
