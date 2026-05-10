import { MuscleMemoryActionSchema } from "./schema.js";
import { MUSCLE_MEMORY_RECIPES } from "./recipes.js";

const MUSCLE_MEMORY_CATALOG_VERSION = "muscle-memory-catalog.v1";

const MUSCLE_MEMORY_ACTIONS = [
  {
    actionCode: "SAVE_LEAD",
    kind: "atomic",
    displayName: "Save Product Lead",
    description: "Persist the governed product lead record for the current visual mission decision.",
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-product-lead-record",
    inputSchemaRef: "forensics-persistence.write-product-lead-record.input",
    outputRefPolicy: ["productLeadRecordRef"],
    allowedForAiPlan: true,
    modifiesExternalWorld: false,
    requiresGridSpec: false,
    riskLevel: "evidence_write",
  },
  {
    actionCode: "PRESS_KEY",
    kind: "atomic",
    displayName: "Press Key",
    description: "Press a governed keyboard key on the current feed surface.",
    abilityGroupId: "text-input",
    childCapabilityId: "press-key",
    inputSchemaRef: "text-input.press-key.input",
    outputRefPolicy: ["textInputRuntimeProofRef"],
    allowedForAiPlan: true,
    modifiesExternalWorld: true,
    requiresGridSpec: false,
    riskLevel: "local_action",
  },
  {
    actionCode: "CLICK_CELL",
    kind: "atomic",
    displayName: "Click Grid Cell",
    description: "Resolve a governed grid cell through gridSpecRef and click the mapped browser coordinate.",
    abilityGroupId: "mouse-click",
    childCapabilityId: "click-browser-coordinate",
    inputSchemaRef: "mouse-click.click-browser-coordinate.input",
    outputRefPolicy: ["mouseClickRuntimeProofRef"],
    allowedForAiPlan: true,
    modifiesExternalWorld: true,
    requiresGridSpec: true,
    riskLevel: "external_action",
  },
  {
    actionCode: "REOPEN_ENTRY_PAGE",
    kind: "atomic",
    displayName: "Reopen Entry Page",
    description: "Reopen the governed platform entry page for the current selected platform.",
    abilityGroupId: "open",
    childCapabilityId: "open-facebook",
    platformBindings: {
      "facebook-web": { abilityGroupId: "open", childCapabilityId: "open-facebook" },
      "tiktok-web": { abilityGroupId: "open", childCapabilityId: "open-tiktok" },
    },
    inputSchemaRef: "open.platform-entry.input",
    outputRefPolicy: ["openRuntimeProofRef"],
    allowedForAiPlan: true,
    modifiesExternalWorld: true,
    requiresGridSpec: false,
    riskLevel: "external_action",
  },
  {
    actionCode: "WAIT_SHORT",
    kind: "atomic",
    displayName: "Wait Short",
    description: "Hold the local runtime briefly before the next governed screenshot capture.",
    abilityGroupId: "orchestration",
    childCapabilityId: "wait-short",
    inputSchemaRef: "orchestration.wait-short.input",
    outputRefPolicy: [],
    allowedForAiPlan: true,
    modifiesExternalWorld: false,
    requiresGridSpec: false,
    riskLevel: "observe",
  },
  {
    actionCode: "STOP_REVIEW_REQUIRED",
    kind: "atomic",
    displayName: "Stop For Review",
    description: "Fail closed and stop the mission so a human can review the current platform state.",
    abilityGroupId: "orchestration",
    childCapabilityId: "emergency-stop",
    inputSchemaRef: "orchestration.stop-review-required.input",
    outputRefPolicy: ["reviewRequiredRef"],
    allowedForAiPlan: true,
    modifiesExternalWorld: true,
    requiresGridSpec: false,
    riskLevel: "review_required",
  },
  {
    actionCode: "CAPTURE_SCREEN",
    kind: "atomic",
    displayName: "Capture Screen",
    description: "Capture a governed browser viewport screenshot for the current platform surface.",
    abilityGroupId: "screenshot",
    childCapabilityId: "capture-browser-viewport",
    inputSchemaRef: "screenshot.capture-browser-viewport.input",
    outputRefPolicy: ["screenshotArtifactRef"],
    allowedForAiPlan: true,
    modifiesExternalWorld: false,
    requiresGridSpec: false,
    riskLevel: "observe",
  },
  {
    actionCode: "PREPARE_VISUAL_INPUT",
    kind: "atomic",
    displayName: "Prepare Visual Input",
    description: "Create the original screenshot, coordinate-grid screenshot, and gridSpec bundle for a visual mission round.",
    abilityGroupId: "screenshot",
    childCapabilityId: "prepare-visual-mission-input",
    inputSchemaRef: "screenshot.prepare-visual-mission-input.input",
    outputRefPolicy: ["originalScreenshotRef", "coordinateGridScreenshotRef", "gridSpecRef", "visualMissionInputRef"],
    allowedForAiPlan: true,
    modifiesExternalWorld: false,
    requiresGridSpec: false,
    riskLevel: "observe",
  },
  ...MUSCLE_MEMORY_RECIPES.map((recipe) => ({
    actionCode: recipe.actionCode,
    kind: "recipe",
    displayName: recipe.actionCode,
    description: `Governed recipe action for ${recipe.actionCode}.`,
    inputSchemaRef: `muscle-memory.${recipe.actionCode.toLowerCase()}.input`,
    outputRefPolicy: [],
    allowedForAiPlan: recipe.actionCode !== "FOCUS_CURRENT_SURFACE",
    modifiesExternalWorld: recipe.actionCode !== "FOCUS_CURRENT_SURFACE",
    requiresGridSpec: false,
    riskLevel: recipe.actionCode === "FOCUS_CURRENT_SURFACE" ? "observe" : "local_action",
    steps: recipe.steps,
  })),
].map((entry) => MuscleMemoryActionSchema.parse(entry));

const MUSCLE_MEMORY_ACTION_BY_CODE = new Map<string, (typeof MUSCLE_MEMORY_ACTIONS)[number]>(MUSCLE_MEMORY_ACTIONS.map((entry) => [entry.actionCode, entry]));

function listMuscleMemoryActions() {
  return [...MUSCLE_MEMORY_ACTIONS];
}

function listAiPlanEligibleActions() {
  return MUSCLE_MEMORY_ACTIONS.filter((entry) => entry.allowedForAiPlan);
}

function getMuscleMemoryAction(actionCode: string) {
  return MUSCLE_MEMORY_ACTION_BY_CODE.get(actionCode) ?? null;
}

function requireMuscleMemoryAction(actionCode: string) {
  const action = getMuscleMemoryAction(actionCode);
  if (!action) {
    throw new Error(`Unknown muscle-memory actionCode: ${actionCode}`);
  }
  return action;
}

function isAiPlanEligibleActionCode(actionCode: unknown): actionCode is (typeof MUSCLE_MEMORY_ACTIONS)[number]["actionCode"] {
  return typeof actionCode === "string" && listAiPlanEligibleActions().some((entry) => entry.actionCode === actionCode);
}

export {
  MUSCLE_MEMORY_CATALOG_VERSION,
  listMuscleMemoryActions,
  listAiPlanEligibleActions,
  getMuscleMemoryAction,
  requireMuscleMemoryAction,
  isAiPlanEligibleActionCode,
};