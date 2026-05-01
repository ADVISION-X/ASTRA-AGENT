import { createPhase } from "../../core/result.js";

type LocalAiRuntimePhaseInput = {
  hasFallbackViolations: boolean;
  registryPassed: boolean;
  runtimeWiringPassed: boolean;
  realPlatformPathPassed: boolean;
  hasProductSignalViolations: boolean;
  phase3PolicyPassed: boolean;
  configValidationPassed: boolean;
  healthVisibilityPassed: boolean;
};

const createBooleanPhase = (
  phaseId: string,
  passed: boolean,
  passMessage: string,
  failMessage: string,
) => createPhase(phaseId, passed ? "PASS" : "CODE VIOLATION", passed, passed ? passMessage : failMessage);

export const createLocalAiRuntimePhases = (input: LocalAiRuntimePhaseInput) => {
  const runtimePathPassed = input.runtimeWiringPassed && input.realPlatformPathPassed;
  const productSignalPassed = input.phase3PolicyPassed && !input.hasProductSignalViolations;

  return [
    createPhase("local-ai-contracts", input.registryPassed ? "PASS" : "LAW-SCRIPT DRIFT", input.registryPassed, input.registryPassed ? "Local AI gateway and prompt registry expose governed task contracts with prompt and schema versions." : "Local AI gateway or prompt registry is missing governed contract wiring."),
    createBooleanPhase("local-ai-runtime-path", runtimePathPassed, "Real-platform Local AI calls default to runtime adapters and keep heuristic execution behind explicit non-real modes only.", "Local AI gateway still allows config-only or heuristic execution to masquerade as real-platform runtime."),
    createBooleanPhase("phase3-policy-blocks", productSignalPassed, "Phase-03 runtime blocks product.signal_summary and uses pending-analysis evidence candidates instead.", "Phase-03 runtime still leaks product.signal_summary into live agent execution."),
    createBooleanPhase("local-ai-model-config", input.configValidationPassed, "Governed local AI model config exists, parses, and blocks cloud, paid, and mock acceptance paths.", "Local AI model config is missing or invalid."),
    createBooleanPhase("local-ai-fallback-scan", !input.hasFallbackViolations, "No obvious external AI fallback keyword was found in source files.", "External AI provider or fallback patterns were found in source files."),
    createBooleanPhase("operator-health-visibility", input.healthVisibilityPassed, "Operator surfaces expose real Local AI health, recent task identity, and failure reason.", "Workbench or runtime snapshot still hides Local AI health behind placeholders or stale fields."),
  ];
};