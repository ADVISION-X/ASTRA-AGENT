export interface NerveBusQueueLease {
  release(): Promise<void>;
}

export interface NerveBusQueuePort {
  tryAcquire(): Promise<NerveBusQueueLease | null>;
}

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
