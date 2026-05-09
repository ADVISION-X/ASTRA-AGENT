import { readFileSync } from "node:fs";

import { loadBuiltinMapPackages } from "../../../../src/map-plugins/builtins/index.js";
import { findRoutePlanById } from "../../../../src/map-plugins/route-plans/index.js";
import {
  STARTUP_PREPARATION_BLOCKED_ROUTE_LABEL,
  STARTUP_PREPARATION_READY_ROUTE_LABEL,
} from "../../../../src/map-plugins/shared/startup-preparation.constants.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { MAP_PLUGIN_LAWS, MAP_PLUGIN_PATHS } from "./constants.js";

const { ROOT } = MAP_PLUGIN_PATHS;
const STARTUP_PREPARATION_PROMPT_CONTRACT_ID = "vision.pagePreparation.v1";
const STARTUP_PREPARATION_CHILD_CAPABILITY_ID = "page-preparation-judgment";
const STARTUP_PREPARATION_OUTPUT_SCHEMA_REF = "ai.page_preparation_judgment.v1";
const PRODUCT_JUDGMENT_PROMPT_CONTRACT_ID = "vision.productPresence.v1";
const PRODUCT_JUDGMENT_OUTPUT_SCHEMA_REF = "ai.product_presence_judgment.v1";
const TARGET_PACKAGE_IDS = [
  "builtin.facebook-seeding-video-discovery",
  "builtin.tiktok-seeding-video-discovery",
] as const;
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
type RoutePlan = NonNullable<ReturnType<typeof findRoutePlanById>>;

const toMapFile = (packageId: string) => `${ROOT}/builtins/${packageId.replace("builtin.", "")}.meta.map-package.json`;

const hasTransition = (
  transitions: MapTransition[],
  expected: { transitionId: string; fromStepId: string; onStatus: string; toStepId?: string | null; finalStatus?: string | null },
): boolean => transitions.some((transition) =>
  transition.transitionId === expected.transitionId
  && transition.fromStepId === expected.fromStepId
  && transition.onStatus === expected.onStatus
  && (transition.toStepId ?? null) === (expected.toStepId ?? null)
  && (transition.finalStatus ?? null) === (expected.finalStatus ?? null),
);

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

const collectStartupPreparationFindings = (mapPackage: MapPackage, routePlan: RoutePlan | null, file: string): Finding[] => {
  const findings: Finding[] = [];
  const startupStep = routePlan?.steps.find((step) => step.stepId === "startup-preparation");
  if (!startupStep) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT, file, line: 1, severity: "fatal", message: "Seeding map must declare startup-preparation AI handoff step." }));
  } else if (
    startupStep.stepKind !== "ai"
    || startupStep.targetAbilityGroupId !== "ai"
    || startupStep.childCapabilityId !== STARTUP_PREPARATION_CHILD_CAPABILITY_ID
    || startupStep.promptContractId !== STARTUP_PREPARATION_PROMPT_CONTRACT_ID
  ) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT, file, line: 1, severity: "fatal", message: "startup-preparation must remain an AI-owned page-preparation judgment bound to vision.pagePreparation.v1." }));
  }

  const startupBinding = mapPackage.promptBindings.bindings.find((binding) => binding.stepId === "startup-preparation");
  if (
    !startupBinding
    || startupBinding.promptContractId !== STARTUP_PREPARATION_PROMPT_CONTRACT_ID
    || startupBinding.outputSchemaRef !== STARTUP_PREPARATION_OUTPUT_SCHEMA_REF
    || !startupBinding.requiredInputRefs.includes("promptInputRef")
  ) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT, file, line: 1, severity: "fatal", message: "Seeding map promptBindings must bind startup-preparation to promptInputRef and ai.page_preparation_judgment.v1." }));
  }

  const transitions = routePlan?.transitions ?? [];
  const requiredTransitions = [
    {
      transitionId: `startup-preparation:${STARTUP_PREPARATION_READY_ROUTE_LABEL}`,
      fromStepId: "startup-preparation",
      onStatus: "success",
      toStepId: "judge-seeding-video",
      finalStatus: null,
    },
    {
      transitionId: `startup-preparation:${STARTUP_PREPARATION_BLOCKED_ROUTE_LABEL}`,
      fromStepId: "startup-preparation",
      onStatus: "success",
      toStepId: null,
      finalStatus: "failed",
    },
    {
      transitionId: "startup-preparation:failed",
      fromStepId: "startup-preparation",
      onStatus: "failed",
      toStepId: null,
      finalStatus: "failed",
    },
  ];
  const missingTransitions = requiredTransitions.filter((transition) => !hasTransition(transitions, transition));
  if (missingTransitions.length > 0) {
    findings.push(createFinding({
      lawId: MAP_PLUGIN_LAWS.LIFECYCLE,
      file,
      line: 1,
      severity: "fatal",
      message: "Seeding map startup-preparation must fail-close locally and route ready handoff directly to judge-seeding-video.",
      detail: missingTransitions.map((transition) => transition.transitionId).join(", "),
    }));
  }

  return findings;
};

const collectProductJudgmentHandoffFindings = (mapPackage: MapPackage, routePlan: RoutePlan | null, file: string): Finding[] => {
  const findings: Finding[] = [];
  const judgeStep = routePlan?.steps.find((step) => step.stepId === "judge-seeding-video");
  if (!judgeStep) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT, file, line: 1, severity: "fatal", message: "Seeding map must declare judge-seeding-video as the AI product judgment handoff." }));
  } else if (
    judgeStep.stepKind !== "ai"
    || judgeStep.targetAbilityGroupId !== "ai"
    || judgeStep.childCapabilityId !== "product-presence-judgment"
    || judgeStep.promptContractId !== PRODUCT_JUDGMENT_PROMPT_CONTRACT_ID
  ) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT, file, line: 1, severity: "fatal", message: "judge-seeding-video must remain an AI-owned product-presence handoff bound to vision.productPresence.v1." }));
  }

  const judgeBinding = mapPackage.promptBindings.bindings.find((binding) => binding.stepId === "judge-seeding-video");
  if (
    !judgeBinding
    || judgeBinding.promptContractId !== PRODUCT_JUDGMENT_PROMPT_CONTRACT_ID
    || judgeBinding.outputSchemaRef !== PRODUCT_JUDGMENT_OUTPUT_SCHEMA_REF
    || !judgeBinding.requiredInputRefs.includes("promptInputRef")
  ) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT, file, line: 1, severity: "fatal", message: "judge-seeding-video promptBinding must remain a weak AI handoff using promptInputRef; frame-specific prompt refs are forbidden in maps." }));
  }

  const forbiddenSuccessTransitions = mapPackage.operationalMap.transitions.filter((transition) =>
    transition.fromStepId === "judge-seeding-video"
    && transition.onStatus === "success",
  );
  if (forbiddenSuccessTransitions.length > 0) {
    findings.push(createFinding({
      lawId: MAP_PLUGIN_LAWS.LIFECYCLE,
      file,
      line: 1,
      severity: "fatal",
      message: "Map must not own judge-seeding-video success routing; Route Plan owns product routeLabel action chains.",
      detail: forbiddenSuccessTransitions.map((transition) => transition.transitionId).join(", "),
    }));
  }

  return findings;
};

const collectRoutePlanBoundaryFindings = (mapPackage: MapPackage, file: string): Finding[] => {
  const routePlanOwnedSteps = mapPackage.operationalMap.steps
    .map((step) => step.stepId)
    .filter((stepId) => ROUTE_PLAN_OWNED_ACTION_STEP_IDS.has(stepId));
  const routePlanOwnedTransitions = mapPackage.operationalMap.transitions.filter((transition) =>
    ROUTE_PLAN_OWNED_ACTION_STEP_IDS.has(transition.fromStepId)
    || (transition.toStepId !== null && transition.toStepId !== undefined && ROUTE_PLAN_OWNED_ACTION_STEP_IDS.has(transition.toStepId)),
  );

  return [
    ...(routePlanOwnedSteps.length === 0 ? [] : [createFinding({
      lawId: MAP_PLUGIN_LAWS.LIFECYCLE,
      file,
      line: 1,
      severity: "fatal",
      message: "Map must not duplicate Route Plan-owned action steps.",
      detail: routePlanOwnedSteps.join(", "),
    })]),
    ...(routePlanOwnedTransitions.length === 0 ? [] : [createFinding({
      lawId: MAP_PLUGIN_LAWS.LIFECYCLE,
      file,
      line: 1,
      severity: "fatal",
      message: "Map must not route into or out of Route Plan-owned action-chain steps.",
      detail: routePlanOwnedTransitions.map((transition) => transition.transitionId).join(", "),
    })]),
  ];
};

const inspectSeedingStartupPreparation = (packageId: string): Finding[] => {
  const mapPackage = loadBuiltinMapPackages().find((entry) => entry.manifest.packageId === packageId);
  if (!mapPackage) {
    return [createFinding({ lawId: MAP_PLUGIN_LAWS.LIFECYCLE, file: toMapFile(packageId), line: 1, severity: "fatal", message: `Builtin seeding map ${packageId} must exist.` })];
  }

  const file = toMapFile(packageId);
  const routePlan = findRoutePlanById(mapPackage.operationalMap.routePlanId);
  const findings: Finding[] = [
    ...collectAllowedStepFindings(mapPackage, file),
    ...collectForbiddenFrameFindings(mapPackage, file),
    ...collectStartupPreparationFindings(mapPackage, routePlan, file),
    ...collectProductJudgmentHandoffFindings(mapPackage, routePlan, file),
    ...collectRoutePlanBoundaryFindings(mapPackage, file),
  ];

  if (!mapPackage.dependencies.requiredChildCapabilities.includes(STARTUP_PREPARATION_CHILD_CAPABILITY_ID)) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.CAPABILITY_CATALOG, file, line: 1, severity: "fatal", message: "Seeding map dependencies must declare page-preparation-judgment child capability." }));
  }
  if (!mapPackage.dependencies.requiredPromptContracts.includes(STARTUP_PREPARATION_PROMPT_CONTRACT_ID)) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT, file, line: 1, severity: "fatal", message: "Seeding map dependencies must declare vision.pagePreparation.v1 prompt contract." }));
  }
  if (!mapPackage.compatibility.requiresPromptRegistry.includes(STARTUP_PREPARATION_PROMPT_CONTRACT_ID)) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT, file, line: 1, severity: "fatal", message: "Seeding map compatibility must require vision.pagePreparation.v1 prompt registry entry." }));
  }

  return findings;
};

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
