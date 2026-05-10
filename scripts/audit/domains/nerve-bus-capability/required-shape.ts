import { Node, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression } from "../_shared/ast-helpers.js";
import { hasInterfaceMethod } from "../_shared/ast-schema-queries.js";
import { CHANNEL_IDS, LAW_IDS, PATHS } from "./config.js";
import { getSourceFile, makeProject, missingRequiredFiles } from "./project-access.js";
import { collectChannelAndRegistryFindings } from "./required-shape-channel-findings.js";
import { collectBuilderFindings } from "./required-shape-builder-findings.js";
import { collectExecutorFindings } from "./required-shape-executor-findings.js";

const CONTRACT_METHODS = [
  "transportEnvelope",
  "dispatchHumanCommand",
  "dispatchAbilityCommand",
  "dispatchAbilityResult",
  "requestAi",
  "dispatchAiResponse",
  "dispatchCommanderMessage",
] as const;

const SCHEMA_SOURCE_PATHS = [
  `${PATHS.ROOT}/schema-foundation.schema.ts`,
  `${PATHS.ROOT}/schema-envelope.schema.ts`,
  `${PATHS.ROOT}/schema-transport.schema.ts`,
] as const;
const SHARED_CHANNEL_PATH = `${PATHS.ROOT}/shared/nerve-bus-channel.ts`;
const TRANSPORT_DISPATCH_PATH = `${PATHS.ROOT}/ability-group-transport-dispatch.ts`;
const ORCHESTRATION_TO_AI_CHILD_PATH = `${PATHS.ROOT}/children/orchestration-to-ai/implementation.ts`;

const REQUIRED_SCHEMA_FIELDS = [
  "missionId",
  "runId",
  "sessionId",
  "stepId",
  "nerveBusEnvelopeId",
  "capabilityCallId",
  "requestedBy",
  "sourceRef",
  "inputRef",
  "payloadRef",
  "outputRef",
  "status",
  "failureReason",
  "reviewRequiredReason",
  "idempotencyKey",
  "commanderCommandRef",
  "commanderEnvelopeRef",
  "requestedPlatformId",
  "targetRecordRef",
  "targetAbilityGroupId",
  "targetChildCapabilityId",
  "capabilityInputRef",
  "expectedOutputSchemaRef",
  "promptContractId",
  "promptContractVersion",
  "outputSchemaRef",
  "aiInputRefs",
  "providerPolicyRef",
] as const;

const getPropertyNames = (sourceTextOwner: NonNullable<ReturnType<typeof getSourceFile>>): Set<string> => {
  return new Set(
    sourceTextOwner.getDescendants().flatMap((node) => {
      if (Node.isPropertyAssignment(node) || Node.isShorthandPropertyAssignment(node)) {
        return [node.getName()];
      }
      return [];
    }),
  );
};

const sourceHasProperties = (sourceTextOwner: ReturnType<typeof getSourceFile>, propertyNames: readonly string[]): boolean => {
  if (!sourceTextOwner) {
    return false;
  }

  const names = getPropertyNames(sourceTextOwner);
  return propertyNames.every((propertyName) => names.has(propertyName));
};

const sourceTextIncludesAll = (sourceTextOwner: ReturnType<typeof getSourceFile>, tokens: readonly string[]): boolean => {
  if (!sourceTextOwner) {
    return false;
  }

  const text = sourceTextOwner.getFullText();
  return tokens.every((token) => text.includes(token));
};

const getSchemaSources = (project: ReturnType<typeof makeProject>) => {
  return SCHEMA_SOURCE_PATHS
    .map((path) => getSourceFile(project, path))
    .filter((sourceFile): sourceFile is NonNullable<typeof sourceFile> => sourceFile !== null);
};

const schemaSourcesHaveProperties = (project: ReturnType<typeof makeProject>, propertyNames: readonly string[]): boolean => {
  const names = new Set<string>();
  for (const sourceFile of getSchemaSources(project)) {
    for (const propertyName of getPropertyNames(sourceFile)) {
      names.add(propertyName);
    }
  }
  return propertyNames.every((propertyName) => names.has(propertyName));
};

const hasCallObjectProperty = (
  sourceTextOwner: ReturnType<typeof getSourceFile>,
  callName: string,
  propertyName: string,
): boolean => Boolean(sourceTextOwner?.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
  if (callExpression.getExpression().getText() !== callName) return false;
  return callExpression.getArguments().some((argument) =>
    Node.isObjectLiteralExpression(argument)
    && argument.getProperties().some((property) => Node.isPropertyAssignment(property) && property.getName() === propertyName),
  );
}));

const functionParameterTypeHasProperty = (
  sourceTextOwner: ReturnType<typeof getSourceFile>,
  functionName: string,
  propertyName: string,
): boolean => Boolean(sourceTextOwner?.getFunction(functionName)
  ?.getParameters()[0]
  ?.getTypeNode()
  ?.getDescendantsOfKind(SyntaxKind.PropertySignature)
  .some((property) => property.getName() === propertyName));

const sourceHasPropertySignature = (
  sourceTextOwner: ReturnType<typeof getSourceFile>,
  propertyName: string,
): boolean => Boolean(sourceTextOwner?.getDescendantsOfKind(SyntaxKind.PropertySignature)
  .some((property) => property.getName() === propertyName));

const hasCallArgumentText = (
  sourceTextOwner: ReturnType<typeof getSourceFile>,
  callName: string,
  argumentText: string,
): boolean => Boolean(sourceTextOwner?.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
  return callExpression.getExpression().getText() === callName
    && callExpression.getArguments().some((argument) => argument.getText() === argumentText);
}));

async function collectMissingFileFindings(findings: Finding[]): Promise<void> {
  for (const filePath of await missingRequiredFiles()) {
    findings.push(createFinding({ lawId: LAW_IDS.ENFORCEMENT, file: filePath, line: 1, severity: "fatal", message: "Nerve Bus required production file is missing." }));
  }
}

function collectContractFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const contractSource = getSourceFile(project, PATHS.CONTRACT);
  if (!contractSource) {
    return [createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.CONTRACT, line: 1, severity: "fatal", message: "Nerve Bus contract.ts is missing." })];
  }

  return CONTRACT_METHODS
    .filter((methodName) => !hasInterfaceMethod(contractSource, "NerveBusAbilityGroup", methodName))
    .map((methodName) => createFinding({
      lawId: LAW_IDS.PUBLIC,
      file: PATHS.CONTRACT,
      line: 1,
      severity: "fatal",
      message: `Nerve Bus public contract must expose ${methodName}.`,
    }));
}

function interfaceMethodCarriesSignal(project: ReturnType<typeof makeProject>, path: string, interfaceName: string, methodName: string): boolean {
  const source = getSourceFile(project, path);
  const method = source?.getInterface(interfaceName)?.getMethod(methodName);
  const firstParameter = method?.getParameters()[0]?.getTypeNode()?.getText() ?? "";
  return firstParameter.includes("signal: AbortSignal");
}

function collectHandlerPortFindings(project: ReturnType<typeof makeProject>): Finding[] {
  return ["dispatchAbilityCommand", "dispatchHumanCommand", "requestAi"]
    .filter((methodName) => !interfaceMethodCarriesSignal(project, PATHS.HANDLER_PORT, "NerveBusHandlerPort", methodName))
    .map((methodName) => createFinding({ lawId: LAW_IDS.PIPELINE, file: PATHS.HANDLER_PORT, line: 1, severity: "fatal", message: `Nerve Bus handler port method ${methodName} must carry AbortSignal.` }));
}

function collectHumanTransportFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const humanDispatchSource = getSourceFile(project, PATHS.HUMAN_COMMAND_DISPATCH);
  return !sourceHasProperties(humanDispatchSource, ["commanderCommandRef", "commanderEnvelopeRef", "requestedPlatformId", "targetRecordRef"])
    ? [createFinding({ lawId: LAW_IDS.CHAIN, file: PATHS.HUMAN_COMMAND_DISPATCH, line: 1, severity: "fatal", message: "Commander-to-Orchestration transport builder must preserve governed human command fields." })]
    : [];
}

function collectCommandTransportFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const commandTransportSource = getSourceFile(project, PATHS.COMMANDER_COMMAND_TRANSPORT);
  return !commandTransportSource || !hasCallExpression(commandTransportSource, "dispatchHumanCommand")
    ? [createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.COMMANDER_COMMAND_TRANSPORT, line: 1, severity: "fatal", message: "Commander command transport must dispatch human commands through Nerve Bus." })]
    : [];
}

function collectAdapterTransportFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const adapterSource = getSourceFile(project, PATHS.ORCHESTRATION_ADAPTER);
  return !adapterSource || !hasCallExpression(adapterSource, "dispatchAbilityCommand") || !hasCallExpression(adapterSource, "requestAi") || adapterSource.getFullText().includes("dispatchCommanderMessage")
    ? [createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.ORCHESTRATION_ADAPTER, line: 1, severity: "fatal", message: "Orchestration adapter must route ability and AI traffic through Nerve Bus and must not expose runtime Commander review traffic." })]
    : [];
}

function collectEnvelopeBuilderTransportFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const envelopeBuilderSource = getSourceFile(project, PATHS.ORCHESTRATION_ENVELOPE_BUILDERS);
  return !sourceHasProperties(envelopeBuilderSource, [
    "runId",
    "stepId",
    "capabilityCallId",
    "idempotencyKey",
    "expectedOutputSchemaRef",
    "promptContractVersion",
    "outputSchemaRef",
    "aiInputRefs",
  ])
    ? [createFinding({ lawId: LAW_IDS.CHAIN, file: PATHS.ORCHESTRATION_ENVELOPE_BUILDERS, line: 1, severity: "fatal", message: "Orchestration envelope builders must preserve governed transport and AI envelope fields without runtime Commander review dispatch." })]
    : [];
}

function collectStepDispatcherTransportFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const stepDispatcherSource = getSourceFile(project, PATHS.STEP_DISPATCHER);
  const stepDispatchRequestBuildersSource = getSourceFile(project, PATHS.STEP_DISPATCH_REQUEST_BUILDERS);
  if (!stepDispatcherSource || !hasCallExpression(stepDispatcherSource, "sendCommandToAbility") || !hasCallExpression(stepDispatcherSource, "sendRequestToAi") || stepDispatcherSource.getFullText().includes("sendReviewRequestToCommander")) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.STEP_DISPATCHER, line: 1, severity: "fatal", message: "Orchestration step dispatcher must use governed Nerve Bus port methods for ability and AI dispatch only; runtime review dispatch is forbidden." }));
  }
  if (!sourceHasProperties(stepDispatchRequestBuildersSource, ["runId", "stepId", "idempotencyKey", "promptContractVersion", "outputSchemaRef", "aiInputRefs"])) {
    findings.push(createFinding({ lawId: LAW_IDS.CHAIN, file: PATHS.STEP_DISPATCH_REQUEST_BUILDERS, line: 1, severity: "fatal", message: "Orchestration step dispatcher must preserve governed step/idempotency and AI prompt binding refs." }));
  }
  return findings;
}

function collectRuntimeContextTransportFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const runtimeContextSource = getSourceFile(project, PATHS.ORCHESTRATION_RUNTIME_CONTEXT);
  return !runtimeContextSource || runtimeContextSource.getFullText().includes("dispatchCommanderMessage")
    ? [createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.ORCHESTRATION_RUNTIME_CONTEXT, line: 1, severity: "fatal", message: "Orchestration runtime context must not expose Nerve Bus commander-message review transport surface." })]
    : [];
}

function collectBoundaryTransportFindings(project: ReturnType<typeof makeProject>): Finding[] {
  return [
    ...collectHumanTransportFindings(project),
    ...collectCommandTransportFindings(project),
    ...collectAdapterTransportFindings(project),
    ...collectEnvelopeBuilderTransportFindings(project),
    ...collectStepDispatcherTransportFindings(project),
    ...collectRuntimeContextTransportFindings(project),
  ];
}

function collectSchemaFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const schemaSource = getSourceFile(project, PATHS.SCHEMA);
  if (!schemaSource) {
    return [createFinding({ lawId: LAW_IDS.CHAIN, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Nerve Bus schema file is missing." })];
  }

  const findings: Finding[] = [];
  for (const declaration of ["NerveBusTransportInputSchema", "NerveBusMirroredTransportResultSchema", "NerveBusTransportProofSchema"]) {
    if (!sourceTextIncludesAll(schemaSource, [declaration])) {
      findings.push(createFinding({ lawId: LAW_IDS.CHAIN, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: `Nerve Bus schema must declare ${declaration}.` }));
    }
  }

  if (!schemaSourcesHaveProperties(project, REQUIRED_SCHEMA_FIELDS)) {
    findings.push(createFinding({ lawId: LAW_IDS.CHAIN, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Nerve Bus schema must declare full-chain envelope, AI, and result fields." }));
  }

  return findings;
}

function collectAiSignalChainFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const transportSchemaSource = getSourceFile(project, `${PATHS.ROOT}/schema-transport.schema.ts`);
  const sharedChannelSource = getSourceFile(project, SHARED_CHANNEL_PATH);
  const dispatchSource = getSourceFile(project, TRANSPORT_DISPATCH_PATH);
  const orchestrationToAiSource = getSourceFile(project, ORCHESTRATION_TO_AI_CHILD_PATH);
  const runnerSource = getSourceFile(project, PATHS.RUNNER);

  if (!sourceHasProperties(transportSchemaSource, ["signal"])) {
    findings.push(createFinding({ lawId: LAW_IDS.AI, file: `${PATHS.ROOT}/schema-transport.schema.ts`, line: 1, severity: "fatal", message: "Nerve Bus AiRequestDispatchInputSchema must preserve the Orchestration AI AbortSignal." }));
  }
  if (!sourceHasPropertySignature(sharedChannelSource, "signal")) {
    findings.push(createFinding({ lawId: LAW_IDS.AI, file: SHARED_CHANNEL_PATH, line: 1, severity: "fatal", message: "Nerve Bus child execution input must carry AbortSignal through the child boundary." }));
  }
  if (!hasCallObjectProperty(dispatchSource, "executeNerveBusChild", "signal")) {
    findings.push(createFinding({ lawId: LAW_IDS.AI, file: TRANSPORT_DISPATCH_PATH, line: 1, severity: "fatal", message: "Nerve Bus orchestration-to-ai dispatch must pass channelInput.signal into executeNerveBusChild." }));
  }
  if (!hasCallObjectProperty(orchestrationToAiSource, "runTransportHandler", "parentSignal")) {
    findings.push(createFinding({ lawId: LAW_IDS.AI, file: ORCHESTRATION_TO_AI_CHILD_PATH, line: 1, severity: "fatal", message: "Nerve Bus orchestration-to-ai child must pass input.signal as parentSignal to the transport runner." }));
  }
  if (!functionParameterTypeHasProperty(runnerSource, "runTransportHandler", "parentSignal") || !hasCallArgumentText(runnerSource, "input.invoke", "handlerSignal")) {
    findings.push(createFinding({ lawId: LAW_IDS.AI, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Nerve Bus transport runner must combine parentSignal with its timeout signal before invoking the AI handler." }));
  }

  return findings;
}

export async function runRequiredShapeAttack(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const project = makeProject();
  const findings: Finding[] = [];

  await collectMissingFileFindings(findings);
  findings.push(...collectContractFindings(project));
  findings.push(...collectHandlerPortFindings(project));
  findings.push(...collectBoundaryTransportFindings(project));
  findings.push(...collectSchemaFindings(project));
  findings.push(...collectAiSignalChainFindings(project));
  findings.push(...collectChannelAndRegistryFindings(project));
  findings.push(...collectExecutorFindings(project));
  findings.push(...collectBuilderFindings(project));

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "required-shape",
      phasePassed ? "PASS" : "CODE VIOLATION",
      phasePassed,
      phasePassed
        ? "Nerve Bus V2 transport contract, six channels, full-chain envelope fields, and governed builders are present."
        : "Nerve Bus V2 transport shape is incomplete or has drifted from the governed contract.",
    ),
  };
}
