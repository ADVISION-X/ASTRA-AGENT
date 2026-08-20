import { createHash } from "node:crypto";

import type { AuthenticatedBrowserAuthority } from "../infrastructure/browser-authority-certificate.js";
import type { BrowserExecutionBinding } from "../browser-authority-api.js";
import type {
  BrowserCapabilityId,
  BrowserCommandPermit,
  BrowserWireMutationClass,
} from "../protocol/generated/browser-protocol.js";
import type { ReplyChannelToken } from "./reply-channel-token.js";

const hash = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

export const hashBrowserExecutionBinding = (
  binding: BrowserExecutionBinding,
): `sha256:${string}` => hash(binding);

export const issueBrowserCommandPermit = (input: {
  authority: AuthenticatedBrowserAuthority;
  activationTupleHash: `sha256:${string}`;
  replyChannel: ReplyChannelToken;
  capabilityId: BrowserCapabilityId;
  executionBinding: BrowserExecutionBinding;
  targetLeaseRef: string;
  documentRef: string;
  commandId: string;
  sequence: number;
  deadlineMonotonicMs: number;
  mutationClass: BrowserWireMutationClass;
}): BrowserCommandPermit => {
  const certificate = input.authority.certificate;
  const unsigned = Object.freeze({
    authorityRef: certificate.authorityRef,
    authorityEpoch: certificate.authorityEpoch,
    authorityCertificateHash: certificate.certificateHash,
    activationTupleHash: input.activationTupleHash,
    replyChannelToken: input.replyChannel.value,
    capabilityId: input.capabilityId,
    executionBindingHash: hashBrowserExecutionBinding(input.executionBinding),
    writerFenceHash: input.executionBinding.writerFenceHash,
    targetLeaseRef: input.targetLeaseRef,
    documentRef: input.documentRef,
    commandId: input.commandId,
    sequence: input.sequence,
    deadlineMonotonicMs: input.deadlineMonotonicMs,
    mutationClass: input.mutationClass,
  });
  return Object.freeze({ ...unsigned, permitHash: hash(unsigned) });
};
