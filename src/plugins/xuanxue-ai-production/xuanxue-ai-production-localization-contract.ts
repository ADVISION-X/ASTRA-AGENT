import { z } from "zod";

export const XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_VERSION =
  "xuanxue-ai-localization-contract-manifest.v1" as const;
export const XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH =
  "sha256:ac26556a1d1e9f72037bd71189823d9bf7c3711e4945a569bccd0f7bd671dc57" as const;

export const XuanxueLocalizationRoleSchema = z.enum([
  "candidate_a",
  "candidate_b",
  "selector_first",
  "selector_swap",
  "consistency",
  "report_translation",
  "article_translation",
]);
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

export const XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS = {
  localization_report_translation: {
    stage_id: "report_translation",
    trigger_kind: "terminal_localization",
    product_contract_hash:
      "sha256:0ee71cf639a4a98356037f7d77495fded3752e0d694124c46f34a8b30d58bdc5",
    roles: ["report_translation"],
    required_input_kinds: [
      "render_policy",
      "safety_policy",
      "structured_payload",
      "terminology_policy",
    ],
  },
  localization_article_translation: {
    stage_id: "article_translation",
    trigger_kind: "terminal_localization",
    product_contract_hash:
      "sha256:6137a876e538dbc49106d828f1ba6d9d9c4482f2c35f0dec578303385e8d3354",
    roles: ["article_translation"],
    required_input_kinds: [
      "render_policy",
      "safety_policy",
      "structured_payload",
      "terminology_policy",
    ],
  },
  localization_static_review_candidate: {
    stage_id: "localization_candidate",
    trigger_kind: "localization_static_review",
    product_contract_hash:
      "sha256:2bdc7a50507354740e748101dbee52a84aeb530adb1eece38a8b697c7431577a",
    roles: ["candidate_a", "candidate_b"],
    required_input_kinds: ["localization_review_context_json"],
  },
  localization_static_review_selector: {
    stage_id: "localization_selector",
    trigger_kind: "localization_static_review",
    product_contract_hash:
      "sha256:9cc85d8b374d98cde912013405d17dc9f90b0487e692842b23afec2eddcb11bd",
    roles: ["selector_first", "selector_swap", "consistency"],
    required_input_kinds: ["localization_review_context_json"],
  },
} as const;

export type XuanxueLocalizationProductId =
  keyof typeof XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS;

export const XUANXUE_LOCALIZATION_SUPPORTED_PRODUCT_CONTRACTS:
Readonly<Record<XuanxueLocalizationProductId, string>> = Object.fromEntries(
  Object.entries(XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS).map(
    ([productId, contract]) => [productId, contract.product_contract_hash],
  ),
) as Readonly<Record<XuanxueLocalizationProductId, string>>;

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

const profileHashes: Readonly<Record<XuanxueLocalizationRole, `sha256:${string}`>> = {
  candidate_a: "sha256:fadb47c667e7f7dc30029427c22b15044c21adb1d6ab3d87fddf71cf91278c08",
  candidate_b: "sha256:8a7db953608862a0b17f3add2656a69d6dd0942565d4e7e9077498cc83adec29",
  selector_first: "sha256:91d451ad9a9586f59b079d298f49177ad007f0b3e73d5857595fefa353d668df",
  selector_swap: "sha256:f85d9cf96d15f53f4eda6220137072e47f0dffba42ad8cc8aa59c0ea635bd47e",
  consistency: "sha256:113cfa303aa9550f659448d99114fb3c198fcc291bba0b2eef23b64370d9796e",
  report_translation: "sha256:8a09c70b9a1b153586e09569e894dd8351f5a0995873bdaeb4c3e027bc52c2c6",
  article_translation: "sha256:c6ad5c376015509cedb8a0688c04994b6d50531d22aa37abfaf9f9ede21050cc",
};

const reasoningFor = (
  role: XuanxueLocalizationRole,
): "high" | "xhigh" => role === "candidate_a" ? "xhigh" : "high";

export const expectedLocalizationProviderProfile = (
  role: XuanxueLocalizationRole,
): XuanxueProviderExecutionProfile => ({
  profile_ref: `localization-production:gpt-5.6:${role}:${reasoningFor(role)}:v1`,
  profile_hash: profileHashes[role],
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
});

export function isXuanxueLocalizationProduct(
  value: string,
): value is XuanxueLocalizationProductId {
  return value in XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS;
}

export function assertXuanxueLocalizationContract(input: {
  readonly productId: string;
  readonly stageId: string;
  readonly triggerKind: string;
  readonly contractManifestHash: string | null;
  readonly productContractHash: string | null;
  readonly role: XuanxueLocalizationRole | null;
  readonly providerProfile: XuanxueProviderExecutionProfile | null;
  readonly inputKinds: readonly string[];
  readonly hasConversationParent: boolean;
}): void {
  if (!isXuanxueLocalizationProduct(input.productId)) return;
  const contract = XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS[input.productId];
  if (
    input.contractManifestHash !== XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH
    || input.productContractHash !== contract.product_contract_hash
    || !input.role
    || !(contract.roles as readonly string[]).includes(input.role)
    || input.stageId !== contract.stage_id
    || input.triggerKind !== contract.trigger_kind
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_LOCALIZATION_CONTRACT_IDENTITY_INVALID");
  }
  const actualKinds = [...input.inputKinds].sort();
  const expectedKinds = [...contract.required_input_kinds].sort();
  if (JSON.stringify(actualKinds) !== JSON.stringify(expectedKinds)) {
    throw new Error("XUANXUE_AI_PRODUCTION_LOCALIZATION_INPUT_SET_INVALID");
  }
  const expectedProfile = expectedLocalizationProviderProfile(input.role);
  if (
    !input.providerProfile
    || JSON.stringify(input.providerProfile) !== JSON.stringify(expectedProfile)
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_LOCALIZATION_PROVIDER_PROFILE_INVALID");
  }
  if ((input.role === "selector_swap") !== input.hasConversationParent) {
    throw new Error("XUANXUE_AI_PRODUCTION_LOCALIZATION_CONVERSATION_PARENT_INVALID");
  }
}
