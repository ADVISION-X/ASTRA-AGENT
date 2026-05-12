import { buildMuscleMemorySystemManual } from "../../../muscle-memory/manual.js";
import { listAiVisibleAbilities } from "../../../muscle-memory/catalog.js";
import type { VisualMissionActionPlanRequestInput } from "../../../types/visual-mission-action-plan.js";

const buildOutputSchemaBlock = (platformId: string) => {
  // Use only AI-visible (allowedForAiActionPlan=true) actionCodes in the example.
  const aiActions = listAiVisibleAbilities().map(e => e.actionCode);
  const clickAction = aiActions.find(a => a.startsWith("LEFT_CLICK")) ?? "LEFT_CLICK_GRID_CELL_ONCE";
  const saveAction = aiActions.find(a => a === "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE");
  if (!saveAction) {
    throw new Error(
      "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE not found in AI-visible MuscleMemory catalog. " +
      "Register it with allowedForAiActionPlan=true before building visual-mission prompts."
    );
  }

  // NOTE: Use concrete example values — the model will copy descriptive placeholders verbatim.
  // Enum fields must use one real chosen value, never pipe-separated options like a|b|c.
  // CRITICAL NESTING RULE: userIntentUnderstanding is placed LAST in the example.
  // qwen2.5vl:3b (3B param model) tracks nesting depth unreliably under format:"json".
  // If userIntentUnderstanding appears early, the model opens it and writes ALL subsequent
  // fields inside it instead of closing and returning to the top level.
  // Placing it last means all top-level fields are written before the only nested object.
  return JSON.stringify({
    schemaVersion: "visualMissionActionPlan.v1",
    platform: platformId,
    isTargetPlatform: true,
    surface: "reels feed",
    isTargetFeed: true,
    pageStateDecision: "ready",
    isProductVideo: true,
    productDecision: "product_yes",
    confidence: 0.92,
    visibleProductTypes: ["skincare"],
    visualEvidence: ["Sponsored product video visible in the current reel"],
    reason: "Identified sponsored product video and selected registered atomic abilities for evidence capture and feed continuation",
    actions: [
      {
        actionCode: saveAction,
        required: true,
        reason: "save evidence for the identified product video",
        input: { evidenceLabel: "product-video", captureMode: "fresh_current_viewport" },
      },
      {
        actionCode: clickAction,
        required: true,
        targetRole: "next_video_arrow",
        reason: "click the down arrow to advance to the next video",
        input: { gridCell: "P30" },
      },
    ],
    nonExecutableClickTargets: [],
    riskFlags: [],
    nonExecutableSummary: "Save evidence for identified product video and advance to the next feed item",
    // userIntentUnderstanding is intentionally placed LAST — see nesting rule above.
    // It contains ONLY "matched" and "summary". Do NOT add any other fields inside it.
    userIntentUnderstanding: { matched: true, summary: "User wants to trace sponsored product videos on the feed" },
  }, null, 2);
};

const buildContinuitySection = (input: VisualMissionActionPlanRequestInput) => {
  if (!input.roundMissionPacket) {
    return "Continuity Bundle: none";
  }

  return [
    `Continuity Ref: ${input.roundMissionPacketRef ?? "none"}`,
    `Continuity Payload: ${JSON.stringify(input.roundMissionPacket, null, 2)}`,
  ].join("\n");
};

const buildSystemPrompt = (platformId: string) => [
  "You are GrassEye visual-mission-judge-once.",
  "Return JSON only. Do not wrap in markdown fences.",
  `You are operating on platform: ${platformId}.`,
  "You may reason about page state, product presence, and the next governed action plan.",
  "STRUCTURE RULE: Your JSON response is a FLAT top-level object. The field 'userIntentUnderstanding' is a nested object containing ONLY 'matched' (boolean) and 'summary' (string). Do NOT place 'platform', 'surface', 'pageStateDecision', 'actions', or any other field inside 'userIntentUnderstanding'.",
  "You must NEVER return raw coordinates (x, y, clientX, clientY), DOM selectors, browser commands, Nerve Bus payloads, or Forensics payloads.",
  "You must NEVER include abilityGroupId or childCapabilityId in your output.",
  "Choose actionCode values ONLY from the capability manual (allowedForAiActionPlan=true entries).",
  "For product_yes: compose only the registered atomic actions needed for the user's goal. By default, save evidence with SAVE_CURRENT_VIDEO_EVIDENCE_ONCE using input { evidenceLabel: '<descriptive label>', captureMode: 'fresh_current_viewport' }, then advance with LEFT_CLICK_GRID_CELL_ONCE using targetRole 'next_video_arrow' on the visible DOWN ARROW navigation button on the RIGHT SIDE of the page. Do not include like_button, comments_button, comments_panel_close, or any engagement click unless the user's requirement explicitly asks for that interaction or the current page state requires it for recovery.",
  "IMPORTANT: Do NOT include a screenshot action — screenshots are injected by the system automatically after clicks and are not an AI-outputtable actionCode.",
  "For product_no: output only LEFT_CLICK_GRID_CELL_ONCE with targetRole 'next_video_arrow' targeting the DOWN ARROW navigation button on the RIGHT SIDE of the page to advance to the next video.",
  "If the evidence is insufficient or unsafe, set pageStateDecision to review_required or blocked and keep the output non-executable.",
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
    manual.text,
    "",
    `Output Schema Ref: ${input.outputSchemaRef}`,
    "Output JSON Shape (example — use actual platform and actual actionCodes from the manual):",
    buildOutputSchemaBlock(platformId),
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
