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

const formatCapabilitySection = (inputPackage: MapAuthoringInputPackage): string =>
  inputPackage.capabilityCatalog.abilityGroups
    .flatMap((group) =>
      group.children.map((child) =>
        `- ${group.abilityGroupId}/${child.childCapabilityId}: ${child.description} | input=${child.inputSchemaRef} | output=${child.outputSchemaRef} | sideEffect=${child.sideEffectLevel} | PAV=${child.requiresPostActionVerification}`,
      ),
    )
    .join("\n");

const formatPromptContractSection = (inputPackage: MapAuthoringInputPackage): string =>
  inputPackage.promptContractCatalog.entries
    .map((entry) => `- ${entry.promptContractId}: version=${entry.promptContractVersion} | output=${entry.outputSchemaRef} | requiredInputRefs=${entry.allowedInputRefs.join(", ")}`)
    .join("\n");

const formatOutputSchemaSection = (inputPackage: MapAuthoringInputPackage): string =>
  inputPackage.outputSchemaCatalog.entries
    .map((entry) => `- ${entry.outputSchemaRef}: declared=${entry.declaredFields.join(", ")} | branchable=${entry.branchableFields.join(", ") || "none"}`)
    .join("\n");

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
    `Requester Ref: ${inputPackage.requesterRef}`,
    `User Goal: ${inputPackage.userRequirement.goal}`,
    `Target Platform: ${inputPackage.userRequirement.targetPlatform}`,
    `Allowed Automation Scope: ${inputPackage.userRequirement.allowedAutomationScope}`,
    `Operator Notes: ${inputPackage.userRequirement.operatorNotes || "none"}`,
    resolveLanguageInstruction(inputPackage),
    `Authoring Prompt Contract: ${resolvedContract.promptContractId}`,
    `Authoring Prompt Version: ${resolvedContract.promptContractVersion}`,
    `Capability Catalog Version: ${resolvedContract.capabilityCatalogVersion}`,
    `Prompt Contract Catalog Version: ${resolvedContract.promptCatalogVersion}`,
    `Map Package Schema Version: ${resolvedContract.mapPackageSchemaVersion}`,
    `Output Format Version: ${resolvedContract.outputFormatVersion}`,
    `Security Policy Ref: ${resolvedContract.securityPolicyRef}`,
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

const formatUserRequirementSection = (inputPackage: MapAuthoringInputPackage): string[] => [
  `- Goal: ${inputPackage.userRequirement.goal}`,
  `- Must Ask Before: ${inputPackage.userRequirement.mustAskBefore.join(", ")}`,
  `- Failure Handling: ${inputPackage.userRequirement.failureHandlingPreference ?? "review_required"}`,
  `- Evidence Preference: ${inputPackage.userRequirement.evidencePreference ?? "retain_refs_only"}`,
];

const formatPolicySection = (inputPackage: MapAuthoringInputPackage): string[] => [
  `- Safety: ${inputPackage.safetyPolicy.rules.join(", ")}`,
  `- Human Approval: ${inputPackage.humanApprovalPolicy.rules.join(", ")}`,
  `- Evidence: ${inputPackage.evidencePolicy.rules.join(", ")}`,
  `- PAV: ${inputPackage.pavPolicy.rules.join(", ")}`,
  `- Forensics: ${inputPackage.forensicsPolicy.rules.join(", ")}`,
  `- Privacy: ${inputPackage.privacyPolicy.rules.join(", ")}`,
  `- Secret: ${inputPackage.secretPolicy.rules.join(", ")}`,
  `- Rate Limit: ${inputPackage.rateLimitPolicy.rules.join(", ")}`,
];

const formatPlatformProfileSection = (inputPackage: MapAuthoringInputPackage): string[] => [
  `- Platform Profile Ref: ${inputPackage.targetPlatformProfile.platformProfileRef}`,
  `- Login/Auth Expectations: ${inputPackage.targetPlatformProfile.loginAuthExpectations.join(", ")}`,
  `- Prohibited Operations: ${inputPackage.targetPlatformProfile.prohibitedOperations.join(", ")}`,
  `- Supported Targets: ${inputPackage.targetPlatformProfile.supportedTargets.join(", ")}`,
  `- Human Review Rules: ${inputPackage.targetPlatformProfile.humanReviewRules.join(", ")}`,
];

const formatSchemaSection = (inputPackage: MapAuthoringInputPackage): string[] => [
  `- Map Package Required Sections: ${inputPackage.mapPackageSchema.requiredSections.join(", ")}`,
  `- Map Package Draft-Only Fields: ${inputPackage.mapPackageSchema.draftOnlyFields.join(", ")}`,
  `- Output Schema Required Fields: ${inputPackage.mapAuthoringOutputSchema.requiredTopLevelFields.join(", ")}`,
  `- Draft Status Values: ${inputPackage.mapAuthoringOutputSchema.draftStatusValues.join(", ")}`,
];

export const buildMapAuthoringTemplate = (
  inputPackage: MapAuthoringInputPackage,
  contract: MapAuthoringTemplateContract = {},
): string => {
  const resolvedContract = resolveTemplateContract(inputPackage, contract);

  return [
    ...buildTemplateHeaderLines(inputPackage, resolvedContract),
    "User Requirement:",
    ...formatUserRequirementSection(inputPackage),
    "Safety Policy:",
    ...MAP_AUTHORING_SAFETY_POLICY.map((policy) => `- ${policy}`),
    "Governed Policies:",
    ...formatPolicySection(inputPackage),
    "Platform Profile:",
    ...formatPlatformProfileSection(inputPackage),
    "Map Schema Contract:",
    ...formatSchemaSection(inputPackage),
    "Allowed Capabilities:",
    formatCapabilitySection(inputPackage),
    "Allowed Prompt Contracts:",
    formatPromptContractSection(inputPackage),
    "Allowed Output Schemas:",
    formatOutputSchemaSection(inputPackage),
    "Output Requirements:",
    ...buildOutputRequirementLines(),
  ].join("\n");
};