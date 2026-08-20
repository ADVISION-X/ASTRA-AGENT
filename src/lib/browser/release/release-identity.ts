import assert from "node:assert/strict";
import { createHash, createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type PresentReleaseSigningTrust = Readonly<{
  schemaVersion: "grasseye.browser.release-signing-trust.v1";
  state: "PRESENT";
  algorithm: "ed25519";
  keyId: string;
  publicKeyPem: string;
  publicKeyFingerprint: string;
}>;
type AbsentReleaseSigningTrust = Readonly<{
  schemaVersion: "grasseye.browser.release-signing-trust.v1";
  state: "ABSENT";
  reasonCode: "BROWSER_RELEASE_SIGNER_NOT_ENROLLED";
}>;
export type BrowserReleaseSigningTrust = PresentReleaseSigningTrust | AbsentReleaseSigningTrust;

export type ReleaseSignatureEnvelope = Readonly<{
  algorithm: "ed25519";
  keyId: string;
  signatureBase64: string;
}>;

const releaseDir = dirname(fileURLToPath(import.meta.url));
const trustPath = join(releaseDir, "release-signing-trust.json");
export const BROWSER_RELEASE_SIGNER_NOT_ENROLLED = "BROWSER_RELEASE_SIGNER_NOT_ENROLLED" as const;

export const sha256 = (value: Uint8Array | string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const canonicalReleaseIdentityPayload = (input: Readonly<Record<string, string>>): string =>
  JSON.stringify(Object.fromEntries(Object.entries(input).sort(([left], [right]) => left.localeCompare(right))));

export const loadBrowserReleaseSigningTrust = (): BrowserReleaseSigningTrust => {
  const parsed: unknown = JSON.parse(readFileSync(trustPath, "utf8"));
  assert.ok(parsed !== null && typeof parsed === "object" && !Array.isArray(parsed), "BROWSER_RELEASE_SIGNING_TRUST_INVALID");
  const trust = parsed as Record<string, unknown>;
  assert.equal(trust.schemaVersion, "grasseye.browser.release-signing-trust.v1", "BROWSER_RELEASE_SIGNING_TRUST_INVALID");
  if (trust.state === "ABSENT") {
    assert.equal(trust.reasonCode, BROWSER_RELEASE_SIGNER_NOT_ENROLLED, "BROWSER_RELEASE_SIGNING_TRUST_INVALID");
    return { schemaVersion: "grasseye.browser.release-signing-trust.v1", state: "ABSENT", reasonCode: BROWSER_RELEASE_SIGNER_NOT_ENROLLED };
  }
  assert.equal(trust.state, "PRESENT", "BROWSER_RELEASE_SIGNING_TRUST_INVALID");
  assert.equal(trust.algorithm, "ed25519", "BROWSER_RELEASE_SIGNING_TRUST_INVALID");
  for (const key of ["keyId", "publicKeyPem", "publicKeyFingerprint"] as const) {
    assert.equal(typeof trust[key], "string", "BROWSER_RELEASE_SIGNING_TRUST_INVALID");
    assert.ok((trust[key] as string).length > 0, "BROWSER_RELEASE_SIGNING_TRUST_INVALID");
  }
  return trust as PresentReleaseSigningTrust;
};

export const assertReleaseSignature = (input: Readonly<{
  envelope: ReleaseSignatureEnvelope;
  payload: string;
  trust?: BrowserReleaseSigningTrust;
}>): void => {
  const trust = input.trust ?? loadBrowserReleaseSigningTrust();
  if (trust.state === "ABSENT") throw new Error(trust.reasonCode);
  assert.equal(input.envelope.algorithm, "ed25519", "BROWSER_RELEASE_SIGNATURE_ALGORITHM_INVALID");
  assert.equal(input.envelope.keyId, trust.keyId, "BROWSER_RELEASE_SIGNATURE_KEY_ID_INVALID");
  const publicKey = createPublicKey(trust.publicKeyPem);
  const fingerprint = sha256(publicKey.export({ format: "der", type: "spki" }));
  assert.equal(fingerprint, trust.publicKeyFingerprint, "BROWSER_RELEASE_SIGNING_TRUST_FINGERPRINT_INVALID");
  const signature = Buffer.from(input.envelope.signatureBase64, "base64");
  assert.ok(signature.length > 0, "BROWSER_RELEASE_SIGNATURE_EMPTY");
  assert.equal(verify(null, Buffer.from(input.payload), publicKey, signature), true, "BROWSER_RELEASE_SIGNATURE_INVALID");
};
