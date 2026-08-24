import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readBrowserProofJournal } from "../../src/lib/browser/exact-target/browser-proof-journal.js";
import { BrowserAuthorityIssuer } from "../../src/lib/browser/infrastructure/browser-authority-issuer.js";
import { BrowserOwnerLock } from "../../src/lib/browser/infrastructure/browser-owner-lock.js";
import { BrowserInfrastructureSupervisor } from "../../src/lib/browser/infrastructure/browser-infrastructure-supervisor.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import type { BrowserUnsignedCommandPermit } from "../../src/lib/browser/transport/command-permit.js";

type SupervisorInternals = {
  onAuthenticated(input: Readonly<{
    extensionId: string;
    extensionVersion: string;
    releaseBuildId: string;
    sessionHash: `sha256:${string}`;
    commandPermitKey: string;
  }>): Readonly<{
    authorityRef: string;
    authorityEpoch: number;
    certificateHash: `sha256:${string}`;
    channelSessionHash: `sha256:${string}`;
  }>;
  onRevoked(reasonCode: string, refs?: Readonly<Record<string, string>>): void;
  ownerLock: BrowserOwnerLock;
  issuer: BrowserAuthorityIssuer;
  proofJournal: null | { recordLifecycle(event: Readonly<Record<string, unknown>>): void };
};

const internals = (instance: BrowserInfrastructureSupervisor): SupervisorInternals => ({
  onAuthenticated: Reflect.get(instance, "onAuthenticated") as SupervisorInternals["onAuthenticated"],
  onRevoked: Reflect.get(instance, "onRevoked") as SupervisorInternals["onRevoked"],
  ownerLock: Reflect.get(instance, "ownerLock") as BrowserOwnerLock,
  issuer: Reflect.get(instance, "issuer") as BrowserAuthorityIssuer,
  proofJournal: Reflect.get(instance, "proofJournal") as SupervisorInternals["proofJournal"],
});

const authenticateSupervisor = (
  instance: BrowserInfrastructureSupervisor,
  generation: number,
  releaseIdentity: { extensionId: string; version: string; releaseBuildId: string },
) => internals(instance).onAuthenticated.call(instance, {
  extensionId: releaseIdentity.extensionId,
  extensionVersion: releaseIdentity.version,
  releaseBuildId: releaseIdentity.releaseBuildId,
  sessionHash: `sha256:${generation.toString(16).padStart(64, "0")}`,
  commandPermitKey: Buffer.alloc(32, generation % 255 || 1).toString("base64"),
});

const createSupervisorHarness = (fixture: string) => {
  const sourceHash = `sha256:${"4".repeat(64)}` as const;
  const releaseIdentity = {
    schemaVersion: "grasseye.browser.unpacked-release.v1" as const,
    releaseBuildId: "release-build-supervisor-restart-v1",
    extensionId: "emkmbecadncngofidjgocmifhbonifgm",
    version: "1.0.0",
    extensionDirectoryHashV1: sourceHash,
    manifestHash: sourceHash,
    protocolHash: sourceHash,
    sitePolicyHash: sourceHash,
    createdAt: new Date().toISOString(),
  };
  const options = {
    dataDir: fixture,
    sourceFingerprint: sourceHash,
    profileConfig: {
      profileRef: "profile:journal-test",
      profileDir: join(fixture, "profile"),
      extensionId: releaseIdentity.extensionId,
      unpackedExtensionDirectory: join(fixture, "extension"),
    },
    enrolledProfile: {
      profileRef: "profile:journal-test",
      enrollmentHash: sourceHash,
      policyHash: sourceHash,
      extensionTreeHash: sourceHash,
      enrolledAt: new Date().toISOString(),
    },
    releaseIdentity,
    runtimeLogger: createRuntimeLogger({ terminalEnabled: false }),
  };
  const journalPath = join(fixture, "browser", "proof-events.ndjson");
  return { fixture, sourceHash, releaseIdentity, options, journalPath };
};

type SupervisorHarness = ReturnType<typeof createSupervisorHarness>;

const verifyUnpairedShutdown = async (harness: SupervisorHarness): Promise<void> => {
  const supervisor = new BrowserInfrastructureSupervisor(harness.options);
  await supervisor.start();
  assert.equal(supervisor.readOperatorPairingState().authority, "absent");
  const unpaired = internals(supervisor);
  const releaseOwnerLock = unpaired.ownerLock.release.bind(unpaired.ownerLock);
  unpaired.ownerLock.release = async () => {
    const lastEvent = readBrowserProofJournal(harness.journalPath).at(-1)?.event;
    assert.equal(lastEvent?.phase, "AUTHORITY_REVOKED", "unpaired shutdown must durably revoke before Owner lock release");
    if (!lastEvent || lastEvent.eventType !== "LIFECYCLE") throw new Error("unpaired shutdown must end in a lifecycle revoke");
    assert.equal(lastEvent.authorityRefHash, undefined, "unpaired shutdown revoke must not fabricate an Authority reference");
    await releaseOwnerLock();
  };
  await supervisor.stop();
};

const verifyJournalFaultRevocation = async (harness: SupervisorHarness): Promise<void> => {
  const supervisor = new BrowserInfrastructureSupervisor(harness.options);
  await supervisor.start();
  authenticateSupervisor(supervisor, 1, harness.releaseIdentity);
  const internal = internals(supervisor);
  const journal = internal.proofJournal;
  if (!journal) throw new Error("journal fault Supervisor must own its proof journal");
  const recordLifecycle = journal.recordLifecycle.bind(journal);
  journal.recordLifecycle = () => { throw new Error("JOURNAL_APPEND_FAULT"); };
  assert.throws(
    () => internal.onRevoked.call(supervisor, "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", { diagnosticSource: "extension-runtime" }),
    /JOURNAL_APPEND_FAULT/u,
    "a durable journal failure must surface after the live Authority has already been revoked",
  );
  assert.equal(internal.issuer.current().kind, "ABSENT", "journal failure must never leave a live Authority or old permit behind");
  journal.recordLifecycle = recordLifecycle;
  await supervisor.stop();
};

const unsignedPermit = (
  ready: ReturnType<typeof authenticateSupervisor>,
  sourceHash: `sha256:${string}`,
): BrowserUnsignedCommandPermit => ({
  permitRef: "permit:old", authorityRef: ready.authorityRef,
  authorityEpoch: ready.authorityEpoch, certificateHash: ready.certificateHash,
  channelSessionHash: ready.channelSessionHash, executionBindingHash: sourceHash,
  writerFenceHash: sourceHash, candidateHash: sourceHash,
  contractManifestHash: sourceHash, ownerPluginId: "owner:test", jobId: "job:test",
  attemptId: "attempt:test", deviceId: "device:test", leaseVersion: 1,
  localOrderId: "order:test", targetLeaseRef: "lease:test", targetRef: "target:test",
  documentRef: "document:test", capabilityId: "browser.navigate.v1", commandId: "command:test",
  sequence: 1, mutationClass: "mutation", workspaceRef: "workspace:test",
  commandTtlMs: 1_000, replyChannelToken: "reply:test",
});

const verifySupervisorRestart = async (harness: SupervisorHarness): Promise<void> => {
  const oldSupervisor = new BrowserInfrastructureSupervisor(harness.options);
  const newSupervisor = new BrowserInfrastructureSupervisor(harness.options);
  await oldSupervisor.start();
  assert.equal(oldSupervisor.readOperatorPairingState().authority, "absent");
  assert.equal(oldSupervisor.authorityBroker().currentOperatorTargetStatus(), "absent");
  await assert.rejects(newSupervisor.start(), /BROWSER_DUAL_ACTIVE_WORKER/u);
  const ready = authenticateSupervisor(oldSupervisor, 1, harness.releaseIdentity);
  const old = internals(oldSupervisor);
  const permitInput = unsignedPermit(ready, harness.sourceHash);
  const oldPermit = { ...permitInput, commandFrameMac: old.issuer.signCurrentCommandPermit(permitInput) };
  old.onRevoked.call(oldSupervisor, "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", { diagnosticSource: "extension-runtime" });
  assert.equal(oldSupervisor.readOperatorPairingState().authority, "absent", "Extension disconnect must revoke the active authority");
  assert.equal(oldSupervisor.authorityBroker().currentOperatorTargetStatus(), "absent", "Extension disconnect must revoke the active claim");
  assert.throws(() => old.issuer.assertCurrentCommandPermit(oldPermit), /BROWSER_EXTENSION_CHANNEL_UNAVAILABLE/u);
  authenticateSupervisor(oldSupervisor, 2, harness.releaseIdentity);
  assert.throws(() => old.issuer.assertCurrentCommandPermit(oldPermit), /BROWSER_COMMAND_PERMIT_INVALID/u);
  const releaseOwnerLock = old.ownerLock.release.bind(old.ownerLock);
  old.ownerLock.release = async () => {
    assert.equal(readBrowserProofJournal(harness.journalPath).at(-1)?.event.phase, "AUTHORITY_REVOKED");
    await releaseOwnerLock();
  };
  await oldSupervisor.stop();
  await newSupervisor.start();
  assert.equal(newSupervisor.readOperatorPairingState().authority, "absent", "restart must not auto-pair");
  assert.equal(newSupervisor.authorityBroker().currentOperatorTargetStatus(), "absent", "restart must not auto-claim");
  authenticateSupervisor(newSupervisor, 3, harness.releaseIdentity);
  assert.throws(() => internals(newSupervisor).issuer.assertCurrentCommandPermit(oldPermit), /BROWSER_COMMAND_PERMIT_INVALID/u);
  await newSupervisor.stop();
};

const verifyOneHundredRestarts = async (harness: SupervisorHarness): Promise<void> => {
  for (let restart = 0; restart < 100; restart += 1) {
    const current = new BrowserInfrastructureSupervisor(harness.options);
    await current.start();
    authenticateSupervisor(current, restart + 4, harness.releaseIdentity);
    await current.stop();
  }
  const journal = readBrowserProofJournal(harness.journalPath);
  assert.equal(journal.length, 209, "all Supervisor restart events must preserve one revoke chain");
  for (let index = 0; index < journal.length; index += 1) {
    assert.equal(journal[index]!.sequence, index + 1);
    assert.equal(journal[index]!.previousEntryHash, index === 0 ? `sha256:${"0".repeat(64)}` : journal[index - 1]!.entryHash);
  }
};

export const verifyBrowserSupervisorRestartContract = async (): Promise<void> => {
  const fixture = await mkdtemp(join(tmpdir(), "browser-supervisor-restart-"));
  const harness = createSupervisorHarness(fixture);
  try {
    await verifyUnpairedShutdown(harness);
    await verifyJournalFaultRevocation(harness);
    await verifySupervisorRestart(harness);
    await verifyOneHundredRestarts(harness);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
};
