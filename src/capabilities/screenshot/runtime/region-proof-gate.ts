import type { ScreenshotBoundingBox, ScreenshotSourceProof } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";

export function runRegionProofGate(input: {
  sourceProof: ScreenshotSourceProof | null;
  region: ScreenshotBoundingBox | null;
}): {
  decision: { status: "passed" | "failed" | "not_applicable"; reason: string | null };
  failure: ReturnType<typeof createScreenshotFailure> | null;
} {
  if (!input.region) {
    return {
      decision: { status: "not_applicable", reason: null },
      failure: null,
    };
  }
  if (!input.sourceProof) {
    return {
      decision: { status: "failed", reason: "source_proof_required" },
      failure: createScreenshotFailure({
        code: "region_proof_invalid",
        message: "Region capture requires sourceProof.",
      }),
    };
  }
  if (input.sourceProof.sourceScreenshotEvidenceId !== input.region.sourceScreenshotEvidenceId) {
    return {
      decision: { status: "failed", reason: "source_evidence_mismatch" },
      failure: createScreenshotFailure({
        code: "region_proof_invalid",
        message: "Region sourceScreenshotEvidenceId must match sourceProof.",
      }),
    };
  }
  if (input.sourceProof.sourceStorageRef !== input.region.sourceStorageRef) {
    return {
      decision: { status: "failed", reason: "source_storage_mismatch" },
      failure: createScreenshotFailure({
        code: "region_proof_invalid",
        message: "Region sourceStorageRef must match sourceProof.",
      }),
    };
  }
  if (input.sourceProof.coordinateSpace !== input.region.coordinateSpace) {
    return {
      decision: { status: "failed", reason: "coordinate_space_mismatch" },
      failure: createScreenshotFailure({
        code: "region_proof_invalid",
        message: "Region coordinateSpace must match sourceProof coordinateSpace.",
      }),
    };
  }
  if (!input.sourceProof.sourceWidth || !input.sourceProof.sourceHeight) {
    return {
      decision: { status: "failed", reason: "source_dimensions_required" },
      failure: createScreenshotFailure({
        code: "region_proof_invalid",
        message: "Region proof requires source dimensions.",
      }),
    };
  }
  if (input.region.x < 0 || input.region.y < 0 || input.region.x + input.region.width > input.sourceProof.sourceWidth || input.region.y + input.region.height > input.sourceProof.sourceHeight) {
    return {
      decision: { status: "failed", reason: "region_out_of_bounds" },
      failure: createScreenshotFailure({
        code: "region_proof_invalid",
        message: "Region exceeds source dimensions.",
      }),
    };
  }
  return {
    decision: { status: "passed", reason: null },
    failure: null,
  };
}
