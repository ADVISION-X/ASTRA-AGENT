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
  '"actions":[{"actionCode":"CLICK_CELL","required":true,"input":{"gridCell":"D42","targetName":"like_button"},"reason":"The visible like button is at D42."}],',
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
    "## 3. Platform Registry",
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

function buildRoundMissionPacketSection(input: VisualMissionActionPlanRequestInput): string {
  return [
    "## 1. Round Mission Packet",
    "You are stateless across rounds. Use the Round Mission Packet as the only continuity source for mission intent, progress, prior action outcome, and current evidence. Do not assume memory from previous AI calls.",
    `Original human mission (roundMissionPacket.mission.userRequirementText): ${input.roundMissionPacket.mission.userRequirementText}`,
    JSON.stringify({
      roundMissionPacketRef: input.roundMissionPacketRef,
      roundMissionPacket: input.roundMissionPacket,
    }),
  ].join("\n\n");
}

function buildCurrentVisualEvidenceSection(input: VisualMissionActionPlanRequestInput): string {
  return [
    "## 2. Current Visual Evidence",
    "Re-evaluate from the current screenshot refs below, not from prior chat memory.",
    JSON.stringify({
      originalScreenshotRef: input.originalScreenshotRef,
      coordinateGridScreenshotRef: input.coordinateGridScreenshotRef,
      gridSpecRef: input.gridSpecRef,
      visualMissionInputRef: input.roundMissionPacket.currentEvidence.visualMissionInputRef,
      pageStateRef: input.roundMissionPacket.currentEvidence.pageStateRef,
    }),
  ].join("\n\n");
}

function buildSystemManualSection(systemManualText: string): string {
  return [
    "## 4. System Manual",
    "Choose actionCode values only from this governed catalog. For visual interaction actions, provide the required gridCell fields shown below. Never invent actionCode, childCapabilityId, or raw x/y.",
    "The human only owns the initial mission intent and safety boundary. Do not ask the human to choose ordinary next actions, approvals, rejections, recovery clicks, or browsing decisions.",
    "If blocked, unsafe, uncertain, or repeated failures do not expose a clear governed recovery from the current evidence, output STOP_REVIEW_REQUIRED.",
    systemManualText,
  ].join("\n\n");
}

function buildOutputFormatSection(): string {
  return [
    "## 5. Output Format",
    "Return one JSON object only. Execution uses actions[] only. For visual interaction actions, provide the required gridCell fields shown in the System Manual. CLICK_CELL must use a grid cell from the coordinate-grid image and may include targetName only when the registry allows it. nonExecutableClickTargets is visual hinting only and must never replace actions[]. Never output raw x/y, mouseX, mouseY, clientX, or clientY. Never invent actionCode, abilityGroupId, or childCapabilityId. Never output approve-candidate, reject-candidate, mark-review-required, ASK_HUMAN, WAIT_FOR_HUMAN, HUMAN_APPROVE, HUMAN_REJECT, or REQUEST_OPERATOR_CLICK. If a required visual target is not visible, use STOP_REVIEW_REQUIRED or another explicit atomic recovery actionCode from the System Manual; do not guess and do not ask the human for ordinary action selection.",
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
    userPrompt: [
      buildRoundMissionPacketSection(input),
      buildCurrentVisualEvidenceSection(input),
      buildPlatformRegistrySection(input),
    ].join("\n\n"),
    fullPrompt: [
      buildRoundMissionPacketSection(input),
      buildCurrentVisualEvidenceSection(input),
      buildPlatformRegistrySection(input),
      buildSystemManualSection(systemManual.text),
      buildOutputFormatSection(),
    ].join("\n\n"),
  };
}

export { buildVisualMissionActionPlanPromptParts };