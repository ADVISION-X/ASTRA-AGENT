import { z } from "zod";

const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

export const XuanxueLocalizationRoleSchema = z.string().min(1).max(120);
export type XuanxueLocalizationRole = z.infer<typeof XuanxueLocalizationRoleSchema>;

export const XuanxueProviderExecutionProfileSchema = z.object({
  profile_ref: z.string().min(1),
  profile_hash: hashSchema.transform((value): `sha256:${string}` => value as `sha256:${string}`),
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

export function assertXuanxueLocalizationContract(input: {
  readonly contractManifestHash: string | null;
  readonly productContractHash: string;
  readonly role: XuanxueLocalizationRole | null;
  readonly providerProfile: XuanxueProviderExecutionProfile | null;
  readonly inputKinds: readonly string[];
}): void {
  if (!input.role
    || !input.contractManifestHash
    || !hashSchema.safeParse(input.contractManifestHash).success
    || !hashSchema.safeParse(input.productContractHash).success
    || !input.providerProfile
    || input.inputKinds.length === 0) {
    throw new Error("XUANXUE_AI_PRODUCTION_LOCALIZATION_CONTRACT_INVALID");
  }
}
