export interface OrchestrationIdempotencyPort {
  reserve(key: string): Promise<boolean>;
}