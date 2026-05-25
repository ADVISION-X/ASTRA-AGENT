import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  buildDeepResearchFinalPackage,
  buildDeepResearchFullCaseFile,
  createDeepResearchRecordStore,
  renderDeepResearchFullCaseFileMarkdown,
} from "../../src/plugins/deep-research-analysis/acceptance-surface.js";
import type { DeepResearchFinalReport } from "../../src/plugins/deep-research-analysis/deep-research-analysis.result.js";

type DeepResearchStore = ReturnType<typeof createDeepResearchRecordStore>;
type DeepResearchJob = ReturnType<DeepResearchStore["createJob"]>;
type PersistedSubQuestion = ReturnType<DeepResearchStore["saveSubQuestions"]>[number];

const buildJsonText = (value: unknown): string => JSON.stringify(value, null, 2);

const buildPromptText = (label: string): string => `${label}\nPreserve the full prompt and full raw response.`;

const buildSubQuestionFixture = () => [
  {
    id: "Q1",
    title: "Demand durability",
    questionText: "How durable is automation demand over the next three years?",
    purpose: "Measure durable demand.",
    whyItMatters: "The final decision needs a durable demand baseline.",
    decisionWeight: "decisive" as const,
    analysisFocus: "Durability of demand.",
    requiredEvidence: ["buyer ROI", "replacement demand"],
    scope: "Warehouse automation from 2026 to 2028.",
    expectedAnswerShape: "demand-summary",
    priority: "high" as const,
    omissionRisk: "Without this, the final verdict can confuse a temporary signal for a durable market.",
  },
  {
    id: "Q2",
    title: "Execution bottleneck",
    questionText: "Which execution bottleneck dominates the first year?",
    purpose: "Surface rollout constraints.",
    whyItMatters: "The final decision must not ignore raw execution warnings.",
    decisionWeight: "high" as const,
    analysisFocus: "Service and implementation constraints.",
    requiredEvidence: ["service capacity", "integration lead time"],
    scope: "Initial twelve-month rollout.",
    expectedAnswerShape: "execution-summary",
    priority: "high" as const,
    omissionRisk: "Without this, the final verdict can overrate demand while ignoring rollout failure risk.",
  },
];

const createInteraction = (input: {
  store: DeepResearchStore;
  jobId: string;
  phase: Parameters<DeepResearchStore["createInteraction"]>[0]["phase"];
  subQuestionId?: string;
  promptId: string;
  promptVersion: string;
  promptHash: string;
  renderedPromptText: string;
  rawResponseText: string;
  rawResponseHash: string;
  parseStatus: Parameters<DeepResearchStore["createInteraction"]>[0]["parseStatus"];
  normalizedText?: string | null;
  providerProofJson?: string | null;
  domRef?: string | null;
}) => input.store.createInteraction({
  jobId: input.jobId,
  phase: input.phase,
  ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  promptId: input.promptId,
  promptVersion: input.promptVersion,
  promptHash: input.promptHash,
  renderedPromptText: input.renderedPromptText,
  rawResponseText: input.rawResponseText,
  rawResponseHash: input.rawResponseHash,
  parseStatus: input.parseStatus,
  normalizedText: input.normalizedText ?? input.rawResponseText,
  providerKind: "gemini-api",
  providerProofJson: input.providerProofJson ?? null,
  domRef: input.domRef ?? null,
});

const persistDecomposition = (input: {
  store: DeepResearchStore;
  job: DeepResearchJob;
}) => {
  const modelSubQuestions = buildSubQuestionFixture();
  const rawResponseText = buildJsonText({
    mainQuestion: input.job.userQuestion,
    subQuestions: modelSubQuestions,
  });
  const interaction = createInteraction({
    store: input.store,
    jobId: input.job.id,
    phase: "decomposition",
    promptId: "deep-research.decomposition",
    promptVersion: "v2.0.0",
    promptHash: "sha256:fixture-decomposition-prompt",
    renderedPromptText: buildPromptText("Decomposition prompt for the full case file fixture."),
    rawResponseText,
    rawResponseHash: "sha256:fixture-decomposition-raw",
    parseStatus: "parsed",
    providerProofJson: buildJsonText({ provider: "fixture", phase: "decomposition" }),
    domRef: "artifact://fixture/decomposition",
  });
  return input.store.saveSubQuestions({
    jobId: input.job.id,
    interactionId: interaction.id,
    subQuestions: modelSubQuestions,
  });
};

const persistStructuredAnalysis = (input: {
  store: DeepResearchStore;
  jobId: string;
  subQuestion: PersistedSubQuestion;
}) => {
  const rawResponseText = buildJsonText({
    subQuestionId: input.subQuestion.modelQuestionId,
    answer: "Demand is durable enough for a narrow entry thesis.",
    coreFinding: "Demand durability is supportive but not sufficient by itself.",
    keyClaims: ["Demand is durable", "ROI remains visible"],
    supportingReasons: ["Automation ROI remains attractive", "Labor pressure persists"],
    counterConditions: ["A capex freeze would weaken demand"],
    failureCases: ["Enterprise buyers pause automation budgets"],
    evidenceMentions: ["buyer ROI evidence"],
    assumptions: ["Warehouse operators keep automation budgets active"],
    uncertainties: ["Macro demand can soften"],
    impactOnFinalAdjudication: "Supports conditional entry, not broad entry.",
    confidence: "high",
    limitations: ["Evidence is strongest in labor-constrained operators"],
  });
  const interaction = createInteraction({
    store: input.store,
    jobId: input.jobId,
    phase: "analysis",
    subQuestionId: input.subQuestion.id,
    promptId: "deep-research.sub-question-analysis",
    promptVersion: "v1.0.0",
    promptHash: "sha256:fixture-analysis-q1-prompt",
    renderedPromptText: buildPromptText("Independent analysis prompt for Q1."),
    rawResponseText,
    rawResponseHash: "sha256:fixture-analysis-q1-raw",
    parseStatus: "parsed",
    providerProofJson: buildJsonText({ provider: "fixture", phase: "analysis", question: "Q1" }),
    domRef: "artifact://fixture/analysis/Q1",
  });
  input.store.saveAnswer({
    jobId: input.jobId,
    interactionId: interaction.id,
    subQuestionId: input.subQuestion.id,
    answerKind: "analysis",
    answerText: "Demand is durable enough for a narrow entry thesis.",
    keyPoints: ["Durable demand", "ROI remains visible"],
    evidenceMentions: ["buyer ROI evidence"],
    assumptions: ["Warehouse operators keep automation budgets active"],
    limitations: ["Evidence is strongest in labor-constrained operators"],
    contradictionPoints: ["A capex freeze would weaken demand"],
    parsedPayload: {
      coreFinding: "Demand durability is supportive but not sufficient by itself.",
      failureCases: ["Enterprise buyers pause automation budgets"],
      uncertainties: ["Macro demand can soften"],
      impactOnFinalAdjudication: "Supports conditional entry, not broad entry.",
    },
    confidence: "high",
  });
};

const persistRawOnlyAnalysis = (input: {
  store: DeepResearchStore;
  jobId: string;
  subQuestion: PersistedSubQuestion;
}) => {
  const rawResponseText = [
    "Narrative raw-only analysis for Q2.",
    "Service capacity is the gating bottleneck.",
    "This answer remained raw because schema parsing failed, but the content still matters for adjudication.",
  ].join("\n");
  createInteraction({
    store: input.store,
    jobId: input.jobId,
    phase: "analysis",
    subQuestionId: input.subQuestion.id,
    promptId: "deep-research.sub-question-analysis",
    promptVersion: "v1.0.0",
    promptHash: "sha256:fixture-analysis-q2-prompt",
    renderedPromptText: buildPromptText("Independent analysis prompt for Q2."),
    rawResponseText,
    rawResponseHash: "sha256:fixture-analysis-q2-raw",
    parseStatus: "parse_failed_raw_available",
    providerProofJson: buildJsonText({ provider: "fixture", phase: "analysis", question: "Q2" }),
    domRef: "artifact://fixture/analysis/Q2",
  });
};

const buildFinalReportFixture = (): DeepResearchFinalReport => ({
  directAnswer: "Proceed only through a staged partner-led beachhead.",
  finalVerdict: "conditional",
  oneSentenceDecision: "Proceed only through a staged partner-led beachhead.",
  confidence: "medium",
  executiveConclusion: "Demand exists, but raw execution risk prevents a broad launch.",
  rankedConclusions: [
    {
      rank: 1,
      conclusion: "Demand supports a narrow launch, not a broad rollout.",
      whyItMatters: "It preserves upside while respecting the execution bottleneck.",
      strength: "strong",
      appliesTo: ["partner-led narrow launch"],
      doesNotApplyTo: ["broad immediate rollout"],
      reverseCondition: "If service capacity improves materially, the verdict can expand.",
    },
  ],
  strongConclusions: ["Demand is durable enough for a narrow entry thesis."],
  conditionalConclusions: ["Execution must stay staged because service capacity is constrained."],
  weakOrRejectedClaims: ["A broad immediate rollout is justified."],
  strongestOpposingArguments: ["Execution capacity is currently constrained."],
  decisiveReasons: ["Raw execution analysis shows service capacity is the gating bottleneck."],
  evidenceGaps: ["Need stronger service-capacity evidence before broad launch."],
  reverseConditions: ["Service capacity materially improves."],
  applicability: ["Partner-led narrow launch"],
  nonApplicability: ["Broad direct rollout"],
  followUpSignals: ["Monitor implementation lead time and service hiring."],
  multiStageValueAdded: ["The raw Q2 analysis preserved the execution bottleneck that structured-only review would have underweighted."],
  limitations: ["Execution evidence remains partly raw and needs monitoring."],
  references: [],
  sourceNotes: [],
});

const persistFinalReport = (input: {
  store: DeepResearchStore;
  jobId: string;
  finalReport: DeepResearchFinalReport;
}) => {
  const interaction = createInteraction({
    store: input.store,
    jobId: input.jobId,
    phase: "final_adjudication",
    promptId: "deep-research.final-adjudication",
    promptVersion: "v1.1.0",
    promptHash: "sha256:fixture-final-adjudication-prompt",
    renderedPromptText: buildPromptText("Final adjudication prompt with structured package and full case file."),
    rawResponseText: buildJsonText(input.finalReport),
    rawResponseHash: "sha256:fixture-final-adjudication-raw",
    parseStatus: "parsed",
    providerProofJson: buildJsonText({ provider: "fixture", phase: "final-adjudication" }),
    domRef: "artifact://fixture/final-adjudication",
  });
  input.store.saveFinalReport({
    jobId: input.jobId,
    interactionId: interaction.id,
    report: input.finalReport,
  });
};

export type DeepResearchFullCaseFixture = {
  dataDir: string;
  store: DeepResearchStore;
  job: DeepResearchJob;
  subQuestions: PersistedSubQuestion[];
  finalPackage: ReturnType<typeof buildDeepResearchFinalPackage>;
  fullCaseFile: ReturnType<typeof buildDeepResearchFullCaseFile>;
  fullCaseFileMarkdown: string;
  finalReport: DeepResearchFinalReport;
};

export const createDeepResearchFullCaseFixture = (): DeepResearchFullCaseFixture => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "grasseye-full-case-file-"));
  const store = createDeepResearchRecordStore(dataDir);
  const job = store.createJob({
    userQuestion: "Should the company enter the warehouse automation market?",
    analysisGoal: "Keep the final answer grounded in full raw evidence.",
    language: "en",
    maxSubQuestions: 4,
    outputFormat: "markdown",
  });
  const subQuestions = persistDecomposition({ store, job });
  const firstSubQuestion = subQuestions[0];
  const secondSubQuestion = subQuestions[1];
  if (!firstSubQuestion || !secondSubQuestion) {
    throw new Error("Deep Research full case fixture requires two persisted sub-questions.");
  }
  persistStructuredAnalysis({ store, jobId: job.id, subQuestion: firstSubQuestion });
  persistRawOnlyAnalysis({ store, jobId: job.id, subQuestion: secondSubQuestion });
  const finalReport = buildFinalReportFixture();
  persistFinalReport({ store, jobId: job.id, finalReport });
  const finalPackage = buildDeepResearchFinalPackage({ store, jobId: job.id });
  const fullCaseFile = buildDeepResearchFullCaseFile({
    store,
    jobId: job.id,
    structuredFinalPackage: finalPackage,
  });
  return {
    dataDir,
    store,
    job,
    subQuestions,
    finalPackage,
    fullCaseFile,
    fullCaseFileMarkdown: renderDeepResearchFullCaseFileMarkdown(fullCaseFile),
    finalReport,
  };
};

export const disposeDeepResearchFullCaseFixture = (fixture: DeepResearchFullCaseFixture): void => {
  fixture.store.close();
};