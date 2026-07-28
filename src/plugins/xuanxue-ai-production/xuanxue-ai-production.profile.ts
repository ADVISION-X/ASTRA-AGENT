import { createHash } from "node:crypto";

import type {
  XuanxueAiProductId,
  XuanxueAiProductionOrder,
  XuanxueAiStageId,
} from "./xuanxue-ai-production.schema.js";

export interface XuanxueAiStageDefinition {
  readonly stageId: XuanxueAiStageId;
  readonly dependsOn: readonly XuanxueAiStageId[];
  readonly continuationFrom: XuanxueAiStageId | null;
  readonly generatedInputsFrom: readonly XuanxueAiStageId[];
}

export interface XuanxueAiProductionProfile {
  readonly productId: XuanxueAiProductId;
  readonly stages: readonly XuanxueAiStageDefinition[];
  readonly finalStageId: XuanxueAiStageId;
}

const baziStages: readonly XuanxueAiStageDefinition[] = [
  {
    stageId: "base_interpretation",
    dependsOn: [],
    continuationFrom: null,
    generatedInputsFrom: [],
  },
  {
    stageId: "question_analysis",
    dependsOn: ["base_interpretation"],
    continuationFrom: "base_interpretation",
    generatedInputsFrom: ["base_interpretation"],
  },
];

const profiles: Readonly<Record<
  XuanxueAiProductId,
  XuanxueAiProductionProfile
>> = {
  bazi_ai_full_analysis: {
    productId: "bazi_ai_full_analysis",
    stages: baziStages,
    finalStageId: "question_analysis",
  },
  bazi_report_followup: {
    productId: "bazi_report_followup",
    stages: baziStages,
    finalStageId: "question_analysis",
  },
  qimen_professional_answer: {
    productId: "qimen_professional_answer",
    stages: [{
      stageId: "analysis",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "analysis",
  },
  qimen_report_followup: {
    productId: "qimen_report_followup",
    stages: [{
      stageId: "followup",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "followup",
  },
  hehun_ai_analysis: {
    productId: "hehun_ai_analysis",
    stages: [
      {
        stageId: "party_a_interpretation",
        dependsOn: [],
        continuationFrom: null,
        generatedInputsFrom: [],
      },
      {
        stageId: "party_b_interpretation",
        dependsOn: [],
        continuationFrom: null,
        generatedInputsFrom: [],
      },
      {
        stageId: "final_compatibility",
        dependsOn: [
          "party_a_interpretation",
          "party_b_interpretation",
        ],
        continuationFrom: "party_b_interpretation",
        generatedInputsFrom: [
          "party_a_interpretation",
          "party_b_interpretation",
        ],
      },
    ],
    finalStageId: "final_compatibility",
  },
  hehun_report_followup: {
    productId: "hehun_report_followup",
    stages: [{
      stageId: "followup",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "followup",
  },
  naming_bazi_analysis_and_naming: {
    productId: "naming_bazi_analysis_and_naming",
    stages: [
      ...baziStages,
      {
        stageId: "naming_author",
        dependsOn: ["question_analysis"],
        continuationFrom: null,
        generatedInputsFrom: ["question_analysis"],
      },
    ],
    finalStageId: "naming_author",
  },
  naming_from_existing_bazi_report: {
    productId: "naming_from_existing_bazi_report",
    stages: [{
      stageId: "naming_author",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "naming_author",
  },
  manual_accuracy_challenge: {
    productId: "manual_accuracy_challenge",
    stages: [{
      stageId: "manual_accuracy_challenge",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "manual_accuracy_challenge",
  },
  payment_screenshot_observation: {
    productId: "payment_screenshot_observation",
    stages: [{
      stageId: "payment_screenshot_observation",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "payment_screenshot_observation",
  },
  public_knowledge_article_pipeline: {
    productId: "public_knowledge_article_pipeline",
    stages: [
      {
        stageId: "corpus_research",
        dependsOn: [],
        continuationFrom: null,
        generatedInputsFrom: [],
      },
      {
        stageId: "article_synthesis",
        dependsOn: ["corpus_research"],
        continuationFrom: "corpus_research",
        generatedInputsFrom: ["corpus_research"],
      },
    ],
    finalStageId: "article_synthesis",
  },
};

export const resolveXuanxueAiProductionProfile = (
  productId: XuanxueAiProductId,
): XuanxueAiProductionProfile => profiles[productId];

export const assertXuanxueAiOrderMatchesProfile = (
  order: XuanxueAiProductionOrder,
): XuanxueAiProductionProfile => {
  const profile = resolveXuanxueAiProductionProfile(order.productId);
  const received = order.materials.map((material) => material.stageId);
  const expected = profile.stages.map((stage) => stage.stageId);
  if (
    received.length !== expected.length
    || received.some((stageId, index) => stageId !== expected[index])
    || new Set(received).size !== received.length
  ) {
    throw new Error(
      `XUANXUE_AI_PRODUCTION_PROFILE_MISMATCH:${order.productId}:`
      + `${expected.join(",")}:${received.join(",")}`,
    );
  }
  const seededIds = order.seededStages.map((stage) => stage.stageId);
  if (
    seededIds.some((stageId, index) => stageId !== expected[index])
    || new Set(seededIds).size !== seededIds.length
    || (
      order.productId === "manual_accuracy_challenge"
      && seededIds.length > 0
    )
  ) {
    throw new Error(
      "XUANXUE_AI_PRODUCTION_SEEDED_STAGE_PROFILE_INVALID",
    );
  }
  for (const stage of order.seededStages) {
    const actualHash =
      `sha256:${createHash("sha256").update(
        stage.rawResponseText,
        "utf8",
      ).digest("hex")}`;
    const outputRefs = Array.isArray(stage.providerProof.outputRefs)
      ? stage.providerProof.outputRefs
      : [];
    if (
      actualHash !== stage.rawOutputHash
      || stage.providerProof.providerKind !== "gpt-web-chat"
      || typeof stage.providerProof.webChatUrl !== "string"
      || !stage.providerProof.webChatUrl.startsWith("https://chatgpt.com/")
      || outputRefs.length < 1
    ) {
      throw new Error(
        "XUANXUE_AI_PRODUCTION_SEEDED_STAGE_PROOF_INVALID",
      );
    }
  }
  if (
    (order.productId === "manual_accuracy_challenge")
      !== Boolean(order.continuationParent)
  ) {
    throw new Error(
      "XUANXUE_AI_PRODUCTION_CONTINUATION_PROFILE_INVALID",
    );
  }
  return profile;
};
