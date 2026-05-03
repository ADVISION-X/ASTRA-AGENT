import { randomUUID } from "node:crypto";

import { getAiExternalProviderPublicState, saveAiExternalProviderConfig } from "../../../capabilities/ai/runtime/provider-config-store.js";
import { getDefaultMapPluginRegistry } from "../../../map-plugins/registry/map-plugin-registry.js";
import { MapAuthoringRequestSchema } from "../../../map-plugins/authoring/map-authoring-request.schema.js";
import { normalizeMapAuthoringDraft } from "../../../map-plugins/authoring/map-authoring-draft-normalizer.js";
import { approveMapPackage } from "../../../map-plugins/import/map-package-approval.js";
import { getDefaultLocalDataDir } from "../default-data-dir.js";
import type { WorkbenchRuntime } from "../workbench-contract.js";
import type {
  MapLabActivationResult,
  MapLabApprovalResult,
  MapLabAuthoringRequest,
  MapLabGenerateDraftResult,
  MapLabProviderConfigInput,
  MapLabProviderState,
  MapLabSnapshot,
} from "./map-lab-types.js";

const MAP_AUTHORING_PROMPT_CONTRACT_ID = "map.authoring.v1";
const MAP_AUTHORING_OUTPUT_SCHEMA = "ai.map_authoring.v1";

function resolveDataDir(runtime: WorkbenchRuntime): string {
  return runtime.options.dataDir ?? getDefaultLocalDataDir();
}

function stringifyFailureReason(reason: unknown): string | null {
  if (typeof reason === "string") {
    return reason;
  }
  if (reason && typeof reason === "object" && "message" in reason && typeof reason.message === "string") {
    return reason.message;
  }
  return null;
}

function createInputRef(request: MapLabAuthoringRequest) {
  return {
    id: `map-authoring-request:${request.missionId}`,
    kind: "ai-result" as const,
    summary: `Map authoring request for ${request.objective}`,
  };
}

function buildProviderStateSnapshot(runtime: WorkbenchRuntime): Promise<MapLabProviderState> {
  const dataDir = resolveDataDir(runtime);
  return getAiExternalProviderPublicState(dataDir);
}

function buildMapAuthoringAiRequest(
  request: MapLabAuthoringRequest,
  providerState: MapLabProviderState,
) {
  const sessionId = `map-lab:${randomUUID()}`;
  return {
    abilityGroupId: "ai" as const,
    missionId: request.missionId,
    inputRefs: [createInputRef(request)],
    promptContractId: MAP_AUTHORING_PROMPT_CONTRACT_ID,
    expectedOutputSchema: MAP_AUTHORING_OUTPUT_SCHEMA,
    requestedBy: "commander-console" as const,
    transportedBy: "commander-console" as const,
    sessionId,
    roundId: `map-authoring-round:${randomUUID()}`,
    videoVisitId: null,
    stepId: "map-authoring-draft",
    capabilityCallId: `map-authoring-call:${randomUUID()}`,
    nerveBusEnvelopeId: `map-authoring-envelope:${randomUUID()}`,
    mapPackageId: `draft-request:${request.missionId}`,
    mapPackageVersion: "draft",
    selectedMapId: `draft-request:${request.missionId}`,
    selectedMapVersion: "draft",
    activationSnapshotRef: `activation-snapshot:pending:${request.missionId}`,
    promptCatalogVersion: "map-prompt-contract-catalog.v1",
    qualityPolicy: {
      minimumConfidence: 0.6,
      requireSchemaValidation: true,
    },
    providerPolicy: {
      requireLocalOnly: false,
      allowPaidProvider: true,
      providerAllowlist: ["paid-analysis-ai"],
      operatorApprovalRef: `approval://map-lab/generation/${request.missionId}`,
      providerConfigRef: providerState.configRef,
      secretRef: providerState.secretRef,
    },
    costPolicy: {
      maxEstimatedCost: 5,
    },
    dataPolicy: {
      allowExternalTransmission: true,
      redactSensitiveData: true,
    },
    safetyPolicy: {
      reviewOnLowConfidence: true,
      reviewOnSchemaFailure: true,
      reviewOnPolicyViolation: true,
    },
    taskType: "map_authoring" as const,
    inputModality: "structured_record" as const,
    input: request,
  };
}

function mapValidationIssues(validationIssues: Array<{ message: string }>): string[] {
  return validationIssues.map((issue) => issue.message);
}

export function createMapLabService(runtime: WorkbenchRuntime) {
  const registry = getDefaultMapPluginRegistry();

  return {
    async getSnapshot(): Promise<MapLabSnapshot> {
      return {
        provider: await buildProviderStateSnapshot(runtime),
        developerCatalog: registry.listDeveloperCatalog(),
      };
    },

    async saveProviderConfig(input: MapLabProviderConfigInput): Promise<MapLabProviderState> {
      const dataDir = resolveDataDir(runtime);
      return saveAiExternalProviderConfig(dataDir, input);
    },

    async generateDraft(input: unknown): Promise<MapLabGenerateDraftResult> {
      const request = MapAuthoringRequestSchema.parse(input);
      const providerState = await buildProviderStateSnapshot(runtime);
      const aiRequest = buildMapAuthoringAiRequest(request, providerState);
      const aiResult = await runtime.aiAbilityGroup.execute(aiRequest);
      if (aiResult.status !== "success" || aiResult.output === null) {
        return {
          status: aiResult.status,
          failureReason: stringifyFailureReason(aiResult.failureReason),
          reviewRequiredReason: aiResult.reviewRequiredReason ?? null,
          packageId: null,
          packageVersion: null,
          mapPackage: null,
          humanReadableExplanation: null,
          requiredClarifications: [],
          riskWarnings: [],
          validationHints: [],
          validationIssues: [],
          needsCapabilityExpansion: false,
          draftStatus: null,
        };
      }

      const normalized = normalizeMapAuthoringDraft({
        request,
        aiOutput: aiResult.output,
        promptContractId: aiRequest.promptContractId,
        promptVersion: aiResult.promptVersion ?? aiRequest.promptContractId,
        modelProvider: aiResult.modelProvider ?? "paid",
        modelName: aiResult.modelName ?? providerState.model ?? "unknown-model",
        runtime: aiResult.runtime ?? "openai-compatible",
        sessionId: aiRequest.sessionId,
      });
      const imported = registry.importPackage(normalized.mapPackage, "commander-console:map-lab");
      if (!imported.imported || !imported.mapPackage) {
        return {
          status: "failed",
          failureReason: "map_import_failed",
          reviewRequiredReason: null,
          packageId: normalized.mapPackage.manifest.packageId,
          packageVersion: normalized.mapPackage.manifest.packageVersion,
          mapPackage: normalized.mapPackage,
          humanReadableExplanation: normalized.humanReadableExplanation,
          requiredClarifications: normalized.requiredClarifications,
          riskWarnings: normalized.riskWarnings,
          validationHints: normalized.validationHints,
          validationIssues: mapValidationIssues(imported.validationIssues),
          needsCapabilityExpansion: normalized.needsCapabilityExpansion,
          draftStatus: normalized.draftStatus,
        };
      }

      const validationIssues = mapValidationIssues(imported.validationIssues);
      return {
        status: validationIssues.length > 0 ? "review_required" : "success",
        failureReason: validationIssues.length > 0 ? null : null,
        reviewRequiredReason: validationIssues.length > 0 ? "map_validation_failed" : null,
        packageId: imported.mapPackage.manifest.packageId,
        packageVersion: imported.mapPackage.manifest.packageVersion,
        mapPackage: imported.mapPackage,
        humanReadableExplanation: normalized.humanReadableExplanation,
        requiredClarifications: normalized.requiredClarifications,
        riskWarnings: normalized.riskWarnings,
        validationHints: normalized.validationHints,
        validationIssues,
        needsCapabilityExpansion: normalized.needsCapabilityExpansion,
        draftStatus: normalized.draftStatus,
      };
    },

    async approveDraft(input: { packageId: string; packageVersion: string; approvedBy: string }): Promise<MapLabApprovalResult> {
      const approved = approveMapPackage({ registry, ...input });
      if (!approved.approved) {
        return {
          status: "failed",
          reason: approved.reason,
          packageId: input.packageId,
          packageVersion: input.packageVersion,
        };
      }
      return {
        status: "success",
        reason: null,
        packageId: approved.mapPackage.manifest.packageId,
        packageVersion: approved.mapPackage.manifest.packageVersion,
      };
    },

    async activateDraft(input: { packageId: string; packageVersion: string; approvedBy: string; reason: string }): Promise<MapLabActivationResult> {
      const activated = registry.activatePackage(input.packageId, input.packageVersion, input.approvedBy, input.reason);
      if (activated.activated === false && "reason" in activated) {
        return {
          status: "failed",
          reason: activated.reason,
          packageId: input.packageId,
          packageVersion: input.packageVersion,
          activationId: null,
        };
      }
      return {
        status: "success",
        reason: null,
        packageId: activated.mapPackage.manifest.packageId,
        packageVersion: activated.mapPackage.manifest.packageVersion,
        activationId: activated.activationRecord.activationId,
      };
    },
  };
}
