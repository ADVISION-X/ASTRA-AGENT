import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";

export function validatePromptContracts(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const issues: MapPackageValidationIssue[] = [];
  const bindingsByStep = new Map(mapPackage.promptBindings.bindings.map((binding) => [binding.stepId, binding]));
  for (const step of mapPackage.operationalMap.steps) {
    if (step.stepKind !== "ai") {
      continue;
    }
    const binding = bindingsByStep.get(step.stepId);
    if (!binding || binding.promptContractId !== step.promptContractId) {
      issues.push({
        code: "missing_prompt_contract",
        message: `AI step ${step.stepId} is missing a matching prompt binding.`,
        path: `operationalMap.steps.${step.stepId}`,
        severity: "error"
      });
    }
  }
  return issues;
}
