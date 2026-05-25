import { createHash } from "node:crypto";

type DeepResearchParserFailureStatus =
  | "parse_failed_raw_available"
  | "partial_review_required"
  | "failed"
  | "failed_empty"
  | "failed_unusable";

type DeepResearchParserSuccessStatus =
  | "parsed"
  | "parsed_with_trailing_noise"
  | "parsed_json"
  | "parsed_json_from_fence"
  | "parsed_json_from_balanced_object"
  | "parsed_text_raw_index"
  | "raw_structured_text"
  | "parsed_json_index";

type DeepResearchParserFailure = {
  parseStatus: DeepResearchParserFailureStatus;
  parsed: null;
  normalizedText: string;
  rawResponseHash: string;
  reason: string;
};

type DeepResearchParserSuccess<T> = {
  parseStatus: DeepResearchParserSuccessStatus;
  parsed: T;
  normalizedText: string;
  rawResponseHash: string;
};

export type DeepResearchParserResult<T> =
  | DeepResearchParserFailure
  | DeepResearchParserSuccess<T>;

const buildTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

const successfulParseStatuses = new Set<DeepResearchParserSuccessStatus>([
  "parsed",
  "parsed_with_trailing_noise",
  "parsed_json",
  "parsed_json_from_fence",
  "parsed_json_from_balanced_object",
  "parsed_text_raw_index",
  "raw_structured_text",
  "parsed_json_index",
]);

export const isDeepResearchSuccessfulParseStatus = (
  parseStatus: string,
): parseStatus is DeepResearchParserSuccessStatus =>
  successfulParseStatuses.has(parseStatus as DeepResearchParserSuccessStatus);

export const isDeepResearchParserSuccess = <T>(
  result: DeepResearchParserResult<T>,
): result is DeepResearchParserSuccess<T> =>
  result.parsed !== null && isDeepResearchSuccessfulParseStatus(result.parseStatus);

export const buildParsedResult = <T>(input: {
  parsed: T;
  normalizedText: string;
  rawResponseHash: string;
  parseStatus?: DeepResearchParserSuccessStatus;
}): DeepResearchParserSuccess<T> => ({
  parseStatus: input.parseStatus ?? "parsed",
  parsed: input.parsed,
  normalizedText: input.normalizedText,
  rawResponseHash: input.rawResponseHash,
});

export const buildFailure = (
  normalizedText: string,
  rawResponseHash: string,
  reason: string,
  parseStatus: DeepResearchParserFailure["parseStatus"] = normalizedText
    ? "parse_failed_raw_available"
    : "failed_empty",
): DeepResearchParserFailure => ({
  parseStatus,
  parsed: null,
  normalizedText,
  rawResponseHash,
  reason,
});

const normalizeRawText = (rawText: string): string => rawText.trim();

const extractCandidateJson = (rawText: string): {
  candidateJson: string;
  parseStatus: DeepResearchParserSuccessStatus;
} => {
  const trimmed = normalizeRawText(rawText);
  if (trimmed.startsWith("```")) {
    const withoutFenceStart = trimmed.replace(/^```(?:json)?\s*/u, "");
    return {
      candidateJson: withoutFenceStart.replace(/\s*```$/u, "").trim(),
      parseStatus: "parsed_json_from_fence",
    };
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return {
      candidateJson: trimmed.slice(firstBrace, lastBrace + 1).trim(),
      parseStatus: firstBrace === 0 && lastBrace === trimmed.length - 1
        ? "parsed_json"
        : "parsed_json_from_balanced_object",
    };
  }
  return {
    candidateJson: trimmed,
    parseStatus: "parsed_json",
  };
};

export const parseJsonObject = (rawText: string): DeepResearchParserResult<unknown> => {
  const normalizedText = normalizeRawText(rawText);
  const rawResponseHash = buildTextHash(normalizedText);
  if (!normalizedText) {
    return buildFailure(normalizedText, rawResponseHash, "empty_ai_response", "failed_empty");
  }
  const candidateJson = extractCandidateJson(normalizedText);
  try {
    const parsed = JSON.parse(candidateJson.candidateJson) as unknown;
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
      return buildFailure(normalizedText, rawResponseHash, "ai_response_must_be_json_object", "failed_unusable");
    }
    return buildParsedResult({
      parsed,
      normalizedText,
      rawResponseHash,
      parseStatus: candidateJson.parseStatus,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid_json";
    return buildFailure(normalizedText, rawResponseHash, `json_parse_failed:${reason}`, "failed_unusable");
  }
};
