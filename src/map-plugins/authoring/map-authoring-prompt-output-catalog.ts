import { z } from "zod";

import {
  requireAiOutputSchemaDescriptor,
} from "../../capabilities/ai/output-schema-catalog-port.js";
import {
  MAP_AUTHORING_OUTPUT_FORMAT_VERSION,
  MAP_AUTHORING_SCHEMA_VERSION,
} from "./map-authoring-contract.js";
import {
  MAP_AUTHORING_GOVERNED_PROMPT_CONTRACT_CATALOG_VERSION,
  listMapAuthoringGovernedPromptContracts,
  type MapAuthoringGovernedCatalogs,
} from "./map-authoring-governed-catalogs.js";
import type {
  MapAuthoringInputPackage,
  MapAuthoringOutputSchemaCatalogEntry,
  MapAuthoringPolicyDescriptor,
} from "./map-authoring-input-package.schema.js";

type PromptContractCatalogEntry = MapAuthoringGovernedCatalogs["promptContractCatalog"][number];

const buildPolicyDescriptor = (
  policyRef: string,
  summary: string,
  rules: string[],
): MapAuthoringPolicyDescriptor => ({ policyRef, summary, rules });

const unwrapSchema = (schema: z.ZodTypeAny): z.ZodTypeAny => {
  if (schema instanceof z.ZodDefault || schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return unwrapSchema(schema._def.innerType);
  }
  return schema;
};

const getSimpleFieldType = (schema: z.ZodTypeAny): string | null => {
  if (schema instanceof z.ZodString) {
    return "string";
  }
  if (schema instanceof z.ZodNumber) {
    return "number";
  }
  if (schema instanceof z.ZodBoolean) {
    return "boolean";
  }
  if (schema instanceof z.ZodObject) {
    return "object";
  }
  return null;
};

const describeFieldType = (schema: z.ZodTypeAny): string => {
  const resolved = unwrapSchema(schema);
  const simpleType = getSimpleFieldType(resolved);
  if (simpleType) {
    return simpleType;
  }
  if (resolved instanceof z.ZodArray) {
    return `array<${describeFieldType(resolved.element)}>`;
  }
  if (resolved instanceof z.ZodEnum) {
    return `enum<${resolved.options.join("|")}>`;
  }
  return resolved._def.typeName.replace("Zod", "").toLowerCase();
};

const isRequiredField = (schema: z.ZodTypeAny): boolean => {
  return !(schema instanceof z.ZodDefault || schema instanceof z.ZodOptional);
};

const buildPromptContractCatalogPolicies = (entry: PromptContractCatalogEntry) => ({
  dataPolicy: buildPolicyDescriptor(
    `policy://prompt-contract/${entry.promptContractId}/data`,
    "Controls restricted data access for prompt execution.",
    entry.restrictedDataAccess.length > 0 ? entry.restrictedDataAccess : ["no_unbounded_sensitive_data_access"],
  ),
  providerPolicy: buildPolicyDescriptor(
    `policy://prompt-contract/${entry.promptContractId}/provider`,
    "Constrains provider routing for the governed prompt contract.",
    [entry.modelRole, entry.taskType],
  ),
  binaryDecisionPolicy: buildPolicyDescriptor(
    `policy://prompt-contract/${entry.promptContractId}/binary-decision`,
    "Declares branchable AI output semantics without map-side constraint logic.",
    entry.allowedBranchFields.length > 0
      ? [`branchable_fields:${entry.allowedBranchFields.join(",")}`, "no_human_review_branch"]
      : ["no_branchable_output"],
  ),
  redactionPolicy: buildPolicyDescriptor(
    `policy://prompt-contract/${entry.promptContractId}/redaction`,
    "Controls redaction and raw-output retention.",
    [`raw_output_retention:${entry.debugPolicy.rawOutputRetention}`],
  ),
  forensicsPolicy: buildPolicyDescriptor(
    `policy://prompt-contract/${entry.promptContractId}/forensics`,
    "Requires prompt contract refs and hashes in proof records.",
    ["record_prompt_contract_ref", "record_prompt_hash", "record_output_schema_ref"],
  ),
});

const buildPromptContractCatalogEntry = (entry: PromptContractCatalogEntry) => ({
  promptContractId: entry.promptContractId,
  promptContractVersion: entry.promptVersion,
  promptHash: entry.promptHash,
  promptContractHash: entry.promptContractHash,
  systemPromptTemplateHash: entry.systemPromptTemplateHash,
  userPromptTemplateHash: entry.userPromptTemplateHash,
  displayName: entry.promptContractId,
  description: entry.purpose,
  inputSchemaRef: entry.inputContract,
  outputSchemaRef: entry.outputSchemaRef,
  allowedInputRefs: entry.requiredInputRefs,
  ...buildPromptContractCatalogPolicies(entry),
  forbiddenOutputs: entry.forbiddenOutputs,
  branchableOutputFields: entry.allowedBranchFields,
});

const buildFieldTypes = (schema: z.ZodObject<z.ZodRawShape>): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(schema.shape).map(([fieldName, fieldSchema]) => [fieldName, describeFieldType(fieldSchema)]),
  );
};

const buildOutputSchemaCatalogEntry = (
  entry: PromptContractCatalogEntry,
): MapAuthoringOutputSchemaCatalogEntry | null => {
  const descriptor = requireAiOutputSchemaDescriptor(entry.taskType);

  const declaredFields = Object.keys(descriptor.schema.shape);
  return {
    outputSchemaRef: entry.outputSchemaRef,
    schemaVersion: descriptor.schemaVersion,
    declaredFields,
    branchableFields: entry.allowedBranchFields,
    fieldTypes: buildFieldTypes(descriptor.schema),
    requiredFields: declaredFields.filter((fieldName) => {
      const fieldSchema = descriptor.schema.shape[fieldName as keyof typeof descriptor.schema.shape];
      return fieldSchema ? isRequiredField(fieldSchema) : false;
    }),
    reviewFields: declaredFields.filter((fieldName) => fieldName.toLowerCase().includes("review") || fieldName === "requiredClarifications"),
    confidenceFields: declaredFields.filter((fieldName) => fieldName.toLowerCase().includes("confidence") || fieldName === "score"),
    forbiddenFields: ["rawPrompt", "systemPrompt", "userPrompt", "activationGateStatus", "activationSnapshotRef"],
    exampleOutput: null,
  };
};

const getMapAuthoringOutputSchemaDescriptor = () => {
  return requireAiOutputSchemaDescriptor("map_authoring");
};

export const buildPromptContractCatalog = (
  entries = listMapAuthoringGovernedPromptContracts(),
): MapAuthoringInputPackage["promptContractCatalog"] => ({
  version: MAP_AUTHORING_GOVERNED_PROMPT_CONTRACT_CATALOG_VERSION,
  entries: entries.map((entry) => buildPromptContractCatalogEntry(entry)),
});

export const buildOutputSchemaCatalog = (
  promptContracts = listMapAuthoringGovernedPromptContracts(),
): MapAuthoringInputPackage["outputSchemaCatalog"] => {
  const entries = new Map<string, MapAuthoringOutputSchemaCatalogEntry>();
  for (const promptContract of promptContracts) {
    const outputSchemaEntry = buildOutputSchemaCatalogEntry(promptContract);
    if (outputSchemaEntry) {
      entries.set(outputSchemaEntry.outputSchemaRef, outputSchemaEntry);
    }
  }

  return {
    version: "map-authoring-output-schema-catalog.v1",
    entries: [...entries.values()],
  };
};

export const buildMapPackageSchemaDescriptor = (): MapAuthoringInputPackage["mapPackageSchema"] => ({
  schemaRef: "map-plugin-package.schema.v1",
  schemaVersion: MAP_AUTHORING_SCHEMA_VERSION,
  requiredSections: ["manifest", "taskTemplate", "operationalMap", "dependencies", "compatibility", "promptBindings", "changelog", "signature"],
  requiredManifestFields: ["packageId", "packageKind", "packageVersion", "mapId", "taskTemplateId", "activationGateStatus", "aiGenerated"],
  requiredStepFields: ["stepId", "childCapabilityId", "stepKind", "targetAbilityGroupId", "inputRefs", "outputRefPolicy"],
  draftOnlyFields: ["activationGateStatus=draft", "availabilityPolicy=draft", "validationReportRef=null", "automationGateRef=null"],
  activationFields: ["validationReportRef", "automationGateRef", "activationProofRef", "activationSnapshotRef", "mapPackageHash", "operationalMapHash"],
  forbiddenFields: ["rawPrompt", "systemPrompt", "userPrompt", "functionBody", "eval", "directAbilityCall", "timeoutPolicy", "timeoutMs", "maxDurationMs", "primitiveTimeoutMs", "policy", "proofPolicy", "successCondition", "failureBranch", "reviewBranch", "postActionVerification", "condition", "allowedAbilityGroups", "failureBranches", "reviewBranches", "sequencePolicy"],
});

export const buildMapAuthoringOutputSchemaDescriptor = (): MapAuthoringInputPackage["mapAuthoringOutputSchema"] => {
  const descriptor = getMapAuthoringOutputSchemaDescriptor();

  return {
    schemaRef: MAP_AUTHORING_OUTPUT_FORMAT_VERSION,
    schemaVersion: MAP_AUTHORING_OUTPUT_FORMAT_VERSION,
    requiredTopLevelFields: Object.keys(descriptor.schema.shape),
    draftStatusValues: ["draft_ready", "needs_clarification"],
    forbiddenFields: ["activationGateStatus", "validationReportRef", "automationGateRef", "activationSnapshotRef", "rawPrompt", "systemPrompt", "userPrompt"],
  };
};
