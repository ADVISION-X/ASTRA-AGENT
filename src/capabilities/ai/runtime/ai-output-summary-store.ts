import { createHash } from "node:crypto";

import type { AiAbilityResult, ParsedAiAbilityInput } from "../contract.js";
import type { AiOutputSummaryBase, RecordedAiOutputSummary } from "./ai-output-summary-types.js";

const summaries = new Map<string, RecordedAiOutputSummary>();

const buildOutputPayloadHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const buildCompactAiResultRef = (outputRef: string) =>
  `ai-result:${createHash("sha256").update(outputRef).digest("hex").slice(0, 24)}`;

export const storeAiOutputSummary = (summary: RecordedAiOutputSummary): void => {
  summaries.set(summary.rawAiResultRef, summary);
  summaries.set(summary.aiResultRef, summary);
};

export const aliasAiOutputSummary = (aliasRef: string, sourceRef: string): void => {
  const summary = summaries.get(sourceRef);
  if (summary) {
    summaries.set(aliasRef, summary);
  }
};

export const resolveAiOutputSummary = (ref: string): RecordedAiOutputSummary | null =>
  summaries.get(ref) ?? null;

export const buildSummaryBase = (input: {
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