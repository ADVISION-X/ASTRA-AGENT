import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { stableJsonHash } from "../../lib/storage/hash.js";
import {
    type AnalysisExecutionContext,
    type AnalysisFailure,
    finishPromptFailure,
} from "./deep-research-analysis.analysis-runner.js";
import type { DeepResearchFullCaseFile } from "./deep-research-analysis.full-case-file.js";
import { buildDeepResearchFullCaseFile, saveFullCaseFileExports } from "./deep-research-analysis.full-case-file.js";
import {
    buildFailure,
    buildParsedResult,
    type DeepResearchParserResult,
} from "./deep-research-analysis.parser-support.js";
import type { DeepResearchFinalAdjudicationRecord } from "./deep-research-analysis.parser.js";
import { runPromptExchange } from "./deep-research-analysis.prompt-exchange.js";
import {
    buildBusinessHtmlReportShellPrompt,
    DEEP_RESEARCH_BUSINESS_HTML_REPORT_PROMPT_ID,
    DEEP_RESEARCH_BUSINESS_HTML_REPORT_PROMPT_VERSION,
    renderDeepResearchBusinessHtmlReportPrompt,
} from "./deep-research-analysis.prompts.js";
import type {
    DeepResearchRecordStore,
    ResearchAnswer,
    ResearchExport,
    ResearchFinalAdjudicationRecord,
    ResearchInteraction,
    ResearchSubQuestion,
} from "./deep-research-analysis.records.js";
import type { DeepResearchStructuredIndex } from "./deep-research-analysis.structured-index.js";

export const DEEP_RESEARCH_BUSINESS_HTML_REPORT_EXPORT_KIND =
  "business-report.html" as const;

export const DEEP_RESEARCH_BUSINESS_HTML_MIME_TYPE = "text/html" as const;

export type DeepResearchBusinessHtmlSourceKind = "html_artifact";

export type DeepResearchBusinessHtmlReportRecord = {
  artifactName: string;
  artifactMimeType: typeof DEEP_RESEARCH_BUSINESS_HTML_MIME_TYPE;
  filePath: string;
  fileHash: string;
  fileSizeBytes: number;
  generatedAt: string;
  status: "business_html_report_generated";
  exportKind: typeof DEEP_RESEARCH_BUSINESS_HTML_REPORT_EXPORT_KIND;
  sourceKind: DeepResearchBusinessHtmlSourceKind;
};

const buildHtmlTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

const isBusinessHtmlArtifactText = (value: string): boolean => {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  return trimmed.length > 0
    && (lower.includes("<!doctype html") || lower.includes("<html"))
    && lower.includes("<body")
    && (lower.includes("</html>") || lower.includes("</body>"));
};

const persistBusinessHtmlArtifact = (input: {
  htmlDocument: string;
  outputPath: string;
}): DeepResearchBusinessHtmlReportRecord => {
  mkdirSync(path.dirname(input.outputPath), { recursive: true });
  writeFileSync(input.outputPath, input.htmlDocument, "utf8");
  const bytes = Buffer.from(input.htmlDocument, "utf8");
  return {
    artifactName: path.basename(input.outputPath),
    artifactMimeType: DEEP_RESEARCH_BUSINESS_HTML_MIME_TYPE,
    filePath: input.outputPath,
    fileHash: buildHtmlTextHash(input.htmlDocument),
    fileSizeBytes: bytes.byteLength,
    generatedAt: new Date().toISOString(),
    status: "business_html_report_generated",
    exportKind: DEEP_RESEARCH_BUSINESS_HTML_REPORT_EXPORT_KIND,
    sourceKind: "html_artifact",
  };
};

export const buildBusinessHtmlReportOutputPath = (
  dataDir: string,
  jobId: string,
): string => path.join(
  dataDir,
  "deep-research-analysis",
  "exports",
  jobId,
  "business-report.html",
);

export const parseAndPersistBusinessHtmlReport = (input: {
  rawText: string;
  outputPath: string;
}): DeepResearchParserResult<DeepResearchBusinessHtmlReportRecord> => {
  const normalizedText = input.rawText.trim();
  const rawResponseHash = buildHtmlTextHash(normalizedText);
  if (!isBusinessHtmlArtifactText(normalizedText)) {
    return buildFailure(
      normalizedText,
      rawResponseHash,
      "business_html_document_missing",
      "partial_review_required",
    );
  }
  try {
    return buildParsedResult({
      parsed: persistBusinessHtmlArtifact({
        htmlDocument: normalizedText,
        outputPath: input.outputPath,
      }),
      normalizedText,
      rawResponseHash,
    });
  } catch (error) {
    return buildFailure(
      normalizedText,
      rawResponseHash,
      error instanceof Error ? error.message : "business_html_persist_failed",
      "partial_review_required",
    );
  }
};

type HtmlReportSuccess = {
  ok: true;
  htmlReport: DeepResearchBusinessHtmlReportRecord;
};

const buildBusinessHtmlPromptText = (input: {
  context: AnalysisExecutionContext;
  finalAdjudication: DeepResearchFinalAdjudicationRecord;
  fullCaseFile: DeepResearchFullCaseFile;
  fullCaseFileMarkdown: string;
}): string => renderDeepResearchBusinessHtmlReportPrompt({
  finalAdjudication: input.finalAdjudication,
  fullCaseFile: input.fullCaseFile,
  fullCaseFileMarkdown: input.fullCaseFileMarkdown,
  htmlReportPromptBundle: input.fullCaseFile.researchPlan.htmlReportPromptBundle,
  language: input.context.input.language,
});

const persistBusinessHtmlReport = (input: {
  context: AnalysisExecutionContext;
  interaction: { rawResponseText: string };
  parsed: DeepResearchBusinessHtmlReportRecord;
}) => {
  const exportRecord = input.context.store.saveExport({
    jobId: input.context.jobId,
    exportKind: input.parsed.exportKind,
    filePath: input.parsed.filePath,
    fileHash: input.parsed.fileHash,
    payload: {
      jobId: input.context.jobId,
      phaseId: "HTML_REPORT_PERSIST",
      promptId: DEEP_RESEARCH_BUSINESS_HTML_REPORT_PROMPT_ID,
      promptVersion: DEEP_RESEARCH_BUSINESS_HTML_REPORT_PROMPT_VERSION,
      rawAssistantText: input.interaction.rawResponseText,
      artifactName: input.parsed.artifactName,
      artifactMimeType: input.parsed.artifactMimeType,
      filePath: input.parsed.filePath,
      fileHash: input.parsed.fileHash,
      fileSizeBytes: input.parsed.fileSizeBytes,
      generatedAt: input.parsed.generatedAt,
      exportKind: input.parsed.exportKind,
      status: input.parsed.status,
      sourceKind: input.parsed.sourceKind,
    },
  });
  input.context.recordHashes.businessHtmlReportHash = input.parsed.fileHash;
  input.context.recordHashes.businessHtmlReportExportHash = exportRecord.fileHash;
  return {
    recordType: "business-report.html",
    recordId: exportRecord.id,
    count: 1,
  };
};

export const runBusinessHtmlReportPhase = async (
  context: AnalysisExecutionContext,
  finalPackage: DeepResearchStructuredIndex,
  finalAdjudication: DeepResearchFinalAdjudicationRecord,
  fullCaseFile: DeepResearchFullCaseFile,
  fullCaseFileMarkdown: string,
): Promise<HtmlReportSuccess | AnalysisFailure> => {
  const outputPath = buildBusinessHtmlReportOutputPath(context.dataDir, context.jobId);
  const result = await runPromptExchange<DeepResearchBusinessHtmlReportRecord>({
    store: context.store,
    runtimeLogger: context.runtimeLogger,
    traceContext: context.traceContext,
    stageLogger: context.stageLogger,
    sender: context.sender,
    recordHashes: context.recordHashes,
    jobId: context.jobId,
    providerKind: context.providerKind,
    prompt: buildBusinessHtmlReportShellPrompt(),
    promptKey: "business-html-report",
    renderedPromptText: buildBusinessHtmlPromptText({
      context,
      finalAdjudication,
      fullCaseFile,
      fullCaseFileMarkdown,
    }),
    inputRefs: [
      `job:${context.jobId}:structured-index`,
      `job:${context.jobId}:final-adjudication-raw`,
      `job:${context.jobId}:full-case-file`,
    ],
    timeoutMs: 1_800_000,
    maxInputChars: Number.MAX_SAFE_INTEGER,
    stages: {
      send: "HTML_REPORT_SEND",
      capture: "HTML_REPORT_CAPTURE",
      parse: "HTML_REPORT_DETECT",
      persist: "HTML_REPORT_PERSIST",
    },
    parse: (rawText: string) => parseAndPersistBusinessHtmlReport({
      rawText,
      outputPath,
    }),
    successRecordCount: () => 1,
    persist: ({ interaction, parsed }: {
      interaction: { rawResponseText: string };
      parsed: DeepResearchBusinessHtmlReportRecord;
    }) => persistBusinessHtmlReport({
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
    htmlReport: result.parsed,
  };
};

export const FINAL_ADJUDICATION_RAW_EXPORT_KIND = "final-adjudication-raw.md" as const;
export const STRUCTURED_INDEX_EXPORT_KIND = "structured-index.json" as const;
export const EVIDENCE_INDEX_EXPORT_KIND = "evidence-index.json" as const;

type DeepResearchEvidenceIndexEntry = {
  interactionId: string;
  phase: ResearchInteraction["phase"];
  promptHash: string;
  rawResponseHash: string;
  parsedRecordId: string;
  domRef: string | null;
};

type DeepResearchExportArtifacts = {
  finalAdjudicationRaw: ResearchExport;
  fullCaseFileJson: ResearchExport;
  fullCaseFileMarkdown: ResearchExport;
  structuredIndex: ResearchExport;
  businessHtmlReport: ResearchExport;
  evidenceIndex: ResearchExport;
  exportDir: string;
  status: "completed";
  failureReason: null;
};

type DeepResearchExportState = {
  exportDir: string;
  fullCaseFile: DeepResearchFullCaseFile;
  finalAdjudicationRecord: ResearchFinalAdjudicationRecord;
  businessHtmlExport: ResearchExport;
  evidenceIndex: DeepResearchEvidenceIndexEntry[];
};

type DeepResearchExportFiles = {
  finalAdjudicationRawArtifact: { filePath: string; fileHash: string };
  structuredIndexArtifact: { filePath: string; fileHash: string };
  evidenceIndexArtifact: { filePath: string; fileHash: string };
  fullCaseFileExports: ReturnType<typeof saveFullCaseFileExports>;
};

const buildTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

const buildExportDir = (dataDir: string, jobId: string): string =>
  path.join(dataDir, "deep-research-analysis", "exports", jobId);

const renderFinalAdjudicationMarkdown = (
  finalAdjudication: DeepResearchFinalAdjudicationRecord,
): string => `${finalAdjudication.rawFinalAnswerText.trimEnd()}\n`;

const writeTextArtifact = (filePath: string, text: string): { filePath: string; fileHash: string } => {
  const fileHash = buildTextHash(text);
  writeFileSync(filePath, `${text.trimEnd()}\n`, "utf8");
  return { filePath, fileHash };
};

const writeJsonArtifact = <TPayload>(filePath: string, payload: TPayload): { filePath: string; fileHash: string } => {
  const fileHash = stableJsonHash(payload);
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return { filePath, fileHash };
};

const requireFinalAdjudicationRecord = (
  store: DeepResearchRecordStore,
  jobId: string,
): ResearchFinalAdjudicationRecord => {
  const finalAdjudicationRecord = store.getLatestFinalAdjudication(jobId);
  if (!finalAdjudicationRecord) {
    throw new Error("Deep Research final adjudication record is missing.");
  }
  return finalAdjudicationRecord;
};

const requireBusinessHtmlExport = (
  store: DeepResearchRecordStore,
  jobId: string,
): ResearchExport => {
  const businessHtmlExport = store.listExports(jobId)
    .find((record) => record.exportKind === "business-report.html") ?? null;
  if (!businessHtmlExport) {
    throw new Error("Deep Research primary business HTML report is missing.");
  }
  return businessHtmlExport;
};

const buildEvidenceIndexEntries = (input: {
  interactions: readonly ResearchInteraction[];
  subQuestions: readonly ResearchSubQuestion[];
  answers: readonly ResearchAnswer[];
  finalAdjudicationRecord: ResearchFinalAdjudicationRecord;
  businessHtmlExport: ResearchExport | null;
}): DeepResearchEvidenceIndexEntry[] => {
  const entries: DeepResearchEvidenceIndexEntry[] = [];
  input.interactions.forEach((interaction) => {
    const base = {
      interactionId: interaction.id,
      phase: interaction.phase,
      promptHash: interaction.promptHash,
      rawResponseHash: interaction.rawResponseHash,
      domRef: interaction.domRef,
    };
    if (interaction.phase === "decomposition") {
      input.subQuestions
        .filter((record) => record.interactionId === interaction.id)
        .forEach((record) => entries.push({ ...base, parsedRecordId: record.id }));
      return;
    }
    if (interaction.phase === "analysis") {
      input.answers
        .filter((record) => record.interactionId === interaction.id)
        .forEach((record) => entries.push({ ...base, parsedRecordId: record.id }));
      return;
    }
    if (
      interaction.phase === "final_adjudication"
      && input.finalAdjudicationRecord.interactionId === interaction.id
    ) {
      entries.push({ ...base, parsedRecordId: input.finalAdjudicationRecord.id });
      return;
    }
    if (interaction.phase === "html_report" && input.businessHtmlExport) {
      entries.push({ ...base, parsedRecordId: input.businessHtmlExport.id });
    }
  });
  return entries;
};

const resolveExportState = (input: {
  dataDir: string;
  store: DeepResearchRecordStore;
  jobId: string;
  structuredIndex: DeepResearchStructuredIndex;
  fullCaseFile?: DeepResearchFullCaseFile;
}): DeepResearchExportState => {
  const exportDir = buildExportDir(input.dataDir, input.jobId);
  mkdirSync(exportDir, { recursive: true });
  const fullCaseFile = input.fullCaseFile ?? buildDeepResearchFullCaseFile({
    store: input.store,
    jobId: input.jobId,
    structuredIndex: input.structuredIndex,
  });
  const finalAdjudicationRecord = requireFinalAdjudicationRecord(input.store, input.jobId);
  const businessHtmlExport = requireBusinessHtmlExport(input.store, input.jobId);
  const evidenceIndex = buildEvidenceIndexEntries({
    interactions: input.store.listInteractions(input.jobId),
    subQuestions: input.store.listSubQuestions(input.jobId),
    answers: input.store.listAnswers({ jobId: input.jobId }),
    finalAdjudicationRecord,
    businessHtmlExport,
  });
  return {
    exportDir,
    fullCaseFile,
    finalAdjudicationRecord,
    businessHtmlExport,
    evidenceIndex,
  };
};

const writeExportFiles = (input: {
  state: DeepResearchExportState;
  store: DeepResearchRecordStore;
  jobId: string;
  structuredIndex: DeepResearchStructuredIndex;
  finalAdjudication: DeepResearchFinalAdjudicationRecord;
}): DeepResearchExportFiles => ({
  finalAdjudicationRawArtifact: writeTextArtifact(
    path.join(input.state.exportDir, FINAL_ADJUDICATION_RAW_EXPORT_KIND),
    renderFinalAdjudicationMarkdown(input.finalAdjudication),
  ),
  structuredIndexArtifact: writeJsonArtifact(
    path.join(input.state.exportDir, STRUCTURED_INDEX_EXPORT_KIND),
    input.structuredIndex,
  ),
  evidenceIndexArtifact: writeJsonArtifact(
    path.join(input.state.exportDir, EVIDENCE_INDEX_EXPORT_KIND),
    input.state.evidenceIndex,
  ),
  fullCaseFileExports: saveFullCaseFileExports({
    store: input.store,
    jobId: input.jobId,
    exportDir: input.state.exportDir,
    fullCaseFile: input.state.fullCaseFile,
  }),
});

const persistExportRecords = (input: {
  store: DeepResearchRecordStore;
  jobId: string;
  structuredIndex: DeepResearchStructuredIndex;
  finalAdjudication: DeepResearchFinalAdjudicationRecord;
  state: DeepResearchExportState;
  files: DeepResearchExportFiles;
}): DeepResearchExportArtifacts => ({
  finalAdjudicationRaw: input.store.saveExport({
    jobId: input.jobId,
    exportKind: FINAL_ADJUDICATION_RAW_EXPORT_KIND,
    filePath: input.files.finalAdjudicationRawArtifact.filePath,
    fileHash: input.files.finalAdjudicationRawArtifact.fileHash,
    payload: input.finalAdjudication,
  }),
  fullCaseFileJson: input.files.fullCaseFileExports.fullCaseFileJson,
  fullCaseFileMarkdown: input.files.fullCaseFileExports.fullCaseFileMarkdown,
  structuredIndex: input.store.saveExport({
    jobId: input.jobId,
    exportKind: STRUCTURED_INDEX_EXPORT_KIND,
    filePath: input.files.structuredIndexArtifact.filePath,
    fileHash: input.files.structuredIndexArtifact.fileHash,
    payload: input.structuredIndex,
  }),
  businessHtmlReport: input.state.businessHtmlExport,
  evidenceIndex: input.store.saveExport({
    jobId: input.jobId,
    exportKind: EVIDENCE_INDEX_EXPORT_KIND,
    filePath: input.files.evidenceIndexArtifact.filePath,
    fileHash: input.files.evidenceIndexArtifact.fileHash,
    payload: input.state.evidenceIndex,
  }),
  exportDir: input.state.exportDir,
  status: "completed",
  failureReason: null,
});

export const exportDeepResearchArtifacts = async (input: {
  dataDir: string;
  store: DeepResearchRecordStore;
  jobId: string;
  structuredIndex: DeepResearchStructuredIndex;
  fullCaseFile?: DeepResearchFullCaseFile;
  finalAdjudication: DeepResearchFinalAdjudicationRecord;
}): Promise<DeepResearchExportArtifacts> => {
  const state = resolveExportState(input);
  const files = writeExportFiles({
    state,
    store: input.store,
    jobId: input.jobId,
    structuredIndex: input.structuredIndex,
    finalAdjudication: input.finalAdjudication,
  });
  return persistExportRecords({
    store: input.store,
    jobId: input.jobId,
    structuredIndex: input.structuredIndex,
    finalAdjudication: input.finalAdjudication,
    state,
    files,
  });
};
