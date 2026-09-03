import type { BrowserDomIntent } from "./browser-dom-intent.js";
import type { BrowserDocumentRef, BrowserTargetRef } from "./browser-target-ref.js";
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
  mutationOutcome: "no" | "dispatched" | "confirmed";
  terminalAt: string | null;
  authorityRef: string;
  authorityHash: `sha256:${string}`;
  targetRef: string;
  documentRef: string;
}>;

export type BrowserApprovedArtifactRef = Readonly<{
  artifactRef: string;
  expectedSha256: `sha256:${string}`;
  bytes: number;
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
  attachFile(input: Readonly<{
    selector: string;
    approvedArtifacts: readonly BrowserApprovedArtifactRef[];
  }>): Promise<void>;
  downloadAuthenticatedMedia(input: Readonly<{
    assistantTurnId: string;
    semanticMediaId: "gpt-generated-image-main";
  }>): Promise<Readonly<{
    authorityTargetHash: `sha256:${string}`;
    authorityDocumentHash: `sha256:${string}`;
    assistantTurnId: string;
    semanticMediaId: "gpt-generated-image-main";
    bytesBase64: string;
    sha256: `sha256:${string}`;
    sizeBytes: number;
    mediaType: `image/${string}`;
    width: number;
    height: number;
  }>>;
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
