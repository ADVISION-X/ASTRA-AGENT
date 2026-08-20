import { createHash } from "node:crypto";

import type {
  AiFeedInput,
  AiFeedResult,
} from "../../src/capabilities/ai-input-gateway/index.js";
import type {
  XuanxueAiProductionOrder,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import {
  expectedLocalizationProviderProfile,
  isXuanxueLocalizationProduct,
  type XuanxueLocalizationRole,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-localization-contract.js";
import {
  isXuanxueTerminalMetaphysicsProduct,
  xuanxueTerminalMetaphysicsProviderProfile,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-terminal-profile.js";

export const fixtureHash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

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
    ...(isXuanxueLocalizationProduct(input.taskIdentity.taskKind) ? {
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
      legacyReasoningEffort: profile.reasoningTier.startsWith("pro_") ? "pro" : profile.reasoningTier,
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
) => localizationRole ? expectedLocalizationProviderProfile(localizationRole)
  : isXuanxueTerminalMetaphysicsProduct(productId) ? {
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
