import assert from "node:assert/strict";

import { RuntimeFailureClass } from "../../src/lib/runtime-logs/index.js";

assert.equal(RuntimeFailureClass.DOM_PROBE_FAILURE, "DOM_PROBE_FAILURE");
assert.equal(RuntimeFailureClass.MEDIA_DOWNLOAD_FAILURE, "MEDIA_DOWNLOAD_FAILURE");
assert.equal(RuntimeFailureClass.AI_PARSE_FAILURE, "AI_PARSE_FAILURE");
assert.equal(RuntimeFailureClass.NAVIGATION_FAILURE, "NAVIGATION_FAILURE");

process.stdout.write("[ACCEPTANCE] facebook-product-video-mining-failure-diagnosis PASS\n");
