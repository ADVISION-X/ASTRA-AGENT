import type {
  AiFeedParseStatus,
  AiFeedSchemaValidationStatus,
} from "../schema.js";

export type AiFeedParsedOutput = {
  normalizedText: string;
  parseStatus: AiFeedParseStatus;
  parsedJson: unknown | null;
  schemaValidationStatus: AiFeedSchemaValidationStatus;
};

export const parseAiFeedOutput = (
  rawText: string,
  expectedOutputSchemaRef: string | null,
): AiFeedParsedOutput => {
  const normalizedText = rawText.trim();
  if (!expectedOutputSchemaRef) {
    return {
      normalizedText,
      parseStatus: "not_requested",
      parsedJson: null,
      schemaValidationStatus: "not_applicable",
    };
  }
  try {
    return {
      normalizedText,
      parseStatus: "json_valid",
      parsedJson: JSON.parse(normalizedText) as unknown,
      schemaValidationStatus: "not_applicable",
    };
  } catch {
    return {
      normalizedText,
      parseStatus: "json_invalid",
      parsedJson: null,
      schemaValidationStatus: "invalid",
    };
  }
};
