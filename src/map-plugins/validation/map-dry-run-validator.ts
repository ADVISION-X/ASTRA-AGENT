import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";

function isTargetAbilityGroup(
  targetAbilityGroupId: MapPackage["operationalMap"]["steps"][number]["targetAbilityGroupId"],
  expected: string
): boolean {
  return targetAbilityGroupId === expected;
}

function buildStepIndexMap(steps: MapPackage["operationalMap"]["steps"]): Map<string, number> {
  return new Map(steps.map((step, index) => [step.stepId, index]));
}

function buildAdjacency(mapPackage: MapPackage): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const step of mapPackage.operationalMap.steps) {
    adjacency.set(step.stepId, []);
  }
  for (const transition of mapPackage.operationalMap.transitions) {
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

function hasReachableStep(
  fromStepId: string,
  adjacency: Map<string, string[]>,
  stepIndex: Map<string, number>,
  predicate: (stepId: string) => boolean
): boolean {
  const queue = [...(adjacency.get(fromStepId) ?? [])];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const currentStepId = queue.shift();
    if (!currentStepId || visited.has(currentStepId)) {
      continue;
    }
    visited.add(currentStepId);
    if (stepIndex.has(currentStepId) && predicate(currentStepId)) {
      return true;
    }
    queue.push(...(adjacency.get(currentStepId) ?? []));
  }
  return false;
}

export function validateMapDryRun(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const issues: MapPackageValidationIssue[] = [];
  const steps = mapPackage.operationalMap.steps;
  const stepIndex = buildStepIndexMap(steps);
  const adjacency = buildAdjacency(mapPackage);

  const aiStepIndex = steps.findIndex((step) => step.stepKind === "ai");
  if (aiStepIndex >= 0) {
    const hasPrepareAiInput = steps.some((step, index) => index < aiStepIndex && step.childCapabilityId.includes("prepare-ai-input"));
    if (!hasPrepareAiInput) {
      issues.push({
        code: "missing_dependency",
        message: "AI vision step requires a preceding prepare-ai-input step.",
        path: "operationalMap.steps",
        severity: "error"
      });
    }
  }

  const clickStepIndex = steps.findIndex((step) => isTargetAbilityGroup(step.targetAbilityGroupId, "mouse-click"));
  if (clickStepIndex >= 0) {
    const hasVisualTarget = hasPrecedingStep(steps, clickStepIndex, (step) => isTargetAbilityGroup(step.targetAbilityGroupId, "visual-target"));
    const hasGeometryGuard = hasPrecedingStep(steps, clickStepIndex, (step) => isTargetAbilityGroup(step.targetAbilityGroupId, "geometry-guard"));
    if (!hasVisualTarget || !hasGeometryGuard) {
      issues.push({
        code: "missing_dependency",
        message: "mouse-click step requires preceding visual-target and geometry-guard steps.",
        path: "operationalMap.steps",
        severity: "error"
      });
    }
    const hasVerification = hasReachableStep(steps[clickStepIndex]!.stepId, adjacency, stepIndex, (stepId) => {
      const nextIndex = stepIndex.get(stepId);
      return nextIndex !== undefined && isTargetAbilityGroup(steps[nextIndex]!.targetAbilityGroupId, "post-action-verification");
    });
    if (!hasVerification) {
      issues.push({
        code: "missing_dependency",
        message: "Action step requires a following post-action-verification step.",
        path: "operationalMap.steps",
        severity: "error"
      });
    }
  }

  const scrollStepIndex = steps.findIndex((step) => isTargetAbilityGroup(step.targetAbilityGroupId, "mouse-scroll"));
  if (scrollStepIndex >= 0) {
    const hasScrollContext = hasPrecedingStep(steps, scrollStepIndex, (step) => isTargetAbilityGroup(step.targetAbilityGroupId, "page-state") || isTargetAbilityGroup(step.targetAbilityGroupId, "visual-target"));
    if (!hasScrollContext) {
      issues.push({
        code: "missing_dependency",
        message: "mouse-scroll step requires preceding page-state or visual-target context.",
        path: "operationalMap.steps",
        severity: "error"
      });
    }
    const hasVerification = hasReachableStep(steps[scrollStepIndex]!.stepId, adjacency, stepIndex, (stepId) => {
      const nextIndex = stepIndex.get(stepId);
      return nextIndex !== undefined && isTargetAbilityGroup(steps[nextIndex]!.targetAbilityGroupId, "post-action-verification");
    });
    if (!hasVerification) {
      issues.push({
        code: "missing_dependency",
        message: "mouse-scroll step requires reachable post-action-verification.",
        path: "operationalMap.steps",
        severity: "error"
      });
    }
  }

  const textInputStepIndex = steps.findIndex((step) => isTargetAbilityGroup(step.targetAbilityGroupId, "text-input"));
  if (textInputStepIndex >= 0) {
    const textInputStep = steps[textInputStepIndex]!;
    const hasTextSource = textInputStep.inputRefs.includes("commandInputRef") || textInputStep.inputRefs.includes("promptInputRef");
    const hasInputTarget = hasPrecedingStep(steps, textInputStepIndex, (step) => isTargetAbilityGroup(step.targetAbilityGroupId, "visual-target") || isTargetAbilityGroup(step.targetAbilityGroupId, "page-state"));
    const hasGeometryGuard = hasPrecedingStep(steps, textInputStepIndex, (step) => isTargetAbilityGroup(step.targetAbilityGroupId, "geometry-guard"));
    if (!hasTextSource) {
      issues.push({
        code: "missing_dependency",
        message: "text-input step requires commandInputRef or promptInputRef as approved text source.",
        path: `operationalMap.steps.${textInputStep.stepId}`,
        severity: "error"
      });
    }
    if (!hasInputTarget || !hasGeometryGuard) {
      issues.push({
        code: "missing_dependency",
        message: "text-input step requires preceding input-target context and geometry-guard normalization.",
        path: `operationalMap.steps.${textInputStep.stepId}`,
        severity: "error"
      });
    }
    const hasVerification = hasReachableStep(textInputStep.stepId, adjacency, stepIndex, (stepId) => {
      const nextIndex = stepIndex.get(stepId);
      return nextIndex !== undefined && isTargetAbilityGroup(steps[nextIndex]!.targetAbilityGroupId, "post-action-verification");
    });
    if (!hasVerification) {
      issues.push({
        code: "missing_dependency",
        message: "text-input step requires reachable post-action-verification.",
        path: `operationalMap.steps.${textInputStep.stepId}`,
        severity: "error"
      });
    }
  }

  const hasForensics = steps.some((step) => isTargetAbilityGroup(step.targetAbilityGroupId, "forensics-persistence"));
  if (!hasForensics) {
    issues.push({
      code: "missing_dependency",
      message: "Operational map must route evidence output into forensics-persistence.",
      path: "operationalMap.steps",
      severity: "error"
    });
  }

  for (const binding of mapPackage.promptBindings.bindings) {
    if (!stepIndex.has(binding.stepId)) {
      issues.push({
        code: "missing_prompt_contract",
        message: `Prompt binding step ${binding.stepId} does not exist in operationalMap.steps.`,
        path: "promptBindings.bindings",
        severity: "error"
      });
    }
  }

  return issues;
}
