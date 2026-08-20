import { createHash } from "node:crypto";

export const BROWSER_HEARTBEAT_INTERVAL_MS = 1_000;
export const BROWSER_LIVENESS_SOFT_DRAIN_MS = 3_500;
export const BROWSER_LIVENESS_HARD_EXPIRY_MS = 5_000;
export const BROWSER_WATCHDOG_TICK_MAX_MS = 250;
export const BROWSER_MAX_AUTHORITY_AGE_MS = 8 * 60 * 60 * 1_000;

export type BrowserAuthorityLivenessLeaseV1 = Readonly<{
  schemaVersion: "browser-authority-liveness-lease.v1";
  authorityRef: string;
  authorityEpoch: number;
  leaseEpoch: number;
  controllerDeadlineMonotonicMs: number;
  extensionDeadlineMonotonicMs: number;
  lastAuthenticatedHeartbeatSequence: number;
  leaseHash: `sha256:${string}`;
}>;

const hashLease = (
  value: Omit<BrowserAuthorityLivenessLeaseV1, "leaseHash">,
): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

export const issueBrowserAuthorityLivenessLease = (input: {
  authorityRef: string;
  authorityEpoch: number;
  leaseEpoch: number;
  heartbeatSequence: number;
  nowMonotonicMs: number;
}): BrowserAuthorityLivenessLeaseV1 => {
  const unsigned = Object.freeze({
    schemaVersion: "browser-authority-liveness-lease.v1" as const,
    authorityRef: input.authorityRef,
    authorityEpoch: input.authorityEpoch,
    leaseEpoch: input.leaseEpoch,
    controllerDeadlineMonotonicMs: input.nowMonotonicMs + BROWSER_LIVENESS_HARD_EXPIRY_MS,
    extensionDeadlineMonotonicMs: input.nowMonotonicMs + BROWSER_LIVENESS_HARD_EXPIRY_MS,
    lastAuthenticatedHeartbeatSequence: input.heartbeatSequence,
  });
  return Object.freeze({ ...unsigned, leaseHash: hashLease(unsigned) });
};

export const isBrowserAuthorityLivenessLeaseExpired = (
  lease: BrowserAuthorityLivenessLeaseV1,
  nowMonotonicMs: number,
): boolean => nowMonotonicMs >= Math.min(
  lease.controllerDeadlineMonotonicMs,
  lease.extensionDeadlineMonotonicMs,
);
