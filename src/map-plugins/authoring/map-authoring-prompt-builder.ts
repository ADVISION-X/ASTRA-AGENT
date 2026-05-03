import { PROMPT_CONTRACT_CATALOG_VERSION } from "../../capabilities/ai/prompt-contracts/index.js";
import { CAPABILITY_CATALOG_VERSION } from "./capability-catalog/index.js";
import {
  MAP_AUTHORING_OUTPUT_FORMAT_VERSION,
  MAP_AUTHORING_PROMPT_CONTRACT_ID,
  MAP_AUTHORING_PROMPT_CONTRACT_VERSION,
  MAP_AUTHORING_SCHEMA_VERSION,
  MAP_AUTHORING_SECURITY_POLICY_REF,
} from "./map-authoring-contract.js";
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
    authoringPrompt: buildMapAuthoringTemplate(request, {
      promptContractId: MAP_AUTHORING_PROMPT_CONTRACT_ID,
      promptContractVersion: MAP_AUTHORING_PROMPT_CONTRACT_VERSION,
      mapPackageSchemaVersion: MAP_AUTHORING_SCHEMA_VERSION,
      outputFormatVersion: MAP_AUTHORING_OUTPUT_FORMAT_VERSION,
      securityPolicyRef: MAP_AUTHORING_SECURITY_POLICY_REF,
      capabilityCatalogVersion: CAPABILITY_CATALOG_VERSION,
      promptCatalogVersion: PROMPT_CONTRACT_CATALOG_VERSION,
    }),
    promptCatalogVersion: PROMPT_CONTRACT_CATALOG_VERSION,
    capabilityCatalogVersion: CAPABILITY_CATALOG_VERSION,
    promptContractId: MAP_AUTHORING_PROMPT_CONTRACT_ID,
    promptContractVersion: MAP_AUTHORING_PROMPT_CONTRACT_VERSION,
    mapPackageSchemaVersion: MAP_AUTHORING_SCHEMA_VERSION,
    outputFormatVersion: MAP_AUTHORING_OUTPUT_FORMAT_VERSION,
    securityPolicyRef: MAP_AUTHORING_SECURITY_POLICY_REF,
    requiredClarifications: collectClarifications(request),
  });
};