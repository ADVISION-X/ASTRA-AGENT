import assert from "node:assert/strict";

import {
  createXuanxueAiProductionOrder,
  executeXuanxueAiProductionOrder,
  XUANXUE_AI_PRODUCTION_JOB_ID,
  type XuanxueAiProductionOrder,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import {
  type FixtureGateway,
  hash,
  order,
} from "./xuanxue-ai-production-fixture.js";

type StageRecord = Awaited<
  ReturnType<typeof executeXuanxueAiProductionOrder>
>["stages"][number];

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

const acceptHehunGraph = async (
  input: GraphAcceptanceInput,
): Promise<ParentGraph> => {
  const candidate = order("aiprod_hehun", "hehun_ai_analysis", [
    "party_a_interpretation",
    "party_b_interpretation",
    "final_compatibility",
  ]);
  createXuanxueAiProductionOrder(input.runtime, candidate);
  const result = await executeXuanxueAiProductionOrder(
    input.runtime,
    candidate.orderId,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.result?.stages.length, 3);
  assert.equal(
    input.gateway.requests.every((request) =>
      request.inputRefs.some((ref) =>
        ref.id === `bundle:${request.runId}` && !ref.filePath)),
    true,
  );
  assert.deepEqual(
    input.gateway.started.slice(0, 3).map(
      (value) => value.split(":").at(-1),
    ),
    [
      "party_a_interpretation",
      "party_b_interpretation",
      "final_compatibility",
    ],
    "every stage of one order must run serially in one GPT conversation",
  );
  const partyB = input.gateway.requests.find(
    (request) => request.roundId === "party_b_interpretation",
  );
  const finalRequest = input.gateway.requests.find(
    (request) => request.roundId === "final_compatibility",
  );
  assert.equal(
    input.gateway.requests.find(
      (request) => request.roundId === "party_a_interpretation",
    )?.providerContinuationRef,
    undefined,
  );
  assert.equal(
    partyB?.providerContinuationRef?.priorTaskId,
    `${XUANXUE_AI_PRODUCTION_JOB_ID}:`
      + `${candidate.orderId}:party_a_interpretation`,
  );
  assert.ok(finalRequest?.providerContinuationRef);
  assert.ok(finalRequest.inputRefs.some(
    (ref) => ref.kind === "prior_stage_raw_response",
  ));
  assert.equal(
    new Set(result.stages.map(
      (stage) => stage.aiFeedResult?.providerProof.webChatUrl,
    )).size,
    1,
    "all Hehun stages must remain in the first stage conversation",
  );
  const finalStage = result.stages.find(
    (stage) => stage.stageId === "final_compatibility",
  );
  assert.ok(finalStage?.rawOutputHash);
  return { order: candidate, finalStage };
};

const repairLegacyNamingGraph = async (
  input: GraphAcceptanceInput,
  namingResult: Awaited<ReturnType<typeof executeXuanxueAiProductionOrder>>,
): Promise<void> => {
  const legacy = {
    ...order(
      "aiprod_legacy_naming_contract",
      "naming_bazi_analysis_and_naming",
      ["base_interpretation", "question_analysis", "naming_author"],
    ),
    requestHash: hash("legacy-naming-conversation-contract"),
  };
  legacy.materials[2] = {
    ...legacy.materials[2]!,
    textPrompt:
      "这是整张“八字分析并起名”生产订单的第三步，也是一个全新的 ChatGPT 会话。",
  };
  createXuanxueAiProductionOrder(input.runtime, legacy);
  for (const stageId of ["base_interpretation", "question_analysis"] as const) {
    const source = namingResult.stages.find(
      (stage) => stage.stageId === stageId,
    )!;
    const target = input.runtime.store.readOrder(legacy.orderId)!.stages.find(
      (stage) => stage.stageId === stageId,
    )!;
    input.runtime.store.updateStage({
      ...target,
      status: "completed",
      aiFeedResult: source.aiFeedResult,
      rawResponseText: source.rawResponseText,
      rawOutputHash: source.rawOutputHash,
      progressPhase: "terminal",
      updatedAt: new Date().toISOString(),
    }, "acceptance_completed_prefix");
  }
  const repaired: XuanxueAiProductionOrder = {
    ...legacy,
    requestHash: hash("same-conversation-naming-contract"),
    materials: legacy.materials.map((material) => ({
      ...material,
      textPrompt: material.stageId === "naming_author"
        ? "这是整张“八字分析并起名”生产订单的第三步，必须继续本订单前两步所在的同一个 ChatGPT 会话；禁止打开空白新聊天。"
        : material.textPrompt,
    })),
  };
  const record = createXuanxueAiProductionOrder(input.runtime, repaired);
  assert.deepEqual(
    record.stages.map((stage) => stage.status),
    ["completed", "completed", "queued"],
  );
  assert.match(
    record.stages[2]!.executionId,
    /conversation-contract-recovery/u,
  );
  assert.doesNotMatch(
    record.stages[2]!.material.textPrompt,
    /全新的 ChatGPT 会话/u,
  );
  const before = input.gateway.requests.length;
  assert.equal(
    (await executeXuanxueAiProductionOrder(
      input.runtime,
      repaired.orderId,
    )).status,
    "completed",
  );
  assert.equal(
    input.gateway.requests.length - before,
    1,
    "legacy naming prompt repair must preserve both completed stages",
  );
};

const acceptNamingGraph = async (
  input: GraphAcceptanceInput,
): Promise<void> => {
  const naming = order(
    "aiprod_naming_full",
    "naming_bazi_analysis_and_naming",
    ["base_interpretation", "question_analysis", "naming_author"],
  );
  createXuanxueAiProductionOrder(input.runtime, naming);
  const result = await executeXuanxueAiProductionOrder(
    input.runtime,
    naming.orderId,
  );
  const authorRequest = input.gateway.requests.find(
    (request) =>
      request.taskIdentity.taskKind === "naming_bazi_analysis_and_naming"
      && request.roundId === "naming_author",
  );
  assert.equal(
    authorRequest?.providerContinuationRef?.priorTaskId,
    `${XUANXUE_AI_PRODUCTION_JOB_ID}:`
      + `${naming.orderId}:question_analysis`,
  );
  assert.equal(
    new Set(result.stages.map(
      (stage) => stage.aiFeedResult?.providerProof.webChatUrl,
    )).size,
    1,
    "Bazi, question and naming stages must remain in one GPT conversation",
  );
  await repairLegacyNamingGraph(input, result);
};

const createFollowupParent = async (
  input: GraphAcceptanceInput,
  candidate: XuanxueAiProductionOrder,
  finalStageId: string,
): Promise<ParentGraph> => {
  createXuanxueAiProductionOrder(input.runtime, candidate);
  const result = await executeXuanxueAiProductionOrder(
    input.runtime,
    candidate.orderId,
  );
  const finalStage = result.stages.find(
    (stage) => stage.stageId === finalStageId,
  );
  assert.ok(finalStage?.rawOutputHash);
  return { order: candidate, finalStage };
};

const continuationParentForProduct = (input: {
  productId: string;
  hehun: ParentGraph;
  bazi: ParentGraph;
  qimen: ParentGraph;
}): XuanxueAiProductionOrder["continuationParent"] => {
  if (input.productId === "bazi_report_followup") {
    return {
      jobId: input.bazi.order.orderId,
      stageId: "question_analysis",
      rawOutputHash: input.bazi.finalStage.rawOutputHash!,
    };
  }
  if (input.productId === "qimen_report_followup") {
    return {
      jobId: input.qimen.order.orderId,
      stageId: "analysis",
      rawOutputHash: input.qimen.finalStage.rawOutputHash!,
    };
  }
  if (input.productId === "hehun_report_followup") {
    return {
      jobId: input.hehun.order.orderId,
      stageId: "final_compatibility",
      rawOutputHash: input.hehun.finalStage.rawOutputHash!,
    };
  }
  return null;
};

const acceptProductLabels = async (
  input: GraphAcceptanceInput & {
    readonly hehun: ParentGraph;
    readonly bazi: ParentGraph;
    readonly qimen: ParentGraph;
  },
): Promise<void> => {
  const cases = [
    ["bazi_report_followup", "bazi_analysis"],
    ["qimen_report_followup", "qimen_analysis"],
    ["hehun_report_followup", "hehun_analysis"],
    ["naming_from_existing_bazi_report", "naming_analysis"],
  ] as const;
  for (const [productId, expectedLabel] of cases) {
    const stageId = productId.startsWith("naming_")
      ? "naming_author"
      : productId === "bazi_report_followup"
        ? "base_interpretation"
        : "followup";
    const base = order(
      `aiprod_label_${productId}`,
      productId,
      productId === "bazi_report_followup"
        ? ["base_interpretation", "question_analysis"]
        : [stageId],
    );
    const candidate: XuanxueAiProductionOrder = {
      ...base,
      continuationParent: continuationParentForProduct({
        productId,
        hehun: input.hehun,
        bazi: input.bazi,
        qimen: input.qimen,
      }),
    };
    createXuanxueAiProductionOrder(input.runtime, candidate);
    assert.equal(
      (await executeXuanxueAiProductionOrder(
        input.runtime,
        candidate.orderId,
      )).status,
      "completed",
    );
    const request = input.gateway.requests.find(
      (item) => item.taskIdentity.taskKind === productId,
    );
    assert.equal(request?.taskIdentity.labelKey, expectedLabel);
    assert.equal(request?.inputRefs[0]?.id, candidate.inputBundleRef);
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
    continuationParent: {
      jobId: hehun.order.orderId,
      stageId: "final_compatibility",
      rawOutputHash: hehun.finalStage.rawOutputHash!,
    },
  };
  createXuanxueAiProductionOrder(input.runtime, challenge);
  assert.equal(
    (await executeXuanxueAiProductionOrder(
      input.runtime,
      challenge.orderId,
    )).status,
    "completed",
  );
  const request = input.gateway.requests.find(
    (item) => item.roundId === "manual_accuracy_challenge",
  );
  assert.equal(
    request?.providerContinuationRef?.priorTaskId,
    hehun.finalStage.executionId,
  );
  assert.equal(
    request?.providerContinuationRef?.priorRawOutputHash,
    hehun.finalStage.rawOutputHash,
  );
  assert.ok(request?.inputRefs.some(
    (ref) =>
      ref.kind === "prior_stage_raw_response"
      && ref.sha256 === hehun.finalStage.rawOutputHash,
  ));
};

export const acceptXuanxueOrderGraphs = async (
  input: GraphAcceptanceInput,
): Promise<AcceptedOrderGraphs> => {
  const hehun = await acceptHehunGraph(input);
  await acceptNamingGraph(input);
  const bazi = await createFollowupParent(
    input,
    order(
      "aiprod_bazi_followup_parent",
      "bazi_ai_full_analysis",
      ["base_interpretation", "question_analysis"],
    ),
    "question_analysis",
  );
  const qimen = await createFollowupParent(
    input,
    order(
      "aiprod_qimen_followup_parent",
      "qimen_professional_answer",
      ["analysis"],
    ),
    "analysis",
  );
  await acceptProductLabels({ ...input, hehun, bazi, qimen });
  await acceptManualChallenge(input, hehun);
  return {
    hehun: hehun.order,
    qimenFollowupParent: qimen.order,
    qimenFollowupParentFinal: qimen.finalStage,
  };
};
