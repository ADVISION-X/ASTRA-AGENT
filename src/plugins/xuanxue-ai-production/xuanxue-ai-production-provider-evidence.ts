import { createHash } from "node:crypto";

import type { AiFeedResult } from "../../capabilities/ai-input-gateway/index.js";
import type { XuanxueAiOrderRecord } from "./xuanxue-ai-production.schema.js";
import {
  isXuanxueTerminalMetaphysicsProfile,
  xuanxueTerminalMetaphysicsProviderProfile,
} from "./xuanxue-ai-production-terminal-profile.js";

const record = (value: unknown): Readonly<Record<string, unknown>> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : null;

const localizationTranscriptValid = (transcript: string): boolean => {
  if (!transcript.trim()) return false;
  const forbidden = new Set(["tool_call", "tool_result", "browser_action", "computer_call", "function_call", "command_execution"]);
  for (const line of transcript.trim().split("\n")) {
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      return false;
    }
    const eventRecord = record(event);
    const item = record(eventRecord?.item);
    const kinds = [eventRecord?.type, eventRecord?.event, item?.type]
      .filter((value): value is string => typeof value === "string");
    if (kinds.some((kind) => forbidden.has(kind))) return false;
  }
  return true;
};

const localizationProviderEvidenceFailure = (
  result: AiFeedResult,
  order: XuanxueAiOrderRecord["order"],
): string | null => {
  if (order.serviceClass !== "localization") return null;
  const expected = order.providerExecutionProfile;
  const identity = result.providerProof.modelIdentityProof;
  const transcript = result.providerProof.providerTranscriptJsonl;
  const transcriptHash = result.providerProof.providerTranscriptHash;
  const actualTranscriptHash = transcript
    ? `sha256:${createHash("sha256").update(transcript).digest("hex")}`
    : null;
  if (!expected || !identity || identity.proofStatus !== "verified"
    || identity.modelFamily !== expected.model_family
    || identity.modelDisplayName !== expected.model_label
    || identity.reasoningEffort !== expected.reasoning_effort) {
    return "XUANXUE_AI_PRODUCTION_LOCALIZATION_MODEL_IDENTITY_MISMATCH";
  }
  if (!transcript || !transcriptHash || transcriptHash !== actualTranscriptHash
    || !localizationTranscriptValid(transcript)) {
    return "XUANXUE_AI_PRODUCTION_LOCALIZATION_PROVIDER_TRANSCRIPT_INVALID";
  }
  return null;
};

const terminalMetaphysicsProviderEvidenceFailure = (
  result: AiFeedResult,
  order: XuanxueAiOrderRecord["order"],
): string | null => {
  if (order.serviceClass === "localization") return null;
  const expected = order.providerExecutionProfile as Record<string, unknown>;
  const profileProof = result.providerProof.providerExecutionProfileProof;
  const identity = result.providerProof.modelIdentityProof;
  if (!isXuanxueTerminalMetaphysicsProfile(expected)) {
    return "XUANXUE_AI_PRODUCTION_GPT_5_6_SOL_PROFILE_MISMATCH";
  }
  if (!terminalProfileProofValid(profileProof) || !terminalIdentityProofValid(identity)) {
    return "XUANXUE_AI_PRODUCTION_GPT_5_6_SOL_PROVIDER_PROOF_MISMATCH";
  }
  return null;
};

const terminalProfileProofValid = (
  proof: AiFeedResult["providerProof"]["providerExecutionProfileProof"],
): boolean => Boolean(proof && proof.proofStatus === "verified"
  && proof.provider === "openai-chatgpt-web"
  && proof.transport === "gpt-web-chat"
  && proof.modelDisplayName === xuanxueTerminalMetaphysicsProviderProfile.modelLabel
  && proof.modelFamily === xuanxueTerminalMetaphysicsProviderProfile.modelFamily
  && proof.reasoningTier === xuanxueTerminalMetaphysicsProviderProfile.reasoningTier);

const terminalIdentityProofValid = (
  proof: AiFeedResult["providerProof"]["modelIdentityProof"],
): boolean => Boolean(proof && proof.proofStatus === "verified"
  && proof.modelIdentityStatus === "verified"
  && proof.modelDisplayName === xuanxueTerminalMetaphysicsProviderProfile.modelLabel
  && proof.modelFamily === xuanxueTerminalMetaphysicsProviderProfile.modelFamily
  && proof.reasoningEffort === xuanxueTerminalMetaphysicsProviderProfile.reasoningUiLabel);

export const xuanxueProviderEvidenceFailure = (
  result: AiFeedResult,
  order: XuanxueAiOrderRecord["order"],
): string | null => localizationProviderEvidenceFailure(result, order)
  ?? terminalMetaphysicsProviderEvidenceFailure(result, order);
