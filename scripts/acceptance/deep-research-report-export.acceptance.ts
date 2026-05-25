import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
    whyItMatters: "The final adjudicator needs durable demand evidence before supporting entry.",
    decisionWeight: "decisive" as const,
    analysisFocus: "Evaluate whether buyer demand is durable enough to justify entry timing.",
    requiredEvidence: ["buyer capex trend", "automation ROI data"],
    scope: "Global robotics warehouse demand from 2026 to 2028.",
    expectedAnswerShape: "demand-summary",
    priority: "high" as const,
    omissionRisk: "Without this, the final answer can mistake a niche signal for a real market.",
  },
  {
    id: "Q2",
    title: "Pricing power",
    questionText: "Can the entrant preserve pricing power against incumbent vendors?",
    purpose: "Assess gross margin resilience.",
    whyItMatters: "A market can be attractive while still destroying economics through pricing pressure.",
    decisionWeight: "high" as const,
    analysisFocus: "Assess whether incumbents or buyer concentration compress price and margin potential.",
    requiredEvidence: ["peer pricing evidence", "replacement-cycle data"],
    scope: "Competitive pricing and replacement cycles.",
    expectedAnswerShape: "pricing-summary",
    priority: "medium" as const,
    omissionRisk: "Without this, the final answer may overstate the value of demand without checking monetization quality.",
  },
  {
    id: "Q3",
    title: "Execution readiness",
    questionText: "What execution dependencies dominate the first twelve months?",
    purpose: "Expose rollout dependencies.",
    whyItMatters: "Entry quality depends on whether the first year of execution is feasible.",
    decisionWeight: "high" as const,
    analysisFocus: "Identify the operational dependencies that determine whether launch execution remains realistic.",
    requiredEvidence: ["implementation benchmarks", "service capacity evidence"],
    scope: "Implementation, integration, and service capacity.",
    expectedAnswerShape: "execution-summary",
    priority: "high" as const,
    omissionRisk: "Without this, the final adjudication may describe a good market without a workable launch path.",
  },
];

const buildAnalysisRawResponse = (subQuestionId: string, ordinal: number) => buildJsonText({
  subQuestionId,
  answer: `Independent analysis answer for ${subQuestionId}.`,
  coreFinding: `Core finding for ${subQuestionId}.`,
  keyClaims: [
    `${subQuestionId} key claim A`,
    `${subQuestionId} key claim B`,
  ],
  supportingReasons: [
    `${subQuestionId} supporting reason ${ordinal}-1`,
    `${subQuestionId} supporting reason ${ordinal}-2`,
  ],
  counterConditions: [
    `${subQuestionId} counter condition ${ordinal}-1`,
  ],
  failureCases: [
    `${subQuestionId} failure case ${ordinal}-1`,
  ],
  evidenceMentions: [`${subQuestionId} evidence mention`],
  evidenceQuality: ordinal % 2 === 0 ? "moderate" : "strong",
  assumptions: [`${subQuestionId} assumption`],
  uncertainties: [`${subQuestionId} uncertainty`],
  impactOnFinalAdjudication: `${subQuestionId} impact on final adjudication.`,
  confidence: ordinal % 2 === 0 ? "medium" : "high",
  limitations: [`${subQuestionId} analysis limitation`],
});

const createPromptText = (label: string): string => `${label}\nReturn a structured JSON object.`;

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

const saveAnalysis = (input: {
  store: DeepResearchStore;
  jobId: string;
  subQuestion: Awaited<ReturnType<DeepResearchStore["saveSubQuestions"]>>[number];
  ordinal: number;
}): void => {
  const rawResponseText = buildAnalysisRawResponse(input.subQuestion.modelQuestionId, input.ordinal + 1);
  const interaction = createParsedInteraction({
    store: input.store,
    jobId: input.jobId,
    phase: "analysis",
    subQuestionId: input.subQuestion.id,
    promptId: "deep-research.sub-question-analysis",
    promptVersion: "v1.0.0",
    promptHash: `sha256:analysis-${input.subQuestion.modelQuestionId}-prompt`,
    renderedPromptText: createPromptText(`Independent analysis prompt for ${input.subQuestion.modelQuestionId}.`),
    domRef: `artifact://analysis/${input.subQuestion.modelQuestionId}`,
    rawResponseText,
    rawResponseHash: `sha256:analysis-${input.subQuestion.modelQuestionId}-raw`,
    providerProofJson: buildJsonText({ provider: "fixture", phase: "analysis", id: input.subQuestion.modelQuestionId }),
  });
  input.store.saveAnswer({
    jobId: input.jobId,
    interactionId: interaction.id,
    subQuestionId: input.subQuestion.id,
    answerKind: "analysis",
    answerText: `Independent analysis answer for ${input.subQuestion.modelQuestionId}.`,
    keyPoints: [
      `${input.subQuestion.modelQuestionId} key claim A`,
      `${input.subQuestion.modelQuestionId} key claim B`,
    ],
    evidenceMentions: [`${input.subQuestion.modelQuestionId} evidence mention`],
    assumptions: [`${input.subQuestion.modelQuestionId} assumption`],
    limitations: [`${input.subQuestion.modelQuestionId} analysis limitation`],
    contradictionPoints: [`${input.subQuestion.modelQuestionId} counter condition 1`],
    parsedPayload: {
      coreFinding: `Core finding for ${input.subQuestion.modelQuestionId}.`,
      failureCases: [`${input.subQuestion.modelQuestionId} failure case 1`],
      uncertainties: [`${input.subQuestion.modelQuestionId} uncertainty`],
      impactOnFinalAdjudication: `${input.subQuestion.modelQuestionId} impact on final adjudication.`,
    },
    confidence: input.ordinal % 2 === 0 ? "high" : "medium",
  });
};

const persistDecompositionFixture = (input: {
  store: DeepResearchStore;
  job: Awaited<ReturnType<DeepResearchStore["createJob"]>>;
  modelSubQuestions: ReturnType<typeof buildSubQuestionFixture>;
}) => {
  const rawResponseText = buildJsonText({
    mainQuestion: input.job.userQuestion,
    questionType: "business",
    decompositionStrategy: "Split the market-entry question into demand, pricing, and execution.",
    missingInfo: [],
    subQuestions: input.modelSubQuestions.map((subQuestion) => ({
      id: subQuestion.id,
      title: subQuestion.title,
      questionText: subQuestion.questionText,
      whyItMatters: subQuestion.whyItMatters,
      decisionWeight: subQuestion.decisionWeight,
      analysisFocus: subQuestion.analysisFocus,
      requiredEvidence: subQuestion.requiredEvidence,
      scope: subQuestion.scope,
      expectedAnswerShape: subQuestion.expectedAnswerShape,
      priority: subQuestion.priority,
      omissionRisk: subQuestion.omissionRisk,
    })),
    exhaustivenessCheck: {
      keyDimensionsCovered: ["demand", "pricing", "execution"],
      knownBlindSpots: [],
      whyNoMoreQuestionsAreNeeded: "These three sub-questions are sufficient for the report export fixture.",
    },
    qualitySelfCheck: {
      isNeutral: true,
      hasNoDuplicateQuestions: true,
      hasNoPureFalsificationQuestions: true,
      isReadyForIndependentAnalysis: true,
      isReadyForFinalAdjudication: true,
    },
  });
  const interaction = createParsedInteraction({
    store: input.store,
    jobId: input.job.id,
    phase: "decomposition",
    promptId: "deep-research.decomposition",
    promptVersion: "v2.0.0",
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

const buildFinalReportFixture = (): DeepResearchFinalReport => ({
  directAnswer: "The company should only enter through a staged partner-led beachhead.",
  finalVerdict: "conditional",
  oneSentenceDecision: "Enter only through a staged partner-led beachhead.",
  confidence: "medium",
  executiveConclusion: "The company should only enter through a staged partner-led beachhead.",
  rankedConclusions: [{
    rank: 1,
    conclusion: "Demand exists, but execution must stay narrow.",
    whyItMatters: "This is the gating conclusion for entry.",
    strength: "strong",
    appliesTo: ["partner-led narrow launch"],
    doesNotApplyTo: ["broad immediate rollout"],
    reverseCondition: "Weak partner delivery or weak demand would reverse the conclusion.",
  }],
  strongConclusions: [
    "Demand exists in labor-constrained warehouses.",
  ],
  positiveReasons: [
    "Demand exists in labor-constrained warehouses.",
  ],
  conditionalConclusions: [
    "Execution remains conditional on staged scope and delivery partners.",
  ],
  weakOrRejectedClaims: [
    "A broad immediate launch is not justified.",
  ],
  strongestOpposingArguments: [
    "A broad immediate launch is not justified.",
  ],
  decisiveReasons: [
    "Demand is real, but execution quality is the gating constraint.",
  ],
  conflictMatrix: [],
  evidenceGaps: [
    "Need live partner deployment benchmarks.",
  ],
  reverseConditions: [
    "If partner deployment quality weakens materially, reverse the thesis.",
  ],
  applicability: [
    "staged partner-led launch plans",
  ],
  nonApplicability: [
    "broad immediate rollout plans",
  ],
  followUpSignals: [
    "Deployment time-to-value in the first three accounts.",
  ],
  multiStageValueAdded: [
    "Independent sub-question analysis separated demand, pricing, and execution before final adjudication.",
  ],
  limitations: [
    "This acceptance uses persisted fixtures rather than a live provider.",
  ],
  references: [
    "buyer capex trend",
    "peer pricing evidence",
    "implementation benchmarks",
  ],
});

const persistFinalAdjudicationFixture = (input: {
  store: DeepResearchStore;
  jobId: string;
  finalReport: DeepResearchFinalReport;
}): void => {
  const rawResponseText = buildJsonText(input.finalReport);
  const interaction = createParsedInteraction({
    store: input.store,
    jobId: input.jobId,
    phase: "final_adjudication",
    promptId: "deep-research.final-adjudication",
    promptVersion: "v1.0.0",
    promptHash: "sha256:final-adjudication-prompt",
    renderedPromptText: createPromptText("Final adjudication prompt for all persisted records."),
    domRef: "artifact://final-adjudication",
    rawResponseText,
    rawResponseHash: "sha256:final-adjudication-raw",
    providerProofJson: buildJsonText({ provider: "fixture", phase: "final-adjudication" }),
  });
  input.store.saveFinalReport({ jobId: input.jobId, interactionId: interaction.id, report: input.finalReport });
};

const persistBusinessHtmlReportFixture = (input: {
  store: DeepResearchStore;
  dataDir: string;
  jobId: string;
}): void => {
  const filePath = path.join(
    input.dataDir,
    "deep-research-analysis",
    "exports",
    input.jobId,
    "business-report.html",
  );
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, [
    "<!DOCTYPE html>",
    "<html>",
    "<head><meta charset=\"utf-8\"><title>Business Report</title><style>body{font-family:sans-serif;}</style></head>",
    "<body><main><h1>Decision</h1><p>Enter only through a staged partner-led beachhead.</p></main></body>",
    "</html>",
  ].join(""), "utf8");
  input.store.saveExport({
    jobId: input.jobId,
    exportKind: "business-report.html",
    filePath,
    fileHash: "sha256:business-html-report",
    payload: {
      exportKind: "business-report.html",
      filePath,
      fileHash: "sha256:business-html-report",
      sourceKind: "html_artifact",
      status: "business_html_report_generated",
      generatedAt: "2026-05-24T00:00:00.000Z",
      fileSizeBytes: readFileSync(filePath, "utf8").length,
    },
  });
};

const persistCompletedResearchFixture = (input: {
  store: DeepResearchStore;
  dataDir: string;
}) => {
  const job = input.store.createJob({
    userQuestion: "Should the company enter the robotics warehouse market?",
    analysisGoal: "Produce one full-flow human-readable report for debugging and delivery.",
    language: "en",
    maxSubQuestions: 4,
    outputFormat: "markdown",
  });
  const modelSubQuestions = buildSubQuestionFixture();
  const persistedSubQuestions = persistDecompositionFixture({ store: input.store, job, modelSubQuestions });
  persistedSubQuestions.forEach((subQuestion, ordinal) => {
    saveAnalysis({ store: input.store, jobId: job.id, subQuestion, ordinal });
  });
  const finalReport = buildFinalReportFixture();
  persistFinalAdjudicationFixture({ store: input.store, jobId: job.id, finalReport });
  persistBusinessHtmlReportFixture({ store: input.store, dataDir: input.dataDir, jobId: job.id });
  input.store.updateJobState({ jobId: job.id, status: "completed", phase: "EXPORT_REPORT" });
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
  assert(reportText.includes("## Analysis Coverage"), "Report must include analysis coverage.");
  assert(reportText.includes("### Independent Analysis"), "Report must include independent analysis sections.");
  assert(reportText.includes("## Final Adjudication"), "Report must include final adjudication.");
  assert(reportText.includes("## Evidence Index"), "Report must include the evidence index.");
  assert(reportText.includes("sha256:decomposition-prompt"), "Report must expose promptHash values.");
  assert(reportText.includes("sha256:analysis-Q1-raw"), "Report must expose rawResponseHash values.");
  assert(reportText.includes("DOM Ref: artifact://analysis/Q1"), "Report must expose domRef values.");
  assert(reportText.includes("Decomposition prompt for the main question."), "Report must include persisted prompt text.");
  assert(reportText.includes("Final adjudication prompt for all persisted records."), "Report must include the final adjudication prompt text.");
  assert(reportText.includes("Independent analysis answer for Q1."), "Report must include persisted analysis content.");
  assert(countOccurrences(reportText, "### Independent Analysis") === 3, "Report must include three independent analysis blocks.");
  assert(!reportText.includes("### Falsification"), "Default-flow report must not regress to falsification blocks.");
  assert(!reportText.includes("## Conflict Matrix"), "Default-flow report must not emit a conflict matrix section.");
  assert(!reportText.includes("## Final Synthesis"), "Default-flow report must not regress to final synthesis.");
  assert(input.store.listExports(input.job.id).length === 4, "Export records must contain final-report.md, decision-package.json, business-report.html, and evidence-index.json for this fixture.");
};

async function main(): Promise<void> {
  const dataDir = mkdtempSync(path.join(tmpdir(), "grasseye-deep-research-report-export-"));
  const store = createDeepResearchRecordStore(dataDir);
  try {
    const { job, finalReport } = persistCompletedResearchFixture({ store, dataDir });
    const finalPackage = buildDeepResearchFinalPackage({ store, jobId: job.id });
    const artifacts = await exportDeepResearchArtifacts({
      dataDir,
      store,
      jobId: job.id,
      finalPackage,
      finalReport,
    });

    assert(finalPackage.flowMode === "default_1_n_1_1", "Report-export fixture must target the default 1+N+1+1 flow mode.");
    assert(finalPackage.analysisRecords.length === 3, "Report-export fixture must persist three analysis records.");

    const decisionPackage = JSON.parse(readFileSync(artifacts.decisionPackage.filePath, "utf8")) as {
      flowMode: string;
      analysisAnswers: unknown[];
    };
    assert(decisionPackage.flowMode === "default_1_n_1_1", "Decision package must expose the default 1+N+1+1 flow mode.");
    assert(decisionPackage.analysisAnswers.length === 3, "Decision package must expose three analysis answers.");
    assert(artifacts.businessHtmlReport.exportKind === "business-report.html", "Report-export fixture must preserve the primary business HTML report export.");
    assert(artifacts.businessDeckOutline === null, "Report-export fixture should not synthesize deck exports without a persisted deck outline.");
    assert(artifacts.businessDeckPptx === null, "Report-export fixture should not synthesize a PPTX without a persisted deck outline.");

    assertFullFlowReport({
      store,
      job,
      reportPath: artifacts.finalReportMarkdown.filePath,
    });
  } finally {
    store.close();
  }
}

await main();
process.stdout.write("[ACCEPTANCE][deep-research-report-export] PASS\n");
