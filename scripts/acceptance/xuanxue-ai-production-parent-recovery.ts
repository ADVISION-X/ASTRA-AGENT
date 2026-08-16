import assert from "node:assert/strict";

import {
  createXuanxueAiProductionOrder,
  XuanxueAiProductionCoordinator,
  type XuanxueAiOrderRecord,
  type XuanxueAiProductionOrder,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import {
  FixtureGateway,
  hash,
  order,
} from "./xuanxue-ai-production-fixture.js";
import {
  acceptXuanxueParentRebuilds,
} from "./xuanxue-ai-production-parent-rebuild-acceptance.js";

interface ParentAcceptanceInput {
  readonly runtime: XuanxueAiProductionRuntime;
  readonly gateway: FixtureGateway;
  readonly qimenParent: XuanxueAiProductionOrder;
  readonly qimenParentFinal: XuanxueAiOrderRecord["stages"][number];
}

const acceptSameParentFifo = async (
  input: ParentAcceptanceInput,
): Promise<void> => {
  assert.throws(
    () => createXuanxueAiProductionOrder(input.runtime, order(
      "aiprod_followup_without_parent",
      "qimen_report_followup",
      ["followup"],
    )),
    /CONTINUATION_PROFILE_INVALID/u,
    "a paid follow-up without an exact parent must never reach GPT",
  );
  const parentUrl =
    input.qimenParentFinal.aiFeedResult?.providerProof.webChatUrl;
  assert.ok(parentUrl);
  const children = Array.from({ length: 3 }, (_, index) => ({
    ...order(
      `aiprod_same_parent_followup_${index + 1}`,
      "qimen_report_followup",
      ["followup"],
    ),
    conversationParent: {
      relation: "same_conversation" as const,
      jobId: input.qimenParent.orderId,
      stageId: "analysis" as const,
      executionId: input.qimenParentFinal.executionId,
      rawOutputHash: input.qimenParentFinal.rawOutputHash!,
      inputBundleHash: input.qimenParent.inputBundleHash,
      conversationScopeRef: input.qimenParent.conversationScopeRef,
    },
    frozenSubject: input.qimenParent.frozenSubject,
    createdAt: new Date(Date.now() + index).toISOString(),
  }));
  for (const child of children) {
    createXuanxueAiProductionOrder(input.runtime, child);
  }
  const coordinator = new XuanxueAiProductionCoordinator(input.runtime);
  const results = await Promise.all(
    children.map((child) => coordinator.execute(child.orderId)),
  );
  await coordinator.close();
  assert.ok(results.every((record) => record.status === "completed"));
  assert.equal(
    input.gateway.maxActiveByContinuation.get(parentUrl),
    1,
    "orders sharing one parent GPT conversation must be serialized",
  );
  assert.deepEqual(
    input.gateway.requests
      .filter((request) => request.taskIdentity.sourceTaskId.startsWith(
        "aiprod_same_parent_followup_",
      ))
      .map((request) => request.runId),
    children.map((child) => child.orderId),
    "same-parent follow-ups must preserve FIFO order",
  );
};

export const acceptXuanxueParentRecovery = async (
  input: ParentAcceptanceInput,
): Promise<void> => {
  await acceptSameParentFifo(input);
  await acceptXuanxueParentRebuilds(input);
};
