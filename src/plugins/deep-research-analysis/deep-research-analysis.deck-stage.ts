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
    renderedPromptText: renderDeepResearchBusinessPptArtifactPrompt({
      finalPackage,
      finalReport,
      evidenceReferences: buildEvidenceReferences({ finalPackage, finalReport }),
      language: context.input.language,
    }),
    inputRefs: [
      `job:${context.jobId}:final-package`,
      `job:${context.jobId}:final-report`,
    ],
    maxInputChars: Number.MAX_SAFE_INTEGER,
    stages: {
      send: "DECK_PPT_SEND",
      capture: "DECK_PPT_CAPTURE",
      parse: "DECK_PPT_ARTIFACT_DETECT",
      persist: "DECK_PPT_PERSIST",
    },
    parse: (rawText) => parseAndDownloadBusinessPptArtifact({ rawText, outputPath }),
    successRecordCount: () => 1,
    persist: ({ interaction, parsed }) => {
      const deckExport = context.store.saveExport({
        jobId: context.jobId,
        exportKind: parsed.exportKind,
        filePath: parsed.filePath,
        fileHash: parsed.fileHash,
        payload: {
          jobId: context.jobId,
          phaseId: "DECK_PPT_PERSIST",
          promptId: businessPptArtifactSecretaryPrompt.promptId,
          promptVersion: businessPptArtifactSecretaryPrompt.promptVersion,
          rawAssistantText: interaction.rawResponseText,
          artifactName: parsed.artifactName,
          artifactMimeType: parsed.artifactMimeType,
          filePath: parsed.filePath,
          fileHash: parsed.fileHash,
          fileSizeBytes: parsed.fileSizeBytes,
          downloadedAt: parsed.downloadedAt,
          exportKind: parsed.exportKind,
          status: parsed.status,
        },
      });
      context.recordHashes.deckAiPptxHash = parsed.fileHash;
      context.recordHashes.deckAiPptxExportHash = deckExport.fileHash;
      return {
        recordType: "business-deck.ai-pptx",
        recordId: deckExport.id,
        count: 1,
      };
    },
  });
  if (result.status !== "parsed") {
    return finishPromptFailure(context, result);
  }
  return {
    ok: true,
    pptxArtifact: result.parsed,
  };
};
