import type { ForensicsClockPort } from "../ports/forensics-clock-port.js";
import type {
  ForensicsAbilityInput,
  ForensicsIntegrityDecision,
  ForensicsPolicyDecision,
  ForensicsRecordEnvelope,
} from "../schema.js";
import { ForensicsRecordEnvelopeSchema } from "../schema.js";
import { buildCanonicalForensicsHash } from "./forensics-hash-builder.js";

function requireChainValue(fieldName: string, value: string | null | undefined): string {
  if (!value) {
    throw new Error(`Forensics chain field ${fieldName} is required before persistence.`);
  }
  return value;
}

export function buildForensicsEnvelope(input: {
  request: ForensicsAbilityInput;
  policyDecision: ForensicsPolicyDecision;
  integrityDecision: ForensicsIntegrityDecision;
  recordId: string;
  clock: ForensicsClockPort;
}): ForensicsRecordEnvelope {
  const createdAt = input.clock.now();
  return ForensicsRecordEnvelopeSchema.parse({
    recordId: input.recordId,
    recordType: input.request.recordType,
    missionId: requireChainValue("missionId", input.request.missionId),
    runId: requireChainValue("runId", input.request.runId),
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId ?? null,
    stepId: requireChainValue("stepId", input.request.stepId),
    mapPackageId: requireChainValue("mapPackageId", input.request.mapPackageId),
    mapPackageVersion: requireChainValue("mapPackageVersion", input.request.mapPackageVersion),
    selectedMapId: requireChainValue("selectedMapId", input.request.selectedMapId),
    selectedMapVersion: requireChainValue("selectedMapVersion", input.request.selectedMapVersion),
    activationSnapshotRef: requireChainValue("activationSnapshotRef", input.request.activationSnapshotRef),
    capabilityCallId: requireChainValue("capabilityCallId", input.request.capabilityCallId),
    sourceAbilityGroupId: input.request.sourceAbilityGroupId,
    sourceChildCapabilityId: input.request.sourceChildCapabilityId,
    createdAt,
    payload: input.request.payload,
    inputRefs: input.request.inputRefs,
    outputRefs: input.request.outputRefs,
    sourceRecordRefs: input.request.sourceRecordRefs,
    parentRefs: input.request.parentRefs,
    artifactRefs: input.request.artifactRefs,
    promptContractId: input.request.promptContractId ?? null,
    promptContractVersion: input.request.promptContractVersion ?? null,
    promptCatalogVersion: input.request.promptCatalogVersion ?? null,
    actionRef: input.request.actionRef ?? null,
    postActionVerificationRef: input.request.postActionVerificationRef ?? null,
    decisionRef: input.request.decisionRef ?? null,
    schemaVersion: input.policyDecision.schemaVersion,
    integrityHash: buildCanonicalForensicsHash({
      recordId: input.recordId,
      recordType: input.request.recordType,
      missionId: requireChainValue("missionId", input.request.missionId),
      runId: requireChainValue("runId", input.request.runId),
      sessionId: input.request.sessionId,
      roundId: input.request.roundId,
      videoVisitId: input.request.videoVisitId ?? null,
      stepId: requireChainValue("stepId", input.request.stepId),
      mapPackageId: requireChainValue("mapPackageId", input.request.mapPackageId),
      mapPackageVersion: requireChainValue("mapPackageVersion", input.request.mapPackageVersion),
      selectedMapId: requireChainValue("selectedMapId", input.request.selectedMapId),
      selectedMapVersion: requireChainValue("selectedMapVersion", input.request.selectedMapVersion),
      activationSnapshotRef: requireChainValue("activationSnapshotRef", input.request.activationSnapshotRef),
      capabilityCallId: requireChainValue("capabilityCallId", input.request.capabilityCallId),
      sourceAbilityGroupId: input.request.sourceAbilityGroupId,
      sourceChildCapabilityId: input.request.sourceChildCapabilityId,
      payload: input.request.payload,
      inputRefs: input.request.inputRefs,
      outputRefs: input.request.outputRefs,
      sourceRecordRefs: input.request.sourceRecordRefs,
      parentRefs: input.request.parentRefs,
      artifactRefs: input.request.artifactRefs,
      promptContractId: input.request.promptContractId ?? null,
      promptContractVersion: input.request.promptContractVersion ?? null,
      promptCatalogVersion: input.request.promptCatalogVersion ?? null,
      actionRef: input.request.actionRef ?? null,
      postActionVerificationRef: input.request.postActionVerificationRef ?? null,
      decisionRef: input.request.decisionRef ?? null,
      schemaVersion: input.policyDecision.schemaVersion,
      dataQualityFlags: input.request.dataQualityFlags,
      createdAt,
    }),
    dataQualityFlags: input.request.dataQualityFlags,
    idempotencyKey: input.policyDecision.idempotencyKey,
  });
}