import { createHash } from "node:crypto";

import { z } from "zod";

import { PROMPT_CONTRACT_CATALOG_VERSION } from "../../capabilities/ai/prompt-contracts/index.js";
import { CAPABILITY_CATALOG_VERSION } from "./capability-catalog/index.js";
import {
  MAP_AUTHORING_DEFAULT_PROVIDER_POLICY_REF,
  MAP_AUTHORING_OUTPUT_FORMAT_VERSION,
  MAP_AUTHORING_SCHEMA_VERSION,
  MAP_AUTHORING_SECURITY_POLICY_REF,
} from "./map-authoring-contract.js";
import type { MapAuthoringRequest } from "./map-authoring-request.schema.js";

export const MapAuthoringChainSchema = z.object({
  authoringRunId: z.string().min(1),
  userRequirementRef: z.string().min(1),
  sourceRequirementHash: z.string().min(1),
  providerPolicyRef: z.string().min(1),
  promptContractId: z.string().min(1),
  promptContractVersion: z.string().min(1),
  promptHash: z.string().min(1),
  capabilityCatalogVersion: z.string().min(1),
  promptCatalogVersion: z.string().min(1),
  mapPackageSchemaVersion: z.string().min(1),
  securityPolicyRef: z.string().min(1),
  outputFormatVersion: z.string().min(1),
  generatedAt: z.string().datetime(),
  authoringProofRef: z.string().min(1),
}).strict();

export type MapAuthoringChain = z.output<typeof MapAuthoringChainSchema>;

type PartialMapAuthoringChain = Partial<MapAuthoringChain>;

function hashStableValue(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function normalizeSegment(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(0, 24) || "map-authoring";
}

function buildRequirementSnapshot(request: MapAuthoringRequest) {
  return {
    missionId: request.missionId,
    objective: request.objective,
    targetPlatform: request.targetPlatform,
    operatorNotes: request.operatorNotes,
    outputLanguage: request.outputLanguage,
  };
}

export function buildCanonicalMapAuthoringChain(input: {
  request: MapAuthoringRequest;
  promptContractId: string;
  promptContractVersion: string;
  promptText: string;
  generatedAt: string;
  providerPolicyRef?: string;
  capabilityCatalogVersion?: string;
  promptCatalogVersion?: string;
  mapPackageSchemaVersion?: string;
  securityPolicyRef?: string;
  outputFormatVersion?: string;
}): MapAuthoringChain {
  const requirementSnapshot = buildRequirementSnapshot(input.request);
  const sourceRequirementHash = `sha256:${hashStableValue(requirementSnapshot)}`;
  const capabilityCatalogVersion = input.capabilityCatalogVersion ?? CAPABILITY_CATALOG_VERSION;
  const promptCatalogVersion = input.promptCatalogVersion ?? PROMPT_CONTRACT_CATALOG_VERSION;
  const mapPackageSchemaVersion = input.mapPackageSchemaVersion ?? MAP_AUTHORING_SCHEMA_VERSION;
  const securityPolicyRef = input.securityPolicyRef ?? MAP_AUTHORING_SECURITY_POLICY_REF;
  const outputFormatVersion = input.outputFormatVersion ?? MAP_AUTHORING_OUTPUT_FORMAT_VERSION;
  const promptHash = `sha256:${hashStableValue({
    promptContractId: input.promptContractId,
    promptContractVersion: input.promptContractVersion,
    capabilityCatalogVersion,
    promptCatalogVersion,
    outputFormatVersion,
    promptText: input.promptText,
    requirementSnapshot,
  })}`;
  const missionSegment = normalizeSegment(input.request.missionId);
  const authoringRunId = `map-authoring:${missionSegment}:${hashStableValue({ promptHash, sourceRequirementHash }).slice(0, 12)}`;

  return MapAuthoringChainSchema.parse({
    authoringRunId,
    userRequirementRef: `user-requirement:${missionSegment}:${sourceRequirementHash.slice(-12)}`,
    sourceRequirementHash,
    providerPolicyRef: input.providerPolicyRef ?? MAP_AUTHORING_DEFAULT_PROVIDER_POLICY_REF,
    promptContractId: input.promptContractId,
    promptContractVersion: input.promptContractVersion,
    promptHash,
    capabilityCatalogVersion,
    promptCatalogVersion,
    mapPackageSchemaVersion,
    securityPolicyRef,
    outputFormatVersion,
    generatedAt: input.generatedAt,
    authoringProofRef: `map-proof:authoring:${authoringRunId}`,
  });
}

export function assertAuthoringChainConsistency(input: {
  candidate?: PartialMapAuthoringChain;
  canonical: MapAuthoringChain;
}): void {
  if (!input.candidate) {
    return;
  }

  for (const [fieldName, canonicalValue] of Object.entries(input.canonical)) {
    const candidateValue = input.candidate[fieldName as keyof MapAuthoringChain];
    if (candidateValue !== undefined && candidateValue !== canonicalValue) {
      throw new Error(`AI authoring chain field ${fieldName} must match the governed contract.`);
    }
  }
}