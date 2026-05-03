import { randomUUID } from "node:crypto";

import type { MapLabAuthoringRequest, MapLabProviderState } from "./map-lab-types.js";

const MAP_AUTHORING_PROMPT_CONTRACT_ID = "map.authoring.v1";
const MAP_AUTHORING_OUTPUT_SCHEMA = "ai.map_authoring.v1";
const MAP_AUTHORING_QUALITY_POLICY = {
  minimumConfidence: 0.6,
  requireSchemaValidation: true,
};
const MAP_AUTHORING_COST_POLICY = { maxEstimatedCost: 5 };
const MAP_AUTHORING_DATA_POLICY = {
  allowExternalTransmission: true,
  redactSensitiveData: true,
};
const MAP_AUTHORING_SAFETY_POLICY = {
  reviewOnLowConfidence: true,
  reviewOnSchemaFailure: true,
  reviewOnPolicyViolation: true,
};

function createInputRef(request: MapLabAuthoringRequest) {
  return {
    id: `map-authoring-request:${request.missionId}`,
    kind: "ai-result" as const,
    summary: `Map authoring request for ${request.objective}`,
  };
}

function createMapAuthoringChainIds(missionId: string) {
  return {
    sessionId: `map-lab:${randomUUID()}`,
    roundId: `map-authoring-round:${randomUUID()}`,
    capabilityCallId: `map-authoring-call:${randomUUID()}`,
    nerveBusEnvelopeId: `map-authoring-envelope:${randomUUID()}`,
    draftRequestId: `draft-request:${missionId}`,
    activationSnapshotRef: `activation-snapshot:pending:${missionId}`,
  };
}

export function buildMapAuthoringAiRequest(
  request: MapLabAuthoringRequest,
  providerState: MapLabProviderState,
) {
  const chainIds = createMapAuthoringChainIds(request.missionId);
  return {
    abilityGroupId: "ai" as const,
    missionId: request.missionId,
    inputRefs: [createInputRef(request)],
    promptContractId: MAP_AUTHORING_PROMPT_CONTRACT_ID,
    expectedOutputSchema: MAP_AUTHORING_OUTPUT_SCHEMA,
    requestedBy: "commander-console" as const,
    transportedBy: "commander-console" as const,
    sessionId: chainIds.sessionId,
    roundId: chainIds.roundId,
    videoVisitId: null,
    stepId: "map-authoring-draft",
    capabilityCallId: chainIds.capabilityCallId,
    nerveBusEnvelopeId: chainIds.nerveBusEnvelopeId,
    mapPackageId: chainIds.draftRequestId,
    mapPackageVersion: "draft",
    selectedMapId: chainIds.draftRequestId,
    selectedMapVersion: "draft",
    activationSnapshotRef: chainIds.activationSnapshotRef,
    promptCatalogVersion: "map-prompt-contract-catalog.v1",
    qualityPolicy: MAP_AUTHORING_QUALITY_POLICY,
    providerPolicy: {
      requireLocalOnly: false,
      allowPaidProvider: true,
      providerAllowlist: ["paid-analysis-ai"],
      operatorApprovalRef: `approval://map-lab/generation/${request.missionId}`,
      providerConfigRef: providerState.configRef,
      secretRef: providerState.secretRef,
    },
    costPolicy: MAP_AUTHORING_COST_POLICY,
    dataPolicy: MAP_AUTHORING_DATA_POLICY,
    safetyPolicy: MAP_AUTHORING_SAFETY_POLICY,
    taskType: "map_authoring" as const,
    inputModality: "structured_record" as const,
    input: request,
  };
}