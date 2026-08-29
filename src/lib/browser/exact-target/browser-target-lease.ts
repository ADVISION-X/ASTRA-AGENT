import type { BrowserDomIntent } from "./browser-dom-intent.js";
import type { BrowserDocumentRef, BrowserTargetRef } from "./browser-target-ref.js";
import type { BrowserFileArtifactGrantV1 } from "./browser-file-artifact-grant.js";
import type { BrowserCapabilityId } from "../protocol/generated/browser-protocol.generated.js";
import type { BrowserOutcomeResolutionReceipt } from "./browser-outcome-resolver.js";

export type BrowserAtomicStepIdentity = Readonly<{
  productStepId: string;
  callId: string;
  childCapabilityId: string;
  inputHash: `sha256:${string}`;
  actionOrdinal: number;
  replayPolicy: "observation-only" | "target-local-per-generation" | "provider-effect-once";
}>;

export type BrowserAtomicStepRecovery = Readonly<{
  state: "dispatched" | "confirmed" | "rejected";
  authorityRef: string;
  authorityHash: `sha256:${string}`;
  targetRef: string;
  documentRef: string;
}>;

export type BrowserTargetLease = Readonly<{
  leaseRef: string;
  authorityRef: string;
  authorityEpoch: number;
  executionBindingHash: `sha256:${string}`;
  ownerId: string;
  agentJobRefHash: `sha256:${string}`;
  agentExecutionRefHash: `sha256:${string}`;
  writerLeaseEpoch: number;
  writerFenceHash: `sha256:${string}`;
  target: BrowserTargetRef;
  document: BrowserDocumentRef;
  runAtomicStep<T>(
    identity: BrowserAtomicStepIdentity,
    action: () => Promise<T>,
  ): Promise<T>;
  readAtomicStepRecovery(identity: BrowserAtomicStepIdentity): BrowserAtomicStepRecovery | null;
  requiresMutationRecovery(): boolean;
  navigate(input: Readonly<{ url: string; title: string; deadlineMs?: number }>): Promise<BrowserDocumentRef>;
  executeDomIntent(input: BrowserDomIntent): Promise<unknown>;
  observeCapability(input: Readonly<{ capabilityId: BrowserCapabilityId; timeoutMs?: number }>): Promise<unknown>;
  captureScreenshot(input: Readonly<{ regionLabel: string }>): Promise<Readonly<{ artifactRef: string; contentHash: `sha256:${string}` }>>;
  attachFile(input: Readonly<{ selector: string; grants: readonly BrowserFileArtifactGrantV1[] }>): Promise<void>;
  downloadAuthenticatedMedia(input: Readonly<{
    assistantTurnId: string;
    semanticMediaId: "gpt-generated-image-main";
  }>): Promise<Readonly<{
    bytesBase64: string;
    sha256: `sha256:${string}`;
    sizeBytes: number;
    mediaType: `image/${string}`;
    width: number;
    height: number;
  }>>;
  registerFileArtifact(input: Readonly<{
    artifactRef: string;
    filePath: string;
    contentHash: `sha256:${string}`;
    sizeBytes: number;
  }>): Promise<void>;
  issueFileArtifactGrant(input: Readonly<{
    artifactRef: string;
    expectedSha256: `sha256:${string}`;
    maxBytes: number;
  }>): Promise<BrowserFileArtifactGrantV1>;
  wait(input: Readonly<{ durationMs: number }>): Promise<void>;
  park(input: Readonly<{
    reason: string;
    mode: "normal-provider-wait" | "recovery";
  }>): Promise<void>;
  close(input: Readonly<{ reason: string }>): Promise<void>;
  resolvePendingMutation(
    input: Omit<BrowserOutcomeResolutionReceipt, "commandId">,
  ): Promise<number>;
  pendingMutationCount(): number;
  assertNoPendingMutations(): void;
}>;
