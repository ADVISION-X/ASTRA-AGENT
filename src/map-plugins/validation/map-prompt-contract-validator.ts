import type { AiTaskType } from "../../capabilities/ai/contract.js";
import { tryGetPromptContractCatalogEntry } from "../../capabilities/ai/prompt-contracts/index.js";
import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";

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

const AI_TASK_TYPE_BY_CHILD_CAPABILITY_ID: Record<string, AiTaskType> = {
  "product-presence-judgment": "product_presence_judgment",
  "comment-text-cleanup": "ocr_cleanup",
  "comment-intent-analysis": "comment_signal_summary",
  "product-signal-summary": "product_signal_summary",
};

export function validatePromptContracts(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const issues: MapPackageValidationIssue[] = [];
  const bindingsByStep = new Map(mapPackage.promptBindings.bindings.map((binding) => [binding.stepId, binding]));
  const producedRefs = new Set<string>(INITIAL_INPUT_REFS);

  for (const step of mapPackage.operationalMap.steps) {
    for (const outputRef of step.outputRefPolicy.storeAs) {
      producedRefs.add(outputRef);
    }

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
      continue;
    }

    const promptContract = tryGetPromptContractCatalogEntry(binding.promptContractId);
    if (promptContract === null) {
      issues.push({
        code: "missing_prompt_contract",
        message: `AI step ${step.stepId} references unknown prompt contract ${binding.promptContractId}.`,
        path: `promptBindings.bindings.${step.stepId}`,
        severity: "fatal"
      });
      continue;
    }

    const expectedTaskType = AI_TASK_TYPE_BY_CHILD_CAPABILITY_ID[step.childCapabilityId];
    if (!expectedTaskType) {
      issues.push({
        code: "map_validation_failed",
        message: `AI step ${step.stepId} uses unsupported childCapabilityId ${step.childCapabilityId}.`,
        path: `operationalMap.steps.${step.stepId}`,
        severity: "fatal"
      });
      continue;
    }

    if (promptContract.taskType !== expectedTaskType) {
      issues.push({
        code: "missing_prompt_contract",
        message: `AI step ${step.stepId} expects taskType ${expectedTaskType}, but prompt contract ${promptContract.promptContractId} declares ${promptContract.taskType}.`,
        path: `promptBindings.bindings.${step.stepId}`,
        severity: "fatal"
      });
    }

    if (binding.outputSchemaRef !== promptContract.outputSchemaRef) {
      issues.push({
        code: "map_validation_failed",
        message: `AI step ${step.stepId} outputSchemaRef must match prompt contract ${promptContract.promptContractId}.`,
        path: `promptBindings.bindings.${step.stepId}`,
        severity: "fatal"
      });
    }

    const missingStepInputRefs = binding.requiredInputRefs.filter((inputRef) => !step.inputRefs.some((candidate) => candidate === inputRef));
    if (missingStepInputRefs.length > 0) {
      issues.push({
        code: "missing_dependency",
        message: `AI step ${step.stepId} is missing required input refs: ${missingStepInputRefs.join(", ")}.`,
        path: `operationalMap.steps.${step.stepId}`,
        severity: "fatal"
      });
    }

    const missingProducedRefs = binding.requiredInputRefs.filter((inputRef) => !producedRefs.has(inputRef));
    if (missingProducedRefs.length > 0) {
      issues.push({
        code: "missing_dependency",
        message: `AI step ${step.stepId} requires refs that are not produced before execution: ${missingProducedRefs.join(", ")}.`,
        path: `promptBindings.bindings.${step.stepId}`,
        severity: "fatal"
      });
    }

    const missingContractRefs = promptContract.requiredInputRefs.filter((inputRef) => !binding.requiredInputRefs.includes(inputRef));
    if (missingContractRefs.length > 0) {
      issues.push({
        code: "missing_dependency",
        message: `AI step ${step.stepId} binding omits prompt contract requiredInputRefs: ${missingContractRefs.join(", ")}.`,
        path: `promptBindings.bindings.${step.stepId}`,
        severity: "fatal"
      });
    }

    const usesDecisionBranch =
      step.successCondition.source === "decision" ||
      mapPackage.operationalMap.transitions.some((transition) => transition.fromStepId === step.stepId && transition.condition.source === "decision");
    if (usesDecisionBranch && !promptContract.allowedBranchFields.includes("decision")) {
      issues.push({
        code: "map_validation_failed",
        message: `AI step ${step.stepId} branches on decision but prompt contract ${promptContract.promptContractId} does not allow that branch field.`,
        path: `operationalMap.steps.${step.stepId}`,
        severity: "fatal"
      });
    }

    const declaredPolicies = [binding.reviewPolicy.toLowerCase(), promptContract.reviewPolicy.toLowerCase()];
    if (promptContract.sensitiveOperation && declaredPolicies.includes("none")) {
      issues.push({
        code: "security_violation",
        message: `Sensitive prompt contract ${promptContract.promptContractId} must not use reviewPolicy=none.`,
        path: `promptBindings.bindings.${step.stepId}`,
        severity: "fatal"
      });
    }

    if (!promptContract.prohibitedActions.includes("dispatch_action") && !promptContract.prohibitedActions.includes("open_page")) {
      issues.push({
        code: "security_violation",
        message: `Prompt contract ${promptContract.promptContractId} must explicitly prohibit delegated action execution.`,
        path: `promptBindings.bindings.${step.stepId}`,
        severity: "error"
      });
    }

    if (!promptContract.restrictedDataAccess.includes("credentials")) {
      issues.push({
        code: "security_violation",
        message: `Prompt contract ${promptContract.promptContractId} must explicitly restrict credential access.`,
        path: `promptBindings.bindings.${step.stepId}`,
        severity: "error"
      });
    }
  }

  if (mapPackage.manifest.aiGenerated) {
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
  }

  return issues;
}
