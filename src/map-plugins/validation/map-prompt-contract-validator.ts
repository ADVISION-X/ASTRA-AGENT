import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";
import { validatePromptContractStep } from "./prompt-contract-step-validator.js";
import { getEffectiveSteps, getEffectiveTransitions } from "./effective-route-plan.js";

const INITIAL_INPUT_REFS = new Set([
  "requestedPlatformId",
  "selectedMapId",
  "operatorNote",
  "targetUrl",
  "targetTitle",
  "sourceEvidenceRef",
  "sourceTargetRef",
  "commandInputRef",
]);

const createBindingsByStep = (mapPackage: MapPackage): Map<string, MapPackage["promptBindings"]["bindings"][number]> =>
  new Map(mapPackage.promptBindings.bindings.map((binding) => [binding.stepId, binding]));

const recordProducedRefs = (step: MapPackage["operationalMap"]["steps"][number], producedRefs: Set<string>): void => {
  for (const outputRef of step.outputRefPolicy.storeAs) {
    producedRefs.add(outputRef);
  }
};

const validateAiSteps = (mapPackage: MapPackage): MapPackageValidationIssue[] => {
  const issues: MapPackageValidationIssue[] = [];
  const bindingsByStep = createBindingsByStep(mapPackage);
  const producedRefs = new Set<string>(INITIAL_INPUT_REFS);
  const transitions = getEffectiveTransitions(mapPackage);

  for (const step of getEffectiveSteps(mapPackage)) {
    recordProducedRefs(step, producedRefs);
    if (step.stepKind !== "ai") {
      continue;
    }

    issues.push(...validatePromptContractStep({
      step,
      binding: bindingsByStep.get(step.stepId),
      producedRefs,
      transitions,
    }));
  }

  return issues;
};

const validateAiGeneratedDraftState = (mapPackage: MapPackage): MapPackageValidationIssue[] => {
  if (!mapPackage.manifest.aiGenerated) {
    return [];
  }

  const issues: MapPackageValidationIssue[] = [];
  if (mapPackage.taskTemplate.availabilityPolicy !== "draft") {
    issues.push({
      code: "map_validation_failed",
      message: "AI-generated map packages must remain draft-only until automation gate passes.",
      path: "taskTemplate.availabilityPolicy",
      severity: "fatal"
    });
  }
  if (mapPackage.manifest.activationGateStatus === "gate_passed" && mapPackage.manifest.automationGateRef === null) {
    issues.push({
      code: "map_validation_failed",
      message: "AI-generated gate-passed maps must include automationGateRef.",
      path: "manifest.automationGateRef",
      severity: "fatal"
    });
  }
  return issues;
};

export function validatePromptContracts(mapPackage: MapPackage): MapPackageValidationIssue[] {
  return [
    ...validateAiSteps(mapPackage),
    ...validateAiGeneratedDraftState(mapPackage),
  ];
}
