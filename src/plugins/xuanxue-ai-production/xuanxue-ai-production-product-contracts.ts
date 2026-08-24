import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

type GeneratedStageContract = Readonly<{
  stage_id: string;
  ordinal: number;
  depends_on_stage_ids: readonly string[];
  conversation_mode: "fresh" | "fork" | "continue_exact";
  continuation_from_stage_id: string | null;
  generated_inputs_from_stage_ids: readonly string[];
  required_material_roles_or_input_kinds: readonly string[];
  output_contract_ref: string;
  provider_evidence_required: true;
}>;

export type GeneratedLocalOrderContract = Readonly<{
  allowed_stage_ids: readonly string[];
  final_stage_id: string;
  stage_count: number;
  conversation_scope_policy: string;
  input_contract: Readonly<{
    identity: string;
    required_roles: readonly string[];
  }>;
  stages: readonly GeneratedStageContract[];
}>;

export type GeneratedProductNode = Readonly<{
  node_id: string;
  parent_binding: string;
  join_binding: string;
  order_contract: GeneratedLocalOrderContract;
}>;

export type GeneratedProductExecutionContract = Readonly<{
  contract_id: string;
  owner_domain: string;
  trigger_kind: string;
  product_contract_hash: `sha256:${string}`;
  product_graph: Readonly<{
    nodes: readonly GeneratedProductNode[];
    edges: readonly Readonly<{ from: string; to: string; type: string }>[];
    terminal_rule: string;
  }>;
}>;

type GeneratedProjection = Readonly<{
  schema_version: "xuanxue-product-execution-projection.v1";
  provider_commit_sha: string;
  provider_artifact_sha256: string;
  localization_semantic_manifest_sha256: string;
  localization_semantic_manifest: Readonly<{
    schema_version: "xuanxue-ai-localization-contract-manifest.v1";
    contract_manifest_hash: `sha256:${string}`;
    products: Readonly<Record<string, `sha256:${string}`>>;
    roles: Readonly<Record<string, `sha256:${string}`>>;
  }>;
  bundle: Readonly<{
    bundle_hash: `sha256:${string}`;
    contract_count: number;
    contracts: readonly GeneratedProductExecutionContract[];
  }>;
}>;

const projectionPath = path.resolve(
  process.cwd(),
  "src/plugins/xuanxue-ai-production/generated/xuanxue-product-execution.generated.json",
);

const canonical = (value: unknown): unknown => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map(
      (key) => [key, canonical((value as Record<string, unknown>)[key])],
    ))
    : value;

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const canonicalHash = (value: unknown): `sha256:${string}` =>
  `sha256:${sha256(JSON.stringify(canonical(value)))}`;

export const assertXuanxueProductExecutionProjection = (
  value: GeneratedProjection,
): void => {
  const contracts = value.bundle?.contracts;
  const { bundle_hash: _bundleHash, ...bundleBody } = value.bundle ?? {} as GeneratedProjection["bundle"];
  const providerArtifactBytes = `${JSON.stringify(value.bundle, null, 2)}\n`;
  const localizationBytes = `${JSON.stringify(value.localization_semantic_manifest)}\n`;
  if (!projectionIdentityIsValid(value)
    || !projectionContractsAreValid(contracts)
    || !projectionHashesAreValid(value, bundleBody, providerArtifactBytes, localizationBytes)) {
    throw new Error("XUANXUE_PRODUCT_EXECUTION_GENERATED_PROJECTION_INVALID");
  }
};

const projectionIdentityIsValid = (value: GeneratedProjection): boolean =>
  value.schema_version === "xuanxue-product-execution-projection.v1"
  && /^[a-f0-9]{40}$/u.test(value.provider_commit_sha)
  && /^[a-f0-9]{64}$/u.test(value.provider_artifact_sha256)
  && /^[a-f0-9]{64}$/u.test(value.localization_semantic_manifest_sha256)
  && value.localization_semantic_manifest?.schema_version
    === "xuanxue-ai-localization-contract-manifest.v1"
  && /^sha256:[a-f0-9]{64}$/u.test(
    value.localization_semantic_manifest?.contract_manifest_hash,
  )
  && /^sha256:[a-f0-9]{64}$/u.test(value.bundle?.bundle_hash)
  && value.bundle?.contract_count === 20;

const projectionContractsAreValid = (
  contracts: readonly GeneratedProductExecutionContract[] | undefined,
): contracts is readonly GeneratedProductExecutionContract[] => Array.isArray(contracts)
  && contracts.length === 20
  && new Set(contracts.map((contract) => contract.contract_id)).size === 20
  && contracts.every((contract) =>
    /^sha256:[a-f0-9]{64}$/u.test(contract.product_contract_hash)
    && Array.isArray(contract.product_graph?.nodes)
    && contract.product_graph.nodes.length > 0);

const projectionHashesAreValid = (
  value: GeneratedProjection,
  bundleBody: Omit<GeneratedProjection["bundle"], "bundle_hash">,
  providerArtifactBytes: string,
  localizationBytes: string,
): boolean => canonicalHash(bundleBody) === value.bundle.bundle_hash
  && sha256(providerArtifactBytes) === value.provider_artifact_sha256
  && sha256(localizationBytes) === value.localization_semantic_manifest_sha256;

const parseProjection = (): GeneratedProjection => {
  const value = JSON.parse(readFileSync(projectionPath, "utf8")) as GeneratedProjection;
  assertXuanxueProductExecutionProjection(value);
  return Object.freeze(value);
};

export const XUANXUE_PRODUCT_EXECUTION_PROJECTION = parseProjection();
export const XUANXUE_PRODUCT_EXECUTION_PROVIDER_COMMIT =
  XUANXUE_PRODUCT_EXECUTION_PROJECTION.provider_commit_sha;
export const XUANXUE_PRODUCT_EXECUTION_CONTRACTS = Object.freeze(
  XUANXUE_PRODUCT_EXECUTION_PROJECTION.bundle.contracts,
);
export const XUANXUE_LOCALIZATION_SEMANTIC_MANIFEST = Object.freeze(
  XUANXUE_PRODUCT_EXECUTION_PROJECTION.localization_semantic_manifest,
);
export const XUANXUE_AI_PRODUCTION_PRODUCT_IDS = Object.freeze(
  XUANXUE_PRODUCT_EXECUTION_CONTRACTS.map((contract) => contract.contract_id),
);
export const XUANXUE_AI_PRODUCTION_STAGE_IDS = Object.freeze([
  ...new Set(XUANXUE_PRODUCT_EXECUTION_CONTRACTS.flatMap((contract) =>
    contract.product_graph.nodes.flatMap((node) =>
      node.order_contract.stages.map((stage) => stage.stage_id)))),
]);

const contractsById = new Map(
  XUANXUE_PRODUCT_EXECUTION_CONTRACTS.map((contract) =>
    [contract.contract_id, contract] as const),
);

export const xuanxueProductExecutionContract = (
  productId: string,
): GeneratedProductExecutionContract => {
  const contract = contractsById.get(productId);
  if (!contract) throw new Error(`XUANXUE_PRODUCT_EXECUTION_CONTRACT_UNKNOWN:${productId}`);
  return contract;
};

export const xuanxueLocalOrderNode = (
  productId: string,
  materialStageIds: readonly string[],
): GeneratedProductNode => {
  const contract = xuanxueProductExecutionContract(productId);
  const matches = contract.product_graph.nodes.filter((node) => {
    const stages = node.order_contract.stages
      .slice()
      .sort((left, right) => left.ordinal - right.ordinal)
      .map((stage) => stage.stage_id);
    return stages.length === materialStageIds.length
      && stages.every((stageId, index) => stageId === materialStageIds[index]);
  });
  if (matches.length !== 1) {
    throw new Error(`XUANXUE_PRODUCT_EXECUTION_LOCAL_ORDER_NODE_INVALID:${productId}`);
  }
  return matches[0]!;
};

export const xuanxueAiProductionProductContractHashV6 = (
  productId: string,
): `sha256:${string}` => xuanxueProductExecutionContract(productId).product_contract_hash;

export const assertXuanxueProductContractHash = (
  productId: string,
  productContractHash: string,
): void => {
  if (productContractHash !== xuanxueAiProductionProductContractHashV6(productId)) {
    throw new Error("XUANXUE_PRODUCT_EXECUTION_CONTRACT_HASH_MISMATCH");
  }
};

export const XUANXUE_AI_PRODUCTION_SUPPORTED_PRODUCT_CONTRACT_HASHES_V6 =
  Object.freeze(XUANXUE_AI_PRODUCTION_PRODUCT_IDS.map(
    xuanxueAiProductionProductContractHashV6,
  ));
