import { loadMuscleMemoryCatalog, isAiActionPlanAllowedActionCode } from "../../src/muscle-memory/catalog/muscle-memory-catalog.js";
import { decodeVisualMissionActionPlan } from "../../src/muscle-memory/decoder/action-plan-decoder.js";
import { buildMuscleMemorySystemManual } from "../../src/muscle-memory/system-manual.js";
import { VisualMissionActionPlanOutputSchema } from "../../src/visual-mission/action-plan/ai-output.schema.js";
import { normalizeVisualMissionActionPlanOutput } from "../../src/visual-mission/action-plan/normalize-ai-output.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function getActionBlock(text: string, actionCode: string): string | null {
  return text.split("\n\n").find((block) => block.includes(`actionCode: ${actionCode}`)) ?? null;
}

function buildBaseOutput() {
  return {
    schemaVersion: "visualMissionActionPlan.v1" as const,
    userIntentUnderstanding: { matched: true, summary: "manual smoke" },
    platform: "tiktok-web" as const,
    isTargetPlatform: true,
    surface: "for_you_video",
    isTargetFeed: true,
    pageStateDecision: "ready" as const,
    isProductVideo: true,
    productDecision: "product_yes" as const,
    confidence: 1,
    visibleProductTypes: ["smoke"],
    visualEvidence: ["visible target"],
    reason: "manual smoke",
    riskFlags: [],
    nonExecutableSummary: "manual smoke",
    nonExecutableClickTargets: [],
  };
}

function buildOutputActionPlan(action: {
  actionCode: string;
  required: boolean;
  reason: string;
  input?: Record<string, unknown>;
}) {
  return VisualMissionActionPlanOutputSchema.parse({
    ...buildBaseOutput(),
    actions: [action],
  });
}

function expectSchemaReject(action: {
  actionCode: string;
  required: boolean;
  reason: string;
  input?: Record<string, unknown>;
}, message: string) {
  const result = VisualMissionActionPlanOutputSchema.safeParse({
    ...buildBaseOutput(),
    actions: [action],
  });
  assert(!result.success, message);
}

function decodeOutput(output: ReturnType<typeof buildOutputActionPlan>) {
  return decodeVisualMissionActionPlan({
    plan: normalizeVisualMissionActionPlanOutput({ output, userRequirementRef: "manual-smoke" }),
    runtimeContext: {
      payloadRefs: {
        requestedPlatformId: "tiktok-web",
        targetUrl: "https://www.tiktok.com/foryou",
        targetTitle: "TikTok For You",
        screenshotEvidenceRef: "shot-1",
        productPresenceAiResultRef: "ai-1",
        gridSpecRef: "grid-1",
        coordinateGridScreenshotRef: "grid-shot-1",
        originalScreenshotRef: "orig-shot-1",
        platformContextRef: "platform-1",
        visualMissionInputRef: "visual-1",
        aiResultRef: "ai-1",
      },
    },
  });
}

function assertActionChain(actual: string[], expected: string[], message: string) {
  assert(actual.length === expected.length, `${message}: expected ${expected.length} steps, got ${actual.length}`);
  assert(actual.every((value, index) => value === expected[index]), `${message}: ${actual.join(" -> ")}`);
}

const catalog = loadMuscleMemoryCatalog();
const manual = buildMuscleMemorySystemManual().text;
const clickCellBlock = getActionBlock(manual, "CLICK_CELL");
const saveLeadBlock = getActionBlock(manual, "SAVE_LEAD");
const likeBlock = getActionBlock(manual, "LIKE_CURRENT_VIDEO");
const nextBlock = getActionBlock(manual, "NEXT_VIDEO");
const dismissBlock = getActionBlock(manual, "DISMISS_OVERLAY");
const openCommentsBlock = getActionBlock(manual, "OPEN_COMMENTS");
const yesFlowBlock = getActionBlock(manual, "YES_SEEDING_VIDEO_FLOW");
const noFlowBlock = getActionBlock(manual, "NO_SEEDING_VIDEO_FLOW");

assert(!isAiActionPlanAllowedActionCode("PRESS_KEY"), "PRESS_KEY must not be AI-visible");
assert(!isAiActionPlanAllowedActionCode("PRESS_NAVIGATION_KEY"), "PRESS_NAVIGATION_KEY must not be AI-visible");
assert(!isAiActionPlanAllowedActionCode("CLICK_BROWSER_COORDINATE"), "CLICK_BROWSER_COORDINATE must not be AI-visible");
assert(isAiActionPlanAllowedActionCode("DISMISS_OVERLAY"), "DISMISS_OVERLAY must be AI-visible");
assert(isAiActionPlanAllowedActionCode("OPEN_COMMENTS"), "OPEN_COMMENTS must be AI-visible");
assert(!manual.includes("actionCode: PRESS_KEY"), "manual must not expose PRESS_KEY");
assert(!manual.includes("actionCode: PRESS_NAVIGATION_KEY"), "manual must not expose PRESS_NAVIGATION_KEY");
assert(!manual.includes("actionCode: CLICK_BROWSER_COORDINATE"), "manual must not expose CLICK_BROWSER_COORDINATE");
assert(clickCellBlock?.includes("aiRequiredInput: gridCell"), "CLICK_CELL manual must require gridCell only");
assert(clickCellBlock?.includes("aiOptionalInput: targetName"), "CLICK_CELL manual must expose targetName as optional AI input");
assert(clickCellBlock?.includes("systemInjectedInput: gridSpecRef, coordinateSpace"), "CLICK_CELL manual must keep gridSpecRef and coordinateSpace as systemInjectedInput");
assert(saveLeadBlock?.includes("aiRequiredInput: (none)"), "SAVE_LEAD manual must not expose AI-required input");
assert(saveLeadBlock?.includes("systemInjectedInput: requestedPlatformId, targetUrl, targetTitle, screenshotEvidenceRef, productPresenceAiResultRef"), "SAVE_LEAD manual must show its context refs as systemInjectedInput");

assert(likeBlock?.includes("aiRequiredInput: gridCell"), "LIKE_CURRENT_VIDEO manual must require gridCell");
assert(nextBlock?.includes("aiRequiredInput: gridCell"), "NEXT_VIDEO manual must require gridCell");
assert(dismissBlock?.includes("aiRequiredInput: gridCell"), "DISMISS_OVERLAY manual must require gridCell");
assert(openCommentsBlock?.includes("aiRequiredInput: gridCell"), "OPEN_COMMENTS manual must require gridCell");
assert(yesFlowBlock?.includes("aiRequiredInput: likeGridCell, nextGridCell"), "YES_SEEDING_VIDEO_FLOW manual must require likeGridCell and nextGridCell");
assert(noFlowBlock?.includes("aiRequiredInput: nextGridCell"), "NO_SEEDING_VIDEO_FLOW manual must require nextGridCell");

expectSchemaReject(
  { actionCode: "LIKE_CURRENT_VIDEO", required: true, reason: "missing like target" },
  "LIKE_CURRENT_VIDEO without gridCell must be rejected",
);
expectSchemaReject(
  { actionCode: "NEXT_VIDEO", required: true, reason: "missing next target" },
  "NEXT_VIDEO without gridCell must be rejected",
);
expectSchemaReject(
  { actionCode: "DISMISS_OVERLAY", required: true, reason: "missing dismiss target" },
  "DISMISS_OVERLAY without gridCell must be rejected",
);
expectSchemaReject(
  { actionCode: "OPEN_COMMENTS", required: true, reason: "missing comments target" },
  "OPEN_COMMENTS without gridCell must be rejected",
);
expectSchemaReject(
  { actionCode: "YES_SEEDING_VIDEO_FLOW", required: true, reason: "missing like target", input: { nextGridCell: "K50" } },
  "YES_SEEDING_VIDEO_FLOW without likeGridCell must be rejected",
);
expectSchemaReject(
  { actionCode: "YES_SEEDING_VIDEO_FLOW", required: true, reason: "missing next target", input: { likeGridCell: "D42" } },
  "YES_SEEDING_VIDEO_FLOW without nextGridCell must be rejected",
);
expectSchemaReject(
  { actionCode: "NO_SEEDING_VIDEO_FLOW", required: true, reason: "missing next target" },
  "NO_SEEDING_VIDEO_FLOW without nextGridCell must be rejected",
);
expectSchemaReject(
  { actionCode: "LIKE_CURRENT_VIDEO", required: true, reason: "raw coordinates", input: { x: 10, y: 20 } },
  "raw x/y must be rejected for click-first visual actions",
);
expectSchemaReject(
  { actionCode: "PRESS_KEY", required: true, reason: "direct key", input: { key: "Enter" } },
  "PRESS_KEY must be rejected as a root AI actionCode",
);
expectSchemaReject(
  { actionCode: "CLICK_BROWSER_COORDINATE", required: true, reason: "direct coordinate", input: { x: 10, y: 20 } },
  "CLICK_BROWSER_COORDINATE must be rejected as a root AI actionCode",
);

const validLike = buildOutputActionPlan({
  actionCode: "LIKE_CURRENT_VIDEO",
  required: true,
  reason: "like button visible at D42",
  input: { gridCell: "D42" },
});
const validNext = buildOutputActionPlan({
  actionCode: "NEXT_VIDEO",
  required: true,
  reason: "next target visible at K50",
  input: { gridCell: "K50" },
});
const validDismiss = buildOutputActionPlan({
  actionCode: "DISMISS_OVERLAY",
  required: true,
  reason: "close button visible at A49",
  input: { gridCell: "A49" },
});
const validOpenComments = buildOutputActionPlan({
  actionCode: "OPEN_COMMENTS",
  required: true,
  reason: "comments button visible at F47",
  input: { gridCell: "F47" },
});
const validYesFlow = buildOutputActionPlan({
  actionCode: "YES_SEEDING_VIDEO_FLOW",
  required: true,
  reason: "save, like, then continue",
  input: { likeGridCell: "D42", nextGridCell: "K50" },
});
const validNoFlow = buildOutputActionPlan({
  actionCode: "NO_SEEDING_VIDEO_FLOW",
  required: true,
  reason: "continue browsing",
  input: { nextGridCell: "K50" },
});

const likeChain = decodeOutput(validLike).actions.map((action) => `${action.abilityGroupId}/${action.childCapabilityId}`);
const nextChain = decodeOutput(validNext).actions.map((action) => `${action.abilityGroupId}/${action.childCapabilityId}`);
const openCommentsChain = decodeOutput(validOpenComments).actions.map((action) => `${action.abilityGroupId}/${action.childCapabilityId}`);
const yesFlowChain = decodeOutput(validYesFlow).actions.map((action) => `${action.abilityGroupId}/${action.childCapabilityId}`);

assertActionChain(
  likeChain,
  ["geometry-guard/validate-click-point", "mouse-click/click-browser-coordinate"],
  "LIKE_CURRENT_VIDEO must expand through Geometry Guard and Mouse Click",
);
assertActionChain(
  nextChain,
  ["geometry-guard/validate-click-point", "mouse-click/click-browser-coordinate"],
  "NEXT_VIDEO must expand through Geometry Guard and Mouse Click",
);
assertActionChain(
  openCommentsChain,
  ["geometry-guard/validate-click-point", "mouse-click/click-browser-coordinate"],
  "OPEN_COMMENTS must expand through Geometry Guard and Mouse Click",
);
assertActionChain(
  yesFlowChain,
  [
    "forensics-persistence/write-product-lead-record",
    "geometry-guard/validate-click-point",
    "mouse-click/click-browser-coordinate",
    "geometry-guard/validate-click-point",
    "mouse-click/click-browser-coordinate",
  ],
  "YES_SEEDING_VIDEO_FLOW must save lead, then click like, then click next",
);

assert(validDismiss.actions[0]?.input?.gridCell === "A49", "DISMISS_OVERLAY with gridCell must be accepted");
assert(validNoFlow.actions[0]?.input?.nextGridCell === "K50", "NO_SEEDING_VIDEO_FLOW with nextGridCell must be accepted");

process.stdout.write(`${JSON.stringify({
  ok: true,
  catalogVersion: catalog.catalogVersion,
  aiVisibleActionCodes: catalog.entries.filter((entry) => entry.allowedForAiActionPlan).map((entry) => entry.actionCode),
  likeChain,
  nextChain,
  openCommentsChain,
  yesFlowChain,
}, null, 2)}\n`);