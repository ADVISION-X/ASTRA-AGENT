import { performance } from "node:perf_hooks";

import {
  AuthenticatedBrowserAuthority,
  type BrowserAuthoritySnapshot,
} from "./browser-authority-certificate.js";

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
  private pending: AuthenticatedBrowserAuthority | null = null;
  private lastHeartbeatMonotonicMs = 0;
  private changedAtMonotonicMs = performance.now();
  private absentReason = "not_authenticated";

  prepare(input: IssueInput): AuthenticatedBrowserAuthority {
    const now = performance.now();
    if (this.current || this.pending) {
      throw new Error("BROWSER_AUTHORITY_ALREADY_PENDING_OR_PRESENT");
    }
    if (
      !Number.isSafeInteger(input.connectionGeneration) ||
      input.connectionGeneration <= 0
    ) {
      throw new Error("BROWSER_AUTHORITY_GENERATION_INVALID");
    }
    if (
      !Number.isSafeInteger(input.nativePortEpoch) ||
      input.nativePortEpoch <= 0
    ) {
      throw new Error("BROWSER_AUTHORITY_PORT_EPOCH_INVALID");
    }
    const candidate = AuthenticatedBrowserAuthority.issueInternal({
      ...input,
      issuedAtMonotonicMs: now,
      hardExpiresAtMonotonicMs: now + BROWSER_AUTHORITY_MAX_AGE_MS,
    });
    this.pending = candidate;
    return candidate;
  }

  commit(
    candidate: AuthenticatedBrowserAuthority,
  ): AuthenticatedBrowserAuthority {
    if (this.current) throw new Error("BROWSER_AUTHORITY_ALREADY_PRESENT");
    if (
      !this.pending ||
      this.pending.certificate.certificateHash !==
        candidate.certificate.certificateHash
    ) {
      throw new Error("BROWSER_AUTHORITY_PENDING_CANDIDATE_MISMATCH");
    }
    const now = performance.now();
    this.current = candidate;
    this.pending = null;
    this.lastHeartbeatMonotonicMs = now;
    this.changedAtMonotonicMs = now;
    this.absentReason = "";
    return candidate;
  }

  requireCurrent(): AuthenticatedBrowserAuthority {
    this.revokeIfExpired("authority_liveness_expired");
    if (!this.current) throw new BrowserAuthorityAbsentError();
    return this.current;
  }

  heartbeat(
    input: Readonly<{
      authorityId: string;
      connectionGeneration: number;
      nativePortEpoch: number;
    }>,
  ): void {
    const authority = this.requireCurrent();
    const certificate = authority.certificate;
    if (
      certificate.authorityId !== input.authorityId ||
      certificate.connectionGeneration !== input.connectionGeneration ||
      certificate.nativePortEpoch !== input.nativePortEpoch
    ) {
      throw new BrowserAuthorityAbsentError(
        "stale heartbeat cannot renew the current browser authority",
      );
    }
    this.lastHeartbeatMonotonicMs = performance.now();
  }

  revoke(reason: string): void {
    const now = performance.now();
    this.current = null;
    this.pending = null;
    this.lastHeartbeatMonotonicMs = 0;
    this.changedAtMonotonicMs = now;
    this.absentReason = reason || "revoked";
  }

  isCurrent(
    input: Readonly<{
      authorityId: string;
      connectionGeneration: number;
      nativePortEpoch: number;
    }>,
  ): boolean {
    try {
      const certificate = this.requireCurrent().certificate;
      return (
        certificate.authorityId === input.authorityId &&
        certificate.connectionGeneration === input.connectionGeneration &&
        certificate.nativePortEpoch === input.nativePortEpoch
      );
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
    const heartbeatExpired =
      this.lastHeartbeatMonotonicMs > 0 &&
      now - this.lastHeartbeatMonotonicMs > BROWSER_AUTHORITY_HARD_EXPIRY_MS;
    const authorityAgeExpired = now >= certificate.hardExpiresAtMonotonicMs;
    if (heartbeatExpired || authorityAgeExpired) this.revoke(reason);
  }
}
