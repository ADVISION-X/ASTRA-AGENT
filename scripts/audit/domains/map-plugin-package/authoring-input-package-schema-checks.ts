import type { Project } from "ts-morph";

import type { Finding } from "../../core/schema.js";
import { getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";
import { getSource } from "./audit-project.js";
import { MAP_PLUGIN_LAWS } from "./constants.js";
import { createAuthoringFinding } from "./authoring-input-package-shared.js";

const INPUT_PACKAGE_SCHEMA_FILE = "src/map-plugins/authoring/map-authoring-input-package.schema.ts";

type SchemaFieldSpec = {
  schemaName: string;
  requiredFields: readonly string[];
  lawId: string;
  message: string;
};

const SCHEMA_FIELD_SPECS: readonly SchemaFieldSpec[] = [
  {
    schemaName: "MapAuthoringInputPackageSchema",
    lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE,
    message: "Map Authoring Input Package schema must declare every required top-level governance field.",
    requiredFields: ["inputPackageId", "inputPackageVersion", "generatedAt", "requesterRef", "userRequirement", "userRequirementRef", "sourceRequirementHash", "targetPlatformProfileRef", "targetPlatformProfile", "capabilityCatalog", "promptContractCatalog", "outputSchemaCatalog", "mapPackageSchema", "mapAuthoringOutputSchema", "safetyPolicy", "automationGatePolicy", "evidencePolicy", "pavPolicy", "forensicsPolicy", "privacyPolicy", "secretPolicy", "rateLimitPolicy", "exampleMaps", "exampleMapsVersion", "exampleMapsSourceRef", "validationPolicy", "expectedDraftStatus"],
  },
  {
    schemaName: "MapAuthoringUserRequirementSchema",
    lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE,
    message: "User requirement schema must carry source intent plus selected/default binary outcome policy into map authoring.",
    requiredFields: ["goal", "targetPlatform", "allowedAutomationScope", "mustAskBefore", "failureHandlingPreference", "evidencePreference", "binaryOutcomePolicy", "runLimit", "operatorNotes", "outputLanguage"],
  },
  {
    schemaName: "MapAuthoringBinaryOutcomePolicySchema",
    lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE,
    message: "Binary outcome policy schema must expose the YES/NO option catalog and selected route labels.",
    requiredFields: ["positiveDecision", "negativeDecision", "positiveOutcomeOptions", "negativeOutcomeOptions", "selectedPositiveOutcomeId", "selectedNegativeOutcomeId", "selectedPositiveRouteLabel", "selectedNegativeRouteLabel", "defaultedBySystem"],
  },
  {
    schemaName: "MapAuthoringCapabilityCatalogSchema",
    lawId: MAP_PLUGIN_LAWS.CAPABILITY_CATALOG_DETAIL,
    message: "Capability catalog schema must separate 14-owner boundary truth from map-routable child capabilities.",
    requiredFields: ["version", "generatedAt", "generatedFrom", "activeAbilityGroupCount", "abilityGroups", "mapRoutableChildren", "runtimeOnlyOwners", "authoringVisibilityPolicy"],
  },
  {
    schemaName: "MapAuthoringCapabilityGroupSchema",
    lawId: MAP_PLUGIN_LAWS.CAPABILITY_CATALOG_DETAIL,
    message: "Capability group schema must declare the full authoring catalog contract.",
    requiredFields: ["abilityGroupId", "abilityGroupCode", "displayName", "description", "ownerDomain", "routableByMap", "publicContractRef", "inputSchemaRef", "outputSchemaRef", "forbiddenResponsibilities", "children"],
  },
  {
    schemaName: "MapAuthoringCapabilityChildSchema",
    lawId: MAP_PLUGIN_LAWS.CAPABILITY_CATALOG_DETAIL,
    message: "Capability child schema must declare proof, review, and boundary metadata.",
    requiredFields: ["childCapabilityId", "childCapabilityCode", "displayName", "description", "inputSchemaRef", "outputSchemaRef", "requiredInputRefs", "producedOutputRefs", "requiresGeometryProof", "requiresTargetProof", "requiresFocusProof", "requiresApprovedText", "requiresPostActionVerification", "requiresAutomationGate", "sensitiveOperation", "sideEffectLevel", "allowedStepKinds", "supportedTargetKinds", "forbiddenResponsibilities", "proofRequirements", "failureModes"],
  },
  {
    schemaName: "MapAuthoringPromptContractCatalogEntrySchema",
    lawId: MAP_PLUGIN_LAWS.PROMPT_OUTPUT_CATALOGS,
    message: "Prompt contract catalog schema must declare the full governed reference contract.",
    requiredFields: ["promptContractId", "promptContractVersion", "promptHash", "displayName", "description", "inputSchemaRef", "outputSchemaRef", "allowedInputRefs", "dataPolicy", "providerPolicy", "binaryDecisionPolicy", "redactionPolicy", "forensicsPolicy", "forbiddenOutputs", "branchableOutputFields"],
  },
  {
    schemaName: "MapAuthoringOutputSchemaCatalogEntrySchema",
    lawId: MAP_PLUGIN_LAWS.PROMPT_OUTPUT_CATALOGS,
    message: "Output schema catalog schema must declare fields, branchability, and confidence/review metadata.",
    requiredFields: ["outputSchemaRef", "schemaVersion", "declaredFields", "branchableFields", "fieldTypes", "requiredFields", "reviewFields", "confidenceFields", "forbiddenFields", "exampleOutput"],
  },
] as const;

const collectMissingFields = (fieldNames: Set<string>, requiredFields: readonly string[]): string[] =>
  requiredFields.filter((fieldName) => !fieldNames.has(fieldName));

const inspectSchemaFieldSpec = (
  project: Project,
  spec: SchemaFieldSpec,
): Finding[] => {
  const schemaSource = getSource(project, INPUT_PACKAGE_SCHEMA_FILE);
  const fieldNames = getZodObjectPropertyNames(schemaSource, spec.schemaName);
  const missingFields = collectMissingFields(fieldNames, spec.requiredFields);
  return missingFields.length === 0
    ? []
    : [createAuthoringFinding(spec.lawId, INPUT_PACKAGE_SCHEMA_FILE, spec.message, missingFields.join(", "))];
};

export const inspectInputPackageSchema = (project: Project): Finding[] =>
  SCHEMA_FIELD_SPECS.flatMap((spec) => inspectSchemaFieldSpec(project, spec));
