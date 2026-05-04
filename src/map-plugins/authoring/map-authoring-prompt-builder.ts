import {
  MAP_AUTHORING_PROMPT_CONTRACT_ID,
  MAP_AUTHORING_PROMPT_CONTRACT_VERSION,
  MAP_AUTHORING_SECURITY_POLICY_REF,
} from "./map-authoring-contract.js";
import {
  MapAuthoringInputPackageSchema,
  type MapAuthoringInputPackage,
} from "./map-authoring-input-package.schema.js";
import {
  MapAuthoringResponseSchema,
  type MapAuthoringResponse,
} from "./map-authoring-response.schema.js";
import { buildMapAuthoringTemplate } from "./map-authoring-template.js";

const collectClarifications = (inputPackage: MapAuthoringInputPackage): string[] => {
  const clarifications: string[] = [];
  if (!inputPackage.userRequirement.operatorNotes.trim()) {
    clarifications.push("operator_notes_missing");
  }
  if (!inputPackage.userRequirement.mustAskBefore.length) {
    clarifications.push("missing_confirmation_policy_inputs");
  }
  if (!inputPackage.targetPlatformProfile.targetPlatformId.includes("tiktok") && !inputPackage.targetPlatformProfile.targetPlatformId.includes("facebook")) {
    clarifications.push("target_platform_profile_unverified");
  }
  return clarifications;
};

export const buildMapAuthoringPrompt = (input: unknown): MapAuthoringResponse => {
  const inputPackage = MapAuthoringInputPackageSchema.parse(input);
  return MapAuthoringResponseSchema.parse({
    authoringPrompt: buildMapAuthoringTemplate(inputPackage, {
      promptContractId: MAP_AUTHORING_PROMPT_CONTRACT_ID,
      promptContractVersion: MAP_AUTHORING_PROMPT_CONTRACT_VERSION,
      mapPackageSchemaVersion: inputPackage.mapPackageSchema.schemaVersion,
      outputFormatVersion: inputPackage.mapAuthoringOutputSchema.schemaVersion,
      securityPolicyRef: MAP_AUTHORING_SECURITY_POLICY_REF,
      capabilityCatalogVersion: inputPackage.capabilityCatalog.version,
      promptCatalogVersion: inputPackage.promptContractCatalog.version,
    }),
    inputPackageId: inputPackage.inputPackageId,
    promptCatalogVersion: inputPackage.promptContractCatalog.version,
    capabilityCatalogVersion: inputPackage.capabilityCatalog.version,
    outputSchemaCatalogVersion: inputPackage.outputSchemaCatalog.version,
    promptContractId: MAP_AUTHORING_PROMPT_CONTRACT_ID,
    promptContractVersion: MAP_AUTHORING_PROMPT_CONTRACT_VERSION,
    mapPackageSchemaVersion: inputPackage.mapPackageSchema.schemaVersion,
    outputFormatVersion: inputPackage.mapAuthoringOutputSchema.schemaVersion,
    securityPolicyRef: MAP_AUTHORING_SECURITY_POLICY_REF,
    requiredClarifications: collectClarifications(inputPackage),
  });
};