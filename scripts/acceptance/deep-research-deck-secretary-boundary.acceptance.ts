import assert from "node:assert/strict";

import {
  DeepResearchBusinessDeckOutlineSchema,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.deck-schema.js";
import {
  businessDeckSecretaryPrompt,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.deck-prompt.js";
import {
  parseDeepResearchBusinessDeckOutlineResponseForFinalReport,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.deck-parser.js";
import type {
  DeepResearchFinalReport,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.result.js";

const finalReportFixture: DeepResearchFinalReport = {
  directAnswer: "Proceed only through a staged pilot.",
  finalVerdict: "conditional",
  oneSentenceDecision: "Proceed only through a staged pilot.",
  confidence: "medium",
  rankedConclusions: [
    {
      rank: 1,
      conclusion: "A staged pilot is the only supported launch mode.",
      whyItMatters: "The final adjudication rejects a broad rollout.",
      strength: "strong",
      appliesTo: ["pilot launch"],
      doesNotApplyTo: ["broad rollout"],
      reverseCondition: "If pilot economics break, the verdict should reverse.",
    },
  ],
  strongConclusions: ["Demand is good enough for a pilot."],
  conditionalConclusions: ["Rollout must remain staged."],
  weakOrRejectedClaims: ["A broad launch is ready now."],
  decisiveReasons: ["Pilot economics are the gating decision variable."],
  evidenceGaps: ["Real pilot retention data is still missing."],
  reverseConditions: ["If pilot economics break, the verdict should reverse."],
  applicability: ["pilot launch"],
  nonApplicability: ["broad rollout"],
  followUpSignals: ["Track pilot retention after week four."],
  multiStageValueAdded: ["Independent analysis isolated the launch constraint."],
  limitations: ["This conclusion still depends on live pilot data."],
  references: ["pilot-retention-study", "unit-economics-benchmark"],
  executiveConclusion: "Proceed only through a staged pilot.",
  positiveReasons: ["Pilot economics are the gating decision variable."],
  strongestOpposingArguments: ["Broad rollout readiness is not yet proven."],
  conflictMatrix: [],
};

const VERDICT_PRESERVATION_CHECK = {
  directAnswerPreserved: true,
  finalVerdictPreserved: true,
  confidencePreserved: true,
  rankedConclusionsPreserved: true,
  reverseConditionsPreserved: true,
  evidenceGapsPreserved: true,
  limitationsPreserved: true,
  noNewFactsAdded: true,
} as const;

const LAWFUL_OUTLINE_SLIDES = [
  {
    slideNumber: 1,
    slideType: "cover" as const,
    title: "Pilot Decision",
    headline: "Proceed only through a staged pilot.",
    bullets: ["Business decision presentation only."],
    visualSuggestion: "Simple title page.",
    speakerNotes: "Open with the preserved verdict.",
    evidenceRefs: [],
    mustNotDrop: ["staged pilot verdict"],
  },
  {
    slideNumber: 2,
    slideType: "decision" as const,
    title: "One-sentence decision",
    headline: "Proceed only through a staged pilot.",
    bullets: ["final verdict: conditional", "confidence: medium"],
    visualSuggestion: "Decision card.",
    speakerNotes: "Proceed only through a staged pilot.",
    evidenceRefs: ["pilot-retention-study"],
    mustNotDrop: ["directAnswer", "confidence medium"],
  },
  {
    slideNumber: 3,
    slideType: "ranking" as const,
    title: "Ranked conclusions",
    headline: "A staged pilot is the only supported launch mode.",
    bullets: ["A staged pilot is the only supported launch mode."],
    visualSuggestion: "Ranked list.",
    speakerNotes: "Keep the ranking intact.",
    evidenceRefs: ["unit-economics-benchmark"],
    mustNotDrop: ["ranked conclusion"],
  },
  {
    slideNumber: 4,
    slideType: "logic_map" as const,
    title: "Why this judgment wins",
    headline: "Pilot economics are the gating decision variable.",
    bullets: ["Pilot economics are the gating decision variable."],
    visualSuggestion: "Logic chain.",
    speakerNotes: "Connect the reasons to the verdict.",
    evidenceRefs: ["unit-economics-benchmark"],
    mustNotDrop: ["decisive reasons"],
  },
  {
    slideNumber: 5,
    slideType: "risk" as const,
    title: "Risks and reverse conditions",
    headline: "If pilot economics break, the verdict should reverse.",
    bullets: ["If pilot economics break, the verdict should reverse."],
    visualSuggestion: "Risk panel.",
    speakerNotes: "Do not hide the reverse condition.",
    evidenceRefs: ["unit-economics-benchmark"],
    mustNotDrop: ["reverse conditions"],
  },
  {
    slideNumber: 6,
    slideType: "limitation" as const,
    title: "Evidence gaps and limitations",
    headline: "Real pilot retention data is still missing.",
    bullets: [
      "Real pilot retention data is still missing.",
      "This conclusion still depends on live pilot data.",
    ],
    visualSuggestion: "Gap panel.",
    speakerNotes: "State evidence gaps and limitations explicitly.",
    evidenceRefs: ["pilot-retention-study"],
    mustNotDrop: ["evidence gaps", "limitations"],
  },
  {
    slideNumber: 7,
    slideType: "signal" as const,
    title: "Follow-up signals",
    headline: "Track pilot retention after week four.",
    bullets: ["Track pilot retention after week four."],
    visualSuggestion: "Signal tracker.",
    speakerNotes: "Turn the verdict into monitoring.",
    evidenceRefs: ["pilot-retention-study"],
    mustNotDrop: ["follow-up signals"],
  },
  {
    slideNumber: 8,
    slideType: "reference" as const,
    title: "References",
    headline: "pilot-retention-study and unit-economics-benchmark anchor the deck.",
    bullets: ["pilot-retention-study", "unit-economics-benchmark"],
    visualSuggestion: "Reference list.",
    speakerNotes: "End with references.",
    evidenceRefs: ["pilot-retention-study", "unit-economics-benchmark"],
    mustNotDrop: ["references"],
  },
] as const;

const cloneLawfulSlides = () => LAWFUL_OUTLINE_SLIDES.map((slide) => ({
  ...slide,
  bullets: [...slide.bullets],
  evidenceRefs: [...slide.evidenceRefs],
  mustNotDrop: [...slide.mustNotDrop],
}));

const lawfulOutline = () => ({
  deckTitle: "Pilot Decision Deck",
  deckSubtitle: "Secretary-only deck output",
  audience: "executive" as const,
  sourceDecisionPackageId: "decision-package-1",
  sourceFinalReportId: "final-report-1",
  verdictPreservationCheck: { ...VERDICT_PRESERVATION_CHECK },
  slides: cloneLawfulSlides(),
  deckWarnings: [],
  contentPreservationSummary: {
    usedRankedConclusionCount: 1,
    usedReverseConditionCount: 1,
    usedEvidenceGapCount: 1,
    usedReferenceCount: 2,
    omittedItems: [],
  },
});

const expectBoundaryFailure = (outline: Record<string, unknown>, reasonFragment: string): void => {
  const parsed = parseDeepResearchBusinessDeckOutlineResponseForFinalReport({
    rawText: JSON.stringify(outline),
    finalReport: finalReportFixture,
  });
  assert(parsed.parseStatus !== "parsed", `Expected boundary failure containing ${reasonFragment}.`);
  assert(parsed.reason.includes(reasonFragment), `Expected ${parsed.reason} to include ${reasonFragment}.`);
};

assert(businessDeckSecretaryPrompt.promptText.includes("You are not a researcher."), "Deck prompt must forbid researcher identity.");
assert(businessDeckSecretaryPrompt.promptText.includes("You are not allowed to change the final judgment."), "Deck prompt must forbid final judgment changes.");
assert(businessDeckSecretaryPrompt.promptText.includes("You are not allowed to introduce new facts."), "Deck prompt must forbid new facts.");

const falsePreservation = DeepResearchBusinessDeckOutlineSchema.safeParse({
  ...lawfulOutline(),
  verdictPreservationCheck: {
    ...lawfulOutline().verdictPreservationCheck,
    confidencePreserved: false,
  },
});
assert(!falsePreservation.success, "Deck schema must reject false preservation checks.");

const parsedLawful = parseDeepResearchBusinessDeckOutlineResponseForFinalReport({
  rawText: JSON.stringify(lawfulOutline()),
  finalReport: finalReportFixture,
});
assert(parsedLawful.parseStatus === "parsed", "Lawful deck outline must parse successfully.");

expectBoundaryFailure({
  ...lawfulOutline(),
  newVerdict: "aggressive_buy",
}, "invalid_business_deck_outline");

expectBoundaryFailure({
  ...lawfulOutline(),
  slides: lawfulOutline().slides.map((slide) =>
    slide.slideType === "risk"
      ? {
        ...slide,
        headline: "Risks remain to be watched.",
        bullets: ["Monitor risk exposure closely."],
        mustNotDrop: ["risk posture"],
      }
      : slide),
  contentPreservationSummary: {
    ...lawfulOutline().contentPreservationSummary,
    usedReverseConditionCount: 0,
  },
}, "business_deck_reverse_conditions");

expectBoundaryFailure({
  ...lawfulOutline(),
  slides: lawfulOutline().slides.map((slide) =>
    slide.slideType === "limitation"
      ? {
        ...slide,
        headline: "More research is still useful.",
        bullets: ["Additional work remains."],
        mustNotDrop: ["future work"],
      }
      : slide),
  contentPreservationSummary: {
    ...lawfulOutline().contentPreservationSummary,
    usedEvidenceGapCount: 0,
  },
}, "business_deck_evidence_gaps");

expectBoundaryFailure({
  ...lawfulOutline(),
  slides: lawfulOutline().slides.map((slide) =>
    slide.slideType === "limitation"
      ? {
        ...slide,
        headline: "Real pilot retention data is still missing.",
        bullets: ["Real pilot retention data is still missing."],
        mustNotDrop: ["evidence gaps"],
      }
      : slide),
}, "business_deck_limitations_not_preserved");

process.stdout.write("[ACCEPTANCE][deep-research-deck-secretary-boundary] PASS\n");
