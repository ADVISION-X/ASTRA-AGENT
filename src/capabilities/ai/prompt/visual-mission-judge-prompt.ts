import { buildMuscleMemorySystemManual } from "../../../muscle-memory/manual.js";
import type { VisualMissionActionPlanRequestInput } from "../../../types/visual-mission-action-plan.js";

const buildContinuitySection = (input: VisualMissionActionPlanRequestInput) => {
  if (!input.roundMissionPacket) {
    return "Continuity Bundle: none";
  }

  return [
    `Continuity Ref: ${input.roundMissionPacketRef ?? "none"}`,
    `Continuity Payload: ${JSON.stringify(input.roundMissionPacket, null, 2)}`,
  ].join("\n");
};

const buildCompactCapabilityManual = (actions: ReturnType<typeof buildMuscleMemorySystemManual>["actions"]) =>
  actions
    .filter((action) => !["DOUBLE_LEFT_CLICK_GRID_CELL", "RIGHT_CLICK_GRID_CELL_ONCE"].includes(action.actionCode))
    .map((action) => {
      const required = action.inputContract.requiredFields.length > 0
        ? action.inputContract.requiredFields.join(",")
        : "none";
      const optional = action.inputContract.optionalFields.length > 0
        ? action.inputContract.optionalFields.join(",")
        : "none";
      return `${action.actionCode} requiredInput=${required} optionalInput=${optional}`;
    })
    .join("\n");

const buildSystemPrompt = (platformId: string) => [
  "You are GrassEye visual-mission-judge-once.",
  "Return valid JSON only. Do not wrap in markdown fences. Do not copy values from the prompt.",
  `You are operating on platform: ${platformId}.`,
  "Judge only from the current cell-name grid image and the user's requirement.",
  "A scenery, house, coastline, person, meme, or lifestyle video is not a product video unless a concrete purchasable product is visible.",
  "Use productDecision only as one of: product_yes, product_no, uncertain.",
  "Use pageStateDecision only as one of: ready, recover, review_required, blocked.",
  "userIntentUnderstanding.matched must be boolean. visualEvidence must be an array of short strings.",
  "You must NEVER return raw coordinates (x, y, clientX, clientY), DOM selectors, browser commands, Nerve Bus payloads, or Forensics payloads.",
  "You must NEVER include abilityGroupId or childCapabilityId in your output.",
  "Actions: please design click actions from my requirement using this idea only: [registered atomic actionCode] + [gridCell cell name from the current image] + [cellZone inside that named cell].",
  "Copy actionCode exactly from the capability manual, preserving uppercase letters and underscores.",
  "For a normal web button click, use LEFT_CLICK_GRID_CELL_ONCE.",
  "For a click action, put the registered actionCode in actions[].actionCode, the large cell name in actions[].input.gridCell, and one 3x3 zone in actions[].input.cellZone.",
  "cellZone must be one of: top_left, top_center, top_right, middle_left, center, middle_right, bottom_left, bottom_center, bottom_right.",
  "The centered yellow text is the name of the whole large cell. It is not a point coordinate.",
  "The current cell-name grid has exactly 8 rows and 8 columns. Valid rows are A,B,C,D,E,F,G,H. Valid columns are 1,2,3,4,5,6,7,8.",
  "Never invent a cell name that is not visibly printed in the current image. Do not output row I or later, or column 9 or larger.",
  "Use gridCell for the named large cell containing the target, and cellZone for the target's position inside that large cell.",
  "If my requirement says to continue to the next video, click the visible next-video control: the white circular down-arrow button on the far right side of the video area, below the up-arrow button, not the browser bar, top navigation, Facebook logo, or other page icons.",
  "Do not choose bottom engagement controls such as like, comment, share, or counters for next_video_arrow.",
  "The next_video_arrow is the large floating circular down-arrow on the right edge, above the bottom engagement area.",
  "For far-right controls, the chosen gridCell must use one of the largest visible column numbers.",
  "For gridCell, choose the named large cell containing the white downward chevron icon itself. Do not choose the dark area around the button, the button edge, or a nearby cell above, below, or beside it.",
  "A grid cell in the browser tabs, address bar, bookmarks bar, or top navigation is invalid for next-video control.",
  "Read cell names literally: row letters start at A on the top row and progress downward; column numbers progress left to right.",
  "For the next-video click, set actions[].targetRole to next_video_arrow.",
  "Do not stop or request review when the next-video control is visible and my requirement says to continue.",
  "Choose actionCode values only from the capability manual.",
].join("\n");

function buildUserPrompt(input: VisualMissionActionPlanRequestInput) {
  const manual = buildMuscleMemorySystemManual();
  const platformId = (input.platformContext as { platformId?: string } | null)?.platformId ?? "facebook-web";

  return [
    "User Requirement:",
    input.userRequirementText,
    "",
    "Platform Profile:",
    JSON.stringify(input.platformContext, null, 2),
    "",
    "Current Visual Evidence Refs:",
    JSON.stringify({
      originalScreenshotRef: input.originalScreenshotRef,
      coordinateGridScreenshotRef: input.coordinateGridScreenshotRef,
      gridSpecRef: input.gridSpecRef,
    }, null, 2),
    "",
    buildContinuitySection(input),
    "",
    `System Manual Ref: ${input.systemManualRef}`,
    `Resolved System Manual Ref: ${manual.systemManualRef}`,
    "Capability Manual (use ONLY these actionCodes in your output):",
    buildCompactCapabilityManual(manual.actions),
    "",
    `Output Schema Ref: ${input.outputSchemaRef}`,
    "Output Contract:",
    "Return one flat JSON object with these top-level fields: schemaVersion, platform, isTargetPlatform, surface, isTargetFeed, pageStateDecision, isProductVideo, productDecision, confidence, visibleProductTypes, visualEvidence, reason, actions, nonExecutableClickTargets, riskFlags, nonExecutableSummary, userIntentUnderstanding.",
    "schemaVersion must be visualMissionActionPlan.v1.",
    "userIntentUnderstanding.matched means you understood the user's requirement, not whether the current video is a product.",
    "userIntentUnderstanding is an object with only matched(boolean) and summary(string).",
    "visualEvidence is an array of strings describing visual facts only.",
    "actions is an array of objects. Each action has actionCode(string copied exactly from the manual), required(boolean), reason(string), targetRole(string or null), and input(object). For click actions, input has gridCell(string) and cellZone(string).",
    "nonExecutableClickTargets is an array of objects with gridCell(string) and targetName(string), or an empty array.",
  ].join("\n");
}

function buildVisualMissionJudgePrompt(input: VisualMissionActionPlanRequestInput) {
  const platformId = (input.platformContext as { platformId?: string } | null)?.platformId ?? "facebook-web";
  const systemPrompt = buildSystemPrompt(platformId);
  const userPrompt = buildUserPrompt(input);

  return {
    systemPrompt,
    userPrompt,
    fullPrompt: [systemPrompt, userPrompt].join("\n\n"),
  };
}

export { buildVisualMissionJudgePrompt };
