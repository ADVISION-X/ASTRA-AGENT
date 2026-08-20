import type { BrowserHash } from "../exact-target/browser-target-ref.js";
import type { BrowserCapabilityId } from "../protocol/generated/browser-protocol.generated.js";

export type BrowserMutationClass = "observation" | "mutation" | "lifecycle";

export type BrowserCommandPermit = Readonly<{
  permitRef: string;
  authorityRef: string;
  authorityEpoch: number;
  certificateHash: BrowserHash;
  activationTupleHash: BrowserHash;
  executionBindingHash: BrowserHash;
  targetLeaseRef: string;
  targetRef: string;
  documentRef: string;
  capabilityId: BrowserCapabilityId;
  commandId: string;
  sequence: number;
  mutationClass: BrowserMutationClass;
  deadlineAt: string;
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
  permit.activationTupleHash,
  permit.executionBindingHash,
  permit.targetLeaseRef,
  permit.targetRef,
  permit.documentRef,
  permit.capabilityId,
  permit.commandId,
  permit.sequence,
  permit.mutationClass,
  permit.deadlineAt,
  permit.replyChannelToken,
]);

export const assertValidCommandPermit = (permit: BrowserCommandPermit, now = Date.now()): void => {
  const hashes = [
    permit.certificateHash,
    permit.activationTupleHash,
    permit.executionBindingHash,
    permit.commandFrameMac,
  ];
  if (
    permit.authorityRef.length === 0
    || permit.targetLeaseRef.length === 0
    || permit.targetRef.length === 0
    || permit.documentRef.length === 0
    || permit.commandId.length === 0
    || permit.replyChannelToken.length === 0
    || permit.authorityEpoch < 1
    || permit.sequence < 1
    || Date.parse(permit.deadlineAt) <= now
    || hashes.some((value) => !/^sha256:[a-f0-9]{64}$/u.test(value))
  ) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
};
