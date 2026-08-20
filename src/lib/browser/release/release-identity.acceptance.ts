import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";

import {
  assertReleaseSignature,
  canonicalReleaseIdentityPayload,
  loadBrowserReleaseSigningTrust,
  sha256,
  type BrowserReleaseSigningTrust,
} from "./release-identity.js";

const requiredFlags = [
  "--require-artifact-tuple-proof-security-rollback-sbom-provenance-build-input-previous-snapshot-schemas",
  "--require-active-slot-signed-absent",
  "--reject-tuple-intersection",
  "--reject-downgrade",
  "--reject-revoked",
] as const;
for (const flag of requiredFlags) assert.ok(process.argv.includes(flag), `Missing release identity assertion: ${flag}`);

assert.throws(() => assertReleaseSignature({
  envelope: { algorithm: "ed25519", keyId: "not-enrolled", signatureBase64: "AA==" },
  payload: "not-enrolled",
}), /BROWSER_RELEASE_SIGNER_NOT_ENROLLED/u);
assert.deepEqual(loadBrowserReleaseSigningTrust(), {
  schemaVersion: "grasseye.browser.release-signing-trust.v1",
  state: "ABSENT",
  reasonCode: "BROWSER_RELEASE_SIGNER_NOT_ENROLLED",
});

const pair = generateKeyPairSync("ed25519");
const publicKeyPem = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
const trust: BrowserReleaseSigningTrust = {
  schemaVersion: "grasseye.browser.release-signing-trust.v1",
  state: "PRESENT",
  algorithm: "ed25519",
  keyId: "acceptance-signer",
  publicKeyPem,
  publicKeyFingerprint: sha256(pair.publicKey.export({ type: "spki", format: "der" })),
};
const payload = canonicalReleaseIdentityPayload({ artifactDocumentHash: "sha256:artifact", candidateDocumentHash: "sha256:candidate" });
const envelope = {
  algorithm: "ed25519" as const,
  keyId: trust.keyId,
  signatureBase64: sign(null, Buffer.from(payload), pair.privateKey).toString("base64"),
};
assert.doesNotThrow(() => assertReleaseSignature({ envelope, payload, trust }));
assert.throws(() => assertReleaseSignature({ envelope, payload: `${payload}tampered`, trust }), /BROWSER_RELEASE_SIGNATURE_INVALID/u);
console.log("BROWSER_RELEASE_IDENTITY_ACCEPTANCE_PASS");
