import type { OrchestrationIdempotencyPort } from "../ports/orchestration-idempotency-port.js";

export function createInMemoryOrchestrationIdempotencyPort(): OrchestrationIdempotencyPort {
  const seen = new Set<string>();

  return {
    async reserve(key) {
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    },
  };
}