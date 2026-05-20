import { z } from "zod";

import { getRegisteredAbilityById } from "../../../muscle-memory/catalog.js";
import { resolveAiActionInputPolicy } from "../../../visual-mission/action-plan/action-field-policy.js";

type JsonScannerState = {
  startIndex: number;
  depth: number;
  inString: boolean;
  escaping: boolean;
};

function advanceJsonStringState(state: JsonScannerState, char: string): boolean {
  if (state.escaping) {
    state.escaping = false;
    return true;
  }
  if (char === "\\") {
    state.escaping = true;
    return true;
  }
  if (char === '"') {
    state.inString = !state.inString;
    return true;
  }
  return state.inString;
}

function scanJsonBoundary(text: string, state: JsonScannerState, char: string, index: number): string | null {
  if (char === "{") {
    if (state.depth === 0) {
      state.startIndex = index;
    }
    state.depth += 1;
    return null;
  }
  if (char !== "}") {
    return null;
  }
  state.depth -= 1;
  return state.depth === 0 && state.startIndex >= 0
    ? text.slice(state.startIndex, index + 1)
    : null;
}

function extractFirstJsonObject(text: string): string {
  const state: JsonScannerState = { startIndex: -1, depth: 0, inString: false, escaping: false };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === undefined || advanceJsonStringState(state, char)) {
      continue;
    }
    const extracted = scanJsonBoundary(text, state, char, i);
    if (extracted) {
      return extracted;
    }
  }
  throw new Error("AI model output did not contain a JSON object.");
}

function pruneNextActionInputFields(parsed: Record<string, unknown>): void {
  const nextAction = parsed["nextAction"];
  if (nextAction === null || typeof nextAction !== "object" || Array.isArray(nextAction)) return;
  const actionObj = nextAction as Record<string, unknown>;
  const actionCode = typeof actionObj["actionCode"] === "string" ? actionObj["actionCode"].toUpperCase() : null;
  const input = actionObj["input"];
  if (!actionCode || input === null || typeof input !== "object" || Array.isArray(input)) return;

  const entry = getRegisteredAbilityById(actionCode);
  if (!entry) return;

  const policy = resolveAiActionInputPolicy(entry);
  const allowed = new Set([...policy.aiRequiredInput, ...policy.aiOptionalInput]);
  const cleanedInput = Object.fromEntries(
    Object.entries(input as Record<string, unknown>).filter(([field]) => allowed.has(field)),
  );
  actionObj["input"] = cleanedInput;
}

const parseAiJsonOutput = <TOutput>(text: string, schema: z.ZodSchema<TOutput>) => {
  const extractedJson = extractFirstJsonObject(text);
  const parsed = JSON.parse(extractedJson) as Record<string, unknown>;

  // Repair: qwen2.5vl:3b (3B model) sometimes nests top-level fields inside
  // userIntentUnderstanding due to unreliable JSON depth tracking.
  // Hoist any top-level fields found nested there back to the top level.
  const nested = parsed["userIntentUnderstanding"];
  if (nested !== null && typeof nested === "object" && !Array.isArray(nested)) {
    const nestedObj = nested as Record<string, unknown>;
    const TOP_LEVEL_FIELDS = [
      "goalMatched", "save", "saveReason", "confidence",
      "visualEvidence", "decision", "nextAction",
      "reviewRequiredReason", "doneReason",
    ];
    for (const field of TOP_LEVEL_FIELDS) {
      if (parsed[field] === undefined && nestedObj[field] !== undefined) {
        parsed[field] = nestedObj[field];
        delete nestedObj[field];
      }
    }
  }

  if (Array.isArray(parsed["visualEvidence"]) && parsed["visualEvidence"].length === 0) {
    parsed["visualEvidence"] = ["No visual evidence provided by model."];
  }
  if (parsed["visualEvidence"] === undefined || parsed["visualEvidence"] === null) {
    parsed["visualEvidence"] = ["No visual evidence provided by model."];
  }
  pruneNextActionInputFields(parsed);

  return schema.parse(parsed);
};

export { parseAiJsonOutput };
