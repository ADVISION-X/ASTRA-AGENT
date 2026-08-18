import { performance } from "node:perf_hooks";

import {
  AuthenticatedBrowserAuthority,
  type BrowserAuthoritySnapshot,
} from "./browser-authority-certificate.js";

export const BROWSER_AUTHORITY_HEARTBEAT_INTERVAL_MS = 1_000;
export const BROWSER_AUTHORITY_SOFT_DRAIN_MS = 3_500;
export const BROWSER_AUTHORITY_HARD_EXPIRY_MS = 5_000;
export const BROWSER_AUTHORITY_MAX_AGE_MS = 8 * 60 * 60 * 1_000;

export class BrowserAuthorityAbsentError extends Error {
  readonly code = "BROWSER_AUTHORITY_ABSENT" as const;
  constructor(message = "authenticated browser authority is absent") {
    super(message);
    this.name = "BrowserAuthorityAbsentError";
  }
}

type IssueInput = Readonly<{
  controllerSessionId: string;
  connectionGeneration: number;
  nativePortEpoch: number;
  extensionInstanceId: string;
  releaseIdentity: string;
  profileEnrollmentId: string;
  protocolVersion: string;
}>;

export class BrowserAuthorityIssuer {
  private current: AuthenticatedBrowserAuthority | null = null;
  private lastHeartbeatMonotonicMs = 0;
  private changedAtMonotonicMs = performance.now();
  private absentReason = "not_authenticated";

  issue(input: IssueInput): AuthenticatedBrowserAuthority {
    const now = performance.now();
    if (this.current) {
      throw new Error("BROWSER_AUTHORITY_ALREADY_PRESENT: revoke the current authority before issuing another");
    }
    if (!Number.isSafeInteger(input.connectionGeneration) || input.connectionGeneration <= 0) {
      throw new Error("BROWSER_AUTHORITY_GENERATION_INVALID");
    }
    if (!Number.isSafeInteger(input.nativePortEpoch) || input.nativePortEpoch <= 0) {
      throw new Error("BROWSER_AUTHORITY_PORT_EPOCH_INVALID");
    }
    const hardExpiresAtMonotonicMs = Math.min(
      now + BROWSER_AUTHORITY_HARD_EXPIRY_MS,
      now + BROWSER_AUTHORITY_MAX_AGE_MS,
    );
    const authority = AuthenticatedBrowserAuthority.issueInternal({
      ...input,
      issuedAtMonotonicMs: now,
      hardExpiresAtMonotonicMs,
    });
    this.current = authority;
    this.lastHeartbeatMonotonicMs = now;
    this.changedAtMonotonicMs = now;
    this.absentReason = "";
    return authority;
  }

  requireCurrent(): AuthenticatedBrowserAuthority {
    this.revokeIfExpired("authority_liveness_expired");
    if (!this.current) throw new BrowserAuthorityAbsentError();
    return this.current;
  }

  heartbeat(input: Readonly<{
    authorityId: string;
    connectionGeneration: number;
    nativePortEpoch: number;
  }>): void {
    const authority = this.requireCurrent();
    const certificate = authority.certificate;
    if (
      certificate.authorityId !== input.authorityId
      || certificate.connectionGeneration !== input.connectionGeneration
      || certificate.nativePortEpoch !== input.nativePortEpoch
    ) {
      throw new BrowserAuthorityAbsentError("stale heartbeat cannot renew the current browser authority");
    }
    const now = performance.now();
    this.lastHeartbeatMonotonicMs = now;
    const maxAgeBoundary = certificate.issuedAtMonotonicMs + BROWSER_AUTHORITY_MAX_AGE_MS;
    const nextHardExpiry = Math.min(now + BROWSER_AUTHORITY_HARD_EXPIRY_MS, maxAgeBoundary);
    this.current = AuthenticatedBrowserAuthority.issueInternal({
      controllerSessionId: certificate.controllerSessionId,
      connectionGeneration: certificate.connectionGeneration,
      nativePortEpoch: certificate.nativePortEpoch,
      extensionInstanceId: certificate.extensionInstanceId,
      releaseIdentity: certificate.releaseIdentity,
      profileEnrollmentId: certificate.profileEnrollmentId,
      protocolVersion: certificate.protocolVersion,
      issuedAtMonotonicMs: certificate.issuedAtMonotonicMs,
      hardExpiresAtMonotonicMs: nextHardExpiry,
    });
  }

  revoke(reason: string): void {
    const now = performance.now();
    this.current = null;
    this.lastHeartbeatMonotonicMs = 0;
    this.changedAtMonotonicMs = now;
    this.absentReason = reason || "revoked";
  }

  isCurrent(input: Readonly<{
    authorityId: string;
    connectionGeneration: number;
    nativePortEpoch: number;
  }>): boolean {
    try {
      const certificate = this.requireCurrent().certificate;
      return certificate.authorityId === input.authorityId
        && certificate.connectionGeneration === input.connectionGeneration
        && certificate.nativePortEpoch === input.nativePortEpoch;
    } catch {
      return false;
    }
  }

  snapshot(): BrowserAuthoritySnapshot {
    this.revokeIfExpired("authority_liveness_expired");
    const authority = this.current;
    if (!authority) {
      return Object.freeze({
        state: "AUTHORITY_ABSENT" as const,
        reason: this.absentReason || "authority_absent",
        changedAtMonotonicMs: this.changedAtMonotonicMs,
      });
    }
    const certificate = authority.certificate;
    return Object.freeze({
      state: "AUTHENTICATED_AUTHORITY_PRESENT" as const,
      authorityId: certificate.authorityId,
      certificateHash: certificate.certificateHash,
      connectionGeneration: certificate.connectionGeneration,
      nativePortEpoch: certificate.nativePortEpoch,
      releaseIdentity: certificate.releaseIdentity,
      profileEnrollmentId: certificate.profileEnrollmentId,
      hardExpiresAtMonotonicMs: certificate.hardExpiresAtMonotonicMs,
      changedAtMonotonicMs: this.changedAtMonotonicMs,
    });
  }

  private revokeIfExpired(reason: string): void {
    if (!this.current) return;
    const now = performance.now();
    const certificate = this.current.certificate;
    const heartbeatExpired = this.lastHeartbeatMonotonicMs > 0
      && now - this.lastHeartbeatMonotonicMs > BROWSER_AUTHORITY_HARD_EXPIRY_MS;
    const authorityExpired = now >= certificate.hardExpiresAtMonotonicMs
      || now - certificate.issuedAtMonotonicMs >= BROWSER_AUTHORITY_MAX_AGE_MS;
    if (heartbeatExpired || authorityExpired) this.revoke(reason);
  }
}
