import { createFinding, createPhase, type Finding } from "./inspection-core.js";
import { createAuditProject, getSourceFileOrThrow } from "./inspection-ast-helpers.js";

const COMMAND_SUPPORT_PATH = "src/capabilities/orchestration/runtime/orchestration-executor-command-support.ts";
const STEP_DISPATCH_SHARED_PATH = "src/capabilities/orchestration/runtime/step-dispatch-shared.ts";
const STEP_DISPATCH_AI_PATH = "src/capabilities/orchestration/runtime/step-dispatch-ai.ts";
const STEP_DISPATCH_REQUEST_BUILDERS_PATH = "src/capabilities/orchestration/runtime/step-dispatch-request-builders.ts";

type PhaseResult = {
  findings: Finding[];
  phase: ReturnType<typeof createPhase>;
};

const createFatalFinding = (input: { file: string; message: string }): Finding =>
  createFinding({
    lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1",
    file: input.file,
    line: 1,
    severity: "fatal",
    message: input.message,
  });

const collectInitializationFindings = (findings: Finding[], commandSupportText: string): void => {
  if (commandSupportText.includes("targetUrl: command.initialPayload.targetUrl") && commandSupportText.includes("targetTitle: command.initialPayload.targetTitle")) {
    return;
  }
  findings.push(createFatalFinding({ file: COMMAND_SUPPORT_PATH, message: "Orchestration mission initialization must freeze targetUrl and targetTitle into mission payload refs from command.initialPayload." }));
};

const collectSharedGuardFindings = (findings: Finding[], sharedText: string): void => {
  if (
    sharedText.includes("map.persistentPayloadRefs")
    && sharedText.includes("if (persistentKeys.has(key) || value === null)")
    && sharedText.includes("if (persistentKeys.has(key))")
  ) {
    return;
  }
  findings.push(createFatalFinding({ file: STEP_DISPATCH_SHARED_PATH, message: "Orchestration step dispatch must preserve map-declared persistent mission refs across payloadRef merges and forbid step outputs from fabricating them." }));
};

const collectAbilityDispatchFindings = (findings: Finding[], requestBuilderText: string): void => {
  if (requestBuilderText.includes("resolvePersistentMissionPayloadRefKeys(input.map)") && requestBuilderText.includes("mergeDispatchPayloadRefs")) {
    return;
  }
  findings.push(createFatalFinding({ file: STEP_DISPATCH_REQUEST_BUILDERS_PATH, message: "Ability-step dispatch results must merge payload refs through the persistent mission ref guard chain." }));
};

const collectAiDispatchFindings = (findings: Finding[], aiText: string): void => {
  if (aiText.includes("resolvePersistentMissionPayloadRefKeys(input.map)") && aiText.includes("mergeDispatchPayloadRefs")) {
    return;
  }
  findings.push(createFatalFinding({ file: STEP_DISPATCH_AI_PATH, message: "AI-step dispatch results must merge payload refs through the persistent mission ref guard chain." }));
};

export function inspectPersistentMissionRefChain(project: ReturnType<typeof createAuditProject>): PhaseResult {
  const commandSupportText = getSourceFileOrThrow(project, COMMAND_SUPPORT_PATH).getFullText();
  const sharedText = getSourceFileOrThrow(project, STEP_DISPATCH_SHARED_PATH).getFullText();
  const aiText = getSourceFileOrThrow(project, STEP_DISPATCH_AI_PATH).getFullText();
  const requestBuilderText = getSourceFileOrThrow(project, STEP_DISPATCH_REQUEST_BUILDERS_PATH).getFullText();
  const findings: Finding[] = [];

  collectInitializationFindings(findings, commandSupportText);
  collectSharedGuardFindings(findings, sharedText);
  collectAbilityDispatchFindings(findings, requestBuilderText);
  collectAiDispatchFindings(findings, aiText);

  return {
    findings,
    phase: createPhase(
      "persistent-mission-ref-chain",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Orchestration freezes targetUrl/targetTitle from mission start and preserves map-declared persistent mission refs across step dispatch." 
        : "Orchestration can still lose or fabricate persistent mission refs across step dispatch.",
    ),
  };
}