import type { WorkbenchRuntime } from "./workbench-contract.js";
import type { HumanCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";

type MissionStartState = {
  missionId: string | null;
  status: string;
  activeTaskRunId: string | null;
  mapId: string | null;
  activationSnapshotRef: string | null;
  reviewRequiredReason: string | null;
  failureReason: string | null;
};

export const recordOrchestrationStartReceived = (
  runtime: WorkbenchRuntime,
  input: {
    envelope: HumanCommandEnvelope;
    selectedMapId: string | null;
    taskTemplateId: string | null;
  },
) => runtime.recordCommanderDebugEvent({
  eventType: "ORCHESTRATION_START_RECEIVED",
  status: "started",
  traceId: input.envelope.traceId,
  spanId: `${input.envelope.envelopeId}:orchestration-start`,
  attemptId: input.envelope.attemptId,
  missionId: input.envelope.missionId,
  runId: input.envelope.runId,
  mapId: input.selectedMapId,
  taskTemplateId: input.taskTemplateId,
  reason: "Orchestration received governed start-mission command from Nerve Bus.",
  actionableMessage: "Freeze activation snapshot and select the governed operational map.",
  ownerResponsible: "Orchestration",
  refs: [`commandEnvelopeRef=${input.envelope.envelopeId}`, `inputRef=${input.envelope.inputRef}`],
});

export const recordMissionActivationSnapshotFrozen = (
  runtime: WorkbenchRuntime,
  input: {
    envelope: HumanCommandEnvelope;
    selectedMapId: string | null;
    taskTemplateId: string | null;
    activationSnapshotRef: string | null;
    missionState?: MissionStartState | null;
  },
) => {
  const activationSnapshotRef = input.missionState?.activationSnapshotRef ?? input.activationSnapshotRef;
  const status = input.missionState?.status === "failed"
    ? "failed"
    : input.missionState?.status === "review_required"
      ? "review_required"
      : activationSnapshotRef
        ? "success"
        : "failed";
  const missionId = input.missionState?.missionId ?? input.envelope.missionId;
  const runId = input.missionState?.activeTaskRunId ?? input.envelope.runId;
  const mapId = input.missionState?.mapId ?? input.selectedMapId;

  return runtime.recordCommanderDebugEvent({
    eventType: "MISSION_ACTIVATION_SNAPSHOT_FROZEN",
    status,
    traceId: input.envelope.traceId,
    spanId: `${input.envelope.envelopeId}:activation-snapshot`,
    attemptId: input.envelope.attemptId,
    missionId,
    runId,
    mapId,
    taskTemplateId: input.taskTemplateId,
    reason: activationSnapshotRef
      ? `activationSnapshotRef=${activationSnapshotRef}; selectedMapId=${mapId}`
      : "Mission start completed without a frozen activation snapshot.",
    failureReason: input.missionState?.failureReason ?? (activationSnapshotRef ? null : "activation snapshot missing before mission execution"),
    actionableMessage: activationSnapshotRef
      ? "Continue the governed mission loop with the frozen activation snapshot."
      : "Inspect Orchestration map selection and activation snapshot proof before retrying.",
    ownerResponsible: "Orchestration / Map Plugin Registry",
    refs: [
      `commandEnvelopeRef=${input.envelope.envelopeId}`,
      `activationSnapshotRef=${activationSnapshotRef ?? "MISSING"}`,
      `selectedMapId=${mapId ?? "MISSING"}`,
    ],
  });
};

export const recordCommandAccepted = (
  runtime: WorkbenchRuntime,
  input: {
    envelope: HumanCommandEnvelope;
    selectedMapId: string | null;
    taskTemplateId: string | null;
    activationSnapshotRef: string | null;
  },
) => runtime.recordCommanderDebugEvent({
  eventType: "COMMAND_ACCEPTED",
  status: "success",
  traceId: input.envelope.traceId,
  spanId: `${input.envelope.envelopeId}:command-accepted`,
  attemptId: input.envelope.attemptId,
  missionId: input.envelope.missionId,
  runId: input.envelope.runId,
  mapId: input.selectedMapId,
  taskTemplateId: input.taskTemplateId,
  reason: "Governed start-mission command was accepted before mission execution began.",
  actionableMessage: "Track subsequent Orchestration runtime events for execution outcome instead of using command acceptance as final mission truth.",
  ownerResponsible: "Commander Console / Nerve Bus / Orchestration",
  refs: [
    `commandEnvelopeRef=${input.envelope.envelopeId}`,
    `resultEnvelopeRef=${input.envelope.envelopeId}:result`,
    `inputRef=${input.envelope.inputRef}`,
    `activationSnapshotRef=${input.activationSnapshotRef ?? "MISSING"}`,
    `selectedMapId=${input.selectedMapId ?? "MISSING"}`,
  ],
});

export const recordMissionBackgroundFailed = (
  runtime: WorkbenchRuntime,
  input: {
    envelope: HumanCommandEnvelope;
    selectedMapId: string | null;
    taskTemplateId: string | null;
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
    mapId: input.selectedMapId,
    taskTemplateId: input.taskTemplateId,
    reason: "Background mission execution failed after the command acceptance receipt was returned.",
    failureReason,
    actionableMessage: "Inspect this failure before treating COMMAND_ACCEPTED as mission execution.",
    ownerResponsible: "Orchestration / Mission Loop",
    refs: [
      `commandEnvelopeRef=${input.envelope.envelopeId}`,
      `selectedMapId=${input.selectedMapId ?? "MISSING"}`,
    ],
  });
};

export const recordMissionBackgroundStalled = (
  runtime: WorkbenchRuntime,
  input: {
    envelope: HumanCommandEnvelope;
    selectedMapId: string | null;
    taskTemplateId: string | null;
  },
) => runtime.recordCommanderDebugEvent({
  eventType: "MISSION_BACKGROUND_STALLED",
  status: "failed",
  traceId: input.envelope.traceId,
  spanId: `${input.envelope.envelopeId}:mission-background-stalled`,
  attemptId: input.envelope.attemptId,
  missionId: input.envelope.missionId,
  runId: input.envelope.runId,
  mapId: input.selectedMapId,
  taskTemplateId: input.taskTemplateId,
  reason: "Mission command was accepted, but no active mission state became visible before the startup probe deadline.",
  failureReason: "mission_loop_did_not_publish_initial_state",
  actionableMessage: "Repair start-mission background execution so MAP_STEP_SELECTED appears after MISSION_ACTIVATION_SNAPSHOT_FROZEN.",
  ownerResponsible: "Orchestration / Mission Loop",
  refs: [
    `commandEnvelopeRef=${input.envelope.envelopeId}`,
    `selectedMapId=${input.selectedMapId ?? "MISSING"}`,
  ],
});
