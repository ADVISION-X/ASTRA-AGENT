import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { BrowserAuthorityIssuer } from "../../src/lib/browser/infrastructure/browser-authority-issuer.js";
import { GRASSEYE_BROWSER_EXTENSION_ID } from "../../src/lib/browser/release/cws-extension-release-identity.js";
import { BrowserTransportActor } from "../../src/lib/browser/transport/transport-actor.js";

const hash = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}` as const;

const authenticatedProof = (run: number) => ({
  authTranscriptHash: hash(`transcript-${run}`),
  handshake: {
    pageSessionHash: hash(`page-session-${run}`),
    extensionId: GRASSEYE_BROWSER_EXTENSION_ID,
    extensionVersion: "0.2.0",
    sourceChannelToken: `page-channel-token-${run.toString().padStart(12, "0")}`,
    artifactSetHash: hash(`artifact-${run}`),
    releaseSecurityPolicyHash: hash(`release-policy-${run}`),
    profileEnrollmentHash: hash(`profile-${run}`),
    connectionGeneration: run + 1,
    protocolRevision: 1,
    capabilitySetHash: hash(`capabilities-${run}`),
    permissionPolicyHash: hash(`permissions-${run}`),
    originPolicyHash: hash(`origins-${run}`),
    livenessPolicyHash: hash(`liveness-${run}`),
    commandAdmissionBudgetHash: hash(`command-budget-${run}`),
    artifactStreamBudgetHash: hash(`artifact-budget-${run}`),
    expiresAt: new Date(Date.now() + 1_000).toISOString(),
  },
});

for (let run = 0; run < 64; run += 1) {
  const issuer = new BrowserAuthorityIssuer();
  const transport = new BrowserTransportActor(issuer);
  transport.start();
  transport.commitAuthentication(authenticatedProof(run));
  assert.equal(issuer.current().kind, "PRESENT");
  if (run % 2 === 0) transport.disconnect("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"); else transport.expireLiveness();
  assert.equal(issuer.current().kind, "ABSENT");
}

console.log("LOCAL_BROWSER_PROPERTY_MODEL_ACCEPTANCE_PASS");
