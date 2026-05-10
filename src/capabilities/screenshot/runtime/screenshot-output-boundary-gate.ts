import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";

import type { ScreenshotExecutionOutput, ScreenshotRuntimeProof } from "../contract.js";
import type { ScreenshotChildRegistryEntry } from "./screenshot-child-contract.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import { ScreenshotArtifactLifecycleManifestSchema } from "../schema.js";

type ScreenshotArtifactLifecycleManifest = ReturnType<typeof ScreenshotArtifactLifecycleManifestSchema.parse>;

function buildScreenshotOutputBoundaryFailure(reason: string, message: string) {
  return {
    decision: { status: "failed" as const, reason },
    failure: createScreenshotFailure({
      code: "output_schema_invalid",
      message,
    }),
  };
}

function resolveOutputEvidenceIdFailure(input: { output: ScreenshotExecutionOutput }) {
  if (input.output.artifactRef.evidenceId === input.output.evidenceId) {
    return null;
  }

  return buildScreenshotOutputBoundaryFailure("output_evidence_id_mismatch", "Screenshot output evidenceId must match artifactRef.evidenceId.");
}

function resolveOutputHashMismatchFailure(input: { output: ScreenshotExecutionOutput }) {
  if (input.output.artifactRef.sha256 === input.output.outputHash) {
    return null;
  }

  return buildScreenshotOutputBoundaryFailure("output_hash_mismatch", "Screenshot outputHash must match artifactRef.sha256.");
}

function resolveOutputArtifactHashParityFailure(input: { output: ScreenshotExecutionOutput }) {
  if (input.output.artifactHash === input.output.outputHash && input.output.artifactRef.sha256 === input.output.artifactHash) {
    return null;
  }

  return buildScreenshotOutputBoundaryFailure("artifact_hash_mismatch", "Screenshot artifactHash must match outputHash and artifactRef.sha256.");
}

function resolveOutputArtifactLifecycleSovereigntyFailure(input: { output: ScreenshotExecutionOutput }) {
  if (input.output.promotionStatus === "not_promoted"
    && input.output.retentionClass !== "promoted-evidence"
    && input.output.retentionClass !== "legal-hold-evidence") {
    return null;
  }

  return buildScreenshotOutputBoundaryFailure("self_promotion_forbidden", "Screenshot output must stay transient/diagnostic and must not self-promote evidence.");
}

function resolveOutputArtifactByteSizeFailure(input: { output: ScreenshotExecutionOutput }) {
  if (input.output.byteSize > 0) {
    return null;
  }

  return buildScreenshotOutputBoundaryFailure("artifact_byte_size_invalid", "Screenshot output byteSize must be a positive integer.");
}

function resolveOutputDimensionMismatchFailure(input: { output: ScreenshotExecutionOutput }) {
  if (input.output.artifactRef.width === input.output.width && input.output.artifactRef.height === input.output.height) {
    return null;
  }

  return buildScreenshotOutputBoundaryFailure("artifact_dimensions_mismatch", "Screenshot output dimensions must match artifactRef dimensions.");
}

function resolveOutputImageKindFailure(input: { registryEntry: ScreenshotChildRegistryEntry; output: ScreenshotExecutionOutput }) {
  if (input.output.imageKind === input.registryEntry.outputImageKind && input.output.artifactRef.imageKind === input.registryEntry.outputImageKind) {
    return null;
  }

  return buildScreenshotOutputBoundaryFailure("image_kind_mismatch", "Screenshot output imageKind must match the registered child output image kind.");
}

function isBrowserViewportOriginalCapture(input: { registryEntry: ScreenshotChildRegistryEntry; output: ScreenshotExecutionOutput }) {
  return input.registryEntry.childCapabilityId === "capture-browser-viewport"
    && input.registryEntry.coordinateSpacePolicy === "browser_viewport_pixels"
    && input.output.imageKind === "evidence_original"
    && input.output.coordinateSpace === "source_image_pixels";
}

function hasBrowserViewportIdentityScaleMapping(output: ScreenshotExecutionOutput) {
  const mapping = output.scaleMapping;
  return mapping !== null
    && mapping.sourceCoordinateSpace === "browser_viewport_pixels"
    && mapping.targetCoordinateSpace === "source_image_pixels"
    && mapping.targetWidth === output.width
    && mapping.targetHeight === output.height
    && mapping.cropOffsetX === 0
    && mapping.cropOffsetY === 0;
}

function isBrowserViewportScaleMappedCapture(input: { registryEntry: ScreenshotChildRegistryEntry; output: ScreenshotExecutionOutput }) {
  return isBrowserViewportOriginalCapture(input) && hasBrowserViewportIdentityScaleMapping(input.output);
}

function resolveOutputCoordinateSpaceFailure(input: { registryEntry: ScreenshotChildRegistryEntry; output: ScreenshotExecutionOutput }) {
  if (input.registryEntry.coordinateSpacePolicy === "derived"
    || input.output.coordinateSpace === input.registryEntry.coordinateSpacePolicy
    || isBrowserViewportScaleMappedCapture(input)) {
    return null;
  }

  return buildScreenshotOutputBoundaryFailure("coordinate_space_policy_mismatch", "Screenshot output coordinateSpace must match the registered child coordinate policy.");
}

function resolveOutputAiInputMappingFailure(input: { output: ScreenshotExecutionOutput }) {
  if (input.output.imageKind !== "ai_input" || (input.output.scaleMapping && input.output.sourceScreenshotEvidenceId)) {
    return null;
  }

  return buildScreenshotOutputBoundaryFailure("ai_input_mapping_required", "prepare-ai-input success output requires scaleMapping and sourceScreenshotEvidenceId.");
}

function resolveTransformedOutputSourceEvidenceFailure(input: { output: ScreenshotExecutionOutput }) {
  if (input.output.imageKind === "evidence_original" || input.output.sourceScreenshotEvidenceId) {
    return null;
  }

  return buildScreenshotOutputBoundaryFailure("transformed_output_source_evidence_required", "Transformed screenshot outputs must retain sourceScreenshotEvidenceId.");
}

function resolveVisualMissionOutputShapeFailure(input: { output: ScreenshotExecutionOutput }) {
  if (input.output.imageKind !== "coordinate_grid") {
    return null;
  }

  if (!input.output.originalScreenshotRef || !input.output.coordinateGridScreenshotRef || !input.output.gridSpecRef || !input.output.visualMissionInputRef || !input.output.gridSpec || !input.output.visualMissionInput) {
    return buildScreenshotOutputBoundaryFailure("visual_mission_output_required", "Coordinate grid success output requires originalScreenshotRef, coordinateGridScreenshotRef, gridSpecRef, visualMissionInputRef, gridSpec, and visualMissionInput.");
  }

  if (input.output.gridSpec.sourceCoordinateSpace !== "browser_viewport_pixels") {
    return buildScreenshotOutputBoundaryFailure("visual_mission_coordinate_space_invalid", "gridSpec must decode to browser_viewport_pixels before it leaves Screenshot.");
  }

  if (input.output.originalScreenshotRef.evidenceId !== input.output.sourceScreenshotEvidenceId) {
    return buildScreenshotOutputBoundaryFailure("visual_mission_source_evidence_mismatch", "originalScreenshotRef.evidenceId must match sourceScreenshotEvidenceId for coordinate-grid outputs.");
  }

  if (input.output.coordinateGridScreenshotRef.artifactId !== input.output.artifactRef.artifactId) {
    return buildScreenshotOutputBoundaryFailure("coordinate_grid_artifact_mismatch", "coordinateGridScreenshotRef must match the stored coordinate-grid artifactRef.");
  }

  if (input.output.gridSpec.gridSpecRef !== input.output.gridSpecRef.refId) {
    return buildScreenshotOutputBoundaryFailure("grid_spec_ref_mismatch", "gridSpec.gridSpecRef must match gridSpecRef.refId.");
  }

  if (input.output.visualMissionInput.gridSpecRef !== input.output.gridSpecRef.refId
    || input.output.visualMissionInput.originalScreenshotRef !== input.output.originalScreenshotRef.artifactId
    || input.output.visualMissionInput.coordinateGridScreenshotRef !== input.output.coordinateGridScreenshotRef.artifactId) {
    return buildScreenshotOutputBoundaryFailure("visual_mission_bundle_mismatch", "visualMissionInput must reference the governed original screenshot, coordinate grid, and gridSpec refs.");
  }

  return null;
}

async function resolveStructuredRefHashFailure(ref: NonNullable<ScreenshotExecutionOutput["gridSpecRef"]> | NonNullable<ScreenshotExecutionOutput["visualMissionInputRef"]>) {
  await access(ref.storageRef);
  const persisted = await readFile(ref.storageRef, "utf8");
  const sha256 = createHash("sha256").update(persisted).digest("hex");
  return sha256 === ref.sha256
    ? null
    : buildScreenshotOutputBoundaryFailure("structured_ref_hash_mismatch", "Structured visual mission ref hash must match persisted JSON content.");
}

async function resolveVisualMissionStructuredRefFailure(input: { output: ScreenshotExecutionOutput }) {
  if (input.output.imageKind !== "coordinate_grid" || !input.output.gridSpecRef || !input.output.visualMissionInputRef) {
    return null;
  }

  return await resolveStructuredRefHashFailure(input.output.gridSpecRef)
    ?? await resolveStructuredRefHashFailure(input.output.visualMissionInputRef);
}

async function resolveArtifactFileHashFailure(input: {
  context: ScreenshotRuntimeContext;
  output: ScreenshotExecutionOutput;
}) {
  const artifactHash = await input.context.imageProcessingPort.hashFile(input.output.artifactRef.storageRef);
  if (artifactHash === input.output.outputHash && artifactHash === input.output.artifactHash) {
    return null;
  }

  return buildScreenshotOutputBoundaryFailure("artifact_file_hash_mismatch", "Persisted screenshot artifact hash must match outputHash.");
}

async function readLifecycleManifest(artifactLifecycleManifestRef: string): Promise<ScreenshotArtifactLifecycleManifest> {
  return ScreenshotArtifactLifecycleManifestSchema.parse(JSON.parse(await readFile(artifactLifecycleManifestRef, "utf8")));
}

function lifecycleManifestMatchesOutput(manifest: ScreenshotArtifactLifecycleManifest, output: ScreenshotExecutionOutput) {
  return manifest.artifactLifecycleManifestRef === output.artifactLifecycleManifestRef
    && manifest.evidenceId === output.evidenceId
    && manifest.storageRef === output.artifactRef.storageRef
    && manifest.artifactHash === output.artifactHash
    && manifest.byteSize === output.byteSize
    && manifest.retentionClass === output.retentionClass
    && manifest.promotionStatus === output.promotionStatus
    && manifest.cleanupEligible === output.cleanupEligible;
}

function buildLifecycleManifestReadFailure(error: unknown) {
  return buildScreenshotOutputBoundaryFailure(
    "artifact_lifecycle_manifest_invalid",
    error instanceof Error ? error.message : "Screenshot artifact lifecycle manifest is missing or invalid.",
  );
}

async function resolveLifecycleManifestFailure(input: {
  context: ScreenshotRuntimeContext;
  output: ScreenshotExecutionOutput;
}) {
  try {
    await access(input.output.artifactLifecycleManifestRef);
    const manifest = await readLifecycleManifest(input.output.artifactLifecycleManifestRef);
    return lifecycleManifestMatchesOutput(manifest, input.output)
      ? null
      : buildScreenshotOutputBoundaryFailure("artifact_lifecycle_manifest_mismatch", "Screenshot output must match the persisted artifact lifecycle manifest.");
  } catch (error) {
    return buildLifecycleManifestReadFailure(error);
  }
}

async function resolveScreenshotOutputBoundaryGate(input: {
  context: ScreenshotRuntimeContext;
  registryEntry: ScreenshotChildRegistryEntry;
  output: ScreenshotExecutionOutput;
}) {
  return (
    resolveOutputEvidenceIdFailure(input)
    ?? resolveOutputHashMismatchFailure(input)
    ?? resolveOutputArtifactHashParityFailure(input)
    ?? resolveOutputDimensionMismatchFailure(input)
    ?? resolveOutputImageKindFailure(input)
    ?? resolveOutputCoordinateSpaceFailure(input)
    ?? resolveOutputAiInputMappingFailure(input)
    ?? resolveTransformedOutputSourceEvidenceFailure(input)
    ?? resolveVisualMissionOutputShapeFailure(input)
    ?? resolveOutputArtifactLifecycleSovereigntyFailure(input)
    ?? resolveOutputArtifactByteSizeFailure(input)
    ?? await resolveVisualMissionStructuredRefFailure(input)
    ?? await resolveLifecycleManifestFailure(input)
    ?? await resolveArtifactFileHashFailure(input)
    ?? {
      decision: { status: "passed" as const, reason: null },
      failure: null,
    }
  );
}

export async function runScreenshotOutputBoundaryGate(input: {
  context: ScreenshotRuntimeContext;
  registryEntry: ScreenshotChildRegistryEntry;
  output: ScreenshotExecutionOutput;
}): Promise<{
  decision: ScreenshotRuntimeProof["artifactDecision"];
  failure: ReturnType<typeof createScreenshotFailure> | null;
}> {
  return resolveScreenshotOutputBoundaryGate(input);
}
