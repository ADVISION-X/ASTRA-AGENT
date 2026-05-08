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
  "You cannot emit automationGateRef.",
  "You cannot emit validationReportRef.",
  "You cannot emit activationSnapshotRef.",
  "Automation maps must strictly forbid any human review action; every runnable flow must complete through automated guarded execution, automated failure, or automated blocking only.",
  "Never add request-human-review, human-review, manual-review, operator-review, review_required terminal routing, or any step that waits for a person inside an automation map.",
  "You cannot invent abilityGroupId.",
  "You cannot invent childCapabilityId.",
  "You cannot invent promptContractId.",
  "You cannot invent outputSchemaRef.",
  "Operational maps may only describe ability-group and child-capability calls plus route edges.",
  "A map plus its referenced Prompt Contract is the complete map; branch semantics belong to Prompt Contract output, not map constraint logic.",
  "User intent must enter the authoring chain as freeform goal plus binary outcome options; the selected/default outcome options must be embedded in the runtime Prompt Contract, not hardcoded in Orchestration.",
  "For product-presence prompts, the runtime AI must output both decision and routeLabel; routeLabel must be one of userRequirement.binaryOutcomePolicy selected route labels.",
  "You must not emit policy, proofPolicy, successCondition, failureBranch, reviewBranch, postActionVerification, condition, allowedAbilityGroups, failureBranches, reviewBranches, or sequencePolicy.",
  "You must use only capabilityCatalog, promptContractCatalog, and outputSchemaCatalog for draft route construction.",
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
    "Facts Source: the complete Map Authoring Input Package JSON below is the only capability, prompt-contract, output-schema, and platform truth for map route construction.",
  ];
}

function buildOutputRequirementLines(): string[] {
  return [
    "- Return valid JSON only.",
    "- Return the top-level keys draftPackage, humanReadableExplanation, confidence, requiredClarifications, riskWarnings, validationHints, needsCapabilityExpansion, draftStatus, and authoringChain.",
    "- Return draft sections only. Do not emit manifest, activation, approval, validation report, rollback, signature, or runtime state fields.",
    "- The local normalizer will add immutable governance metadata such as manifest refs, package ids, and activation gates.",
    "- authoringChain may only echo the governed contract values above. Never invent authoringRunId, userRequirementRef, sourceRequirementHash, providerPolicyRef, promptHash, or authoringProofRef.",
    "- Do not emit activationGateStatus=gate_passed, availabilityPolicy=active, automationGateRef, validationReportRef, activationSnapshotRef, importProofRef, quarantineProofRef, or activationProofRef.",
    "- Every AI step must have a prompt binding with promptContractId, requiredInputRefs, and outputSchemaRef.",
    "- Production automation maps must be routePlanBoundMap: declare only entry spine, AI handoff, Prompt Contract refs, input/output refs, and routePlanId.",
    "- Route Plan is the only muscle-memory source for routeLabel -> step chain -> ability group/child capability. The map must not duplicate Route Plan-owned steps, transitions, route labels, or AI success routing.",
    "- Production routePlanBoundMap must not use Branch DSL, schemaFieldRef routing, action chains, review routes, or map-owned branching; only Route Plan routeLabel matching is allowed.",
    "- genericDiagnosticMap is only for isolated diagnostics and must not bind Route Plan or enter production automation execution.",
    "- 地图禁止出现任何约束逻辑；一个地图 + 对应 Prompt Contract，才是完整地图。",
    "- UserRequirement.binaryOutcomePolicy is mandatory source truth: product_yes must use selectedPositiveRouteLabel and product_no must use selectedNegativeRouteLabel.",
    "- Runtime Prompt Contracts for binary product decisions must require AI to output decision plus routeLabel. Orchestration may only match the routeLabel mechanically; it must not infer next actions from product_yes/product_no.",
    "- AI output must not include nextIntent, suggestedNextAction, actionIntent, or action_intent. Non-routing explanation must use reason or nonExecutableSummary only, and only routeLabel may be used for branching.",
    "- Map transitions must not expose or own route labels; selected/default binary options in the Prompt Contract decide which routeLabel AI returns, and Route Plan owns the matching action chain.",
    "- Do not emit map constraint fields: policy, proofPolicy, successCondition, failureBranch, reviewBranch, postActionVerification, transition.condition, allowedAbilityGroups, failureBranches, reviewBranches, or sequencePolicy.",
    "- Do not invent abilityGroupId, childCapabilityId, promptContractId, requiredInputRefs, outputSchemaRef, or branch fields that are not declared by the governed catalogs.",
    "- If the request is ambiguous or under-specified, populate requiredClarifications and set draftStatus=needs_clarification.",
    "- If the governed catalogs do not support the requested flow, set needsCapabilityExpansion=true.",
    "- 自动化地图，严厉禁止加入任何人工审查的动作，必须自动化完成。",
    "- Automation maps must not include request-human-review, human-review, manual-review, operator-review, review_required terminal routing, or any step that waits for a person.",
    "- Any step that sends, publishes, submits, deletes, buys, confirms, or otherwise mutates user data must be handled by automated policy gates, automated post-click observation, automated blocking, or automated failed termination; never by human review routing.",
    "- Any text-input send, publish, commit, submit, or confirm action must be automatically gated or blocked by governed policy; do not require explicit automated gate inside the automation map.",
    "- Do not emit fields named rawPrompt, systemPrompt, userPrompt, promptText, executablePromptLogic, handler, script, exec, import, require, or shell.",
    "- Use only capability, prompt-contract, and output-schema entries contained in this input package for map route construction.",
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
    ...MAP_AUTHORING_SAFETY_POLICY.map((policy) => `- ${policy}`),
    "Complete Map Authoring Input Package JSON:",
    JSON.stringify(inputPackage, null, 2),
    "Output Requirements:",
    ...buildOutputRequirementLines(),
  ].join("\n");
};
