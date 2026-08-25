import { createHash } from "node:crypto";

import type {
  AiFeedInput,
  AiFeedResult,
} from "../../src/capabilities/ai-input-gateway/index.js";
import type {
  XuanxueAiProductionOrder,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import type { XuanxueLocalizationRole } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-localization-contract.js";
import {
  xuanxueTerminalMetaphysicsProviderProfile,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-terminal-profile.js";

export const fixtureHash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const isFixtureLocalizationProduct = (productId: string): boolean =>
  productId.startsWith("localization_");

const isFixtureTerminalProduct = (productId: string): boolean =>
  !isFixtureLocalizationProduct(productId)
  && !["manual_accuracy_challenge", "payment_screenshot_observation", "public_knowledge_article_pipeline", "scheduled_quality_reflection"].includes(productId);

const fixtureLocalizationProfile = (role: string) => ({
  profile_ref: `fixture:localization:${role}`,
  profile_hash: fixtureHash(`fixture:localization:${role}`),
  provider: "gpt-web-chat" as const,
  transport: "web-chat" as const,
  account_capability_ref: "agent:gpt-web-chat:localization" as const,
  model_label: "GPT-5.6 Sol" as const,
  model_family: "gpt-5.6" as const,
  model_identity_status: "verified" as const,
  reasoning_effort: (role === "candidate_a" ? "xhigh" : "high") as "xhigh" | "high",
  executor_identity_ref: "supervised_local_gpt_web" as const,
  ai_acceptance_ref: "APEX-AI-ACCEPTANCE-001-V5" as const,
  ai_acceptance_version: "5.2" as const,
});

export const fixtureModelIdentityProof = (
  input: AiFeedInput,
  rawResponseText: string,
  verifiedAt: string,
): Pick<AiFeedResult["providerProof"], "modelIdentityProof" | "providerTranscriptJsonl" | "providerTranscriptHash"> => {
  const profile = input.providerExecutionProfile;
  if (!profile) return {};
  const transcript = `${JSON.stringify({
    type: "assistant_message", source: "fixture",
    task: input.taskIdentity.sourceTaskId, text: rawResponseText,
  })}\n`;
  return {
    modelIdentityProof: {
      proofStatus: "verified" as const,
      modelFamily: profile.modelFamily,
      modelDisplayName: profile.modelDisplayName,
      modelIdentityStatus: "verified" as const,
      reasoningEffort: profile.reasoningTier === "extra_high" ? "xhigh"
        : profile.reasoningTier.startsWith("pro_") ? "Pro" : profile.reasoningTier,
      observedAt: verifiedAt,
      sourceKind: "provider_ui_observation" as const,
      evidenceRef: `fixture-model-evidence:${input.taskIdentity.sourceTaskId}`,
      evidenceHash: fixtureHash(`fixture-model-evidence:${input.taskIdentity.sourceTaskId}`),
    },
    ...(isFixtureLocalizationProduct(input.taskIdentity.taskKind) ? {
      providerTranscriptJsonl: transcript,
      providerTranscriptHash: fixtureHash(transcript),
    } : {}),
  };
};

export const fixtureProviderExecutionProfileProof = (
  input: AiFeedInput,
): Pick<AiFeedResult["providerProof"], "providerExecutionProfileProof"> => {
  const profile = input.providerExecutionProfile;
  if (!profile) return {};
  const observedAt = new Date().toISOString();
  const evidenceHash = fixtureHash(JSON.stringify({ profile, observedAt }));
  return {
    providerExecutionProfileProof: {
      proofStatus: "verified" as const,
      profileRef: profile.profileRef,
      profileHash: profile.profileHash,
      provider: profile.provider,
      transport: profile.transport,
      modelDisplayName: profile.modelDisplayName,
      modelFamily: profile.modelFamily,
      reasoningTier: profile.reasoningTier,
      reasoningUiLabel: profile.reasoningTier,
      observedAt,
      sourceKind: "provider_ui_observation" as const,
      noOp: false,
      evidenceRef: `fixture-profile:${evidenceHash.slice(7)}`,
      evidenceHash,
    },
  };
};

export const fixtureOrderProviderExecutionProfile = (
  productId: XuanxueAiProductionOrder["productId"],
  localizationRole: XuanxueLocalizationRole | undefined,
) => localizationRole ? fixtureLocalizationProfile(localizationRole)
  : isFixtureTerminalProduct(productId) ? {
    profile_ref: "fixture:xuanxue-gpt-5-6-sol-pro-standard",
    profile_hash: fixtureHash("fixture:xuanxue-gpt-5-6-sol-pro-standard"),
    provider: "openai-chatgpt-web" as const,
    transport: "gpt-web-chat" as const,
    account_capability_ref: "fixture:chatgpt-pro",
    model_label: xuanxueTerminalMetaphysicsProviderProfile.modelLabel,
    model_family: xuanxueTerminalMetaphysicsProviderProfile.modelFamily,
    model_identity_status: "verified" as const,
    reasoning_effort: xuanxueTerminalMetaphysicsProviderProfile.reasoningTier,
    executor_identity_ref: "fixture:operator",
    ai_acceptance_ref: "fixture:ai-acceptance",
    ai_acceptance_version: "fixture-v1",
  } : null;
