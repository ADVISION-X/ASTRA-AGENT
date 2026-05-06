# Non-current Owner CI Blockers

## `npm run audit:orchestration`

Current baseline failed on pre-existing Orchestration findings:

- `Transition success path must persist lastRuntimeProofRef and runtimeProofRefs before Commander reads mission state.`
- `Transition success state must increment currentRoundIndex only when the governed loop explicitly returns to map.initialStepId.`
- `Orchestration inspector baseline must pass before negative-proof mutation checks.`

## `npm run audit:forensics-persistence`

Current baseline failed on pre-existing structured logging findings:

- `Commander command flow is missing required structured debug events.`
- `AppShellHealth and MissionReadiness structured logging is not fully wired across startup and mission preflight surfaces.`
- `Forensics inspector baseline must pass before negative-proof mutation checks.`

## `npm run ci:full`

After fixing the initial code-purity and capability-governance issues from this patch, `ci:full` progressed into the parallel ability-group layer and then failed on non-current owners:

- `visual-target-capability`: inspector wiring/negative-proof imports are incomplete.
- `page-state-capability`: local runtime page-state dispatch is missing required envelope chain fields.
- `forensics-persistence-capability`: Commander command flow and startup health structured logging checks are incomplete.
- `open-capability`: registry metadata and current Chrome screenshot capture requirements are incomplete.
- `nerve-bus-capability`: Orchestration must consume Nerve Bus through public index.

Focused current-owner checks after the patch:

- `npm run audit:ai`: PASS
- `npm run audit:orchestration`: only pre-existing mission loop traceability findings remain; the AI taskType dispatch finding is clear.
