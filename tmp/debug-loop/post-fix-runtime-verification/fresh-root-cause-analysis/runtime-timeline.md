# Fresh Runtime Timeline

Source log: `tmp/debug-loop/post-fix-runtime-verification/runtime-log.txt`

Authoritative scope:
- Real restart on `http://127.0.0.1:4173`
- Real `POST /api/tasks/start` for the builtin Facebook and TikTok seeding-video maps

## Startup

- `dependency_check`, `update_preflight_check`, and `map_package_readiness_check`: PASS.
- `local_ai_runtime_presence_check`, `local_ai_model_roster_check`, `local_ai_start_or_connect`, `local_ai_health_probe`, and `ai_capability_readiness_gate`: PASS.
- `port_clear`: PASS on `127.0.0.1:4173`.
- `app_server`: ready; Commander Console shell started on `http://127.0.0.1:4173`.
- `APP_SHELL_HEALTH_PASSED`: PASS.
- `mission_runtime_available`: PASS.
- `waiting_for_human_command`: emitted.

Conclusion: the post-fix restart is no longer blocked at startup. The previous Local AI readiness timeout narrative is stale for this run.

## Facebook mission

- Human command accepted for `selectedMapId=facebook.seeding-video.discovery.meta.v1`.
- `HUMAN_COMMAND_VALIDATED`, `MISSION_PREFLIGHT_PASSED`, `COMMANDER_COMMAND_ENVELOPE_BUILT`, `NERVE_BUS_ENVELOPE_CREATED`, `MISSION_ACTIVATION_SNAPSHOT_FROZEN`, and `COMMAND_ACCEPTED` were all observed.
- The governed mission loop advanced through these steps without reproducing the old blockers:
	- `open-facebook-reels`
	- `verify-facebook-reels-open`
	- `detect-login-state`
	- `detect-safety-page`
	- `detect-feed-ready`
- On `capture-video-viewport`, Orchestration emitted both `STEP_DISPATCH_STARTED` and `CAPABILITY_CALL_STARTED` for the screenshot owner.
- The screenshot step then failed with:

```txt
[GRASSEYE][RUNTIME][FAIL] runtime CAPABILITY_CALL_FAILED failed Governed step "capture-video-viewport" returned status "failed". failureReason="[{\n  {\n    \"code\": \"custom\",\n    \"message\": \"videoVisitId is required in runtimeProof\",\n    \"path\": [\n      \"videoVisitId\"\n    ]\n  }\n}]"
```

- Mission terminal state: `MISSION_FAILED` after `capture-video-viewport`.

## TikTok mission

- Human command accepted for `selectedMapId=tiktok.seeding-video.discovery.meta.v1`.
- `HUMAN_COMMAND_VALIDATED`, `MISSION_PREFLIGHT_PASSED`, `COMMANDER_COMMAND_ENVELOPE_BUILT`, `NERVE_BUS_ENVELOPE_CREATED`, `MISSION_ACTIVATION_SNAPSHOT_FROZEN`, and `COMMAND_ACCEPTED` were all observed.
- The governed mission loop advanced through these steps:
	- `open-tiktok-feed`
	- `verify-tiktok-feed-open`
	- `detect-login-state`
	- `detect-safety-page`
	- `detect-feed-ready`
- On `capture-video-viewport`, Orchestration again emitted both `STEP_DISPATCH_STARTED` and `CAPABILITY_CALL_STARTED` for the screenshot owner.
- The screenshot step failed with the same runtimeProof error:

```txt
[GRASSEYE][RUNTIME][FAIL] runtime CAPABILITY_CALL_FAILED failed Governed step "capture-video-viewport" returned status "failed". failureReason="[{\n  {\n    \"code\": \"custom\",\n    \"message\": \"videoVisitId is required in runtimeProof\",\n    \"path\": [\n      \"videoVisitId\"\n    ]\n  }\n}]"
```

- Mission terminal state: `MISSION_FAILED` after `capture-video-viewport`.

## Fresh conclusion

- The old screenshot chain-field blocker is not present in this log. No fresh failure mentions missing `activationSnapshotRef`, `capabilityCallId`, `nerveBusEnvelopeId`, or `inputRef`.
- The old Orchestration event blocker is not present in this log. `CAPABILITY_CALL_STARTED` is clearly emitted before screenshot execution on both missions.
- The current shared blocker is now narrower and deeper: screenshot runtimeProof validation rejects null `videoVisitId` on the first `capture-video-viewport` step for both maps.
