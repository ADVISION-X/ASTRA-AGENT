---
name: "GrassEye Orchestration Capability"
description: "Governs pure visual mission loop, system save, and single next-action dispatch."
applyTo: "src/capabilities/orchestration/**, src/lib/local-runtime/**, docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md"
---

# GrassEye Orchestration Capability

status: active
version: 2026-05-13

## Boundary

Orchestration owns mission flow. It captures the screen, renders the coordinate grid, calls AI, saves evidence when requested, dispatches one atomic action, and advances to the next round.

It does not infer target semantics, page meaning, product meaning, or platform action shortcuts.

## Required Loop

```txt
1. loop guard
2. capture-browser-viewport
3. render-coordinate-grid
4. call AI pure-visual-round judge
5. parse pureVisualRound.v1
6. if output.save == true: systemSaveCurrentRoundEvidence()
7. if output.decision == done: complete mission
8. if output.decision == review_required: stop review_required
9. if output.decision == blocked: stop review_required
10. if output.decision == act: dispatch output.nextAction
11. next round
```

## State

Mission state uses generic task state only:

- `matchedEvidenceCount`
- `roundIndex`
- `lastActionStatus`
- `lastFailureReason`
- `lastReviewRequiredReason`
- `missionStatus` through `status`

## Forbidden

- Branching on product yes/no.
- Branching on page-state semantic decisions.
- Platform default recovery or engagement hints.
- AI-directed Forensics actions.
- Dispatch before save.
- More than one AI-selected action per round.
