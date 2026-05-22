# Facebook Product Video Mining Log Coverage Report

Status: PASS

## Summary

- Total findings: 0
- Fatal findings: 0
- Mandatory stages: 17
- Covered stages: 17
- Stage coverage: 100%

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
| FACEBOOK_VIDEO_DOWNLOAD | yes | yes | none | src/plugins/facebook-product-video-mining/facebook-product-video-mining.video.ts, src/plugins/facebook-product-video-mining/facebook-product-video-mining.round.ts |
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

No fatal findings.

## AI Coverage

No fatal findings.

## Navigation Coverage

No fatal findings.

## Recovery Coverage

No fatal findings.

## Artifact Coverage

No fatal findings.

## Fatal Findings

No fatal findings.
