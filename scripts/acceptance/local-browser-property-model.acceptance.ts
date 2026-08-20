import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { BrowserAuthorityIssuer } from "../../src/lib/browser/infrastructure/browser-authority-issuer.js";
import { BrowserTransportActor } from "../../src/lib/browser/transport/transport-actor.js";
import { hashAuthTranscript } from "../../src/lib/browser/transport/transport-authenticator.js";

const hash = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}` as const;
const authenticatedProof = (execution: string, run: number) => {
  const activationTupleHash = hash("tuple");
  const profileEnrollmentHash = hash("profile");
  const processIncarnationHash = hash("process");
  const transcript = {
    controllerNonce: `controller-${run}`,
    hostNonce: `host-${run}`,
    extensionNonce: `extension-${run}`,
    activationTupleHash,
    profileHash: profileEnrollmentHash,
    processHash: processIncarnationHash,
  };
  return {
    executionBindingHash: hash(execution),
    authTranscriptHash: hashAuthTranscript(transcript),
    handshake: {
      transcript,
      artifactSetHash: hash("artifact"),
      activationTupleHash,
      releaseSecurityPolicyHash: hash("release-policy"),
      profileEnrollmentHash,
      processIncarnationHash,
      controllerIncarnationHash: hash(`controller-incarnation-${run}`),
      connectionGeneration: run + 1,
      hostProcessEpoch: run + 1,
      nativePortEpoch: run + 1,
      extensionId: "grasseye_browser_authority",
      extensionVersion: "0.1.0",
      protocolRevision: 1,
      capabilitySetHash: hash("capabilities"),
      permissionPolicyHash: hash("permissions"),
      originPolicyHash: hash("origins"),
      livenessPolicyHash: hash("liveness"),
      commandAdmissionBudgetHash: hash("command-budget"),
      artifactStreamBudgetHash: hash("artifact-budget"),
      expiresAt: new Date(Date.now() + 1_000).toISOString(),
    },
  };
};
for (let run = 0; run < 64; run += 1) {
  const issuer = new BrowserAuthorityIssuer();
  const transport = new BrowserTransportActor(issuer);
  transport.start();
  transport.commitAuthentication(authenticatedProof(`execution-${run}`, run));
  assert.equal(issuer.current().kind, "PRESENT");
  if (run % 2 === 0) transport.disconnect("BROWSER_HOST_UNAVAILABLE"); else transport.expireLiveness();
  assert.equal(issuer.current().kind, "ABSENT");
}
console.log("LOCAL_BROWSER_PROPERTY_MODEL_ACCEPTANCE_PASS");
