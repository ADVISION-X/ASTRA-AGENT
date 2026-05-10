import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { MAP_PLUGIN_LAWS } from "./constants.js";

type FrameCheckStep = {
  stepId: string;
  childCapabilityId: string;
  inputRefs: string[];
  outputRefPolicy: {
    storeAs: string[];
  };
};

type FrameCheckTransition = {
  transitionId: string;
  fromStepId: string;
  toStepId?: string | null;
};

type FrameCheckBinding = {
  stepId: string;
  promptContractId: string;
  requiredInputRefs: string[];
  outputSchemaRef: string;
};

type FrameCheckMapPackage = {
  operationalMap: {
    steps: FrameCheckStep[];
    transitions: FrameCheckTransition[];
  };
  promptBindings: {
    bindings: FrameCheckBinding[];
  };
};

const collectStepRefValues = (step: FrameCheckStep): string[] => [
  step.stepId,
  step.childCapabilityId,
  ...step.inputRefs,
  ...step.outputRefPolicy.storeAs,
];

const collectBindingRefValues = (binding: FrameCheckBinding): string[] => [
  binding.stepId,
  binding.promptContractId,
  ...binding.requiredInputRefs,
  binding.outputSchemaRef,
];

const collectTransitionValues = (transition: FrameCheckTransition): string[] => [
  transition.transitionId,
  transition.fromStepId,
  transition.toStepId ?? "",
];

const findForbiddenFrameTokens = (values: string[]): string[] =>
  values.filter((value) => value.includes("frame-3s") || value.includes("frame-6s") || value.includes("frame-10s") || value.includes("Frame3s") || value.includes("Frame6s") || value.includes("Frame10s"));

export const collectForbiddenFrameFindings = (mapPackage: FrameCheckMapPackage, file: string): Finding[] => {
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