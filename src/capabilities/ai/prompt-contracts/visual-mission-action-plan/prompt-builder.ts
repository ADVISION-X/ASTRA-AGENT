import { buildMuscleMemorySystemManual } from "../../../../muscle-memory/index.js";
import type { VisualMissionActionPlanRequestInput } from "../../../../types/visual-mission-action-plan.js";

const OUTPUT_FORMAT_GUIDE = [
  '{"schemaVersion":"visualMissionActionPlan.v1",',
  '"userIntentUnderstanding":{"matched":true,"summary":"..."},',
  '"platform":"facebook-web | tiktok-web",',
  '"isTargetPlatform":true,',
  '"surface":"reels_video | for_you_video | comments_sheet | ...",',
  '"isTargetFeed":true,',
  '"pageStateDecision":"ready | recover | review_required | blocked",',
  '"isProductVideo":true,',
  '"productDecision":"product_yes | product_no | uncertain",',
  '"confidence":0.0,',
  '"visibleProductTypes":["..."],',
  '"visualEvidence":["grounded observation"],',
  '"reason":"grounded reason",',
  '"actions":[{"actionCode":"SAVE_LEAD","required":true,"reason":"..."}],',
  '"clickTargets":[{"gridCell":"B48","targetName":"close_popup"}],',
  '"riskFlags":[],',
  '"nonExecutableSummary":"..."}',
].join("\n");

function buildUserRequirementSection(input: VisualMissionActionPlanRequestInput): string {
  return [
    "## 1. User Requirement",
    input.userRequirementText,
    "Platform Context:",
    JSON.stringify(input.platformContext),
    "Screenshot Refs:",
    JSON.stringify({
      originalScreenshotRef: input.originalScreenshotRef,
      coordinateGridScreenshotRef: input.coordinateGridScreenshotRef,
      gridSpecRef: input.gridSpecRef,
    }),
  ].join("\n\n");
}

function buildSystemManualSection(systemManualText: string): string {
  return [
    "## 2. System Manual",
    "Choose actionCode values only from this governed catalog. Never invent actionCode, childCapabilityId, or raw x/y.",
    systemManualText,
  ].join("\n\n");
}

function buildOutputFormatSection(): string {
  return [
    "## 3. Output Format",
    "Return one JSON object only. CLICK_CELL must use input.gridCell. PRESS_KEY must use input.key. Never output raw x/y, mouseX, or mouseY.",
    OUTPUT_FORMAT_GUIDE,
  ].join("\n\n");
}

function buildVisualMissionActionPlanPromptParts(input: VisualMissionActionPlanRequestInput) {
  const systemManual = buildMuscleMemorySystemManual();
  return {
    promptContractId: "visual-mission-action-plan-v1",
    systemManualRef: systemManual.systemManualRef,
    outputSchemaRef: input.outputSchemaRef,
    systemPrompt: [buildSystemManualSection(systemManual.text), buildOutputFormatSection()].join("\n\n"),
    userPrompt: buildUserRequirementSection(input),
    fullPrompt: [
      buildUserRequirementSection(input),
      buildSystemManualSection(systemManual.text),
      buildOutputFormatSection(),
    ].join("\n\n"),
  };
}

export { buildVisualMissionActionPlanPromptParts };