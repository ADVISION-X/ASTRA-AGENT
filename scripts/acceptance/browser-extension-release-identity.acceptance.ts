import assert from "node:assert/strict";

import {
  assertCwsReleaseIdentity,
  GRASSEYE_BROWSER_EXTENSION_ID,
} from "../../src/lib/browser/release/cws-extension-release-identity.js";
import { assertCwsExtensionReleasePolicy } from "../../src/lib/browser/release/cws-extension-release-policy.js";
import {
  assertCwsReviewedReleaseProof,
  createCwsExtensionReleaseProof,
} from "../../src/lib/browser/release/cws-extension-release-proof.js";

const development = createCwsExtensionReleaseProof("0.2.0", null);
assert.equal(development.mode, "development");
assert.equal(development.identity.installedExtensionId, GRASSEYE_BROWSER_EXTENSION_ID);
assert.doesNotThrow(() => assertCwsReleaseIdentity(development.identity));
assert.doesNotThrow(() => assertCwsExtensionReleasePolicy(development.identity));
assert.throws(() => assertCwsReviewedReleaseProof(development), /BROWSER_CWS_REVIEW_REQUIRED/u);

const reviewed = createCwsExtensionReleaseProof("0.2.0", "cws-review-receipt:example");
assert.equal(reviewed.mode, "cws-reviewed");
assert.doesNotThrow(() => assertCwsReviewedReleaseProof(reviewed));

assert.throws(
  () => assertCwsExtensionReleasePolicy(createCwsExtensionReleaseProof("0.1.1", null).identity),
  /BROWSER_CWS_LEGACY_VERSION_FROZEN/u,
);
assert.throws(
  () => assertCwsExtensionReleasePolicy(createCwsExtensionReleaseProof("0.1.9", null).identity),
  /BROWSER_ROLLBACK_REJECTED/u,
);

console.log("BROWSER_EXTENSION_RELEASE_IDENTITY_ACCEPTANCE_PASS");
