# BLOCKER-RUNTIME-1 Mutation

Production mutation removed `screenshotEvidenceRef` from `buildPrepareAiInputCommand()` source handoff resolution in `src/lib/local-runtime/workbench-screenshot-dispatch-input.ts`.

Expected result: Screenshot owner inspector must fail because `prepare-ai-input` can no longer derive governed stored-image `source` before entering the Screenshot boundary.
