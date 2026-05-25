import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  buildDeepResearchStructuredIndex,
  buildDeepResearchFullCaseFile,
  createDeepResearchRecordStore,
  renderDeepResearchFullCaseFileMarkdown,
} from "../../src/plugins/deep-research-analysis/acceptance-surface.js";
import type { DeepResearchFinalAdjudicationParse } from "../../src/plugins/deep-research-analysis/deep-research-analysis.result.js";

type DeepResearchStore = ReturnType<typeof createDeepResearchRecordStore>;
type DeepResearchJob = ReturnType<DeepResearchStore["createJob"]>;
type PersistedSubQuestion = ReturnType<DeepResearchStore["saveSubQuestions"]>[number];

const buildJsonText = (value: unknown): string => JSON.stringify(value, null, 2);

const buildPromptText = (label: string): string => `${label}\nPreserve the full prompt and full raw response.`;

const buildPromptBundle = (input: {
  id: string;
  role: "sub_question_analysis" | "final_adjudication" | "html_report_publisher";
  instruction: string;
  format: "json_object" | "html_document";
  questionSpecificFocus?: readonly string[];
  evidenceOrReasoningNeeds?: readonly string[];
  requiredContent?: readonly string[];
}) => ({
  promptBundleId: `${input.id}-prompt-bundle`,
  promptRole: input.role,
  taskInstruction: input.instruction,
  questionSpecificFocus: input.questionSpecificFocus ? [...input.questionSpecificFocus] : [input.instruction],
  mustUseInputs: ["persisted fixture inputs"],
  mustNotDo: ["Do not invent evidence."],
  evidenceOrReasoningNeeds: input.evidenceOrReasoningNeeds
    ? [...input.evidenceOrReasoningNeeds]
    : ["Use fixture evidence and raw responses."],
  outputGuidance: {
    preferredFormat: input.format,
    requiredContent: input.requiredContent ? [...input.requiredContent] : ["fixture content"],
    supplementalContent: [],
    forbiddenContent: ["workflow commands"],
  },
  safetyBoundary: ["Fixture only."],
  languageInstruction: "Respond in English.",
});

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
    promptBundle: {
      ...buildPromptBundle({
        id: "Q1",
        role: "sub_question_analysis",
        instruction: "Analyze durable demand for the fixture.",
        format: "json_object",
        questionSpecificFocus: ["demand durability", "buyer replacement urgency"],
        evidenceOrReasoningNeeds: ["buyer ROI", "replacement demand"],
        requiredContent: ["demand durability finding", "demand weakening conditions"],
      }),
      promptRole: "sub_question_analysis" as const,
    },
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
    promptBundle: {
      ...buildPromptBundle({
        id: "Q2",
        role: "sub_question_analysis",
        instruction: "Analyze execution bottlenecks for the fixture.",
        format: "json_object",
        questionSpecificFocus: ["service bottleneck", "integration lead time"],
        evidenceOrReasoningNeeds: ["service capacity", "integration lead time"],
        requiredContent: ["dominant execution bottleneck", "conditions that reduce rollout risk"],
      }),
      promptRole: "sub_question_analysis" as const,
    },
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
  input.store.saveResearchPlan({
    jobId: input.job.id,
    interactionId: interaction.id,
    researchPlan: {
      mainQuestion: input.job.userQuestion,
      questionType: "business",
      decompositionStrategy: "Fixture decomposition for full case file coverage.",
      missingInfo: [],
      subQuestions: modelSubQuestions.map((subQuestion) => ({
        id: subQuestion.id,
        title: subQuestion.title,
        questionText: subQuestion.questionText,
        whyItMatters: subQuestion.whyItMatters,
        decisionWeight: subQuestion.decisionWeight,
        scope: subQuestion.scope,
        omissionRisk: subQuestion.omissionRisk,
        promptBundle: subQuestion.promptBundle,
      })),
      finalAdjudicationPromptBundle: {
        ...buildPromptBundle({
          id: "final-adjudication",
          role: "final_adjudication",
          instruction: "Adjudicate the full fixture case file.",
          format: "json_object",
        }),
        promptRole: "final_adjudication",
      },
      htmlReportPromptBundle: {
        ...buildPromptBundle({
          id: "html-report",
          role: "html_report_publisher",
          instruction: "Publish the fixture as HTML.",
          format: "html_document",
        }),
        promptRole: "html_report_publisher",
      },
      planIntegrityCheck: {
        everySubQuestionHasPromptBundle: true,
        promptBundlesAreQuestionSpecific: true,
        noGenericUniversalPromptBundle: true,
        finalPromptBundleIsQuestionSpecific: true,
        htmlPromptBundleIsQuestionSpecific: true,
        runtimeWillOnlyAddShellConstraints: true,
      },
    },
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

const buildFinalAdjudicationFixture = (): DeepResearchFinalAdjudicationParse => {
  const parsedJsonIndex = {
    recommendation: "Proceed only through a staged partner-led beachhead.",
    gatingConstraint: "Demand exists, but raw execution risk prevents a broad launch.",
    rationale: ["Demand is durable enough for a narrow entry thesis."],
    constraints: ["Execution must stay staged because service capacity is constrained."],
    rejectedPaths: ["A broad immediate rollout is justified."],
    followUpSignals: ["Monitor implementation lead time and service hiring."],
  };
  return {
    rawFinalAnswerText: buildJsonText(parsedJsonIndex),
    rawResponseHash: "sha256:fixture-final-adjudication-raw",
    preferredFormat: "json_object",
    parsedJsonIndex,
    parseStatus: "parsed_json_index",
  };
};

const persistFinalAdjudication = (input: {
  store: DeepResearchStore;
  jobId: string;
  finalAdjudication: DeepResearchFinalAdjudicationParse;
}) => {
  const interaction = createInteraction({
    store: input.store,
    jobId: input.jobId,
    phase: "final_adjudication",
    promptId: "deep-research.final-adjudication",
    promptVersion: "v1.1.0",
    promptHash: "sha256:fixture-final-adjudication-prompt",
    renderedPromptText: buildPromptText("Final adjudication prompt with structured index and full case file."),
    rawResponseText: input.finalAdjudication.rawFinalAnswerText,
    rawResponseHash: input.finalAdjudication.rawResponseHash,
    parseStatus: "parsed",
    providerProofJson: buildJsonText({ provider: "fixture", phase: "final-adjudication" }),
    domRef: "artifact://fixture/final-adjudication",
  });
  input.store.saveFinalAdjudication({
    jobId: input.jobId,
    interactionId: interaction.id,
    promptId: interaction.promptId,
    promptVersion: interaction.promptVersion,
    parsed: input.finalAdjudication,
    promptBundleSnapshot: {
      fixture: true,
      promptRole: "final_adjudication",
    },
  });
};

export type DeepResearchFullCaseFixture = {
  dataDir: string;
  store: DeepResearchStore;
  job: DeepResearchJob;
  subQuestions: PersistedSubQuestion[];
  finalPackage: ReturnType<typeof buildDeepResearchStructuredIndex>;
  fullCaseFile: ReturnType<typeof buildDeepResearchFullCaseFile>;
  fullCaseFileMarkdown: string;
  finalAdjudication: DeepResearchFinalAdjudicationParse;
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
  const finalAdjudication = buildFinalAdjudicationFixture();
  persistFinalAdjudication({ store, jobId: job.id, finalAdjudication });
  const finalPackage = buildDeepResearchStructuredIndex({ store, jobId: job.id });
  const fullCaseFile = buildDeepResearchFullCaseFile({
    store,
    jobId: job.id,
    structuredIndex: finalPackage,
  });
  return {
    dataDir,
    store,
    job,
    subQuestions,
    finalPackage,
    fullCaseFile,
    fullCaseFileMarkdown: renderDeepResearchFullCaseFileMarkdown(fullCaseFile),
    finalAdjudication,
  };
};

export const disposeDeepResearchFullCaseFixture = (fixture: DeepResearchFullCaseFixture): void => {
  fixture.store.close();
};
