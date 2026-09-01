import { readFile } from "node:fs/promises";
import path from "node:path";

import { hashCanonical } from "../../../src/lib/local-runtime/production/contracts.js";

const CONTRACT_KEYS = [
  "authorityArtifact", "contractId", "generatedBy", "hashAlgorithm",
  "manifestHash", "providerRepo", "version",
] as const;
const HASH = /^sha256:[a-f0-9]{64}$/u;

const readJson = async (filePath: string): Promise<Record<string, unknown>> =>
  JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;

export async function verifyProductionContractProjection(input: {
  readonly agentProjectionPath: string;
  readonly websiteManifestPath: string;
}): Promise<Readonly<{ status: "READY"; manifestHash: `sha256:${string}` }>> {
  const [projection, manifest] = await Promise.all([
    readJson(input.agentProjectionPath),
    readJson(input.websiteManifestPath),
  ]);
  const contract = projection.contract as Record<string, unknown> | undefined;
  const exactKeys = contract && typeof contract === "object" && !Array.isArray(contract)
    && JSON.stringify(Object.keys(contract).sort()) === JSON.stringify([...CONTRACT_KEYS].sort());
  const expectedHash = hashCanonical(manifest);
  if (!exactKeys
    || projection.schemaVersion !== 1
    || projection.specKind !== "cross-repo-dependency"
    || projection.status !== "active"
    || projection.version !== 13
    || contract.authorityArtifact !== "packages/ai-contracts/src/production-control/xuanxue-ai-production-v6.manifest.json"
    || contract.contractId !== "ai-acceptance.xuanxue-ai-production-v6"
    || contract.generatedBy !== "scripts/generate/sync-xuanxue-ai-production-v6-agent-projection.ts"
    || contract.hashAlgorithm !== "JCS-SHA-256"
    || typeof contract.manifestHash !== "string"
    || !HASH.test(contract.manifestHash)
    || contract.providerRepo !== "ADVISION-X/xuanxue-web"
    || contract.version !== 13
    || manifest.schema_version !== "xuanxue-ai-production-contract-manifest.v6"
    || manifest.protocol_version !== "xuanxue-ai-production-v6"
    || contract.manifestHash !== expectedHash) {
    throw new Error("AI_PRODUCTION_MANIFEST_PROJECTION_MISMATCH");
  }
  return Object.freeze({ status: "READY", manifestHash: expectedHash });
}

export const productionContractProjectionPaths = (input: {
  readonly agentRoot: string;
  readonly websiteRoot: string;
}): Readonly<{ agentProjectionPath: string; websiteManifestPath: string }> => ({
  agentProjectionPath: path.resolve(
    input.agentRoot, "docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json",
  ),
  websiteManifestPath: path.resolve(
    input.websiteRoot, "packages/ai-contracts/src/production-control/xuanxue-ai-production-v6.manifest.json",
  ),
});
