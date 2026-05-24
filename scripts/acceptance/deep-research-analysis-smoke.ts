import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createAiInputGatewayAbilityGroup } from "../../src/capabilities/ai-input-gateway/index.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import {
  buildDeepResearchFinalPackage,
  createDeepResearchRecordStore,
  exportDeepResearchArtifacts,
  parseDeepResearchFinalAdjudicationResponse,
  parseDeepResearchSubQuestionAnalysisResponse,
  runDeepResearchAnalysis,
} from "../../src/plugins/deep-research-analysis/acceptance-surface.js";
import { renderDeepResearchFinalAdjudicationPrompt } from "../../src/plugins/deep-research-analysis/deep-research-analysis.prompts.js";
import type { DeepResearchResult } from "../../src/plugins/deep-research-analysis/deep-research-analysis.result.js";
import type {
  AiProviderAdapter,
  AiProviderRawResponse,
} from "../../src/capabilities/ai-input-gateway/contracts/ai-provider-adapter.contract.js";
import type {
  AiFeedInput,
} from "../../src/capabilities/ai-input-gateway/index.js";
import { verifyMalformedProviderJsonFailsAtParseNotCapture } from "./deep-research-analysis-raw-capture-boundary.js";
import { verifySingleSubQuestionFailureDoesNotKillJob } from "./deep-research-analysis-sub-question-fault-isolation.js";

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
  "DECK_SEND",
  "DECK_CAPTURE",
  "DECK_PARSE",
  "DECK_PERSIST",
  "EXPORT_REPORT",
] as const;

const FIXTURE_RESPONSES = [
  JSON.stringify({
    mainQuestion: "Should the company enter the robotics warehouse market?",
    questionType: "business",
    decompositionStrategy: "Split the market-entry thesis into demand and execution viability so a final adjudicator can judge the answer directly.",
    missingInfo: [],
    subQuestions: [
      {
        id: "Q1",
        title: "Demand durability",
        questionText: "How durable is warehouse robotics demand over the next 24 months?",
        whyItMatters: "Entry should not proceed unless there is durable demand support.",
        decisionWeight: "decisive",
        analysisFocus: "Evaluate whether buyer demand remains strong enough to justify market entry timing.",
        requiredEvidence: ["buyer capex plans", "automation ROI benchmarks"],
        scope: "Enterprise warehouse robotics demand over the next 24 months.",
        expectedAnswerShape: "neutral demand assessment",
        priority: "high",
        omissionRisk: "Without this, the final answer cannot distinguish a real market from a temporary narrative."
      },
      {
        id: "Q2",
        title: "Execution feasibility",
        questionText: "What execution constraints are most likely to block a successful entry?",
        whyItMatters: "Even strong demand does not justify entry if execution barriers dominate the outcome.",
        decisionWeight: "high",
        analysisFocus: "Identify integration, channel, deployment, and operating risks that materially affect feasibility.",
        requiredEvidence: ["deployment benchmarks", "partner capability evidence"],
        scope: "Execution constraints for the first 24 months of entry.",
        expectedAnswerShape: "execution feasibility summary",
        priority: "high",
        omissionRisk: "Without this, the final adjudicator may confuse demand support with practical readiness."
      }
    ],
    exhaustivenessCheck: {
      keyDimensionsCovered: ["demand", "execution feasibility"],
      knownBlindSpots: [],
      whyNoMoreQuestionsAreNeeded: "Demand durability and execution feasibility are the two decision-dominant dimensions for this entry question."
    },
    qualitySelfCheck: {
      isNeutral: true,
      hasNoDuplicateQuestions: true,
      hasNoPureFalsificationQuestions: true,
      isReadyForIndependentAnalysis: true,
      isReadyForFinalAdjudication: true
    }
  }),
  JSON.stringify({
    subQuestionId: "Q1",
    answer: "Demand appears durable enough to justify serious market-entry consideration.",
    coreFinding: "Demand remains durable enough to support entry evaluation.",
    keyClaims: ["Large operators continue funding automation upgrades."],
    supportingReasons: ["Labor pressure and throughput demands keep ROI attractive."],
    counterConditions: ["A logistics downturn would weaken buyer urgency."],
    failureCases: ["A severe recession could materially delay automation budgets."],
    evidenceMentions: ["automation capex plans", "warehouse labor constraints"],
    evidenceQuality: "moderate",
    assumptions: ["No severe macro recession."],
    uncertainties: ["Public buyer pipeline evidence is incomplete."],
    impactOnFinalAdjudication: "Supports a measured market-entry recommendation if execution remains manageable.",
    confidence: "high",
    limitations: ["Public buyer pipeline evidence is incomplete."],
  }),
  JSON.stringify({
    subQuestionId: "Q2",
    answer: "Execution risk is manageable only with a narrow workflow launch and strong delivery partners.",
    coreFinding: "Execution is feasible, but only under a staged entry model.",
    keyClaims: ["Integration complexity is the main operational constraint."],
    supportingReasons: ["A narrow workflow and partner-led rollout reduce initial execution load."],
    counterConditions: ["Weak partner quality or broad scope would sharply raise failure risk."],
    failureCases: ["A broad first release without delivery partners would likely fail."],
    evidenceMentions: ["integration benchmarks", "partner rollout model"],
    evidenceQuality: "moderate",
    assumptions: ["A credible implementation partner is available."],
    uncertainties: ["Partner quality still needs live validation."],
    impactOnFinalAdjudication: "Supports entry only as a staged, partner-assisted launch.",
    confidence: "medium",
    limitations: ["Partner quality still needs live validation."],
  }),
  JSON.stringify({
    directAnswer: "The company should consider entering, but only through a staged partner-led beachhead.",
    finalVerdict: "conditional",
    confidence: "medium",
    rankedConclusions: [{
      rank: 1,
      conclusion: "Demand is durable enough to justify entry evaluation.",
      whyItMatters: "Without durable demand, no entry case survives.",
      strength: "strong",
      appliesTo: ["Enterprise warehouse automation buyers"],
      doesNotApplyTo: ["Severe recession scenarios"],
      reverseCondition: "A sustained logistics downturn would weaken this conclusion.",
    }],
    strongConclusions: ["Demand support is real in labor-constrained warehouses."],
    conditionalConclusions: ["Execution only works as a staged partner-led launch."],
    weakOrRejectedClaims: ["A broad immediate rollout is not justified."],
    decisiveReasons: ["Demand is durable and execution can be narrowed to a feasible beachhead."],
    evidenceGaps: ["Partner deployment quality still needs live validation."],
    reverseConditions: ["If partner execution quality is weak, the entry thesis should reverse."],
    applicability: ["Measured warehouse robotics entry decisions"],
    nonApplicability: ["Immediate full-scale launch decisions"],
    followUpSignals: ["Track partner deployment time-to-value in the first customer accounts."],
    multiStageValueAdded: ["Independent analysis separated local findings before the final adjudication."],
    limitations: ["This smoke uses deterministic fixture responses rather than a live provider."],
  }),
  JSON.stringify({
    deckTitle: "Robotics Warehouse Entry Decision Deck",
    deckSubtitle: "Default 1+N+1 decision presentation",
    audience: "executive",
    sourceDecisionPackageId: "fixture-decision-package",
    sourceFinalReportId: "fixture-final-report",
    verdictPreservationCheck: {
      directAnswerPreserved: true,
      finalVerdictPreserved: true,
      confidencePreserved: true,
      rankedConclusionsPreserved: true,
      reverseConditionsPreserved: true,
      evidenceGapsPreserved: true,
      limitationsPreserved: true,
      noNewFactsAdded: true,
    },
    slides: [
      {
        slideNumber: 1,
        slideType: "cover",
        title: "Warehouse Entry Decision",
        headline: "Staged partner-led beachhead is the only supported entry path.",
        bullets: ["Use the final adjudication unchanged.", "Do not broaden scope before validation."],
        visualSuggestion: "Title slide with decision banner.",
        speakerNotes: "Open with the decision and remind the room this deck preserves the adjudicated answer.",
        evidenceRefs: ["automation capex plans"],
        mustNotDrop: ["conditional verdict"],
      },
      {
        slideNumber: 2,
        slideType: "decision",
        title: "One-Sentence Decision",
        headline: "Enter only through a staged partner-led beachhead.",
        bullets: ["Demand is durable enough for evaluation.", "Execution only works with a narrow launch."],
        visualSuggestion: "Decision card with confidence badge.",
        speakerNotes: "State the direct answer exactly once and anchor confidence as medium.",
        evidenceRefs: ["automation capex plans", "integration benchmarks"],
        mustNotDrop: ["directAnswer", "confidence"],
      },
      {
        slideNumber: 3,
        slideType: "ranking",
        title: "Ranked Conclusions",
        headline: "Demand survives scrutiny, but execution narrows the launch shape.",
        bullets: ["Demand remains durable enough to support entry evaluation.", "A broad immediate rollout remains rejected."],
        visualSuggestion: "Ranked bar list.",
        speakerNotes: "Tie the ranked conclusion directly to the final verdict.",
        evidenceRefs: ["automation capex plans"],
        mustNotDrop: ["ranked conclusions", "weak or rejected claims"],
      },
      {
        slideNumber: 4,
        slideType: "logic_map",
        title: "Why This Judgment Wins",
        headline: "Demand support and constrained execution together define the winning path.",
        bullets: ["Demand support is real in labor-constrained warehouses.", "Partner-led delivery reduces execution load."],
        visualSuggestion: "Logic map from demand to staged launch.",
        speakerNotes: "Explain how the sub-question answers converge on the conditional verdict.",
        evidenceRefs: ["automation capex plans", "partner rollout model"],
        mustNotDrop: ["decisive reasons"],
      },
      {
        slideNumber: 5,
        slideType: "risk",
        title: "Risks And Reverse Conditions",
        headline: "Weak partner execution or broad scope would reverse the thesis.",
        bullets: ["If partner execution quality is weak, reverse the thesis.", "A broad immediate rollout is not justified."],
        visualSuggestion: "Risk matrix.",
        speakerNotes: "Keep reverse conditions explicit; do not soften them.",
        evidenceRefs: ["partner rollout model"],
        mustNotDrop: ["reverse conditions"],
      },
      {
        slideNumber: 6,
        slideType: "limitation",
        title: "Evidence Gaps And Limitations",
        headline: "The deck must preserve remaining evidence gaps and fixture limitations.",
        bullets: ["Partner deployment quality still needs live validation.", "This smoke uses deterministic fixture responses rather than a live provider."],
        visualSuggestion: "Gap list.",
        speakerNotes: "Say clearly what still needs validation.",
        evidenceRefs: ["partner rollout model"],
        mustNotDrop: ["evidence gaps", "limitations"],
      },
      {
        slideNumber: 7,
        slideType: "signal",
        title: "Follow-Up Signals",
        headline: "Track proof of execution quality in the first deployments.",
        bullets: ["Track partner deployment time-to-value in the first customer accounts."],
        visualSuggestion: "Signal tracker.",
        speakerNotes: "Follow-up signals convert the thesis into a monitoring plan.",
        evidenceRefs: ["partner rollout model"],
        mustNotDrop: ["follow-up signals"],
      },
      {
        slideNumber: 8,
        slideType: "reference",
        title: "References",
        headline: "Every decision slide traces back to the persisted research record.",
        bullets: ["automation capex plans", "integration benchmarks", "partner rollout model"],
        visualSuggestion: "Reference appendix.",
        speakerNotes: "Close with the supporting reference set.",
        evidenceRefs: ["automation capex plans", "integration benchmarks", "partner rollout model"],
        mustNotDrop: ["references"],
      },
    ],
    deckWarnings: [],
    contentPreservationSummary: {
      usedRankedConclusionCount: 1,
      usedReverseConditionCount: 1,
      usedEvidenceGapCount: 1,
      usedReferenceCount: 3,
      omittedItems: [],
    },
  }),
] as const;

class SequentialFixtureAdapter implements AiProviderAdapter {
  readonly providerKind = "gemini-api" as const;

  private cursor = 0;

  async feed(input: AiFeedInput): Promise<AiProviderRawResponse> {
    const rawText = FIXTURE_RESPONSES[this.cursor];
    if (!rawText) {
      throw new Error(`No fixture response available for prompt ${input.promptPackageId} at cursor ${this.cursor}.`);
    }
    this.cursor += 1;
    return {
      rawText,
      modelName: "fixture-gemini-model",
      runtimeName: "deep-research-fixture-adapter",
      transport: "api",
      webChatUrl: null,
      sourcePageUrlBeforeFeed: null,
      restoredSourcePage: null,
      estimatedInputTokens: 256,
      estimatedOutputTokens: 256,
      tokenEstimateUnavailableReason: null,
    };
  }
}

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const parseJsonFile = <T>(filePath: string): T => JSON.parse(readFileSync(filePath, "utf8")) as T;

const verifySmokeUsesRealSurfaces = (): void => {
  assert(typeof parseDeepResearchSubQuestionAnalysisResponse === "function", "Analysis parser must be imported by smoke.");
  assert(typeof parseDeepResearchFinalAdjudicationResponse === "function", "Final adjudication parser must be imported by smoke.");
  assert(typeof buildDeepResearchFinalPackage === "function", "Final package builder must be imported by smoke.");
  assert(typeof exportDeepResearchArtifacts === "function", "Export function must be imported by smoke.");
};

const verifyRuntimeLogCoverage = (bundlePath: string): void => {
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

const verifyPersistedResearchState = (
  dataDir: string,
  result: DeepResearchResult,
): void => {
  const store = createDeepResearchRecordStore(dataDir);
  try {
    const job = store.getJob(result.jobId);
    assert(job?.status === "completed", "Persisted research job should be completed.");
    assert(job?.flowMode === "default_1_n_1", "Smoke fixture must persist the default 1+N+1 flow mode.");

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

    const finalReport = store.getLatestFinalReport(result.jobId);
    assert(finalReport !== null, "Expected a persisted final report record.");
    const finalPackage = buildDeepResearchFinalPackage({ store, jobId: result.jobId });
    assert(finalPackage.flowMode === "default_1_n_1", "Final package must stay on the default flow mode.");
    assert(finalPackage.analysisRecords.length === 2, "Final package must read persisted analysis records.");
    assert(finalPackage.missingAnalysisSubQuestionIds.length === 0, "Final package should have no missing analysis records in the smoke fixture.");
    assert(finalPackage.analysisCoverage.missingAnalysisSubQuestionCount === 0, "Final package should report zero missing analysis rows in the smoke fixture.");
    assert(!("positiveAnswerRecords" in finalPackage), "Default final package must not expose legacy positiveAnswerRecords.");
    assert(!("falsificationAnswerRecords" in finalPackage), "Default final package must not expose legacy falsificationAnswerRecords.");
    assert(!("conflictMatrix" in finalPackage), "Default final package must not expose legacy conflictMatrix.");
    assert(!("legacyMissingPositiveFalsificationSubQuestionIds" in finalPackage), "Default final package must not expose legacy missing sub-question IDs.");
    assert(finalPackage.outputContract.contractId === "deep-research.final-adjudication.json.v1.0", "Smoke fixture must target the final adjudication contract.");
    const finalPromptText = renderDeepResearchFinalAdjudicationPrompt({
      userQuestion: job?.userQuestion ?? "",
      analysisGoal: job?.analysisGoal ?? null,
      language: job?.language ?? "zh-CN",
      finalPackage,
    });
    assert(!finalPromptText.includes("positiveAnswerRecords"), "Final adjudication prompt must not receive legacy positiveAnswerRecords for default flow.");
    assert(!finalPromptText.includes("falsificationAnswerRecords"), "Final adjudication prompt must not receive legacy falsificationAnswerRecords for default flow.");
    assert(!finalPromptText.includes("conflictMatrix"), "Final adjudication prompt must not receive legacy conflictMatrix for default flow.");
    assert(!finalPromptText.includes("legacyMissingPositiveFalsificationSubQuestionIds"), "Final adjudication prompt must not receive legacy missing sub-question IDs for default flow.");

    const exports = store.listExports(result.jobId);
    assert(exports.length === 5, `Expected 5 export records, received ${exports.length}.`);

    const finalReportExport = exports.find((record) => record.exportKind === "final-report.md");
    const decisionPackageExport = exports.find((record) => record.exportKind === "decision-package.json");
    const deckOutlineExport = exports.find((record) => record.exportKind === "business-deck-outline.json");
    const deckPptxExport = exports.find((record) => record.exportKind === "business-deck.pptx");
    const evidenceExport = exports.find((record) => record.exportKind === "evidence-index.json");
    if (!finalReportExport) throw new Error("Missing final-report.md export record.");
    if (!decisionPackageExport) throw new Error("Missing decision-package.json export record.");
    if (!deckOutlineExport) throw new Error("Missing business-deck-outline.json export record.");
    if (!deckPptxExport) throw new Error("Missing business-deck.pptx export record.");
    if (!evidenceExport) throw new Error("Missing evidence-index.json export record.");

    assert(existsSync(finalReportExport.filePath), "final-report.md file was not written.");
    assert(existsSync(decisionPackageExport.filePath), "decision-package.json file was not written.");
    assert(existsSync(deckOutlineExport.filePath), "business-deck-outline.json file was not written.");
    assert(existsSync(deckPptxExport.filePath), "business-deck.pptx file was not written.");
    assert(existsSync(evidenceExport.filePath), "evidence-index.json file was not written.");

    const deckOutline = parseJsonFile<{ slides: unknown[]; audience: string }>(deckOutlineExport.filePath);
    assert(deckOutline.audience === "executive", "Deck outline must preserve the audience field.");
    assert(deckOutline.slides.length === 8, "Deck outline must persist all required slide categories.");

    const evidenceIndex = parseJsonFile<Array<{ interactionId: string; parsedRecordId?: string }>>(evidenceExport.filePath);
    assert(evidenceIndex.length >= 5, `Expected at least 5 evidence index rows, received ${evidenceIndex.length}.`);
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

const verifySubQuestionIdsAreJobScoped = (): void => {
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

async function main(): Promise<void> {
  verifySmokeUsesRealSurfaces();
  const dataDir = mkdtempSync(path.join(tmpdir(), "grasseye-deep-research-smoke-"));
  const runtimeLogBundlePath = path.join(dataDir, "runtime-logs", "deep-research-smoke.jsonl");
  const runtimeLogger = createRuntimeLogger({
    terminalEnabled: false,
    fileSink: {
      bundlePath: runtimeLogBundlePath,
      redact: false,
    },
  });
  const aiInputGateway = createAiInputGatewayAbilityGroup({
    dataDir,
    adapters: {
      "gemini-api": new SequentialFixtureAdapter(),
    },
  });

  const result = await runDeepResearchAnalysis(
    {
      userQuestion: "Should the company enter the robotics warehouse market?",
      analysisGoal: "Assess whether entry is justified within 24 months.",
      language: "en",
      maxSubQuestions: 4,
      outputFormat: "markdown",
    },
    {
      aiInputGateway,
      runtimeLogger,
      dataDir,
      providerKind: "gemini-api",
      modelName: "fixture-gemini-model",
      timeoutMs: 5_000,
    },
  );

  assert(result.status === "success", `Expected smoke success, received ${JSON.stringify(result)}.`);
  assert(result.phase === "COMPLETE", `Expected COMPLETE phase, received ${result.phase}.`);
  assert(result.report?.finalVerdict === "conditional", "Smoke report must persist the final adjudication verdict.");
  verifyRuntimeLogCoverage(runtimeLogBundlePath);
  verifyPersistedResearchState(dataDir, result);
  verifySubQuestionIdsAreJobScoped();
  await verifyMalformedProviderJsonFailsAtParseNotCapture();
  await verifySingleSubQuestionFailureDoesNotKillJob();
  process.stdout.write("[ACCEPTANCE][deep-research-analysis-smoke] PASS\n");
}

await main();