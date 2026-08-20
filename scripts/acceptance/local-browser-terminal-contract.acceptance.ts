import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { BrowserCommandActor, type BrowserCommandPort } from "../../src/lib/browser/exact-target/browser-command-actor.js";
import { BrowserMutationIntentJournal } from "../../src/lib/browser/exact-target/browser-mutation-intent-journal.js";
import { BrowserTargetLeaseManager } from "../../src/lib/browser/exact-target/browser-target-lease-manager.js";
import { BrowserAuthorityIssuer } from "../../src/lib/browser/infrastructure/browser-authority-issuer.js";
import { BrowserCommandAdmissionBudget } from "../../src/lib/browser/transport/browser-command-admission-budget.js";
import { BrowserTransportActor } from "../../src/lib/browser/transport/transport-actor.js";
import { hashAuthTranscript } from "../../src/lib/browser/transport/transport-authenticator.js";
import { BROWSER_INFRASTRUCTURE_SLOS } from "../../src/lib/browser/infrastructure/browser-infrastructure-supervisor.js";
import { BrowserInfrastructureSupervisor } from "../../src/lib/browser/infrastructure/browser-infrastructure-supervisor.js";
import { resolveProductionBrowserProfileConfig } from "../../src/lib/browser/profile/browser-profile-config.js";
import { createBrowserProfileEnrollment } from "../../src/lib/browser/profile/browser-profile-enrollment.js";
import { assertExtensionCommandPermit, clearExtensionPermitAuthority, setExtensionPermitAuthority } from "../../src/lib/browser/chrome-extension/command-permit-validator.js";
import { hashBrowserAuthorityCertificate } from "../../src/lib/browser/infrastructure/browser-authority-certificate.js";

const retiredLegacyAcceptances = [
  "scripts/acceptance/local-browser-artifact-contract.acceptance.ts",
  "scripts/acceptance/local-browser-atomic-cutover.acceptance.ts",
  "scripts/acceptance/local-browser-business-workday.acceptance.ts",
  "scripts/acceptance/local-browser-exact-target-contract.acceptance.ts",
  "scripts/acceptance/local-browser-native-transport.acceptance.ts",
  "scripts/acceptance/local-browser-real-chrome-scenarios.acceptance.ts",
  "scripts/acceptance/local-browser-real-chrome.acceptance.ts",
  "scripts/acceptance/local-browser-target-actions.acceptance.ts",
] as const;

for (const retiredPath of retiredLegacyAcceptances) {
  assert.equal(existsSync(resolve(retiredPath)), false, `Retired Browser acceptance remains: ${retiredPath}`);
}

const hash = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}` as const;
const activationTupleHash = hash("tuple");
const profileEnrollmentHash = hash("profile");
const processIncarnationHash = hash("process");
const transcript = {
  controllerNonce: "controller-terminal",
  hostNonce: "host-terminal",
  extensionNonce: "extension-terminal",
  activationTupleHash,
  profileHash: profileEnrollmentHash,
  processHash: processIncarnationHash,
};
const authenticatedProof = {
  executionBindingHash: hash("execution"),
  authTranscriptHash: hashAuthTranscript(transcript),
  handshake: {
    transcript,
    artifactSetHash: hash("artifact"),
    activationTupleHash,
    releaseSecurityPolicyHash: hash("release-policy"),
    profileEnrollmentHash,
    processIncarnationHash,
    controllerIncarnationHash: hash("controller-incarnation"),
    connectionGeneration: 1,
    hostProcessEpoch: 1,
    nativePortEpoch: 1,
    extensionId: "grasseye_browser_authority",
    extensionVersion: "0.1.0",
    protocolRevision: 1,
    capabilitySetHash: hash("capabilities"),
    permissionPolicyHash: hash("permissions"),
    originPolicyHash: hash("origins"),
    livenessPolicyHash: hash("liveness"),
    commandAdmissionBudgetHash: hash("command-budget"),
    artifactStreamBudgetHash: hash("artifact-budget"),
    expiresAt: new Date(Date.now() + 10_000).toISOString(),
  },
};
const issuer = new BrowserAuthorityIssuer();
const transport = new BrowserTransportActor(issuer);
transport.start();
assert.equal(issuer.current().kind, "ABSENT");
transport.commitAuthentication(authenticatedProof);
const slot = issuer.current();
assert.equal(slot.kind, "PRESENT");
if (slot.kind !== "PRESENT") throw new Error("unreachable");
setExtensionPermitAuthority({
  authorityRef: slot.authority.authorityRef,
  authorityEpoch: slot.authority.authorityEpoch,
  certificateHash: hashBrowserAuthorityCertificate(slot.authority),
  activationTupleHash: slot.authority.activationTupleHash,
  executionBindingHash: slot.authority.executionBindingHash,
  commandPermitKey: issuer.commandPermitKeyBase64(),
});
const rejectedIssuer = new BrowserAuthorityIssuer();
const rejectedTransport = new BrowserTransportActor(rejectedIssuer);
rejectedTransport.start();
assert.throws(
  () => rejectedTransport.commitAuthentication({
    ...authenticatedProof,
    handshake: { ...authenticatedProof.handshake, nativePortEpoch: 0 },
  }),
  /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
);
assert.equal(
  rejectedIssuer.current().kind,
  "ABSENT",
  "an incomplete Host/MV3 handshake must never mint authority",
);
let extensionMacTested = false;
const port: BrowserCommandPort = {
  send: async (permit, command) => {
    await assertExtensionCommandPermit(permit);
    if (!extensionMacTested) {
      await assert.rejects(
        () => assertExtensionCommandPermit({ ...permit, targetRef: "modified-target" }),
        /BROWSER_COMMAND_PERMIT_INVALID/u,
      );
      extensionMacTested = true;
    }
    return {
      replyChannelToken: permit.replyChannelToken,
      sequence: permit.sequence,
      result: command.kind === "navigate"
        ? { documentRef: "document-2", targetRef: "target-1", navigationEpoch: 2 }
        : command.kind === "screenshot"
          ? { artifactRef: "artifact-1", contentHash: hash("image") }
          : { ok: true },
    };
  },
};
const journalDir = await mkdtemp(join(tmpdir(), "grasseye-browser-journal-"));
const manager = new BrowserTargetLeaseManager(
  slot.authority,
  {
    kind: "local",
    executionRef: "terminal-contract",
    jobRefHash: hash("job"),
    executionRefHash: hash("execution"),
    writerLeaseEpoch: 1,
    writerFenceHash: hash("fence"),
    candidateHash: hash("candidate"),
  },
  new BrowserCommandActor(
    new BrowserCommandAdmissionBudget(),
    port,
    new BrowserMutationIntentJournal(join(journalDir, "journal.ndjson")),
    { assertCurrentAuthority: (permit) => issuer.assertCurrentCommandPermit(permit) },
  ),
  issuer,
);
const lease = manager.acquire({
  ownerId: "terminal-contract",
  target: {
    target: { targetRef: "target-1", authorityEpoch: slot.authority.authorityEpoch, executionBindingHash: hash("execution") },
    document: { documentRef: "document-1", targetRef: "target-1", navigationEpoch: 1 },
    url: "about:blank",
    title: "initial",
  },
});
const document = await lease.navigate({ url: "https://example.invalid/", title: "terminal" });
assert.equal(document.documentRef, "document-2");
await lease.executeDomIntent({ kind: "find", locator: { role: "button" }, maxMatches: 1 });
await assert.rejects(() => lease.executeDomIntent({ kind: "find", locator: { role: "button" }, maxMatches: 21 }), /BROWSER_COMMAND_PERMIT_INVALID/u);
transport.disconnect("BROWSER_HOST_UNAVAILABLE");
assert.deepEqual(issuer.current(), { kind: "ABSENT", reasonCode: "BROWSER_HOST_UNAVAILABLE" });
assert.deepEqual(BROWSER_INFRASTRUCTURE_SLOS, {
  authorityAvailabilityPercent: 99.99,
  authorityIssuanceP99Ms: 5_000,
  recoverableChainRebuildP99Ms: 10_000,
  revokeToAbsentP99Ms: 10,
});
const supervisorDataDir = await mkdtemp(join(tmpdir(), "grasseye-browser-supervisor-"));
const profileConfig = resolveProductionBrowserProfileConfig(supervisorDataDir);
const supervisor = new BrowserInfrastructureSupervisor({
  dataDir: supervisorDataDir,
  profileConfig,
  enrolledProfile: createBrowserProfileEnrollment({ config: profileConfig, policyHash: hash("policy"), extensionTreeHash: hash("extension") }),
  commandPort: { send: async () => { throw new Error("BROWSER_HOST_UNAVAILABLE"); } },
  artifactResolver: { resolveArtifact: async () => { throw new Error("BROWSER_FILE_GRANT_INVALID"); } },
});
await supervisor.start();
assert.deepEqual(Object.keys(supervisor.health()).sort(), ["browserAuthority", "browserInfrastructure"]);
assert.equal(supervisor.health().browserAuthority.ok, false);
assert.equal(Object.values(supervisor.metrics()).every((value) => value === 0), true);
await supervisor.stop();
clearExtensionPermitAuthority();
console.log("LOCAL_BROWSER_TERMINAL_CONTRACT_ACCEPTANCE_PASS");
