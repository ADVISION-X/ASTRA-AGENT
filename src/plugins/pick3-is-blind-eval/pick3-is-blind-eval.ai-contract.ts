import { createHash } from "node:crypto";

import type { Pick3PlaybookPromptPackage } from "./pick3-is-blind-eval.playbook.js";

export const hashText = (value: string): string => createHash("sha256").update(value).digest("hex");

export const publicPromptPackageId = (promptPackage: Pick3PlaybookPromptPackage): string =>
  `blind_series_package_${hashText(`${promptPackage.imageRef.imageId}:${promptPackage.playbookVersionId}`).slice(0, 16)}`;

const freeAnalysisPromptContractId = "pick3-is-blind-eval-free-analysis-one-image-v1" as const;
const playbookPromptContractId = "pick3-is-blind-eval-one-image-v1" as const;
const freeAnalysisExpectedOutputSchemaRef = "pick3-is-blind-eval-free-analysis-json-v1" as const;
const playbookExpectedOutputSchemaRef = "pick3-is-blind-eval-prediction-json-v1" as const;

export const pick3PromptContractMetadata = (promptPackage: Pick3PlaybookPromptPackage): {
  promptContractId: typeof freeAnalysisPromptContractId | typeof playbookPromptContractId;
  expectedOutputSchemaRef: typeof freeAnalysisExpectedOutputSchemaRef | typeof playbookExpectedOutputSchemaRef;
} => promptPackage.promptMode === "free_analysis_strict_reasoning"
  ? { promptContractId: freeAnalysisPromptContractId, expectedOutputSchemaRef: freeAnalysisExpectedOutputSchemaRef }
  : { promptContractId: playbookPromptContractId, expectedOutputSchemaRef: playbookExpectedOutputSchemaRef };

const freeAnalysisOutputShape = (promptPackage: Pick3PlaybookPromptPackage): string => JSON.stringify({
  imageId: promptPackage.imageRef.imageId,
  promptPackageId: publicPromptPackageId(promptPackage),
  predictionLabel: "lower | upper | abstain",
  confidence: "number from 0 to 1, or null only for abstain",
  chartReading: "full visible-series analysis, not a short label",
  recentBehavior: "analysis of the most recent visible segment",
  supportingEvidence: ["concrete visual evidence supporting the chosen label"],
  counterEvidence: ["concrete opposing evidence, or empty array"],
  decisionLogic: "why the supporting evidence outweighs counter-evidence, or why evidence is balanced",
  zoneCount: { lowerCount: "integer: visible points below the midline, counted not estimated", upperCount: "integer: visible points above the midline, counted not estimated" },
  patternRecurrence: "name the pattern cited in supportingEvidence, how many times it recurs in the full window, and how many of those recurrences matched the predicted direction",
  weakestLink: "the single weakest assumption in your own reasoning chain",
  abstainReason: "string or null - required if abstain",
}, null, 2);

const playbookOutputShape = (promptPackage: Pick3PlaybookPromptPackage): string => JSON.stringify({
  imageId: promptPackage.imageRef.imageId,
  promptPackageId: publicPromptPackageId(promptPackage),
  predictionLabel: "lower | upper | abstain",
  confidence: "number or null",
  tailShapes: ["named shape/motion words observed in the last 3-8 points"],
  zoneWeight: "lower_weighted | upper_weighted | balanced",
  drivingEvidence: "one sentence: the specific named shape that determined direction",
  discountedEvidence: "one sentence: any opposing signal noticed but not allowed to override, or null if none observed",
  reason: "full analytical chain: tail shapes named, L80 zone weight, conclusion derived",
  abstainReason: "string or null - required if abstain, must name both conflicting signals",
}, null, 2);

export const renderPick3PredictionPrompt = (promptPackage: Pick3PlaybookPromptPackage): string => [
  promptPackage.systemPrompt,
  promptPackage.businessPrompt,
	  "Final output contract:",
	  "Image receipt gate:",
	  "Before any analysis, verify that the chart image itself is visible in this conversation. If no chart image is visible or attached, reply exactly `未收到图片` and stop. If the image is visible, do not mention receipt; continue with the JSON analysis below.",
	  "Return JSON only. Do not return only `lower`, `upper`, or `abstain`. Do not wrap the JSON in markdown. Do not add commentary before or after the JSON.",
  "Identity binding:",
  JSON.stringify({ imageId: promptPackage.imageRef.imageId, promptPackageId: publicPromptPackageId(promptPackage) }, null, 2),
  "You must copy imageId and promptPackageId exactly into the output JSON. If either value is missing or changed, the answer is invalid.",
  "Return exactly this JSON object shape, with your chosen values:",
  promptPackage.promptMode === "free_analysis_strict_reasoning" ? freeAnalysisOutputShape(promptPackage) : playbookOutputShape(promptPackage),
  promptPackage.promptMode === "free_analysis_strict_reasoning"
    ? "Important: `predictionLabel` must be exactly one of `lower`, `upper`, or `abstain`. `confidence` must be a decimal from 0 to 1, for example 0.65, not 65. Deep analysis is mandatory; a conclusion without chartReading, recentBehavior, supportingEvidence, decisionLogic, zoneCount, patternRecurrence, and weakestLink is invalid. zoneCount must be two non-negative integers counted from visible points you can classify by zone."
    : "Important: `predictionLabel` must be exactly one of `lower`, `upper`, or `abstain`. Never put a tail shape word such as `hold`, `rise`, `bare_low`, or `shoulder_hold` in `predictionLabel`; shape words belong only in `tailShapes`.",
  "Final reminder: output must start with `{` and end with `}`. Do not include markdown fences, file paths, target phase, date, answer digit, or action instructions.",
].join("\n\n");
