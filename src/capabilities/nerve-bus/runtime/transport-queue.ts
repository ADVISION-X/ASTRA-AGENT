import type { NerveBusQueuePort } from "../ports/nerve-bus-queue-port.js";

export function createInMemoryNerveBusQueuePort(maxConcurrent = 16): NerveBusQueuePort {
  let current = 0;

  return {
    async tryAcquire() {
      if (current >= maxConcurrent) {
        return null;
      }

      current += 1;
      return {
        async release() {
          current = Math.max(0, current - 1);
        },
      };
    },
  };
}