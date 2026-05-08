import { loadBuiltinPackageRecords } from "./builtin-package-records.js";
import { MAP_PLUGIN_LAWS } from "./constants.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

const TARGET_ENTRY_STEPS: Readonly<Record<string, string>> = {
  "builtin.facebook-seeding-video-discovery": "open-facebook-reels",
  "builtin.tiktok-seeding-video-discovery": "open-tiktok-feed",
};

const ROUTE_PLAN_STARTUP_ENTRY_STEP = "capture-startup-video-viewport";
const STARTUP_BINDING = {
  stepId: "startup-preparation",
  promptContractId: "vision.pagePreparation.v1",
  outputSchemaRef: "ai.page_preparation_judgment.v1",
};
const PRODUCT_BINDING = {
  stepId: "judge-seeding-video",
  promptContractId: "vision.productPresence.v1",
  outputSchemaRef: "ai.product_presence_judgment.v1",
};

type BuiltinPackageRecord = Awaited<ReturnType<typeof loadBuiltinPackageRecords>>[number];

const hasTransition = (record: BuiltinPackageRecord, expected: {
  transitionId: string;
  fromStepId: string;
  onStatus: string;
  toStepId?: string | null;
  finalStatus?: string | null;
}): boolean =>
  record.mapPackage?.operationalMap.transitions.some((transition) =>
    transition.transitionId === expected.transitionId
    && transition.fromStepId === expected.fromStepId
    && transition.onStatus === expected.onStatus
    && (transition.toStepId ?? null) === (expected.toStepId ?? null)
    && (transition.finalStatus ?? null) === (expected.finalStatus ?? null),
  ) ?? false;

const createPromptFinding = (record: BuiltinPackageRecord, message: string, detail?: string): Finding =>
  createFinding({
    lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT,
    file: record.file,
    line: 1,
    severity: "fatal",
    message,
    ...(detail ? { detail } : {}),
  });

const createLifecycleFinding = (record: BuiltinPackageRecord, message: string, detail?: string): Finding =>
  createFinding({
    lawId: MAP_PLUGIN_LAWS.LIFECYCLE,
    file: record.file,
    line: 1,
    severity: "fatal",
    message,
    ...(detail ? { detail } : {}),
  });

const collectEntryStepFindings = (record: BuiltinPackageRecord, entryStepId: string): Finding[] => {
  const localStepIds = record.mapPackage?.operationalMap.steps.map((step) => step.stepId) ?? [];
  if (localStepIds.length === 1 && localStepIds[0] === entryStepId) {
    return [];
  }

  return [createLifecycleFinding(
    record,
    "Seeding routePlanBoundMap must keep only its platform open step locally; startup/current-video capture and AI judgment belong to Route Plan.",
    localStepIds.join(", "),
  )];
};

const collectEntryTransitionFindings = (record: BuiltinPackageRecord, entryStepId: string): Finding[] => {
  const requiredTransitions = [
    {
      transitionId: `${entryStepId}:success`,
      fromStepId: entryStepId,
      onStatus: "success",
      toStepId: ROUTE_PLAN_STARTUP_ENTRY_STEP,
      finalStatus: null,
    },
    {
      transitionId: `${entryStepId}:failed`,
      fromStepId: entryStepId,
      onStatus: "failed",
      toStepId: null,
      finalStatus: "failed",
    },
  ];
  const transitions = record.mapPackage?.operationalMap.transitions ?? [];
  const missingTransitions = requiredTransitions.filter((transition) => !hasTransition(record, transition));
  const extraTransitions = transitions.filter((transition) =>
    !requiredTransitions.some((requiredTransition) => requiredTransition.transitionId === transition.transitionId),
  );

  return [
    ...(missingTransitions.length === 0
      ? []
      : [createLifecycleFinding(
        record,
        "Seeding routePlanBoundMap must hand off from open success directly to Route Plan startup capture and keep only local open failure closeout.",
        missingTransitions.map((transition) => transition.transitionId).join(", "),
      )]),
    ...(extraTransitions.length === 0
      ? []
      : [createLifecycleFinding(
        record,
        "Seeding routePlanBoundMap must not keep local transitions beyond the open entry spine.",
        extraTransitions.map((transition) => transition.transitionId).join(", "),
      )]),
  ];
};

const hasPromptBinding = (record: BuiltinPackageRecord, expected: typeof STARTUP_BINDING): boolean =>
  record.mapPackage?.promptBindings.bindings.some((binding) =>
    binding.stepId === expected.stepId
    && binding.promptContractId === expected.promptContractId
    && binding.outputSchemaRef === expected.outputSchemaRef
    && binding.requiredInputRefs.includes("promptInputRef"),
  ) ?? false;

const collectPromptBindingFindings = (record: BuiltinPackageRecord): Finding[] => {
  const missingBindings = [STARTUP_BINDING, PRODUCT_BINDING]
    .filter((binding) => !hasPromptBinding(record, binding))
    .map((binding) => binding.stepId);

  return missingBindings.length === 0
    ? []
    : [createPromptFinding(
      record,
      "Seeding routePlanBoundMap must keep startup-preparation and judge-seeding-video prompt bindings even when those AI steps are Route Plan-owned.",
      missingBindings.join(", "),
    )];
};

const collectRecordFindings = (record: BuiltinPackageRecord): Finding[] => {
  const packageId = record.mapPackage?.manifest.packageId ?? null;
  if (!packageId) {
    return [];
  }

  const entryStepId = TARGET_ENTRY_STEPS[packageId];
  if (!entryStepId) {
    return [];
  }

  return [
    ...collectEntryStepFindings(record, entryStepId),
    ...collectEntryTransitionFindings(record, entryStepId),
    ...collectPromptBindingFindings(record),
  ];
};

export async function runRoutePlanEntrySpine(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = (await loadBuiltinPackageRecords()).flatMap(collectRecordFindings);
  const passed = findings.length === 0;

  return {
    findings,
    phase: passed
      ? createPhase(
        "route-plan-entry-spine",
        "PASS",
        true,
        "Seeding routePlanBoundMap packages stay at the open-entry spine while Route Plan owns startup and recurring AI judgment chains.",
      )
      : createPhase(
        "route-plan-entry-spine",
        "CODE VIOLATION",
        false,
        "Seeding routePlanBoundMap packages drifted back into local startup/current-video judgment ownership.",
      ),
  };
}