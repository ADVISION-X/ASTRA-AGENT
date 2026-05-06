# AI debug event wiring proof

`createConfiguredAiAbilityGroup` and `createAiExecutionContext` now pass `emitDebugEvent` into `createProviderAwareAiRuntimePort`, which forwards it into the local runtime adapter. `AI_REQUEST_DEBUG`, `AI_RESPONSE_DEBUG`, and `AI_ERROR_DEBUG` are mirrored by the structured terminal listener and persisted through the injected Forensics public boundary.

Verification:

```txt
npm run audit:ai: PASS
npm run typecheck: PASS
```
