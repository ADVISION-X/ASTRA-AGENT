import type { MapAuthoringInputPackage } from "./map-authoring-input-package.schema.js";
import {
  MAP_AUTHORING_OUTPUT_FORMAT_VERSION,
  MAP_AUTHORING_PROMPT_CONTRACT_ID,
  MAP_AUTHORING_PROMPT_CONTRACT_VERSION,
  MAP_AUTHORING_SCHEMA_VERSION,
  MAP_AUTHORING_SECURITY_POLICY_REF,
} from "./map-authoring-contract.js";
import { MAP_AUTHORING_SAFETY_POLICY } from "./map-authoring-safety-policy.js";

type MapAuthoringTemplateContract = {
  promptContractId?: string;
  promptContractVersion?: string;
  mapPackageSchemaVersion?: string;
  outputFormatVersion?: string;
  securityPolicyRef?: string;
  capabilityCatalogVersion?: string;
  promptCatalogVersion?: string;
};

export const MAP_AUTHORING_SYSTEM_PROMPT_TEMPLATE = [
  "You are GrassEye Map Authoring Agent.",
  "You receive a complete Map Authoring Input Package.",
  "You generate declarative operational-map package candidates only.",
  "You cannot write code.",
  "You cannot write raw prompts.",
  "You cannot execute tools.",
  "You cannot call APIs.",
  "You cannot activate maps.",
  "You cannot approve maps.",
  "You cannot emit humanApprovalRef.",
  "You cannot emit validationReportRef.",
  "You cannot emit activationSnapshotRef.",
  "You cannot invent abilityGroupId.",
  "You cannot invent childCapabilityId.",
  "You cannot invent promptContractId.",
  "You cannot invent outputSchemaRef.",
  "You must use only capabilityCatalog, promptContractCatalog, outputSchemaCatalog, and policy catalogs.",
  "If catalogs are stale, missing, or inconsistent, return the governed blocking code.",
  "Return strict JSON matching MapAuthoringAiOutputSchema.",
].join("\n");

export const MAP_AUTHORING_USER_PROMPT_TEMPLATE = [
  "Map Authoring Request Metadata:",
  "- inputPackageId",
  "- promptContractId",
  "- taskType",
  "- outputSchemaRef",
  "- language requirement",
  "Complete Map Authoring Input Package JSON:",
  "{{MapAuthoringInputPackage}}",
  "Return JSON only.",
].join("\n");

const resolveTemplateContract = (
  inputPackage: MapAuthoringInputPackage,
  contract: MapAuthoringTemplateContract = {},
) => ({
  promptContractId: contract.promptContractId ?? MAP_AUTHORING_PROMPT_CONTRACT_ID,
  promptContractVersion: contract.promptContractVersion ?? MAP_AUTHORING_PROMPT_CONTRACT_VERSION,
  mapPackageSchemaVersion: contract.mapPackageSchemaVersion ?? inputPackage.mapPackageSchema.schemaVersion ?? MAP_AUTHORING_SCHEMA_VERSION,
  outputFormatVersion: contract.outputFormatVersion ?? inputPackage.mapAuthoringOutputSchema.schemaVersion ?? MAP_AUTHORING_OUTPUT_FORMAT_VERSION,
  securityPolicyRef: contract.securityPolicyRef ?? MAP_AUTHORING_SECURITY_POLICY_REF,
  capabilityCatalogVersion: contract.capabilityCatalogVersion ?? inputPackage.capabilityCatalog.version,
  promptCatalogVersion: contract.promptCatalogVersion ?? inputPackage.promptContractCatalog.version,
});

const resolveLanguageInstruction = (inputPackage: MapAuthoringInputPackage): string =>
  inputPackage.userRequirement.outputLanguage === "zh-CN"
    ? "Use simplified Chinese for human-readable fields in the output package."
    : "Use English for human-readable fields in the output package.";

function buildTemplateHeaderLines(
  inputPackage: MapAuthoringInputPackage,
  resolvedContract: ReturnType<typeof resolveTemplateContract>,
): string[] {
  return [
    "You are GrassEye Map Authoring Agent.",
    `Input Package ID: ${inputPackage.inputPackageId}`,
    `Prompt Contract ID: ${resolvedContract.promptContractId}`,
    "Task Type: map_authoring",
    `Output Schema Ref: ${inputPackage.mapAuthoringOutputSchema.schemaRef}`,
    `Language Requirement: ${resolveLanguageInstruction(inputPackage)}`,
    "Facts Source: the complete Map Authoring Input Package JSON below is the only capability, prompt-contract, output-schema, platform, and policy truth.",
  ];
}

function buildOutputRequirementLines(): string[] {
  return [
    "- Return valid JSON only.",
    "- Return the top-level keys draftPackage, humanReadableExplanation, confidence, requiredClarifications, riskWarnings, validationHints, needsCapabilityExpansion, draftStatus, and authoringChain.",
    "- Return draft sections only. Do not emit manifest, activation, approval, validation report, rollback, signature, or runtime state fields.",
    "- The local normalizer will add immutable governance metadata such as manifest refs, package ids, and activation gates.",
    "- authoringChain may only echo the governed contract values above. Never invent authoringRunId, userRequirementRef, sourceRequirementHash, providerPolicyRef, promptHash, or authoringProofRef.",
    "- Do not emit approvalStatus=approved, availabilityPolicy=active, humanApprovalRef, validationReportRef, activationSnapshotRef, importProofRef, quarantineProofRef, or activationProofRef.",
    "- Every AI step must have a prompt binding with promptContractId, requiredInputRefs, and outputSchemaRef.",
    "- Do not invent abilityGroupId, childCapabilityId, promptContractId, requiredInputRefs, outputSchemaRef, or branch fields that are not declared by the governed catalogs.",
    "- If the request is ambiguous or under-specified, populate requiredClarifications and set draftStatus=needs_clarification.",
    "- If the governed catalogs do not support the requested flow, set needsCapabilityExpansion=true.",
    "- Any step that sends, publishes, submits, deletes, buys, confirms, or otherwise mutates user data must route through an explicit review gate before the mutating action.",
    "- Any text-input send, publish, commit, submit, or confirm action must require explicit human confirmation before execution.",
    "- Do not emit fields named rawPrompt, systemPrompt, userPrompt, promptText, executablePromptLogic, handler, script, exec, import, require, or shell.",
    "- Use only capability, prompt-contract, output-schema, and policy entries contained in this input package.",
  ];
}

export const buildMapAuthoringTemplate = (
  inputPackage: MapAuthoringInputPackage,
  contract: MapAuthoringTemplateContract = {},
): string => {
  const resolvedContract = resolveTemplateContract(inputPackage, contract);

  return [
    ...buildTemplateHeaderLines(inputPackage, resolvedContract),
    "Static Governance Rules:",
    "- open-tiktok: stale manual childCapabilityId text",
    ...MAP_AUTHORING_SAFETY_POLICY.map((policy) => `- ${policy}`),
    "Complete Map Authoring Input Package JSON:",
    JSON.stringify(inputPackage, null, 2),
    "Output Requirements:",
    ...buildOutputRequirementLines(),
  ].join("\n");
};
