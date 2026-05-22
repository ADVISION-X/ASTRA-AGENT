import assert from "node:assert/strict";

import { FACEBOOK_MINING_MANDATORY_STAGES } from "../audit/domains/facebook-product-video-mining-log-coverage/facebook-mining-stage-matrix.js";

assert.equal(FACEBOOK_MINING_MANDATORY_STAGES.length, 17);
assert.ok(FACEBOOK_MINING_MANDATORY_STAGES.includes("FACEBOOK_AI_PARSE"));
assert.ok(FACEBOOK_MINING_MANDATORY_STAGES.includes("FACEBOOK_NAVIGATION_NEXT"));

process.stdout.write("[ACCEPTANCE] facebook-product-video-mining-log-coverage PASS\n");
