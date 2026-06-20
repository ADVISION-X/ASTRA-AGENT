import type { Pick3PlaybookPromptPackage } from "./pick3-is-blind-eval.playbook.js";
import type { Pick3PredictionLabel } from "./pick3-is-blind-eval.schema.js";

export type ParsedPick3Prediction = {
  imageId: string;
  promptPackageId: string;
  predictionLabel: Pick3PredictionLabel;
  confidence: number | null;
  tailShapes: string[] | null;
  zoneWeight: "lower_weighted" | "upper_weighted" | "balanced" | null;
  drivingEvidence: string | null;
  discountedEvidence: string | null;
  abstainReason: string | null;
  reason: string | null;
};

type AiVisiblePredictionLabel = "lower" | "upper" | "abstain";
type ParsePredictionResult = { parsed: ParsedPick3Prediction | null; reason: string | null };
type RawParsedPrediction = Partial<Omit<ParsedPick3Prediction, "predictionLabel"> & {
  predictionLabel: string;
  chartReading: unknown;
  recentBehavior: unknown;
  supportingEvidence: unknown;
  counterEvidence: unknown;
  decisionLogic: unknown;
  zoneCount: unknown;
  patternRecurrence: unknown;
  weakestLink: unknown;
}>;
type ParsedEvidenceFields = Pick<ParsedPick3Prediction, "drivingEvidence" | "discountedEvidence" | "tailShapes" | "zoneWeight">;
type FreeAnalysisProbeFields = {
  chartReading: string;
  recentBehavior: string;
  supportingEvidence: string[];
  counterEvidence: string[];
  decisionLogic: string;
  zoneCount: { lowerCount: number; upperCount: number };
  patternRecurrence: string;
  weakestLink: string;
  abstainReason: string | null;
};

const NON_DIRECTIONAL_PREDICTION_LABELS = new Set<string>([
  "hold",
  "neutral",
  "flat",
  "sideways",
  "unclear",
  "no_direction",
]);

const DIRECTIONAL_PREDICTION_LABEL_ALIASES = new Map<string, AiVisiblePredictionLabel>([
  ["down", "lower"],
  ["downward", "lower"],
  ["fall", "lower"],
  ["falling", "lower"],
  ["lower", "lower"],
  ["rise", "upper"],
  ["rising", "upper"],
  ["up", "upper"],
  ["upward", "upper"],
  ["upper", "upper"],
]);

const parseEvidenceFields = (parsed: Record<string, unknown>): { evidence: ParsedEvidenceFields | null; reason: string | null } => {
  const rawTailShapes = parsed.tailShapes;
  const tailShapes = Array.isArray(rawTailShapes) && rawTailShapes.length > 0 ? rawTailShapes.map(String) : null;
  if (!tailShapes) return { evidence: null, reason: "pick3_prediction_tail_shapes_missing" };
  const rawZoneWeight = parsed.zoneWeight;
  const zoneWeight = rawZoneWeight === "lower_weighted" || rawZoneWeight === "upper_weighted" || rawZoneWeight === "balanced"
    ? rawZoneWeight
    : null;
  if (!zoneWeight) return { evidence: null, reason: "pick3_prediction_zone_weight_invalid" };
  return {
    evidence: {
      tailShapes,
      zoneWeight,
      drivingEvidence: typeof parsed.drivingEvidence === "string" ? String(parsed.drivingEvidence) : null,
      discountedEvidence: typeof parsed.discountedEvidence === "string" ? String(parsed.discountedEvidence) : null,
    },
    reason: null,
  };
};

const readLongText = (value: unknown, minLength: number): string | null =>
  typeof value === "string" && value.trim().length >= minLength ? value.trim() : null;

const readStringArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const strings = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
  return strings.length === value.length ? strings : null;
};

const readZoneCount = (value: unknown): { lowerCount: number; upperCount: number } | null => {
  if (typeof value !== "object" || value === null) return null;
  const { lowerCount, upperCount } = value as Record<string, unknown>;
  if (typeof lowerCount !== "number" || typeof upperCount !== "number") return null;
  if (!Number.isInteger(lowerCount) || !Number.isInteger(upperCount)) return null;
  if (lowerCount < 0 || upperCount < 0) return null;
  return { lowerCount, upperCount };
};

const readFreeAnalysisProbeFields = (parsed: RawParsedPrediction, label: string): { fields: FreeAnalysisProbeFields | null; reason: string | null } => {
  const chartReading = readLongText(parsed.chartReading, 80);
  if (!chartReading) return { fields: null, reason: "pick3_free_analysis_chart_reading_missing" };
  const recentBehavior = readLongText(parsed.recentBehavior, 50);
  if (!recentBehavior) return { fields: null, reason: "pick3_free_analysis_recent_behavior_missing" };
  const supportingEvidence = readStringArray(parsed.supportingEvidence);
  const abstainReason = readLongText(parsed.abstainReason, 40);
  if (!supportingEvidence) return { fields: null, reason: "pick3_free_analysis_supporting_evidence_invalid" };
  if (supportingEvidence.length === 0 && label !== "abstain") return { fields: null, reason: "pick3_free_analysis_supporting_evidence_missing" };
  if (supportingEvidence.length === 0 && !abstainReason) return { fields: null, reason: "pick3_free_analysis_abstain_reason_missing" };
  const counterEvidence = readStringArray(parsed.counterEvidence);
  if (!counterEvidence) return { fields: null, reason: "pick3_free_analysis_counter_evidence_invalid" };
  return readFreeAnalysisProbeTail(parsed, { chartReading, recentBehavior, supportingEvidence, counterEvidence, abstainReason });
};

const readFreeAnalysisProbeTail = (
  parsed: RawParsedPrediction,
  fields: Pick<FreeAnalysisProbeFields, "chartReading" | "recentBehavior" | "supportingEvidence" | "counterEvidence" | "abstainReason">,
): { fields: FreeAnalysisProbeFields | null; reason: string | null } => {
  const decisionLogic = readLongText(parsed.decisionLogic, 80);
  if (!decisionLogic) return { fields: null, reason: "pick3_free_analysis_decision_logic_missing" };
  const zoneCount = readZoneCount(parsed.zoneCount);
  if (!zoneCount) return { fields: null, reason: "pick3_free_analysis_zone_count_invalid" };
  const patternRecurrence = readLongText(parsed.patternRecurrence, 20);
  if (!patternRecurrence) return { fields: null, reason: "pick3_free_analysis_pattern_recurrence_missing" };
  const weakestLink = readLongText(parsed.weakestLink, 20);
  if (!weakestLink) return { fields: null, reason: "pick3_free_analysis_weakest_link_missing" };
  return { fields: { ...fields, decisionLogic, zoneCount, patternRecurrence, weakestLink }, reason: null };
};

const buildFreeAnalysisEvidence = (fields: FreeAnalysisProbeFields): ParsedEvidenceFields => ({
  tailShapes: null,
  zoneWeight: null,
  drivingEvidence: fields.supportingEvidence.length > 0 ? fields.supportingEvidence.join(" | ") : fields.abstainReason,
  discountedEvidence: fields.counterEvidence.length > 0 ? fields.counterEvidence.join(" | ") : null,
});

const buildFreeAnalysisReason = (fields: FreeAnalysisProbeFields): string =>
  `chartReading: ${fields.chartReading}\nrecentBehavior: ${fields.recentBehavior}\ndecisionLogic: ${fields.decisionLogic}\nzoneCount: lower=${fields.zoneCount.lowerCount} upper=${fields.zoneCount.upperCount}\npatternRecurrence: ${fields.patternRecurrence}\nweakestLink: ${fields.weakestLink}`;

const parseFreeAnalysisEvidence = (parsed: RawParsedPrediction, label: string): { evidence: ParsedEvidenceFields; reason: string } | { evidence: null; reason: string } => {
  const probe = readFreeAnalysisProbeFields(parsed, label);
  if (!probe.fields) return { evidence: null, reason: probe.reason ?? "pick3_free_analysis_invalid" };
  return { evidence: buildFreeAnalysisEvidence(probe.fields), reason: buildFreeAnalysisReason(probe.fields) };
};

const buildAbstainPrediction = (parsed: RawParsedPrediction, evidence: ParsedEvidenceFields): ParsedPick3Prediction => ({
  imageId: parsed.imageId ?? "",
  promptPackageId: parsed.promptPackageId ?? "",
  predictionLabel: "abstain",
  confidence: null,
  ...evidence,
  abstainReason: parsed.abstainReason ?? "shape_unclear",
  reason: parsed.reason ?? null,
});

const normalizeConfidence = (value: unknown): number | null => {
  const confidence = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  return !Number.isFinite(confidence) || confidence < 0 ? null : confidence <= 1 ? confidence : confidence <= 10 ? confidence / 10 : confidence <= 100 ? confidence / 100 : null;
};

const buildDirectionalPrediction = (parsed: RawParsedPrediction, evidence: ParsedEvidenceFields): ParsePredictionResult => {
  const confidence = normalizeConfidence(parsed.confidence);
  if (confidence === null) return { parsed: null, reason: "pick3_prediction_confidence_invalid" };
  return {
    parsed: {
      imageId: parsed.imageId ?? "",
      promptPackageId: parsed.promptPackageId ?? "",
      predictionLabel: parsed.predictionLabel === "lower" ? "front" : "back",
      confidence,
      ...evidence,
      abstainReason: null,
      reason: parsed.reason ?? null,
    },
    reason: null,
  };
};

const buildNonDirectionalLabelAbstainPrediction = (
  parsed: RawParsedPrediction,
  evidence: ParsedEvidenceFields,
  rawPredictionLabel: string,
): ParsedPick3Prediction => buildAbstainPrediction({
  ...parsed,
  predictionLabel: "abstain",
  confidence: null,
  abstainReason: parsed.abstainReason ?? `non_directional_prediction_label_${rawPredictionLabel}`,
}, evidence);

const validatePredictionIdentity = (parsed: RawParsedPrediction, input: { expectedImageId: string; expectedPromptPackageId: string }): string | null => {
  if (parsed.imageId !== input.expectedImageId) return "pick3_prediction_image_id_mismatch";
  return parsed.promptPackageId === input.expectedPromptPackageId ? null : "pick3_prediction_prompt_package_id_mismatch";
};

const parsedReasonForMode = (input: { parsed: RawParsedPrediction; promptMode: Pick3PlaybookPromptPackage["promptMode"]; evidenceReason: string | null }): string | null => input.promptMode === "free_analysis_strict_reasoning"
  ? input.evidenceReason
  : input.parsed.reason ?? null;

const isProviderReportedImageMissing = (rawText: string): boolean => {
  const normalized = rawText.trim().toLowerCase();
  return normalized === "未收到图片"
    || normalized.includes("未收到图片")
    || normalized.includes("没有收到图片")
    || normalized.includes("看不到图片")
    || normalized.includes("no image")
    || normalized.includes("image not received")
    || normalized.includes("cannot see the image")
    || normalized.includes("can't see the image");
};

const parseNonDirectionalPrediction = (input: {
  parsed: RawParsedPrediction;
  promptMode: Pick3PlaybookPromptPackage["promptMode"];
  rawPredictionLabel: string;
}): ParsePredictionResult => {
  if (!NON_DIRECTIONAL_PREDICTION_LABELS.has(input.rawPredictionLabel)) {
    return { parsed: null, reason: "pick3_prediction_label_invalid" };
  }
  const evidenceResult = input.promptMode === "free_analysis_strict_reasoning"
    ? parseFreeAnalysisEvidence(input.parsed, input.rawPredictionLabel)
    : parseEvidenceFields(input.parsed as Record<string, unknown>);
  if (!evidenceResult.evidence) return { parsed: null, reason: evidenceResult.reason };
  return {
    parsed: buildNonDirectionalLabelAbstainPrediction({ ...input.parsed, reason: evidenceResult.reason }, evidenceResult.evidence, input.rawPredictionLabel),
    reason: null,
  };
};

const parseDirectionalOrAbstainPrediction = (input: {
  parsed: RawParsedPrediction;
  promptMode: Pick3PlaybookPromptPackage["promptMode"];
  rawPredictionLabel: string;
  normalizedDirectionalLabel: AiVisiblePredictionLabel | null;
}): ParsePredictionResult => {
  const evidenceLabel = input.normalizedDirectionalLabel ?? input.rawPredictionLabel;
  const evidenceResult = input.promptMode === "free_analysis_strict_reasoning"
    ? parseFreeAnalysisEvidence(input.parsed, evidenceLabel)
    : parseEvidenceFields(input.parsed as Record<string, unknown>);
  if (!evidenceResult.evidence) return { parsed: null, reason: evidenceResult.reason };
  input.parsed.predictionLabel = evidenceLabel;
  const reason = parsedReasonForMode({ parsed: input.parsed, promptMode: input.promptMode, evidenceReason: evidenceResult.reason });
  if (input.parsed.predictionLabel === "abstain") {
    return { parsed: buildAbstainPrediction({ ...input.parsed, reason }, evidenceResult.evidence), reason: null };
  }
  return buildDirectionalPrediction({ ...input.parsed, reason }, evidenceResult.evidence);
};

export const parsePick3Prediction = (input: {
  expectedImageId: string;
  expectedPromptPackageId: string;
  promptMode: Pick3PlaybookPromptPackage["promptMode"];
  rawText: string;
}): ParsePredictionResult => {
  if (isProviderReportedImageMissing(input.rawText)) {
    return { parsed: null, reason: "pick3_provider_reported_image_missing" };
  }
  try {
    const parsed = JSON.parse(input.rawText) as RawParsedPrediction;
    const identityFailure = validatePredictionIdentity(parsed, input);
    if (identityFailure) return { parsed: null, reason: identityFailure };
    const rawPredictionLabel = typeof parsed.predictionLabel === "string" ? parsed.predictionLabel.trim().toLowerCase() : "";
    const normalizedDirectionalLabel = DIRECTIONAL_PREDICTION_LABEL_ALIASES.get(rawPredictionLabel) ?? null;
    if (!normalizedDirectionalLabel && rawPredictionLabel !== "abstain") {
      return parseNonDirectionalPrediction({ parsed, promptMode: input.promptMode, rawPredictionLabel });
    }
    return parseDirectionalOrAbstainPrediction({ parsed, promptMode: input.promptMode, rawPredictionLabel, normalizedDirectionalLabel });
  } catch {
    return { parsed: null, reason: "pick3_prediction_json_invalid" };
  }
};
