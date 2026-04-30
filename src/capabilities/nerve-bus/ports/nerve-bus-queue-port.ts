export interface NerveBusQueueLease {
  release(): Promise<void>;
}

export interface NerveBusQueuePort {
  tryAcquire(): Promise<NerveBusQueueLease | null>;
}
