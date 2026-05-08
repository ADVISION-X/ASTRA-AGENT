import { loadBuiltinMapPackages } from "../../../../src/map-plugins/builtins/index.js";
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
const FACEBOOK_STARTUP_PREPARE_STEP_ID = "prepare-startup-ai-input";
const TARGET_PACKAGE_IDS = [
  "builtin.facebook-seeding-video-discovery",
  "builtin.tiktok-seeding-video-discovery",
] as const;

const toMapFile = (packageId: string) => `${ROOT}/builtins/${packageId.replace("builtin.", "")}.meta.map-package.json`;

const hasTransition = (
  transitions: Array<{ transitionId: string; fromStepId: string; onStatus: string; toStepId?: string | null; finalStatus?: string | null }>,
  expected: { transitionId: string; fromStepId: string; onStatus: string; toStepId?: string | null; finalStatus?: string | null },
): boolean => transitions.some((transition) =>
  transition.transitionId === expected.transitionId
  && transition.fromStepId === expected.fromStepId
  && transition.onStatus === expected.onStatus
  && (transition.toStepId ?? null) === (expected.toStepId ?? null)
  && (transition.finalStatus ?? null) === (expected.finalStatus ?? null),
);

const inspectSeedingStartupPreparation = (packageId: string): Finding[] => {
  const mapPackage = loadBuiltinMapPackages().find((entry) => entry.manifest.packageId === packageId);
  if (!mapPackage) {
    return [createFinding({ lawId: MAP_PLUGIN_LAWS.LIFECYCLE, file: toMapFile(packageId), line: 1, severity: "fatal", message: `Builtin seeding map ${packageId} must exist.` })];
  }

  const findings: Finding[] = [];
  const file = toMapFile(packageId);
  const steps = new Map(mapPackage.operationalMap.steps.map((step) => [step.stepId, step]));
  const startupPreparationStep = steps.get("startup-preparation");
  const isFacebook = packageId === "builtin.facebook-seeding-video-discovery";
  const startupPrepareStep = steps.get(isFacebook ? FACEBOOK_STARTUP_PREPARE_STEP_ID : "prepare-ai-input");
  if (!startupPreparationStep) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT, file, line: 1, severity: "fatal", message: "Seeding map must declare startup-preparation AI step after prepare-ai-input." }));
  } else if (
    startupPreparationStep.targetAbilityGroupId !== "ai"
    || startupPreparationStep.childCapabilityId !== STARTUP_PREPARATION_CHILD_CAPABILITY_ID
    || startupPreparationStep.promptContractId !== STARTUP_PREPARATION_PROMPT_CONTRACT_ID
  ) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT, file, line: 1, severity: "fatal", message: "startup-preparation step must be AI-owned page-preparation-judgment bound to vision.pagePreparation.v1." }));
  }
  if (!startupPrepareStep || !startupPrepareStep.outputRefPolicy.storeAs.includes("promptInputRef")) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT, file, line: 1, severity: "fatal", message: "Startup preparation must receive its own promptInputRef from a dedicated prepare-ai-input step." }));
  }

  const transitions = mapPackage.operationalMap.transitions;
  const requiredTransitions = [
    {
      transitionId: isFacebook ? `${FACEBOOK_STARTUP_PREPARE_STEP_ID}:success` : "prepare-ai-input:success",
      fromStepId: isFacebook ? FACEBOOK_STARTUP_PREPARE_STEP_ID : "prepare-ai-input",
      onStatus: "success",
      toStepId: "startup-preparation",
      finalStatus: null,
    },
    {
      transitionId: `startup-preparation:${STARTUP_PREPARATION_READY_ROUTE_LABEL}`,
      fromStepId: "startup-preparation",
      onStatus: "success",
      toStepId: isFacebook ? "prepare-ai-input-frame-3s" : "judge-seeding-video",
      finalStatus: null,
    },
    ...(isFacebook ? [
      {
        transitionId: "prepare-ai-input-frame-3s:success",
        fromStepId: "prepare-ai-input-frame-3s",
        onStatus: "success",
        toStepId: "capture-video-frame-6s",
        finalStatus: null,
      },
    ] : []),
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
      message: "Seeding map startup entry spine must route prepare-ai-input into startup-preparation and fail-close locally before product judgment.",
      detail: missingTransitions.map((transition) => transition.transitionId).join(", "),
    }));
  }

  if (!mapPackage.dependencies.requiredChildCapabilities.includes(STARTUP_PREPARATION_CHILD_CAPABILITY_ID)) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.CAPABILITY_CATALOG, file, line: 1, severity: "fatal", message: "Seeding map dependencies must declare page-preparation-judgment child capability." }));
  }
  if (!mapPackage.dependencies.requiredPromptContracts.includes(STARTUP_PREPARATION_PROMPT_CONTRACT_ID)) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT, file, line: 1, severity: "fatal", message: "Seeding map dependencies must declare vision.pagePreparation.v1 prompt contract." }));
  }
  if (!mapPackage.compatibility.requiresPromptRegistry.includes(STARTUP_PREPARATION_PROMPT_CONTRACT_ID)) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT, file, line: 1, severity: "fatal", message: "Seeding map compatibility must require vision.pagePreparation.v1 prompt registry entry." }));
  }
  const startupBinding = mapPackage.promptBindings.bindings.find((binding) => binding.stepId === "startup-preparation");
  if (
    !startupBinding
    || startupBinding.promptContractId !== STARTUP_PREPARATION_PROMPT_CONTRACT_ID
    || startupBinding.outputSchemaRef !== STARTUP_PREPARATION_OUTPUT_SCHEMA_REF
  ) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT, file, line: 1, severity: "fatal", message: "Seeding map promptBindings must bind startup-preparation to vision.pagePreparation.v1 and ai.page_preparation_judgment.v1." }));
  }

  return findings;
};

export const runStartupPreparationEntrySpine = async (): Promise<{ findings: Finding[]; phase: InspectorPhase }> => {
  const findings = TARGET_PACKAGE_IDS.flatMap((packageId) => inspectSeedingStartupPreparation(packageId));
  return {
    findings,
    phase: findings.length === 0
      ? createPhase("startup-preparation-entry-spine", "PASS", true, "Seeding builtin maps bind startup-preparation as the only AI-owned startup yes/no gate before Route Plan takeover.")
      : createPhase("startup-preparation-entry-spine", "CODE VIOLATION", false, "Seeding builtin maps drifted away from the governed startup-preparation entry spine."),
  };
};
