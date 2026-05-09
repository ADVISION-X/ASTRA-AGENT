# User Requirement

- scenarioId: facebook-seeding-video-discovery
- platformId: facebook-web
- goal: Open Facebook Reels in a governed real Chrome session, verify page and safety state, classify the current reel with vision.productPresence.v1, open visible public comments only after geometry proof and PAV, extract visible comments with comments.ocr_cleanup.v1, persist evidence refs, and stop or review on gated states.

## Raw Requirement
Use a local authorized browser session to inspect public Facebook Reels, identify product-seeding video candidates, capture viewport and comment evidence, extract visible comments with OCR cleanup only, scroll to the next video, and persist governed evidence refs.

## Safe Executable Requirement
Open Facebook Reels in a governed real Chrome session, verify page and safety state, classify the current reel with vision.productPresence.v1, open visible public comments only after geometry proof and PAV, extract visible comments with comments.ocr_cleanup.v1, persist evidence refs, and stop or review on gated states.

## Red Lines
- none