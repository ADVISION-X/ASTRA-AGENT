import assert from "node:assert/strict";

import {
  createXuanxueAiProductionOrder,
  executeXuanxueAiProductionOrder,
  type XuanxueAiOrderRecord,
  type XuanxueAiProductionOrder,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import {
  type FixtureGateway,
  order,
} from "./xuanxue-ai-production-fixture.js";

type StageRecord = XuanxueAiOrderRecord["stages"][number];

interface GraphAcceptanceInput {
  readonly runtime: XuanxueAiProductionRuntime;
  readonly gateway: FixtureGateway;
}

interface ParentGraph {
  readonly order: XuanxueAiProductionOrder;
  readonly finalStage: StageRecord;
}

export interface AcceptedOrderGraphs {
  readonly hehun: XuanxueAiProductionOrder;
  readonly qimenFollowupParent: XuanxueAiProductionOrder;
  readonly qimenFollowupParentFinal: StageRecord;
}

const complete = async (
  input: GraphAcceptanceInput,
  candidate: XuanxueAiProductionOrder,
  finalStageId: StageRecord["stageId"],
): Promise<ParentGraph> => {
  createXuanxueAiProductionOrder(input.runtime, candidate);
  const result = await executeXuanxueAiProductionOrder(
    input.runtime,
    candidate.orderId,
  );
  assert.equal(result.status, "completed");
  const finalStage = result.stages.find(
    (stage) => stage.stageId === finalStageId,
  );
  assert.ok(finalStage?.rawOutputHash);
  assert.ok(finalStage.aiFeedResult?.providerProof.webChatUrl);
  return { order: candidate, finalStage };
};

const continuation = (
  parent: ParentGraph,
): NonNullable<XuanxueAiProductionOrder["continuationParent"]> => ({
  jobId: parent.order.orderId,
  stageId: parent.finalStage.stageId,
  rawOutputHash: parent.finalStage.rawOutputHash!,
});

const acceptReusableBaziGraph = async (
  input: GraphAcceptanceInput,
): Promise<{
  readonly base: ParentGraph;
  readonly analysis: ParentGraph;
}> => {
  const base = await complete(
    input,
    order(
      "aiprod_bazi_reusable_base",
      "bazi_canonical_base_interpretation",
      ["base_interpretation"],
    ),
    "base_interpretation",
  );
  const analysisOrder: XuanxueAiProductionOrder = {
    ...order(
      "aiprod_bazi_analysis_consumer",
      "bazi_ai_full_analysis",
      ["question_analysis"],
    ),
    continuationParent: continuation(base),
  };
  const analysis = await complete(
    input,
    analysisOrder,
    "question_analysis",
  );
  assert.equal(
    analysis.finalStage.aiFeedResult?.providerProof.webChatUrl,
    base.finalStage.aiFeedResult?.providerProof.webChatUrl,
    "the paid question must continue the reusable Bazi base conversation",
  );
  const questionRequest = input.gateway.requests.find(
    (request) =>
      request.taskIdentity.taskKind === "bazi_ai_full_analysis",
  );
  assert.equal(
    questionRequest?.providerContinuationRef?.priorTaskId,
    base.finalStage.executionId,
  );
  assert.ok(questionRequest?.inputRefs.some(
    (ref) =>
      ref.kind === "prior_stage_raw_response"
      && ref.sha256 === base.finalStage.rawOutputHash,
  ));
  return { base, analysis };
};

const acceptNamingConsumer = async (
  input: GraphAcceptanceInput,
  base: ParentGraph,
): Promise<void> => {
  const namingOrder: XuanxueAiProductionOrder = {
    ...order(
      "aiprod_naming_reusable_base_consumer",
      "naming_bazi_analysis_and_naming",
      ["question_analysis", "naming_author"],
    ),
    continuationParent: continuation(base),
  };
  createXuanxueAiProductionOrder(input.runtime, namingOrder);
  const result = await executeXuanxueAiProductionOrder(
    input.runtime,
    namingOrder.orderId,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.stages.length, 2);
  assert.equal(
    new Set([
      base.finalStage.aiFeedResult?.providerProof.webChatUrl,
      ...result.stages.map(
        (stage) => stage.aiFeedResult?.providerProof.webChatUrl,
      ),
    ]).size,
    1,
    "question and naming must continue the exact reusable base chat",
  );
  const authorRequest = input.gateway.requests.find(
    (request) =>
      request.taskIdentity.taskKind
        === "naming_bazi_analysis_and_naming"
      && request.roundId === "naming_author",
  );
  const questionStage = result.stages.find(
    (stage) => stage.stageId === "question_analysis",
  );
  assert.equal(
    authorRequest?.providerContinuationRef?.priorTaskId,
    questionStage?.executionId,
    "naming must continue the immediately preceding question turn",
  );
};

const acceptHehunGraph = async (
  input: GraphAcceptanceInput,
): Promise<ParentGraph> => {
  const partyA = await complete(
    input,
    order(
      "aiprod_hehun_reusable_party_a",
      "hehun_canonical_party_a_interpretation",
      ["party_a_interpretation"],
    ),
    "party_a_interpretation",
  );
  const partyB = await complete(
    input,
    order(
      "aiprod_hehun_reusable_party_b",
      "hehun_canonical_party_b_interpretation",
      ["party_b_interpretation"],
    ),
    "party_b_interpretation",
  );
  const relationship = await complete(
    input,
    order(
      "aiprod_hehun_relationship",
      "hehun_ai_analysis",
      ["final_compatibility"],
    ),
    "final_compatibility",
  );
  assert.equal(
    new Set([
      partyA.finalStage.aiFeedResult?.providerProof.webChatUrl,
      partyB.finalStage.aiFeedResult?.providerProof.webChatUrl,
      relationship.finalStage.aiFeedResult?.providerProof.webChatUrl,
    ]).size,
    3,
    "two reusable private bases and one relationship chat are independent",
  );
  return relationship;
};

const acceptPaidFollowups = async (
  input: GraphAcceptanceInput,
  parents: {
    readonly bazi: ParentGraph;
    readonly qimen: ParentGraph;
    readonly hehun: ParentGraph;
    readonly reusableBaziBase: ParentGraph;
  },
): Promise<void> => {
  const reusableBase = parents.reusableBaziBase.finalStage;
  assert.ok(
    reusableBase.rawResponseText
    && reusableBase.rawOutputHash
    && reusableBase.aiFeedResult,
  );
  const cases = [
    {
      productId: "bazi_report_followup" as const,
      stages: ["base_interpretation", "question_analysis"] as const,
      parent: parents.bazi,
      label: "bazi_analysis",
      seededStages: [{
        stageId: "base_interpretation" as const,
        executionId: reusableBase.executionId,
        rawResponseText: reusableBase.rawResponseText,
        rawOutputHash: reusableBase.rawOutputHash,
        providerProof: reusableBase.aiFeedResult.providerProof,
        transportWarnings:
          reusableBase.aiFeedResult.transportWarnings ?? [],
      }],
    },
    {
      productId: "qimen_report_followup" as const,
      stages: ["followup"] as const,
      parent: parents.qimen,
      label: "qimen_analysis",
      seededStages: [],
    },
    {
      productId: "hehun_report_followup" as const,
      stages: ["followup"] as const,
      parent: parents.hehun,
      label: "hehun_analysis",
      seededStages: [],
    },
  ];
  for (const fixture of cases) {
    const candidate: XuanxueAiProductionOrder = {
      ...order(
        `aiprod_${fixture.productId}`,
        fixture.productId,
        fixture.stages,
      ),
      continuationParent: continuation(fixture.parent),
      seededStages: fixture.seededStages,
    };
    const before = input.gateway.requests.length;
    createXuanxueAiProductionOrder(input.runtime, candidate);
    const result = await executeXuanxueAiProductionOrder(
      input.runtime,
      candidate.orderId,
    );
    assert.equal(result.status, "completed");
    assert.equal(
      input.gateway.requests.length - before,
      1,
      "every paid followup performs exactly one new AI call",
    );
    assert.equal(
      input.gateway.requests.at(-1)?.taskIdentity.labelKey,
      fixture.label,
    );
  }
};

const acceptSingleStageProducts = async (
  input: GraphAcceptanceInput,
): Promise<void> => {
  for (const [productId, stageId, label] of [
    [
      "naming_from_existing_bazi_report",
      "naming_author",
      "naming_analysis",
    ],
    [
      "payment_screenshot_observation",
      "payment_screenshot_observation",
      "generic_ai",
    ],
  ] as const) {
    const candidate = order(
      `aiprod_${productId}`,
      productId,
      [stageId],
    );
    await complete(input, candidate, stageId);
    assert.equal(
      input.gateway.requests.at(-1)?.taskIdentity.labelKey,
      label,
    );
  }
};

const acceptManualChallenge = async (
  input: GraphAcceptanceInput,
  hehun: ParentGraph,
): Promise<void> => {
  const challenge: XuanxueAiProductionOrder = {
    ...order(
      "aiprod_manual_challenge",
      "manual_accuracy_challenge",
      ["manual_accuracy_challenge"],
    ),
    continuationParent: continuation(hehun),
  };
  const result = await complete(
    input,
    challenge,
    "manual_accuracy_challenge",
  );
  assert.equal(
    result.finalStage.aiFeedResult?.providerProof.webChatUrl,
    hehun.finalStage.aiFeedResult?.providerProof.webChatUrl,
  );
};

export const acceptXuanxueOrderGraphs = async (
  input: GraphAcceptanceInput,
): Promise<AcceptedOrderGraphs> => {
  const bazi = await acceptReusableBaziGraph(input);
  await acceptNamingConsumer(input, bazi.base);
  const hehun = await acceptHehunGraph(input);
  const qimen = await complete(
    input,
    order(
      "aiprod_qimen_followup_parent",
      "qimen_professional_answer",
      ["analysis"],
    ),
    "analysis",
  );
  await acceptPaidFollowups(input, {
    bazi: bazi.analysis,
    qimen,
    hehun,
    reusableBaziBase: bazi.base,
  });
  await acceptSingleStageProducts(input);
  await acceptManualChallenge(input, hehun);
  return {
    hehun: hehun.order,
    qimenFollowupParent: qimen.order,
    qimenFollowupParentFinal: qimen.finalStage,
  };
};
