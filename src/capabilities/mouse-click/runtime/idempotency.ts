/**
 * Mouse Click idempotency — in-memory, scoped to idempotencyKey.
 *
 * Scope includes missionId + runId + sessionId + roundId + videoVisitId +
 * childCapabilityId + geometryGuardRef + coordinate, which is encoded by
 * the upstream caller into the idempotencyKey before dispatch.
 *
 * Left-click-once and double-left-click on the same coordinate are DIFFERENT
 * actions and will have different idempotencyKeys.
 */

const TTL_MS = 10 * 60 * 1000; // 10 minutes

const seen = new Map<string, number>();

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, ts] of seen) {
    if (now - ts > TTL_MS) {
      seen.delete(key);
    }
  }
}

/** Returns true if key is new (not a replay). Reserves key on success. */
export function checkAndReserveMouseClickIdempotency(key: string): boolean {
  pruneExpired();
  if (seen.has(key)) {
    return false;
  }
  seen.set(key, Date.now());
  return true;
}

/** Release a key (call on primitive failure so retry is possible). */
export function releaseMouseClickIdempotency(key: string): void {
  seen.delete(key);
}
