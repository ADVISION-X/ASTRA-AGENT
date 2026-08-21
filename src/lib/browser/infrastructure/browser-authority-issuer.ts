import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { BrowserHash } from "../exact-target/browser-target-ref.js";
import {
  assertAuthenticatedTransportHandshake,
  type BrowserTransportHandshake,
} from "../transport/transport-authenticator.js";
import { hashBrowserAuthorityCertificate, type BrowserAuthorityCertificateV1 } from "./browser-authority-certificate.js";
import type { BrowserAuthoritySlot } from "./browser-control-state.js";
import {
  browserCommandPermitMacPayload,
  type BrowserCommandPermit,
  type BrowserUnsignedCommandPermit,
} from "../transport/command-permit.js";

export type BrowserAuthenticationProof = Readonly<{
  handshake: BrowserTransportHandshake;
  authTranscriptHash: BrowserHash;
}>;

export class BrowserAuthorityIssuer {
  private slot: BrowserAuthoritySlot = { kind: "ABSENT", reasonCode: "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE" };
  private nextEpoch = 1;
  private readonly issuerKey = randomBytes(32);

  public current(): BrowserAuthoritySlot {
    return this.slot;
  }

  /** The reducer may call this only after the Workbench-page/MV3 handshake agrees. */
  public commitAuthenticationProof(proof: BrowserAuthenticationProof): BrowserAuthorityCertificateV1 {
    assertAuthenticatedTransportHandshake(proof.handshake);
    const authorityEpoch = this.nextEpoch;
    const issuedAt = new Date().toISOString();
    const certificateWithoutMac = {
      schemaVersion: "browser-authority-certificate-v1" as const,
      authorityRef: `authority-${authorityEpoch}`,
      authorityEpoch,
      channelSessionHash: proof.handshake.pageSessionHash,
      artifactSetHash: proof.handshake.artifactSetHash,
      releaseSecurityPolicyHash: proof.handshake.releaseSecurityPolicyHash,
      profileEnrollmentHash: proof.handshake.profileEnrollmentHash,
      connectionGeneration: proof.handshake.connectionGeneration,
      extensionId: proof.handshake.extensionId,
      extensionVersion: proof.handshake.extensionVersion,
      protocolRevision: proof.handshake.protocolRevision,
      capabilitySetHash: proof.handshake.capabilitySetHash,
      permissionPolicyHash: proof.handshake.permissionPolicyHash,
      originPolicyHash: proof.handshake.originPolicyHash,
      livenessPolicyHash: proof.handshake.livenessPolicyHash,
      commandAdmissionBudgetHash: proof.handshake.commandAdmissionBudgetHash,
      artifactStreamBudgetHash: proof.handshake.artifactStreamBudgetHash,
      authTranscriptHash: proof.authTranscriptHash,
      keyEpoch: authorityEpoch,
      livenessLeaseEpoch: authorityEpoch,
      issuedAt,
      issuedAtMonotonicNs: process.hrtime.bigint().toString(),
      expiresAt: proof.handshake.expiresAt,
    };
    const issuerMac = `sha256:${createHmac("sha256", this.issuerKey).update(JSON.stringify(certificateWithoutMac)).digest("hex")}` as BrowserHash;
    const certificate: BrowserAuthorityCertificateV1 = { ...certificateWithoutMac, issuerMac };
    this.nextEpoch += 1;
    this.slot = { kind: "PRESENT", authority: certificate };
    return certificate;
  }

  public revokeCurrent(reasonCode: string): void {
    this.slot = { kind: "ABSENT", reasonCode };
  }

  /**
   * This is the only signer. The MAC covers every permit field, and the same
   * per-authority key is provided only after the page/MV3 handshake so
   * the extension can reject a modified frame before executing it.
   */
  public signCurrentCommandPermit(permit: BrowserUnsignedCommandPermit): BrowserHash {
    this.assertPermitBoundToCurrentAuthority(permit);
    return `sha256:${createHmac("sha256", this.issuerKey)
      .update(browserCommandPermitMacPayload(permit))
      .digest("hex")}` as BrowserHash;
  }

  public commandPermitKeyBase64(): string {
    return this.issuerKey.toString("base64");
  }

  /**
   * Command MAC verification remains inside the Controller authority owner.
   * The MV3 receives commands solely through the authenticated page channel and
   * additionally compares the certificate context supplied at ready time.
   */
  public assertCurrentCommandPermit(permit: BrowserCommandPermit): void {
    const { commandFrameMac, ...unsigned } = permit;
    const expected = this.signCurrentCommandPermit(unsigned);
    const candidate = Buffer.from(commandFrameMac);
    const expectedBuffer = Buffer.from(expected);
    if (
      candidate.byteLength !== expectedBuffer.byteLength
      || !timingSafeEqual(candidate, expectedBuffer)
    ) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
  }

  private assertPermitBoundToCurrentAuthority(permit: BrowserUnsignedCommandPermit): BrowserAuthorityCertificateV1 {
    const current = this.slot;
    if (current.kind === "ABSENT") throw new Error(current.reasonCode);
    const authority = current.authority;
    if (
      permit.authorityRef !== authority.authorityRef
      || permit.authorityEpoch !== authority.authorityEpoch
      || permit.certificateHash !== hashBrowserAuthorityCertificate(authority)
      || permit.channelSessionHash !== authority.channelSessionHash
    ) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
    return authority;
  }
}
