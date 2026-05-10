import { buildMuscleMemorySystemManual } from "../../../../muscle-memory/system-manual.js";
import { getPlatformProfile } from "../../../../platforms/index.js";
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
  '"actions":[{"actionCode":"LIKE_CURRENT_VIDEO","required":true,"input":{"gridCell":"D42"},"reason":"The visible like button is at D42."}],',
  '"nonExecutableClickTargets":[{"gridCell":"B48","targetName":"close_popup"}],',
  '"riskFlags":[],',
  '"nonExecutableSummary":"..."}',
].join("\n");

function buildPlatformRegistrySection(input: VisualMissionActionPlanRequestInput): string {
  const platformProfile = getPlatformProfile(input.platformContext.platformId);
  if (!platformProfile) {
    throw new Error(`Missing PlatformRegistry profile for ${input.platformContext.platformId}.`);
  }

  return [
    "PlatformRegistry Profile:",
    "supportedActionCodes is a platform allowlist hint only. MuscleMemoryCatalog remains the only actionCode authority.",
    JSON.stringify(platformProfile),
    "Resolved Target Binding:",
    JSON.stringify({
      platformContextRef: input.platformContextRef,
      platformContext: input.platformContext,
    }),
  ].join("\n\n");
}

function buildUserRequirementSection(input: VisualMissionActionPlanRequestInput): string {
  return [
    "## 1. User Requirement",
    input.userRequirementText,
    buildPlatformRegistrySection(input),
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
    "Choose actionCode values only from this governed catalog. For visual interaction actions, provide the required gridCell fields shown below. Never invent actionCode, childCapabilityId, or raw x/y.",
    systemManualText,
  ].join("\n\n");
}

function buildOutputFormatSection(): string {
  return [
    "## 3. Output Format",
    "Return one JSON object only. Execution uses actions[] only. For visual interaction actions, provide the required gridCell fields shown in the System Manual. CLICK_CELL and click-based composite actions must use grid cells from the coordinate-grid image. nonExecutableClickTargets is visual hinting only and must never replace actions[]. Never output raw x/y, mouseX, mouseY, clientX, or clientY. Never invent actionCode, abilityGroupId, or childCapabilityId. If a required visual target is not visible, use STOP_REVIEW_REQUIRED or another explicit recovery actionCode from the System Manual; do not guess.",
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