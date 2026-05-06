# Fresh Law / Blueprint Mapping

## BLOCKER-RUNTIME-1 (retired)

- law / blueprint truth: Screenshot `prepare-ai-input` success must carry `scaleMapping`, while non-success proofs must rely on `diagnosticPayloadRef` rather than a blanket `scaleMapping` requirement.
- runtime evidence: current explicit run no longer fails on `prepare-ai-input proof requires scaleMapping`.
- code evidence: `src/capabilities/screenshot/screenshot-schema-refinements.ts` now scopes the `prepare-ai-input` `scaleMapping` requirement to `status === "success"`.
- enforcement evidence: Screenshot inspector now fails when the success-only gate is removed and passes after rollback.

## BLOCKER-RUNTIME-2 (current)

- law / blueprint truth: stored-image source validation must reject mismatches between the declared `sourceProof` and the actual governed artifact file.
- runtime evidence: current explicit run fails with `Stored image source dimensions must match sourceProof dimensions.` at `prepare-ai-input`.
- code evidence: `src/capabilities/screenshot/runtime/screenshot-stored-image-source-gate.ts` throws this failure when measured file dimensions differ from `sourceProof.sourceWidth/sourceHeight`.
- nearest upstream writer: `src/lib/local-runtime/workbench-screenshot-source-handoff.ts` currently writes `sourceWidth` and `sourceHeight` from `result.output.width` and `result.output.height` into the handoff `sourceProof`.
- enforcement evidence: no current Screenshot inspector mutation explicitly guards stored-image source dimension parity.

## BLOCKER-LOG-1 (residual)

- law / blueprint truth: Commander ingress proof must preserve governed command correlation fields.
- fresh evidence: `tmp/debug-loop/post-fix-runtime-verification/task-start-response.json` still shows `runtimeProof.missionId=null` and `runtimeProof.traceId=null` on the accepted command response.
- conclusion: this remains open but is no longer the current runtime stop point.
