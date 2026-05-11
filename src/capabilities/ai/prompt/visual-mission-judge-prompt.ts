import { buildMuscleMemorySystemManual } from "../../../muscle-memory/manual.js";
import { listAiVisibleAbilities } from "../../../muscle-memory/catalog.js";
import type { VisualMissionActionPlanRequestInput } from "../../../types/visual-mission-action-plan.js";

const buildOutputSchemaBlock = (platformId: string) => {
  // Use only AI-visible (allowedForAiActionPlan=true) actionCodes in the example.
  const aiActions = listAiVisibleAbilities().map(e => e.actionCode);
  const clickAction = aiActions.find(a => a.startsWith("LEFT_CLICK")) ?? "LEFT_CLICK_GRID_CELL_ONCE";
  const scrollAction = aiActions.find(a => a.startsWith("SCROLL")) ?? "SCROLL_BROWSER_VIEWPORT_ONCE";
  const saveAction = aiActions.find(a => a === "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE") ?? scrollAction;

  return JSON.stringify({
    schemaVersion: "visualMissionActionPlan.v1",
    userIntentUnderstanding: { matched: true, summary: "string — describe what you understood" },
    platform: platformId,
    isTargetPlatform: true,
    surface: "string — e.g. reels feed",
    isTargetFeed: true,
    pageStateDecision: "ready|recover|review_required|blocked",
    isProductVideo: true,
    productDecision: "product_yes|product_no|uncertain",
    confidence: 0.9,
    visibleProductTypes: ["string — e.g. skincare, food"],
    visualEvidence: ["string — what you see in the screenshot that supports the decision"],
    reason: "string — explanation of the decision",
    actions: [
      {
        actionCode: clickAction,
        required: true,
        reason: "string — why this action",
        input: { gridCell: "B3" },
      },
      {
        actionCode: saveAction,
        required: true,
        reason: "save product video evidence",
        input: { evidenceLabel: "product-video", reason: "product_yes" },
      },
      {
        actionCode: scrollAction,
        required: true,
        reason: "move to next video",
        input: { scrollDeltaY: 900 },
      },
    ],
    nonExecutableClickTargets: [{ gridCell: "B3", targetName: "like button" }],
    riskFlags: ["string"],
    nonExecutableSummary: "string — brief description of what will happen",
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
  "You must NEVER return raw coordinates (x, y, clientX, clientY), DOM selectors, browser commands, Nerve Bus payloads, or Forensics payloads.",
  "You must NEVER include abilityGroupId or childCapabilityId in your output.",
  "Choose actionCode values ONLY from the capability manual (allowedForAiActionPlan=true entries).",
  "For product_yes: output like -> comments -> screenshot -> save-evidence -> next-video action sequence.",
  "For product_no: output only the next-video action.",
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