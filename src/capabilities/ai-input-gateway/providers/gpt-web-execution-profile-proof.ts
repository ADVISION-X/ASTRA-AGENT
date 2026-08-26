import { createHash } from "node:crypto";

import type { ProviderExecutionProfileProof } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

export const buildGptWebExecutionProfileProof = (input: {
  profile: NonNullable<AiFeedInput["providerExecutionProfile"]>;
  reasoningUiLabel: string;
  noOp: boolean;
  modelCandidateCount: number;
  reasoningCandidateCount: number;
}): ProviderExecutionProfileProof => {
  const observedAt = new Date().toISOString();
  const payload = {
    profileHash: input.profile.profileHash,
    modelDisplayName: input.profile.modelDisplayName,
    reasoningTier: input.profile.reasoningTier,
    reasoningUiLabel: input.reasoningUiLabel,
    modelCandidateCount: input.modelCandidateCount,
    reasoningCandidateCount: input.reasoningCandidateCount,
    noOp: input.noOp,
    observedAt,
  };
  const evidenceHash = `sha256:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}` as const;
  return {
    proofStatus: "verified",
    profileRef: input.profile.profileRef,
    profileHash: input.profile.profileHash,
    provider: input.profile.provider,
    transport: input.profile.transport,
    modelDisplayName: input.profile.modelDisplayName,
    modelFamily: input.profile.modelFamily,
    reasoningTier: input.profile.reasoningTier,
    reasoningUiLabel: input.reasoningUiLabel,
    observedAt,
    sourceKind: "provider_ui_observation",
    noOp: input.noOp,
    evidenceRef: `provider-dom-action:gpt-web-execution-profile:${evidenceHash.slice(7)}`,
    evidenceHash,
  };
};
