import { readFileSync } from "node:fs";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { loadBuiltinMapPackages } from "../../../../src/map-plugins/builtins/index.js";
import { MAP_PLUGIN_LAWS, MAP_PLUGIN_PATHS } from "./constants.js";
import { TARGET_PACKAGE_IDS, inspectSeedingStartupPreparation } from "./startup-preparation-entry-spine-checks.js";

const { ROOT } = MAP_PLUGIN_PATHS;
const INSPECTOR_FILE = "scripts/audit/domains/map-plugin-package/startup-preparation-entry-spine.ts";
const FRAME_3S = "frame-3s";
const FRAME_6S = "frame-6s";
const FRAME_10S = "frame-10s";
const REF_FRAME_3S = "Frame3s";
const REF_FRAME_6S = "Frame6s";
const REF_FRAME_10S = "Frame10s";

const ALLOWED_ENTRY_SPINE_STEP_IDS = new Set([
  "open-facebook-reels",
  "open-tiktok-feed",
  "capture-video-viewport",
  "capture-startup-viewport",
  "prepare-ai-input",
  "prepare-startup-ai-input",
  "startup-preparation",
  "judge-seeding-video",
]);

const FORBIDDEN_FRAME_STEP_IDS = new Set([
  `prepare-ai-input-${FRAME_3S}`,
  `prepare-ai-input-${FRAME_6S}`,
  `prepare-ai-input-${FRAME_10S}`,
  `capture-video-${FRAME_3S}`,
  `capture-video-${FRAME_6S}`,
  `capture-video-${FRAME_10S}`,
  `capture-product-video-${FRAME_3S}`,
  `capture-product-video-${FRAME_6S}`,
  `capture-product-video-${FRAME_10S}`,
]);

const FORBIDDEN_FRAME_REF_KEYS = new Set([
  `screenshotEvidenceRef${REF_FRAME_3S}`,
  `screenshotEvidenceRef${REF_FRAME_6S}`,
  `screenshotEvidenceRef${REF_FRAME_10S}`,
  `promptInputRef${REF_FRAME_3S}`,
  `promptInputRef${REF_FRAME_6S}`,
  `promptInputRef${REF_FRAME_10S}`,
]);

const ROUTE_PLAN_OWNED_ACTION_STEP_IDS = new Set([
  "observe-comments-button",
  "normalize-comments-target",
  "click-comments-button",
  "verify-comments-open",
  "capture-comments-panel",
  "extract-visible-comments",
  "write-seeding-evidence-record",
  "finalize-seeding-evidence-packet",
  "finalize-seeding-browse-ledger",
  "observe-next-video-region",
  "normalize-next-video-region",
  "scroll-next-video",
  "normalize-next-video-arrow",
  "click-next-video-arrow",
]);

type MapPackage = ReturnType<typeof loadBuiltinMapPackages>[number];
type MapStep = MapPackage["operationalMap"]["steps"][number];
type MapTransition = MapPackage["operationalMap"]["transitions"][number];
type PromptBinding = MapPackage["promptBindings"]["bindings"][number];

const collectStepRefValues = (step: MapStep): string[] => [
  step.stepId,
  step.childCapabilityId,
  ...step.inputRefs,
  ...step.outputRefPolicy.storeAs,
];

const collectBindingRefValues = (binding: PromptBinding): string[] => [
  binding.stepId,
  binding.promptContractId,
  ...binding.requiredInputRefs,
  binding.outputSchemaRef,
];

const collectTransitionValues = (transition: MapTransition): string[] => [
  transition.transitionId,
  transition.fromStepId,
  transition.toStepId ?? "",
];

const findForbiddenFrameTokens = (values: string[]): string[] =>
  values.filter((value) => FORBIDDEN_FRAME_STEP_IDS.has(value) || FORBIDDEN_FRAME_REF_KEYS.has(value));

const collectForbiddenFrameFindings = (mapPackage: MapPackage, file: string): Finding[] => {
  const stepFindings = mapPackage.operationalMap.steps.flatMap((step) => {
    const forbidden = findForbiddenFrameTokens(collectStepRefValues(step));
    return forbidden.length === 0
      ? []
      : [createFinding({
        lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT,
        file,
        line: 1,
        severity: "fatal",
        message: "Production seeding map must not declare frame-specific sampling steps or refs.",
        detail: `${step.stepId}: ${forbidden.join(", ")}`,
      })];
  });

  const transitionFindings = mapPackage.operationalMap.transitions.flatMap((transition) => {
    const forbidden = findForbiddenFrameTokens(collectTransitionValues(transition));
    return forbidden.length === 0
      ? []
      : [createFinding({
        lawId: MAP_PLUGIN_LAWS.LIFECYCLE,
        file,
        line: 1,
        severity: "fatal",
        message: "Production seeding map transitions must not route through frame-specific sampling internals.",
        detail: `${transition.transitionId}: ${forbidden.join(", ")}`,
      })];
  });

  const bindingFindings = mapPackage.promptBindings.bindings.flatMap((binding) => {
    const forbidden = findForbiddenFrameTokens(collectBindingRefValues(binding));
    return forbidden.length === 0
      ? []
      : [createFinding({
        lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT,
        file,
        line: 1,
        severity: "fatal",
        message: "Production seeding map prompt bindings must not require frame-specific refs.",
        detail: `${binding.stepId}: ${forbidden.join(", ")}`,
      })];
  });

  return [...stepFindings, ...transitionFindings, ...bindingFindings];
};

const collectAllowedStepFindings = (mapPackage: MapPackage, file: string): Finding[] =>
  mapPackage.operationalMap.steps.flatMap((step) =>
    ALLOWED_ENTRY_SPINE_STEP_IDS.has(step.stepId)
      ? []
      : [createFinding({
        lawId: MAP_PLUGIN_LAWS.LIFECYCLE,
        file,
        line: 1,
        severity: "fatal",
        message: "Production seeding map may only declare weak entry-spine steps; Route Plan owns muscle-memory internals.",
        detail: step.stepId,
      })],
  );

const collectInspectorSelfBoundaryFindings = (): Finding[] => {
  const sourceText = readFileSync(INSPECTOR_FILE, "utf8");
  const forbiddenInspectorTokens = [
    "FACEBOOK" + "_STARTUP_PREPARE_STEP_ID",
    `is${"Facebook"}`,
    `prepare-ai-input-${"frame-3s"}`,
  ];
  const leakedTokens = forbiddenInspectorTokens.filter((token) => sourceText.includes(token));
  return leakedTokens.length === 0
    ? []
    : [createFinding({
      lawId: MAP_PLUGIN_LAWS.LIFECYCLE,
      file: INSPECTOR_FILE,
      line: 1,
      severity: "fatal",
      message: "startup-preparation-entry-spine inspector must not reintroduce platform-specific sampling exceptions.",
      detail: leakedTokens.join(", "),
    })];
};

export const runStartupPreparationEntrySpine = async (): Promise<{ findings: Finding[]; phase: InspectorPhase }> => {
  const findings = [
    ...collectInspectorSelfBoundaryFindings(),
    ...TARGET_PACKAGE_IDS.flatMap((packageId) => inspectSeedingStartupPreparation(packageId)),
  ];
  return {
    findings,
    phase: findings.length === 0
      ? createPhase("startup-preparation-entry-spine", "PASS", true, "Seeding builtin maps remain weak entry-spine maps: startup AI is map-owned handoff, while frame sampling and post-judgment muscle-memory chains are Route Plan / ability-owned.")
      : createPhase("startup-preparation-entry-spine", "CODE VIOLATION", false, "Seeding builtin maps drifted away from the weak-map / strong-route-plan boundary."),
  };
};
