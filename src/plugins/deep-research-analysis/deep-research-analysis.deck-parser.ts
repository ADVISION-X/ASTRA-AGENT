import { DeepResearchBusinessDeckOutlineSchema, type DeepResearchBusinessDeckOutline } from "./deep-research-analysis.deck-schema.js";
import {
  buildFailure,
  parseJsonObject,
  type DeepResearchParserResult,
} from "./deep-research-analysis.parser-support.js";

const REQUIRED_SLIDE_TYPES = [
  "cover",
  "decision",
  "ranking",
  "logic_map",
  "risk",
  "signal",
  "limitation",
  "reference",
] as const;

const hasAllRequiredSlideTypes = (outline: DeepResearchBusinessDeckOutline): boolean => {
  const slideTypes = new Set(outline.slides.map((slide) => slide.slideType));
  return REQUIRED_SLIDE_TYPES.every((slideType) => slideTypes.has(slideType));
};

export const parseDeepResearchBusinessDeckOutlineResponse = (
  rawText: string,
): DeepResearchParserResult<DeepResearchBusinessDeckOutline> => {
  const parsedJson = parseJsonObject(rawText);
  if (parsedJson.parseStatus !== "parsed") {
    return parsedJson;
  }
  const parsed = DeepResearchBusinessDeckOutlineSchema.safeParse(parsedJson.parsed);
  if (!parsed.success) {
    return buildFailure(
      parsedJson.normalizedText,
      parsedJson.rawResponseHash,
      `invalid_business_deck_outline:${parsed.error.message}`,
      "partial_review_required",
    );
  }
  if (!hasAllRequiredSlideTypes(parsed.data)) {
    return buildFailure(
      parsedJson.normalizedText,
      parsedJson.rawResponseHash,
      "business_deck_missing_required_slide_types",
      "partial_review_required",
    );
  }
  return {
    parseStatus: parsedJson.parseStatus,
    parsed: parsed.data,
    normalizedText: parsedJson.normalizedText,
    rawResponseHash: parsedJson.rawResponseHash,
  };
};