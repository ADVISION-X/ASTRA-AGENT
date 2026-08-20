/**
 * The one commercial-metaphysics provider profile admitted by this factory.
 * `reasoningTier` is the immutable request contract; `reasoningUiLabel` is the
 * exact value the GPT Web UI must read back in the Gateway evidence.
 */
export const xuanxueTerminalMetaphysicsProviderProfile = {
  modelLabel: "GPT-5.6 Sol",
  modelFamily: "gpt-5.6",
  reasoningTier: "pro_standard",
  reasoningUiLabel: "Pro",
} as const;

const terminalMetaphysicsProductIds = new Set<string>([
  "bazi_chart_interpretation",
  "bazi_ai_full_analysis",
  "bazi_report_followup",
  "qimen_professional_answer",
  "qimen_report_followup",
  "hehun_ai_analysis",
  "hehun_report_followup",
  "naming_bazi_analysis_and_naming",
  "naming_from_existing_bazi_report",
  "bazi_canonical_base_interpretation",
  "hehun_canonical_party_a_interpretation",
  "hehun_canonical_party_b_interpretation",
]);

export const isXuanxueTerminalMetaphysicsProduct = (
  productId: string,
): boolean => terminalMetaphysicsProductIds.has(productId);

export const isXuanxueTerminalMetaphysicsProfile = (
  profile: Record<string, unknown> | null | undefined,
): boolean => Boolean(
  profile
  && profile.provider === "openai-chatgpt-web"
  && profile.transport === "gpt-web-chat"
  && profile.model_label === xuanxueTerminalMetaphysicsProviderProfile.modelLabel
  && profile.model_family === xuanxueTerminalMetaphysicsProviderProfile.modelFamily
  && profile.model_identity_status === "verified"
  && profile.reasoning_effort === xuanxueTerminalMetaphysicsProviderProfile.reasoningTier,
);
