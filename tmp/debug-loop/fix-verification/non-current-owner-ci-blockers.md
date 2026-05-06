# Non-current owner CI blockers

This run focused on AI runtime diagnostic transparency, Commander accepted-timeout truth, Forensics write proof fields, and docs/debug topology.

Observed non-current owner / pre-existing blockers:

```txt
npm run audit:orchestration
FAILED:
- Transition success path must persist lastRuntimeProofRef and runtimeProofRefs before Commander reads mission state.
- Transition success state must increment currentRoundIndex only when the governed loop explicitly returns to map.initialStepId.
- Orchestration inspector baseline must pass before negative-proof mutation checks.

GRASSEYE_SKIP_FORENSICS_NEGATIVE_PROOF=1 npm run audit:forensics-persistence
FAILED:
- Commander command flow is missing required structured debug events.
- AppShellHealth and MissionReadiness structured logging is not fully wired across startup and mission preflight surfaces.
```

Verified in-scope commands:

```txt
npm run typecheck: PASS
GRASSEYE_SKIP_AI_NEGATIVE_PROOF=1 npm run audit:ai: PASS
npm run audit:commander-console: PASS
```
