# User Requirement

- scenarioId: facebook-safe-comment-draft-product-video
- platformId: facebook-web
- goal: Open Facebook Reels in a governed real Chrome session, classify the current reel with vision.productPresence.v1, branch only to non-product safe-draft flow, type the approved draft text without submit, persist runtime proof, and end in a mandatory human review gate.

## Raw Requirement
Do not auto-post comments. On Facebook Reels, when the current video is judged non-product, open the comments UI, type a safe draft comment, and stop at a human review gate. Product videos or ambiguous detections must not create an auto-post path.

## Safe Executable Requirement
Open Facebook Reels in a governed real Chrome session, classify the current reel with vision.productPresence.v1, branch only to non-product safe-draft flow, type the approved draft text without submit, persist runtime proof, and end in a mandatory human review gate.

## Red Lines
- none