import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProductionGptChildTools } from "../production-child-tools.js";
import { createGptAbilityGroup } from "../ability-group.js";
import { browserExecutionFailure } from "../../../lib/browser/browser-failure.js";
import { executionFailure } from "../../../lib/execution-failure.js";
import { BrowserMutationStore } from "../../../lib/browser/exact-target/browser-mutation-store.js";
import { BrowserTargetLeaseManager } from "../../../lib/browser/exact-target/browser-target-lease-manager.js";
import type { BrowserControlledTarget } from "../../../lib/browser/exact-target/browser-target-ref.js";
import type { BrowserAuthorityCertificateV1 } from
  "../../../lib/browser/infrastructure/browser-authority-certificate.js";
import type { BrowserExecutionBinding } from "../../../lib/browser/infrastructure/browser-authority-broker.js";
import {
  createRuntimeLogger, runtimeLogCauseEventId, withRuntimeLogCause,
} from "../../../lib/runtime-logs/index.js";
import { createBrowserActorFactory } from "../../../../scripts/acceptance/local-browser-terminal-fixture.js";
import { HASH_A, HASH_B } from "../../../../scripts/acceptance/agent-production-runtime-fixtures.js";

// A typed inner failure without its own cause (the rate-limit rejection shape) must stay readable through the wrapper.
const typedInner = withRuntimeLogCause(executionFailure("failed", "BROWSER_KNOWN_GPT_RATE_LIMIT"), "event:typed-inner");
assert.equal(runtimeLogCauseEventId(browserExecutionFailure(typedInner, "no", {
  effectScope: "target_local", childCapabilityId: "acknowledge_known_gpt_rate_limit", browserOutcome: "REJECTED",
})), "event:typed-inner", "rebuilding a typed Browser failure must retain the upstream runtime log cause");

const hash = (digit: string) => `sha256:${digit.repeat(64)}` as const;
const temporary = await mkdtemp(path.join(tmpdir(), "agent-gpt-cause-chain-"));
try {
  const logDirectory = path.join(temporary, "runtime-logs");
  const logger = createRuntimeLogger({
    producer: "agent-gpt-cause-chain-acceptance", owner: "production-runtime",
    component: "gpt-child", terminalEnabled: false, fileSink: { directoryPath: logDirectory },
  });
  const certificate: BrowserAuthorityCertificateV1 = {
    schemaVersion: "browser-authority-certificate-v1", authorityRef: "authority:cause-chain", authorityEpoch: 1,
    channelSessionHash: hash("1"), artifactSetHash: hash("1"), releaseSecurityPolicyHash: hash("1"),
    profileEnrollmentHash: hash("1"), connectionGeneration: 1, extensionId: "extension:cause-chain",
    extensionVersion: "1.0.0", protocolRevision: 1, capabilitySetHash: hash("1"), permissionPolicyHash: hash("1"),
    originPolicyHash: hash("1"), livenessPolicyHash: hash("1"), commandAdmissionBudgetHash: hash("1"),
    artifactStreamBudgetHash: hash("1"), authTranscriptHash: hash("1"), keyEpoch: 1, livenessLeaseEpoch: 1,
    issuedAt: "2026-09-18T00:00:00.000Z", issuedAtMonotonicNs: "1", issuerMac: hash("1"),
  };
  const binding: BrowserExecutionBinding = {
    kind: "production", jobId: "job:cause-chain", resultRevision: 0, productStepId: "cause-chain",
    callId: "cause-chain", attemptId: "attempt:cause-chain", deviceId: "device:1", leaseVersion: 1,
    localOrderId: "order:cause-chain", contractManifestHash: hash("2"), executionRef: "execution:cause-chain",
    jobRefHash: hash("3"), executionRefHash: hash("4"), writerLeaseEpoch: 1, writerFenceHash: HASH_A,
    candidateHash: hash("5"), commandTtlMs: 10_000,
  };
  const target: BrowserControlledTarget = {
    target: { targetRef: "target:cause-chain", authorityEpoch: 1, executionBindingHash: binding.executionRefHash },
    document: { documentRef: "document:cause-chain", targetRef: "target:cause-chain", navigationEpoch: 1 },
    claimOrigin: "https://chatgpt.com",
  };
  // The extension channel is the only fake: the real actor, WAL and lease manager terminalize the failure.
  const actor = createBrowserActorFactory(new BrowserMutationStore(path.join(temporary, "browser")), logger)(
    async () => { throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"); },
  );
  const manager = new BrowserTargetLeaseManager(
    certificate, binding, actor, { signCurrentCommandPermit: () => hash("6") },
    { assertCurrent: () => undefined, ref: () => "workspace:cause-chain" } as never,
    () => target, { resolveGrantPaths: () => { throw new Error("NOT_USED"); },
      issueApprovedArtifactGrants: async () => { throw new Error("NOT_USED"); } } as never,
  );
  const execution = new ProductionGptChildTools(
    temporary, HASH_A, createGptAbilityGroup(), {} as never,
    { acquireJobBoundTargetLease: async () => manager.acquire({ target, ownerId: "owner:cause-chain" }) } as never,
    logger, { assertProviderSubmitAllowed: () => undefined } as never,
  ).createExecution({
    jobId: "job:cause-chain", attemptId: "attempt:cause-chain", resultRevision: 0,
    productId: "public_knowledge_article_pipeline", ownerRef: "owner:1", subjectRef: "subject:1",
    authorizationRef: "authorization:1", deviceId: "device:1", leaseVersion: 1, executionFenceHash: HASH_A,
    capabilityManifestHash: HASH_B, expiresAtMonotonic: performance.now() + 30_000, commandTtlMs: 10_000,
    abortSignal: new AbortController().signal, parentSpanId: "parent", maxProviderTurns: 1,
  });
  await assert.rejects(execution.tools.execute({
    sessionKey: "session:cause-chain", productStepId: "cause-chain", callId: "attachment-control-open",
    child: "open_gpt_attachment_control", actionOrdinal: 1, input: {},
  }), /BROWSER_EXTENSION_CHANNEL_UNAVAILABLE/u);

  const events = (await Promise.all((await readdir(logDirectory, { recursive: true }))
    .filter((file) => file.endsWith(".jsonl"))
    .map((file) => readFile(path.join(logDirectory, file), "utf8"))))
    .flatMap((text) => text.split("\n").filter(Boolean).map((line) => JSON.parse(line) as Record<string, any>));
  const browserFailure = events.find((event) => event.operation === "browser.command" && event.failure);
  const childFailure = events.find((event) => event.operation === "gpt.child" && event.failure);
  assert.equal(browserFailure?.failure.impact, "BLOCKING", "the Browser command is the independent root");
  assert.deepEqual([childFailure?.failure.impact, childFailure?.failure.causedByEventId],
    ["CONSEQUENTIAL", browserFailure?.eventId],
    "the GPT child must cite the Browser root through the real lease-manager wrapper");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
