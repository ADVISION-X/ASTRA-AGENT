import { randomUUID } from "node:crypto";

import { buildMapAuthoringInputPackage } from "../../../map-plugins/authoring/map-authoring-input-package-builder.js";
import type { MapLabAuthoringRequest, MapLabProviderState } from "./map-lab-types.js";

const MAP_AUTHORING_PROMPT_CONTRACT_ID = "map-authoring-from-user-requirement-v1";
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

const isMapAuthoringPromptSelfCheck = () =>
  process.env.GRASSEYE_MAP_AUTHORING_PROMPT_SELF_CHECK === "1"
  && process.env.GRASSEYE_AI_PROVIDER_DRY_RUN === "1";

const resolveProviderStateForAuthoring = (providerState: MapLabProviderState): MapLabProviderState => {
  if (!isMapAuthoringPromptSelfCheck()) {
    return providerState;
  }

  return {
    ...providerState,
    configured: true,
    enabled: true,
    configRef: providerState.configRef ?? "provider-config:map-authoring-self-check",
    secretRef: providerState.secretRef ?? "provider-secret:map-authoring-self-check",
    hasSecret: true,
    model: providerState.model ?? "dry-run-map-authoring-model",
    allowPaidProvider: true,
    allowExternalTransmission: true,
    maxEstimatedCost: providerState.maxEstimatedCost ?? MAP_AUTHORING_COST_POLICY.maxEstimatedCost,
    operatorApprovalRef: providerState.operatorApprovalRef ?? "operator-approval:map-authoring-self-check",
    missingReason: null,
  };
};

function createInputRef(inputPackageId: string, goal: string) {
  return {
    id: `map-authoring-input-package:${inputPackageId}`,
    kind: "ai-result" as const,
    summary: `Map authoring input package for ${goal}`,
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
  const resolvedProviderState = resolveProviderStateForAuthoring(providerState);
  const inputPackage = buildMapAuthoringInputPackage(request, {
    requesterRef: `commander-console:${request.missionId}`,
  });
  const chainIds = createMapAuthoringChainIds(request.missionId);
  return {
    abilityGroupId: "ai" as const,
    missionId: request.missionId,
    inputRefs: [createInputRef(inputPackage.inputPackageId, inputPackage.userRequirement.goal)],
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
      allowPaidProvider: resolvedProviderState.allowPaidProvider,
      providerAllowlist: ["paid-analysis-ai"],
      operatorApprovalRef: resolvedProviderState.operatorApprovalRef,
      providerConfigRef: resolvedProviderState.configRef,
      secretRef: resolvedProviderState.secretRef,
    },
    costPolicy: { maxEstimatedCost: resolvedProviderState.maxEstimatedCost ?? MAP_AUTHORING_COST_POLICY.maxEstimatedCost },
    dataPolicy: { ...MAP_AUTHORING_DATA_POLICY, allowExternalTransmission: resolvedProviderState.allowExternalTransmission },
    safetyPolicy: MAP_AUTHORING_SAFETY_POLICY,
    taskType: "map_authoring" as const,
    inputModality: "structured_record" as const,
    input: inputPackage,
  };
}
