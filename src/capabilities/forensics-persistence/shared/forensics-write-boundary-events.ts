import { StructuredRuntimeEventSchema } from "../../../types/structured-log.js";
import type { StructuredRuntimeEvent } from "../../../types/structured-log.js";
import type {
  ForensicsPersistenceAbilityResult,
  ForensicsStructuredActionLogInput,
  ForensicsStructuredRuntimeEventInput,
} from "../contract.js";

export type ForensicsRuntimeEventEmitter = {
  emitRuntimeEvent(entry: StructuredRuntimeEvent): Promise<void> | void;
};

type StructuredWriteRequest = ForensicsStructuredRuntimeEventInput | ForensicsStructuredActionLogInput;

function resolveStructuredWritePayload(request: StructuredWriteRequest) {
  if (request.childCapabilityId === "write-structured-runtime-event") {
    return {
      step: request.payload.structuredRuntimeEvent.step,
      taskTemplateId: request.payload.structuredRuntimeEvent.taskTemplateId,
      traceId: request.payload.structuredRuntimeEvent.traceId,
      spanId: request.payload.structuredRuntimeEvent.spanId,
      attemptId: request.payload.structuredRuntimeEvent.attemptId,
      actionRef: request.payload.structuredRuntimeEvent.actionRef,
      postActionVerificationRef: request.payload.structuredRuntimeEvent.postActionVerificationRef,
    };
  }

  return {
    step: request.payload.structuredActionLog.step,
    taskTemplateId: null,
    traceId: request.sessionId,
    spanId: request.capabilityCallId ?? null,
    attemptId: request.roundId,
    actionRef: request.payload.structuredActionLog.actionRef,
    postActionVerificationRef: request.postActionVerificationRef,
  };
}

function buildBoundaryEvent(
  request: StructuredWriteRequest,
  eventType: "FORENSICS_RECORD_WRITE_REQUESTED" | "FORENSICS_RECORD_WRITTEN",
  status: "started" | "success",
  refs: string[],
): StructuredRuntimeEvent {
  const payload = resolveStructuredWritePayload(request);
  const writeRequested = eventType === "FORENSICS_RECORD_WRITE_REQUESTED";

  return StructuredRuntimeEventSchema.parse({
    eventId: `${request.capabilityCallId ?? request.childCapabilityId}:${eventType.toLowerCase()}:${Date.now()}`,
    eventType,
    level: "INFO",
    phase: "forensics-write",
    component: "forensics-persistence",
    owner: "Forensics Persistence",
    abilityGroupId: "forensics-persistence",
    childCapabilityId: request.childCapabilityId,
    sessionId: request.sessionId,
    runId: request.runId,
    missionId: request.missionId,
    roundId: request.roundId,
    videoVisitId: request.videoVisitId,
    mapId: request.selectedMapId,
    stepId: request.stepId,
    taskTemplateId: payload.taskTemplateId,
    traceId: payload.traceId,
    spanId: payload.spanId,
    attemptId: payload.attemptId,
    activationSnapshotRef: request.activationSnapshotRef,
    capabilityCallId: request.capabilityCallId,
    actionRef: payload.actionRef,
    postActionVerificationRef: payload.postActionVerificationRef,
    step: payload.step,
    status,
    reason: writeRequested
      ? `Forensics accepted ${request.recordType} write request from ${request.sourceAbilityGroupId}.`
      : `Forensics persisted ${request.recordType} for ${request.sourceAbilityGroupId}.`,
    actionableMessage: writeRequested
      ? "Wait for Forensics persistence completion before treating the record as durable."
      : "Use the persisted record refs and runtime proof for downstream verification.",
    ownerResponsible: "Forensics Persistence",
    createdAt: new Date().toISOString(),
    refs,
    proofRefs: [],
    ...buildEmptyBoundaryEventFields(),
  });
}

function withBoundaryProofRefs(event: StructuredRuntimeEvent, proofRefs: string[]): StructuredRuntimeEvent {
  return StructuredRuntimeEventSchema.parse({ ...event, proofRefs });
}

function buildEmptyBoundaryEventFields() {
  return {
    previousStep: null,
    nextStep: null,
    failureReason: null,
    reviewRequiredReason: null,
    decision: null,
    durationMs: null,
    inputRefs: [],
    outputRefs: [],
    evidenceRefs: [],
    artifactRefs: [],
    actionLogRefs: [],
    dataQualityFlags: [],
  };
}

export async function emitForensicsRecordWriteRequested(
  emitter: ForensicsRuntimeEventEmitter | undefined,
  request: StructuredWriteRequest,
): Promise<void> {
  if (!emitter) {
    return;
  }

  await emitter.emitRuntimeEvent(
    buildBoundaryEvent(request, "FORENSICS_RECORD_WRITE_REQUESTED", "started", [
      `recordType=${request.recordType}`,
      `sourceAbilityGroupId=${request.sourceAbilityGroupId}`,
      `sourceChildCapabilityId=${request.sourceChildCapabilityId}`,
    ]),
  );
}

export async function emitForensicsRecordWritten(
  emitter: ForensicsRuntimeEventEmitter | undefined,
  request: StructuredWriteRequest,
  result: ForensicsPersistenceAbilityResult,
): Promise<void> {
  if (!emitter || result.status === "failed") {
    return;
  }

  await emitter.emitRuntimeEvent(
    withBoundaryProofRefs(
      buildBoundaryEvent(
        request,
        "FORENSICS_RECORD_WRITTEN",
        "success",
        [
          `recordType=${request.recordType}`,
          `forensicsResultStatus=${result.status}`,
          `recordRef=${result.recordRef.recordId}`,
          `storageRef=${result.storageRef ?? "MISSING"}`,
        ],
      ),
      result.runtimeProof?.proofId ? [result.runtimeProof.proofId] : [],
    ),
  );
}
