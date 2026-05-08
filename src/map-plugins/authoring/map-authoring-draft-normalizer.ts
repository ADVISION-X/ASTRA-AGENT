import { createHash } from "node:crypto";

import { MapPackageSchema } from "../schema/map-plugin-package.schema.js";
import type { MapPackage } from "../shared/map-package-types.js";
import type { MapAuthoringInputPackage } from "./map-authoring-input-package.schema.js";
import type { MapAuthoringRequest } from "./map-authoring-request.schema.js";
import {
  MAP_AUTHORING_AUTHOR,
  MAP_AUTHORING_MIN_GRASSEYE_VERSION,
  MAP_AUTHORING_OUTPUT_FORMAT_VERSION,
  MAP_AUTHORING_PACKAGE_VERSION,
  MAP_AUTHORING_SCHEMA_VERSION,
  MAP_AUTHORING_SECURITY_POLICY_REF,
} from "./map-authoring-contract.js";
import {
  MapAuthoringAiOutputSchema,
  type MapAuthoringAiOutput,
} from "./map-authoring-ai-output.schema.js";
import {
  type MapAuthoringChain,
} from "./map-authoring-proof-chain.js";
import { buildCanonicalAuthoringChainForDraft } from "./map-authoring-draft-chain.js";

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
    : Array.from(
      new Set(output.draftPackage.steps.flatMap((step) => step.targetAbilityGroupId ? [step.targetAbilityGroupId] : [])),
    );
}

function resolveRequiredPlatformProfiles(output: MapAuthoringAiOutput, targetPlatform: MapAuthoringRequest["targetPlatform"]): string[] {
  return output.draftPackage.dependencies.requiredPlatformProfiles.length > 0
    ? output.draftPackage.dependencies.requiredPlatformProfiles
    : [buildPlatformProfileRef(targetPlatform)];
}

function buildDraftIdentity(request: MapAuthoringRequest, output: MapAuthoringAiOutput) {
  const nameSlug = slugify(output.draftPackage.displayName);
  const suffix = buildStableSuffix(request, output.draftPackage.displayName);
  return {
    nameSlug,
    packageId: `ai.${request.targetPlatform}.${nameSlug}.${suffix}`,
    taskTemplateId: `${request.targetPlatform}-${nameSlug}-${suffix}`,
    mapId: `${request.targetPlatform}.${nameSlug}.${suffix}.v1`,
    platformProfileRef: buildPlatformProfileRef(request.targetPlatform),
    createdAt: new Date().toISOString(),
  };
}

function buildDraftManifest(input: {
  output: MapAuthoringAiOutput;
  promptContractId: string;
  modelProvider: string;
  modelName: string;
  sessionId: string;
  identity: ReturnType<typeof buildDraftIdentity>;
  authoringChain: MapAuthoringChain;
}) {
  return {
    packageId: input.identity.packageId,
    packageKind: "operational-map-package",
    packageVersion: MAP_AUTHORING_PACKAGE_VERSION,
    mapId: input.identity.mapId,
    taskTemplateId: input.identity.taskTemplateId,
    displayName: input.output.draftPackage.displayName,
    author: MAP_AUTHORING_AUTHOR,
    createdAt: input.identity.createdAt,
    minimumGrassEyeVersion: MAP_AUTHORING_MIN_GRASSEYE_VERSION,
    mapSchemaVersion: MAP_AUTHORING_SCHEMA_VERSION,
    activationGateStatus: "draft",
    aiGenerated: true,
    authoringPromptRef: `prompt://map-authoring/${input.sessionId}/${input.promptContractId}`,
    authoringModelRef: `model://${input.modelProvider}/${slugify(input.modelName)}`,
    authoringRunId: input.authoringChain.authoringRunId,
    userRequirementRef: input.authoringChain.userRequirementRef,
    sourceRequirementHash: input.authoringChain.sourceRequirementHash,
    providerPolicyRef: input.authoringChain.providerPolicyRef,
    promptContractId: input.authoringChain.promptContractId,
    promptContractVersion: input.authoringChain.promptContractVersion,
    promptHash: input.authoringChain.promptHash,
    capabilityCatalogVersion: input.authoringChain.capabilityCatalogVersion,
    promptCatalogVersion: input.authoringChain.promptCatalogVersion,
    mapPackageSchemaVersion: input.authoringChain.mapPackageSchemaVersion,
    securityPolicyRef: input.authoringChain.securityPolicyRef,
    outputFormatVersion: input.authoringChain.outputFormatVersion,
    generatedAt: input.authoringChain.generatedAt,
    authoringProofRef: input.authoringChain.authoringProofRef,
    validationReportRef: null,
    automationGateRef: null,
  };
}

function buildDraftTaskTemplate(input: {
  request: MapAuthoringRequest;
  output: MapAuthoringAiOutput;
  identity: ReturnType<typeof buildDraftIdentity>;
}) {
  return {
    taskTemplateId: input.identity.taskTemplateId,
    displayName: input.output.draftPackage.displayName,
    description: input.output.draftPackage.description,
    recommended: input.output.draftPackage.recommended,
    taskCategory: input.output.draftPackage.taskCategory,
    version: MAP_AUTHORING_PACKAGE_VERSION,
    safetyLevel: input.output.draftPackage.safetyLevel,
    userVisibleCapabilities: input.output.draftPackage.userVisibleCapabilities,
    availabilityPolicy: "draft",
    requestedPlatformId: input.request.targetPlatform,
    platformProfileRef: input.identity.platformProfileRef,
    targetProfileRef: input.identity.platformProfileRef,
    defaultHumanGoal: input.output.draftPackage.defaultHumanGoal,
  };
}

function buildDraftOperationalMap(input: {
  output: MapAuthoringAiOutput;
  identity: ReturnType<typeof buildDraftIdentity>;
}) {
  return {
    mapId: input.identity.mapId,
    displayName: input.output.draftPackage.displayName,
    humanGoal: input.output.draftPackage.humanGoal,
    initialStepId: input.output.draftPackage.initialStepId,
    steps: input.output.draftPackage.steps,
    transitions: input.output.draftPackage.transitions,
    finalStates: input.output.draftPackage.finalStates,
    forbiddenDirectCalls: input.output.draftPackage.forbiddenDirectCalls,
    mapVersion: MAP_AUTHORING_PACKAGE_VERSION,
  };
}

function buildDraftDependencyPolicy(input: {
  request: MapAuthoringRequest;
  output: MapAuthoringAiOutput;
}) {
  const requiredCapabilities = resolveRequiredCapabilities(input.output);
  const requiredPlatformProfiles = resolveRequiredPlatformProfiles(input.output, input.request.targetPlatform);
  return {
    dependencies: {
      ...input.output.draftPackage.dependencies,
      requiredCapabilities,
      requiredPlatformProfiles,
    },
    compatibility: {
      requiresGrassEye: MAP_AUTHORING_MIN_GRASSEYE_VERSION,
      requiresMapSchema: MAP_AUTHORING_SCHEMA_VERSION,
      requiresCapabilityRegistry: requiredCapabilities,
      requiresPromptRegistry: input.output.draftPackage.dependencies.requiredPromptContracts,
      requiresPlatformProfileRegistry: requiredPlatformProfiles,
    },
  };
}

function buildMapPackagePayload(input: {
  request: MapAuthoringRequest;
  output: MapAuthoringAiOutput;
  promptContractId: string;
  promptVersion: string;
  modelProvider: string;
  modelName: string;
  runtime: string;
  sessionId: string;
  identity: ReturnType<typeof buildDraftIdentity>;
  authoringChain: MapAuthoringChain;
}) {
  const dependencyPolicy = buildDraftDependencyPolicy(input);
  return {
    manifest: buildDraftManifest(input),
    taskTemplate: buildDraftTaskTemplate(input),
    operationalMap: buildDraftOperationalMap(input),
    dependencies: dependencyPolicy.dependencies,
    compatibility: dependencyPolicy.compatibility,
    promptBindings: input.output.draftPackage.promptBindings,
    changelog: `${input.output.humanReadableExplanation}\n\nGenerated by ${input.runtime}:${input.modelName} using ${input.promptVersion}.`,
    signature: null,
  };
}

function buildNormalizedAuthoringDraftResult(input: {
  output: MapAuthoringAiOutput;
  mapPackage: MapPackage;
  authoringChain: MapAuthoringChain;
}) {
  return {
    mapPackage: input.mapPackage,
    humanReadableExplanation: input.output.humanReadableExplanation,
    requiredClarifications: input.output.requiredClarifications,
    riskWarnings: input.output.riskWarnings,
    validationHints: input.output.validationHints,
    needsCapabilityExpansion: input.output.needsCapabilityExpansion,
    draftStatus: input.output.draftStatus,
    authoringProofRef: input.authoringChain.authoringProofRef,
  };
}

export function normalizeMapAuthoringDraft(input: {
  request: MapAuthoringRequest;
  inputPackage: MapAuthoringInputPackage;
  aiOutput: unknown;
  promptContractId: string;
  promptVersion: string;
  modelProvider: string;
  modelName: string;
  runtime: string;
  sessionId: string;
  providerPolicyRef?: string;
  securityPolicyRef?: string;
  outputFormatVersion?: string;
}): {
  mapPackage: MapPackage;
  humanReadableExplanation: string;
  requiredClarifications: string[];
  riskWarnings: string[];
  validationHints: string[];
  needsCapabilityExpansion: boolean;
  draftStatus: "draft_ready" | "needs_clarification";
  authoringProofRef: string;
} {
  const output = MapAuthoringAiOutputSchema.parse(input.aiOutput);
  const identity = buildDraftIdentity(input.request, output);
  const authoringChain = buildCanonicalAuthoringChainForDraft({ ...input, output, identity });
  const mapPackage = MapPackageSchema.parse(buildMapPackagePayload({ ...input, output, identity, authoringChain }));

  return buildNormalizedAuthoringDraftResult({ output, mapPackage, authoringChain });
}
