import { MapAuthoringRequestSchema } from "../../../map-plugins/authoring/map-authoring-request.schema.js";
import { normalizeMapAuthoringDraft } from "../../../map-plugins/authoring/map-authoring-draft-normalizer.js";
import type { WorkbenchRuntime } from "../workbench-contract.js";
import { buildMapAuthoringAiRequest } from "./map-lab-draft-request.js";
import { buildProviderStateSnapshot } from "./map-lab-provider-support.js";
import type { MapLabGenerateDraftResult } from "./map-lab-types.js";

type MapLabAiResult = Awaited<ReturnType<WorkbenchRuntime["aiAbilityGroup"]["execute"]>>;
type NormalizedDraft = ReturnType<typeof normalizeMapAuthoringDraft>;
type MapLabDraftRegistry = {
  importPackage: (
    mapPackage: NormalizedDraft["mapPackage"],
    source: string,
  ) => {
    imported: boolean;
    mapPackage: NormalizedDraft["mapPackage"] | null;
    validationIssues: Array<{ message: string }>;
  };
};

function stringifyFailureReason(reason: unknown): string | null {
  if (typeof reason === "string") {
    return reason;
  }
  if (reason && typeof reason === "object" && "message" in reason && typeof reason.message === "string") {
    return reason.message;
  }
  return null;
}

function mapValidationIssues(validationIssues: Array<{ message: string }>): string[] {
  return validationIssues.map((issue) => issue.message);
}

function createAiFailureResult(aiResult: MapLabAiResult): MapLabGenerateDraftResult {
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

function createImportedDraftResult(
  normalized: NormalizedDraft,
  imported: ReturnType<MapLabDraftRegistry["importPackage"]>,
): MapLabGenerateDraftResult {
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
    failureReason: null,
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
}

export async function generateMapLabDraft(input: {
  runtime: WorkbenchRuntime;
  registry: MapLabDraftRegistry;
  requestInput: unknown;
}): Promise<MapLabGenerateDraftResult> {
  const request = MapAuthoringRequestSchema.parse(input.requestInput);
  const providerState = await buildProviderStateSnapshot(input.runtime);
  const aiRequest = buildMapAuthoringAiRequest(request, providerState);
  const aiResult = await input.runtime.aiAbilityGroup.execute(aiRequest);
  if (aiResult.status !== "success" || aiResult.output === null) {
    return createAiFailureResult(aiResult);
  }

  const normalized = normalizeMapAuthoringDraft({
    request,
    inputPackage: aiRequest.input,
    aiOutput: aiResult.output,
    promptContractId: aiRequest.promptContractId,
    promptVersion: aiResult.promptVersion ?? aiRequest.promptContractId,
    modelProvider: aiResult.modelProvider ?? "paid",
    modelName: aiResult.modelName ?? providerState.model ?? "unknown-model",
    runtime: aiResult.runtime ?? "openai-compatible",
    sessionId: aiRequest.sessionId,
  });
  return createImportedDraftResult(
    normalized,
    input.registry.importPackage(normalized.mapPackage, "commander-console:map-lab"),
  );
}