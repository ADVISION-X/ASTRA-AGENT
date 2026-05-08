import { createHash } from "node:crypto";

import type {
  AiAbilityResult,
  AiCommentSignalSummaryOutput,
  AiPagePreparationOutput,
  AiVisualOutput,
  AiVisualTargetCandidateOutput,
  CommentSignalSummaryInput,
  PagePreparationJudgmentInput,
  ParsedAiAbilityInput,
  ProductPresenceJudgmentInput,
} from "../contract.js";

type AiOutputSummaryBase = {
  aiResultRef: string;
  rawAiResultRef: string;
  aiProofRef: string;
  promptContractId: string;
  promptContractVersion: string;
  promptCatalogVersion: string;
  outputSchemaRef: string;
  aiInputArtifactRef: string | null;
  aiInputHash: string;
  outputPayloadHash: string;
  capturedAt: string;
  missionId: string | null;
  runId: string | null;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  confidence: number;
  modelRole: string;
  modelProvider: string;
  modelName: string;
};

export type AiVisualTargetCandidateOutputSummary = AiOutputSummaryBase & {
  taskType: "visual_target_candidate_analysis";
  targetCandidates: AiVisualTargetCandidateOutput["targetCandidates"];
};

export type AiPagePreparationOutputSummary = AiOutputSummaryBase & {
  taskType: "page_preparation_judgment";
  input: PagePreparationJudgmentInput["input"];
  output: AiPagePreparationOutput;
};

export type AiProductPresenceOutputSummary = AiOutputSummaryBase & {
  taskType: "product_presence_judgment";
  input: ProductPresenceJudgmentInput["input"];
  output: AiVisualOutput;
};

export type AiCommentSignalOutputSummary = AiOutputSummaryBase & {
  taskType: "comment_signal_summary";
  input: CommentSignalSummaryInput["input"];
  output: AiCommentSignalSummaryOutput;
};

type RecordedAiOutputSummary =
  | AiVisualTargetCandidateOutputSummary
  | AiPagePreparationOutputSummary
  | AiProductPresenceOutputSummary
  | AiCommentSignalOutputSummary;

type SuccessfulAiResult<TOutput> = AiAbilityResult & { status: "success"; output: TOutput };

const summaries = new Map<string, RecordedAiOutputSummary>();

const buildOutputPayloadHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const buildCompactAiResultRef = (outputRef: string) =>
  `ai-result:${createHash("sha256").update(outputRef).digest("hex").slice(0, 24)}`;

const storeAiOutputSummary = (summary: RecordedAiOutputSummary) => {
  summaries.set(summary.rawAiResultRef, summary);
  summaries.set(summary.aiResultRef, summary);
};

const buildSummaryBase = (input: {
  outputRef: string;
  request: ParsedAiAbilityInput;
  result: AiAbilityResult;
  output: unknown;
}): AiOutputSummaryBase => ({
  aiResultRef: buildCompactAiResultRef(input.outputRef),
  rawAiResultRef: input.outputRef,
  aiProofRef: input.result.runtimeProof.proofId,
  promptContractId: input.result.runtimeProof.promptContractId,
  promptContractVersion: input.result.runtimeProof.promptContractVersion,
  promptCatalogVersion: input.result.runtimeProof.promptCatalogVersion,
  outputSchemaRef: input.result.runtimeProof.expectedOutputSchema,
  aiInputArtifactRef: input.request.inputRefs[0]?.id ?? null,
  aiInputHash: input.result.runtimeProof.inputPayloadHash,
  outputPayloadHash: buildOutputPayloadHash(input.output),
  capturedAt: input.result.createdAt,
  missionId: input.result.runtimeProof.missionId,
  runId: input.result.runtimeProof.runId,
  sessionId: input.result.runtimeProof.sessionId,
  roundId: input.result.runtimeProof.roundId,
  videoVisitId: input.result.runtimeProof.videoVisitId,
  confidence: input.result.confidence ?? 0,
  modelRole: input.result.modelRole,
  modelProvider: input.result.modelProvider,
  modelName: input.result.modelName,
});

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

export function recordAiOutputSummary(input: {
  outputRef: string | null;
  request: ParsedAiAbilityInput;
  result: AiAbilityResult;
}): void {
  if (!input.outputRef) {
    return;
  }

  if (isSuccessfulVisualTargetCandidateAnalysis(input.request, input.result)) {
    storeAiOutputSummary({
      ...buildSummaryBase({ outputRef: input.outputRef, request: input.request, result: input.result, output: input.result.output }),
      taskType: "visual_target_candidate_analysis",
      targetCandidates: input.result.output.targetCandidates,
    });
    return;
  }

  if (isSuccessfulPagePreparationJudgment(input.request, input.result)) {
    const typedRequest = input.request as Extract<ParsedAiAbilityInput, { taskType: "page_preparation_judgment" }>;
    storeAiOutputSummary({
      ...buildSummaryBase({ outputRef: input.outputRef, request: input.request, result: input.result, output: input.result.output }),
      taskType: "page_preparation_judgment",
      input: typedRequest.input,
      output: input.result.output,
    });
    return;
  }

  if (isSuccessfulProductPresenceJudgment(input.request, input.result)) {
    const typedRequest = input.request as Extract<ParsedAiAbilityInput, { taskType: "product_presence_judgment" }>;
    storeAiOutputSummary({
      ...buildSummaryBase({ outputRef: input.outputRef, request: input.request, result: input.result, output: input.result.output }),
      taskType: "product_presence_judgment",
      input: typedRequest.input,
      output: input.result.output,
    });
    return;
  }

  if (isSuccessfulCommentSignalSummary(input.request, input.result)) {
    const typedRequest = input.request as Extract<ParsedAiAbilityInput, { taskType: "comment_signal_summary" }>;
    storeAiOutputSummary({
      ...buildSummaryBase({ outputRef: input.outputRef, request: input.request, result: input.result, output: input.result.output }),
      taskType: "comment_signal_summary",
      input: typedRequest.input,
      output: input.result.output,
    });
  }
}

export function recordAiOutputSummaryAlias(input: {
  aliasRef: string | null | undefined;
  sourceRef: string | null | undefined;
}): void {
  if (!input.aliasRef || !input.sourceRef || input.aliasRef === input.sourceRef) {
    return;
  }

  const summary = summaries.get(input.sourceRef);
  if (summary) {
    summaries.set(input.aliasRef, summary);
  }
}

export function resolveAiVisualTargetCandidateOutputSummary(
  ref: string | null | undefined,
): AiVisualTargetCandidateOutputSummary | null {
  if (!ref) {
    return null;
  }
  const summary = summaries.get(ref) ?? null;
  return summary?.taskType === "visual_target_candidate_analysis" ? summary : null;
}

export function resolveAiPagePreparationOutputSummary(
  ref: string | null | undefined,
): AiPagePreparationOutputSummary | null {
  if (!ref) {
    return null;
  }
  const summary = summaries.get(ref) ?? null;
  return summary?.taskType === "page_preparation_judgment" ? summary : null;
}

export function resolveAiProductPresenceOutputSummary(
  ref: string | null | undefined,
): AiProductPresenceOutputSummary | null {
  if (!ref) {
    return null;
  }
  const summary = summaries.get(ref) ?? null;
  return summary?.taskType === "product_presence_judgment" ? summary : null;
}

export function resolveAiCommentSignalOutputSummary(
  ref: string | null | undefined,
): AiCommentSignalOutputSummary | null {
  if (!ref) {
    return null;
  }
  const summary = summaries.get(ref) ?? null;
  return summary?.taskType === "comment_signal_summary" ? summary : null;
}