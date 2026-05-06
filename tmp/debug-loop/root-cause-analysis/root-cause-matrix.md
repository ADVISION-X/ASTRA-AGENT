# Root Cause Matrix

| ID | Status | Scope | First failing / missing signal | Direct code path | Root cause summary | Fix layer later | Priority |
|---|---|---|---|---|---|---|---|
| BLOCKER-RUNTIME-1 | current | latest real `tiktok-web` mission run; reproduced in same bundle | `CAPABILITY_CALL_FAILED prepare-ai-input` with `prepare-ai-input proof requires scaleMapping` | `src/capabilities/screenshot/screenshot-schema-refinements.ts` -> `validateScreenshotRuntimeProofPrepareAiInput(...)`; `src/capabilities/screenshot/runtime/screenshot-dispatch-failure.ts` -> `buildScreenshotFailureRuntimeProof(...)`; success-side control in `src/capabilities/screenshot/runtime/screenshot-execution-success-helpers.ts` -> `resolvePrepareAiInputScaleMapping(...)` | Screenshot success handling already knows how to compute `scaleMapping`, but failed-path proof building hardcodes `scaleMapping: null` and the schema refinement still requires `scaleMapping` for every `prepare-ai-input` proof regardless of `status`. Failed / review-style proofs therefore become schema-invalid before a deeper child failure can be exposed. | production code + screenshot inspector + screenshot negative proof | P0 |
| BLOCKER-LOG-1 | current | latest real command-ingress bundle; corroborated by both `current-tiktok` and `current-facebook` accepted receipts | `HUMAN_COMMAND_DRAFTED` missing; `HUMAN_COMMAND_RECEIVED` missing; accepted-command proof / event fields inconsistent | `src/lib/local-app-shell/task-start-flow.ts` -> `recordTaskStartDraftEvents(...)`; `src/lib/local-app-shell/task-start-support.ts`; `src/capabilities/commander-console/runtime/commander-command-outcomes.ts` -> `createTransportOutcome(...)`; `src/capabilities/commander-console/runtime/commander-proof-builder.ts`; `src/lib/local-runtime/workbench-commander-debug.ts` -> `buildCommanderDebugIdentity(...)` | The app-shell task-start path defines and calls draft / received event emission, but those events do not appear in the latest real bundle. In parallel, accepted-command proof and structured-event builders still allow null mission correlation fields, so `COMMAND_ACCEPTED` truth is split across multiple incomplete shapes instead of one governed ingress chain. | production code + structured logging enforcement + commander inspector + commander negative proof | P1 |

## Root-Cause Discipline

- `BLOCKER-RUNTIME-1` is the current execution stop point.
- `BLOCKER-LOG-1` is a command-provenance / log-transparency blocker, not the execution stop point.
- No additional current P2 blocker was elevated from the authoritative bundle.

## Non-Elevated / Historical Notes

- The previous missing-`source` Screenshot defect is historical in this bundle because the latest authoritative run reached `capture-video-viewport` success and then failed later on `scaleMapping` proof validation.
- Earlier mirroring blockers were not exercised by the authoritative web rerun, so they were not re-elevated without fresh runtime evidence.
