import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { stableJsonHash } from "../../src/lib/storage/hash.js";
import {
  buildDeepResearchFinalPackage,
  createDeepResearchRecordStore,
  exportDeepResearchArtifacts,
} from "../../src/plugins/deep-research-analysis/acceptance-surface.js";
import type {
  DeepResearchFinalReport,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.result.js";

type DeepResearchStore = ReturnType<typeof createDeepResearchRecordStore>;

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
  counterConditions: [`${subQuestionId} counter condition ${ordinal}-1`],
  failureCases: [`${subQuestionId} failure case ${ordinal}-1`],
  evidenceMentions: [`${subQuestionId} evidence mention`],
  evidenceQuality: ordinal % 2 === 0 ? "strong" : "moderate",
  assumptions: [`${subQuestionId} assumption`],
  uncertainties: [`${subQuestionId} uncertainty`],
  impactOnFinalAdjudication: `${subQuestionId} impact on final adjudication.`,
  confidence: ordinal % 2 === 0 ? "high" : "medium",
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

const persistDecompositionFixture = (input: {
  store: DeepResearchStore;
  job: Awaited<ReturnType<DeepResearchStore["createJob"]>>;
  modelSubQuestions: ReturnType<typeof buildSubQuestionFixture>;
}) => {
  const rawResponseText = buildJsonText({
    mainQuestion: input.job.userQuestion,
    questionType: "business",
    decompositionStrategy: "Split the question into demand and execution proof before final adjudication.",
    missingInfo: [],
    subQuestions: input.modelSubQuestions,
    exhaustivenessCheck: {
      keyDimensionsCovered: ["demand", "execution"],
      knownBlindSpots: [],
      whyNoMoreQuestionsAreNeeded: "These two sub-questions are sufficient for the deck artifact fixture.",
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
    renderedPromptText: createPromptText("Decomposition prompt for the deck artifact fixture."),
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

const buildFinalReportFixture = (): DeepResearchFinalReport => ({
  directAnswer: "Enter only through a staged partner-led beachhead.",
  finalVerdict: "conditional",
  oneSentenceDecision: "Enter only through a staged partner-led beachhead.",
  confidence: "medium",
  executiveConclusion: "Enter only through a staged partner-led beachhead.",
  rankedConclusions: [{
    rank: 1,
    conclusion: "Demand exists, but execution must stay narrow.",
    whyItMatters: "This is the gating conclusion for entry.",
    strength: "strong",
    appliesTo: ["partner-led narrow launch"],
    doesNotApplyTo: ["broad immediate rollout"],
    reverseCondition: "Weak partner delivery or weak demand would reverse the conclusion.",
  }],
  strongConclusions: ["Demand exists in labor-constrained warehouses."],
  positiveReasons: ["Demand exists in labor-constrained warehouses."],
  conditionalConclusions: ["Execution remains conditional on staged scope and delivery partners."],
  weakOrRejectedClaims: ["A broad immediate launch is not justified."],
  strongestOpposingArguments: ["A broad immediate launch is not justified."],
  decisiveReasons: ["Demand is real, but execution quality is the gating constraint."],
  conflictMatrix: [],
  evidenceGaps: ["Need live partner deployment benchmarks."],
  reverseConditions: ["If partner deployment quality weakens materially, reverse the thesis."],
  applicability: ["staged partner-led launch plans"],
  nonApplicability: ["broad immediate rollout plans"],
  followUpSignals: ["Deployment time-to-value in the first three accounts."],
  multiStageValueAdded: ["Independent analysis separated demand and execution before final adjudication."],
  limitations: ["This acceptance uses persisted fixtures rather than a live provider."],
  references: ["buyer capex trend", "implementation benchmarks"],
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

const DECK_VERDICT_PRESERVATION_CHECK = {
  directAnswerPreserved: true,
  finalVerdictPreserved: true,
  confidencePreserved: true,
  rankedConclusionsPreserved: true,
  reverseConditionsPreserved: true,
  evidenceGapsPreserved: true,
  limitationsPreserved: true,
  noNewFactsAdded: true,
} as const;

const DECK_OUTLINE_SLIDES = [
  {
    slideNumber: 1,
    slideType: "cover",
    title: "Executive Cover",
    headline: "Decision-ready summary deck.",
    bullets: ["Start from the adjudicated answer."],
    visualSuggestion: "Title band.",
    speakerNotes: "Set context.",
    evidenceRefs: ["buyer capex trend"],
    mustNotDrop: ["deck title"],
  },
  {
    slideNumber: 2,
    slideType: "decision",
    title: "Decision Card",
    headline: "Enter only through a staged partner-led beachhead.",
    bullets: ["Do not re-judge.", "Do not add new facts."],
    visualSuggestion: "Decision card.",
    speakerNotes: "Lead with the final answer.",
    evidenceRefs: ["buyer capex trend"],
    mustNotDrop: ["direct answer"],
  },
  {
    slideNumber: 3,
    slideType: "ranking",
    title: "Ranked Conclusions",
    headline: "Demand exists, but execution must stay narrow.",
    bullets: ["Keep the ranked conclusion intact."],
    visualSuggestion: "Ranked list.",
    speakerNotes: "Explain ranking.",
    evidenceRefs: ["buyer capex trend"],
    mustNotDrop: ["ranked conclusions"],
  },
  {
    slideNumber: 4,
    slideType: "logic_map",
    title: "Why This Wins",
    headline: "Demand is real, but execution quality is the gating constraint.",
    bullets: ["Map the decisive reason to the answer."],
    visualSuggestion: "Logic chain.",
    speakerNotes: "Show the logic path.",
    evidenceRefs: ["implementation benchmarks"],
    mustNotDrop: ["decisive reasons"],
  },
  {
    slideNumber: 5,
    slideType: "risk",
    title: "Risks And Reverse Conditions",
    headline: "Weak partner delivery would reverse the thesis.",
    bullets: ["Keep the reverse condition visible."],
    visualSuggestion: "Risk panel.",
    speakerNotes: "Describe reversal triggers.",
    evidenceRefs: ["implementation benchmarks"],
    mustNotDrop: ["reverse conditions"],
  },
  {
    slideNumber: 6,
    slideType: "limitation",
    title: "Evidence Gaps And Limitations",
    headline: "Live partner deployment benchmarks are still missing.",
    bullets: ["State the evidence gap explicitly."],
    visualSuggestion: "Gap callout.",
    speakerNotes: "Keep uncertainty visible.",
    evidenceRefs: ["implementation benchmarks"],
    mustNotDrop: ["evidence gaps"],
  },
  {
    slideNumber: 7,
    slideType: "signal",
    title: "Follow-Up Signals",
    headline: "Track deployment time-to-value in the first three accounts.",
    bullets: ["Use monitoring to validate execution quality."],
    visualSuggestion: "Signal tracker.",
    speakerNotes: "Explain monitoring.",
    evidenceRefs: ["implementation benchmarks"],
    mustNotDrop: ["follow-up signals"],
  },
  {
    slideNumber: 8,
    slideType: "reference",
    title: "References",
    headline: "All slides trace back to the stored evidence references.",
    bullets: ["buyer capex trend", "implementation benchmarks"],
    visualSuggestion: "Reference appendix.",
    speakerNotes: "Close with traceability.",
    evidenceRefs: ["buyer capex trend", "implementation benchmarks"],
    mustNotDrop: ["references"],
  },
] as const;

const cloneDeckOutlineSlides = () => DECK_OUTLINE_SLIDES.map((slide) => ({
  ...slide,
  bullets: [...slide.bullets],
  evidenceRefs: [...slide.evidenceRefs],
  mustNotDrop: [...slide.mustNotDrop],
}));

const buildDeckOutlineFixture = () => ({
  deckTitle: "Deep Research Business Deck Artifact Acceptance",
  deckSubtitle: "Default 1+N+1+1 decision presentation",
  audience: "internal",
  sourceDecisionPackageId: "acceptance-decision-package",
  sourceFinalReportId: "acceptance-final-report",
  verdictPreservationCheck: { ...DECK_VERDICT_PRESERVATION_CHECK },
  slides: cloneDeckOutlineSlides(),
  deckWarnings: [],
  contentPreservationSummary: {
    usedRankedConclusionCount: 1,
    usedReverseConditionCount: 1,
    usedEvidenceGapCount: 1,
    usedReferenceCount: 2,
    omittedItems: [],
  },
});

const persistDeckFixture = (input: {
  dataDir: string;
  store: DeepResearchStore;
  jobId: string;
}): string => {
  const outline = buildDeckOutlineFixture();
  const rawResponseText = buildJsonText(outline);
  createParsedInteraction({
    store: input.store,
    jobId: input.jobId,
    phase: "deck",
    promptId: "deep-research.business-deck-secretary",
    promptVersion: "v1.0.0",
    promptHash: "sha256:deck-prompt",
    renderedPromptText: createPromptText("Business deck secretary prompt for stored final adjudication."),
    domRef: "artifact://business-deck",
    rawResponseText,
    rawResponseHash: "sha256:deck-raw",
    providerProofJson: buildJsonText({ provider: "fixture", phase: "deck" }),
  });
  const outlinePath = path.join(input.dataDir, "deep-research-analysis", "exports", input.jobId, "business-deck-outline.json");
  mkdirSync(path.dirname(outlinePath), { recursive: true });
  writeFileSync(outlinePath, `${rawResponseText}\n`, "utf8");
  input.store.saveExport({
    jobId: input.jobId,
    exportKind: "business-deck-outline.json",
    filePath: outlinePath,
    fileHash: stableJsonHash(outline),
    payload: outline,
  });
  return outlinePath;
};

const listZipEntries = (archivePath: string): string[] => {
  const listing = spawnSync("unzip", ["-l", archivePath], { encoding: "utf8" });
  assert.equal(listing.status, 0, `unzip -l must succeed for ${archivePath}.`);
  return [...listing.stdout.matchAll(/ppt\/slides\/slide\d+\.xml/gu)].map((match) => match[0]);
};

const readZipEntry = (archivePath: string, entryPath: string): string => {
  const extracted = spawnSync("unzip", ["-p", archivePath, entryPath], { encoding: "utf8" });
  assert.equal(extracted.status, 0, `unzip -p must succeed for ${entryPath}.`);
  return extracted.stdout;
};

async function main(): Promise<void> {
  const dataDir = mkdtempSync(path.join(tmpdir(), "grasseye-deep-research-deck-artifacts-"));
  const store = createDeepResearchRecordStore(dataDir);
  try {
    const job = store.createJob({
      userQuestion: "Should the company enter the robotics warehouse market?",
      analysisGoal: "Produce a commercial decision deck from the persisted final adjudication.",
      language: "en",
      maxSubQuestions: 4,
      outputFormat: "markdown",
    });
    const persistedSubQuestions = persistDecompositionFixture({
      store,
      job,
      modelSubQuestions: buildSubQuestionFixture(),
    });
    persistedSubQuestions.forEach((subQuestion, ordinal) => {
      saveAnalysis({ store, jobId: job.id, subQuestion, ordinal });
    });
    const finalReport = buildFinalReportFixture();
    persistFinalAdjudicationFixture({ store, jobId: job.id, finalReport });
    const outlinePath = persistDeckFixture({ dataDir, store, jobId: job.id });
    store.updateJobState({ jobId: job.id, status: "completed", phase: "EXPORT_REPORT" });

    const finalPackage = buildDeepResearchFinalPackage({ store, jobId: job.id });
    const artifacts = await exportDeepResearchArtifacts({
      dataDir,
      store,
      jobId: job.id,
      finalPackage,
      finalReport,
    });

    assert.equal(finalPackage.flowMode, "default_1_n_1_1", "Deck artifact fixture must stay on default_1_n_1_1.");
    assert.equal(artifacts.status, "completed", "Deck artifacts export must complete without partial deck failure.");
    assert(artifacts.businessDeckOutline, "Deck export must return the persisted outline record.");
    assert(artifacts.businessDeckPptx, "Deck export must return a PPTX export record.");
    assert.equal(artifacts.businessDeckOutline?.filePath, outlinePath, "Deck outline path must stay stable.");
    assert(artifacts.businessDeckOutline?.fileHash.startsWith("sha256:"), "Deck outline file hash must be recorded.");
    assert(artifacts.businessDeckPptx?.fileHash.startsWith("sha256:"), "Deck PPTX file hash must be recorded.");
    assert(existsSync(artifacts.businessDeckPptx?.filePath ?? ""), "Deck PPTX file must exist on disk.");

    const persistedExports = store.listExports(job.id);
    const outlineExport = persistedExports.find((record) => record.exportKind === "business-deck-outline.json");
    const pptxExport = persistedExports.find((record) => record.exportKind === "business-deck.pptx");
    assert(outlineExport, "Record store must contain the business deck outline export.");
    assert(pptxExport, "Record store must contain the business deck PPTX export.");
    assert(outlineExport?.fileHash.startsWith("sha256:"), "Stored deck outline export must persist a file hash.");
    assert(pptxExport?.fileHash.startsWith("sha256:"), "Stored deck PPTX export must persist a file hash.");
    assert(outlineExport?.payloadHash.startsWith("sha256:"), "Stored deck outline export must persist a payload hash.");
    assert(pptxExport?.payloadHash.startsWith("sha256:"), "Stored deck PPTX export must persist a payload hash.");

    const slideEntries = [...new Set(listZipEntries(artifacts.businessDeckPptx?.filePath ?? ""))];
    assert.equal(slideEntries.length, 8, "Generated PPTX must contain the full eight-slide outline.");
    const slideText = slideEntries.map((entry) => readZipEntry(artifacts.businessDeckPptx?.filePath ?? "", entry)).join("\n");
    for (const requiredText of [
      "Decision Card",
      "Ranked Conclusions",
      "Why This Wins",
      "Risks And Reverse Conditions",
      "Evidence Gaps And Limitations",
      "Follow-Up Signals",
      "References",
    ]) {
      assert(slideText.includes(requiredText), `Generated PPTX must preserve slide text: ${requiredText}.`);
    }

    const evidenceIndexText = readFileSync(artifacts.evidenceIndex.filePath, "utf8");
    assert(evidenceIndexText.includes("\"phase\": \"deck\""), "Evidence index must include the deck interaction.");
    assert(evidenceIndexText.includes("sha256:deck-prompt"), "Evidence index must preserve the deck prompt hash.");
  } finally {
    store.close();
  }
}

await main();
process.stdout.write("[ACCEPTANCE][deep-research-deck-artifacts] PASS\n");