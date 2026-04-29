import type { ParsedVisualTargetAbilityInput, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import { calculateVisualTargetAgeMs } from "./visual-target-time.js";

export function validateScreenshotProof(input: {
  request: ParsedVisualTargetAbilityInput;
  nowIso: string;
  freshnessTtlMs: number;
}):
  | { ok: true; decision: "allow"; dataQualityFlags: VisualTargetDataQualityFlag[] }
  | {
      ok: false;
      status: "failed" | "review_required";
      decision: "block" | "review_required";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: string | null;
      dataQualityFlags: VisualTargetDataQualityFlag[];
    } {
  const screenshotProof = input.request.sourceProof.screenshot;
  if (!screenshotProof.screenshotProofRef) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "missing_screenshot_proof",
      statusMessage: "Visual Target requires screenshot proof before candidate arbitration.",
      reviewRequiredReason: null,
      dataQualityFlags: [],
    };
  }
  if (screenshotProof.sessionId !== input.request.sessionId) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "screenshot_binding_mismatch",
      statusMessage: "Screenshot proof sessionId must match Visual Target sessionId.",
      reviewRequiredReason: null,
      dataQualityFlags: [],
    };
  }
  if (input.request.roundId && screenshotProof.roundId && input.request.roundId !== screenshotProof.roundId) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "screenshot_binding_mismatch",
      statusMessage: "Screenshot proof roundId conflicts with Visual Target roundId.",
      reviewRequiredReason: null,
      dataQualityFlags: [],
    };
  }
  if (input.request.videoVisitId && screenshotProof.videoVisitId && input.request.videoVisitId !== screenshotProof.videoVisitId) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "screenshot_binding_mismatch",
      statusMessage: "Screenshot proof videoVisitId conflicts with Visual Target videoVisitId.",
      reviewRequiredReason: null,
      dataQualityFlags: [],
    };
  }

  const ageMs = calculateVisualTargetAgeMs({ nowIso: input.nowIso, observedIso: screenshotProof.capturedAt });
  if (ageMs > input.freshnessTtlMs) {
    return {
      ok: false,
      status: "review_required",
      decision: "review_required",
      failureReason: "stale_screenshot_proof",
      statusMessage: "Screenshot proof is stale for the requested visual target arbitration window.",
      reviewRequiredReason: "Visual Target requires a fresher screenshot proof before selecting a governed target.",
      dataQualityFlags: ["stale_screenshot"],
    };
  }

  return {
    ok: true,
    decision: "allow",
    dataQualityFlags: [],
  };
}