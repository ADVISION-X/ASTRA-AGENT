import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const website = process.env.XUANXUE_WEBSITE_REPOSITORY?.trim()
  || "/Users/nexgen/Documents/xuanxue-web";
const requestedProviderCommit = process.env.XUANXUE_PROVIDER_COMMIT?.trim();
const dependencyPath = path.join(root, "docs/specs/xuanxue-ai-production/xuanxue-ai-production-v6.dependency.spec.json");
const productDependencyPath = path.join(root, "docs/specs/xuanxue-ai-production/product-execution-contract.dependency.spec.json");
const outputPath = path.join(root, "src/plugins/xuanxue-ai-production/generated/xuanxue-ai-production-v6.validator.ts");
const manifestOutputPath = path.join(root, "src/plugins/xuanxue-ai-production/generated/xuanxue-ai-production-v6.manifest.json");
const productProjectionOutputPath = path.join(root, "src/plugins/xuanxue-ai-production/generated/xuanxue-product-execution.generated.json");
const providerCommit = requestedProviderCommit || (process.argv.includes("--check")
  ? JSON.parse(readFileSync(productProjectionOutputPath, "utf8")).provider_commit_sha
  : undefined);
if (!providerCommit || !/^[a-f0-9]{40,64}$/u.test(providerCommit)) throw new Error("XUANXUE_PROVIDER_COMMIT_REQUIRED");
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
const dependencySpec = JSON.parse(readFileSync(dependencyPath, "utf8"));
const dependency = dependencySpec.contract;
if (dependencySpec.status !== "active" || dependencySpec.specKind !== "cross-repo-dependency"
  || dependency.providerRepo !== "ADVISION-X/xuanxue-web") {
  throw new Error("XUANXUE_AI_PRODUCTION_V6_DEPENDENCY_INVALID");
}
const productDependencySpec = JSON.parse(readFileSync(productDependencyPath, "utf8"));
const productDependency = productDependencySpec.contract;
if (productDependencySpec.status !== "active" || productDependencySpec.specKind !== "cross-repo-dependency"
  || productDependency.providerRepo !== "ADVISION-X/xuanxue-web"
  || productDependency.contractId !== "ai-acceptance.product-execution-contract") {
  throw new Error("XUANXUE_PRODUCT_EXECUTION_DEPENDENCY_INVALID");
}
const dependencies = [dependency, productDependency];
const providerSpecs = execFileSync(
  "git", ["ls-tree", "-r", "--name-only", providerCommit, "--", "docs/specs"], { cwd: website },
).toString("utf8").split("\n").filter((providerPath) => providerPath.endsWith(".spec.json"));
const providerMatches = providerSpecs.flatMap((providerPath) => {
  const source = fromProvider(providerCommit, providerPath);
  const spec = JSON.parse(source);
  return dependencies.flatMap((current) => spec.status === "active"
    && spec.specKind === "cross-repo-contract"
    && spec.contract?.contractId === current.contractId
    && spec.contract?.version === current.version
    && spec.contract?.providerRepo === current.providerRepo
    ? [{ contractId: current.contractId, providerPath, source, spec }]
    : []);
});
for (const current of dependencies) if (providerMatches.filter((match) => match.contractId === current.contractId).length !== 1) {
  throw new Error(`XUANXUE_PROVIDER_CONTRACT_NOT_UNIQUE:${current.contractId}`);
}
const providerMatch = providerMatches.find((match) => match.contractId === dependency.contractId);
if (!providerMatch) throw new Error(`XUANXUE_PROVIDER_CONTRACT_NOT_UNIQUE:${dependency.contractId}`);
const { providerPath, spec: providerSpec } = providerMatch;
const authority = providerSpec.contract.authorityArtifact;
const manifestText = fromProvider(providerCommit, authority.path);
const manifest = JSON.parse(manifestText);
if (authority.selector !== `protocol_version=${manifest.protocol_version}`) throw new Error("XUANXUE_AI_PRODUCTION_V6_AUTHORITY_SELECTOR_MISMATCH");
const sourceText = fromProvider(providerCommit, contractSourcePath);
const hashImport = 'import { hashCanonicalJson } from "@xuanshu/hash-core";';
const providerImports = `${hashImport}\nimport { productExecutionBundle } from "./product-execution.generated.js";\nimport {\n  productExecutionContracts,\n} from "./product-execution-runtime.js";\n`;
if (!sourceText.startsWith(providerImports)) {
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

const productProviderMatch = providerMatches.find((match) => match.contractId === productDependency.contractId);
if (!productProviderMatch) throw new Error(`XUANXUE_PROVIDER_CONTRACT_NOT_UNIQUE:${productDependency.contractId}`);
const { providerPath: productProviderPath, source: productDescriptorText, spec: productDescriptor } = productProviderMatch;
const productAuthority = productDescriptor.contract.authorityArtifact;
const productBundleText = fromProvider(
  providerCommit,
  productAuthority.path,
);
const productBundle = JSON.parse(productBundleText);
if (productBundle.schema_version !== 1
  || productBundle.contract_id !== productDependency.contractId
  || productBundle.contract_count !== 20
  || !Array.isArray(productBundle.contracts)
  || productBundle.contracts.length !== 20
  || new Set(productBundle.contracts.map((contract) => contract.contract_id)).size !== 20
  || productBundle.contracts.some((contract) =>
    !/^sha256:[a-f0-9]{64}$/u.test(contract.product_contract_hash))
  || productAuthority.selector !== `bundle_hash=${productBundle.bundle_hash}`) {
  throw new Error("XUANXUE_PRODUCT_EXECUTION_BUNDLE_INVALID");
}
const localProductContract = `const productExecutionBundle = ${JSON.stringify(productBundle, null, 2)} as const;\nconst productExecutionContracts = productExecutionBundle.contracts;\n`;
const generated = `// GENERATED FILE. DO NOT EDIT.\n`
  + `// Provider: ${dependency.providerRepo}@${providerCommit}:${contractSourcePath}\n`
  + `// Provider source SHA256: ${sha256(sourceText)}\n`
  + localHashImplementation
  + localProductContract
  + sourceText.slice(providerImports.length)
  + adapters;
const localizationProjectionPath = "artifacts/contracts/localization-production-contract.v1.json";
const localizationProjectionText = fromProvider(
  providerCommit,
  localizationProjectionPath,
);
const localizationProjection = JSON.parse(localizationProjectionText);
const localizationContracts = productBundle.contracts.filter(
  (contract) => contract.owner_domain === "localization",
);
if (localizationContracts.length !== 4
  || !/^sha256:[a-f0-9]{64}$/u.test(localizationProjection.contract_manifest_hash)
  || Object.keys(localizationProjection.products ?? {}).length !== 4
  || localizationContracts.some((contract) =>
    localizationProjection.products[contract.contract_id]
      !== contract.product_contract_hash)
  || Object.keys(localizationProjection.roles ?? {}).length !== 7
  || Object.values(localizationProjection.roles ?? {}).some((value) =>
    !/^sha256:[a-f0-9]{64}$/u.test(value))) {
  throw new Error("XUANXUE_LOCALIZATION_SEMANTIC_PROJECTION_INVALID");
}
const productProjection = `${JSON.stringify({
  schema_version: "xuanxue-product-execution-projection.v1",
  provider_repo: productDependency.providerRepo,
  provider_commit_sha: providerCommit,
  provider_spec_ref: productProviderPath,
  provider_contract_sha256: sha256(JSON.stringify(canonical(productDescriptor.contract))),
  provider_descriptor_sha256: sha256(productDescriptorText),
  provider_artifact_path: productAuthority.path,
  provider_artifact_sha256: sha256(productBundleText),
  localization_semantic_manifest_path: localizationProjectionPath,
  localization_semantic_manifest_sha256: sha256(localizationProjectionText),
  localization_semantic_manifest: localizationProjection,
  bundle: productBundle,
}, null, 2)}\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(outputPath, "utf8") !== generated
    || readFileSync(manifestOutputPath, "utf8") !== manifestText
    || readFileSync(productProjectionOutputPath, "utf8") !== productProjection) {
    throw new Error("XUANXUE_AI_PRODUCTION_V6_GENERATED_VALIDATOR_STALE");
  }
  process.stdout.write(`V6_GENERATED_VALIDATOR_CURRENT ${providerCommit} PRODUCT_EXECUTION_CURRENT ${providerCommit}\n`);
} else {
  writeFileSync(outputPath, generated);
  writeFileSync(manifestOutputPath, manifestText);
  writeFileSync(productProjectionOutputPath, productProjection);
  process.stdout.write(`V6_GENERATED_VALIDATOR_WRITTEN ${providerCommit} PRODUCT_EXECUTION_WRITTEN ${providerCommit}\n`);
}
