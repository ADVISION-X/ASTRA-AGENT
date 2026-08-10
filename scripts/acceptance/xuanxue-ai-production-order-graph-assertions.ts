import assert from "node:assert/strict";

import type { AiFeedInput } from "../../src/capabilities/ai-input-gateway/index.js";
import {
  createXuanxueAiProductionOrder,
  XuanxueAiProductionCoordinator,
  type XuanxueAiProductionOrder,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";

export const rejectInvalidBaseParent = async (input: {
  runtime: XuanxueAiProductionRuntime;
  gateway: { readonly requests: readonly AiFeedInput[] };
  candidate: XuanxueAiProductionOrder;
}): Promise<void> => {
  createXuanxueAiProductionOrder(input.runtime, input.candidate);
  const requestsBeforeExecution = input.gateway.requests.length;
  const coordinator = new XuanxueAiProductionCoordinator(input.runtime);
  const result = await coordinator.execute(input.candidate.orderId);
  await coordinator.close();
  assert.equal(result.status, "recovery_pending");
  assert.match(result.failureReason ?? "", /PARENT_FROZEN_SUBJECT_MISMATCH/u);
  assert.equal(input.gateway.requests.length, requestsBeforeExecution,
    "cross-owner, cross-person, and cross-chart parents must fail before GPT");
  input.runtime.store.updateStage({
    ...result.stages[0]!,
    status: "review_required",
    progressPhase: "terminal",
    failureReason: "authorization scope mismatch",
    updatedAt: new Date().toISOString(),
  }, "fixture_cross_snapshot_rejected");
  input.runtime.store.updateOrder({
    orderId: input.candidate.orderId,
    status: "review_required",
    failureReason: "authorization scope mismatch",
    updatedAt: new Date().toISOString(),
    eventType: "fixture_cross_snapshot_rejected",
  });
};

export const assertNm01RequestEvidence = (input: {
  requests: readonly AiFeedInput[];
  targetExecutionId: string;
  resultOrderId: string;
}): void => {
  assert.equal(input.requests[0]?.providerForkRef?.priorTaskId,
    input.targetExecutionId);
  assert.equal(input.requests[0]?.inputRefs.some((ref) =>
    ref.kind === "typed_participant_manifest"
    || ref.kind === "typed_participant_private_base"), false,
  "NM01 question_analysis must stay target-only before naming_author joins auxiliaries");
  assert.equal(input.requests[1]?.providerContinuationRef?.priorTaskId,
    `xuanxue-ai-production:${input.resultOrderId}:question_analysis`);
  assert.equal(input.requests[1]?.inputRefs.filter(
    (ref) => ref.kind === "typed_participant_private_base").length, 4);
  assert.equal(input.requests[1]?.inputRefs.filter(
    (ref) => ref.kind === "typed_participant_manifest").length, 1);
  assert.equal(new Set(input.requests[1]?.inputRefs.filter(
    (ref) => ref.kind === "typed_participant_private_base",
  ).map((ref) => ref.fileName)).size, 4);
};

export const assertNm02RequestEvidence = (input: {
  request: AiFeedInput | undefined;
  reportUrl: string | null | undefined;
  resultUrl: string | null | undefined;
}): void => {
  assert.equal(input.request?.providerForkRef, undefined);
  assert.equal(input.request?.providerContinuationRef, undefined);
  assert.equal(input.request?.inputRefs.filter(
    (ref) => ref.kind === "typed_participant_private_base").length, 4);
  assert.equal(input.request?.inputRefs.filter(
    (ref) => ref.kind === "typed_participant_manifest").length, 1);
  assert.equal(input.request?.inputRefs.filter(
    (ref) => ref.kind === "selected_existing_bazi_report").length, 1);
  assert.notEqual(input.resultUrl, input.reportUrl);
};

export const assertHehunRequestEvidence = (input: {
  request: AiFeedInput | undefined;
  urls: readonly (string | null | undefined)[];
}): void => {
  assert.equal(input.request?.inputRefs.filter(
    (ref) => ref.kind === "typed_participant_manifest").length, 1);
  assert.equal(input.request?.inputRefs.filter(
    (ref) => ref.kind === "typed_participant_private_base").length, 2);
  assert.equal(new Set(input.urls).size, 3);
};
