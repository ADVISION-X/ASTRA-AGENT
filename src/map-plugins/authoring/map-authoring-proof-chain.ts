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
import type { MapAuthoringInputPackage } from "./map-authoring-input-package.schema.js";

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

function buildRequirementSnapshot(inputPackage: MapAuthoringInputPackage) {
  return {
    inputPackageId: inputPackage.inputPackageId,
    userRequirementRef: inputPackage.userRequirementRef,
    sourceRequirementHash: inputPackage.sourceRequirementHash,
    targetPlatformProfileRef: inputPackage.targetPlatformProfileRef,
    capabilityCatalogVersion: inputPackage.capabilityCatalog.version,
    promptCatalogVersion: inputPackage.promptContractCatalog.version,
    outputSchemaCatalogVersion: inputPackage.outputSchemaCatalog.version,
  };
}

export function buildCanonicalMapAuthoringChain(input: {
  inputPackage: MapAuthoringInputPackage;
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
  const requirementSnapshot = buildRequirementSnapshot(input.inputPackage);
  const sourceRequirementHash = input.inputPackage.sourceRequirementHash;
  const capabilityCatalogVersion = input.capabilityCatalogVersion ?? input.inputPackage.capabilityCatalog.version ?? CAPABILITY_CATALOG_VERSION;
  const promptCatalogVersion = input.promptCatalogVersion ?? input.inputPackage.promptContractCatalog.version ?? PROMPT_CONTRACT_CATALOG_VERSION;
  const mapPackageSchemaVersion = input.mapPackageSchemaVersion ?? input.inputPackage.mapPackageSchema.schemaVersion ?? MAP_AUTHORING_SCHEMA_VERSION;
  const securityPolicyRef = input.securityPolicyRef ?? MAP_AUTHORING_SECURITY_POLICY_REF;
  const outputFormatVersion = input.outputFormatVersion ?? input.inputPackage.mapAuthoringOutputSchema.schemaVersion ?? MAP_AUTHORING_OUTPUT_FORMAT_VERSION;
  const promptHash = `sha256:${hashStableValue({
    promptContractId: input.promptContractId,
    promptContractVersion: input.promptContractVersion,
    capabilityCatalogVersion,
    promptCatalogVersion,
    outputFormatVersion,
    promptText: input.promptText,
    requirementSnapshot,
  })}`;
  const inputPackageSegment = normalizeSegment(input.inputPackage.inputPackageId);
  const authoringRunId = `map-authoring:${inputPackageSegment}:${hashStableValue({ promptHash, sourceRequirementHash }).slice(0, 12)}`;

  const promptContract = input.inputPackage.promptContractCatalog.entries.find(
    (entry) => entry.promptContractId === input.promptContractId,
  );

  return MapAuthoringChainSchema.parse({
    authoringRunId,
    userRequirementRef: input.inputPackage.userRequirementRef,
    sourceRequirementHash,
    providerPolicyRef: input.providerPolicyRef ?? promptContract?.providerPolicy.policyRef ?? MAP_AUTHORING_DEFAULT_PROVIDER_POLICY_REF,
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