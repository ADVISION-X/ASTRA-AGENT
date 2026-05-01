export interface MouseClickIdempotencyRegistry {
  cleanupExpired(nowMs: number): void;
  reserve(input: {
    sessionId: string;
    roundId: string | null;
    videoVisitId: string | null;
    geometryGuardRef: string | null;
    purpose: string;
    coordinate: { x: number; y: number };
    button: "left" | "right";
    clickCount: 1 | 2;
    nowMs: number;
    allowReplay: boolean;
    cooldownMs: number;
    ttlMs: number;
  }):
    | { ok: true; idempotencyKey: string; actionExecutionRef: string; idempotencyDecision: "reserved" }
    | {
        ok: false;
        idempotencyKey: string;
        status: "failed" | "review_required";
        failureReason: "duplicate_click_review_required" | "cooldown_blocked";
        reviewRequiredReason: string | null;
        statusMessage: string;
        policyDecision: "duplicate_review_required" | "block";
        rejectionRef: string;
        idempotencyDecision: "duplicate_review_required" | "cooldown_blocked";
        dataQualityFlags: string[];
      };
}