import { access, lstat, realpath } from "node:fs/promises";

import type { ScreenshotAbilityInput, ScreenshotSourceProof } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import type { ScreenshotChildRegistryEntry } from "./screenshot-child-contract.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

function buildScreenshotSourceFailure(input: {
  reason: string;
  message: string;
  detail?: string | null;
}) {
  return {
    decision: { status: "failed" as const, reason: input.reason },
    sourceProof: null,
    failure: createScreenshotFailure({
      code: "source_policy_violation",
      message: input.message,
      detail: input.detail ?? undefined,
    }),
  };
}

function resolveScreenshotSourceKindFailure(request: ScreenshotAbilityInput) {
  if (request.childCapabilityId === "capture-browser-viewport" && request.source.kind !== "browser_viewport") {
    return buildScreenshotSourceFailure({
      reason: "browser_viewport_source_required",
      message: "capture-browser-viewport requires source.kind=browser_viewport.",
    });
  }

  if (request.childCapabilityId === "capture-desktop-screen" && request.source.kind !== "desktop_screen") {
    return buildScreenshotSourceFailure({
      reason: "desktop_screen_source_required",
      message: "capture-desktop-screen requires source.kind=desktop_screen.",
    });
  }

  return null;
}

function resolveStoredImageSourceHeaderFailure(request: ScreenshotAbilityInput, sourceProof: ScreenshotSourceProof) {
  if (!sourceProof.proofRef) {
    return buildScreenshotSourceFailure({
      reason: "source_proof_ref_required",
      message: "Stored image sourceProof must include proofRef.",
    });
  }

  if (!sourceProof.sourceHash) {
    return buildScreenshotSourceFailure({
      reason: "source_hash_required",
      message: "Stored image sourceProof must include sourceHash.",
    });
  }

  if (!sourceProof.sourceScreenshotEvidenceId) {
    return buildScreenshotSourceFailure({
      reason: "source_screenshot_evidence_required",
      message: "Stored image sourceProof must include sourceScreenshotEvidenceId.",
    });
  }

  if (!sourceProof.sourceArtifactRef) {
    return buildScreenshotSourceFailure({
      reason: "source_artifact_ref_required",
      message: "Stored image sourceProof must include sourceArtifactRef.",
    });
  }

  return resolveStoredImageSourceBindingFailure(request, sourceProof);
}

function resolveStoredImageStorageRefFailure(request: ScreenshotAbilityInput, sourceProof: ScreenshotSourceProof) {
  if (sourceProof.sourceStorageRef && sourceProof.sourceStorageRef === request.source.sourceStorageRef) {
    return null;
  }

  return buildScreenshotSourceFailure({
    reason: "source_proof_storage_mismatch",
    message: "Stored image sourceProof must match sourceStorageRef.",
  });
}

function resolveStoredImageArtifactStorageFailure(request: ScreenshotAbilityInput, sourceProof: ScreenshotSourceProof) {
  if (sourceProof.sourceArtifactRef.storageRef === request.source.sourceStorageRef) {
    return null;
  }

  return buildScreenshotSourceFailure({
    reason: "source_artifact_storage_mismatch",
    message: "Stored image sourceArtifactRef.storageRef must match sourceStorageRef.",
  });
}

function resolveStoredImageArtifactHashFailure(sourceProof: ScreenshotSourceProof) {
  if (sourceProof.sourceArtifactRef.sha256 === sourceProof.sourceHash) {
    return null;
  }

  return buildScreenshotSourceFailure({
    reason: "source_artifact_hash_mismatch",
    message: "Stored image sourceArtifactRef.sha256 must match sourceProof.sourceHash.",
  });
}

function resolveStoredImageSessionFailure(request: ScreenshotAbilityInput, sourceProof: ScreenshotSourceProof) {
  if (sourceProof.sessionId === request.sessionId) {
    return null;
  }

  return buildScreenshotSourceFailure({
    reason: "source_session_mismatch",
    message: "Stored image sourceProof.sessionId must match request.sessionId.",
  });
}

function resolveStoredImageRoundFailure(request: ScreenshotAbilityInput, sourceProof: ScreenshotSourceProof) {
  if (!request.roundId || !sourceProof.roundId || sourceProof.roundId === request.roundId) {
    return null;
  }

  return buildScreenshotSourceFailure({
    reason: "source_round_mismatch",
    message: "Stored image sourceProof.roundId must match request.roundId when both are present.",
  });
}

function resolveStoredImageVideoVisitFailure(request: ScreenshotAbilityInput, sourceProof: ScreenshotSourceProof) {
  if (!request.videoVisitId || !sourceProof.videoVisitId || sourceProof.videoVisitId === request.videoVisitId) {
    return null;
  }

  return buildScreenshotSourceFailure({
    reason: "source_video_visit_mismatch",
    message: "Stored image sourceProof.videoVisitId must match request.videoVisitId when both are present.",
  });
}

function resolveStoredImageSourceBindingFailure(request: ScreenshotAbilityInput, sourceProof: ScreenshotSourceProof) {
  return (
    resolveStoredImageStorageRefFailure(request, sourceProof)
    ?? resolveStoredImageArtifactStorageFailure(request, sourceProof)
    ?? resolveStoredImageArtifactHashFailure(sourceProof)
    ?? resolveStoredImageSessionFailure(request, sourceProof)
    ?? resolveStoredImageRoundFailure(request, sourceProof)
    ?? resolveStoredImageVideoVisitFailure(request, sourceProof)
  );
}

async function resolveStoredImageSourceFileAvailabilityFailure(input: {
  request: ScreenshotAbilityInput;
}) {
  await access(input.request.source.sourceStorageRef);
  const sourceFileStat = await lstat(input.request.source.sourceStorageRef);
  if (!sourceFileStat.isSymbolicLink()) {
    return null;
  }

  return buildScreenshotSourceFailure({
    reason: "source_symlink_escape",
    message: "Stored image sourceStorageRef must not be a symbolic link.",
  });
}

async function resolveStoredImageSourcePathFailure(input: {
  request: ScreenshotAbilityInput;
  sourceProof: ScreenshotSourceProof;
}) {
  const resolvedSourcePath = await realpath(input.request.source.sourceStorageRef);
  const resolvedArtifactPath = await realpath(input.sourceProof.sourceArtifactRef.storageRef);
  if (resolvedSourcePath === resolvedArtifactPath) {
    return null;
  }

  return buildScreenshotSourceFailure({
    reason: "source_realpath_mismatch",
    message: "Stored image source file must resolve to the same artifact path declared in sourceArtifactRef.",
  });
}

async function resolveStoredImageSourceHashFailure(input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  sourceProof: ScreenshotSourceProof;
}) {
  const measuredHash = await input.context.imageProcessingPort.hashFile(input.request.source.sourceStorageRef);
  if (measuredHash === input.sourceProof.sourceHash) {
    return null;
  }

  return buildScreenshotSourceFailure({
    reason: "source_file_hash_mismatch",
    message: "Stored image source file hash must match sourceProof.sourceHash.",
  });
}

async function resolveStoredImageSourceDimensionFailure(input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  sourceProof: ScreenshotSourceProof;
}) {
  const measuredImage = await input.context.imageProcessingPort.inspectImage(input.request.source.sourceStorageRef);
  if ((input.sourceProof.sourceWidth && input.sourceProof.sourceWidth !== measuredImage.width) || (input.sourceProof.sourceHeight && input.sourceProof.sourceHeight !== measuredImage.height)) {
    return buildScreenshotSourceFailure({
      reason: "source_dimensions_mismatch",
      message: "Stored image source dimensions must match sourceProof dimensions.",
    });
  }

  return null;
}

async function resolveStoredImageSourceFileFailure(input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  sourceProof: ScreenshotSourceProof;
}) {
  try {
    return (
      await resolveStoredImageSourceFileAvailabilityFailure({ request: input.request })
      ?? await resolveStoredImageSourcePathFailure({ request: input.request, sourceProof: input.sourceProof })
      ?? await resolveStoredImageSourceHashFailure({ request: input.request, context: input.context, sourceProof: input.sourceProof })
      ?? await resolveStoredImageSourceDimensionFailure({ request: input.request, context: input.context, sourceProof: input.sourceProof })
    );
  } catch (error) {
    return buildScreenshotSourceFailure({
      reason: "source_file_unreadable",
      message: "Stored image source file must exist and remain readable under governed evidence storage.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  return null;
}

async function resolveStoredImageSourceGate(input: {
  request: ScreenshotAbilityInput;
  registryEntry: ScreenshotChildRegistryEntry;
  context: ScreenshotRuntimeContext;
}) {
  const sourceProof = input.request.source.sourceProof;
  return (
    resolveStoredImageSourceHeaderFailure(input.request, sourceProof)
    ?? resolveStoredImageSourceBindingFailure(input.request, sourceProof)
    ?? await resolveStoredImageSourceFileFailure({ request: input.request, context: input.context, sourceProof })
    ?? {
      decision: { status: "passed" as const, reason: null },
      sourceProof,
      failure: null,
    }
  );
}

async function resolveScreenshotSourceGate(input: {
  request: ScreenshotAbilityInput;
  registryEntry: ScreenshotChildRegistryEntry;
  context: ScreenshotRuntimeContext;
}): Promise<{
  decision: { status: "passed" | "failed"; reason: string | null };
  sourceProof: ScreenshotSourceProof | null;
  failure: ReturnType<typeof createScreenshotFailure> | null;
}> {
  const sourceKindFailure = resolveScreenshotSourceKindFailure(input.request);
  if (sourceKindFailure) {
    return sourceKindFailure;
  }

  if (!input.registryEntry.requiresSourceProof) {
    return {
      decision: { status: "passed" as const, reason: null },
      sourceProof: input.request.sourceProof,
      failure: null,
    };
  }

  if (input.request.source.kind !== "stored_image") {
    return buildScreenshotSourceFailure({
      reason: "stored_image_source_required",
      message: `${input.request.childCapabilityId} requires source.kind=stored_image.`,
    });
  }

  return resolveStoredImageSourceGate(input);
}

export async function runScreenshotSourceGate(input: {
  request: ScreenshotAbilityInput;
  registryEntry: ScreenshotChildRegistryEntry;
  context: ScreenshotRuntimeContext;
}): Promise<{
  decision: { status: "passed" | "failed"; reason: string | null };
  sourceProof: ScreenshotSourceProof | null;
  failure: ReturnType<typeof createScreenshotFailure> | null;
}> {
  return resolveScreenshotSourceGate(input);
}
