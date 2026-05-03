import { createHash } from "node:crypto";

import { PROMPT_CONTRACT_CATALOG_VERSION } from "../../capabilities/ai/prompt-contracts/index.js";
import { MapPackageSchema } from "../schema/map-plugin-package.schema.js";
import type { MapPackage } from "../shared/map-package-types.js";
import { CAPABILITY_CATALOG_VERSION } from "./capability-catalog/index.js";
import type { MapAuthoringRequest } from "./map-authoring-request.schema.js";
import {
  MapAuthoringAiOutputSchema,
  type MapAuthoringAiOutput,
} from "./map-authoring-ai-output.schema.js";

const MAP_AUTHORING_PACKAGE_VERSION = "1.0.0";
const MAP_AUTHORING_SCHEMA_VERSION = "1";
const MAP_AUTHORING_MIN_GRASSEYE_VERSION = "0.1.0";
const MAP_AUTHORING_AUTHOR = "GrassEye AI Draft";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 40) || "draft-map";
}

function buildStableSuffix(request: MapAuthoringRequest, displayName: string): string {
  return createHash("sha1")
    .update(`${request.missionId}:${request.targetPlatform}:${displayName}`)
    .digest("hex")
    .slice(0, 8);
}

function buildPlatformProfileRef(targetPlatform: MapAuthoringRequest["targetPlatform"]): string {
  return `${targetPlatform}:persistent-local-profile`;
}

function resolveRequiredCapabilities(output: MapAuthoringAiOutput): string[] {
  return output.draftPackage.dependencies.requiredCapabilities.length > 0
    ? output.draftPackage.dependencies.requiredCapabilities
    : [...output.draftPackage.allowedAbilityGroups];
}

function resolveRequiredPlatformProfiles(output: MapAuthoringAiOutput, targetPlatform: MapAuthoringRequest["targetPlatform"]): string[] {
  return output.draftPackage.dependencies.requiredPlatformProfiles.length > 0
    ? output.draftPackage.dependencies.requiredPlatformProfiles
    : [buildPlatformProfileRef(targetPlatform)];
}

export function normalizeMapAuthoringDraft(input: {
  request: MapAuthoringRequest;
  aiOutput: unknown;
  promptContractId: string;
  promptVersion: string;
  modelProvider: string;
  modelName: string;
  runtime: string;
  sessionId: string;
}): {
  mapPackage: MapPackage;
  humanReadableExplanation: string;
  requiredClarifications: string[];
  riskWarnings: string[];
  validationHints: string[];
  needsCapabilityExpansion: boolean;
  draftStatus: "draft_ready" | "needs_clarification";
} {
  const output = MapAuthoringAiOutputSchema.parse(input.aiOutput);
  const nameSlug = slugify(output.draftPackage.displayName);
  const suffix = buildStableSuffix(input.request, output.draftPackage.displayName);
  const packageId = `ai.${input.request.targetPlatform}.${nameSlug}.${suffix}`;
  const taskTemplateId = `${input.request.targetPlatform}-${nameSlug}-${suffix}`;
  const mapId = `${input.request.targetPlatform}.${nameSlug}.${suffix}.v1`;
  const platformProfileRef = buildPlatformProfileRef(input.request.targetPlatform);
  const createdAt = new Date().toISOString();

  const mapPackage = MapPackageSchema.parse({
    manifest: {
      packageId,
      packageKind: "operational-map-package",
      packageVersion: MAP_AUTHORING_PACKAGE_VERSION,
      mapId,
      taskTemplateId,
      displayName: output.draftPackage.displayName,
      author: MAP_AUTHORING_AUTHOR,
      createdAt,
      minimumGrassEyeVersion: MAP_AUTHORING_MIN_GRASSEYE_VERSION,
      mapSchemaVersion: MAP_AUTHORING_SCHEMA_VERSION,
      approvalStatus: "draft",
      aiGenerated: true,
      authoringPromptRef: `prompt://map-authoring/${input.sessionId}/${input.promptContractId}`,
      authoringModelRef: `model://${input.modelProvider}/${slugify(input.modelName)}`,
      capabilityCatalogVersion: CAPABILITY_CATALOG_VERSION,
      promptCatalogVersion: PROMPT_CONTRACT_CATALOG_VERSION,
      validationReportRef: null,
      humanApprovalRef: null,
    },
    taskTemplate: {
      taskTemplateId,
      displayName: output.draftPackage.displayName,
      description: output.draftPackage.description,
      recommended: output.draftPackage.recommended,
      taskCategory: output.draftPackage.taskCategory,
      version: MAP_AUTHORING_PACKAGE_VERSION,
      defaultRunLimit: output.draftPackage.defaultRunLimit,
      maxAllowedRunLimit: output.draftPackage.maxAllowedRunLimit,
      safetyLevel: output.draftPackage.safetyLevel,
      userVisibleCapabilities: output.draftPackage.userVisibleCapabilities,
      availabilityPolicy: "draft",
      requestedPlatformId: input.request.targetPlatform,
      platformProfileRef,
      targetProfileRef: platformProfileRef,
      defaultHumanGoal: output.draftPackage.defaultHumanGoal,
    },
    operationalMap: {
      mapId,
      displayName: output.draftPackage.displayName,
      humanGoal: output.draftPackage.humanGoal,
      allowedAbilityGroups: output.draftPackage.allowedAbilityGroups,
      initialStepId: output.draftPackage.initialStepId,
      steps: output.draftPackage.steps,
      transitions: output.draftPackage.transitions,
      failureBranches: output.draftPackage.failureBranches,
      reviewBranches: output.draftPackage.reviewBranches,
      finalStates: output.draftPackage.finalStates,
      forbiddenDirectCalls: output.draftPackage.forbiddenDirectCalls,
      sequencePolicy: output.draftPackage.sequencePolicy,
      mapVersion: MAP_AUTHORING_PACKAGE_VERSION,
      proofPolicy: { runtimeProof: "required", recordPackageSelection: true },
    },
    dependencies: {
      ...output.draftPackage.dependencies,
      requiredCapabilities: resolveRequiredCapabilities(output),
      requiredPlatformProfiles: resolveRequiredPlatformProfiles(output, input.request.targetPlatform),
    },
    compatibility: {
      requiresGrassEye: MAP_AUTHORING_MIN_GRASSEYE_VERSION,
      requiresMapSchema: MAP_AUTHORING_SCHEMA_VERSION,
      requiresCapabilityRegistry: resolveRequiredCapabilities(output),
      requiresPromptRegistry: output.draftPackage.dependencies.requiredPromptContracts,
      requiresPlatformProfileRegistry: resolveRequiredPlatformProfiles(output, input.request.targetPlatform),
    },
    policy: output.draftPackage.policy,
    promptBindings: output.draftPackage.promptBindings,
    changelog: `${output.humanReadableExplanation}\n\nGenerated by ${input.runtime}:${input.modelName} using ${input.promptVersion}.`,
    signature: null,
  });

  return {
    mapPackage,
    humanReadableExplanation: output.humanReadableExplanation,
    requiredClarifications: output.requiredClarifications,
    riskWarnings: output.riskWarnings,
    validationHints: output.validationHints,
    needsCapabilityExpansion: output.needsCapabilityExpansion,
    draftStatus: output.draftStatus,
  };
}
