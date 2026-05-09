import {
  recordCommandAccepted,
  recordMissionBackgroundFailed,
  recordMissionBackgroundStalled,
  recordMissionActivationSnapshotFrozen,
  recordOrchestrationStartReceived,
} from "./workbench-human-command-debug-events.js";
import {
  buildMirroredEnvelopeBase,
  buildPayloadDocument,
  payloadValueToInteger,
  payloadValueToString,
} from "./workbench-payload.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import type { HumanCommandEnvelope, HumanCommandResultEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";

type HumanCommandHandledResult = {
  envelope: HumanCommandResultEnvelope;
  outputPayload: ReturnType<typeof buildPayloadDocument>;
};

type StartMissionBackgroundInput = {
  envelope: HumanCommandEnvelope;
  selectedMapId: string | null;
  taskTemplateId: string | null;
};

const DEFAULT_START_MISSION_GOAL = "Discover evidence-backed product opportunities from the active social feed.";

const logBackgroundMissionFailure = (error: unknown) => {
  console.error("[grasseye:mission-background]", error instanceof Error ? error.message : "Unknown mission execution failure");
};

const logHumanCommandDebugFailure = (error: unknown) => {
  console.error("[grasseye:human-command-debug]", error instanceof Error ? error.message : "Unknown human command debug write failure");
};

const recordHumanCommandDebug = (write: Promise<void>) => {
  void write.catch(logHumanCommandDebugFailure);
};

const buildStartMissionResultEnvelope = (input: {
  envelope: HumanCommandEnvelope;
  status: "success" | "failed" | "review_required";
  summary: string;
  failureReason?: string | null;
}): HumanCommandHandledResult => {
  const outputPayload = buildPayloadDocument({
    documentType: "human.command.result",
    documentRef: `${input.envelope.commandId}:result`,
    summary: input.summary,
    content: {
      commandType: input.envelope.commandType,
      missionId: input.envelope.missionId,
      failureReason: input.failureReason ?? null,
      status: input.status,
    },
  });
  return {
    envelope: {
      ...buildMirroredEnvelopeBase({
        channelId: "orchestration-to-commander",
        envelopeId: `${input.envelope.envelopeId}:result`,
        requestEnvelope: input.envelope,
        payloadRefs: { output: outputPayload.documentRef },
        summary: outputPayload.summary,
        tags: ["commander-console", input.status],
      }),
      resultId: `${input.envelope.commandId}:result`,
      envelopeKind: "human_command_result",
      from: "orchestration",
      to: "commander-console",
      correlationEnvelopeId: input.envelope.envelopeId,
      correlationCapabilityCallId: input.envelope.capabilityCallId,
      correlationInputRef: input.envelope.inputRef,
      proofRef: `${input.envelope.envelopeId}:result:proof`,
      status: input.status,
      outputRef: input.status === "success" ? outputPayload.documentRef : null,
      diagnosticPayloadRef: input.status === "success" ? null : outputPayload.documentRef,
      failureReason: input.status === "failed" ? input.failureReason ?? "human command failed" : null,
      reviewRequiredReason: input.status === "review_required" ? input.failureReason ?? "review required" : null,
    },
    outputPayload,
  };
};

const buildStartMissionInitialPayload = (
  payload: Record<string, string | number | boolean | null>,
  parsedSelectedMapId: string | null,
) => ({
  requestedBy: "commander-console",
  selectedMapId: parsedSelectedMapId,
  maxRounds: payloadValueToInteger(payload.maxRounds),
  maxMinutes: payloadValueToInteger(payload.maxMinutes),
  operatorNote: payloadValueToString(payload.operatorNote),
  targetUrl: payloadValueToString(payload.targetUrl),
  targetTitle: payloadValueToString(payload.targetTitle),
  targetProfileRef: payloadValueToString(payload.targetProfileRef),
  sourceEvidenceRef: payloadValueToString(payload.sourceEvidenceRef),
  sourceTargetRef: payloadValueToString(payload.sourceTargetRef),
  promptInputRef: payloadValueToString(payload.promptInputRef),
  commandInputRef: payloadValueToString(payload.commandInputRef),
});

const createBackgroundMissionFailureHandler = (runtime: WorkbenchRuntime, input: StartMissionBackgroundInput) => (error: unknown) => {
  logBackgroundMissionFailure(error);
  recordHumanCommandDebug(recordMissionBackgroundFailed(runtime, {
    envelope: input.envelope,
    selectedMapId: input.selectedMapId,
    taskTemplateId: input.taskTemplateId,
    error,
  }));
};

const watchBackgroundMissionStart = (runtime: WorkbenchRuntime, input: StartMissionBackgroundInput) => {
  setTimeout(() => {
    void runtime.orchestrationAbilityGroup.getMissionState(input.envelope.missionId)
      .then((state) => {
        if (state.status === "idle" || state.missionId !== input.envelope.missionId) {
          recordHumanCommandDebug(recordMissionBackgroundStalled(runtime, {
            envelope: input.envelope,
            selectedMapId: input.selectedMapId,
            taskTemplateId: input.taskTemplateId,
          }));
        }
      })
      .catch((error) => {
        recordHumanCommandDebug(recordMissionBackgroundFailed(runtime, {
          envelope: input.envelope,
          selectedMapId: input.selectedMapId,
          taskTemplateId: input.taskTemplateId,
          error,
        }));
      });
  }, 1_000);
};

export const handleStartMission = async (
  runtime: WorkbenchRuntime,
  envelope: HumanCommandEnvelope,
  payload: Record<string, string | number | boolean | null>,
) => {
  const requestedPlatformId = payloadValueToString(payload.requestedPlatformId);
  if (!requestedPlatformId) {
    return buildStartMissionResultEnvelope({ envelope, status: "failed", summary: "requestedPlatformId is required for start-mission.", failureReason: "requestedPlatformId is required for start-mission." });
  }

  const parsedSelectedMapId = payloadValueToString(payload.selectedMapId);
  const activationId = payloadValueToString(payload.activationId) ?? envelope.activationId;
  const activationSnapshotRef = payloadValueToString(payload.activationSnapshotRef) ?? envelope.activationSnapshotRef;
  const taskTemplateId = payloadValueToString(payload.taskTemplateId);

  recordHumanCommandDebug(recordOrchestrationStartReceived(runtime, { envelope, selectedMapId: parsedSelectedMapId, taskTemplateId }));
  recordHumanCommandDebug(recordMissionActivationSnapshotFrozen(runtime, { envelope, selectedMapId: parsedSelectedMapId, taskTemplateId, activationSnapshotRef }));
  recordHumanCommandDebug(recordCommandAccepted(runtime, { envelope, selectedMapId: parsedSelectedMapId, taskTemplateId, activationSnapshotRef }));

  const backgroundMissionInput: StartMissionBackgroundInput = { envelope, selectedMapId: parsedSelectedMapId, taskTemplateId };
  const missionStartPromise = runtime.orchestrationAbilityGroup.startMission({
    missionId: envelope.missionId,
    runId: envelope.runId,
    humanGoal: payloadValueToString(payload.humanGoal) ?? DEFAULT_START_MISSION_GOAL,
    requestedPlatform: requestedPlatformId,
    preferredMapId: parsedSelectedMapId,
    taskTemplateId,
    activationId,
    maxRounds: payloadValueToInteger(payload.maxRounds),
    maxMinutes: payloadValueToInteger(payload.maxMinutes),
    initialPayload: buildStartMissionInitialPayload(payload, parsedSelectedMapId),
  });

  void missionStartPromise.catch(createBackgroundMissionFailureHandler(runtime, backgroundMissionInput));
  watchBackgroundMissionStart(runtime, backgroundMissionInput);

  return buildStartMissionResultEnvelope({
    envelope,
    status: "success",
    summary: `Mission ${envelope.missionId} was accepted for governed execution.`,
  });
};