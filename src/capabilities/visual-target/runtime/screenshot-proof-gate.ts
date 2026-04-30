import type { ParsedVisualTargetAbilityInput, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import { parseVisualTargetIsoTimestamp } from "./visual-target-clock.js";

export function validateScreenshotProof(input: {
  request: ParsedVisualTargetAbilityInput;
  nowEpochMs: number;
  freshnessTtlMs: number;
}):
  | { ok: true; decision: "allow"; screenshotHash: string; dataQualityFlags: VisualTargetDataQualityFlag[] }
  | {
      ok: false;
      status: "failed" | "review_required";
      decision: "block" | "review_required";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: string | null;
      screenshotHash: string | null;
      dataQualityFlags: VisualTargetDataQualityFlag[];
    } {
  const screenshotProof = input.request.sourceProof.screenshot;
  if (!screenshotProof.screenshotProofRef || !screenshotProof.artifactRef) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "missing_screenshot_proof",
      statusMessage: "Visual Target requires screenshot proof before candidate arbitration.",
      reviewRequiredReason: null,
      screenshotHash: null,
      dataQualityFlags: [],
    };
  }
  if (!screenshotProof.artifactHash || !screenshotProof.imageHash) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "screenshot_hash_missing",
      statusMessage: "Visual Target screenshot proof must bind artifactHash and imageHash.",
      reviewRequiredReason: null,
      screenshotHash: null,
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
      screenshotHash: screenshotProof.imageHash,
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
      screenshotHash: screenshotProof.imageHash,
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
      screenshotHash: screenshotProof.imageHash,
      dataQualityFlags: [],
    };
  }

  if (screenshotProof.coordinateSpace === "ai_input") {
    if (!screenshotProof.scaleMapping || !screenshotProof.sourceScreenshotEvidenceId) {
      return {
        ok: false,
        status: "review_required",
        decision: "review_required",
        failureReason: "invalid_scale_mapping",
        statusMessage: "ai_input screenshot proof must carry governed scaleMapping and sourceScreenshotEvidenceId.",
        reviewRequiredReason: "Visual Target requires review because ai_input screenshot proof is not executable without source mapping.",
        screenshotHash: screenshotProof.imageHash,
        dataQualityFlags: ["candidate_coordinate_requires_mapping"],
      };
    }
  }

  if (!["evidence_original", "ai_input_non_executable", "region_crop", "optimized_equivalent"].includes(screenshotProof.coordinateAuthority)) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "screenshot_coordinate_authority_invalid",
      statusMessage: "Visual Target screenshot proof must declare governed coordinate authority.",
      reviewRequiredReason: null,
      screenshotHash: screenshotProof.imageHash,
      dataQualityFlags: [],
    };
  }

  const ageMs = Math.max(0, input.nowEpochMs - parseVisualTargetIsoTimestamp(screenshotProof.capturedAt));
  if (ageMs > input.freshnessTtlMs) {
    return {
      ok: false,
      status: "review_required",
      decision: "review_required",
      failureReason: "stale_screenshot_proof",
      statusMessage: "Screenshot proof is stale for the requested visual target arbitration window.",
      reviewRequiredReason: "Visual Target requires a fresher screenshot proof before selecting a governed target.",
      screenshotHash: screenshotProof.imageHash,
      dataQualityFlags: ["stale_screenshot"],
    };
  }

  return {
    ok: true,
    decision: "allow",
    screenshotHash: screenshotProof.imageHash,
    dataQualityFlags: [],
  };
}