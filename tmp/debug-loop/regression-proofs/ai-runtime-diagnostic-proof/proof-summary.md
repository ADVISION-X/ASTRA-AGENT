# AI runtime diagnostic proof

Production changes expose specific `implementationStatus`, `runtimeCallId`, `rawOutputRef/rawOutputHash`, `diagnosticPayloadRef`, `schemaIssueCount`, `qualityDecision`, and `outputBoundaryDecision` through AI result resolution, AI response envelopes, and Orchestration step result refs.

Fast verification:

```txt
GRASSEYE_SKIP_AI_NEGATIVE_PROOF=1 npm run audit:ai: PASS
npm run typecheck: PASS
```
