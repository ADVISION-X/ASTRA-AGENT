import dependencySpec from "../../../../docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json" with { type: "json" };

const HASH = /^sha256:[a-f0-9]{64}$/u;
const CONTRACT_KEYS = [
  "authorityArtifact",
  "contractId",
  "generatedBy",
  "hashAlgorithm",
  "manifestHash",
  "providerRepo",
  "version",
] as const;

const contract = dependencySpec.contract;
const actualKeys = Object.keys(contract).sort();
const expectedKeys = [...CONTRACT_KEYS].sort();
if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)
  || contract.authorityArtifact !== "packages/ai-contracts/src/production-control/xuanxue-ai-production-v6.manifest.json"
  || contract.contractId !== "ai-acceptance.xuanxue-ai-production-v6"
  || contract.generatedBy !== "scripts/generate/sync-xuanxue-ai-production-v6-agent-projection.ts"
  || contract.hashAlgorithm !== "JCS-SHA-256"
  || !HASH.test(contract.manifestHash)
  || contract.providerRepo !== "ADVISION-X/xuanxue-web"
  || contract.version !== 14) {
  throw new Error("AI_PRODUCTION_MANIFEST_PROJECTION_INVALID");
}

export const PRODUCTION_V6_MANIFEST_HASH =
  contract.manifestHash as `sha256:${string}`;
