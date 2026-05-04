import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath, hasImportModuleSpecifier } from "../_shared/ast-helpers.js";
import { getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";
import { getSource } from "./audit-project.js";
import { MAP_PLUGIN_LAWS } from "./constants.js";

const INPUT_PACKAGE_SCHEMA_FILE = "src/map-plugins/authoring/map-authoring-input-package.schema.ts";
const INPUT_PACKAGE_BUILDER_FILE = "src/map-plugins/authoring/map-authoring-input-package-builder.ts";
const PROMPT_BUILDER_FILE = "src/map-plugins/authoring/map-authoring-prompt-builder.ts";
const AI_INPUT_SCHEMA_FILE = "src/capabilities/ai/schema-map-authoring.schema.ts";
const MAP_LAB_REQUEST_FILE = "src/lib/local-runtime/map-lab/map-lab-draft-request.ts";

const REQUIRED_INPUT_PACKAGE_FIELDS = [
  "inputPackageId",
  "inputPackageVersion",
  "generatedAt",
  "requesterRef",
  "userRequirement",
  "userRequirementRef",
  "sourceRequirementHash",
  "targetPlatformProfileRef",
  "targetPlatformProfile",
  "capabilityCatalog",
  "promptContractCatalog",
  "outputSchemaCatalog",
  "mapPackageSchema",
  "mapAuthoringOutputSchema",
  "safetyPolicy",
  "humanApprovalPolicy",
  "evidencePolicy",
  "pavPolicy",
  "forensicsPolicy",
  "privacyPolicy",
  "secretPolicy",
  "rateLimitPolicy",
  "validationPolicy",
  "expectedDraftStatus",
] as const;

const REQUIRED_CAPABILITY_GROUP_FIELDS = [
  "abilityGroupId",
  "abilityGroupCode",
  "displayName",
  "description",
  "ownerDomain",
  "routableByMap",
  "publicContractRef",
  "inputSchemaRef",
  "outputSchemaRef",
  "forbiddenResponsibilities",
  "children",
] as const;

const REQUIRED_CAPABILITY_CHILD_FIELDS = [
  "childCapabilityId",
  "childCapabilityCode",
  "displayName",
  "description",
  "inputSchemaRef",
  "outputSchemaRef",
  "requiredInputRefs",
  "producedOutputRefs",
  "requiresGeometryProof",
  "requiresTargetProof",
  "requiresFocusProof",
  "requiresApprovedText",
  "requiresPostActionVerification",
  "requiresHumanReview",
  "sensitiveOperation",
  "sideEffectLevel",
  "allowedStepKinds",
  "supportedTargetKinds",
  "forbiddenResponsibilities",
  "proofRequirements",
  "failureModes",
] as const;

const REQUIRED_PROMPT_CATALOG_FIELDS = [
  "promptContractId",
  "promptContractVersion",
  "promptHash",
  "displayName",
  "description",
  "inputSchemaRef",
  "outputSchemaRef",
  "allowedInputRefs",
  "dataPolicy",
  "providerPolicy",
  "reviewPolicy",
  "failurePolicy",
  "redactionPolicy",
  "forensicsPolicy",
  "forbiddenOutputs",
  "branchableOutputFields",
] as const;

const REQUIRED_OUTPUT_SCHEMA_FIELDS = [
  "outputSchemaRef",
  "schemaVersion",
  "declaredFields",
  "branchableFields",
  "fieldTypes",
  "requiredFields",
  "reviewFields",
  "confidenceFields",
  "forbiddenFields",
  "exampleOutput",
] as const;

const REQUIRED_INPUT_PACKAGE_BUILDER_FIELDS = [
  "capabilityCatalog",
  "promptContractCatalog",
  "outputSchemaCatalog",
  "mapPackageSchema",
  "mapAuthoringOutputSchema",
  "safetyPolicy",
  "humanApprovalPolicy",
  "evidencePolicy",
  "pavPolicy",
  "forensicsPolicy",
  "privacyPolicy",
  "secretPolicy",
  "rateLimitPolicy",
  "validationPolicy",
  "expectedDraftStatus",
] as const;

const createAuthoringFinding = (
  lawId: string,
  file: string,
  message: string,
  detail?: string,
): Finding => createFinding({ lawId, file, line: 1, severity: "fatal", message, ...(detail ? { detail } : {}) });

const collectMissingFieldFindings = (input: {
  fieldNames: Set<string>;
  requiredFields: readonly string[];
  lawId: string;
  file: string;
  message: string;
}): Finding[] => {
  const missingFields = input.requiredFields.filter((fieldName) => !input.fieldNames.has(fieldName));
  return missingFields.length === 0
    ? []
    : [createAuthoringFinding(input.lawId, input.file, input.message, missingFields.join(", "))];
};

const inspectInputPackageSchema = (project: Project): Finding[] => {
  const schemaSource = getSource(project, INPUT_PACKAGE_SCHEMA_FILE);
  return [
    ...collectMissingFieldFindings({
      fieldNames: getZodObjectPropertyNames(schemaSource, "MapAuthoringInputPackageSchema"),
      requiredFields: REQUIRED_INPUT_PACKAGE_FIELDS,
      lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE,
      file: INPUT_PACKAGE_SCHEMA_FILE,
      message: "Map Authoring Input Package schema must declare every required top-level governance field.",
    }),
    ...collectMissingFieldFindings({
      fieldNames: getZodObjectPropertyNames(schemaSource, "MapAuthoringCapabilityGroupSchema"),
      requiredFields: REQUIRED_CAPABILITY_GROUP_FIELDS,
      lawId: MAP_PLUGIN_LAWS.CAPABILITY_CATALOG_DETAIL,
      file: INPUT_PACKAGE_SCHEMA_FILE,
      message: "Capability group schema must declare the full authoring catalog contract.",
    }),
    ...collectMissingFieldFindings({
      fieldNames: getZodObjectPropertyNames(schemaSource, "MapAuthoringCapabilityChildSchema"),
      requiredFields: REQUIRED_CAPABILITY_CHILD_FIELDS,
      lawId: MAP_PLUGIN_LAWS.CAPABILITY_CATALOG_DETAIL,
      file: INPUT_PACKAGE_SCHEMA_FILE,
      message: "Capability child schema must declare proof, review, and boundary metadata.",
    }),
    ...collectMissingFieldFindings({
      fieldNames: getZodObjectPropertyNames(schemaSource, "MapAuthoringPromptContractCatalogEntrySchema"),
      requiredFields: REQUIRED_PROMPT_CATALOG_FIELDS,
      lawId: MAP_PLUGIN_LAWS.PROMPT_OUTPUT_CATALOGS,
      file: INPUT_PACKAGE_SCHEMA_FILE,
      message: "Prompt contract catalog schema must declare the full governed reference contract.",
    }),
    ...collectMissingFieldFindings({
      fieldNames: getZodObjectPropertyNames(schemaSource, "MapAuthoringOutputSchemaCatalogEntrySchema"),
      requiredFields: REQUIRED_OUTPUT_SCHEMA_FIELDS,
      lawId: MAP_PLUGIN_LAWS.PROMPT_OUTPUT_CATALOGS,
      file: INPUT_PACKAGE_SCHEMA_FILE,
      message: "Output schema catalog schema must declare fields, branchability, and confidence/review metadata.",
    }),
  ];
};

const inspectInputPackageBuilder = (project: Project): Finding[] => {
  const builderSource = getSource(project, INPUT_PACKAGE_BUILDER_FILE);
  const sourceText = builderSource.getFullText();
  const findings: Finding[] = [];
  const derivesPromptCatalogFromGovernedRegistry = hasCallExpression(builderSource, "listPromptContractCatalogEntries")
    || hasCallExpression(builderSource, "listAiPromptContractCatalogEntries")
    || hasCallExpression(builderSource, "listMapAuthoringGovernedPromptContracts");

  if (!hasCallExpressionPath(builderSource, ["MapAuthoringInputPackageSchema", "parse"])) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE,
      INPUT_PACKAGE_BUILDER_FILE,
      "Map Authoring Input Package builder must close through MapAuthoringInputPackageSchema.parse.",
    ));
  }
  if (!hasCallExpression(builderSource, "buildCapabilityCatalog") || !derivesPromptCatalogFromGovernedRegistry) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE,
      INPUT_PACKAGE_BUILDER_FILE,
      "Map Authoring Input Package builder must derive catalogs from governed capability and prompt registries.",
    ));
  }
  if (!builderSource.getFullText().includes('expectedDraftStatus: "draft"')) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_ENFORCEMENT,
      INPUT_PACKAGE_BUILDER_FILE,
      "Map Authoring Input Package builder must lock expectedDraftStatus=draft.",
    ));
  }

  const missingBuilderFields = REQUIRED_INPUT_PACKAGE_BUILDER_FIELDS.filter((fieldName) => !sourceText.includes(`${fieldName}:`));
  if (missingBuilderFields.length > 0) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE,
      INPUT_PACKAGE_BUILDER_FILE,
      "Map Authoring Input Package builder must emit every governed top-level field before schema parse.",
      missingBuilderFields.join(", "),
    ));
  }

  return findings;
};

const inspectPromptBuilderBoundary = (project: Project): Finding[] => {
  const promptBuilderSource = getSource(project, PROMPT_BUILDER_FILE);
  const findings: Finding[] = [];

  if (!hasImportModuleSpecifier(promptBuilderSource, "map-authoring-input-package.schema") || !hasCallExpressionPath(promptBuilderSource, ["MapAuthoringInputPackageSchema", "parse"])) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE,
      PROMPT_BUILDER_FILE,
      "Authoring prompt builder must parse a complete Map Authoring Input Package.",
    ));
  }
  if (hasImportModuleSpecifier(promptBuilderSource, "map-authoring-request.schema")) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE,
      PROMPT_BUILDER_FILE,
      "Authoring prompt builder must not build prompts directly from the freeform request schema.",
    ));
  }
  if (!promptBuilderSource.getFullText().includes("outputSchemaCatalogVersion")) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_ENFORCEMENT,
      PROMPT_BUILDER_FILE,
      "Authoring prompt builder must surface output schema catalog version in its governed response.",
    ));
  }

  return findings;
};

const inspectAiAndMapLabBoundary = (project: Project): Finding[] => {
  const aiSchemaSource = getSource(project, AI_INPUT_SCHEMA_FILE);
  const mapLabRequestSource = getSource(project, MAP_LAB_REQUEST_FILE);
  const findings: Finding[] = [];

  if (!hasImportModuleSpecifier(aiSchemaSource, "map-authoring-input-package.schema") || !aiSchemaSource.getFullText().includes("input: MapAuthoringInputPackageSchema")) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_ENFORCEMENT,
      AI_INPUT_SCHEMA_FILE,
      "AI map authoring boundary must accept MapAuthoringInputPackageSchema as the structured input payload.",
    ));
  }
  if (!hasCallExpression(mapLabRequestSource, "buildMapAuthoringInputPackage") || !mapLabRequestSource.getFullText().includes("input: inputPackage")) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_ENFORCEMENT,
      MAP_LAB_REQUEST_FILE,
      "Map lab draft request must build a governed input package before dispatching AI authoring.",
    ));
  }

  return findings;
};

export async function runAuthoringInputPackage(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...inspectInputPackageSchema(project),
    ...inspectInputPackageBuilder(project),
    ...inspectPromptBuilderBoundary(project),
    ...inspectAiAndMapLabBoundary(project),
  ];
  const passed = findings.length === 0;

  return {
    findings,
    phase: createPhase(
      "authoring-input-package",
      passed ? "PASS" : "ENFORCEMENT MISS",
      passed,
      passed
        ? "Map Authoring Input Package schema, builder, prompt builder, and AI input boundary are governed and owner-local."
        : "Map Authoring Input Package enforcement is missing required schema, builder, or boundary coverage.",
    ),
  };
}