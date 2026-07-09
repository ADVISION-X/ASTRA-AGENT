type AiFeedParseStatus = "json_valid" | "json_invalid" | "not_requested";
type AiFeedSchemaValidationStatus = "valid" | "invalid" | "not_applicable";

export type AiFeedParsedOutput = {
  normalizedText: string;
  parseStatus: AiFeedParseStatus;
  parsedJson: unknown | null;
  schemaValidationStatus: AiFeedSchemaValidationStatus;
};

const parseJsonCandidate = (value: string): unknown | null => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

const extractFencedJsonCandidates = (value: string): string[] => {
  const candidates: string[] = [];
  const fencePattern = /```(?:json)?\s*([\s\S]*?)```/giu;
  for (;;) {
    const match = fencePattern.exec(value);
    if (!match) break;
    const candidate = match[1]?.trim();
    if (candidate) candidates.push(candidate);
  }
  return candidates;
};

const findBalancedJsonEnd = (value: string, startIndex: number): number => {
  const opening = value[startIndex];
  const closing = opening === "{" ? "}" : opening === "[" ? "]" : "";
  if (!closing) return -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = startIndex; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === opening) depth += 1;
    if (char === closing) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
};

const extractBalancedJsonCandidates = (value: string): string[] => {
  const candidates: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== "{" && char !== "[") continue;
    const endIndex = findBalancedJsonEnd(value, index);
    if (endIndex < 0) continue;
    candidates.push(value.slice(index, endIndex + 1).trim());
    index = endIndex;
  }
  return candidates;
};

const parseBestJson = (normalizedText: string): { normalizedText: string; parsedJson: unknown } | null => {
  const candidates = [
    normalizedText,
    ...extractFencedJsonCandidates(normalizedText),
    ...extractBalancedJsonCandidates(normalizedText),
  ];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    const parsedJson = parseJsonCandidate(trimmed);
    if (parsedJson !== null) {
      return {
        normalizedText: trimmed,
        parsedJson,
      };
    }
  }
  return null;
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
  const parsed = parseBestJson(normalizedText);
  if (parsed) {
    return {
      normalizedText: parsed.normalizedText,
      parseStatus: "json_valid",
      parsedJson: parsed.parsedJson,
      schemaValidationStatus: "not_applicable",
    };
  }
  return {
    normalizedText,
    parseStatus: "json_invalid",
    parsedJson: null,
    schemaValidationStatus: "invalid",
  };
};
