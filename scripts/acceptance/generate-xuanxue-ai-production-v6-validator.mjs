import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const website = process.env.XUANXUE_WEBSITE_REPOSITORY?.trim()
  || "/Users/nexgen/Documents/xuanxue-web";
const pinPath = path.join(root, "docs/specs/xuanxue-ai-production/xuanxue-ai-production-v6.pin.spec.json");
const outputPath = path.join(root, "src/plugins/xuanxue-ai-production/generated/xuanxue-ai-production-v6.validator.ts");
const manifestOutputPath = path.join(root, "src/plugins/xuanxue-ai-production/generated/xuanxue-ai-production-v6.manifest.json");
const contractSourcePath = "packages/ai-contracts/src/production-control/v6-contract.ts";

const canonical = (value) => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
    : value;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fromProvider = (commit, providerPath) => execFileSync(
  "git", ["show", `${commit}:${providerPath}`], { cwd: website },
).toString("utf8");

const pin = JSON.parse(readFileSync(pinPath, "utf8"));
const binding = pin.contract;
if (pin.status !== "active" || pin.specKind !== "contract-pin"
  || binding.providerRepo !== "ADVISION-X/xuanxue-web") {
  throw new Error("XUANXUE_AI_PRODUCTION_V6_PIN_INVALID");
}
const providerSpecText = fromProvider(binding.providerCommitSha, binding.providerSpecRef);
const providerSpec = JSON.parse(providerSpecText);
if (sha256(JSON.stringify(canonical(providerSpec.contract))) !== binding.contractSha256) {
  throw new Error("XUANXUE_AI_PRODUCTION_V6_PIN_HASH_MISMATCH");
}
const authority = providerSpec.contract.authorityArtifact;
const manifestText = fromProvider(binding.providerCommitSha, authority.path);
if (sha256(manifestText) !== authority.sha256) {
  throw new Error("XUANXUE_AI_PRODUCTION_V6_MANIFEST_HASH_MISMATCH");
}
const sourceText = fromProvider(binding.providerCommitSha, contractSourcePath);
const hashImport = 'import { hashCanonicalJson } from "@xuanshu/hash-core";';
if (!sourceText.startsWith(`${hashImport}\n`)) {
  throw new Error("XUANXUE_AI_PRODUCTION_V6_PROVIDER_SOURCE_INVALID");
}

const localHashImplementation = `import { createHash } from "node:crypto";

const canonicalForGeneratedHash = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalForGeneratedHash);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalForGeneratedHash(record[key])]));
  }
  return value;
};
const hashCanonicalJson = (value: unknown): \`sha256:\${string}\` =>
  \`sha256:\${createHash("sha256").update(JSON.stringify(canonicalForGeneratedHash(value))).digest("hex")}\`;
`;

const adapters = `
type GeneratedParser<T> = Readonly<{ parse(value: unknown): T }>;
const generatedParser = <T>(assertValue: (value: unknown) => asserts value is T): GeneratedParser<T> => ({
  parse(value: unknown): T {
    assertValue(value);
    return value;
  },
});

export const XuanxueAiProductionV6ManifestSchema = generatedParser(assertXuanxueAiProductionV6Manifest);
export const WorkerSessionCredentialV6Schema = generatedParser(assertWorkerSessionCredentialV6);
export const RuntimeAttestationReceiptV6Schema = generatedParser(assertRuntimeAttestationReceiptV6);
export const CloudExecutionGrantV6Schema = generatedParser(assertCloudExecutionGrantV6);
export const ClaimBatchReceiptV6Schema = generatedParser(assertClaimBatchReceiptV6);
export const HandoverV6Schema = generatedParser(assertHandoverV6);
`;

const generated = `// GENERATED FILE. DO NOT EDIT.\n`
  + `// Provider: ${binding.providerRepo}@${binding.providerCommitSha}:${contractSourcePath}\n`
  + `// Provider source SHA256: ${sha256(sourceText)}\n`
  + sourceText.replace(hashImport, localHashImplementation.trimEnd())
  + adapters;

if (process.argv.includes("--check")) {
  if (readFileSync(outputPath, "utf8") !== generated
    || readFileSync(manifestOutputPath, "utf8") !== manifestText) {
    throw new Error("XUANXUE_AI_PRODUCTION_V6_GENERATED_VALIDATOR_STALE");
  }
  process.stdout.write(`V6_GENERATED_VALIDATOR_CURRENT ${binding.providerCommitSha}\n`);
} else {
  writeFileSync(outputPath, generated);
  writeFileSync(manifestOutputPath, manifestText);
  process.stdout.write(`V6_GENERATED_VALIDATOR_WRITTEN ${binding.providerCommitSha}\n`);
}
