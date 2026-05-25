import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  buildDeepResearchFinalPackage,
  buildDeepResearchFullCaseFile,
  createDeepResearchRecordStore,
  renderDeepResearchFullCaseFileMarkdown,
} from "../../src/plugins/deep-research-analysis/acceptance-surface.js";
import { renderDeepResearchFinalAdjudicationPrompt } from "../../src/plugins/deep-research-analysis/deep-research-analysis.prompts.js";
import type { DeepResearchResult } from "../../src/plugins/deep-research-analysis/deep-research-analysis.result.js";

const REQUIRED_STAGE_NAMES = [
  "DECOMPOSE_SEND",
  "DECOMPOSE_CAPTURE",
  "DECOMPOSE_PARSE",
  "DECOMPOSE_PERSIST",
  "ANALYSIS_SEND",
  "ANALYSIS_CAPTURE",
  "ANALYSIS_PARSE",
  "ANALYSIS_PERSIST",
  "FINAL_PACKAGE_BUILD",
  "FINAL_ADJUDICATION_SEND",
  "FINAL_ADJUDICATION_CAPTURE",
  "FINAL_ADJUDICATION_PARSE",
  "FINAL_ADJUDICATION_PERSIST",
  "HTML_REPORT_SEND",
  "HTML_REPORT_CAPTURE",
  "HTML_REPORT_DETECT",
  "HTML_REPORT_PERSIST",
  "EXPORT_REPORT",
] as const;

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const parseJsonFile = <T>(filePath: string): T => JSON.parse(readFileSync(filePath, "utf8")) as T;

export const verifyRuntimeLogCoverage = (bundlePath: string): void => {
  assert(existsSync(bundlePath), `Runtime log bundle not found: ${bundlePath}`);
  const lines = readFileSync(bundlePath, "utf8").trim().split("\n").filter(Boolean);
  const events = lines.map((line) => JSON.parse(line) as {
    eventType: string;
    payload?: { stageName?: string };
  });
  assert(events.some((event) => event.eventType === "DEEP_RESEARCH_JOB_STARTED"), "Missing DEEP_RESEARCH_JOB_STARTED event.");
  assert(events.some((event) => event.eventType === "DEEP_RESEARCH_EXPORT_COMPLETED"), "Missing DEEP_RESEARCH_EXPORT_COMPLETED event.");
  assert(events.some((event) => event.eventType === "DEEP_RESEARCH_JOB_COMPLETED"), "Missing DEEP_RESEARCH_JOB_COMPLETED event.");
  for (const stageName of REQUIRED_STAGE_NAMES) {
    const started = events.some((event) => event.eventType === "RUNTIME_STAGE_STARTED" && event.payload?.stageName === stageName);
    const terminal = events.some((event) =>
      (event.eventType === "RUNTIME_STAGE_COMPLETED"
        || event.eventType === "RUNTIME_STAGE_FAILED"
        || event.eventType === "RUNTIME_STAGE_REVIEW_REQUIRED")
      && event.payload?.stageName === stageName,
    );
    assert(started, `Missing stage start log for ${stageName}.`);
    assert(terminal, `Missing terminal stage log for ${stageName}.`);
  }
};

const verifyPersistedJobCore = (
  store: ReturnType<typeof createDeepResearchRecordStore>,
  result: DeepResearchResult,
): {
  job: ReturnType<ReturnType<typeof createDeepResearchRecordStore>["getJob"]>;
} => {
  const job = store.getJob(result.jobId);
  assert(job?.status === "completed", "Persisted research job should be completed.");

  const subQuestions = store.listSubQuestions(result.jobId);
  assert(subQuestions.length === 2, `Expected 2 sub-questions, received ${subQuestions.length}.`);
  assert(subQuestions[0]?.id !== subQuestions[0]?.modelQuestionId, "Database sub-question ID must differ from modelQuestionId.");
  assert(subQuestions[0]?.modelQuestionId === "Q1", "Persisted Q1 must preserve modelQuestionId.");
  assert(subQuestions[0]?.question.id === "Q1", "Persisted display question ID must remain Q1.");

  const interactions = store.listInteractions(result.jobId);
  assert(interactions.length === 5, `Expected 5 persisted interactions, received ${interactions.length}.`);
  interactions.forEach((interaction) => {
    assert(Boolean(interaction.promptHash), `Interaction ${interaction.id} is missing promptHash.`);
    assert(Boolean(interaction.rawResponseHash), `Interaction ${interaction.id} is missing rawResponseHash.`);
    assert(Boolean(interaction.parseStatus), `Interaction ${interaction.id} is missing parseStatus.`);
  });

  const analysisAnswers = store.listAnswers({ jobId: result.jobId, answerKind: "analysis" });
  assert(analysisAnswers.length === 2, `Expected 2 analysis answers, received ${analysisAnswers.length}.`);
  assert(store.getLatestFinalReport(result.jobId) !== null, "Expected a persisted final report record.");
  return { job };
};

const verifyPersistedFinalPackage = (input: {
  store: ReturnType<typeof createDeepResearchRecordStore>;
  jobId: string;
  job: ReturnType<ReturnType<typeof createDeepResearchRecordStore>["getJob"]>;
}): void => {
  const finalPackage = buildDeepResearchFinalPackage({ store: input.store, jobId: input.jobId });
  const fullCaseFile = buildDeepResearchFullCaseFile({
    store: input.store,
    jobId: input.jobId,
    structuredFinalPackage: finalPackage,
  });
  assert(finalPackage.analysisRecords.length === 2, "Final package must read persisted analysis records.");
  assert(finalPackage.missingAnalysisSubQuestionIds.length === 0, "Final package should have no missing analysis records in the smoke fixture.");
  assert(finalPackage.analysisCoverage.missingAnalysisSubQuestionCount === 0, "Final package should report zero missing analysis rows in the smoke fixture.");
  assert(fullCaseFile.caseFileVersion === "v1", "Full case file must be built for the smoke fixture.");
  assert(fullCaseFile.coverage.rawAnalysisInteractionCount === 2, "Full case file must preserve raw coverage for each sub-question.");
  assert(finalPackage.outputContract.contractId === "deep-research.final-adjudication.json.v1.1", "Smoke fixture must target the current final adjudication contract.");
  const finalPromptText = renderDeepResearchFinalAdjudicationPrompt({
    userQuestion: input.job?.userQuestion ?? "",
    analysisGoal: input.job?.analysisGoal ?? null,
    language: input.job?.language ?? "zh-CN",
    finalPackage,
    fullCaseFile,
    fullCaseFileMarkdown: renderDeepResearchFullCaseFileMarkdown(fullCaseFile),
  });
};

const verifyPersistedExports = (
  store: ReturnType<typeof createDeepResearchRecordStore>,
  jobId: string,
): void => {
  const exports = store.listExports(jobId);
  assert(exports.length === 6, `Expected 6 export records, received ${exports.length}.`);

  const finalReportExport = exports.find((record) => record.exportKind === "final-report.md");
  const fullCaseMarkdownExport = exports.find((record) => record.exportKind === "full-case-file.md");
  const fullCaseJsonExport = exports.find((record) => record.exportKind === "full-case-file.json");
  const decisionPackageExport = exports.find((record) => record.exportKind === "decision-package.json");
  const businessHtmlExport = exports.find((record) => record.exportKind === "business-report.html");
  const evidenceExport = exports.find((record) => record.exportKind === "evidence-index.json");
  if (!finalReportExport) throw new Error("Missing final-report.md export record.");
  if (!fullCaseMarkdownExport) throw new Error("Missing full-case-file.md export record.");
  if (!fullCaseJsonExport) throw new Error("Missing full-case-file.json export record.");
  if (!decisionPackageExport) throw new Error("Missing decision-package.json export record.");
  if (!businessHtmlExport) throw new Error("Missing business-report.html export record.");
  if (!evidenceExport) throw new Error("Missing evidence-index.json export record.");

  assert(existsSync(finalReportExport.filePath), "final-report.md file was not written.");
  assert(existsSync(fullCaseMarkdownExport.filePath), "full-case-file.md file was not written.");
  assert(existsSync(fullCaseJsonExport.filePath), "full-case-file.json file was not written.");
  assert(existsSync(decisionPackageExport.filePath), "decision-package.json file was not written.");
  assert(existsSync(businessHtmlExport.filePath), "business-report.html file was not written.");
  assert(existsSync(evidenceExport.filePath), "evidence-index.json file was not written.");

  const evidenceIndex = parseJsonFile<Array<{ interactionId: string; parsedRecordId?: string }>>(evidenceExport.filePath);
  assert(evidenceIndex.length >= 5, `Expected at least 5 evidence index rows, received ${evidenceIndex.length}.`);
};

export const verifyPersistedResearchState = (
  dataDir: string,
  result: DeepResearchResult,
): void => {
  const store = createDeepResearchRecordStore(dataDir);
  try {
    const { job } = verifyPersistedJobCore(store, result);
    verifyPersistedFinalPackage({ store, jobId: result.jobId, job });
    verifyPersistedExports(store, result.jobId);
  } finally {
    store.close();
  }
};

const buildModelSubQuestions = () => [
  {
    id: "Q1",
    title: "Repeated first question",
    questionText: "Can Q1 appear in another job?",
    purpose: "Prove model IDs are job-local.",
    whyItMatters: "The system must preserve model IDs without reusing database primary keys across jobs.",
    decisionWeight: "medium" as const,
    analysisFocus: "Track whether database IDs remain job-scoped.",
    requiredEvidence: ["database primary keys", "modelQuestionId field"],
    scope: "Deep Research persistence.",
    expectedAnswerShape: "identity-proof",
    priority: "medium" as const,
    omissionRisk: "Without this, two jobs can silently collide on sub-question identity.",
  },
  {
    id: "Q2",
    title: "Repeated second question",
    questionText: "Can Q2 appear in another job?",
    purpose: "Prove ordinal boundaries are job-local.",
    whyItMatters: "Ordinal and model IDs must stay stable without becoming the database primary key.",
    decisionWeight: "medium" as const,
    analysisFocus: "Verify persistence identity boundaries across jobs.",
    requiredEvidence: ["database rows", "modelQuestionId field"],
    scope: "Deep Research persistence.",
    expectedAnswerShape: "identity-proof",
    priority: "medium" as const,
    omissionRisk: "Without this, repeated model IDs can appear lawful while corrupting persistence identity.",
  },
];

export const verifySubQuestionIdsAreJobScoped = (): void => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "grasseye-deep-research-id-scope-"));
  const store = createDeepResearchRecordStore(dataDir);
  try {
    const input = {
      userQuestion: "Can repeated model question IDs persist across jobs?",
      analysisGoal: "Verify persistence identity boundaries.",
      language: "en" as const,
      maxSubQuestions: 4,
      outputFormat: "markdown" as const,
    };
    const modelSubQuestions = buildModelSubQuestions();
    const firstJob = store.createJob(input);
    const firstInteraction = store.createInteraction({
      jobId: firstJob.id,
      phase: "decomposition",
      promptId: "acceptance.identity",
      promptVersion: "v1",
      promptHash: "sha256:first-prompt",
      renderedPromptText: "identity prompt",
      rawResponseText: JSON.stringify({}),
      rawResponseHash: "sha256:first-raw",
      parseStatus: "parsed",
    });
    const firstRecords = store.saveSubQuestions({
      jobId: firstJob.id,
      interactionId: firstInteraction.id,
      subQuestions: modelSubQuestions,
    });

    const secondJob = store.createJob(input);
    const secondInteraction = store.createInteraction({
      jobId: secondJob.id,
      phase: "decomposition",
      promptId: "acceptance.identity",
      promptVersion: "v1",
      promptHash: "sha256:second-prompt",
      renderedPromptText: "identity prompt",
      rawResponseText: JSON.stringify({}),
      rawResponseHash: "sha256:second-raw",
      parseStatus: "parsed",
    });
    const secondRecords = store.saveSubQuestions({
      jobId: secondJob.id,
      interactionId: secondInteraction.id,
      subQuestions: modelSubQuestions,
    });

    assert(firstRecords[0]?.modelQuestionId === "Q1", "First job must preserve Q1 as modelQuestionId.");
    assert(secondRecords[0]?.modelQuestionId === "Q1", "Second job must preserve Q1 as modelQuestionId.");
    assert(firstRecords[0]?.id !== secondRecords[0]?.id, "Database IDs must remain job-scoped even when modelQuestionId repeats.");
  } finally {
    store.close();
  }
};
