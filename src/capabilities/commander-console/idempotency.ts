/**
 * Commander Console Idempotency
 *
 * In-memory idempotency gate with 10-minute TTL.
 * Prevents duplicate command submissions within a single session.
 */

const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
const store = new Map<string, number>();

const pruneExpired = (now: number): void => {
  for (const [key, reservedAt] of store.entries()) {
    if (now - reservedAt > IDEMPOTENCY_TTL_MS) {
      store.delete(key);
    }
  }
};

/**
 * Returns true if the key is new and has been reserved.
 * Returns false if the key is already reserved (duplicate submission).
 */
export const checkAndReserveCommanderIdempotency = (key: string): boolean => {
  const now = Date.now();
  pruneExpired(now);
  if (store.has(key)) {
    return false;
  }
  store.set(key, now);
  return true;
};

export const releaseCommanderIdempotency = (key: string): void => {
  store.delete(key);
};
