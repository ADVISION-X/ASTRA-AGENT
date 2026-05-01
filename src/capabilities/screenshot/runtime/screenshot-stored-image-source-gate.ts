import { access, lstat, realpath } from "node:fs/promises";

import type { ScreenshotAbilityInput, ScreenshotSourceProof } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

export type ScreenshotSourceGateResult = {
  decision: { status: "passed" | "failed"; reason: string | null };
  sourceProof: ScreenshotSourceProof | null;
  failure: ReturnType<typeof createScreenshotFailure> | null;
};

type StoredImageScreenshotRequest = Extract<ScreenshotAbilityInput, { source: { kind: "stored_image" } }>;

type StoredImageSourceProof = ScreenshotSourceProof & {
  sourceStorageRef: string;
  sourceArtifactRef: NonNullable<ScreenshotSourceProof["sourceArtifactRef"]>;
  sourceHash: string;
  sourceScreenshotEvidenceId: string;
};

export function buildScreenshotSourceFailure(input: {
  reason: string;
  message: string;
  detail?: string | null;
}): ScreenshotSourceGateResult {
  return {
    decision: { status: "failed", reason: input.reason },
    sourceProof: null,
    failure: createScreenshotFailure({
      code: "source_policy_violation",
      message: input.message,
      detail: input.detail ?? null,
    }),
  };
}

export function hasStoredImageSource(request: ScreenshotAbilityInput): request is StoredImageScreenshotRequest {
  return request.source.kind === "stored_image";
}

function hasStoredImageSourceProof(sourceProof: ScreenshotSourceProof): sourceProof is StoredImageSourceProof {
  return sourceProof.sourceStorageRef !== null
    && sourceProof.sourceArtifactRef !== null
    && sourceProof.sourceHash !== null
    && sourceProof.sourceScreenshotEvidenceId !== null;
}

function resolveStoredImageStorageBindingFailure(request: StoredImageScreenshotRequest, sourceProof: StoredImageSourceProof) {
  if (sourceProof.sourceStorageRef !== request.source.sourceStorageRef) {
    return buildScreenshotSourceFailure({
      reason: "source_proof_storage_mismatch",
      message: "Stored image sourceProof must match sourceStorageRef.",
    });
  }

  if (sourceProof.sourceArtifactRef.storageRef !== request.source.sourceStorageRef) {
    return buildScreenshotSourceFailure({
      reason: "source_artifact_storage_mismatch",
      message: "Stored image sourceArtifactRef.storageRef must match sourceStorageRef.",
    });
  }

  return null;
}

function resolveStoredImageHashAndSessionFailure(request: StoredImageScreenshotRequest, sourceProof: StoredImageSourceProof) {
  if (sourceProof.sourceArtifactRef.sha256 !== sourceProof.sourceHash) {
    return buildScreenshotSourceFailure({
      reason: "source_artifact_hash_mismatch",
      message: "Stored image sourceArtifactRef.sha256 must match sourceProof.sourceHash.",
    });
  }

  if (sourceProof.sessionId !== request.sessionId) {
    return buildScreenshotSourceFailure({
      reason: "source_session_mismatch",
      message: "Stored image sourceProof.sessionId must match request.sessionId.",
    });
  }

  return null;
}

function resolveStoredImageRoundAndVisitFailure(request: StoredImageScreenshotRequest, sourceProof: StoredImageSourceProof) {
  if (request.roundId && sourceProof.roundId && sourceProof.roundId !== request.roundId) {
    return buildScreenshotSourceFailure({
      reason: "source_round_mismatch",
      message: "Stored image sourceProof.roundId must match request.roundId when both are present.",
    });
  }

  if (request.videoVisitId && sourceProof.videoVisitId && sourceProof.videoVisitId !== request.videoVisitId) {
    return buildScreenshotSourceFailure({
      reason: "source_video_visit_mismatch",
      message: "Stored image sourceProof.videoVisitId must match request.videoVisitId when both are present.",
    });
  }

  return null;
}

function resolveStoredImageSourceBindingFailure(request: StoredImageScreenshotRequest, sourceProof: StoredImageSourceProof) {
  return resolveStoredImageStorageBindingFailure(request, sourceProof)
    ?? resolveStoredImageHashAndSessionFailure(request, sourceProof)
    ?? resolveStoredImageRoundAndVisitFailure(request, sourceProof);
}

function resolveStoredImageSourceHeaderFailure(request: StoredImageScreenshotRequest, sourceProof: ScreenshotSourceProof) {
  if (!sourceProof.proofRef) {
    return buildScreenshotSourceFailure({
      reason: "source_proof_ref_required",
      message: "Stored image sourceProof must include proofRef.",
    });
  }

  if (!hasStoredImageSourceProof(sourceProof)) {
    return buildScreenshotSourceFailure({
      reason: "source_artifact_ref_required",
      message: "Stored image sourceProof must include sourceHash, sourceScreenshotEvidenceId, sourceStorageRef, and sourceArtifactRef.",
    });
  }

  return resolveStoredImageSourceBindingFailure(request, sourceProof);
}

async function resolveStoredImageSourceFileFailure(input: {
  request: StoredImageScreenshotRequest;
  context: ScreenshotRuntimeContext;
  sourceProof: StoredImageSourceProof;
}) {
  try {
    return (
      await resolveStoredImageSourceFilesystemFailure(input.request.source.sourceStorageRef, input.sourceProof.sourceArtifactRef.storageRef)
      ?? await resolveStoredImageSourceContentFailure(input)
    );
  } catch (error) {
    return buildScreenshotSourceFailure({
      reason: "source_file_unreadable",
      message: "Stored image source file must exist and remain readable under governed evidence storage.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function resolveStoredImageSourceFilesystemFailure(sourceStorageRef: string, artifactStorageRef: string) {
  try {
    await access(sourceStorageRef);
    const sourceFileStat = await lstat(sourceStorageRef);
    if (sourceFileStat.isSymbolicLink()) {
      return buildScreenshotSourceFailure({
        reason: "source_symlink_escape",
        message: "Stored image sourceStorageRef must not be a symbolic link.",
      });
    }

    const resolvedSourcePath = await realpath(sourceStorageRef);
    const resolvedArtifactPath = await realpath(artifactStorageRef);
    if (resolvedSourcePath !== resolvedArtifactPath) {
      return buildScreenshotSourceFailure({
        reason: "source_realpath_mismatch",
        message: "Stored image source file must resolve to the same artifact path declared in sourceArtifactRef.",
      });
    }

    return null;
  } catch (error) {
    return buildScreenshotSourceFailure({
      reason: "source_file_unreadable",
      message: "Stored image source file must exist and remain readable under governed evidence storage.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function resolveStoredImageSourceContentFailure(input: {
  request: StoredImageScreenshotRequest;
  context: ScreenshotRuntimeContext;
  sourceProof: StoredImageSourceProof;
}) {
    const measuredHash = await input.context.imageProcessingPort.hashFile(input.request.source.sourceStorageRef);
    if (measuredHash !== input.sourceProof.sourceHash) {
      return buildScreenshotSourceFailure({
        reason: "source_file_hash_mismatch",
        message: "Stored image source file hash must match sourceProof.sourceHash.",
      });
    }

    const measuredImage = await input.context.imageProcessingPort.inspectImage(input.request.source.sourceStorageRef);
    if (
      (input.sourceProof.sourceWidth && input.sourceProof.sourceWidth !== measuredImage.width)
      || (input.sourceProof.sourceHeight && input.sourceProof.sourceHeight !== measuredImage.height)
    ) {
      return buildScreenshotSourceFailure({
        reason: "source_dimensions_mismatch",
        message: "Stored image source dimensions must match sourceProof dimensions.",
      });
    }

    return null;
}

export async function resolveStoredImageSourceGate(input: {
  request: StoredImageScreenshotRequest;
  context: ScreenshotRuntimeContext;
}): Promise<ScreenshotSourceGateResult> {
  const sourceProof = input.request.source.sourceProof;
  const headerFailure = resolveStoredImageSourceHeaderFailure(input.request, sourceProof);
  if (headerFailure) {
    return headerFailure;
  }

  if (!hasStoredImageSourceProof(sourceProof)) {
    return buildScreenshotSourceFailure({
      reason: "source_artifact_ref_required",
      message: "Stored image sourceProof must include sourceHash, sourceScreenshotEvidenceId, sourceStorageRef, and sourceArtifactRef.",
    });
  }

  return (
    await resolveStoredImageSourceFileFailure({ request: input.request, context: input.context, sourceProof })
    ?? {
      decision: { status: "passed", reason: null },
      sourceProof,
      failure: null,
    }
  );
}