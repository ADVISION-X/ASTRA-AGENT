import { runPromptExchange } from "./deep-research-analysis.prompt-exchange.js";
import type { DeepResearchFinalPackage } from "./deep-research-analysis.final-package.js";
import { renderDeepResearchBusinessPptArtifactPrompt, businessPptArtifactSecretaryPrompt } from "./deep-research-analysis.ppt-artifact-prompt.js";
import {
  buildBusinessPptArtifactOutputPath,
  parseAndDownloadBusinessPptArtifact,
  type DeepResearchBusinessPptArtifactRecord,
} from "./deep-research-analysis.ppt-artifact-download.js";
import type { DeepResearchFinalReport } from "./deep-research-analysis.result.js";
import {
  type AnalysisExecutionContext,
  type AnalysisFailure,
  finishPromptFailure,
} from "./deep-research-analysis.analysis-support.js";

const buildEvidenceReferences = (input: {
  finalPackage: DeepResearchFinalPackage;
  finalReport: DeepResearchFinalReport;
}): unknown[] => {
  const references = Array.isArray(input.finalReport.references) ? input.finalReport.references : [];
  if (references.length > 0) {
    return references;
  }
  return input.finalPackage.analysisRecords.flatMap((record) => {
    const payload = record.parsedPayload;
    const evidenceReferences = payload.evidenceReferences;
    return Array.isArray(evidenceReferences) ? evidenceReferences : [];
  });
};

type DeckSuccess = {
  ok: true;
  pptxArtifact: DeepResearchBusinessPptArtifactRecord;
};

const buildBusinessDeckPromptText = (input: {
  context: AnalysisExecutionContext;
  finalPackage: DeepResearchFinalPackage;
  finalReport: DeepResearchFinalReport;
}): string => renderDeepResearchBusinessPptArtifactPrompt({
  finalPackage: input.finalPackage,
  finalReport: input.finalReport,
  evidenceReferences: buildEvidenceReferences({
    finalPackage: input.finalPackage,
    finalReport: input.finalReport,
  }),
  language: input.context.input.language,
});

const persistBusinessDeckArtifact = (input: {
  context: AnalysisExecutionContext;
  interaction: { rawResponseText: string };
  parsed: DeepResearchBusinessPptArtifactRecord;
}) => {
  const deckExport = input.context.store.saveExport({
    jobId: input.context.jobId,
    exportKind: input.parsed.exportKind,
    filePath: input.parsed.filePath,
    fileHash: input.parsed.fileHash,
    payload: {
      jobId: input.context.jobId,
      phaseId: "DECK_PPT_PERSIST",
      promptId: businessPptArtifactSecretaryPrompt.promptId,
      promptVersion: businessPptArtifactSecretaryPrompt.promptVersion,
      rawAssistantText: input.interaction.rawResponseText,
      artifactName: input.parsed.artifactName,
      artifactMimeType: input.parsed.artifactMimeType,
      filePath: input.parsed.filePath,
      fileHash: input.parsed.fileHash,
      fileSizeBytes: input.parsed.fileSizeBytes,
      downloadedAt: input.parsed.downloadedAt,
      exportKind: input.parsed.exportKind,
      status: input.parsed.status,
    },
  });
  input.context.recordHashes.deckAiPptxHash = input.parsed.fileHash;
  input.context.recordHashes.deckAiPptxExportHash = deckExport.fileHash;
  return {
    recordType: "business-deck.ai-pptx",
    recordId: deckExport.id,
    count: 1,
  };
};

export const runBusinessDeckPhase = async (
  context: AnalysisExecutionContext,
  finalPackage: DeepResearchFinalPackage,
  finalReport: DeepResearchFinalReport,
): Promise<DeckSuccess | AnalysisFailure> => {
  const outputPath = buildBusinessPptArtifactOutputPath(context.dataDir, context.jobId);
  const result = await runPromptExchange<DeepResearchBusinessPptArtifactRecord>({
    store: context.store,
    runtimeLogger: context.runtimeLogger,
    traceContext: context.traceContext,
    stageLogger: context.stageLogger,
    sender: context.sender,
    recordHashes: context.recordHashes,
    jobId: context.jobId,
    providerKind: context.providerKind,
    prompt: businessPptArtifactSecretaryPrompt,
    promptKey: "business-ppt-artifact",
    renderedPromptText: buildBusinessDeckPromptText({
      context,
      finalPackage,
      finalReport,
    }),
    inputRefs: [
      `job:${context.jobId}:final-package`,
      `job:${context.jobId}:final-report`,
    ],
    timeoutMs: 1_800_000,
    maxInputChars: Number.MAX_SAFE_INTEGER,
    stages: {
      send: "DECK_PPT_SEND",
      capture: "DECK_PPT_CAPTURE",
      parse: "DECK_PPT_ARTIFACT_DETECT",
      persist: "DECK_PPT_PERSIST",
    },
    parse: (rawText) => parseAndDownloadBusinessPptArtifact({ rawText, outputPath }),
    successRecordCount: () => 1,
    persist: ({ interaction, parsed }) => persistBusinessDeckArtifact({
      context,
      interaction,
      parsed,
    }),
  });
  if (result.status !== "parsed") {
    return finishPromptFailure(context, result);
  }
  return {
    ok: true,
    pptxArtifact: result.parsed,
  };
};
