import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { stableJsonHash } from "../../lib/storage/hash.js";
import { runPromptExchange } from "./deep-research-analysis.prompt-exchange.js";
import type { DeepResearchFinalPackage } from "./deep-research-analysis.final-package.js";
import { businessDeckSecretaryPrompt, renderDeepResearchBusinessDeckPrompt } from "./deep-research-analysis.deck-prompt.js";
import { parseDeepResearchBusinessDeckOutlineResponseForFinalReport } from "./deep-research-analysis.deck-parser.js";
import type { DeepResearchBusinessDeckOutline } from "./deep-research-analysis.deck-schema.js";
import type { DeepResearchFinalReport, DeepResearchResult } from "./deep-research-analysis.result.js";
import {
  type AnalysisExecutionContext,
  type AnalysisFailure,
  finishPromptFailure,
} from "./deep-research-analysis.analysis-support.js";

const buildExportDir = (dataDir: string, jobId: string): string =>
  path.join(dataDir, "deep-research-analysis", "exports", jobId);

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

const buildTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

const writeDeckOutlineArtifact = (input: {
  context: AnalysisExecutionContext;
  outline: DeepResearchBusinessDeckOutline;
}) => {
  const exportDir = buildExportDir(input.context.dataDir, input.context.jobId);
  mkdirSync(exportDir, { recursive: true });
  const filePath = path.join(exportDir, "business-deck-outline.json");
  const fileText = `${JSON.stringify(input.outline, null, 2)}\n`;
  writeFileSync(filePath, fileText, "utf8");
  const fileHash = buildTextHash(fileText);
  return input.context.store.saveExport({
    jobId: input.context.jobId,
    exportKind: "business-deck-outline.json",
    filePath,
    fileHash,
    payload: input.outline,
  });
};

type DeckSuccess = {
  ok: true;
  outline: DeepResearchBusinessDeckOutline;
};

export const runBusinessDeckPhase = async (
  context: AnalysisExecutionContext,
  finalPackage: DeepResearchFinalPackage,
  finalReport: DeepResearchFinalReport,
): Promise<DeckSuccess | AnalysisFailure> => {
  const result = await runPromptExchange<DeepResearchBusinessDeckOutline>({
    store: context.store,
    runtimeLogger: context.runtimeLogger,
    traceContext: context.traceContext,
    stageLogger: context.stageLogger,
    sender: context.sender,
    recordHashes: context.recordHashes,
    jobId: context.jobId,
    providerKind: context.providerKind,
    prompt: businessDeckSecretaryPrompt,
    promptKey: "business-deck",
    renderedPromptText: renderDeepResearchBusinessDeckPrompt({
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
      send: "DECK_SEND",
      capture: "DECK_CAPTURE",
      parse: "DECK_PARSE",
      persist: "DECK_PERSIST",
    },
    parse: (rawText) => parseDeepResearchBusinessDeckOutlineResponseForFinalReport({
      rawText,
      finalReport,
    }),
    successRecordCount: () => 1,
    persist: ({ parsed }) => {
      const outlineExport = writeDeckOutlineArtifact({ context, outline: parsed });
      context.recordHashes.deckOutlineHash = stableJsonHash(parsed);
      context.recordHashes.deckOutlineExportHash = outlineExport.fileHash;
      return {
        recordType: "business-deck-outline",
        recordId: outlineExport.id,
        count: 1,
      };
    },
  });
  if (result.status !== "parsed") {
    return finishPromptFailure(context, result);
  }
  return {
    ok: true,
    outline: result.parsed,
  };
};
