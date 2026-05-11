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

const buildEnvelopeBody = (input: {
  request: ForensicsAbilityInput;
  policyDecision: ForensicsPolicyDecision;
  recordId: string;
  createdAt: string;
}) => ({
  recordId: input.recordId,
  recordType: input.request.recordType,
  missionId: requireChainValue("missionId", input.request.missionId),
  runId: requireChainValue("runId", input.request.runId),
  sessionId: input.request.sessionId,
  roundId: input.request.roundId,
  videoVisitId: input.request.videoVisitId ?? null,
  stepId: requireChainValue("stepId", input.request.stepId),
  bindingPackageId: requireChainValue("bindingPackageId", input.request.bindingPackageId),
  bindingPackageVersion: requireChainValue("bindingPackageVersion", input.request.bindingPackageVersion),
  selectedBindingId: requireChainValue("selectedBindingId", input.request.selectedBindingId),
  bindingVersion: requireChainValue("bindingVersion", input.request.bindingVersion),
  bindingSnapshotRef: requireChainValue("bindingSnapshotRef", input.request.bindingSnapshotRef),
  capabilityCallId: requireChainValue("capabilityCallId", input.request.capabilityCallId),
  sourceAbilityGroupId: input.request.sourceAbilityGroupId,
  sourceChildCapabilityId: input.request.sourceChildCapabilityId,
  createdAt: input.createdAt,
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
});

const buildCanonicalHashInput = (input: {
  request: ForensicsAbilityInput;
  policyDecision: ForensicsPolicyDecision;
  recordId: string;
  createdAt: string;
}) => ({
  ...buildEnvelopeBody(input),
  capabilityCallId: requireChainValue("capabilityCallId", input.request.capabilityCallId),
  dataQualityFlags: input.request.dataQualityFlags,
});

export function buildForensicsEnvelope(input: {
  request: ForensicsAbilityInput;
  policyDecision: ForensicsPolicyDecision;
  integrityDecision: ForensicsIntegrityDecision;
  recordId: string;
  clock: ForensicsClockPort;
}): ForensicsRecordEnvelope {
  const createdAt = input.clock.now();
  const envelopeBody = buildEnvelopeBody({ ...input, createdAt });
  return ForensicsRecordEnvelopeSchema.parse({
    ...envelopeBody,
    integrityHash: buildCanonicalForensicsHash(buildCanonicalHashInput({ ...input, createdAt })),
    dataQualityFlags: input.request.dataQualityFlags,
    idempotencyKey: input.policyDecision.idempotencyKey,
  });
}