import type { ScreenshotBoundingBox, ScreenshotSourceProof } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";

function buildRegionProofFailure(reason: string, message: string) {
  return {
    decision: { status: "failed" as const, reason },
    failure: createScreenshotFailure({
      code: "region_proof_invalid",
      message,
    }),
  };
}

function resolveSourceEvidenceMismatchFailure(input: { sourceProof: ScreenshotSourceProof; region: ScreenshotBoundingBox }) {
  if (input.sourceProof.sourceScreenshotEvidenceId === input.region.sourceScreenshotEvidenceId) {
    return null;
  }

  return buildRegionProofFailure("source_evidence_mismatch", "Region sourceScreenshotEvidenceId must match sourceProof.");
}

function resolveSourceStorageMismatchFailure(input: { sourceProof: ScreenshotSourceProof; region: ScreenshotBoundingBox }) {
  if (input.sourceProof.sourceStorageRef === input.region.sourceStorageRef) {
    return null;
  }

  return buildRegionProofFailure("source_storage_mismatch", "Region sourceStorageRef must match sourceProof.");
}

function resolveCoordinateSpaceMismatchFailure(input: { sourceProof: ScreenshotSourceProof; region: ScreenshotBoundingBox }) {
  if (input.sourceProof.coordinateSpace === input.region.coordinateSpace) {
    return null;
  }

  return buildRegionProofFailure("coordinate_space_mismatch", "Region coordinateSpace must match sourceProof coordinateSpace.");
}

function resolveSourceDimensionsFailure(input: { sourceProof: ScreenshotSourceProof; region: ScreenshotBoundingBox }) {
  if (input.sourceProof.sourceWidth && input.sourceProof.sourceHeight) {
    return null;
  }

  return buildRegionProofFailure("source_dimensions_required", "Region proof requires source dimensions.");
}

function resolveRegionBoundsFailure(input: { sourceProof: ScreenshotSourceProof; region: ScreenshotBoundingBox }) {
  const sourceWidth = input.sourceProof.sourceWidth;
  const sourceHeight = input.sourceProof.sourceHeight;

  if (sourceWidth !== null && sourceHeight !== null && input.region.x >= 0 && input.region.y >= 0 && input.region.x + input.region.width <= sourceWidth && input.region.y + input.region.height <= sourceHeight) {
    return null;
  }

  return buildRegionProofFailure("region_out_of_bounds", "Region exceeds source dimensions.");
}

function resolveRegionProofGate(input: {
  sourceProof: ScreenshotSourceProof | null;
  region: ScreenshotBoundingBox | null;
}) {
  if (!input.region) {
    return {
      decision: { status: "not_applicable" as const, reason: null },
      failure: null,
    };
  }

  const sourceProof = input.sourceProof;
  if (!sourceProof) {
    return buildRegionProofFailure("source_proof_required", "Region capture requires sourceProof.");
  }

  const region = input.region;

  return (
    resolveSourceEvidenceMismatchFailure({ sourceProof, region })
    ?? resolveSourceStorageMismatchFailure({ sourceProof, region })
    ?? resolveCoordinateSpaceMismatchFailure({ sourceProof, region })
    ?? resolveSourceDimensionsFailure({ sourceProof, region })
    ?? resolveRegionBoundsFailure({ sourceProof, region })
    ?? {
      decision: { status: "passed" as const, reason: null },
      failure: null,
    }
  );
}

export function runRegionProofGate(input: {
  sourceProof: ScreenshotSourceProof | null;
  region: ScreenshotBoundingBox | null;
}): {
  decision: { status: "passed" | "failed" | "not_applicable"; reason: string | null };
  failure: ReturnType<typeof createScreenshotFailure> | null;
} {
  return resolveRegionProofGate(input);
}
