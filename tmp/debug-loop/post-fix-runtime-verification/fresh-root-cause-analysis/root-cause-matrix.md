# Fresh Root Cause Matrix

| Blocker | Severity | Fresh Evidence | Controlling Surface | Nearest Upstream Writer | Assessment |
| --- | --- | --- | --- | --- | --- |
| BLOCKER-RUNTIME-1 | retired | current run no longer emits `prepare-ai-input proof requires scaleMapping` | `src/capabilities/screenshot/screenshot-schema-refinements.ts` | n/a | real fix verified; owner inspector and negative proof now cover the success-only gate |
| BLOCKER-RUNTIME-2 | P0 | `CAPABILITY_CALL_FAILED` then `MISSION_FAILED` at `prepare-ai-input` with `Stored image source dimensions must match sourceProof dimensions.` | `src/capabilities/screenshot/runtime/screenshot-stored-image-source-gate.ts` | `src/lib/local-runtime/workbench-screenshot-source-handoff.ts` | current runtime stop point; failure is produced when measured stored image dimensions do not match `sourceProof.sourceWidth/sourceHeight` |
| BLOCKER-LOG-1 | P1 | `task-start-response.json` commander proof has `missionId=null` and `traceId=null` | commander proof builder / task-start flow response path | `src/lib/local-app-shell/task-start-flow.ts`, `src/capabilities/commander-console/runtime/commander-proof-builder.ts` | residual governance/logging gap remains open, but it did not block the fresh mission from reaching deeper runtime execution |

## Notes

- The fresh Screenshot blocker moved from proof refinement to stored-image source validation.
- The failure string is emitted by `resolveStoredImageSourceContentFailure()` when the file measured from `request.source.sourceStorageRef` does not match `sourceProof.sourceWidth/sourceHeight`.
- The nearest sourceProof writer in the workbench handoff path currently writes `sourceWidth` and `sourceHeight` from `result.output.width` and `result.output.height`, with no dedicated parity inspector for these fields.
- `runtime-snapshot-post-trigger-final.json` still contains historical failed records, so blocker determination for this rerun must be based on the current-run filtered timeline rather than aggregate snapshot history.
