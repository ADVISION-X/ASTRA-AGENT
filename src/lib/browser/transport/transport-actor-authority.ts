import { createHash } from "node:crypto";

import type { AuthenticatedBrowserAuthority } from "../infrastructure/browser-authority-certificate.js";
import { issueReplyChannelToken } from "./reply-channel-token.js";
import type { BrowserTransportEvent } from "./transport-event.js";
import type {
  TransportActorRuntime,
  TransportHostCandidate,
} from "./transport-actor-runtime.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export type TransportAuthorityCommitPort = Readonly<{
  runtime: TransportActorRuntime;
  candidate(): TransportHostCandidate | null;
  terminate(reason: string): void;
  resetCommandSequence(): void;
  fence(
    candidate: TransportHostCandidate,
    nativePortEpoch: number,
  ): Extract<BrowserTransportEvent, { type: "AUTH_PROOF_COMMITTED" }>["fence"];
  applyEvent(event: BrowserTransportEvent): void;
  onAuthoritySlotChanged(): void;
}>;

export const commitTransportAuthority = (
  port: TransportAuthorityCommitPort,
  authority: AuthenticatedBrowserAuthority,
): void => {
  const candidate = port.candidate();
  if (!candidate?.context || !candidate.channel) {
    port.terminate("BROWSER_AUTHORITY_REVOKED:commit without channel");
    return;
  }
  port.resetCommandSequence();
  port.runtime.replyChannel = issueReplyChannelToken({
    connectionGeneration: candidate.generation,
    hostProcessEpoch: candidate.context.hostIdentity.hostProcessEpoch,
    nativePortEpoch: candidate.context.nativePortEpoch,
    sourceChannelIdentity: candidate.sourceChannelToken,
  });
  port.runtime.lastHeartbeatProbeAt = 0;
  port.applyEvent({
    type: "AUTH_PROOF_COMMITTED",
    fence: port.fence(candidate, candidate.context.nativePortEpoch),
    authorityRefHash: hash(authority.certificate.authorityRef),
    activationTupleHash: authority.certificate.activationTupleHash,
  });
  port.onAuthoritySlotChanged();
};
