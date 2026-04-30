import { PROMPT_CONTRACT_CATALOG_VERSION } from "../../capabilities/ai/prompt-contracts/index.js";
import { CAPABILITY_CATALOG_VERSION } from "./capability-catalog/index.js";
import {
  MapAuthoringRequestSchema,
  type MapAuthoringRequest,
} from "./map-authoring-request.schema.js";
import {
  MapAuthoringResponseSchema,
  type MapAuthoringResponse,
} from "./map-authoring-response.schema.js";
import { buildMapAuthoringTemplate } from "./map-authoring-template.js";

const collectClarifications = (request: MapAuthoringRequest): string[] => {
  const clarifications: string[] = [];
  if (!request.operatorNotes.trim()) {
    clarifications.push("operator_notes_missing");
  }
  if (!request.targetPlatform.includes("tiktok") && !request.targetPlatform.includes("facebook")) {
    clarifications.push("target_platform_profile_unverified");
  }
  return clarifications;
};

export const buildMapAuthoringPrompt = (input: unknown): MapAuthoringResponse => {
  const request = MapAuthoringRequestSchema.parse(input);
  return MapAuthoringResponseSchema.parse({
    authoringPrompt: buildMapAuthoringTemplate(request),
    promptCatalogVersion: PROMPT_CONTRACT_CATALOG_VERSION,
    capabilityCatalogVersion: CAPABILITY_CATALOG_VERSION,
    requiredClarifications: collectClarifications(request),
  });
};