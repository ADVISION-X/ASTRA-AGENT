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
