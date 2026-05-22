# Facebook Product Video Mining Log Coverage Report

Status: FAIL

## Summary

- Total findings: 4
- Fatal findings: 4
- Mandatory stages: 17
- Covered stages: 16
- Stage coverage: 94%

## Stage Coverage

| Stage | Started | Terminal | Missing Fields | Owners |
|---|---:|---:|---|---|
| FACEBOOK_MISSION_PREFLIGHT | yes | yes | none | src/plugins/facebook-product-video-mining/facebook-product-video-mining.flow.ts |
| FACEBOOK_OPEN_FEED | yes | yes | none | src/plugins/facebook-product-video-mining/facebook-product-video-mining.flow.ts |
| FACEBOOK_WAIT_VIDEO_STABLE | yes | yes | none | src/plugins/facebook-product-video-mining/facebook-product-video-mining.flow.ts, src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-runtime.ts |
| FACEBOOK_ROUND_START | yes | yes | none | src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-runtime.ts |
| FACEBOOK_IDENTIFY_VIDEO | yes | yes | none | src/plugins/facebook-product-video-mining/facebook-product-video-mining.dom-probe.ts |
| FACEBOOK_DOM_PROBE | yes | yes | none | src/plugins/facebook-product-video-mining/facebook-product-video-mining.dom-probe.ts |
| FACEBOOK_COMMENT_COLLECTION | yes | yes | none | src/plugins/facebook-product-video-mining/facebook-product-video-mining.comments.ts |
| FACEBOOK_VIDEO_DOWNLOAD | yes | yes | durationMs | src/plugins/facebook-product-video-mining/facebook-product-video-mining.video.ts, src/plugins/facebook-product-video-mining/facebook-product-video-mining.round.ts |
| FACEBOOK_AI_UPLOAD | yes | yes | none | src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts |
| FACEBOOK_AI_RESPONSE_WAIT | yes | yes | none | src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts |
| FACEBOOK_AI_PARSE | yes | yes | none | src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts |
| FACEBOOK_DECISION_APPLY | yes | yes | none | src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-runtime.ts, src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-outcomes.ts |
| FACEBOOK_ARTIFACT_PROMOTE_OR_DELETE | yes | yes | none | src/plugins/facebook-product-video-mining/facebook-product-video-mining.video.ts, src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-outcomes.ts |
| FACEBOOK_NOT_INTERESTED | yes | yes | none | src/plugins/facebook-product-video-mining/facebook-product-video-mining.not-interested.ts, src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-outcomes.ts |
| FACEBOOK_NAVIGATION_NEXT | yes | yes | none | src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation.ts |
| FACEBOOK_VERIFY_NEXT_STABLE | yes | yes | none | src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation.ts |
| FACEBOOK_ROUND_FINALIZE | yes | yes | none | src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-runtime.ts |

## Failure Coverage

| Law | File | Line | Message | Hint |
|---|---|---:|---|---|
| GRASSEYE-RUNTIME-LOG-SPINE-010-V1 | src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-outcomes.ts | 71 | Facebook mining failure path lacks failureClass contract | Classify this path as DOM_PROBE_FAILURE / MEDIA_DOWNLOAD_FAILURE / AI_PARSE_FAILURE / NAVIGATION_FAILURE / RECOVERABLE_BROWSER_DRIFT / ACCOUNT_SECURITY_BLOCKER etc. Missing: failureClass, recoveryPolicy. |

## AI Coverage

No fatal findings.

## Navigation Coverage

No fatal findings.

## Recovery Coverage

| Law | File | Line | Message | Hint |
|---|---|---:|---|---|
| GRASSEYE-RUNTIME-LOG-SPINE-015-V1 | src/plugins/facebook-product-video-mining/facebook-product-video-mining.video.ts | 42 | Facebook recovery/fallback path lacks recoveryTrail logging | Add RECOVERY_STARTED/COMPLETED/FAILED events and include recoveryTrail linked to original failure. Missing: durationMs. |
| GRASSEYE-RUNTIME-LOG-SPINE-015-V1 | src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts | 132 | Facebook recovery/fallback path lacks recoveryTrail logging | Add RECOVERY_STARTED/COMPLETED/FAILED events and include recoveryTrail linked to original failure. Missing: recoveryTrail, action. |

## Artifact Coverage

No fatal findings.

## Fatal Findings

| Law | File | Line | Message | Hint |
|---|---|---:|---|---|
| GRASSEYE-RUNTIME-LOG-SPINE-016-V1 | src/plugins/facebook-product-video-mining/facebook-product-video-mining.video.ts | 41 | Facebook mining mandatory stage is missing log coverage | Add started and terminal logs for FACEBOOK_VIDEO_DOWNLOAD in src/plugins/facebook-product-video-mining/facebook-product-video-mining.video.ts, src/plugins/facebook-product-video-mining/facebook-product-video-mining.round.ts. Missing fields: durationMs. |
| GRASSEYE-RUNTIME-LOG-SPINE-010-V1 | src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-outcomes.ts | 71 | Facebook mining failure path lacks failureClass contract | Classify this path as DOM_PROBE_FAILURE / MEDIA_DOWNLOAD_FAILURE / AI_PARSE_FAILURE / NAVIGATION_FAILURE / RECOVERABLE_BROWSER_DRIFT / ACCOUNT_SECURITY_BLOCKER etc. Missing: failureClass, recoveryPolicy. |
| GRASSEYE-RUNTIME-LOG-SPINE-015-V1 | src/plugins/facebook-product-video-mining/facebook-product-video-mining.video.ts | 42 | Facebook recovery/fallback path lacks recoveryTrail logging | Add RECOVERY_STARTED/COMPLETED/FAILED events and include recoveryTrail linked to original failure. Missing: durationMs. |
| GRASSEYE-RUNTIME-LOG-SPINE-015-V1 | src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts | 132 | Facebook recovery/fallback path lacks recoveryTrail logging | Add RECOVERY_STARTED/COMPLETED/FAILED events and include recoveryTrail linked to original failure. Missing: recoveryTrail, action. |
