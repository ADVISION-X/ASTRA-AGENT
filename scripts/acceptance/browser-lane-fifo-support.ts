import type { BrowserTargetLease } from "../../src/lib/browser/browser-authority-api.js";
import type { BrowserExecutionBinding } from
  "../../src/lib/browser/infrastructure/browser-authority-broker.js";

export const HASH = `sha256:${"a".repeat(64)}` as const;
export const CONFIRMED_EXACT_HASH = `sha256:${"c".repeat(64)}` as const;

export const binding = (
  jobId: string,
  productStepId = "fixture-step",
  callId = "fixture-call",
): BrowserExecutionBinding => ({
  kind: "production", ownerPluginId: "plugin", pluginVersion: 1, jobId,
  productStepId, callId, attemptId: `attempt:${jobId}`, deviceId: "device:1",
  leaseVersion: 1, localOrderId: jobId, contractManifestHash: HASH,
  executionRef: `execution:${jobId}`, jobRefHash: HASH, executionRefHash: HASH,
  writerLeaseEpoch: 1, writerFenceHash: HASH, candidateHash: HASH, commandTtlMs: 60_000,
});

export const fixtureLease = (
  entry: BrowserExecutionBinding,
  close: BrowserTargetLease["close"],
  identity?: Readonly<{ targetRef: string; documentRef: string }>,
): BrowserTargetLease => {
  const targetRef = identity?.targetRef
    ?? (entry.jobId === "job:historic" ? "target:historic" : `target:${entry.jobId}`);
  const documentRef = identity?.documentRef
    ?? (entry.jobId === "job:historic" ? "document:historic" : `document:${entry.jobId}`);
  const document = { documentRef, targetRef, navigationEpoch: 1 } as const;
  return {
    leaseRef: `lease:${entry.jobId}`, authorityRef: "authority:fixture", authorityEpoch: 1,
    executionBindingHash: HASH, ownerId: entry.ownerPluginId, agentJobRefHash: HASH,
    agentExecutionRefHash: HASH, writerLeaseEpoch: 1, writerFenceHash: HASH,
    target: { targetRef, authorityEpoch: 1, executionBindingHash: HASH }, document,
    async runAtomicStep(_identity, action) { return action(); },
    readAtomicStepRecovery: () => null, requiresMutationRecovery: () => false,
    async navigate() { return document; },
    async executeDomIntent() { return { observed: true }; },
    async observeCapability() { return { observed: true }; },
    async captureScreenshot() { return { artifactRef: "screenshot:fixture", contentHash: HASH }; },
    async attachFile() {},
    async downloadAuthenticatedMedia(input) { return {
      authorityTargetHash: HASH, authorityDocumentHash: HASH,
      assistantTurnId: input.assistantTurnId, semanticMediaId: input.semanticMediaId,
      bytesBase64: "AQ==", sha256: HASH, sizeBytes: 1, mediaType: "image/png", width: 1, height: 1,
    }; },
    async wait() {}, async park() {}, close,
    async resolvePendingMutation() { return 0; },
    pendingMutationCount: () => 0, assertNoPendingMutations() {},
  };
};
