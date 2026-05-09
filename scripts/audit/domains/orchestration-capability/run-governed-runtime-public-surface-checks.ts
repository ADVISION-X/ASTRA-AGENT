import { Node } from "ts-morph";

import { createFinding, type Finding } from "./inspection-core.js";
import { createAuditProject, getSourceFileOrThrow } from "./inspection-ast-helpers.js";
import { orchestrationInspectionConstants as config } from "./inspection-constants.js";

const EXECUTOR_PATH = "src/capabilities/orchestration/runtime/orchestration-executor.ts";
const CHILD_RUNNER_PATH = "src/capabilities/orchestration/runtime/orchestration-child-runner.ts";
const NERVE_BUS_PORT_PATH = "src/capabilities/orchestration/ports/orchestration-nerve-bus-port.ts";
const NERVE_BUS_ADAPTER_PATH = "src/capabilities/orchestration/runtime/orchestration-nerve-bus-adapter.ts";
const NERVE_BUS_ENVELOPE_BUILDERS_PATH = "src/capabilities/orchestration/runtime/orchestration-nerve-bus-envelope-builders.ts";
const DIRECT_EXECUTOR_IMPORTS = new Set([
  "executeMissionCommand",
  "pauseMissionCommand",
  "resumeMissionCommand",
  "stopMissionCommand",
  "emergencyStopMissionCommand",
]);

function collectLineNumber(text: string, needle: string): number {
  const lines = text.split("\n");
  const lineIndex = lines.findIndex((line) => line.includes(needle));
  return lineIndex >= 0 ? lineIndex + 1 : 1;
}

function createFatalFinding(input: { lawId: string; file: string; line: number; message: string; detail?: string }): Finding {
  return createFinding({
    lawId: input.lawId,
    file: input.file,
    line: input.line,
    severity: "fatal",
    message: input.message,
    ...(input.detail ? { detail: input.detail } : {}),
  });
}

export function collectExecuteBoundaryFindings(project: ReturnType<typeof createAuditProject>, findings: Finding[]): void {
  const contractSource = getSourceFileOrThrow(project, config.CONTRACT_PATH);
  const abilityGroupSource = getSourceFileOrThrow(project, config.ABILITY_GROUP_PATH);
  const executorSource = getSourceFileOrThrow(project, EXECUTOR_PATH);

  const executeMethod = contractSource.getInterface("OrchestrationAbilityGroup")?.getMethod("execute");
  const executeReturnText = executeMethod?.getReturnTypeNode()?.getText() ?? "";
  if (executeReturnText.includes("unknown")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: config.CONTRACT_PATH, line: executeMethod?.getStartLineNumber() ?? 1, message: "Orchestration public execute boundary must return a governed typed result, not Promise<unknown>." }));
  }

  const directExecutorImports = abilityGroupSource
    .getImportDeclarations()
    .filter((declaration) => declaration.getModuleSpecifierValue() === "./runtime/orchestration-executor.js")
    .flatMap((declaration) => declaration.getNamedImports())
    .map((specifier) => specifier.getName())
    .filter((specifier) => DIRECT_EXECUTOR_IMPORTS.has(specifier));
  if (directExecutorImports.length > 0) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: config.ABILITY_GROUP_PATH, line: 1, message: "Orchestration ability-group public methods must not call granular executor commands directly; retain only governed execute plus thin wrappers.", detail: directExecutorImports.join(", ") }));
  }

  const executorText = executorSource.getFullText();
  const forbiddenMarker = ["request-human-review", "RequestHumanReview", "submitReviewDecision", "submitMissionReviewDecision", "sendReviewRequestToCommander"].find((marker) => executorText.includes(marker));
  if (forbiddenMarker) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: EXECUTOR_PATH, line: collectLineNumber(executorText, forbiddenMarker), message: "Orchestration must not expose request-human-review, sendReviewRequestToCommander, or review-decision routing. Automation failures must terminate as failed, not route to runtime human review." }));
  }
}

export function collectChildRunnerFindings(project: ReturnType<typeof createAuditProject>, findings: Finding[]): void {
  const childRunnerSource = getSourceFileOrThrow(project, CHILD_RUNNER_PATH);
  const childRunnerText = childRunnerSource.getFullText();

  if (childRunnerText.includes("runtimeProof: null")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: CHILD_RUNNER_PATH, line: collectLineNumber(childRunnerText, "runtimeProof: null"), message: "Unknown orchestration child failure must carry typed proof and must not return runtimeProof:null." }));
  }
  if ((childRunnerSource.getFunction("executeOrchestrationChild")?.getReturnTypeNode()?.getText() ?? "").includes("unknown")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: CHILD_RUNNER_PATH, line: childRunnerSource.getFunction("executeOrchestrationChild")?.getStartLineNumber() ?? 1, message: "Orchestration child executor pipeline must return a governed envelope, not Promise<unknown>." }));
  }
}

export function collectForbiddenRoutingFindings(project: ReturnType<typeof createAuditProject>, findings: Finding[]): void {
  const schemaSource = getSourceFileOrThrow(project, config.SCHEMA_PATH);
  const registrySource = getSourceFileOrThrow(project, config.REGISTRY_PATH);
  const childRunnerSource = getSourceFileOrThrow(project, CHILD_RUNNER_PATH);
  const contractSource = getSourceFileOrThrow(project, config.CONTRACT_PATH);
  const abilityGroupSource = getSourceFileOrThrow(project, config.ABILITY_GROUP_PATH);
  const nerveBusPortSource = getSourceFileOrThrow(project, NERVE_BUS_PORT_PATH);
  const nerveBusAdapterSource = getSourceFileOrThrow(project, NERVE_BUS_ADAPTER_PATH);
  const nerveBusEnvelopeBuildersSource = getSourceFileOrThrow(project, NERVE_BUS_ENVELOPE_BUILDERS_PATH);

  const forbiddenSources = [
    { file: config.SCHEMA_PATH, text: schemaSource.getFullText() },
    { file: config.REGISTRY_PATH, text: registrySource.getFullText() },
    { file: CHILD_RUNNER_PATH, text: childRunnerSource.getFullText() },
    { file: config.CONTRACT_PATH, text: contractSource.getFullText() },
    { file: config.ABILITY_GROUP_PATH, text: abilityGroupSource.getFullText() },
    { file: NERVE_BUS_PORT_PATH, text: nerveBusPortSource.getFullText() },
    { file: NERVE_BUS_ADAPTER_PATH, text: nerveBusAdapterSource.getFullText() },
    { file: NERVE_BUS_ENVELOPE_BUILDERS_PATH, text: nerveBusEnvelopeBuildersSource.getFullText() },
  ];
  for (const source of forbiddenSources) {
    const forbiddenMarker = ["request-human-review", "RequestHumanReview", "submitReviewDecision", "submitMissionReviewDecision", "sendReviewRequestToCommander"].find((marker) => source.text.includes(marker));
    if (forbiddenMarker) {
      findings.push(createFatalFinding({
        lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1",
        file: source.file,
        line: collectLineNumber(source.text, forbiddenMarker),
        message: "Orchestration must not expose request-human-review, sendReviewRequestToCommander, or review-decision routing. Automation failures must terminate as failed, not route to runtime human review.",
      }));
    }
  }
}