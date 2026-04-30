import { access, lstat, realpath } from "node:fs/promises";

import type { ScreenshotAbilityInput, ScreenshotSourceProof } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import type { ScreenshotChildRegistryEntry } from "./screenshot-child-contract.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

export async function runScreenshotSourceGate(input: {
  request: ScreenshotAbilityInput;
  registryEntry: ScreenshotChildRegistryEntry;
  context: ScreenshotRuntimeContext;
}): Promise<{
  decision: { status: "passed" | "failed"; reason: string | null };
  sourceProof: ScreenshotSourceProof | null;
  failure: ReturnType<typeof createScreenshotFailure> | null;
}> {
  const request = input.request;

  if (request.childCapabilityId === "capture-browser-viewport" && request.source.kind !== "browser_viewport") {
    return {
      decision: { status: "failed", reason: "browser_viewport_source_required" },
      sourceProof: null,
      failure: createScreenshotFailure({
        code: "source_policy_violation",
        message: "capture-browser-viewport requires source.kind=browser_viewport.",
      }),
    };
  }

  if (request.childCapabilityId === "capture-desktop-screen" && request.source.kind !== "desktop_screen") {
    return {
      decision: { status: "failed", reason: "desktop_screen_source_required" },
      sourceProof: null,
      failure: createScreenshotFailure({
        code: "source_policy_violation",
        message: "capture-desktop-screen requires source.kind=desktop_screen.",
      }),
    };
  }

  if (input.registryEntry.requiresSourceProof) {
    if (request.source.kind !== "stored_image") {
      return {
        decision: { status: "failed", reason: "stored_image_source_required" },
        sourceProof: null,
        failure: createScreenshotFailure({
          code: "source_policy_violation",
          message: `${request.childCapabilityId} requires source.kind=stored_image.`,
        }),
      };
    }

    const sourceProof = request.source.sourceProof;
    const sourceArtifactRef = sourceProof.sourceArtifactRef;

    if (!sourceProof.proofRef) {
      return {
        decision: { status: "failed", reason: "source_proof_ref_required" },
        sourceProof: null,
        failure: createScreenshotFailure({
          code: "source_policy_violation",
          message: "Stored image sourceProof must include proofRef.",
        }),
      };
    }

    if (!sourceProof.sourceHash) {
      return {
        decision: { status: "failed", reason: "source_hash_required" },
        sourceProof: null,
        failure: createScreenshotFailure({
          code: "source_policy_violation",
          message: "Stored image sourceProof must include sourceHash.",
        }),
      };
    }

    if (!sourceProof.sourceScreenshotEvidenceId) {
      return {
        decision: { status: "failed", reason: "source_screenshot_evidence_required" },
        sourceProof: null,
        failure: createScreenshotFailure({
          code: "source_policy_violation",
          message: "Stored image sourceProof must include sourceScreenshotEvidenceId.",
        }),
      };
    }

    if (!sourceArtifactRef) {
      return {
        decision: { status: "failed", reason: "source_artifact_ref_required" },
        sourceProof: null,
        failure: createScreenshotFailure({
          code: "source_policy_violation",
          message: "Stored image sourceProof must include sourceArtifactRef.",
        }),
      };
    }

    if (!sourceProof.sourceStorageRef || sourceProof.sourceStorageRef !== request.source.sourceStorageRef) {
      return {
        decision: { status: "failed", reason: "source_proof_storage_mismatch" },
        sourceProof: null,
        failure: createScreenshotFailure({
          code: "source_policy_violation",
          message: "Stored image sourceProof must match sourceStorageRef.",
        }),
      };
    }

    if (sourceArtifactRef.storageRef !== request.source.sourceStorageRef) {
      return {
        decision: { status: "failed", reason: "source_artifact_storage_mismatch" },
        sourceProof: null,
        failure: createScreenshotFailure({
          code: "source_policy_violation",
          message: "Stored image sourceArtifactRef.storageRef must match sourceStorageRef.",
        }),
      };
    }

    if (sourceArtifactRef.sha256 !== sourceProof.sourceHash) {
      return {
        decision: { status: "failed", reason: "source_artifact_hash_mismatch" },
        sourceProof: null,
        failure: createScreenshotFailure({
          code: "source_policy_violation",
          message: "Stored image sourceArtifactRef.sha256 must match sourceProof.sourceHash.",
        }),
      };
    }

    if (sourceProof.sessionId !== request.sessionId) {
      return {
        decision: { status: "failed", reason: "source_session_mismatch" },
        sourceProof: null,
        failure: createScreenshotFailure({
          code: "source_policy_violation",
          message: "Stored image sourceProof.sessionId must match request.sessionId.",
        }),
      };
    }

    if (request.roundId && sourceProof.roundId && sourceProof.roundId !== request.roundId) {
      return {
        decision: { status: "failed", reason: "source_round_mismatch" },
        sourceProof: null,
        failure: createScreenshotFailure({
          code: "source_policy_violation",
          message: "Stored image sourceProof.roundId must match request.roundId when both are present.",
        }),
      };
    }

    if (request.videoVisitId && sourceProof.videoVisitId && sourceProof.videoVisitId !== request.videoVisitId) {
      return {
        decision: { status: "failed", reason: "source_video_visit_mismatch" },
        sourceProof: null,
        failure: createScreenshotFailure({
          code: "source_policy_violation",
          message: "Stored image sourceProof.videoVisitId must match request.videoVisitId when both are present.",
        }),
      };
    }

    try {
      await access(request.source.sourceStorageRef);
      const sourceFileStat = await lstat(request.source.sourceStorageRef);
      if (sourceFileStat.isSymbolicLink()) {
        return {
          decision: { status: "failed", reason: "source_symlink_escape" },
          sourceProof: null,
          failure: createScreenshotFailure({
            code: "source_policy_violation",
            message: "Stored image sourceStorageRef must not be a symbolic link.",
          }),
        };
      }

      const resolvedSourcePath = await realpath(request.source.sourceStorageRef);
      const resolvedArtifactPath = await realpath(sourceArtifactRef.storageRef);
      if (resolvedSourcePath !== resolvedArtifactPath) {
        return {
          decision: { status: "failed", reason: "source_realpath_mismatch" },
          sourceProof: null,
          failure: createScreenshotFailure({
            code: "source_policy_violation",
            message: "Stored image source file must resolve to the same artifact path declared in sourceArtifactRef.",
          }),
        };
      }

      const measuredHash = await input.context.imageProcessingPort.hashFile(request.source.sourceStorageRef);
      if (measuredHash !== sourceProof.sourceHash) {
        return {
          decision: { status: "failed", reason: "source_file_hash_mismatch" },
          sourceProof: null,
          failure: createScreenshotFailure({
            code: "source_policy_violation",
            message: "Stored image source file hash must match sourceProof.sourceHash.",
          }),
        };
      }

      const measuredImage = await input.context.imageProcessingPort.inspectImage(request.source.sourceStorageRef);
      if ((sourceProof.sourceWidth && sourceProof.sourceWidth !== measuredImage.width) || (sourceProof.sourceHeight && sourceProof.sourceHeight !== measuredImage.height)) {
        return {
          decision: { status: "failed", reason: "source_dimensions_mismatch" },
          sourceProof: null,
          failure: createScreenshotFailure({
            code: "source_policy_violation",
            message: "Stored image source dimensions must match sourceProof dimensions.",
          }),
        };
      }
    } catch (error) {
      return {
        decision: { status: "failed", reason: "source_file_unreadable" },
        sourceProof: null,
        failure: createScreenshotFailure({
          code: "source_policy_violation",
          message: "Stored image source file must exist and remain readable under governed evidence storage.",
          detail: error instanceof Error ? error.message : String(error),
        }),
      };
    }

    return {
      decision: { status: "passed", reason: null },
      sourceProof,
      failure: null,
    };
  }

  return {
    decision: { status: "passed", reason: null },
    sourceProof: request.sourceProof,
    failure: null,
  };
}
