# Fresh Blocker List

## BLOCKER-POSTFIX-1: Screenshot runtimeProof rejects null `videoVisitId`

Priority: P0 current blocker.

### 1. 日志证据

```txt
[GRASSEYE][RUNTIME][FAIL] runtime CAPABILITY_CALL_FAILED failed Governed step "capture-video-viewport" returned status "failed". failureReason="[{\n  {\n    \"code\": \"custom\",\n    \"message\": \"videoVisitId is required in runtimeProof\",\n    \"path\": [\n      \"videoVisitId\"\n    ]\n  }\n}]" ... selectedMapId=facebook.seeding-video.discovery.meta.v1
[GRASSEYE][RUNTIME][FAIL] runtime CAPABILITY_CALL_FAILED failed Governed step "capture-video-viewport" returned status "failed". failureReason="[{\n  {\n    \"code\": \"custom\",\n    \"message\": \"videoVisitId is required in runtimeProof\",\n    \"path\": [\n      \"videoVisitId\"\n    ]\n  }\n}]" ... selectedMapId=tiktok.seeding-video.discovery.meta.v1
```

- Shared failing step: `capture-video-viewport`
- Shared failing owner: `screenshot`
- Shared failure message: `videoVisitId is required in runtimeProof`
- Shared terminal outcome: `MISSION_FAILED`

### 2. 实际行为

- Real restart succeeded. Commander Console reached `waiting_for_human_command`.
- `mission-readiness.json` reported `status=ready`.
- Facebook and TikTok `POST /api/tasks/start` both returned success with `transportStatus=accepted`.
- Both missions advanced through open, verification, login-state, safety-page, and feed-ready stages.
- The failure only appears when the screenshot owner validates the first `capture-video-viewport` result.

Conclusion: the transport path and pre-screenshot mission loop are no longer the blocker. The current blocker is now concentrated inside screenshot runtimeProof truth.

### 3. 已确认解决且本次未复发

- The old screenshot dispatch-chain blocker is gone. Fresh logs do not show missing `activationSnapshotRef`, `capabilityCallId`, `nerveBusEnvelopeId`, or `inputRef`.
- The old Orchestration lifecycle blocker is gone. `CAPABILITY_CALL_STARTED` is emitted before screenshot execution on both missions.

### 4. 法案/蓝图要求与当前冲突

- `src/capabilities/screenshot/schema.ts`
	- `ScreenshotRuntimeProofIdentitySchema.videoVisitId` is `nullableString`.
	- `ScreenshotCapturePolicySchema.allowMissingVideoVisitId` defaults to `true`.
- `docs/法案辅助文件/GrassEye Screenshot 能力组施工图.md`
	- section `15. Runtime Proof` records `videoVisitId: optional`.
- `src/map-plugins/builtins/facebook-seeding-video-discovery.meta.map-package.json`
	- `capture-video-viewport` only references `targetUrl`, `targetTitle`, and `pageStateRef`.
- `src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json`
	- `capture-video-viewport` uses the same early-capture input shape.

Current conflict: screenshot runtimeProof validation treats `videoVisitId` as mandatory even though the governed schema, capture policy, and blueprint all allow the first viewport capture to proceed without it.

### 5. 当前根因候选

- `src/capabilities/screenshot/screenshot-schema-refinements.ts`
	- `validateScreenshotRuntimeProofChain` iterates `SCREENSHOT_PROOF_CHAIN_FIELD_NAMES` and rejects any null field.
- `src/capabilities/screenshot/shared/screenshot-governance.ts`
	- `SCREENSHOT_PROOF_CHAIN_FIELD_NAMES` includes `videoVisitId`.
- `src/capabilities/screenshot/schema.ts`
	- the runtimeProof identity schema itself still defines `videoVisitId` as nullable.

This creates an owner-internal contradiction:
- schema identity says `videoVisitId` may be null
- runtimeProof refine says `videoVisitId` must not be null

On the first `capture-video-viewport` step, `envelope.videoVisitId` is still null, so screenshot self-rejects its own result.

### 6. 当前 owner 归属

- Primary owner: Screenshot capability schema and runtimeProof enforcement.
- Not current owner: local-runtime screenshot dispatch adapter.
- Not current owner: Orchestration dispatch-start lifecycle semantics.

### 7. 当前 readiness 结论

- `NOT READY`
- The next debug loop must target screenshot `videoVisitId` runtimeProof contract mismatch.
- Do not reopen the already fixed dispatch-chain blocker or the already fixed `CAPABILITY_CALL_STARTED` blocker.
