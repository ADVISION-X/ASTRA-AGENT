import type { BrowserHash } from "../exact-target/browser-target-ref.js";
import type { BrowserCapabilityId } from "../protocol/generated/browser-protocol.generated.js";

export type BrowserMutationClass = "observation" | "mutation" | "lifecycle";

export type BrowserCommandPermit = Readonly<{
  permitRef: string;
  authorityRef: string;
  authorityEpoch: number;
  certificateHash: BrowserHash;
  channelSessionHash: BrowserHash;
  executionBindingHash: BrowserHash;
  writerFenceHash: BrowserHash;
  candidateHash: BrowserHash;
  contractManifestHash: BrowserHash;
  ownerPluginId: string;
  jobId: string;
  attemptId: string;
  deviceId: string;
  leaseVersion: number;
  localOrderId: string;
  targetLeaseRef: string;
  targetRef: string;
  documentRef: string;
  capabilityId: BrowserCapabilityId;
  commandId: string;
  sequence: number;
  mutationClass: BrowserMutationClass;
  workspaceRef: string;
  commandTtlMs: number;
  replyChannelToken: string;
  commandFrameMac: BrowserHash;
}>;

export type BrowserUnsignedCommandPermit = Omit<BrowserCommandPermit, "commandFrameMac">;

/** A stable, complete payload: a permit MAC never covers only its identity. */
export const browserCommandPermitMacPayload = (permit: BrowserUnsignedCommandPermit): string => JSON.stringify([
  permit.permitRef,
  permit.authorityRef,
  permit.authorityEpoch,
  permit.certificateHash,
  permit.channelSessionHash,
  permit.executionBindingHash,
  permit.writerFenceHash,
  permit.candidateHash,
  permit.contractManifestHash,
  permit.ownerPluginId,
  permit.jobId,
  permit.attemptId,
  permit.deviceId,
  permit.leaseVersion,
  permit.localOrderId,
  permit.targetLeaseRef,
  permit.targetRef,
  permit.documentRef,
  permit.capabilityId,
  permit.commandId,
  permit.sequence,
  permit.mutationClass,
  permit.workspaceRef,
  permit.commandTtlMs,
  permit.replyChannelToken,
]);

const hasCompletePermitIdentity = (permit: BrowserCommandPermit): boolean => [
  permit.authorityRef,
  permit.targetLeaseRef,
  permit.targetRef,
  permit.documentRef,
  permit.commandId,
  permit.replyChannelToken,
  permit.workspaceRef,
  permit.ownerPluginId,
  permit.jobId,
  permit.attemptId,
  permit.deviceId,
  permit.localOrderId,
].every((value) => value.length > 0);

const hasValidPermitNumbers = (permit: BrowserCommandPermit): boolean =>
  Number.isInteger(permit.leaseVersion)
  && permit.leaseVersion >= 1
  && permit.authorityEpoch >= 1
  && permit.sequence >= 1
  && Number.isInteger(permit.commandTtlMs)
  && permit.commandTtlMs >= 1
  && permit.commandTtlMs <= 3_600_000;

const hasValidPermitHashes = (permit: BrowserCommandPermit): boolean => {
  const hashes = [
    permit.certificateHash,
    permit.channelSessionHash,
    permit.executionBindingHash,
    permit.writerFenceHash,
    permit.candidateHash,
    permit.contractManifestHash,
    permit.commandFrameMac,
  ];
  return hashes.every((value) => /^sha256:[a-f0-9]{64}$/u.test(value));
};

export const assertValidCommandPermit = (permit: BrowserCommandPermit): void => {
  if (!hasCompletePermitIdentity(permit) || !hasValidPermitNumbers(permit) || !hasValidPermitHashes(permit)) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
};
