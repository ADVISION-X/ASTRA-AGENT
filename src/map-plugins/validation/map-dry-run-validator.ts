import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";
import { findRoutePlanById } from "../route-plans/index.js";

function isTargetAbilityGroup(
  targetAbilityGroupId: MapPackage["operationalMap"]["steps"][number]["targetAbilityGroupId"],
  expected: string
): boolean {
  return targetAbilityGroupId === expected;
}

function buildStepIndexMap(steps: MapPackage["operationalMap"]["steps"]): Map<string, number> {
  return new Map(steps.map((step, index) => [step.stepId, index]));
}

function getEffectiveSteps(mapPackage: MapPackage): MapPackage["operationalMap"]["steps"] {
  const routePlan = findRoutePlanById(mapPackage.operationalMap.routePlanId);
  return routePlan ? [...mapPackage.operationalMap.steps, ...routePlan.steps] : mapPackage.operationalMap.steps;
}

function getEffectiveTransitions(mapPackage: MapPackage): MapPackage["operationalMap"]["transitions"] {
  const routePlan = findRoutePlanById(mapPackage.operationalMap.routePlanId);
  return routePlan ? [...mapPackage.operationalMap.transitions, ...routePlan.transitions] : mapPackage.operationalMap.transitions;
}

function buildAdjacency(mapPackage: MapPackage, steps: MapPackage["operationalMap"]["steps"]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const step of steps) {
    adjacency.set(step.stepId, []);
  }
  for (const transition of getEffectiveTransitions(mapPackage)) {
    if (transition.toStepId) {
      adjacency.get(transition.fromStepId)?.push(transition.toStepId);
    }
  }
  return adjacency;
}

function hasPrecedingStep(
  steps: MapPackage["operationalMap"]["steps"],
  currentIndex: number,
  predicate: (step: MapPackage["operationalMap"]["steps"][number]) => boolean
): boolean {
  return steps.some((step, index) => index < currentIndex && predicate(step));
}

function createIssue(message: string, path: string): MapPackageValidationIssue {
  return {
    code: "missing_dependency",
    message,
    path,
    severity: "error"
  };
}

function validateAiPreparation(steps: MapPackage["operationalMap"]["steps"]): MapPackageValidationIssue[] {
  const aiStepIndex = steps.findIndex((step) => step.stepKind === "ai");
  if (aiStepIndex < 0) {
    return [];
  }

  const hasPrepareAiInput = steps.some((step, index) => index < aiStepIndex && step.childCapabilityId.includes("prepare-ai-input"));
  return hasPrepareAiInput ? [] : [createIssue("AI vision step requires a preceding prepare-ai-input step.", "operationalMap.steps")];
}

function validateMouseClickDryRun(
  steps: MapPackage["operationalMap"]["steps"],
): MapPackageValidationIssue[] {
  const clickStepIndex = steps.findIndex((step) => isTargetAbilityGroup(step.targetAbilityGroupId, "mouse-click"));
  if (clickStepIndex < 0) {
    return [];
  }

  const issues: MapPackageValidationIssue[] = [];
  const hasVisualTarget = hasPrecedingStep(steps, clickStepIndex, (step) => isTargetAbilityGroup(step.targetAbilityGroupId, "visual-target"));
  const hasGeometryGuard = hasPrecedingStep(steps, clickStepIndex, (step) => isTargetAbilityGroup(step.targetAbilityGroupId, "geometry-guard"));
  if (!hasVisualTarget || !hasGeometryGuard) {
    issues.push(createIssue("mouse-click step requires preceding visual-target and geometry-guard steps.", "operationalMap.steps"));
  }
  return issues;
}

function validateMouseScrollDryRun(
  steps: MapPackage["operationalMap"]["steps"],
): MapPackageValidationIssue[] {
  const scrollStepIndex = steps.findIndex((step) => isTargetAbilityGroup(step.targetAbilityGroupId, "mouse-scroll"));
  if (scrollStepIndex < 0) {
    return [];
  }

  const hasScrollContext = hasPrecedingStep(steps, scrollStepIndex, (step) => isTargetAbilityGroup(step.targetAbilityGroupId, "page-state") || isTargetAbilityGroup(step.targetAbilityGroupId, "visual-target"));
  const issues = hasScrollContext
    ? []
    : [createIssue("mouse-scroll step requires preceding page-state or visual-target context.", "operationalMap.steps")];
  return issues;
}

function validateTextInputDryRun(
  steps: MapPackage["operationalMap"]["steps"],
): MapPackageValidationIssue[] {
  const textInputSteps = steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => isTargetAbilityGroup(step.targetAbilityGroupId, "text-input"));

  if (textInputSteps.length === 0) {
    return [];
  }

  return textInputSteps.flatMap(({ step: textInputStep, index: textInputStepIndex }) => {
    const hasInputTarget = hasPrecedingStep(steps, textInputStepIndex, (step) => isTargetAbilityGroup(step.targetAbilityGroupId, "visual-target") || isTargetAbilityGroup(step.targetAbilityGroupId, "page-state"));

    if (textInputStep.childCapabilityId === "press-navigation-key") {
      const hasPageStateProof = textInputStep.inputRefs.includes("pageStateRef");
      return hasInputTarget && hasPageStateProof
        ? []
        : [createIssue("press-navigation-key step requires preceding page-state context and pageStateRef input.", `operationalMap.steps.${textInputStep.stepId}`)];
    }

    const issues: MapPackageValidationIssue[] = [];
    const hasTextSource = textInputStep.inputRefs.includes("commandInputRef") || textInputStep.inputRefs.includes("promptInputRef");
    const hasGeometryGuard = hasPrecedingStep(steps, textInputStepIndex, (step) => isTargetAbilityGroup(step.targetAbilityGroupId, "geometry-guard"));
    if (!hasTextSource) {
      issues.push(createIssue("text-input step requires commandInputRef or promptInputRef as approved text source.", `operationalMap.steps.${textInputStep.stepId}`));
    }
    if (!hasInputTarget || !hasGeometryGuard) {
      issues.push(createIssue("text-input step requires preceding input-target context and geometry-guard normalization.", `operationalMap.steps.${textInputStep.stepId}`));
    }
    return issues;
  });
}

function validateForensicsPresence(steps: MapPackage["operationalMap"]["steps"]): MapPackageValidationIssue[] {
  const hasForensics = steps.some((step) => isTargetAbilityGroup(step.targetAbilityGroupId, "forensics-persistence"));
  return hasForensics ? [] : [createIssue("Operational map must route evidence output into forensics-persistence.", "operationalMap.steps")];
}

function validatePromptBindingSteps(
  stepIndex: Map<string, number>,
  bindings: MapPackage["promptBindings"]["bindings"],
): MapPackageValidationIssue[] {
  return bindings.flatMap((binding) =>
    stepIndex.has(binding.stepId)
      ? []
      : [{
        code: "missing_prompt_contract",
        message: `Prompt binding step ${binding.stepId} does not exist in operationalMap.steps.`,
        path: "promptBindings.bindings",
        severity: "error"
      }],
  );
}

export function validateMapDryRun(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const steps = getEffectiveSteps(mapPackage);
  const stepIndex = buildStepIndexMap(steps);
  return [
    ...validateAiPreparation(steps),
    ...validateMouseClickDryRun(steps),
    ...validateMouseScrollDryRun(steps),
    ...validateTextInputDryRun(steps),
    ...validateForensicsPresence(steps),
    ...validatePromptBindingSteps(stepIndex, mapPackage.promptBindings.bindings),
  ];
}
