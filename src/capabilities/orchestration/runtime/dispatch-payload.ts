import { randomUUID } from "node:crypto";
import type { DispatchRegisteredAbilityActionInput } from "../contract.js";
import type { DispatchAction } from "./dispatch-types.js";

type PayloadInput = {
  action: DispatchAction;
  input: DispatchRegisteredAbilityActionInput;
  actionInput: Record<string, unknown>;
  actionIndex: number;
  abilityGroupId: string;
  childCapabilityId: string;
};

const baseDispatchInput = (payload: PayloadInput): Record<string, unknown> => {
  const callId = randomUUID();
  const gridSpecRef = (payload.input.currentEvidenceRefs?.["gridSpecRef"] as string | undefined) ?? null;
  return {
    ...payload.actionInput,
    abilityGroupId: payload.abilityGroupId,
    childCapabilityId: payload.childCapabilityId,
    missionId: payload.input.missionId,
    runId: payload.input.runId,
    sessionId: "local",
    roundId: payload.input.roundId ?? null,
    videoVisitId: null,
    stepId: randomUUID(),
    capabilityCallId: callId,
    nerveBusEnvelopeId: callId,
    requestedBy: "orchestration:dispatch-action",
    purpose: `execute:${payload.action.actionCode}`,
    inputRef: randomUUID(),
    sourceRef: payload.actionInput["sourceRef"] ?? gridSpecRef ?? callId,
    sourceEvidenceRef: payload.actionInput["sourceEvidenceRef"] ?? (payload.input.currentEvidenceRefs?.["originalScreenshotRef"] as string | undefined) ?? null,
    idempotencyKey: payload.actionInput["idempotencyKey"] ?? buildDispatchIdempotencyKey(payload),
  };
};

const buildDispatchIdempotencyKey = (payload: PayloadInput): string => [
  "dispatch",
  payload.input.missionId,
  payload.input.runId,
  payload.input.roundId ?? "noround",
  String(payload.actionIndex),
  payload.action.actionCode,
  payload.action.gridCell ?? "nogrid",
  payload.action.cellZone ?? "center",
].join(":");

const forensicsInput = (baseInput: Record<string, unknown>, payload: PayloadInput): Record<string, unknown> => ({
  ...baseInput,
  childCapabilityId: "append-record",
  recordType: payload.actionInput["recordType"] ?? "visual_evidence",
  recordPayload: {
    ...payload.actionInput,
    reason: payload.action.reason ?? null,
    aiResultRef: payload.input.aiResultRef ?? null,
    originalScreenshotRef: payload.input.currentEvidenceRefs?.["originalScreenshotRef"] ?? null,
    coordinateGridScreenshotRef: payload.input.currentEvidenceRefs?.["coordinateGridScreenshotRef"] ?? null,
    gridSpecRef: payload.input.currentEvidenceRefs?.["gridSpecRef"] ?? null,
  },
});

const textInputPayload = (completeInput: Record<string, unknown>, payload: PayloadInput): Record<string, unknown> => ({
  abilityGroupId: payload.abilityGroupId,
  childCapabilityId: payload.childCapabilityId,
  missionId: payload.input.missionId,
  runId: payload.input.runId,
  sessionId: "local",
  roundId: payload.input.roundId ?? null,
  stepId: completeInput["stepId"],
  capabilityCallId: completeInput["capabilityCallId"],
  nerveBusEnvelopeId: completeInput["nerveBusEnvelopeId"],
  inputRef: completeInput["inputRef"],
  targetRef: payload.actionInput["targetRef"] ?? null,
  focusRef: payload.actionInput["focusRef"] ?? null,
  idempotencyKey: completeInput["idempotencyKey"],
  ...(payload.actionInput["timeoutMs"] ? { timeoutMs: payload.actionInput["timeoutMs"] } : {}),
  approvedText: payload.actionInput["approvedText"] ?? null,
  approvedKey: payload.actionInput["approvedKey"] ?? null,
});

export const buildDispatchInputPayload = (payload: PayloadInput): Record<string, unknown> => {
  const baseInput = baseDispatchInput(payload);
  const completeInput = payload.abilityGroupId === "forensics-persistence" && payload.childCapabilityId === "append-record"
    ? forensicsInput(baseInput, payload)
    : baseInput;
  return payload.abilityGroupId === "text-input" ? textInputPayload(completeInput, payload) : completeInput;
};
