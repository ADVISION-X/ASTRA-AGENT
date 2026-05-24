import { existsSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  businessDeckSecretaryPrompt,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.deck-prompt.js";
import {
  parseDeepResearchBusinessDeckOutlineResponse,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.deck-parser.js";
import {
  generateDeepResearchBusinessDeckPptx,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.deck-pptx.js";

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
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
};

const OUTLINE_SLIDES = [
  {
    slideNumber: 1,
    slideType: "cover",
    title: "Cover",
    headline: "Deck acceptance fixture",
    bullets: ["Deck owner coverage starts here."],
    visualSuggestion: "Simple cover band.",
    speakerNotes: "Open with scope.",
    evidenceRefs: ["ref-1"],
    mustNotDrop: ["acceptance scope"],
  },
  {
    slideNumber: 2,
    slideType: "decision",
    title: "Decision",
    headline: "Preserve the already-adjudicated answer.",
    bullets: ["Do not re-judge.", "Do not add facts."],
    visualSuggestion: "Decision card.",
    speakerNotes: "State the non-rejudgment rule.",
    evidenceRefs: ["ref-1"],
    mustNotDrop: ["direct answer"],
  },
  {
    slideNumber: 3,
    slideType: "ranking",
    title: "Ranked Conclusions",
    headline: "Ranked conclusions remain intact.",
    bullets: ["Keep ranking visible."],
    visualSuggestion: "Ranked list.",
    speakerNotes: "Preserve ranked content.",
    evidenceRefs: ["ref-2"],
    mustNotDrop: ["ranked conclusions"],
  },
  {
    slideNumber: 4,
    slideType: "logic_map",
    title: "Logic Map",
    headline: "Explain why the decision wins.",
    bullets: ["Map reasons to verdict."],
    visualSuggestion: "Logic chain.",
    speakerNotes: "Show causal structure.",
    evidenceRefs: ["ref-3"],
    mustNotDrop: ["decisive reasons"],
  },
  {
    slideNumber: 5,
    slideType: "risk",
    title: "Risk",
    headline: "Reverse conditions stay visible.",
    bullets: ["If conditions reverse, the thesis weakens."],
    visualSuggestion: "Risk panel.",
    speakerNotes: "Keep risk language intact.",
    evidenceRefs: ["ref-4"],
    mustNotDrop: ["reverse conditions"],
  },
  {
    slideNumber: 6,
    slideType: "limitation",
    title: "Limitations",
    headline: "Evidence gaps and limitations remain explicit.",
    bullets: ["Do not hide uncertainty."],
    visualSuggestion: "Gap callout.",
    speakerNotes: "State the limitations clearly.",
    evidenceRefs: ["ref-5"],
    mustNotDrop: ["limitations"],
  },
  {
    slideNumber: 7,
    slideType: "signal",
    title: "Signals",
    headline: "Follow-up signals turn the verdict into monitoring.",
    bullets: ["Track the next observable signals."],
    visualSuggestion: "Signal tracker.",
    speakerNotes: "Explain monitoring intent.",
    evidenceRefs: ["ref-6"],
    mustNotDrop: ["follow-up signals"],
  },
  {
    slideNumber: 8,
    slideType: "reference",
    title: "References",
    headline: "Every slide traces back to evidence refs.",
    bullets: ["ref-1", "ref-2", "ref-3"],
    visualSuggestion: "Reference appendix.",
    speakerNotes: "Close with evidence traceability.",
    evidenceRefs: ["ref-1", "ref-2", "ref-3"],
    mustNotDrop: ["references"],
  },
] as const;

const CONTENT_PRESERVATION_SUMMARY = {
  usedRankedConclusionCount: 1,
  usedReverseConditionCount: 1,
  usedEvidenceGapCount: 1,
  usedReferenceCount: 3,
  omittedItems: [],
};

const buildOutlineFixture = () => ({
  deckTitle: "Deep Research Business Deck Acceptance",
  deckSubtitle: "Prompt, parser, and PPTX owner coverage",
  audience: "internal",
  sourceDecisionPackageId: "acceptance-decision-package",
  sourceFinalReportId: "acceptance-final-report",
  verdictPreservationCheck: VERDICT_PRESERVATION_CHECK,
  slides: OUTLINE_SLIDES,
  deckWarnings: [],
  contentPreservationSummary: CONTENT_PRESERVATION_SUMMARY,
});

const verifyDeckPromptContract = (): void => {
  assert(
    businessDeckSecretaryPrompt.promptId === "deep-research.business-deck-secretary",
    "Business deck prompt must expose the dedicated promptId.",
  );
  assert(
    businessDeckSecretaryPrompt.phase === "deck",
    "Business deck prompt must stay on the deck interaction phase.",
  );
  assert(
    businessDeckSecretaryPrompt.expectedOutputContract.requiredFields.includes("slides"),
    "Business deck prompt contract must require slides.",
  );
  assert(
    businessDeckSecretaryPrompt.expectedOutputContract.forbiddenFields.includes("workflow"),
    "Business deck prompt contract must forbid workflow-style control fields.",
  );
};

const parseDeckFixture = () => {
  const parsed = parseDeepResearchBusinessDeckOutlineResponse(JSON.stringify(buildOutlineFixture()));
  assert(parsed.parseStatus === "parsed", `Deck parser must accept the lawful outline fixture, received ${parsed.parseStatus}.`);
  if (parsed.parseStatus !== "parsed") {
    throw new Error("Deck parser did not return a parsed outline.");
  }
  assert(parsed.parsed.slides.length === 8, "Deck parser must preserve the full slide list.");
  return parsed.parsed;
};

const verifyGeneratedDeck = async (outputDir: string): Promise<void> => {
  const pptxPath = await generateDeepResearchBusinessDeckPptx({
    outputDir,
    outline: parseDeckFixture(),
  });
  assert(existsSync(pptxPath), "Deck PPTX generator must write a PPTX file.");
  assert(statSync(pptxPath).size > 0, "Generated deck PPTX must not be empty.");
};

const main = async (): Promise<void> => {
  verifyDeckPromptContract();
  const outputDir = mkdtempSync(path.join(tmpdir(), "grasseye-deck-acceptance-"));
  await verifyGeneratedDeck(outputDir);
};

await main();
process.stdout.write("[ACCEPTANCE][deep-research-business-deck] PASS\n");