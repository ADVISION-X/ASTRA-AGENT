import type { WorkbenchRuntime } from "./workbench-contract.js";
import type { RequestedPlatformId } from "./workbench-contract.js";
import { recordCommanderDebugEvent } from "./workbench-commander-debug.js";
import { buildHumanCommandDispatchInput, describeHumanCommandTransportMessage } from "./workbench-human-command-dispatch.js";
import type { WorkbenchCommanderMissionSelectionState } from "./workbench-commander-mission-read-model.js";

type HumanCommandDispatchInput = Awaited<ReturnType<typeof buildHumanCommandDispatchInput>>;
type HumanCommandTransportResult = Awaited<ReturnType<WorkbenchRuntime["nerveBusAbilityGroup"]["dispatchHumanCommand"]>>;

type CommanderHumanCommand = {
  commandId: string;
  commandType: string;
  priority: string;
  operatorRef: string;
  targetMissionId: string | null;
  selectedBindingId: string | null;
  targetRecordRef: { recordId: string } | null;
  requestedPlatformId: RequestedPlatformId | null;
  humanGoal: string | null;
  maxRounds: number | null;
  maxMinutes: number | null;
  operatorNote: string | null;
  idempotencyKey: string;
  timeoutMs: number;
  payload: unknown;
};

const logCommanderTransportDebugFailure = (error: unknown) => {
  console.error("[grasseye:commander-transport-debug]", error instanceof Error ? error.message : "Unknown commander transport debug write failure");
};

const recordTransportDebugEvent = (write: Promise<void>) => {
  void write.catch(logCommanderTransportDebugFailure);
};

const recordEnvelopeCreated = async (
  runtime: WorkbenchRuntime,
  command: CommanderHumanCommand,
  dispatchInput: HumanCommandDispatchInput,
) => {
  await recordCommanderDebugEvent(runtime, {
    eventType: "NERVE_BUS_ENVELOPE_CREATED",
    status: "success",
    traceId: dispatchInput.envelope.traceId,
    spanId: dispatchInput.envelope.envelopeId,
    attemptId: dispatchInput.envelope.attemptId,
    missionId: dispatchInput.envelope.missionId,
    runId: dispatchInput.envelope.runId,
    mapId: dispatchInput.envelope.mapId,
    reason: `Nerve Bus governed envelope created for ${command.commandType}.`,
    actionableMessage: "Dispatch through Nerve Bus governed transport.",
    ownerResponsible: "Commander Console / Nerve Bus",
    refs: [
      `commandId=${command.commandId}`,
      `commandEnvelopeRef=${dispatchInput.envelope.envelopeId}`,
      `inputRef=${dispatchInput.envelope.inputRef}`,
    ],
  });
};

const recordDispatchStarted = async (
  runtime: WorkbenchRuntime,
  command: CommanderHumanCommand,
  dispatchInput: HumanCommandDispatchInput,
) => {
  await recordCommanderDebugEvent(runtime, {
    eventType: "NERVE_BUS_DISPATCH_STARTED",
    status: "started",
    traceId: dispatchInput.envelope.traceId,
    spanId: `${dispatchInput.envelope.envelopeId}:dispatch`,
    attemptId: dispatchInput.envelope.attemptId,
    missionId: dispatchInput.envelope.missionId,
    runId: dispatchInput.envelope.runId,
    mapId: dispatchInput.envelope.mapId,
    reason: `Dispatching ${command.commandType} via CommandTransportPort.`,
    actionableMessage: "Wait for governed result envelope and semantic gate validation.",
    ownerResponsible: "Nerve Bus",
    refs: [
      `commandId=${command.commandId}`,
      `commandEnvelopeRef=${dispatchInput.envelope.envelopeId}`,
      `inputRef=${dispatchInput.envelope.inputRef}`,
    ],
  });
};

const buildTransportRefs = (
  command: CommanderHumanCommand,
  dispatchInput: HumanCommandDispatchInput,
  transport: HumanCommandTransportResult,
) => [
  `commandId=${command.commandId}`,
  `commandEnvelopeRef=${transport.commandEnvelope.envelopeId}`,
  `resultEnvelopeRef=${transport.resultEnvelope.envelopeId}`,
  `resultStatus=${transport.resultEnvelope.status}`,
  `proofRef=${transport.resultEnvelope.proofRef}`,
  `inputRef=${dispatchInput.envelope.inputRef}`,
].filter((value): value is string => Boolean(value));

const recordResultEnvelopeReceived = async (
  runtime: WorkbenchRuntime,
  command: CommanderHumanCommand,
  dispatchInput: HumanCommandDispatchInput,
  transport: HumanCommandTransportResult,
) => {
  await recordCommanderDebugEvent(runtime, {
    eventType: "NERVE_BUS_RESULT_ENVELOPE_RECEIVED",
    status: transport.resultEnvelope.status === "success" ? "success" : transport.resultEnvelope.status,
    traceId: transport.commandEnvelope.traceId,
    spanId: `${transport.resultEnvelope.envelopeId}:received`,
    attemptId: transport.commandEnvelope.attemptId,
    missionId: transport.commandEnvelope.missionId,
    runId: transport.commandEnvelope.runId,
    mapId: transport.commandEnvelope.mapId,
    reason: `Nerve Bus received ${transport.resultEnvelope.envelopeKind} for ${command.commandType}.`,
    failureReason: transport.resultEnvelope.failureReason,
    actionableMessage: "Validate the governed result envelope semantic proof before accepting the transport.",
    ownerResponsible: "Nerve Bus",
    refs: buildTransportRefs(command, dispatchInput, transport),
    proofRefs: [transport.resultEnvelope.proofRef],
  });
};

const recordResultSemanticGatePassed = async (
  runtime: WorkbenchRuntime,
  command: CommanderHumanCommand,
  dispatchInput: HumanCommandDispatchInput,
  transport: HumanCommandTransportResult,
) => {
  await recordCommanderDebugEvent(runtime, {
    eventType: "NERVE_BUS_RESULT_SEMANTIC_GATE_PASSED",
    status: "success",
    traceId: transport.commandEnvelope.traceId,
    spanId: `${transport.resultEnvelope.envelopeId}:semantic-gate`,
    attemptId: transport.commandEnvelope.attemptId,
    missionId: transport.commandEnvelope.missionId,
    runId: transport.commandEnvelope.runId,
    mapId: transport.commandEnvelope.mapId,
    reason: `Nerve Bus semantic gate accepted result envelope ${transport.resultEnvelope.envelopeId}.`,
    actionableMessage: "Build transfer proof and preserve command/result correlation refs.",
    ownerResponsible: "Nerve Bus",
    refs: buildTransportRefs(command, dispatchInput, transport),
    proofRefs: [transport.resultEnvelope.proofRef],
  });
};

const recordTransferProofBuilt = async (
  runtime: WorkbenchRuntime,
  command: CommanderHumanCommand,
  dispatchInput: HumanCommandDispatchInput,
  transport: HumanCommandTransportResult,
) => {
  await recordCommanderDebugEvent(runtime, {
    eventType: "NERVE_BUS_TRANSFER_PROOF_BUILT",
    status: "success",
    traceId: transport.commandEnvelope.traceId,
    spanId: `${transport.resultEnvelope.envelopeId}:transfer-proof`,
    attemptId: transport.commandEnvelope.attemptId,
    missionId: transport.commandEnvelope.missionId,
    runId: transport.commandEnvelope.runId,
    mapId: transport.commandEnvelope.mapId,
    reason: `Nerve Bus transfer proof preserved ${transport.commandEnvelope.envelopeId} -> ${transport.resultEnvelope.envelopeId}.`,
    actionableMessage: "Use transfer proof refs for Commander response and downstream audit; do not treat command acceptance as mission success.",
    ownerResponsible: "Nerve Bus",
    refs: buildTransportRefs(command, dispatchInput, transport),
    proofRefs: [transport.resultEnvelope.proofRef],
  });
};

const updateMissionSelectionState = (
  missionSelectionState: WorkbenchCommanderMissionSelectionState,
  command: CommanderHumanCommand,
) => {
  if (command.commandType === "start-mission") {
    missionSelectionState.lastMissionId = command.commandId;
  }
};

const buildTransportResult = (
  command: CommanderHumanCommand,
  transport: HumanCommandTransportResult,
) => {
  const status: "accepted" | "failed" | "review_required" = transport.resultEnvelope.status === "success"
    ? "accepted"
    : transport.resultEnvelope.status;
  return {
    commandId: command.commandId,
    runId: transport.commandEnvelope.runId,
    envelopeRef: transport.commandEnvelope.envelopeId,
    resultEnvelopeRef: transport.resultEnvelope.envelopeId,
    status,
    failureReason: transport.resultEnvelope.failureReason,
    reviewRequiredReason: transport.resultEnvelope.status === "review_required" ? transport.resultEnvelope.failureReason ?? "review required" : null,
    message: describeHumanCommandTransportMessage(transport.resultEnvelope),
    debugLogRef: null,
  };
};

export const createCommandTransport = (
  runtime: WorkbenchRuntime,
  missionSelectionState: WorkbenchCommanderMissionSelectionState,
  dispatchHumanCommand: (input: Awaited<ReturnType<typeof buildHumanCommandDispatchInput>>) => ReturnType<WorkbenchRuntime["nerveBusAbilityGroup"]["dispatchHumanCommand"]> = (input) =>
    runtime.nerveBusAbilityGroup.dispatchHumanCommand(input),
 ) => ({
  emitHumanCommand: async (command: CommanderHumanCommand) => {
    const dispatchInput = await buildHumanCommandDispatchInput(runtime, command);
    recordTransportDebugEvent(recordEnvelopeCreated(runtime, command, dispatchInput));
    recordTransportDebugEvent(recordDispatchStarted(runtime, command, dispatchInput));
    const transport = await dispatchHumanCommand(dispatchInput);
    recordTransportDebugEvent(recordResultEnvelopeReceived(runtime, command, dispatchInput, transport));
    recordTransportDebugEvent(recordResultSemanticGatePassed(runtime, command, dispatchInput, transport));
    recordTransportDebugEvent(recordTransferProofBuilt(runtime, command, dispatchInput, transport));
    updateMissionSelectionState(missionSelectionState, command);
    return buildTransportResult(command, transport);
  },
});
