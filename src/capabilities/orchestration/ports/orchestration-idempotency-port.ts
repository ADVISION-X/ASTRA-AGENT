export type OrchestrationIdempotencyReservation = {
  reserved: boolean;
  expiresAt: string | null;
};

export interface OrchestrationIdempotencyPort {
  reserve(key: string, ttlMs: number): Promise<OrchestrationIdempotencyReservation>;
  release(key: string): Promise<void>;
  commit(key: string): Promise<void>;
  cleanupExpired(nowMs: number): Promise<number>;
}
