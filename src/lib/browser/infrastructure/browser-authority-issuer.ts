import { performance } from "node:perf_hooks";

import {
  AuthenticatedBrowserAuthority,
  type BrowserAuthorityCertificateV1,
} from "./browser-authority-certificate.js";
import {
  BROWSER_MAX_AUTHORITY_AGE_MS,
  issueBrowserAuthorityLivenessLease,
  isBrowserAuthorityLivenessLeaseExpired,
  type BrowserAuthorityLivenessLeaseV1,
} from "./browser-authority-liveness-lease.js";
import type { BrowserAuthoritySlot } from "./browser-control-state.js";

export class BrowserAuthorityAbsentError extends Error {
  readonly code = "BROWSER_AUTHORITY_ABSENT" as const;
  constructor(message = "authenticated browser authority is absent") {
    super(message);
    this.name = "BrowserAuthorityAbsentError";
  }
}

export type BrowserAuthorityIssueInput = Omit<
  BrowserAuthorityCertificateV1,
  | "schemaVersion"
  | "authorityRef"
  | "certificateHash"
  | "issuedAtMonotonicMs"
  | "maxAgeDeadlineMonotonicMs"
  | "livenessLeaseEpoch"
>;

export class BrowserAuthorityIssuer {
  private current: AuthenticatedBrowserAuthority | null = null;
  private pending: AuthenticatedBrowserAuthority | null = null;
  private liveness: BrowserAuthorityLivenessLeaseV1 | null = null;
  private changedAtMonotonicMs = performance.now();
  private absentReason = "not_authenticated";
  private authorityEpoch = 0;
  private livenessLeaseEpoch = 0;
  private lastHeartbeatSequence = 0;

  prepare(input: BrowserAuthorityIssueInput): AuthenticatedBrowserAuthority {
    if (this.current || this.pending) {
      throw new Error("BROWSER_AUTHORITY_ALREADY_PENDING_OR_PRESENT");
    }
    const now = performance.now();
    const authorityEpoch = Math.max(
      this.authorityEpoch + 1,
      input.authorityEpoch,
    );
    const candidate = AuthenticatedBrowserAuthority.issueInternal({
      ...input,
      authorityEpoch,
      livenessLeaseEpoch: this.livenessLeaseEpoch + 1,
      issuedAtMonotonicMs: now,
      maxAgeDeadlineMonotonicMs: now + BROWSER_MAX_AUTHORITY_AGE_MS,
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
    this.authorityEpoch = candidate.certificate.authorityEpoch;
    this.livenessLeaseEpoch = candidate.certificate.livenessLeaseEpoch;
    this.lastHeartbeatSequence = 0;
    this.liveness = issueBrowserAuthorityLivenessLease({
      authorityRef: candidate.certificate.authorityRef,
      authorityEpoch: candidate.certificate.authorityEpoch,
      leaseEpoch: this.livenessLeaseEpoch,
      heartbeatSequence: 0,
      nowMonotonicMs: now,
    });
    this.changedAtMonotonicMs = now;
    this.absentReason = "";
    return candidate;
  }

  requireCurrent(): AuthenticatedBrowserAuthority {
    this.revokeIfExpired("BROWSER_AUTHORITY_LIVENESS_EXPIRED");
    if (!this.current) throw new BrowserAuthorityAbsentError();
    return this.current;
  }

  currentLivenessLease(): BrowserAuthorityLivenessLeaseV1 {
    this.requireCurrent();
    if (!this.liveness) throw new BrowserAuthorityAbsentError();
    return this.liveness;
  }

  heartbeat(input: {
    authorityRef: string;
    authorityEpoch: number;
    leaseEpoch: number;
    heartbeatSequence: number;
  }): BrowserAuthorityLivenessLeaseV1 {
    const authority = this.requireCurrent();
    const currentLease = this.currentLivenessLease();
    if (
      authority.certificate.authorityRef !== input.authorityRef ||
      authority.certificate.authorityEpoch !== input.authorityEpoch ||
      currentLease.leaseEpoch !== input.leaseEpoch ||
      input.heartbeatSequence !== this.lastHeartbeatSequence + 1
    ) {
      throw new BrowserAuthorityAbsentError(
        "stale heartbeat cannot renew browser authority",
      );
    }
    this.lastHeartbeatSequence = input.heartbeatSequence;
    this.liveness = issueBrowserAuthorityLivenessLease({
      authorityRef: input.authorityRef,
      authorityEpoch: input.authorityEpoch,
      leaseEpoch: input.leaseEpoch,
      heartbeatSequence: input.heartbeatSequence,
      nowMonotonicMs: performance.now(),
    });
    return this.liveness;
  }

  revoke(reason: string): void {
    const now = performance.now();
    this.current = null;
    this.pending = null;
    this.liveness = null;
    this.lastHeartbeatSequence = 0;
    this.changedAtMonotonicMs = now;
    this.absentReason = reason || "BROWSER_AUTHORITY_REVOKED";
  }

  isCurrent(input: { authorityRef: string; authorityEpoch: number }): boolean {
    try {
      const current = this.requireCurrent().certificate;
      return (
        current.authorityRef === input.authorityRef &&
        current.authorityEpoch === input.authorityEpoch
      );
    } catch {
      return false;
    }
  }

  slot(): BrowserAuthoritySlot<AuthenticatedBrowserAuthority> {
    this.revokeIfExpired("BROWSER_AUTHORITY_LIVENESS_EXPIRED");
    return this.current
      ? Object.freeze({
          kind: "PRESENT" as const,
          authority: this.current,
          changedAtMonotonicMs: this.changedAtMonotonicMs,
        })
      : Object.freeze({
          kind: "ABSENT" as const,
          reasonCode: this.absentReason || "BROWSER_AUTHORITY_ABSENT",
          changedAtMonotonicMs: this.changedAtMonotonicMs,
        });
  }

  private revokeIfExpired(reason: string): void {
    if (!this.current || !this.liveness) return;
    const now = performance.now();
    if (
      now >= this.current.certificate.maxAgeDeadlineMonotonicMs ||
      isBrowserAuthorityLivenessLeaseExpired(this.liveness, now)
    ) {
      this.revoke(reason);
    }
  }
}
