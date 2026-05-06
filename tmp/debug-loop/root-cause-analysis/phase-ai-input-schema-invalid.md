# phase-ai-input-schema-invalid

## Real Log Evidence

The reported runtime reached `judge-seeding-video` and failed at the AI owner boundary:

- `STEP_DISPATCH_STARTED` for `judge-seeding-video`
- `CAPABILITY_CALL_STARTED` in ability group `ai`
- `CAPABILITY_CALL_FAILED` with `failureReason=input_schema_invalid`
- `MISSION_FAILED` after `judge-seeding-video`

This proves startup, map readiness, Nerve Bus entry proof, Orchestration loop, and PAV were not the current blocker.

## Root Cause Files

- `src/capabilities/orchestration/runtime/orchestration-nerve-bus-envelope-builders.ts`
- `src/capabilities/orchestration/runtime/step-dispatch-shared.ts`
- `src/lib/local-runtime/workbench-nerve-bus-ai-request-builder.ts`
- `src/capabilities/ai/runtime/ai-dispatch-failure.ts`

## Why Old Code Failed

The AI request envelope used the prompt contract id as the AI `taskType` discriminant. The runtime therefore sent `vision.productPresence.v1` where `AiInputSchema` requires `product_presence_judgment`. Because the workbench AI input builder keys the product-presence visual payload on `taskType`, it also skipped the structured `image_collection` payload builder.

## Fix Files

- `src/capabilities/orchestration/ports/orchestration-nerve-bus-port.ts`
- `src/capabilities/orchestration/runtime/step-dispatch-shared.ts`
- `src/capabilities/orchestration/runtime/step-dispatch-request-builders.ts`
- `src/capabilities/orchestration/runtime/orchestration-nerve-bus-envelope-builders.ts`
- `src/lib/local-runtime/workbench-nerve-bus-ai-request-builder.ts`
- `src/capabilities/ai/schema-runtime.schema.ts`
- `src/capabilities/ai/runtime/ai-dispatch-failure.ts`
- `scripts/audit/domains/orchestration-capability/run-governed-runtime-checks.ts`
- `scripts/audit/domains/ai-capability/run-ai-runtime-contract-checks.ts`

## Why New Code No Longer Fails This Contract

Orchestration now resolves the Prompt Contract Registry entry, carries `taskType=product_presence_judgment` separately from `promptContractId=vision.productPresence.v1`, and the Nerve Bus AI envelope transports that task type. The workbench AI request builder validates the transported task type with `AiTaskTypeSchema` and builds the product-presence `image_collection` payload.

Focused proof command:

```txt
parseAiInput(buildWorkbenchAiAbilityRequest(...)) => parseSuccess=true
```

## Diagnostics

AI dispatch failures for `input_schema_invalid` now include safe diagnostics:

- `schemaIssueCount`
- `schemaIssueRef`
- `missingRequiredFields`
- `invalidFieldPaths`
- `actionableMessage`

The diagnostic builder does not emit raw prompt bodies or image data.

## Static Command Results

- `npm run typecheck`: PASS
- `npm run audit:ai`: still running negative proofs at time of report capture
- `npm run audit:orchestration`: blocked by existing non-current Orchestration baseline findings
- `npm run audit:forensics-persistence`: blocked by existing non-current Commander/startup baseline findings

## Next Real Runtime Verification Points

- `judge-seeding-video` should no longer fail with `input_schema_invalid`.
- Logs should show `taskType=product_presence_judgment`, `promptContractId=vision.productPresence.v1`, `expectedOutputSchema=ai.product_presence_judgment.v1`, `inputModality=image_collection`, and non-empty `inputRefs`.
- Acceptable outcomes are `success` with a product decision, `review_required` with a governed reason, or a real runtime failure such as local AI unavailable or timeout.
