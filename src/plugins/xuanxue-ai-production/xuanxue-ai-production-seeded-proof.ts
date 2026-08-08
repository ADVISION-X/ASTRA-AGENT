import { createHash } from "node:crypto";

import type {
  XuanxueAiProductionOrder,
  XuanxueAiStageId,
} from "./xuanxue-ai-production.schema.js";

const recordValue = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

type SeededTopologyProofs = {
  fresh: Record<string, unknown> | null;
  same: Record<string, unknown> | null;
  fork: Record<string, unknown> | null;
};

const seededTopologyProofs = (
  providerProof: Record<string, unknown>,
): SeededTopologyProofs => ({
  fresh: recordValue(providerProof.freshConversationProof),
  same: recordValue(providerProof.sameConversationProof),
  fork: recordValue(providerProof.forkedFromCheckpointProof),
});

const validFreshSeed = (
  proofs: SeededTopologyProofs,
  webChatUrl: string,
): boolean => Boolean(
  proofs.fresh
  && proofs.same === null
  && proofs.fork === null
  && proofs.fresh.createdConversationUrl === webChatUrl
  && proofs.fresh.preSubmitUserTurnCount === 0
  && proofs.fresh.preSubmitAssistantTurnCount === 0
  && nonEmptyString(proofs.fresh.firstTurnMarker)
  && nonEmptyString(proofs.fresh.createdByExecutionId),
);

const validSameConversationSeed = (
  proofs: SeededTopologyProofs,
  webChatUrl: string,
): boolean => Boolean(
  proofs.same
  && proofs.fresh === null
  && proofs.fork === null
  && proofs.same.actualConversationUrl === webChatUrl
  && nonEmptyString(proofs.same.parentConversationUrl)
  && nonEmptyString(proofs.same.parentRawOutputHash)
  && nonEmptyString(proofs.same.newTurnMarker),
);

const validForkSeed = (
  proofs: SeededTopologyProofs,
  webChatUrl: string,
): boolean => Boolean(
  proofs.fork
  && proofs.fresh === null
  && proofs.same === null
  && proofs.fork.childConversationUrl === webChatUrl
  && nonEmptyString(proofs.fork.parentConversationUrl)
  && nonEmptyString(proofs.fork.parentCheckpointTurnMarker)
  && nonEmptyString(proofs.fork.parentCheckpointResponseHash)
  && nonEmptyString(proofs.fork.forkActionEvidenceRef)
  && nonEmptyString(proofs.fork.forkActionEvidenceHash)
  && nonEmptyString(proofs.fork.childInitialHistoryFingerprint)
  && nonEmptyString(proofs.fork.childFirstTurnMarker),
);

const validSeededTopologyProof = (input: {
  providerProof: Record<string, unknown>;
  expectedMode: "fresh" | "same_conversation" | "forked_from_checkpoint";
  webChatUrl: string;
}): boolean => {
  const proofs = seededTopologyProofs(input.providerProof);
  if (input.expectedMode === "fresh") {
    return validFreshSeed(proofs, input.webChatUrl);
  }
  return input.expectedMode === "same_conversation"
    ? validSameConversationSeed(proofs, input.webChatUrl)
    : validForkSeed(proofs, input.webChatUrl);
};

const assertSeedProfile = (
  order: XuanxueAiProductionOrder,
  expected: readonly XuanxueAiStageId[],
): void => {
  const seededIds = order.seededStages.map((stage) => stage.stageId);
  if (
    seededIds.some((stageId, index) => stageId !== expected[index])
    || new Set(seededIds).size !== seededIds.length
    || (order.productId === "manual_accuracy_challenge" && seededIds.length > 0)
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_SEEDED_STAGE_PROFILE_INVALID");
  }
};

export const assertSeededStages = (
  order: XuanxueAiProductionOrder,
  expected: readonly XuanxueAiStageId[],
): void => {
  assertSeedProfile(order, expected);
  for (const stage of order.seededStages) {
    const actualHash = `sha256:${createHash("sha256").update(
      stage.rawResponseText,
      "utf8",
    ).digest("hex")}`;
    const outputRefs = Array.isArray(stage.providerProof.outputRefs)
      ? stage.providerProof.outputRefs
      : [];
    const expectedMode = expected.indexOf(stage.stageId) > 0
      ? "same_conversation"
      : order.conversationParent?.relation ?? "fresh";
    const webChatUrl = stage.providerProof.webChatUrl;
    if (
      actualHash !== stage.rawOutputHash
      || stage.providerProof.providerKind !== "gpt-web-chat"
      || typeof webChatUrl !== "string"
      || !webChatUrl.startsWith("https://chatgpt.com/")
      || stage.providerProof.conversationMode !== expectedMode
      || !validSeededTopologyProof({
        providerProof: stage.providerProof,
        expectedMode,
        webChatUrl,
      })
      || outputRefs.length < 1
    ) {
      throw new Error("XUANXUE_AI_PRODUCTION_SEEDED_STAGE_PROOF_INVALID");
    }
  }
};
