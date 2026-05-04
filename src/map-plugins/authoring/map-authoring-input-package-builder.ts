import { createHash } from "node:crypto";

import { z } from "zod";

import {
  listPromptContractCatalogEntries,
  PROMPT_CONTRACT_CATALOG_VERSION,
  type PromptContractCatalogEntry,
} from "../../capabilities/ai/prompt-contracts/index.js";
import {
  AiCommentSignalSummaryOutputSchema,
  AiEvidencePacketAnalysisOutputSchema,
  AiMapAuthoringOutputSchema,
  AiOcrCleanupOutputSchema,
  AiProductSignalSummaryOutputSchema,
  AiSchemaValidationOnlyOutputSchema,
  AiVisualOutputSchema,
} from "../../capabilities/ai/schema.js";
import { buildCapabilityCatalog, CAPABILITY_CATALOG_VERSION } from "./capability-catalog/index.js";
import { humanize } from "./capability-catalog/policies.js";
import {
  MAP_AUTHORING_OUTPUT_FORMAT_VERSION,
  MAP_AUTHORING_SCHEMA_VERSION,
} from "./map-authoring-contract.js";
import {
  type MapAuthoringCapabilityChild,
  type MapAuthoringCapabilityGroup,
  MapAuthoringInputPackageSchema,
  type MapAuthoringInputPackage,
  type MapAuthoringOutputSchemaCatalogEntry,
  type MapAuthoringPolicyDescriptor,
} from "./map-authoring-input-package.schema.js";
import type { MapAuthoringRequest } from "./map-authoring-request.schema.js";

const MAP_AUTHORING_INPUT_PACKAGE_VERSION = "map-authoring-input-package.v1";
const MAP_AUTHORING_OUTPUT_SCHEMA_CATALOG_VERSION = "map-authoring-output-schema-catalog.v1";
const MAP_AUTHORING_ALLOWED_AUTOMATION_SCOPE = "generate_governed_draft_map_only";

type OutputSchemaDescriptor = {
  schemaVersion: string;
  schema: z.ZodObject<z.ZodRawShape>;
};

const OUTPUT_SCHEMA_BY_TASK_TYPE: Record<string, OutputSchemaDescriptor> = {
  product_presence_judgment: { schemaVersion: "ai.product_presence_judgment.v1", schema: AiVisualOutputSchema },
  ocr_cleanup: { schemaVersion: "ai.ocr_cleanup.v1", schema: AiOcrCleanupOutputSchema },
  comment_signal_summary: { schemaVersion: "ai.comment_signal_summary.v1", schema: AiCommentSignalSummaryOutputSchema },
  product_signal_summary: { schemaVersion: "ai.product_signal_summary.v1", schema: AiProductSignalSummaryOutputSchema },
  evidence_packet_analysis: { schemaVersion: "ai.evidence_packet_analysis.v1", schema: AiEvidencePacketAnalysisOutputSchema },
  map_authoring: { schemaVersion: MAP_AUTHORING_OUTPUT_FORMAT_VERSION, schema: AiMapAuthoringOutputSchema },
  schema_validation_only: { schemaVersion: "ai.schema_validation_only.v1", schema: AiSchemaValidationOnlyOutputSchema },
};

const staticHash = (value: unknown): string =>
  createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");

const unwrapSchema = (schema: z.ZodTypeAny): z.ZodTypeAny => {
  if (schema instanceof z.ZodDefault || schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return unwrapSchema(schema._def.innerType);
  }
  return schema;
};

const describeFieldType = (schema: z.ZodTypeAny): string => {
  const resolved = unwrapSchema(schema);
  if (resolved instanceof z.ZodString) {
    return "string";
  }
  if (resolved instanceof z.ZodNumber) {
    return "number";
  }
  if (resolved instanceof z.ZodBoolean) {
    return "boolean";
  }
  if (resolved instanceof z.ZodArray) {
    return `array<${describeFieldType(resolved.element)}>`;
  }
  if (resolved instanceof z.ZodEnum) {
    return `enum<${resolved.options.join("|")}>`;
  }
  if (resolved instanceof z.ZodObject) {
    return "object";
  }
  return resolved._def.typeName.replace("Zod", "").toLowerCase();
};

const isRequiredField = (schema: z.ZodTypeAny): boolean =>
  !(schema instanceof z.ZodDefault || schema instanceof z.ZodOptional);

const buildPolicyDescriptor = (
  policyRef: string,
  summary: string,
  rules: string[],
): MapAuthoringPolicyDescriptor => ({ policyRef, summary, rules });

const buildUserRequirement = (request: MapAuthoringRequest) => ({
  goal: request.objective,
  targetPlatform: request.targetPlatform,
  allowedAutomationScope: MAP_AUTHORING_ALLOWED_AUTOMATION_SCOPE,
  mustAskBefore: [
    "send message",
    "submit form",
    "purchase or payment",
    "delete content",
    "commit text input",
    "activate ai-generated map",
  ],
  failureHandlingPreference: "review_required",
  evidencePreference: "retain_refs_only",
  runLimit: { maxRounds: 3, maxMinutes: 20 },
  operatorNotes: request.operatorNotes,
  outputLanguage: request.outputLanguage,
});

const buildProducedOutputRefs = (abilityGroupId: string): string[] => {
  switch (abilityGroupId) {
    case "ai":
      return ["aiResultRef", "aiProofRef"];
    case "visual-target":
      return ["visualTargetRef", "targetProofRef"];
    case "screenshot":
      return ["screenshotRef", "captureProofRef"];
    case "geometry-guard":
      return ["geometryProofRef"];
    case "mouse-click":
      return ["actionResultRef", "postActionVerificationRef"];
    case "text-input":
      return ["textInputResultRef", "postActionVerificationRef"];
    case "mouse-scroll":
      return ["scrollResultRef", "postScrollVerificationRef"];
    case "open":
      return ["pageOpenRef", "navigationProofRef"];
    case "page-state":
      return ["pageStateRef"];
    case "post-action-verification":
      return ["postActionVerificationRef"];
    case "forensics-persistence":
      return ["forensicsRecordRef"];
    default:
      return ["runtimeProofRef"];
  }
};

const buildRequiredInputRefs = (abilityGroupId: string): string[] => {
  switch (abilityGroupId) {
    case "ai":
      return ["promptInputRef"];
    case "visual-target":
      return ["sourceImageRef"];
    case "screenshot":
      return ["captureTargetRef"];
    case "geometry-guard":
      return ["candidateGeometryRef"];
    case "mouse-click":
      return ["geometryProofRef", "targetProofRef"];
    case "text-input":
      return ["approvedTextRef", "targetProofRef", "focusProofRef"];
    case "mouse-scroll":
      return ["scrollAnchorRef"];
    case "open":
      return ["targetUrlRef"];
    case "page-state":
      return ["pageRef"];
    case "post-action-verification":
      return ["preActionEvidenceRef", "postActionEvidenceRef"];
    case "forensics-persistence":
      return ["proofRef"];
    default:
      return [];
  }
};

const buildAllowedStepKinds = (abilityGroupId: string): string[] => {
  switch (abilityGroupId) {
    case "ai":
      return ["ai"];
    case "open":
    case "mouse-click":
    case "mouse-scroll":
    case "text-input":
      return ["action"];
    case "forensics-persistence":
      return ["evidence"];
    default:
      return ["observation", "verification"];
  }
};

const buildSideEffectLevel = (
  abilityGroupId: string,
  childCapabilityId: string,
): MapAuthoringCapabilityChild["sideEffectLevel"] => {
  if (abilityGroupId === "forensics-persistence") {
    return "write";
  }
  if (abilityGroupId === "mouse-click") {
    return "write";
  }
  if (abilityGroupId === "text-input") {
    return childCapabilityId.includes("commit") || childCapabilityId.includes("press-key") ? "submit" : "write";
  }
  return "read";
};

const buildFailureModes = (abilityGroupId: string): string[] => {
  switch (abilityGroupId) {
    case "ai":
      return ["schema_validation_failed", "provider_blocked", "low_confidence_review"];
    case "mouse-click":
    case "text-input":
    case "mouse-scroll":
      return ["target_not_ready", "post_action_verification_failed", "timeout"];
    case "open":
      return ["navigation_failed", "unsafe_target_blocked", "timeout"];
    default:
      return ["precondition_failed", "timeout", "review_required"];
  }
};

const buildProofRequirements = (abilityGroupId: string, childCapabilityId: string): string[] => {
  const requirements = ["runtimeProofRef"];
  if (["mouse-click", "mouse-scroll", "text-input", "geometry-guard"].includes(abilityGroupId)) {
    requirements.push("geometryProofRef");
  }
  if (["mouse-click", "text-input"].includes(abilityGroupId)) {
    requirements.push("targetProofRef");
  }
  if (abilityGroupId === "text-input") {
    requirements.push("focusProofRef", "approvedTextRef");
  }
  if (abilityGroupId === "ai") {
    requirements.push("promptContractId", "outputSchemaRef", "aiProofRef");
  }
  if (abilityGroupId === "screenshot") {
    requirements.push("captureProofRef");
  }
  if (abilityGroupId === "forensics-persistence") {
    requirements.push("evidencePacketRef");
  }
  if (abilityGroupId === "mouse-scroll" && childCapabilityId.includes("region")) {
    requirements.push("scrollRegionRef");
  }
  return requirements;
};

const buildCapabilityChild = (
  entry: ReturnType<typeof buildCapabilityCatalog>["entries"][number],
): MapAuthoringCapabilityChild => {
  const sideEffectLevel = buildSideEffectLevel(entry.abilityGroupId, entry.childCapabilityId);
  return {
    childCapabilityId: entry.childCapabilityId,
    childCapabilityCode: entry.childCapabilityId,
    displayName: humanize(entry.childCapabilityId),
    description: entry.description,
    inputSchemaRef: entry.inputSchemaRef,
    outputSchemaRef: entry.outputSchemaRef,
    requiredInputRefs: buildRequiredInputRefs(entry.abilityGroupId),
    producedOutputRefs: buildProducedOutputRefs(entry.abilityGroupId),
    requiresGeometryProof: entry.requiresGeometryProof,
    requiresTargetProof: entry.abilityGroupId === "mouse-click" || entry.abilityGroupId === "text-input",
    requiresFocusProof: entry.abilityGroupId === "text-input",
    requiresApprovedText: entry.abilityGroupId === "text-input",
    requiresPostActionVerification: entry.requiresPostActionVerification,
    requiresHumanReview: entry.requiresReviewGate || ["submit", "delete", "purchase"].includes(sideEffectLevel),
    sensitiveOperation: entry.sensitiveOperation,
    sideEffectLevel,
    allowedStepKinds: buildAllowedStepKinds(entry.abilityGroupId),
    supportedTargetKinds: entry.supportedTargets,
    forbiddenResponsibilities: entry.forbiddenResponsibilities.length > 0 ? entry.forbiddenResponsibilities : ["unspecified"],
    proofRequirements: buildProofRequirements(entry.abilityGroupId, entry.childCapabilityId),
    failureModes: buildFailureModes(entry.abilityGroupId),
  };
};

const buildCapabilityGroups = (generatedAt: string): MapAuthoringInputPackage["capabilityCatalog"] => {
  const grouped = new Map<string, MapAuthoringCapabilityChild[]>();
  for (const entry of buildCapabilityCatalog().entries.filter((item) => item.routableByMap)) {
    const children = grouped.get(entry.abilityGroupId) ?? [];
    children.push(buildCapabilityChild(entry));
    grouped.set(entry.abilityGroupId, children);
  }

  const abilityGroups: MapAuthoringCapabilityGroup[] = [...grouped.entries()].map(([abilityGroupId, children]) => ({
    abilityGroupId,
    abilityGroupCode: abilityGroupId,
    displayName: humanize(abilityGroupId),
    description: `${humanize(abilityGroupId)} governed capability group for map authoring and validation.`,
    ownerDomain: abilityGroupId,
    routableByMap: true,
    publicContractRef: `contract://${abilityGroupId}/public/v1`,
    inputSchemaRef: `${abilityGroupId}.group.input`,
    outputSchemaRef: `${abilityGroupId}.group.output`,
    forbiddenResponsibilities: [...new Set(children.flatMap((child) => child.forbiddenResponsibilities))],
    children,
  }));

  return {
    version: CAPABILITY_CATALOG_VERSION,
    generatedAt,
    generatedFrom: "src/map-plugins/authoring/map-authoring-input-package-builder.ts",
    abilityGroups,
  };
};

const buildPromptContractCatalog = (): MapAuthoringInputPackage["promptContractCatalog"] => ({
  version: PROMPT_CONTRACT_CATALOG_VERSION,
  entries: listPromptContractCatalogEntries().map((entry) => ({
    promptContractId: entry.promptContractId,
    promptContractVersion: entry.promptVersion,
    promptHash: entry.promptHash,
    displayName: entry.promptContractId,
    description: entry.purpose,
    inputSchemaRef: entry.inputContract,
    outputSchemaRef: entry.outputSchemaRef,
    allowedInputRefs: entry.requiredInputRefs,
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
    reviewPolicy: buildPolicyDescriptor(
      `policy://prompt-contract/${entry.promptContractId}/review`,
      "Declares when review is required.",
      entry.reviewPolicy.requiredWhen,
    ),
    failurePolicy: buildPolicyDescriptor(
      `policy://prompt-contract/${entry.promptContractId}/failure`,
      "Declares how prompt execution failures are handled.",
      Object.entries(entry.failurePolicy).map(([key, value]) => `${key}:${value}`),
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
    forbiddenOutputs: entry.forbiddenOutputs,
    branchableOutputFields: entry.allowedBranchFields,
  })),
});

const buildFieldTypes = (schema: z.ZodObject<z.ZodRawShape>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(schema.shape).map(([fieldName, fieldSchema]) => [fieldName, describeFieldType(fieldSchema)]),
  );

const buildOutputSchemaCatalogEntry = (
  entry: PromptContractCatalogEntry,
): MapAuthoringOutputSchemaCatalogEntry | null => {
  const descriptor = OUTPUT_SCHEMA_BY_TASK_TYPE[entry.taskType];
  if (!descriptor) {
    return null;
  }

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
    forbiddenFields: ["rawPrompt", "systemPrompt", "userPrompt", "approvalStatus", "activationSnapshotRef"],
    exampleOutput: null,
  };
};

const buildOutputSchemaCatalog = (): MapAuthoringInputPackage["outputSchemaCatalog"] => {
  const entries = new Map<string, MapAuthoringOutputSchemaCatalogEntry>();
  for (const promptContract of listPromptContractCatalogEntries()) {
    const outputSchemaEntry = buildOutputSchemaCatalogEntry(promptContract);
    if (outputSchemaEntry) {
      entries.set(outputSchemaEntry.outputSchemaRef, outputSchemaEntry);
    }
  }

  return {
    version: MAP_AUTHORING_OUTPUT_SCHEMA_CATALOG_VERSION,
    entries: [...entries.values()],
  };
};

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

const buildMapPackageSchemaDescriptor = (): MapAuthoringInputPackage["mapPackageSchema"] => ({
  schemaRef: "map-plugin-package.schema.v1",
  schemaVersion: MAP_AUTHORING_SCHEMA_VERSION,
  requiredSections: ["manifest", "taskTemplate", "operationalMap", "dependencies", "compatibility", "policy", "promptBindings", "changelog", "signature"],
  requiredManifestFields: ["packageId", "packageKind", "packageVersion", "mapId", "taskTemplateId", "approvalStatus", "aiGenerated"],
  requiredStepFields: ["stepId", "childCapabilityId", "stepKind", "targetAbilityGroupId", "inputRefs", "outputRefPolicy", "timeoutPolicy", "proofPolicy"],
  draftOnlyFields: ["approvalStatus=draft", "availabilityPolicy=draft", "validationReportRef=null", "humanApprovalRef=null"],
  activationFields: ["validationReportRef", "humanApprovalRef", "activationProofRef", "activationSnapshotRef", "mapPackageHash", "operationalMapHash"],
  forbiddenFields: ["rawPrompt", "systemPrompt", "userPrompt", "functionBody", "eval", "directAbilityCall"],
});

const buildMapAuthoringOutputSchemaDescriptor = (): MapAuthoringInputPackage["mapAuthoringOutputSchema"] => ({
  schemaRef: MAP_AUTHORING_OUTPUT_FORMAT_VERSION,
  schemaVersion: MAP_AUTHORING_OUTPUT_FORMAT_VERSION,
  requiredTopLevelFields: Object.keys(AiMapAuthoringOutputSchema.shape),
  draftStatusValues: ["draft_ready", "needs_clarification"],
  forbiddenFields: ["approvalStatus", "validationReportRef", "humanApprovalRef", "activationSnapshotRef", "rawPrompt", "systemPrompt", "userPrompt"],
});

const buildRequirementFingerprint = (request: MapAuthoringRequest) => ({
  missionId: request.missionId,
  objective: request.objective,
  targetPlatform: request.targetPlatform,
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
    capabilityCatalog: buildCapabilityGroups(generatedAt),
    promptContractCatalog: buildPromptContractCatalog(),
    outputSchemaCatalog: buildOutputSchemaCatalog(),
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

export { MAP_AUTHORING_INPUT_PACKAGE_VERSION, MAP_AUTHORING_OUTPUT_SCHEMA_CATALOG_VERSION };