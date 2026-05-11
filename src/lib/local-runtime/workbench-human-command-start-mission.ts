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

export type HumanCommandHandledResult = {
  envelope: HumanCommandResultEnvelope;
  outputPayload: ReturnType<typeof buildPayloadDocument>;
};

type StartMissionBackgroundInput = {
  envelope: HumanCommandEnvelope;
};

const DEFAULT_START_MISSION_GOAL = "Discover evidence-backed product opportunities from the active social feed.";

const logBackgroundMissionFailure = (error: unknown) => {
  console.error("[grasseye:mission-background]", error instanceof Error ? error.message : "Unknown mission execution failure");
};

const logHumanCommandDebugFailure = (error: unknown) => {
  console.error("[grasseye:human-command-debug]", error instanceof Error ? error.message : "Unknown human command debug write failure");
};

const logInvalidPayloadField = (fieldName: string, error: unknown) => {
  console.error(
    "[grasseye:start-mission-payload]",
    `${fieldName} contains invalid JSON: ${error instanceof Error ? error.message : "Unknown payload parse failure"}`,
  );
};

const recordHumanCommandDebug = (write: Promise<void>) => {
  void write.catch(logHumanCommandDebugFailure);
};

const parseStringArrayPayloadField = (
  payload: Record<string, string | number | boolean | null>,
  key: "selectedPlatformsJson",
): string[] => {
  const rawValue = payloadValueToString(payload[key]);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      : [];
  } catch (error) {
    logInvalidPayloadField(key, error);
    return [];
  }
};

export const buildHumanCommandResultEnvelope = (input: {
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
) => ({
  requestedBy: "commander-console",
  userRequirementRef: payloadValueToString(payload.userRequirementRef),
  primaryPlatformId: payloadValueToString(payload.primaryPlatformId),
  selectedPlatforms: parseStringArrayPayloadField(payload, "selectedPlatformsJson"),
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
          }));
        }
      })
      .catch((error) => {
        recordHumanCommandDebug(recordMissionBackgroundFailed(runtime, {
          envelope: input.envelope,
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
    return buildHumanCommandResultEnvelope({ envelope, status: "failed", summary: "requestedPlatformId is required for start-mission.", failureReason: "requestedPlatformId is required for start-mission." });
  }

  recordHumanCommandDebug(recordOrchestrationStartReceived(runtime, { envelope }));
  recordHumanCommandDebug(recordMissionActivationSnapshotFrozen(runtime, { envelope }));
  recordHumanCommandDebug(recordCommandAccepted(runtime, { envelope }));

  const backgroundMissionInput: StartMissionBackgroundInput = { envelope };
  const missionStartPromise = runtime.orchestrationAbilityGroup.startMission({
    missionId: envelope.missionId,
    runId: envelope.runId,
    humanGoal: payloadValueToString(payload.humanGoal) ?? DEFAULT_START_MISSION_GOAL,
    requestedPlatform: requestedPlatformId,
    maxRounds: payloadValueToInteger(payload.maxRounds),
    maxMinutes: payloadValueToInteger(payload.maxMinutes),
    initialPayload: buildStartMissionInitialPayload(payload),
  });

  void missionStartPromise.catch(createBackgroundMissionFailureHandler(runtime, backgroundMissionInput));
  watchBackgroundMissionStart(runtime, backgroundMissionInput);

  return buildHumanCommandResultEnvelope({
    envelope,
    status: "success",
    summary: `Mission ${envelope.missionId} was accepted for governed execution.`,
  });
};