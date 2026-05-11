import { readFileSync } from "node:fs";

import type { Project } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { loadMuscleMemoryCatalog, isAiActionPlanAllowedActionCode } from "../../../../src/muscle-memory/catalog/muscle-memory-catalog.js";
import { decodeVisualMissionActionPlan } from "../../../../src/muscle-memory/decoder/action-plan-decoder.js";
import { buildMuscleMemorySystemManual } from "../../../../src/muscle-memory/system-manual.js";

const LAW_ID = "GRASSEYE-AI-CAPABILITY-002-V1";
const SYSTEM_MANUAL_FILE = "src/muscle-memory/system-manual.ts";
const AI_OUTPUT_SCHEMA_FILE = "src/visual-mission/action-plan/ai-output.schema.ts";
const CATALOG_FILE = "src/muscle-memory/catalog/muscle-memory-catalog.generated.json";
const ATTACK_DOC_FILE = "audit/muscle-memory-action-four-way-attack.md";
const PROMPT_BUILDER_FILE = "src/capabilities/ai/prompt-contracts/visual-mission-action-plan/prompt-builder.ts";
const HIDDEN_ACTION_CODES = [
  "PRESS_KEY",
  "PRESS_NAVIGATION_KEY",
  "CLICK_BROWSER_COORDINATE",
  "CAPTURE_SCREEN",
  "PREPARE_VISUAL_MISSION_INPUT",
  "CAPTURE_REGION",
  "VISUAL_MISSION_JUDGE",
  "WRITE_ACTION_LOG",
  "WRITE_AI_RESULT",
] as const;
const HUMAN_IN_LOOP_ACTION_CODES = [
  "approve-candidate",
  "reject-candidate",
  "mark-review-required",
  "ASK_HUMAN",
  "WAIT_FOR_HUMAN",
  "HUMAN_APPROVE",
  "HUMAN_REJECT",
  "REQUEST_OPERATOR_CLICK",
] as const;
const REQUIRED_VISIBLE_ACTION_CODES = [
  "OPEN_FACEBOOK_ENTRY",
  "OPEN_TIKTOK_ENTRY",
  "CLICK_CELL",
  "LIKE_CURRENT_VIDEO",
  "NEXT_VIDEO",
  "DISMISS_OVERLAY",
  "SAVE_LEAD",
  "SAVE_PRODUCT_AND_LIKE",
  "YES_SEEDING_VIDEO_FLOW",
  "NO_SEEDING_VIDEO_FLOW",
  "STOP_REVIEW_REQUIRED",
] as const;

function createActionSurfaceFinding(file: string, message: string): Finding {
  return createFinding({
    lawId: LAW_ID,
    file,
    line: 1,
    severity: "fatal",
    message,
  });
}

function getActionBlock(text: string, actionCode: string): string | null {
  return text.split("\n\n").find((block) => block.includes(`actionCode: ${actionCode}`)) ?? null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasAllowAttackRow(attackDoc: string, actionCode: string): boolean {
  const pattern = new RegExp(`^\\|\\s*${escapeRegExp(actionCode)}\\s*\\|\\s*PASS\\s*\\|\\s*PASS\\s*\\|\\s*PASS\\s*\\|\\s*PASS\\s*\\|\\s*ALLOW\\s*\\|$`, "m");
  return pattern.test(attackDoc);
}

function collectCatalogVisibilityFindings(): Finding[] {
  const visibleActionCodes = new Set(loadMuscleMemoryCatalog().entries.filter((entry) => entry.allowedForAiActionPlan).map((entry) => entry.actionCode));
  return [
    ...HIDDEN_ACTION_CODES.flatMap((actionCode) => visibleActionCodes.has(actionCode)
      ? [createActionSurfaceFinding(CATALOG_FILE, `${actionCode} must stay AI-hidden and must not appear in the AI-visible muscle-memory surface.`)]
      : []),
    ...REQUIRED_VISIBLE_ACTION_CODES.flatMap((actionCode) => !visibleActionCodes.has(actionCode)
      ? [createActionSurfaceFinding(CATALOG_FILE, `${actionCode} must remain AI-visible as a governed semantic action.`)]
      : []),
    ...HUMAN_IN_LOOP_ACTION_CODES.flatMap((actionCode) => visibleActionCodes.has(actionCode)
      ? [createActionSurfaceFinding(CATALOG_FILE, `${actionCode} must stay out of the AI-visible action surface because ordinary human-in-loop actions are fail-closed.`)]
      : []),
  ];
}

function exposesHiddenKeyActions(manualText: string): boolean {
  return manualText.includes("actionCode: PRESS_KEY") || manualText.includes("actionCode: PRESS_NAVIGATION_KEY");
}

function hasValidClickCellManualBlock(block: string | null): boolean {
  return Boolean(
    block
    && block.includes("aiRequiredInput: gridCell")
    && block.includes("aiOptionalInput: targetName")
    && block.includes("systemInjectedInput: gridSpecRef, coordinateSpace")
    && !block.includes("aiRequiredInput: gridCell, gridSpecRef"),
  );
}

function hasValidSaveLeadManualBlock(block: string | null): boolean {
  return Boolean(
    block
    && block.includes("aiRequiredInput: (none)")
    && block.includes("systemInjectedInput: requestedPlatformId, targetUrl, targetTitle, screenshotEvidenceRef, productPresenceAiResultRef"),
  );
}

function collectManualOutputFindings(): Finding[] {
  const manualText = buildMuscleMemorySystemManual().text;
  const findings: Finding[] = [];
  const clickCellBlock = getActionBlock(manualText, "CLICK_CELL");
  const saveLeadBlock = getActionBlock(manualText, "SAVE_LEAD");

  if (exposesHiddenKeyActions(manualText)) {
    findings.push(createActionSurfaceFinding(SYSTEM_MANUAL_FILE, "AI manual must not expose PRESS_KEY or PRESS_NAVIGATION_KEY once low-level key actions are hidden from AI planning."));
  }
  if (!manualText.includes("actionCode: DISMISS_OVERLAY")) {
    findings.push(createActionSurfaceFinding(SYSTEM_MANUAL_FILE, "AI manual must expose DISMISS_OVERLAY as the governed overlay-dismiss semantic action."));
  }
  if (!hasValidClickCellManualBlock(clickCellBlock)) {
    findings.push(createActionSurfaceFinding(SYSTEM_MANUAL_FILE, "CLICK_CELL manual block must show gridCell as AI-required input, targetName as AI-optional input, and gridSpecRef/coordinateSpace as systemInjectedInput only."));
  }
  if (!hasValidSaveLeadManualBlock(saveLeadBlock)) {
    findings.push(createActionSurfaceFinding(SYSTEM_MANUAL_FILE, "SAVE_LEAD manual block must keep targetUrl, targetTitle, screenshotEvidenceRef, and productPresenceAiResultRef in systemInjectedInput instead of AI-required input."));
  }

  return findings;
}

function collectNoHumanInLoopPromptFindings(): Finding[] {
  const findings: Finding[] = [];
  const promptBuilderText = readFileSync(pathFromRepoRoot(PROMPT_BUILDER_FILE), "utf8");

  if (!promptBuilderText.includes("Do not ask the human to choose ordinary next actions")
    || !promptBuilderText.includes("STOP_REVIEW_REQUIRED")) {
    findings.push(createActionSurfaceFinding(PROMPT_BUILDER_FILE, "Visual mission prompt must explicitly forbid ordinary human-in-loop action selection and direct the model to STOP_REVIEW_REQUIRED when blocked."));
  }

  for (const actionCode of HUMAN_IN_LOOP_ACTION_CODES) {
    if (!promptBuilderText.includes(actionCode)) {
      findings.push(createActionSurfaceFinding(PROMPT_BUILDER_FILE, `Visual mission prompt must explicitly forbid ${actionCode} from the AI-visible output surface.`));
    }
  }

  return findings;
}

function buildCompositeExpansionAuditPlan(catalogVersion: string) {
  return {
    schemaVersion: "visualMissionActionPlan.v1" as const,
    userRequirementRef: "audit-visual-mission-action-surface",
    muscleMemoryCatalogVersion: catalogVersion,
    platform: "tiktok-web" as const,
    pageStateDecision: "ready" as const,
    taskDecision: "audit-composite-expansion",
    confidence: 1,
    reason: "audit composite expansion coverage",
    actions: [
      { actionCode: "LIKE_CURRENT_VIDEO", required: true, reason: "like current video" },
      { actionCode: "NEXT_VIDEO", required: true, reason: "advance to next video" },
      { actionCode: "DISMISS_OVERLAY", required: false, reason: "dismiss lightweight overlay" },
    ],
    riskFlags: [],
    nonExecutableSummary: "audit composite expansion coverage",
    contextRefs: {
      aiResultRef: null,
      originalScreenshotRef: null,
      coordinateGridScreenshotRef: null,
      gridSpecRef: null,
      visualMissionInputRef: null,
      platformContextRef: null,
    },
  };
}

function buildRootPressKeyAuditPlan(catalogVersion: string) {
  return {
    schemaVersion: "visualMissionActionPlan.v1" as const,
    userRequirementRef: "audit-press-key-root-rejection",
    muscleMemoryCatalogVersion: catalogVersion,
    platform: "tiktok-web" as const,
    pageStateDecision: "ready" as const,
    taskDecision: "reject direct press key",
    confidence: 1,
    reason: "reject direct press key",
    actions: [
      { actionCode: "PRESS_KEY", required: true, reason: "should fail", input: { key: "Enter" } },
    ],
    riskFlags: [],
    nonExecutableSummary: "reject direct press key",
    contextRefs: {
      aiResultRef: null,
      originalScreenshotRef: null,
      coordinateGridScreenshotRef: null,
      gridSpecRef: null,
      visualMissionInputRef: null,
      platformContextRef: null,
    },
  };
}

function rejectsRootPressKeyAction(catalogVersion: string): boolean {
  try {
    decodeVisualMissionActionPlan({ plan: buildRootPressKeyAuditPlan(catalogVersion) });
    return false;
  } catch (error) {
    const failureMessage = error instanceof Error ? error.message : String(error);
    return failureMessage.length > 0;
  }
}

function collectDecoderClosureFindings(): Finding[] {
  const findings: Finding[] = [];
  const catalogVersion = loadMuscleMemoryCatalog().catalogVersion;
  const decodedPlan = decodeVisualMissionActionPlan({
    plan: buildCompositeExpansionAuditPlan(catalogVersion),
  });
  const decodedSteps = decodedPlan.actions.map((action) => `${action.sourceActionCode}:${action.childCapabilityId}:${String(action.input.key ?? "")}`);

  if (!decodedSteps.includes("PRESS_KEY:press-key:L") || !decodedSteps.includes("PRESS_NAVIGATION_KEY:press-navigation-key:ArrowDown") || !decodedSteps.includes("PRESS_KEY:press-key:Escape")) {
    findings.push(createActionSurfaceFinding(AI_OUTPUT_SCHEMA_FILE, "AI-visible composites must still expand into hidden low-level key atomic actions through the decoder path."));
  }

  if (isAiActionPlanAllowedActionCode("PRESS_KEY") || isAiActionPlanAllowedActionCode("PRESS_NAVIGATION_KEY")) {
    findings.push(createActionSurfaceFinding(CATALOG_FILE, "Low-level key actions must be rejected at the AI-visible actionCode allow-list gate."));
  }

  if (!rejectsRootPressKeyAction(catalogVersion)) {
    findings.push(createActionSurfaceFinding(AI_OUTPUT_SCHEMA_FILE, "AI output schema and decoder must reject PRESS_KEY as a root AI actionCode once the low-level key surface is hidden."));
  }

  return findings;
}

function collectFourWayAttackFindings(): Finding[] {
  const attackDoc = readFileSync(pathFromRepoRoot(ATTACK_DOC_FILE), "utf8");
  return loadMuscleMemoryCatalog().entries
    .filter((entry) => entry.allowedForAiActionPlan)
    .flatMap((entry) => hasAllowAttackRow(attackDoc, entry.actionCode)
      ? []
      : [createActionSurfaceFinding(ATTACK_DOC_FILE, `${entry.actionCode} is AI-visible but has no PASS/PASS/PASS/PASS/ALLOW four-way attack entry.`)]);
}

export const inspectVisualMissionActionSurface = (_project: Project): Finding[] => [
  ...collectCatalogVisibilityFindings(),
  ...collectManualOutputFindings(),
  ...collectNoHumanInLoopPromptFindings(),
  ...collectDecoderClosureFindings(),
  ...collectFourWayAttackFindings(),
];