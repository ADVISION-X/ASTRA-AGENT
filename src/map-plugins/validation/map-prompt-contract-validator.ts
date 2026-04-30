import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";
import { validatePromptContractStep } from "./prompt-contract-step-validator.js";

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

  for (const step of mapPackage.operationalMap.steps) {
    recordProducedRefs(step, producedRefs);
    if (step.stepKind !== "ai") {
      continue;
    }

    issues.push(...validatePromptContractStep({
      step,
      binding: bindingsByStep.get(step.stepId),
      producedRefs,
      transitions: mapPackage.operationalMap.transitions,
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
      message: "AI-generated map packages must remain draft-only until approved.",
      path: "taskTemplate.availabilityPolicy",
      severity: "fatal"
    });
  }
  if (mapPackage.manifest.approvalStatus === "approved" && mapPackage.manifest.humanApprovalRef === null) {
    issues.push({
      code: "map_validation_failed",
      message: "AI-generated approved maps must include humanApprovalRef.",
      path: "manifest.humanApprovalRef",
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
