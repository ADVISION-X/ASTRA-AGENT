import { loadMuscleMemoryCatalog, isAiActionPlanAllowedActionCode } from "../../src/muscle-memory/catalog/muscle-memory-catalog.js";
import { decodeVisualMissionActionPlan } from "../../src/muscle-memory/decoder/action-plan-decoder.js";
import { buildMuscleMemorySystemManual } from "../../src/muscle-memory/system-manual.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function getActionBlock(text: string, actionCode: string): string | null {
  return text.split("\n\n").find((block) => block.includes(`actionCode: ${actionCode}`)) ?? null;
}

const catalog = loadMuscleMemoryCatalog();
const manual = buildMuscleMemorySystemManual().text;
const clickCellBlock = getActionBlock(manual, "CLICK_CELL");
const saveLeadBlock = getActionBlock(manual, "SAVE_LEAD");

assert(!isAiActionPlanAllowedActionCode("PRESS_KEY"), "PRESS_KEY must not be AI-visible");
assert(!isAiActionPlanAllowedActionCode("PRESS_NAVIGATION_KEY"), "PRESS_NAVIGATION_KEY must not be AI-visible");
assert(isAiActionPlanAllowedActionCode("DISMISS_OVERLAY"), "DISMISS_OVERLAY must be AI-visible");
assert(!manual.includes("actionCode: PRESS_KEY"), "manual must not expose PRESS_KEY");
assert(!manual.includes("actionCode: PRESS_NAVIGATION_KEY"), "manual must not expose PRESS_NAVIGATION_KEY");
assert(clickCellBlock?.includes("aiRequiredInput: gridCell"), "CLICK_CELL manual must require gridCell only");
assert(clickCellBlock?.includes("aiOptionalInput: targetName"), "CLICK_CELL manual must expose targetName as optional AI input");
assert(clickCellBlock?.includes("systemInjectedInput: gridSpecRef, coordinateSpace"), "CLICK_CELL manual must keep gridSpecRef and coordinateSpace as systemInjectedInput");
assert(saveLeadBlock?.includes("aiRequiredInput: (none)"), "SAVE_LEAD manual must not expose AI-required input");
assert(saveLeadBlock?.includes("systemInjectedInput: requestedPlatformId, targetUrl, targetTitle, screenshotEvidenceRef, productPresenceAiResultRef"), "SAVE_LEAD manual must show its context refs as systemInjectedInput");

const decodedPlan = decodeVisualMissionActionPlan({
  plan: {
    schemaVersion: "visualMissionActionPlan.v1",
    userRequirementRef: "manual-smoke",
    muscleMemoryCatalogVersion: catalog.catalogVersion,
    platform: "tiktok-web",
    pageStateDecision: "ready",
    taskDecision: "manual smoke",
    confidence: 1,
    reason: "manual smoke composite expansion",
    actions: [
      { actionCode: "LIKE_CURRENT_VIDEO", required: true, reason: "like" },
      { actionCode: "NEXT_VIDEO", required: true, reason: "next" },
      { actionCode: "DISMISS_OVERLAY", required: false, reason: "dismiss" },
    ],
    riskFlags: [],
    nonExecutableSummary: "manual smoke composite expansion",
    contextRefs: {
      aiResultRef: null,
      originalScreenshotRef: null,
      coordinateGridScreenshotRef: null,
      gridSpecRef: null,
      visualMissionInputRef: null,
      platformContextRef: null,
    },
  },
});

const decodedSteps = decodedPlan.actions.map((action) => `${action.sourceActionCode}:${action.childCapabilityId}:${String(action.input.key ?? "")}`);
assert(decodedSteps.includes("PRESS_KEY:press-key:L"), "LIKE_CURRENT_VIDEO must expand to hidden PRESS_KEY L");
assert(decodedSteps.includes("PRESS_NAVIGATION_KEY:press-navigation-key:ArrowDown"), "NEXT_VIDEO must expand to hidden PRESS_NAVIGATION_KEY ArrowDown");
assert(decodedSteps.includes("PRESS_KEY:press-key:Escape"), "DISMISS_OVERLAY must expand to hidden PRESS_KEY Escape");

let rejectedDirectPressKey = false;
try {
  decodeVisualMissionActionPlan({
    plan: {
      schemaVersion: "visualMissionActionPlan.v1",
      userRequirementRef: "manual-smoke-direct-press-key",
      muscleMemoryCatalogVersion: catalog.catalogVersion,
      platform: "tiktok-web",
      pageStateDecision: "ready",
      taskDecision: "manual smoke direct press key",
      confidence: 1,
      reason: "manual smoke direct press key",
      actions: [
        { actionCode: "PRESS_KEY", required: true, reason: "should reject", input: { key: "Enter" } },
      ],
      riskFlags: [],
      nonExecutableSummary: "manual smoke direct press key",
      contextRefs: {
        aiResultRef: null,
        originalScreenshotRef: null,
        coordinateGridScreenshotRef: null,
        gridSpecRef: null,
        visualMissionInputRef: null,
        platformContextRef: null,
      },
    },
  });
} catch {
  rejectedDirectPressKey = true;
}

assert(rejectedDirectPressKey, "decoder must reject PRESS_KEY as a root AI actionCode");

process.stdout.write(`${JSON.stringify({
  ok: true,
  catalogVersion: catalog.catalogVersion,
  aiVisibleActionCodes: catalog.entries.filter((entry) => entry.allowedForAiActionPlan).map((entry) => entry.actionCode),
  decodedSteps,
}, null, 2)}\n`);