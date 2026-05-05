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

const buildUserRequirement = (request: MapAuthoringRequest) => ({
  goal: request.objective,
  targetPlatform: request.targetPlatform,
  allowedAutomationScope: request.allowedAutomationScope,
  mustAskBefore: request.mustAskBefore,
  failureHandlingPreference: request.failureHandlingPreference,
  evidencePreference: request.evidencePreference,
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
  securityCheckBehavior: ["pause_and_require_review", "do_not_continue_autonomously"],
  humanReviewRules: ["high_side_effect_requires_review", "draft_activation_requires_review"],
});

const buildRequirementFingerprint = (request: MapAuthoringRequest) => ({
  missionId: request.missionId,
  objective: request.objective,
  targetPlatform: request.targetPlatform,
  allowedAutomationScope: request.allowedAutomationScope,
  mustAskBefore: request.mustAskBefore,
  failureHandlingPreference: request.failureHandlingPreference,
  evidencePreference: request.evidencePreference,
  runLimit: request.runLimit,
  operatorNotes: request.operatorNotes,
  outputLanguage: request.outputLanguage,
});

type BuildMapAuthoringInputPackageOptions = {
  generatedAt?: string;
  requesterRef?: string;
};

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
    safetyPolicy: buildPolicyDescriptor("policy://map-authoring/safety/v1", "Declares the no-code and review-gated safety baseline for map authoring.", ["no_code_generation", "no_runtime_activation", "review_high_risk_operations"]),
    humanApprovalPolicy: buildPolicyDescriptor("policy://map-authoring/human-approval/v1", "Declares operations that require explicit human approval.", ["send_message_requires_approval", "submit_requires_approval", "purchase_requires_approval", "activate_ai_generated_map_requires_approval"]),
    evidencePolicy: buildPolicyDescriptor("policy://map-authoring/evidence/v1", "Requires evidence refs and retention rules instead of raw content.", ["evidence_refs_only", "screenshot_retention_required", "record_evidence_packet_ref"]),
    pavPolicy: buildPolicyDescriptor("policy://map-authoring/pav/v1", "Requires action steps to hand off to post-action verification when mandated by catalogs.", ["action_steps_require_pav_when_catalog_says_so", "mouse_click_requires_pav", "text_input_requires_pav"]),
    forensicsPolicy: buildPolicyDescriptor("policy://map-authoring/forensics/v1", "Forensics stores refs and hashes, not raw secrets or prompt bodies.", ["store_refs_and_hashes_only", "record_prompt_contract_refs", "record_activation_hashes"]),
    privacyPolicy: buildPolicyDescriptor("policy://map-authoring/privacy/v1", "Sensitive content must be redacted before proof persistence.", ["redact_sensitive_text", "no_raw_clipboard_text", "no_raw_prompt_body"]),
    secretPolicy: buildPolicyDescriptor("policy://map-authoring/secret/v1", "Secrets and credentials must never enter the map package, prompt, or proof payload.", ["no_api_keys_in_map", "no_cookies_in_map", "no_credentials_in_proof"]),
    rateLimitPolicy: buildPolicyDescriptor("policy://map-authoring/rate-limit/v1", "Bulk or repeated operations must respect platform rate limits and review gates.", ["bulk_actions_require_review", "respect_platform_rate_limit", "pause_on_limit_exceeded"]),
    exampleMaps: [],
    exampleMapsVersion: "map-authoring-example-maps.v1",
    exampleMapsSourceRef: "catalog://map-authoring/example-maps/empty-governed-v1",
    validationPolicy: {
      policyRef: "policy://map-authoring/validation/v1",
      blockedOnMissingInputs: true,
      blockedOnUnknownCatalogRefs: true,
      blockedOnPolicyDrift: true,
      draftOnlyStatuses: ["draft", "needs_clarification", "needs_capability_expansion"],
    },
    expectedDraftStatus: "draft",
  });
}
