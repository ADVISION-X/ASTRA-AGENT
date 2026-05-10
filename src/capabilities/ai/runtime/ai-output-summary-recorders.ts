import type {
  AiAbilityResult,
  AiCommentSignalSummaryOutput,
  AiOcrCleanupOutput,
  AiPagePreparationOutput,
  AiVisualOutput,
  AiVisualTargetCandidateOutput,
  CommentSignalSummaryInput,
  OcrCleanupInput,
  PagePreparationJudgmentInput,
  ParsedAiAbilityInput,
  ProductPresenceJudgmentInput,
  VisualTargetCandidateAnalysisInput,
} from "../contract.js";
import type { VisualMissionActionPlanOutput } from "../../../types/visual-mission-action-plan.js";
import { aliasAiOutputSummary, buildSummaryBase, storeAiOutputSummary } from "./ai-output-summary-store.js";

type SuccessfulSummaryInput<TRequest extends ParsedAiAbilityInput, TOutput> = RecordableAiOutputSummaryInput & {
  request: TRequest;
  result: AiAbilityResult & { status: "success"; output: TOutput };
};

type RecordAiOutputSummaryInput = {
  outputRef: string | null;
  request: ParsedAiAbilityInput;
  result: AiAbilityResult;
};

type RecordableAiOutputSummaryInput = {
  outputRef: string;
  request: ParsedAiAbilityInput;
  result: AiAbilityResult;
};

type VisualMissionActionPlanInput = Extract<ParsedAiAbilityInput, { taskType: "visual_mission_action_plan" }>;

const isSuccessfulVisualTargetCandidateAnalysis = (
  input: RecordableAiOutputSummaryInput,
): input is SuccessfulSummaryInput<VisualTargetCandidateAnalysisInput, AiVisualTargetCandidateOutput> => {
  return input.request.taskType === "visual_target_candidate_analysis"
    && input.result.status === "success"
    && input.result.output !== null;
};

const isSuccessfulPagePreparationJudgment = (
  input: RecordableAiOutputSummaryInput,
): input is SuccessfulSummaryInput<PagePreparationJudgmentInput, AiPagePreparationOutput> => {
  return input.request.taskType === "page_preparation_judgment"
    && input.result.status === "success"
    && input.result.output !== null;
};

const isSuccessfulOcrCleanup = (
  input: RecordableAiOutputSummaryInput,
): input is SuccessfulSummaryInput<OcrCleanupInput, AiOcrCleanupOutput> => {
  return input.request.taskType === "ocr_cleanup"
    && input.result.status === "success"
    && input.result.output !== null;
};

const isSuccessfulProductPresenceJudgment = (
  input: RecordableAiOutputSummaryInput,
): input is SuccessfulSummaryInput<ProductPresenceJudgmentInput, AiVisualOutput> => {
  return input.request.taskType === "product_presence_judgment"
    && input.result.status === "success"
    && input.result.output !== null;
};

const isSuccessfulVisualMissionActionPlan = (
  input: RecordableAiOutputSummaryInput,
): input is SuccessfulSummaryInput<VisualMissionActionPlanInput, VisualMissionActionPlanOutput> => {
  return input.request.taskType === "visual_mission_action_plan"
    && input.result.status === "success"
    && input.result.output !== null;
};

const isSuccessfulCommentSignalSummary = (
  input: RecordableAiOutputSummaryInput,
): input is SuccessfulSummaryInput<CommentSignalSummaryInput, AiCommentSignalSummaryOutput> => {
  return input.request.taskType === "comment_signal_summary"
    && input.result.status === "success"
    && input.result.output !== null;
};

const recordVisualTargetCandidateSummary = (input: RecordableAiOutputSummaryInput): boolean => {
  if (!isSuccessfulVisualTargetCandidateAnalysis(input)) {
    return false;
  }
  storeAiOutputSummary({
    ...buildSummaryBase({ outputRef: input.outputRef, request: input.request, result: input.result, output: input.result.output }),
    taskType: "visual_target_candidate_analysis",
    targetCandidates: input.result.output.targetCandidates,
  });
  return true;
};

const recordPagePreparationSummary = (input: RecordableAiOutputSummaryInput): boolean => {
  if (!isSuccessfulPagePreparationJudgment(input)) {
    return false;
  }
  storeAiOutputSummary({
    ...buildSummaryBase({ outputRef: input.outputRef, request: input.request, result: input.result, output: input.result.output }),
    taskType: "page_preparation_judgment",
    input: input.request.input,
    output: input.result.output,
  });
  return true;
};

const recordOcrCleanupSummary = (input: RecordableAiOutputSummaryInput): boolean => {
  if (!isSuccessfulOcrCleanup(input)) {
    return false;
  }
  storeAiOutputSummary({
    ...buildSummaryBase({ outputRef: input.outputRef, request: input.request, result: input.result, output: input.result.output }),
    taskType: "ocr_cleanup",
    input: input.request.input,
    output: input.result.output,
  });
  return true;
};

const recordProductPresenceSummary = (input: RecordableAiOutputSummaryInput): boolean => {
  if (!isSuccessfulProductPresenceJudgment(input)) {
    return false;
  }
  storeAiOutputSummary({
    ...buildSummaryBase({ outputRef: input.outputRef, request: input.request, result: input.result, output: input.result.output }),
    taskType: "product_presence_judgment",
    input: input.request.input,
    output: input.result.output,
  });
  return true;
};

const recordVisualMissionActionPlanSummary = (input: RecordableAiOutputSummaryInput): boolean => {
  if (!isSuccessfulVisualMissionActionPlan(input)) {
    return false;
  }
  storeAiOutputSummary({
    ...buildSummaryBase({ outputRef: input.outputRef, request: input.request, result: input.result, output: input.result.output }),
    taskType: "visual_mission_action_plan",
    input: input.request.input,
    output: input.result.output,
  });
  return true;
};

const recordCommentSignalSummary = (input: RecordableAiOutputSummaryInput): boolean => {
  if (!isSuccessfulCommentSignalSummary(input)) {
    return false;
  }
  storeAiOutputSummary({
    ...buildSummaryBase({ outputRef: input.outputRef, request: input.request, result: input.result, output: input.result.output }),
    taskType: "comment_signal_summary",
    input: input.request.input,
    output: input.result.output,
  });
  return true;
};

const AI_OUTPUT_SUMMARY_RECORDERS = [
  recordVisualTargetCandidateSummary,
  recordPagePreparationSummary,
  recordOcrCleanupSummary,
  recordProductPresenceSummary,
  recordVisualMissionActionPlanSummary,
  recordCommentSignalSummary,
] as const;

export function recordAiOutputSummary(input: RecordAiOutputSummaryInput): void {
  if (!input.outputRef) {
    return;
  }

  const recordableInput = { ...input, outputRef: input.outputRef };
  for (const recordSummary of AI_OUTPUT_SUMMARY_RECORDERS) {
    if (recordSummary(recordableInput)) {
      return;
    }
  }
}

export function recordAiOutputSummaryAlias(input: {
  aliasRef: string | null | undefined;
  sourceRef: string | null | undefined;
}): void {
  if (!input.aliasRef || !input.sourceRef || input.aliasRef === input.sourceRef) {
    return;
  }

  aliasAiOutputSummary(input.aliasRef, input.sourceRef);
}