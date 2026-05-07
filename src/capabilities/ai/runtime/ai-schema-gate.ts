import type { AiAbilityResult, AiTaskType, ParsedAiAbilityInput } from "../contract.js";
import type { ResolvedAiPromptContract } from "../ports/ai-prompt-registry-port.js";
import {
  AiCommentSignalSummaryOutputSchema,
  AiEvidencePacketAnalysisOutputSchema,
  AiMapAuthoringOutputSchema,
  AiOcrCleanupOutputSchema,
  AiPagePreparationOutputSchema,
  AiProductSignalSummaryOutputSchema,
  AiSchemaValidationOnlyOutputSchema,
  AiVisualOutputSchema,
} from "../schema.js";

const SCHEMA_BY_TASK_TYPE = {
  page_preparation_judgment: { schemaId: "ai.page_preparation_judgment.v1", schema: AiPagePreparationOutputSchema },
  product_presence_judgment: { schemaId: "ai.product_presence_judgment.v1", schema: AiVisualOutputSchema },
  visual_observation: { schemaId: "ai.visual_observation.v1", schema: AiVisualOutputSchema },
  visual_target_candidate_analysis: { schemaId: "ai.visual_target_candidate_analysis.v1", schema: AiVisualOutputSchema },
  ocr_cleanup: { schemaId: "ai.ocr_cleanup.v1", schema: AiOcrCleanupOutputSchema },
  comment_signal_summary: { schemaId: "ai.comment_signal_summary.v1", schema: AiCommentSignalSummaryOutputSchema },
  product_signal_summary: { schemaId: "ai.product_signal_summary.v1", schema: AiProductSignalSummaryOutputSchema },
  evidence_packet_analysis: { schemaId: "ai.evidence_packet_analysis.v1", schema: AiEvidencePacketAnalysisOutputSchema },
  map_authoring: { schemaId: "ai.map_authoring.v1", schema: AiMapAuthoringOutputSchema },
  schema_validation_only: { schemaId: "ai.schema_validation_only.v1", schema: AiSchemaValidationOnlyOutputSchema },
} as const;

function schemaForTaskType(taskType: AiTaskType) {
  return SCHEMA_BY_TASK_TYPE[taskType];
}

export function resolveAiSchemaContract(request: ParsedAiAbilityInput, promptContract: ResolvedAiPromptContract): { decision: "resolved" | "review_required" | "blocked"; reason: string | null; schemaId: string | null; outputSchema: ReturnType<typeof schemaForTaskType>["schema"] | null } {
  const resolved = schemaForTaskType(request.taskType);
  if (resolved.schemaId !== request.expectedOutputSchema || promptContract.outputSchemaRef !== request.expectedOutputSchema) {
    return { decision: "blocked", reason: "expected_output_schema_mismatch", schemaId: null, outputSchema: null };
  }

  if (promptContract.taskType !== request.taskType || promptContract.promptContractId !== request.promptContractId) {
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

export function validateAiInternalCandidate(request: ParsedAiAbilityInput, promptContract: ResolvedAiPromptContract): { valid: true; output: { valid: true; issues: string[] } } | { valid: false; issues: string[] } {
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
