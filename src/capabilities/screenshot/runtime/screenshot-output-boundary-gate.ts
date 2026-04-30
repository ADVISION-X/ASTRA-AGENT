import type { ScreenshotExecutionOutput, ScreenshotRuntimeProof } from "../contract.js";
import type { ScreenshotChildRegistryEntry } from "./screenshot-child-contract.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";

export async function runScreenshotOutputBoundaryGate(input: {
  context: ScreenshotRuntimeContext;
  registryEntry: ScreenshotChildRegistryEntry;
  output: ScreenshotExecutionOutput;
}): Promise<{
  decision: ScreenshotRuntimeProof["artifactDecision"];
  failure: ReturnType<typeof createScreenshotFailure> | null;
}> {
  if (input.output.artifactRef.evidenceId !== input.output.evidenceId) {
    return {
      decision: { status: "failed", reason: "output_evidence_id_mismatch" },
      failure: createScreenshotFailure({
        code: "output_schema_invalid",
        message: "Screenshot output evidenceId must match artifactRef.evidenceId.",
      }),
    };
  }

  if (input.output.artifactRef.sha256 !== input.output.outputHash) {
    return {
      decision: { status: "failed", reason: "output_hash_mismatch" },
      failure: createScreenshotFailure({
        code: "output_schema_invalid",
        message: "Screenshot outputHash must match artifactRef.sha256.",
      }),
    };
  }

  if (input.output.artifactRef.width !== input.output.width || input.output.artifactRef.height !== input.output.height) {
    return {
      decision: { status: "failed", reason: "artifact_dimensions_mismatch" },
      failure: createScreenshotFailure({
        code: "output_schema_invalid",
        message: "Screenshot output dimensions must match artifactRef dimensions.",
      }),
    };
  }

  if (input.output.imageKind !== input.registryEntry.outputImageKind || input.output.artifactRef.imageKind !== input.registryEntry.outputImageKind) {
    return {
      decision: { status: "failed", reason: "image_kind_mismatch" },
      failure: createScreenshotFailure({
        code: "output_schema_invalid",
        message: "Screenshot output imageKind must match the registered child output image kind.",
      }),
    };
  }

  if (input.registryEntry.coordinateSpacePolicy !== "derived" && input.output.coordinateSpace !== input.registryEntry.coordinateSpacePolicy) {
    return {
      decision: { status: "failed", reason: "coordinate_space_policy_mismatch" },
      failure: createScreenshotFailure({
        code: "output_schema_invalid",
        message: "Screenshot output coordinateSpace must match the registered child coordinate policy.",
      }),
    };
  }

  if (input.output.imageKind === "ai_input" && (!input.output.scaleMapping || !input.output.sourceScreenshotEvidenceId)) {
    return {
      decision: { status: "failed", reason: "ai_input_mapping_required" },
      failure: createScreenshotFailure({
        code: "output_schema_invalid",
        message: "prepare-ai-input success output requires scaleMapping and sourceScreenshotEvidenceId.",
      }),
    };
  }

  if (input.output.imageKind !== "evidence_original" && !input.output.sourceScreenshotEvidenceId) {
    return {
      decision: { status: "failed", reason: "transformed_output_source_evidence_required" },
      failure: createScreenshotFailure({
        code: "output_schema_invalid",
        message: "Transformed screenshot outputs must retain sourceScreenshotEvidenceId.",
      }),
    };
  }

  const artifactHash = await input.context.imageProcessingPort.hashFile(input.output.artifactRef.storageRef);
  if (artifactHash !== input.output.outputHash) {
    return {
      decision: { status: "failed", reason: "artifact_file_hash_mismatch" },
      failure: createScreenshotFailure({
        code: "output_schema_invalid",
        message: "Persisted screenshot artifact hash must match outputHash.",
      }),
    };
  }

  return {
    decision: { status: "passed", reason: null },
    failure: null,
  };
}