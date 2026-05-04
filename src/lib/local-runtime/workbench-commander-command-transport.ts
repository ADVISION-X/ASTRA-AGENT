import type { WorkbenchRuntime } from "./workbench-contract.js";
import { recordCommanderDebugEvent } from "./workbench-commander-debug.js";
import { buildHumanCommandDispatchInput, describeHumanCommandTransportMessage } from "./workbench-human-command-dispatch.js";
import type { WorkbenchCommanderMissionSelectionState } from "./workbench-commander-mission-read-model.js";

type CommanderHumanCommand = {
  commandId: string;
  commandType: string;
  priority: string;
  operatorRef: string;
  targetMissionId: string | null;
  selectedMapId: string | null;
  targetRecordRef: { recordId: string } | null;
  requestedPlatformId: "facebook-web" | "tiktok-web" | null;
  humanGoal: string | null;
  maxRounds: number | null;
  maxMinutes: number | null;
  operatorNote: string | null;
  idempotencyKey: string;
  timeoutMs: number;
  payload: unknown;
};

export const createCommandTransport = (
  runtime: WorkbenchRuntime,
  missionSelectionState: WorkbenchCommanderMissionSelectionState,
  dispatchHumanCommand: (input: Awaited<ReturnType<typeof buildHumanCommandDispatchInput>>) => ReturnType<WorkbenchRuntime["nerveBusAbilityGroup"]["dispatchHumanCommand"]> = (input) =>
    runtime.nerveBusAbilityGroup.dispatchHumanCommand(input),
 ) => ({
  emitHumanCommand: async (command: CommanderHumanCommand) => {
    const dispatchInput = await buildHumanCommandDispatchInput(runtime, command);
    await recordCommanderDebugEvent(runtime, {
      eventType: "NERVE_BUS_ENVELOPE_CREATED",
      status: "success",
      traceId: command.commandId,
      spanId: dispatchInput.envelope.envelopeId,
      attemptId: command.commandId,
      missionId: dispatchInput.envelope.missionId,
      mapId: dispatchInput.envelope.mapId,
      taskTemplateId: dispatchInput.envelope.taskTemplateId,
      reason: `Nerve Bus governed envelope created for ${command.commandType}.`,
      actionableMessage: "Dispatch through Nerve Bus governed transport.",
      ownerResponsible: "Commander Console / Nerve Bus",
    });
    await recordCommanderDebugEvent(runtime, {
      eventType: "NERVE_BUS_DISPATCH_STARTED",
      status: "started",
      traceId: command.commandId,
      spanId: `${dispatchInput.envelope.envelopeId}:dispatch`,
      attemptId: command.commandId,
      missionId: dispatchInput.envelope.missionId,
      mapId: dispatchInput.envelope.mapId,
      taskTemplateId: dispatchInput.envelope.taskTemplateId,
      reason: `Dispatching ${command.commandType} via CommandTransportPort.`,
      actionableMessage: "Wait for governed result envelope and semantic gate validation.",
      ownerResponsible: "Nerve Bus",
    });
    const transport = await dispatchHumanCommand(dispatchInput);
    if (command.commandType === "start-mission") {
      missionSelectionState.lastMissionId = command.commandId;
    }
    const status: "accepted" | "failed" | "review_required" = transport.resultEnvelope.status === "success"
      ? "accepted"
      : transport.resultEnvelope.status;
    return {
      commandId: command.commandId,
      envelopeRef: transport.commandEnvelope.envelopeId,
      resultEnvelopeRef: transport.resultEnvelope.envelopeId,
      status,
      failureReason: transport.resultEnvelope.failureReason,
      reviewRequiredReason: transport.resultEnvelope.status === "review_required" ? transport.resultEnvelope.failureReason ?? "review required" : null,
      message: describeHumanCommandTransportMessage(transport.resultEnvelope),
      debugLogRef: null,
    };
  },
});
