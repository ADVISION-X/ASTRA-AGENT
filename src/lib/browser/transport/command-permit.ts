import { createHash } from "node:crypto";

import type { AuthenticatedBrowserAuthority } from "../authority/browser-authority-certificate.js";

export type BrowserCommandPermit = Readonly<{
  authorityId: string;
  authorityCertificateHash: string;
  connectionGeneration: number;
  nativePortEpoch: number;
  commandId: string;
  sequence: number;
  deadlineAt: number;
  permitHash: string;
}>;

export const issueBrowserCommandPermit = (input: Readonly<{
  authority: AuthenticatedBrowserAuthority;
  commandId: string;
  sequence: number;
  deadlineAt: number;
}>): BrowserCommandPermit => {
  const certificate = input.authority.certificate;
  if (!input.commandId) throw new Error("BROWSER_COMMAND_ID_REQUIRED");
  if (!Number.isSafeInteger(input.sequence) || input.sequence <= 0) {
    throw new Error("BROWSER_COMMAND_SEQUENCE_INVALID");
  }
  if (!Number.isFinite(input.deadlineAt) || input.deadlineAt <= Date.now()) {
    throw new Error("BROWSER_COMMAND_DEADLINE_INVALID");
  }
  const unsigned = {
    authorityId: certificate.authorityId,
    authorityCertificateHash: certificate.certificateHash,
    connectionGeneration: certificate.connectionGeneration,
    nativePortEpoch: certificate.nativePortEpoch,
    commandId: input.commandId,
    sequence: input.sequence,
    deadlineAt: input.deadlineAt,
  } as const;
  return Object.freeze({
    ...unsigned,
    permitHash: `sha256:${createHash("sha256").update(JSON.stringify(unsigned)).digest("hex")}`,
  });
};

export const sameBrowserCommandPermit = (
  left: BrowserCommandPermit,
  right: BrowserCommandPermit,
): boolean => left.permitHash === right.permitHash
  && left.authorityId === right.authorityId
  && left.commandId === right.commandId
  && left.sequence === right.sequence;
