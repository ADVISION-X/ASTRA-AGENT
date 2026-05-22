import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { stableJsonHash } from "../../lib/storage/hash.js";
import type {
  DeepResearchFinalReport,
} from "./deep-research-analysis.result.js";
import type {
  DeepResearchFinalPackage,
} from "./deep-research-analysis.final-package.js";
import type {
  DeepResearchRecordStore,
  ResearchExport,
  ResearchFinalReportRecord,
  ResearchInteraction,
  ResearchSubQuestion,
  ResearchAnswer,
} from "./deep-research-analysis.records.js";

type DeepResearchEvidenceIndexEntry = {
  interactionId: string;
  phase: ResearchInteraction["phase"];
  promptHash: string;
  rawResponseHash: string;
  parsedRecordId: string;
  domRef: string | null;
};

export type DeepResearchExportArtifacts = {
  finalReportMarkdown: ResearchExport;
  researchBundle: ResearchExport;
  evidenceIndex: ResearchExport;
  exportDir: string;
};

const buildTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

const buildExportDir = (dataDir: string, jobId: string): string =>
  path.join(dataDir, "deep-research-analysis", "exports", jobId);

const buildMarkdownList = (items: readonly string[]): string =>
  items.map((item) => `- ${item}`).join("\n");

const buildConflictMatrixSection = (rows: DeepResearchFinalReport["conflictMatrix"]): string => {
  const header = "| Sub-question | Positive claim | Falsification | Conflict | Evidence gap | Human review |\n| --- | --- | --- | --- | --- | --- |";
  const body = rows.map((row) =>
    `| ${row.subQuestionId} | ${row.positiveClaimSummary} | ${row.falsificationSummary} | ${row.conflictLevel} | ${row.evidenceGap} | ${row.needsHumanReview ? "yes" : "no"} |`,
  ).join("\n");
  return `${header}\n${body}`;
};

const buildFinalReportMarkdown = (input: {
  finalReport: DeepResearchFinalReport;
  finalPackage: DeepResearchFinalPackage;
}): string => [
  "# Deep Research Final Report",
  "",
  "## User Question",
  input.finalPackage.userQuestion,
  "",
  "## Final Conclusion",
  input.finalReport.executiveConclusion,
  "",
  `Confidence: ${input.finalReport.confidence}`,
  "",
  "## Positive Reasons",
  buildMarkdownList(input.finalReport.positiveReasons),
  "",
  "## Strongest Opposing Arguments",
  buildMarkdownList(input.finalReport.strongestOpposingArguments),
  "",
  "## Conflict Matrix",
  buildConflictMatrixSection(input.finalReport.conflictMatrix),
  "",
  "## Evidence Gaps",
  buildMarkdownList(input.finalReport.evidenceGaps),
  "",
  "## Reverse Conditions",
  buildMarkdownList(input.finalReport.reverseConditions),
  "",
  "## Follow-up Signals",
  buildMarkdownList(input.finalReport.followUpSignals),
  "",
  "## Limitations",
  buildMarkdownList(input.finalReport.limitations),
  "",
].join("\n");

const buildEvidenceIndexEntries = (input: {
  interactions: readonly ResearchInteraction[];
  subQuestions: readonly ResearchSubQuestion[];
  answers: readonly ResearchAnswer[];
  finalReportRecord: ResearchFinalReportRecord;
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
    if (interaction.phase === "positive" || interaction.phase === "falsification") {
      input.answers
        .filter((record) => record.interactionId === interaction.id)
        .forEach((record) => entries.push({ ...base, parsedRecordId: record.id }));
      return;
    }
    if (interaction.phase === "final_synthesis" && input.finalReportRecord.interactionId === interaction.id) {
      entries.push({ ...base, parsedRecordId: input.finalReportRecord.id });
    }
  });
  return entries;
};

export const exportDeepResearchArtifacts = (input: {
  dataDir: string;
  store: DeepResearchRecordStore;
  jobId: string;
  finalPackage: DeepResearchFinalPackage;
  finalReport: DeepResearchFinalReport;
}): DeepResearchExportArtifacts => {
  const exportDir = buildExportDir(input.dataDir, input.jobId);
  mkdirSync(exportDir, { recursive: true });

  const finalReportRecord = input.store.getLatestFinalReport(input.jobId);
  if (!finalReportRecord) {
    throw new Error(`Deep research job ${input.jobId} has no persisted final report.`);
  }

  const interactions = input.store.listInteractions(input.jobId);
  const subQuestions = input.store.listSubQuestions(input.jobId);
  const answers = input.store.listAnswers({ jobId: input.jobId });

  const finalReportMarkdownText = buildFinalReportMarkdown({
    finalReport: input.finalReport,
    finalPackage: input.finalPackage,
  });
  const finalReportPath = path.join(exportDir, "final-report.md");
  const finalReportHash = buildTextHash(finalReportMarkdownText);
  writeFileSync(finalReportPath, `${finalReportMarkdownText.trimEnd()}\n`, "utf8");

  const researchBundle = {
    jobId: input.finalPackage.jobId,
    userQuestion: input.finalPackage.userQuestion,
    promptVersions: input.finalPackage.promptVersions,
    subQuestions: input.finalPackage.decompositionRecords,
    positiveAnswers: input.finalPackage.positiveAnswerRecords,
    falsificationAnswers: input.finalPackage.falsificationAnswerRecords,
    conflictMatrix: input.finalPackage.conflictMatrix,
    finalReport: input.finalReport,
    recordHashes: input.finalPackage.recordHashes,
  };
  const researchBundlePath = path.join(exportDir, "research-bundle.json");
  const researchBundleHash = stableJsonHash(researchBundle);
  writeFileSync(researchBundlePath, `${JSON.stringify(researchBundle, null, 2)}\n`, "utf8");

  const evidenceIndex = buildEvidenceIndexEntries({
    interactions,
    subQuestions,
    answers,
    finalReportRecord,
  });
  const evidenceIndexPath = path.join(exportDir, "evidence-index.json");
  const evidenceIndexHash = stableJsonHash(evidenceIndex);
  writeFileSync(evidenceIndexPath, `${JSON.stringify(evidenceIndex, null, 2)}\n`, "utf8");

  return {
    finalReportMarkdown: input.store.saveExport({
      jobId: input.jobId,
      exportKind: "final-report.md",
      filePath: finalReportPath,
      fileHash: finalReportHash,
      payload: { finalReportHash, content: finalReportMarkdownText },
    }),
    researchBundle: input.store.saveExport({
      jobId: input.jobId,
      exportKind: "research-bundle.json",
      filePath: researchBundlePath,
      fileHash: researchBundleHash,
      payload: researchBundle,
    }),
    evidenceIndex: input.store.saveExport({
      jobId: input.jobId,
      exportKind: "evidence-index.json",
      filePath: evidenceIndexPath,
      fileHash: evidenceIndexHash,
      payload: evidenceIndex,
    }),
    exportDir,
  };
};