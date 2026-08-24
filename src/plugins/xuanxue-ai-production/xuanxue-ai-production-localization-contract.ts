import { z } from "zod";
import {
  XUANXUE_LOCALIZATION_SEMANTIC_MANIFEST,
  XUANXUE_PRODUCT_EXECUTION_CONTRACTS,
  xuanxueLocalOrderNode,
  xuanxueProductExecutionContract,
} from "./xuanxue-ai-production-product-contracts.js";

const localizationContracts = XUANXUE_PRODUCT_EXECUTION_CONTRACTS.filter(
  (contract) => contract.owner_domain === "localization",
);
if (localizationContracts.length !== 4) {
  throw new Error("XUANXUE_LOCALIZATION_GENERATED_DENOMINATOR_INVALID");
}
export const XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH =
  XUANXUE_LOCALIZATION_SEMANTIC_MANIFEST.contract_manifest_hash;

const localizationRoles = localizationContracts.flatMap((contract) =>
  contract.product_graph.nodes.map((node) => node.node_id));
export const XuanxueLocalizationRoleSchema = z.enum(
  localizationRoles as [string, ...string[]],
);
export type XuanxueLocalizationRole = z.infer<typeof XuanxueLocalizationRoleSchema>;

export const XuanxueProviderExecutionProfileSchema = z.object({
  profile_ref: z.string().min(1),
  profile_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/u)
    .transform((value): `sha256:${string}` => `sha256:${value.slice(7)}`),
  provider: z.literal("gpt-web-chat"),
  transport: z.literal("web-chat"),
  account_capability_ref: z.literal("agent:gpt-web-chat:localization"),
  model_label: z.literal("GPT-5.6 Sol"),
  model_family: z.literal("gpt-5.6"),
  model_identity_status: z.literal("verified"),
  reasoning_effort: z.enum(["high", "xhigh"]),
  executor_identity_ref: z.literal("supervised_local_gpt_web"),
  ai_acceptance_ref: z.literal("APEX-AI-ACCEPTANCE-001-V5"),
  ai_acceptance_version: z.literal("5.2"),
}).strict();
export type XuanxueProviderExecutionProfile =
  z.infer<typeof XuanxueProviderExecutionProfileSchema>;

export const XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS = Object.freeze(
  Object.fromEntries(localizationContracts.map((contract) => [
    contract.contract_id,
    Object.freeze({
      product_contract_hash: contract.product_contract_hash,
      roles: Object.freeze(contract.product_graph.nodes.map((node) => node.node_id)),
    }),
  ])),
);

export type XuanxueLocalizationProductId = string;

export const XUANXUE_LOCALIZATION_SUPPORTED_PRODUCT_CONTRACTS = Object.freeze(
  Object.fromEntries(localizationContracts.map((contract) => [
    contract.contract_id,
    contract.product_contract_hash,
  ])),
);
if (!localizationContracts.every((contract) =>
  XUANXUE_LOCALIZATION_SEMANTIC_MANIFEST.products[contract.contract_id]
    === contract.product_contract_hash)) {
  throw new Error("XUANXUE_LOCALIZATION_SEMANTIC_PRODUCT_HASH_DRIFT");
}

export function isExactXuanxueLocalizationProductContractMap(
  value: unknown,
): value is Readonly<Record<XuanxueLocalizationProductId, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = value as Readonly<Record<string, unknown>>;
  const expectedEntries = Object.entries(
    XUANXUE_LOCALIZATION_SUPPORTED_PRODUCT_CONTRACTS,
  );
  return Object.keys(actual).length === expectedEntries.length
    && expectedEntries.every(
      ([productId, contractHash]) => actual[productId] === contractHash,
    );
}

const profileHashes = XUANXUE_LOCALIZATION_SEMANTIC_MANIFEST.roles;

const reasoningFor = (
  role: XuanxueLocalizationRole,
): "high" | "xhigh" => role === "candidate_a" ? "xhigh" : "high";

export const expectedLocalizationProviderProfile = (
  role: XuanxueLocalizationRole,
): XuanxueProviderExecutionProfile => {
  const profileHash = profileHashes[role];
  if (!profileHash) throw new Error("XUANXUE_LOCALIZATION_PROFILE_ROLE_UNKNOWN");
  return {
    profile_ref: `localization-production:gpt-5.6:${role}:${reasoningFor(role)}:v1`,
    profile_hash: profileHash,
    provider: "gpt-web-chat",
    transport: "web-chat",
    account_capability_ref: "agent:gpt-web-chat:localization",
    model_label: "GPT-5.6 Sol",
    model_family: "gpt-5.6",
    model_identity_status: "verified",
    reasoning_effort: reasoningFor(role),
    executor_identity_ref: "supervised_local_gpt_web",
    ai_acceptance_ref: "APEX-AI-ACCEPTANCE-001-V5",
    ai_acceptance_version: "5.2",
  };
};

export function isXuanxueLocalizationProduct(
  value: string,
): value is XuanxueLocalizationProductId {
  return localizationContracts.some((contract) => contract.contract_id === value);
}

const expectedLocalizationTrigger = (productId: string): string =>
  productId.includes("_static_review_")
    ? "localization_static_review"
    : "terminal_localization";

export function assertXuanxueLocalizationContract(input: {
  readonly productId: string;
  readonly stageId: string;
  readonly triggerKind: string;
  readonly contractManifestHash: string | null;
  readonly productContractHash: string;
  readonly role: XuanxueLocalizationRole | null;
  readonly providerProfile: XuanxueProviderExecutionProfile | null;
  readonly inputKinds: readonly string[];
  readonly hasConversationParent: boolean;
}): void {
  if (!isXuanxueLocalizationProduct(input.productId)) return;
  if (!input.role) {
    throw new Error("XUANXUE_AI_PRODUCTION_LOCALIZATION_ROLE_REQUIRED");
  }
  const contract = xuanxueProductExecutionContract(input.productId);
  const node = xuanxueLocalOrderNode(input.productId, [input.stageId]);
  const stage = node.order_contract.stages[0]!;
  if (input.contractManifestHash !== XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH
    || input.productContractHash !== contract.product_contract_hash
    || input.role !== node.node_id
    || input.triggerKind !== expectedLocalizationTrigger(input.productId)) {
    throw new Error("XUANXUE_AI_PRODUCTION_LOCALIZATION_CONTRACT_IDENTITY_INVALID");
  }
  const actualKinds = [...input.inputKinds].sort();
  const expectedKinds = (input.productId.includes("_static_review_")
    ? ["localization_review_context_json"]
    : ["render_policy", "safety_policy", "structured_payload", "terminology_policy"]
  ).sort();
  if (JSON.stringify(actualKinds) !== JSON.stringify(expectedKinds)) {
    throw new Error("XUANXUE_AI_PRODUCTION_LOCALIZATION_INPUT_SET_INVALID");
  }
  const expectedProfile = expectedLocalizationProviderProfile(input.role);
  if (!input.providerProfile
    || JSON.stringify(input.providerProfile) !== JSON.stringify(expectedProfile)) {
    throw new Error("XUANXUE_AI_PRODUCTION_LOCALIZATION_PROVIDER_PROFILE_INVALID");
  }
  const requiresParent = stage.conversation_mode === "continue_exact";
  if (requiresParent !== input.hasConversationParent) {
    throw new Error("XUANXUE_AI_PRODUCTION_LOCALIZATION_CONVERSATION_PARENT_INVALID");
  }
}
