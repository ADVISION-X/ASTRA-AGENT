import type { WorkbenchRuntime } from "./workbench-contract.js";
import type { HumanCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";

type MissionStartState = {
  missionId: string | null;
  status: string;
  activeTaskRunId: string | null;
  reviewRequiredReason: string | null;
  failureReason: string | null;
};

export const recordOrchestrationStartReceived = (
  runtime: WorkbenchRuntime,
  input: {
    envelope: HumanCommandEnvelope;
  },
) => runtime.recordCommanderDebugEvent({
  eventType: "ORCHESTRATION_START_RECEIVED",
  status: "started",
  traceId: input.envelope.traceId,
  spanId: `${input.envelope.envelopeId}:orchestration-start`,
  attemptId: input.envelope.attemptId,
  missionId: input.envelope.missionId,
  runId: input.envelope.runId,
  reason: `Orchestration received governed start-mission command for requestedPlatformId=${input.envelope.requestedPlatformId}.`,
  actionableMessage: "Prepare the governed platform binding and mission state.",
  ownerResponsible: "Orchestration",
  refs: [`commandEnvelopeRef=${input.envelope.envelopeId}`, `inputRef=${input.envelope.inputRef}`],
});

export const recordMissionActivationSnapshotFrozen = (
  runtime: WorkbenchRuntime,
  input: {
    envelope: HumanCommandEnvelope;
    missionState?: MissionStartState | null;
  },
) => {
  const status = input.missionState?.status === "failed"
    ? "failed"
    : input.missionState?.status === "review_required"
      ? "review_required"
      : "success";
  const missionId = input.missionState?.missionId ?? input.envelope.missionId;
  const runId = input.missionState?.activeTaskRunId ?? input.envelope.runId;

  return runtime.recordCommanderDebugEvent({
    eventType: "MISSION_BINDING_CONFIRMED",
    status,
    traceId: input.envelope.traceId,
    spanId: `${input.envelope.envelopeId}:mission-binding`,
    attemptId: input.envelope.attemptId,
    missionId,
    runId,
    reason: `requestedPlatformId=${input.envelope.requestedPlatformId}; mission binding confirmed before mission execution.`,
    failureReason: input.missionState?.failureReason ?? null,
    actionableMessage: input.missionState?.status === "failed"
      ? "Inspect orchestration binding and mission start proof before retrying."
      : "Continue the governed mission loop with the confirmed binding.",
    ownerResponsible: "Orchestration",
    refs: [
      `commandEnvelopeRef=${input.envelope.envelopeId}`,
    ],
  });
};

export const recordCommandAccepted = (
  runtime: WorkbenchRuntime,
  input: {
    envelope: HumanCommandEnvelope;
  },
) => runtime.recordCommanderDebugEvent({
  eventType: "COMMAND_ACCEPTED",
  status: "success",
  traceId: input.envelope.traceId,
  spanId: `${input.envelope.envelopeId}:command-accepted`,
  attemptId: input.envelope.attemptId,
  missionId: input.envelope.missionId,
  runId: input.envelope.runId,
  reason: `requestedPlatformId=${input.envelope.requestedPlatformId}; governed start-mission command was accepted before mission execution began.`,
  actionableMessage: "Track subsequent Orchestration runtime events for execution outcome instead of using command acceptance as final mission truth.",
  ownerResponsible: "Commander Console / Nerve Bus / Orchestration",
  refs: [
    `commandEnvelopeRef=${input.envelope.envelopeId}`,
    `resultEnvelopeRef=${input.envelope.envelopeId}:result`,
    `inputRef=${input.envelope.inputRef}`,
  ],
});

export const recordMissionBackgroundFailed = (
  runtime: WorkbenchRuntime,
  input: {
    envelope: HumanCommandEnvelope;
    error: unknown;
  },
) => {
  const failureReason = input.error instanceof Error ? input.error.message : String(input.error);
  return runtime.recordCommanderDebugEvent({
    eventType: "MISSION_BACKGROUND_FAILED",
    status: "failed",
    traceId: input.envelope.traceId,
    spanId: `${input.envelope.envelopeId}:mission-background-failed`,
    attemptId: input.envelope.attemptId,
    missionId: input.envelope.missionId,
    runId: input.envelope.runId,
    reason: `requestedPlatformId=${input.envelope.requestedPlatformId}; background mission execution failed after the command acceptance receipt was returned.`,
    failureReason,
    actionableMessage: "Inspect this failure before treating COMMAND_ACCEPTED as mission execution.",
    ownerResponsible: "Orchestration / Mission Loop",
    refs: [
      `commandEnvelopeRef=${input.envelope.envelopeId}`,
    ],
  });
};

export const recordMissionBackgroundStalled = (
  runtime: WorkbenchRuntime,
  input: {
    envelope: HumanCommandEnvelope;
  },
) => runtime.recordCommanderDebugEvent({
  eventType: "MISSION_BACKGROUND_STALLED",
  status: "failed",
  traceId: input.envelope.traceId,
  spanId: `${input.envelope.envelopeId}:mission-background-stalled`,
  attemptId: input.envelope.attemptId,
  missionId: input.envelope.missionId,
  runId: input.envelope.runId,
  reason: `requestedPlatformId=${input.envelope.requestedPlatformId}; mission command was accepted, but no active mission state became visible before the startup probe deadline.`,
  failureReason: "mission_loop_did_not_publish_initial_state",
  actionableMessage: "Repair start-mission background execution so mission state appears after command acceptance.",
  ownerResponsible: "Orchestration / Mission Loop",
  refs: [
    `commandEnvelopeRef=${input.envelope.envelopeId}`,
  ],
});
