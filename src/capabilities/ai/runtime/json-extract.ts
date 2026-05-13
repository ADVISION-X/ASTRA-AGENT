import { z } from "zod";

import { getRegisteredAbilityById } from "../../../muscle-memory/catalog.js";
import { resolveAiActionInputPolicy } from "../../../visual-mission/action-plan/action-field-policy.js";

type JsonScannerState = {
  startIndex: number;
  depth: number;
  inString: boolean;
  escaping: boolean;
};

function extractFirstJsonObject(text: string): string {
  const state: JsonScannerState = { startIndex: -1, depth: 0, inString: false, escaping: false };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === undefined) continue;
    if (state.escaping) { state.escaping = false; continue; }
    if (char === "\\") { state.escaping = true; continue; }
    if (char === '"') { state.inString = !state.inString; continue; }
    if (state.inString) continue;
    if (char === "{") {
      if (state.depth === 0) state.startIndex = i;
      state.depth += 1;
      continue;
    }
    if (char === "}") {
      state.depth -= 1;
      if (state.depth === 0 && state.startIndex >= 0) {
        return text.slice(state.startIndex, i + 1);
      }
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
