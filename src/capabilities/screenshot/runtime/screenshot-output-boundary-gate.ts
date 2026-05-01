import type { ScreenshotExecutionOutput, ScreenshotRuntimeProof } from "../contract.js";
import type { ScreenshotChildRegistryEntry } from "./screenshot-child-contract.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";

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

function resolveOutputCoordinateSpaceFailure(input: { registryEntry: ScreenshotChildRegistryEntry; output: ScreenshotExecutionOutput }) {
  if (input.registryEntry.coordinateSpacePolicy === "derived" || input.output.coordinateSpace === input.registryEntry.coordinateSpacePolicy) {
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

async function resolveArtifactFileHashFailure(input: {
  context: ScreenshotRuntimeContext;
  output: ScreenshotExecutionOutput;
}) {
  const artifactHash = await input.context.imageProcessingPort.hashFile(input.output.artifactRef.storageRef);
  if (artifactHash === input.output.outputHash) {
    return null;
  }

  return buildScreenshotOutputBoundaryFailure("artifact_file_hash_mismatch", "Persisted screenshot artifact hash must match outputHash.");
}

async function resolveScreenshotOutputBoundaryGate(input: {
  context: ScreenshotRuntimeContext;
  registryEntry: ScreenshotChildRegistryEntry;
  output: ScreenshotExecutionOutput;
}) {
  return (
    resolveOutputEvidenceIdFailure(input)
    ?? resolveOutputHashMismatchFailure(input)
    ?? resolveOutputDimensionMismatchFailure(input)
    ?? resolveOutputImageKindFailure(input)
    ?? resolveOutputCoordinateSpaceFailure(input)
    ?? resolveOutputAiInputMappingFailure(input)
    ?? resolveTransformedOutputSourceEvidenceFailure(input)
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