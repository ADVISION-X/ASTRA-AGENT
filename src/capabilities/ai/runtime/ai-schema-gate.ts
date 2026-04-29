import type { AiAbilityResult, AiPromptContract, AiTaskType, ParsedAiAbilityInput } from "../contract.js";
import {
  AiCommentSignalSummaryOutputSchema,
  AiEvidencePacketAnalysisOutputSchema,
  AiOcrCleanupOutputSchema,
  AiProductSignalSummaryOutputSchema,
  AiSchemaValidationOnlyOutputSchema,
  AiVisualOutputSchema,
} from "../schema.js";

function schemaForTaskType(taskType: AiTaskType) {
  switch (taskType) {
    case "product_presence_judgment":
    case "visual_observation":
    case "visual_target_candidate_analysis":
      return { schemaId: `ai.${taskType}.v1`, schema: AiVisualOutputSchema };
    case "ocr_cleanup":
      return { schemaId: "ai.ocr_cleanup.v1", schema: AiOcrCleanupOutputSchema };
    case "comment_signal_summary":
      return { schemaId: "ai.comment_signal_summary.v1", schema: AiCommentSignalSummaryOutputSchema };
    case "product_signal_summary":
      return { schemaId: "ai.product_signal_summary.v1", schema: AiProductSignalSummaryOutputSchema };
    case "evidence_packet_analysis":
      return { schemaId: "ai.evidence_packet_analysis.v1", schema: AiEvidencePacketAnalysisOutputSchema };
    case "schema_validation_only":
      return { schemaId: "ai.schema_validation_only.v1", schema: AiSchemaValidationOnlyOutputSchema };
  }
}

export function resolveAiSchemaContract(request: ParsedAiAbilityInput, promptContract: AiPromptContract): { decision: "resolved" | "review_required" | "blocked"; reason: string | null; schemaId: string | null; outputSchema: ReturnType<typeof schemaForTaskType>["schema"] | null } {
  const resolved = schemaForTaskType(request.taskType);
  if (resolved.schemaId !== request.expectedOutputSchema) {
    return { decision: "blocked", reason: "expected_output_schema_mismatch", schemaId: null, outputSchema: null };
  }

  if (promptContract.taskType !== request.taskType || promptContract.promptId !== request.promptContractId) {
    return { decision: "blocked", reason: "prompt_contract_mismatch", schemaId: null, outputSchema: null };
  }

  return { decision: "resolved", reason: null, schemaId: resolved.schemaId, outputSchema: resolved.schema };
}

export function validateAiRuntimeOutput(outputSchema: NonNullable<ReturnType<typeof resolveAiSchemaContract>["outputSchema"]>, runtimeOutput: unknown): { valid: true; output: AiAbilityResult["output"] } | { valid: false; issues: string[] } {
  const parsed = outputSchema.safeParse(runtimeOutput);
  if (parsed.success) {
    return { valid: true, output: parsed.data };
  }

  return {
    valid: false,
    issues: parsed.error.issues.map((issue) => issue.message),
  };
}

export function validateAiInternalCandidate(request: ParsedAiAbilityInput, promptContract: AiPromptContract): { valid: true; output: { valid: true; issues: string[] } } | { valid: false; issues: string[] } {
  if (request.taskType !== "schema_validation_only") {
    return { valid: false, issues: ["internal_validation_failed"] };
  }
  const resolved = resolveAiSchemaContract(request, promptContract);
  if (resolved.decision !== "resolved" || !resolved.outputSchema) {
    return { valid: false, issues: [resolved.reason ?? "expected_output_schema_missing"] };
  }

  const candidate = request.input.candidate;
  const parsed = resolved.outputSchema.safeParse(candidate);
  if (!parsed.success) {
    return { valid: false, issues: parsed.error.issues.map((issue) => issue.message) };
  }

  return { valid: true, output: { valid: true, issues: [] } };
}
