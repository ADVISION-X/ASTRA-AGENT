export type MouseScrollIdempotencyReserveInput = {
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  geometryGuardRef: string | null;
  purpose: string;
  direction: "up" | "down" | "left" | "right";
  magnitude: "small" | "halfPage" | "onePage" | "twoPages" | "customDelta";
  delta: { deltaX: number; deltaY: number };
  repeat: number;
  nowMs: number;
  allowReplay: boolean;
  cooldownMs: number;
  ttlMs: number;
};

export type MouseScrollIdempotencyReserveFailure = {
  ok: false;
  idempotencyKey: string;
  scrollExecutionRef: string;
  status: "failed" | "review_required";
  failureReason: "duplicate_scroll_review_required" | "cooldown_blocked";
  reviewRequiredReason: string | null;
  statusMessage: string;
  policyDecision: "duplicate_review_required" | "block";
  rejectionRef: string;
  idempotencyDecision: "duplicate_review_required" | "cooldown_blocked";
  dataQualityFlags: string[];
};

export type MouseScrollIdempotencyReserveResult =
  | {
      ok: true;
      idempotencyKey: string;
      scrollExecutionRef: string;
      idempotencyDecision: "reserved";
    }
  | MouseScrollIdempotencyReserveFailure;

export interface MouseScrollIdempotencyRegistry {
  cleanupExpired(nowMs: number): void;
  reserve(input: MouseScrollIdempotencyReserveInput): MouseScrollIdempotencyReserveResult;
}