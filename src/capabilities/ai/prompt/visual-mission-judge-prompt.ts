import { buildMuscleMemorySystemManual } from "../../../muscle-memory/manual.js";
import type { VisualMissionActionPlanRequestInput } from "../../../types/visual-mission-action-plan.js";

const buildOutputSchemaBlock = () => JSON.stringify({
  schemaVersion: "visualMissionActionPlan.v1",
  userIntentUnderstanding: { matched: true, summary: "string" },
  platform: "tiktok-web",
  isTargetPlatform: true,
  surface: "string",
  isTargetFeed: true,
  pageStateDecision: "ready|recover|review_required|blocked",
  isProductVideo: true,
  productDecision: "product_yes|product_no|uncertain",
  confidence: 0.9,
  visibleProductTypes: ["string"],
  visualEvidence: ["string"],
  reason: "string",
  actions: [{ actionCode: "SAVE_LEAD", required: true, reason: "string", input: { gridCell: "B3" } }],
  nonExecutableClickTargets: [{ gridCell: "B3", targetName: "product card" }],
  riskFlags: ["string"],
  nonExecutableSummary: "string",
}, null, 2);

const buildContinuitySection = (input: VisualMissionActionPlanRequestInput) => {
  if (!input.roundMissionPacket) {
    return "Continuity Bundle: none";
  }

  return [
    `Continuity Ref: ${input.roundMissionPacketRef ?? "none"}`,
    `Continuity Payload: ${JSON.stringify(input.roundMissionPacket, null, 2)}`,
  ].join("\n");
};

const buildSystemPrompt = () => [
  "You are GrassEye visual-mission-judge-once.",
  "Return JSON only.",
  "You may reason about page state, product presence, and the next governed action plan.",
  "You must never return raw coordinates, DOM selectors, browser commands, Nerve Bus payloads, or Forensics payloads.",
  "Choose actionCode values only from the capability manual.",
  "If the evidence is insufficient or unsafe, set pageStateDecision to review_required or blocked and keep the output non-executable.",
].join("\n");

function buildUserPrompt(input: VisualMissionActionPlanRequestInput) {
  const manual = buildMuscleMemorySystemManual();

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
    "Capability Manual:",
    manual.text,
    "",
    `Output Schema Ref: ${input.outputSchemaRef}`,
    "Output JSON Shape:",
    buildOutputSchemaBlock(),
  ].join("\n");
}

function buildVisualMissionJudgePrompt(input: VisualMissionActionPlanRequestInput) {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(input);

  return {
    systemPrompt,
    userPrompt,
    fullPrompt: [systemPrompt, userPrompt].join("\n\n"),
  };
}

export { buildVisualMissionJudgePrompt };