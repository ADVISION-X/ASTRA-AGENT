import type {
  AiAbilityResult,
  AiCommentSignalSummaryOutput,
  AiOcrCleanupOutput,
  AiPagePreparationOutput,
  AiVisualOutput,
  AiVisualTargetCandidateOutput,
  ParsedAiAbilityInput,
} from "../contract.js";
import { aliasAiOutputSummary, buildSummaryBase, storeAiOutputSummary } from "./ai-output-summary-store.js";

type SuccessfulAiResult<TOutput> = AiAbilityResult & { status: "success"; output: TOutput };

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

const isSuccessfulVisualTargetCandidateAnalysis = (
  request: ParsedAiAbilityInput,
  result: AiAbilityResult,
): result is AiAbilityResult & { status: "success"; output: AiVisualTargetCandidateOutput } => {
  return request.taskType === "visual_target_candidate_analysis"
    && result.status === "success"
    && result.output !== null;
};

const isSuccessfulPagePreparationJudgment = (
  request: ParsedAiAbilityInput,
  result: AiAbilityResult,
): result is SuccessfulAiResult<AiPagePreparationOutput> => {
  return request.taskType === "page_preparation_judgment"
    && result.status === "success"
    && result.output !== null;
};

const isSuccessfulOcrCleanup = (
  request: ParsedAiAbilityInput,
  result: AiAbilityResult,
): result is SuccessfulAiResult<AiOcrCleanupOutput> => {
  return request.taskType === "ocr_cleanup"
    && result.status === "success"
    && result.output !== null;
};

const isSuccessfulProductPresenceJudgment = (
  request: ParsedAiAbilityInput,
  result: AiAbilityResult,
): result is SuccessfulAiResult<AiVisualOutput> => {
  return request.taskType === "product_presence_judgment"
    && result.status === "success"
    && result.output !== null;
};

const isSuccessfulCommentSignalSummary = (
  request: ParsedAiAbilityInput,
  result: AiAbilityResult,
): result is SuccessfulAiResult<AiCommentSignalSummaryOutput> => {
  return request.taskType === "comment_signal_summary"
    && result.status === "success"
    && result.output !== null;
};

const recordVisualTargetCandidateSummary = (input: RecordableAiOutputSummaryInput): boolean => {
  if (!isSuccessfulVisualTargetCandidateAnalysis(input.request, input.result)) {
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
  if (!isSuccessfulPagePreparationJudgment(input.request, input.result)) {
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
  if (!isSuccessfulOcrCleanup(input.request, input.result)) {
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
  if (!isSuccessfulProductPresenceJudgment(input.request, input.result)) {
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

const recordCommentSignalSummary = (input: RecordableAiOutputSummaryInput): boolean => {
  if (!isSuccessfulCommentSignalSummary(input.request, input.result)) {
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

export function recordAiOutputSummary(input: RecordAiOutputSummaryInput): void {
  if (!input.outputRef) {
    return;
  }

  const recordableInput = { ...input, outputRef: input.outputRef };
  if (recordVisualTargetCandidateSummary(recordableInput)) {
    return;
  }
  if (recordPagePreparationSummary(recordableInput)) {
    return;
  }
  if (recordOcrCleanupSummary(recordableInput)) {
    return;
  }
  if (recordProductPresenceSummary(recordableInput)) {
    return;
  }
  recordCommentSignalSummary(recordableInput);
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