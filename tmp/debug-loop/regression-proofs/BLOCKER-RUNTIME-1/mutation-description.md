# BLOCKER-RUNTIME-1 Mutation

Production mutation removed the success-only gate from `validatePrepareAiInputScaleMapping()` in `src/capabilities/screenshot/screenshot-schema-refinements.ts`.

Expected result: Screenshot owner inspector must fail because `prepare-ai-input` would start requiring `scaleMapping` for failed and `review_required` proofs, masking the real non-success diagnostic path.
