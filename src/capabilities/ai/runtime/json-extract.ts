import { z } from "zod";

import { findMuscleMemoryEntry } from "../../../muscle-memory/catalog.js";
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

function pruneActionInputFields(parsed: Record<string, unknown>): void {
  const actions = parsed["actions"];
  if (!Array.isArray(actions)) return;

  for (const action of actions) {
    if (action === null || typeof action !== "object" || Array.isArray(action)) continue;
    const actionObj = action as Record<string, unknown>;
    const actionCode = typeof actionObj["actionCode"] === "string" ? actionObj["actionCode"].toUpperCase() : null;
    const input = actionObj["input"];
    if (!actionCode || input === null || typeof input !== "object" || Array.isArray(input)) continue;

    const entry = findMuscleMemoryEntry(actionCode);
    if (!entry) continue;

    const policy = resolveAiActionInputPolicy(entry);
    const allowed = new Set([...policy.aiRequiredInput, ...policy.aiOptionalInput]);
    const cleanedInput = Object.fromEntries(
      Object.entries(input as Record<string, unknown>).filter(([field]) => allowed.has(field)),
    );
    actionObj["input"] = cleanedInput;
  }
}

const SHORT_VIDEO_PLATFORM_IDS = new Set(["facebook-web", "tiktok-web"]);
const GRID_CLICK_ACTION_CODES = new Set([
  "LEFT_CLICK_GRID_CELL_ONCE",
  "DOUBLE_LEFT_CLICK_GRID_CELL",
  "RIGHT_CLICK_GRID_CELL_ONCE",
]);

function repairMissingGridCellClickActionsForShortVideo(parsed: Record<string, unknown>): void {
  const platform = typeof parsed["platform"] === "string" ? parsed["platform"] : null;
  if (!platform || !SHORT_VIDEO_PLATFORM_IDS.has(platform)) return;

  const actions = parsed["actions"];
  if (!Array.isArray(actions)) return;

  for (const action of actions) {
    if (action === null || typeof action !== "object" || Array.isArray(action)) continue;
    const actionObj = action as Record<string, unknown>;
    const actionCode = typeof actionObj["actionCode"] === "string"
      ? actionObj["actionCode"].toUpperCase()
      : null;
    if (!actionCode || !GRID_CLICK_ACTION_CODES.has(actionCode)) continue;

    const input = actionObj["input"];
    const gridCell = input !== null && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)["gridCell"]
      : null;
    if (typeof gridCell === "string" && gridCell.trim().length > 0) continue;

    const originalReason = typeof actionObj["reason"] === "string" && actionObj["reason"].trim().length > 0
      ? actionObj["reason"].trim()
      : "AI returned a click action without a gridCell.";
    actionObj["actionCode"] = "PRESS_APPROVED_KEY_ONCE";
    actionObj["targetRole"] = "next_video_arrow";
    actionObj["input"] = { approvedKey: "ArrowDown" };
    actionObj["reason"] = `${originalReason} Short-video fallback: missing gridCell cannot be clicked, so continue with ArrowDown instead of blocking the mission.`;
  }
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
      "isTargetFeed", "pageStateDecision", "isTargetPlatform", "surface",
      "isProductVideo", "productDecision", "confidence", "visibleProductTypes",
      "visualEvidence", "reason", "actions", "nonExecutableClickTargets",
      "riskFlags", "nonExecutableSummary",
    ];
    for (const field of TOP_LEVEL_FIELDS) {
      if (parsed[field] === undefined && nestedObj[field] !== undefined) {
        parsed[field] = nestedObj[field];
        delete nestedObj[field];
      }
    }
  }

  if (typeof parsed["isProductVideo"] === "string") {
    const normalized = parsed["isProductVideo"].trim().toLowerCase();
    if (normalized === "true") parsed["isProductVideo"] = true;
    if (normalized === "false") parsed["isProductVideo"] = false;
  }
  if (parsed["nonExecutableSummary"] === null) {
    parsed["nonExecutableSummary"] = "none";
  }
  if (parsed["nonExecutableSummary"] === "") {
    parsed["nonExecutableSummary"] = "none";
  }
  if (Array.isArray(parsed["visualEvidence"]) && parsed["visualEvidence"].length === 0) {
    parsed["visualEvidence"] = ["No visual evidence provided by model."];
  }
  if (parsed["visualEvidence"] === undefined || parsed["visualEvidence"] === null) {
    parsed["visualEvidence"] = ["No visual evidence provided by model."];
  }
  repairMissingGridCellClickActionsForShortVideo(parsed);
  pruneActionInputFields(parsed);

  return schema.parse(parsed);
};

export { parseAiJsonOutput };
