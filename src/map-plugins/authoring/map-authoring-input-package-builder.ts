import { createHash } from "node:crypto";

import { buildCapabilityCatalog } from "./capability-catalog/index.js";
import { listMapAuthoringGovernedPromptContracts } from "./map-authoring-governed-catalogs.js";
import {
  MapAuthoringInputPackageSchema,
  type MapAuthoringInputPackage,
  type MapAuthoringPolicyDescriptor,
} from "./map-authoring-input-package.schema.js";
import type { MapAuthoringRequest } from "./map-authoring-request.schema.js";
import { buildCapabilityGroupsFromCatalog } from "./map-authoring-capability-catalog.js";
import {
  buildMapAuthoringOutputSchemaDescriptor,
  buildMapPackageSchemaDescriptor,
  buildOutputSchemaCatalog,
  buildPromptContractCatalog,
} from "./map-authoring-prompt-output-catalog.js";

export const MAP_AUTHORING_INPUT_PACKAGE_VERSION = "map-authoring-input-package.v1";

const staticHash = (value: unknown): string => {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
};

const buildPolicyDescriptor = (
  policyRef: string,
  summary: string,
  rules: string[],
): MapAuthoringPolicyDescriptor => ({ policyRef, summary, rules });

const resolveSelectedBinaryOutcome = (
  options: MapAuthoringRequest["productPositiveOutcomeOptions"],
  selectedOptionId: string,
) => {
  const selected = options.find((option) => option.optionId === selectedOptionId);
  if (!selected) {
    throw new Error(`Map authoring binary outcome option not found: ${selectedOptionId}`);
  }
  return selected;
};

const buildBinaryOutcomePolicy = (request: MapAuthoringRequest) => {
  const positive = resolveSelectedBinaryOutcome(
    request.productPositiveOutcomeOptions,
    request.selectedProductPositiveOutcomeId,
  );
  const negative = resolveSelectedBinaryOutcome(
    request.productNegativeOutcomeOptions,
    request.selectedProductNegativeOutcomeId,
  );
  return {
    positiveDecision: "product_yes" as const,
    negativeDecision: "product_no" as const,
    positiveOutcomeOptions: request.productPositiveOutcomeOptions,
    negativeOutcomeOptions: request.productNegativeOutcomeOptions,
    selectedPositiveOutcomeId: positive.optionId,
    selectedNegativeOutcomeId: negative.optionId,
    selectedPositiveRouteLabel: positive.routeLabel,
    selectedNegativeRouteLabel: negative.routeLabel,
    defaultedBySystem: true,
  };
};

const buildUserRequirement = (request: MapAuthoringRequest) => ({
  goal: request.objective,
  targetPlatform: request.targetPlatform,
  allowedAutomationScope: request.allowedAutomationScope,
  mustAskBefore: request.mustAskBefore,
  failureHandlingPreference: request.failureHandlingPreference,
  evidencePreference: request.evidencePreference,
  binaryOutcomePolicy: buildBinaryOutcomePolicy(request),
  runLimit: request.runLimit,
  operatorNotes: request.operatorNotes,
  outputLanguage: request.outputLanguage,
});

const buildPlatformProfile = (request: MapAuthoringRequest): MapAuthoringInputPackage["targetPlatformProfile"] => ({
  platformProfileRef: `${request.targetPlatform}:map-authoring-profile:v1`,
  targetPlatformId: request.targetPlatform,
  loginAuthExpectations: ["reuse_persistent_local_profile", "pause_on_login_or_auth_wall"],
  prohibitedOperations: ["bypass_captcha", "ignore_security_check", "activate_draft_map"],
  supportedTargets: ["browser-page", "browser-viewport", "browser-input", "runtime-proof"],
  rateLimit: { maxActionsPerMinute: 20, burstLimit: 5, refillPolicy: "token-bucket" },
  safetyPauseConditions: ["captcha_detected", "security_check_detected", "unexpected_auth_wall"],
  securityCheckBehavior: ["automated_block_on_security_check", "do_not_continue_autonomously"],
  automationGateRules: ["high_side_effect_requires_route_plan_gate", "unsupported_high_risk_action_fails_closed"],
});

const buildRequirementFingerprint = (request: MapAuthoringRequest) => ({
  missionId: request.missionId,
  objective: request.objective,
  targetPlatform: request.targetPlatform,
  allowedAutomationScope: request.allowedAutomationScope,
  mustAskBefore: request.mustAskBefore,
  failureHandlingPreference: request.failureHandlingPreference,
  evidencePreference: request.evidencePreference,
  productPositiveOutcomeOptions: request.productPositiveOutcomeOptions,
  productNegativeOutcomeOptions: request.productNegativeOutcomeOptions,
  selectedProductPositiveOutcomeId: request.selectedProductPositiveOutcomeId,
  selectedProductNegativeOutcomeId: request.selectedProductNegativeOutcomeId,
  runLimit: request.runLimit,
  operatorNotes: request.operatorNotes,
  outputLanguage: request.outputLanguage,
});

type BuildMapAuthoringInputPackageOptions = {
  generatedAt?: string;
  requesterRef?: string;
};

const buildMapAuthoringPolicies = () => ({
  safetyPolicy: buildPolicyDescriptor("policy://map-authoring/safety/v1", "Declares the no-code and automated-gated safety baseline for map authoring.", ["no_code_generation", "no_runtime_activation", "automated_gate_high_risk_operations"]),
  automationGatePolicy: buildPolicyDescriptor("policy://map-authoring/automation-gate/v1", "Declares operations that require Route Plan-owned automated gates or fail-closed blocking.", ["send_message_requires_route_plan_gate", "submit_requires_route_plan_gate", "purchase_requires_route_plan_gate", "unsupported_high_risk_action_fails_closed"]),
  evidencePolicy: buildPolicyDescriptor("policy://map-authoring/evidence/v1", "Requires evidence refs and retention rules instead of raw content.", ["evidence_refs_only", "screenshot_retention_required", "record_evidence_packet_ref"]),
  pavPolicy: buildPolicyDescriptor("policy://map-authoring/post-click-observation/v1", "Treats post-click observation as a non-blocking quality signal; AI remains the only semantic judge.", ["post_click_observation_is_quality_signal", "mouse_click_success_is_primitive_execution_only", "text_input_success_is_primitive_execution_only"]),
  forensicsPolicy: buildPolicyDescriptor("policy://map-authoring/forensics/v1", "Forensics stores refs and hashes, not raw secrets or prompt bodies.", ["store_refs_and_hashes_only", "record_prompt_contract_refs", "record_activation_hashes"]),
  privacyPolicy: buildPolicyDescriptor("policy://map-authoring/privacy/v1", "Sensitive content must be redacted before proof persistence.", ["redact_sensitive_text", "no_raw_clipboard_text", "no_raw_prompt_body"]),
  secretPolicy: buildPolicyDescriptor("policy://map-authoring/secret/v1", "Secrets and credentials must never enter the map package, prompt, or proof payload.", ["no_api_keys_in_map", "no_cookies_in_map", "no_credentials_in_proof"]),
  rateLimitPolicy: buildPolicyDescriptor("policy://map-authoring/rate-limit/v1", "Bulk or repeated operations must respect platform rate limits and automated gates.", ["bulk_actions_require_route_plan_gate", "respect_platform_rate_limit", "pause_on_limit_exceeded"]),
});

const buildMapAuthoringExamples = () => ({
  exampleMaps: [],
  exampleMapsVersion: "map-authoring-example-maps.v1",
  exampleMapsSourceRef: "catalog://map-authoring/example-maps/empty-governed-v1",
});

const buildValidationPolicy = () => ({
  policyRef: "policy://map-authoring/validation/v1",
  blockedOnMissingInputs: true,
  blockedOnUnknownCatalogRefs: true,
  blockedOnPolicyDrift: true,
  draftOnlyStatuses: ["draft", "needs_clarification", "needs_capability_expansion"],
});

export function buildMapAuthoringInputPackage(
  request: MapAuthoringRequest,
  options: BuildMapAuthoringInputPackageOptions = {},
): MapAuthoringInputPackage {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const sourceRequirementHash = `sha256:${staticHash(buildRequirementFingerprint(request))}`;
  const targetPlatformProfile = buildPlatformProfile(request);
  const stableSuffix = staticHash({ sourceRequirementHash, generatedAt }).slice(0, 12);
  const capabilityCatalog = buildCapabilityCatalog();
  const promptContractEntries = listMapAuthoringGovernedPromptContracts();

  return MapAuthoringInputPackageSchema.parse({
    inputPackageId: `map-authoring-input:${request.missionId}:${stableSuffix}`,
    inputPackageVersion: MAP_AUTHORING_INPUT_PACKAGE_VERSION,
    generatedAt,
    requesterRef: options.requesterRef ?? `commander-console:${request.missionId}`,
    userRequirement: buildUserRequirement(request),
    userRequirementRef: `user-requirement:${request.missionId}:${stableSuffix}`,
    sourceRequirementHash,
    targetPlatformProfileRef: targetPlatformProfile.platformProfileRef,
    targetPlatformProfile,
    capabilityCatalog: buildCapabilityGroupsFromCatalog(capabilityCatalog, generatedAt),
    promptContractCatalog: buildPromptContractCatalog(promptContractEntries),
    outputSchemaCatalog: buildOutputSchemaCatalog(promptContractEntries),
    mapPackageSchema: buildMapPackageSchemaDescriptor(),
    mapAuthoringOutputSchema: buildMapAuthoringOutputSchemaDescriptor(),
    ...buildMapAuthoringPolicies(),
    ...buildMapAuthoringExamples(),
    validationPolicy: buildValidationPolicy(),
    expectedDraftStatus: "draft",
  });
}
