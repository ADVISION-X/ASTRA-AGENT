import type { ParsedVisualTargetAbilityInput, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import {
  createVisualTargetGateBlocked,
  createVisualTargetGateReviewRequired,
  createVisualTargetGateSuccess,
  type VisualTargetGateBlocked,
  type VisualTargetGateReviewRequired,
  type VisualTargetGateSuccess,
} from "./visual-target-gate-results.js";

type ScreenshotProofAllow = VisualTargetGateSuccess<"allow", { screenshotHash: string }>;
type ScreenshotProofBlocked = VisualTargetGateBlocked<"block", { screenshotHash: string | null }>;
type ScreenshotProofReviewRequired = VisualTargetGateReviewRequired<"review_required", { screenshotHash: string | null }>;

const ALLOWED_COORDINATE_AUTHORITIES = ["evidence_original", "ai_input_non_executable", "region_crop", "optimized_equivalent"] as const;

function matchesRequestedBinding(expected: string | null, actual: string | null): boolean {
  return expected === null || actual === expected;
}

function createScreenshotBlocked(
  failureReason: VisualTargetFailureReason,
  statusMessage: string,
  screenshotHash: string | null,
  dataQualityFlags: VisualTargetDataQualityFlag[],
): ScreenshotProofBlocked {
  return createVisualTargetGateBlocked({
    decision: "block",
    failureReason,
    statusMessage,
    dataQualityFlags,
    extra: { screenshotHash },
  });
}

function createScreenshotReview(
  input: {
    failureReason: VisualTargetFailureReason;
    statusMessage: string;
    reviewRequiredReason: string;
    screenshotHash: string;
    dataQualityFlags: VisualTargetDataQualityFlag[];
  },
): ScreenshotProofReviewRequired {
  return createVisualTargetGateReviewRequired({
    decision: "review_required",
    failureReason: input.failureReason,
    statusMessage: input.statusMessage,
    reviewRequiredReason: input.reviewRequiredReason,
    dataQualityFlags: input.dataQualityFlags,
    extra: { screenshotHash: input.screenshotHash },
  });
}

function findScreenshotStructuralFailure(screenshotProof: ParsedVisualTargetAbilityInput["sourceProof"]["screenshot"]): ScreenshotProofBlocked | null {
  if (!screenshotProof.screenshotProofRef || !screenshotProof.artifactRef) {
    return createScreenshotBlocked("missing_screenshot_proof", "Visual Target requires screenshot proof before candidate arbitration.", null, []);
  }
  return !screenshotProof.artifactHash || !screenshotProof.imageHash
    ? createScreenshotBlocked("screenshot_hash_missing", "Visual Target screenshot proof must bind artifactHash and imageHash.", null, [])
    : null;
}

function findScreenshotReviewRequirement(input: {
  screenshotProof: ParsedVisualTargetAbilityInput["sourceProof"]["screenshot"];
  screenshotHash: string;
}): ScreenshotProofReviewRequired | null {
  if (input.screenshotProof.coordinateSpace === "ai_input" && (!input.screenshotProof.scaleMapping || !input.screenshotProof.sourceScreenshotEvidenceId)) {
    return createScreenshotReview({
      failureReason: "invalid_scale_mapping",
      statusMessage: "ai_input screenshot proof must carry governed scaleMapping and sourceScreenshotEvidenceId.",
      reviewRequiredReason: "Visual Target requires review because ai_input screenshot proof is not executable without source mapping.",
      screenshotHash: input.screenshotHash,
      dataQualityFlags: ["candidate_coordinate_requires_mapping"],
    });
  }

  return null;
}

function findScreenshotBindingConflict(input: {
  request: ParsedVisualTargetAbilityInput;
  screenshotHash: string;
}): ScreenshotProofBlocked | null {
  const screenshotProof = input.request.sourceProof.screenshot;
  if (screenshotProof.missionId !== input.request.missionId) {
    return createScreenshotBlocked("screenshot_binding_mismatch", "Screenshot proof missionId must match Visual Target missionId.", input.screenshotHash, []);
  }
  if (screenshotProof.runId !== input.request.runId) {
    return createScreenshotBlocked("screenshot_binding_mismatch", "Screenshot proof runId must match Visual Target runId.", input.screenshotHash, []);
  }
  if (screenshotProof.sessionId !== input.request.sessionId) {
    return createScreenshotBlocked("screenshot_binding_mismatch", "Screenshot proof sessionId must match Visual Target sessionId.", input.screenshotHash, []);
  }
  if (!matchesRequestedBinding(input.request.roundId, screenshotProof.roundId)) {
    return createScreenshotBlocked("screenshot_binding_mismatch", "Screenshot proof roundId conflicts with Visual Target roundId.", input.screenshotHash, []);
  }
  if (!matchesRequestedBinding(input.request.videoVisitId, screenshotProof.videoVisitId)) {
    return createScreenshotBlocked("screenshot_binding_mismatch", "Screenshot proof videoVisitId conflicts with Visual Target videoVisitId.", input.screenshotHash, []);
  }
  return null;
}

export function validateScreenshotProof(input: {
  request: ParsedVisualTargetAbilityInput;
}): ScreenshotProofAllow | ScreenshotProofBlocked | ScreenshotProofReviewRequired {
  const screenshotProof = input.request.sourceProof.screenshot;
  const screenshotHash = screenshotProof.imageHash;
  const structuralFailure = findScreenshotStructuralFailure(screenshotProof);
  if (structuralFailure) {
    return structuralFailure;
  }

  const bindingConflict = findScreenshotBindingConflict({ request: input.request, screenshotHash });
  if (bindingConflict) {
    return bindingConflict;
  }

  if (!ALLOWED_COORDINATE_AUTHORITIES.includes(screenshotProof.coordinateAuthority)) {
    return createScreenshotBlocked(
      "screenshot_coordinate_authority_invalid",
      "Visual Target screenshot proof must declare governed coordinate authority.",
      screenshotHash,
      [],
    );
  }

  const reviewRequirement = findScreenshotReviewRequirement({
    screenshotProof,
    screenshotHash,
  });
  if (reviewRequirement) {
    return reviewRequirement;
  }

  return createVisualTargetGateSuccess("allow", [], { screenshotHash });
}