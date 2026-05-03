import {
  listPromptContractCatalogEntries,
  PROMPT_CONTRACT_CATALOG_VERSION,
} from "../../capabilities/ai/prompt-contracts/index.js";
import {
  buildCapabilityCatalog,
  CAPABILITY_CATALOG_VERSION,
} from "./capability-catalog/index.js";
import type { MapAuthoringRequest } from "./map-authoring-request.schema.js";
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

const resolveTemplateContract = (contract: MapAuthoringTemplateContract = {}) => ({
  promptContractId: contract.promptContractId ?? MAP_AUTHORING_PROMPT_CONTRACT_ID,
  promptContractVersion: contract.promptContractVersion ?? MAP_AUTHORING_PROMPT_CONTRACT_VERSION,
  mapPackageSchemaVersion: contract.mapPackageSchemaVersion ?? MAP_AUTHORING_SCHEMA_VERSION,
  outputFormatVersion: contract.outputFormatVersion ?? MAP_AUTHORING_OUTPUT_FORMAT_VERSION,
  securityPolicyRef: contract.securityPolicyRef ?? MAP_AUTHORING_SECURITY_POLICY_REF,
  capabilityCatalogVersion: contract.capabilityCatalogVersion ?? CAPABILITY_CATALOG_VERSION,
  promptCatalogVersion: contract.promptCatalogVersion ?? PROMPT_CONTRACT_CATALOG_VERSION,
});

const formatCapabilitySection = (): string =>
  buildCapabilityCatalog().entries
    .map((entry) => `- ${entry.abilityGroupId}/${entry.childCapabilityId}: ${entry.description} | input=${entry.inputSchemaRef} | output=${entry.outputSchemaRef}`)
    .join("\n");

const formatPromptContractSection = (): string =>
  listPromptContractCatalogEntries()
    .map((entry) => `- ${entry.promptContractId}: taskType=${entry.taskType} | schemaVersion=${entry.schemaVersion} | output=${entry.outputSchemaRef} | requiredInputRefs=${entry.requiredInputRefs.join(", ")}`)
    .join("\n");

export const buildMapAuthoringTemplate = (
  request: MapAuthoringRequest,
  contract: MapAuthoringTemplateContract = {},
): string => {
  const resolvedContract = resolveTemplateContract(contract);
  const languageInstruction =
    request.outputLanguage === "zh-CN"
      ? "Use simplified Chinese for human-readable fields in the output package."
      : "Use English for human-readable fields in the output package.";

  return [
    "You are authoring a GrassEye operational map package.",
    `Mission ID: ${request.missionId}`,
    `Objective: ${request.objective}`,
    `Target Platform: ${request.targetPlatform}`,
    `Operator Notes: ${request.operatorNotes || "none"}`,
    languageInstruction,
    `Authoring Prompt Contract: ${resolvedContract.promptContractId}`,
    `Authoring Prompt Version: ${resolvedContract.promptContractVersion}`,
    `Capability Catalog Version: ${resolvedContract.capabilityCatalogVersion}`,
    `Prompt Contract Catalog Version: ${resolvedContract.promptCatalogVersion}`,
    `Map Package Schema Version: ${resolvedContract.mapPackageSchemaVersion}`,
    `Output Format Version: ${resolvedContract.outputFormatVersion}`,
    `Security Policy Ref: ${resolvedContract.securityPolicyRef}`,
    "Safety Policy:",
    ...MAP_AUTHORING_SAFETY_POLICY.map((policy) => `- ${policy}`),
    "Allowed Capabilities:",
    formatCapabilitySection(),
    "Allowed Prompt Contracts:",
    formatPromptContractSection(),
    "Output Requirements:",
    "- Return valid JSON only.",
    "- Return the top-level keys draftPackage, humanReadableExplanation, confidence, requiredClarifications, riskWarnings, validationHints, needsCapabilityExpansion, draftStatus, and authoringChain.",
    "- Return draft sections only. Do not emit manifest, activation, approval, validation report, rollback, signature, or runtime state fields.",
    "- The local normalizer will add governance metadata such as manifest refs, package ids, and activation gates.",
    "- authoringChain may only echo the governed contract values above. Never invent authoringRunId, userRequirementRef, sourceRequirementHash, providerPolicyRef, promptHash, or authoringProofRef.",
    "- Do not emit approvalStatus=approved, availabilityPolicy=active, humanApprovalRef, validationReportRef, activationSnapshotRef, importProofRef, quarantineProofRef, or activationProofRef.",
    "- Every AI step must have a prompt binding with promptContractId, requiredInputRefs, and outputSchemaRef.",
    "- Do not invent abilityGroupId, childCapabilityId, promptContractId, requiredInputRefs, outputSchemaRef, or branch fields that are not declared by the governed catalogs.",
    "- If the request is ambiguous or under-specified, populate requiredClarifications and set draftStatus=needs_clarification.",
    "- If the governed catalogs do not support the requested flow, set needsCapabilityExpansion=true.",
    "- Any step that sends, publishes, submits, deletes, buys, confirms, or otherwise mutates user data must route through an explicit review gate before the mutating action.",
    "- Any text-input send, publish, commit, submit, or confirm action must require explicit human confirmation before execution.",
    "- Do not emit fields named rawPrompt, systemPrompt, userPrompt, promptText, executablePromptLogic, handler, script, exec, import, require, or shell.",
    "- Use only capability entries listed above.",
  ].join("\n");
};