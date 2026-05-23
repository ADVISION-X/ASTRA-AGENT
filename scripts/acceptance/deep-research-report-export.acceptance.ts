import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  buildDeepResearchFinalPackage,
  createDeepResearchRecordStore,
  exportDeepResearchArtifacts,
} from "../../src/plugins/deep-research-analysis/acceptance-surface.js";
import type {
  DeepResearchFinalReport,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.result.js";

type DeepResearchStore = ReturnType<typeof createDeepResearchRecordStore>;

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const countOccurrences = (source: string, needle: string): number =>
  source.split(needle).length - 1;

const buildJsonText = (value: unknown): string => JSON.stringify(value, null, 2);

const buildSubQuestionFixture = () => [
  {
    id: "Q1",
    title: "Market demand",
    questionText: "How durable is market demand over the next three years?",
    purpose: "Measure top-line demand strength.",
    scope: "Global robotics warehouse demand from 2026 to 2028.",
    expectedAnswerShape: "demand-summary",
  },
  {
    id: "Q2",
    title: "Pricing power",
    questionText: "Can the entrant preserve pricing power against incumbent vendors?",
    purpose: "Assess gross margin resilience.",
    scope: "Competitive pricing and replacement cycles.",
    expectedAnswerShape: "pricing-summary",
  },
  {
    id: "Q3",
    title: "Execution readiness",
    questionText: "What execution dependencies dominate the first twelve months?",
    purpose: "Expose rollout dependencies.",
    scope: "Implementation, integration, and service capacity.",
    expectedAnswerShape: "execution-summary",
  },
  {
    id: "Q4",
    title: "Downside triggers",
    questionText: "Which downside triggers would invalidate the entry thesis fastest?",
    purpose: "Identify hard reversal signals.",
    scope: "Commercial, operational, and partner-driven failure modes.",
    expectedAnswerShape: "downside-summary",
  },
] as const;

const buildPositiveRawResponse = (subQuestionId: string, ordinal: number) => buildJsonText({
  subQuestionId,
  answer: `Positive answer for ${subQuestionId}.`,
  keyClaims: [
    `${subQuestionId} key claim A`,
    `${subQuestionId} key claim B`,
  ],
  supportingReasons: [
    `${subQuestionId} supporting reason ${ordinal}-1`,
    `${subQuestionId} supporting reason ${ordinal}-2`,
  ],
  assumptions: [`${subQuestionId} assumption`],
  evidenceMentions: [`${subQuestionId} evidence mention`],
  confidence: ordinal % 2 === 0 ? "medium" : "high",
  limitations: [`${subQuestionId} positive limitation`],
});

const buildFalsificationRawResponse = (subQuestionId: string, ordinal: number) => buildJsonText({
  subQuestionId,
  answer: `Falsification answer for ${subQuestionId}.`,
  strongestOpposingArguments: [
    `${subQuestionId} strongest opposing argument A`,
    `${subQuestionId} strongest opposing argument B`,
  ],
  contradictionPoints: [
    `${subQuestionId} contradiction point ${ordinal}-1`,
    `${subQuestionId} contradiction point ${ordinal}-2`,
  ],
  evidenceMentions: [`${subQuestionId} falsification evidence mention`],
  confidence: ordinal % 2 === 0 ? "low" : "medium",
  limitations: [`${subQuestionId} falsification limitation`],
});

const createPromptText = (label: string): string => `${label}\nReturn a structured JSON object.`;

type ConflictRowFixture = {
  subQuestionId: string;
  positiveClaimSummary: string;
  falsificationSummary: string;
  conflictLevel: "high" | "medium";
  evidenceGap: string;
  needsHumanReview: true;
};

const createParsedInteraction = (input: {
  store: DeepResearchStore;
  jobId: string;
  phase: Parameters<DeepResearchStore["createInteraction"]>[0]["phase"];
  subQuestionId?: string;
  promptId: string;
  promptVersion: string;
  promptHash: string;
  renderedPromptText: string;
  domRef: string;
  rawResponseText: string;
  rawResponseHash: string;
  providerProofJson: string;
}) => input.store.createInteraction({
  jobId: input.jobId,
  phase: input.phase,
  ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  promptId: input.promptId,
  promptVersion: input.promptVersion,
  promptHash: input.promptHash,
  renderedPromptText: input.renderedPromptText,
  domRef: input.domRef,
  rawResponseText: input.rawResponseText,
  rawResponseHash: input.rawResponseHash,
  normalizedText: input.rawResponseText,
  parseStatus: "parsed",
  providerKind: "gemini-api",
  providerProofJson: input.providerProofJson,
});

const savePositiveAnalysis = (input: {
  store: DeepResearchStore;
  jobId: string;
  subQuestion: Awaited<ReturnType<DeepResearchStore["saveSubQuestions"]>>[number];
  ordinal: number;
}): void => {
  const rawResponseText = buildPositiveRawResponse(input.subQuestion.modelQuestionId, input.ordinal + 1);
  const interaction = createParsedInteraction({
    store: input.store,
    jobId: input.jobId,
    phase: "positive",
    subQuestionId: input.subQuestion.id,
    promptId: "deep-research.positive",
    promptVersion: "v5",
    promptHash: `sha256:positive-${input.subQuestion.modelQuestionId}-prompt`,
    renderedPromptText: createPromptText(`Positive prompt for ${input.subQuestion.modelQuestionId}.`),
    domRef: `artifact://positive/${input.subQuestion.modelQuestionId}`,
    rawResponseText,
    rawResponseHash: `sha256:positive-${input.subQuestion.modelQuestionId}-raw`,
    providerProofJson: buildJsonText({ provider: "fixture", phase: "positive", id: input.subQuestion.modelQuestionId }),
  });
  input.store.saveAnswer({
    jobId: input.jobId,
    interactionId: interaction.id,
    subQuestionId: input.subQuestion.id,
    answerKind: "positive",
    answerText: `Positive answer for ${input.subQuestion.modelQuestionId}.`,
    keyPoints: [
      `${input.subQuestion.modelQuestionId} key claim A`,
      `${input.subQuestion.modelQuestionId} key claim B`,
    ],
    evidenceMentions: [`${input.subQuestion.modelQuestionId} evidence mention`],
    assumptions: [`${input.subQuestion.modelQuestionId} assumption`],
    limitations: [`${input.subQuestion.modelQuestionId} positive limitation`],
    confidence: input.ordinal % 2 === 0 ? "high" : "medium",
  });
};

const saveFalsificationAnalysis = (input: {
  store: DeepResearchStore;
  jobId: string;
  subQuestion: Awaited<ReturnType<DeepResearchStore["saveSubQuestions"]>>[number];
  ordinal: number;
}): void => {
  const rawResponseText = buildFalsificationRawResponse(input.subQuestion.modelQuestionId, input.ordinal + 1);
  const interaction = createParsedInteraction({
    store: input.store,
    jobId: input.jobId,
    phase: "falsification",
    subQuestionId: input.subQuestion.id,
    promptId: "deep-research.falsification",
    promptVersion: "v5",
    promptHash: `sha256:falsification-${input.subQuestion.modelQuestionId}-prompt`,
    renderedPromptText: createPromptText(`Falsification prompt for ${input.subQuestion.modelQuestionId}.`),
    domRef: `artifact://falsification/${input.subQuestion.modelQuestionId}`,
    rawResponseText,
    rawResponseHash: `sha256:falsification-${input.subQuestion.modelQuestionId}-raw`,
    providerProofJson: buildJsonText({ provider: "fixture", phase: "falsification", id: input.subQuestion.modelQuestionId }),
  });
  input.store.saveAnswer({
    jobId: input.jobId,
    interactionId: interaction.id,
    subQuestionId: input.subQuestion.id,
    answerKind: "falsification",
    answerText: `Falsification answer for ${input.subQuestion.modelQuestionId}.`,
    keyPoints: [
      `${input.subQuestion.modelQuestionId} strongest opposing argument A`,
      `${input.subQuestion.modelQuestionId} strongest opposing argument B`,
    ],
    evidenceMentions: [`${input.subQuestion.modelQuestionId} falsification evidence mention`],
    limitations: [`${input.subQuestion.modelQuestionId} falsification limitation`],
    contradictionPoints: [
      `${input.subQuestion.modelQuestionId} contradiction point 1`,
      `${input.subQuestion.modelQuestionId} contradiction point 2`,
    ],
    confidence: input.ordinal % 2 === 0 ? "medium" : "low",
  });
};

const persistSubQuestionAnalysis = (
  store: DeepResearchStore,
  jobId: string,
  subQuestion: Awaited<ReturnType<DeepResearchStore["saveSubQuestions"]>>[number],
  ordinal: number,
): ConflictRowFixture => {
  savePositiveAnalysis({ store, jobId, subQuestion, ordinal });
  saveFalsificationAnalysis({ store, jobId, subQuestion, ordinal });
  return {
    subQuestionId: subQuestion.id,
    positiveClaimSummary: `${subQuestion.modelQuestionId} positive claim summary`,
    falsificationSummary: `${subQuestion.modelQuestionId} falsification summary`,
    conflictLevel: ordinal % 2 === 0 ? "high" as const : "medium" as const,
    evidenceGap: `${subQuestion.modelQuestionId} evidence gap`,
    needsHumanReview: true,
  };
};

const persistDecompositionFixture = (input: {
  store: DeepResearchStore;
  job: Awaited<ReturnType<DeepResearchStore["createJob"]>>;
  modelSubQuestions: ReturnType<typeof buildSubQuestionFixture>;
}) => {
  const rawResponseText = buildJsonText({ mainQuestion: input.job.userQuestion, subQuestions: input.modelSubQuestions });
  const interaction = createParsedInteraction({
    store: input.store,
    jobId: input.job.id,
    phase: "decomposition",
    promptId: "deep-research.decomposition",
    promptVersion: "v3",
    promptHash: "sha256:decomposition-prompt",
    renderedPromptText: createPromptText("Decomposition prompt for the main question."),
    domRef: "artifact://decomposition",
    rawResponseText,
    rawResponseHash: "sha256:decomposition-raw",
    providerProofJson: buildJsonText({ provider: "fixture", phase: "decomposition" }),
  });
  return input.store.saveSubQuestions({
    jobId: input.job.id,
    interactionId: interaction.id,
    subQuestions: input.modelSubQuestions,
  });
};

const buildFinalReportFixture = (conflictRows: readonly ConflictRowFixture[]): DeepResearchFinalReport => ({
  executiveConclusion: "The company should only enter through a staged partner-led beachhead.",
  confidence: "medium",
  positiveReasons: [
    "Demand exists in labor-constrained warehouses.",
    "Partner-led delivery can reduce time-to-value.",
  ],
  strongestOpposingArguments: [
    "Integration failure can erase ROI credibility.",
    "Pricing pressure can compress the first deployment margin.",
  ],
  conflictMatrix: [...conflictRows],
  evidenceGaps: [
    "Need live pilot conversion data.",
    "Need partner deployment benchmarks.",
  ],
  reverseConditions: [
    "If pilot conversion drops materially, reverse the thesis.",
    "If partner deployment lead time slips, reverse the thesis.",
  ],
  followUpSignals: [
    "Pilot-to-rollout conversion rate.",
    "Deployment time-to-value.",
  ],
  limitations: ["This acceptance uses persisted fixtures rather than a live provider."],
});

const persistFinalSynthesisFixture = (input: {
  store: DeepResearchStore;
  jobId: string;
  finalReport: DeepResearchFinalReport;
}): void => {
  const rawResponseText = buildJsonText(input.finalReport);
  const interaction = createParsedInteraction({
    store: input.store,
    jobId: input.jobId,
    phase: "final_synthesis",
    promptId: "deep-research.final-synthesis",
    promptVersion: "v6",
    promptHash: "sha256:final-synthesis-prompt",
    renderedPromptText: createPromptText("Final synthesis prompt for all persisted records."),
    domRef: "artifact://final-synthesis",
    rawResponseText,
    rawResponseHash: "sha256:final-synthesis-raw",
    providerProofJson: buildJsonText({ provider: "fixture", phase: "final" }),
  });
  input.store.saveFinalReport({ jobId: input.jobId, interactionId: interaction.id, report: input.finalReport });
};

const persistCompletedResearchFixture = (store: DeepResearchStore) => {
  const job = store.createJob({
    userQuestion: "Should the company enter the robotics warehouse market?",
    analysisGoal: "Produce one full-flow human-readable report for debugging and delivery.",
    language: "en",
    maxSubQuestions: 4,
    outputFormat: "markdown",
  });
  const modelSubQuestions = buildSubQuestionFixture();
  const persistedSubQuestions = persistDecompositionFixture({ store, job, modelSubQuestions });
  const conflictRows = persistedSubQuestions.map((subQuestion, ordinal) =>
    persistSubQuestionAnalysis(store, job.id, subQuestion, ordinal));
  store.saveConflictMatrixRows({ jobId: job.id, rows: conflictRows });
  const finalReport = buildFinalReportFixture(conflictRows);
  persistFinalSynthesisFixture({ store, jobId: job.id, finalReport });
  store.updateJobState({ jobId: job.id, status: "completed", phase: "EXPORT_REPORT" });
  return { job, finalReport };
};

const assertFullFlowReport = (input: {
  store: DeepResearchStore;
  job: Awaited<ReturnType<DeepResearchStore["createJob"]>>;
  reportPath: string;
}): void => {
  assert(existsSync(input.reportPath), "final-report.md was not written.");
  const reportText = readFileSync(input.reportPath, "utf8");
  input.store.listInteractions(input.job.id).forEach((interaction) => {
    assert(interaction.renderedPromptText.trim().length > 0, `Interaction ${interaction.id} is missing renderedPromptText.`);
  });
  assert(reportText.includes("# Deep Research Full Flow Report"), "Report must use the full-flow heading.");
  assert(reportText.includes(input.job.userQuestion), "Report must include the user question.");
  assert(reportText.includes("## Stage 1: Decomposition"), "Report must include the decomposition stage.");
  assert(reportText.includes("### Prompt"), "Report must include prompt sections.");
  assert(reportText.includes("### AI Raw Response"), "Report must include raw AI response sections.");
  assert(reportText.includes("### Parsed SubQuestions"), "Report must include parsed sub-question output.");
  assert(reportText.includes("## Final Synthesis"), "Report must include final synthesis.");
  assert(reportText.includes("## Conflict Matrix"), "Report must include the conflict matrix.");
  assert(reportText.includes("## Evidence Index"), "Report must include the evidence index.");
  assert(reportText.includes("sha256:decomposition-prompt"), "Report must expose promptHash values.");
  assert(reportText.includes("sha256:positive-Q1-raw"), "Report must expose rawResponseHash values.");
  assert(reportText.includes("DOM Ref: artifact://positive/Q1"), "Report must expose domRef values.");
  assert(reportText.includes("Decomposition prompt for the main question."), "Report must include persisted prompt text.");
  assert(reportText.includes("Final synthesis prompt for all persisted records."), "Report must include the final synthesis prompt text.");
  assert(reportText.includes("Positive answer for Q1."), "Report must include persisted positive content.");
  assert(reportText.includes("Falsification answer for Q4."), "Report must include persisted falsification content.");
  assert(countOccurrences(reportText, "## Sub-question Q") === 4, "Report must include four sub-question sections.");
  assert(countOccurrences(reportText, "### Positive Analysis") === 4, "Report must include four positive analysis blocks.");
  assert(countOccurrences(reportText, "### Falsification") === 4, "Report must include four falsification blocks.");
  assert(!reportText.includes("# Deep Research Final Report"), "Report must not regress to the summary-only heading.");
  assert(input.store.listExports(input.job.id).length === 3, "Export records must still contain the three artifact kinds.");
};

function main(): void {
  const dataDir = mkdtempSync(path.join(tmpdir(), "grasseye-deep-research-report-export-"));
  const store = createDeepResearchRecordStore(dataDir);
  try {
    const { job, finalReport } = persistCompletedResearchFixture(store);
    const finalPackage = buildDeepResearchFinalPackage({ store, jobId: job.id });
    const artifacts = exportDeepResearchArtifacts({ dataDir, store, jobId: job.id, finalPackage, finalReport });
    assertFullFlowReport({ store, job, reportPath: artifacts.finalReportMarkdown.filePath });
    process.stdout.write("[DEEP-RESEARCH-REPORT-EXPORT][PASS] final-report.md exposes the full persisted 1+N+N+1 flow in one human-readable report.\n");
  } finally {
    store.close();
  }
}

main();