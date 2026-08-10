import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AiFeedInput } from "../../src/capabilities/ai-input-gateway/index.js";
import {
  createXuanxueAiProductionOrder,
  executeXuanxueAiProductionOrder,
  type XuanxueAiOrderRecord,
  type XuanxueAiProductionOrder,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import {
  hash,
  order,
} from "./xuanxue-ai-production-fixture.js";
import {
  assertDuplicateHehunPartyRejected,
} from "./xuanxue-ai-production-hehun-join-guards.js";
import {
  acceptNamingJoinGuards,
} from "./xuanxue-ai-production-naming-join-guards.js";
import {
  assertHehunRequestEvidence,
  assertNm01RequestEvidence,
  assertNm02RequestEvidence,
  rejectInvalidBaseParent,
} from "./xuanxue-ai-production-order-graph-assertions.js";

type StageRecord = XuanxueAiOrderRecord["stages"][number];

interface GraphAcceptanceInput {
  readonly runtime: XuanxueAiProductionRuntime;
  readonly gateway: { readonly requests: readonly AiFeedInput[] };
}

interface ParentGraph {
  readonly order: XuanxueAiProductionOrder;
  readonly finalStage: StageRecord;
}

const graphFrozenEnvelope = {
  privacyOwnerRef: "owner:order-graph-acceptance",
  snapshotRef: "snapshot:order-graph-acceptance",
  snapshotHash: hash("snapshot:order-graph-acceptance"),
  caseRevisionRef: "case-revision:order-graph-acceptance",
} as const;

const withGraphFrozenEnvelope = (
  candidate: XuanxueAiProductionOrder,
): XuanxueAiProductionOrder => ({
  ...candidate,
  frozenSubject: {
    ...candidate.frozenSubject,
    ...graphFrozenEnvelope,
  },
});

export interface AcceptedOrderGraphs {
  readonly hehun: XuanxueAiProductionOrder;
  readonly qimenFollowupParent: XuanxueAiProductionOrder;
  readonly qimenFollowupParentFinal: StageRecord;
}

const participant = (
  personRef: string,
  slotRef = "primary",
  roleCode = "primary",
): XuanxueAiProductionOrder["frozenSubject"]["participants"][number] => ({
  slotRef,
  roleCode,
  personRef,
  profileVersionRef: `profile:${personRef}:v1`,
  chartStateRef: `chart:${personRef}`,
  chartStateVersion: "v1",
  chartStateHash: hash(`chart:${personRef}`),
  purposeCode: "fixture-acceptance",
  authorizationReceiptRef: `authorization:${personRef}`,
});

const withParticipants = (
  candidate: XuanxueAiProductionOrder,
  participants: XuanxueAiProductionOrder["frozenSubject"]["participants"],
  primaryPersonRef: string | null,
): XuanxueAiProductionOrder => ({
  ...candidate,
  frozenSubject: {
    ...candidate.frozenSubject,
    primaryPersonRef,
    participants,
    participantManifestHash: hash(JSON.stringify(participants)),
  },
});

const completePrepared = async (
  input: GraphAcceptanceInput,
  normalized: XuanxueAiProductionOrder,
  finalStageId: StageRecord["stageId"],
): Promise<ParentGraph> => {
  createXuanxueAiProductionOrder(input.runtime, normalized);
  const result = await executeXuanxueAiProductionOrder(
    input.runtime,
    normalized.orderId,
  );
  assert.equal(result.status, "completed");
  const finalStage = result.stages.find(
    (stage) => stage.stageId === finalStageId,
  );
  assert.ok(finalStage?.rawOutputHash);
  assert.ok(finalStage.aiFeedResult?.providerProof.webChatUrl);
  return { order: normalized, finalStage };
};

const complete = async (
  input: GraphAcceptanceInput,
  candidate: XuanxueAiProductionOrder,
  finalStageId: StageRecord["stageId"],
): Promise<ParentGraph> => completePrepared(
  input,
  withGraphFrozenEnvelope(candidate),
  finalStageId,
);

const conversationParent = (
  parent: ParentGraph,
  relation: "same_conversation" | "forked_from_checkpoint",
): NonNullable<XuanxueAiProductionOrder["conversationParent"]> => ({
  relation,
  jobId: parent.order.orderId,
  stageId: parent.finalStage.stageId,
  executionId: parent.finalStage.executionId,
  rawOutputHash: parent.finalStage.rawOutputHash!,
  inputBundleHash: parent.order.inputBundleHash,
  conversationScopeRef: parent.order.conversationScopeRef,
});

const joinParent = (
  parent: ParentGraph,
  binding: ReturnType<typeof participant>,
): XuanxueAiProductionOrder["joinParents"][number] => ({
  participantSlotRef: binding.slotRef,
  participantRoleCode: binding.roleCode,
  personRef: binding.personRef,
  jobId: parent.order.orderId,
  stageId: parent.finalStage.stageId,
  executionId: parent.finalStage.executionId,
  rawOutputHash: parent.finalStage.rawOutputHash!,
  conversationScopeRef: parent.order.conversationScopeRef,
});

const privateBaziBase = async (
  input: GraphAcceptanceInput,
  orderId: string,
  personRef: string,
): Promise<ParentGraph> => complete(
  input,
  withParticipants(
    order(orderId, "bazi_canonical_base_interpretation", [
      "base_interpretation",
    ]),
    [participant(personRef)],
    personRef,
  ),
  "base_interpretation",
);

const acceptInvalidBaseParentRejections = async (
  input: GraphAcceptanceInput,
  base: ParentGraph,
): Promise<void> => {
  const make = (orderId: string, binding: ReturnType<typeof participant>) => {
    const candidate = withParticipants(order(
      orderId,
      "bazi_chart_interpretation",
      ["chart_interpretation"],
    ), [binding], binding.personRef);
    candidate.conversationParent = conversationParent(
      base,
      "forked_from_checkpoint",
    );
    return candidate;
  };
  await rejectInvalidBaseParent({ ...input, candidate: make(
    "aiprod_cross_owner_bz05",
    base.order.frozenSubject.participants[0]!,
  ) });
  await rejectInvalidBaseParent({ ...input, candidate: withGraphFrozenEnvelope(make(
    "aiprod_cross_person_bz05",
    participant("person:wrong-base-person"),
  )) });
  const wrongChart = {
    ...participant("person:bazi-primary"),
    chartStateRef: "chart:wrong-base-chart",
    chartStateHash: hash("chart:wrong-base-chart"),
  };
  await rejectInvalidBaseParent({ ...input, candidate: withGraphFrozenEnvelope(make(
    "aiprod_cross_chart_bz05",
    wrongChart,
  )) });
};

const acceptBaziForkSiblings = async (
  input: GraphAcceptanceInput,
): Promise<{ base: ParentGraph; analysis: ParentGraph }> => {
  const base = await privateBaziBase(
    input,
    "aiprod_bazi_private_base",
    "person:bazi-primary",
  );
  await acceptInvalidBaseParentRejections(input, base);
  const bz05Person = {
    ...participant("person:bazi-primary"),
    purposeCode: "bz05-cross-project-purpose",
    authorizationReceiptRef: "authorization:bz05-cross-project",
  };
  const bz05Order = withGraphFrozenEnvelope(withParticipants(
    order("aiprod_bz05", "bazi_chart_interpretation", [
      "chart_interpretation",
    ]),
    [bz05Person],
    bz05Person.personRef,
  ));
  bz05Order.frozenSubject = {
    ...bz05Order.frozenSubject,
    snapshotRef: "snapshot:bz05-cross-project",
    snapshotHash: hash("snapshot:bz05-cross-project"),
    caseRevisionRef: "case-revision:bz05-cross-project",
  };
  const bz05 = await completePrepared(input, {
    ...bz05Order,
    conversationParent: conversationParent(base, "forked_from_checkpoint"),
  }, "chart_interpretation");
  const analysisOrder = withParticipants(
    order("aiprod_bz03", "bazi_ai_full_analysis", ["question_analysis"]),
    [participant("person:bazi-primary")],
    "person:bazi-primary",
  );
  analysisOrder.materials[0]!.textPrompt = "QUESTION_A_ONLY";
  const analysis = await complete(input, {
    ...analysisOrder,
    conversationParent: conversationParent(base, "forked_from_checkpoint"),
  }, "question_analysis");
  const baseUrl = base.finalStage.aiFeedResult!.providerProof.webChatUrl;
  const childUrls = [bz05, analysis].map(
    (graph) => graph.finalStage.aiFeedResult!.providerProof.webChatUrl,
  );
  assert.equal(new Set([baseUrl, ...childUrls]).size, 3);
  assert.equal(
    input.gateway.requests.filter((request) => request.providerForkRef).length,
    2,
  );
  assert.equal(
    input.gateway.requests.find(
      (request) => request.taskIdentity.taskKind === "bazi_chart_interpretation",
    )?.textPrompt.includes("QUESTION_A_ONLY"),
    false,
  );
  return { base, analysis };
};

const acceptNamingTargetAndFourAuxiliaries = async (
  input: GraphAcceptanceInput,
  targetBase: ParentGraph,
): Promise<void> => {
  const auxiliaryPeople = Array.from(
    { length: 4 },
    (_, index) => `person:naming-aux-${index + 1}`,
  );
  assert.equal(
    auxiliaryPeople.at(-1),
    "person:naming-aux-4",
    "the naming graph must freeze the target plus all four auxiliary people",
  );
  const auxiliaryBases: ParentGraph[] = [];
  for (const [index, personRef] of auxiliaryPeople.entries()) {
    auxiliaryBases.push(await privateBaziBase(
      input,
      `aiprod_naming_aux_base_${index + 1}`,
      personRef,
    ));
  }
  const target = participant("person:bazi-primary", "target", "naming_target");
  const auxiliaries = auxiliaryPeople.map((personRef, index) =>
    participant(personRef, `aux-${index + 1}`, `family_aux_${index + 1}`));
  const candidate = withParticipants(
    order("aiprod_nm01", "naming_bazi_analysis_and_naming", [
      "question_analysis",
      "naming_author",
    ]),
    [target, ...auxiliaries],
    target.personRef,
  );
  candidate.conversationParent = conversationParent(
    targetBase,
    "forked_from_checkpoint",
  );
  candidate.joinParents = auxiliaryBases.map((base, index) =>
    joinParent(base, auxiliaries[index]!));
  acceptNamingJoinGuards(input.runtime, candidate, "nm01");
  const before = input.gateway.requests.length;
  const result = await complete(input, candidate, "naming_author");
  const requests = input.gateway.requests.slice(before);
  assertNm01RequestEvidence({
    requests,
    targetExecutionId: targetBase.finalStage.executionId,
    resultOrderId: result.order.orderId,
  });
  const persisted = input.runtime.store.readOrder(candidate.orderId);
  assert.ok(persisted);
  assert.equal(new Set(persisted.stages.map(
    (stage) => stage.aiFeedResult?.providerProof.webChatUrl,
  )).size, 1);
};

const acceptExistingReportNamingWithAuxiliaries = async (
  input: GraphAcceptanceInput,
  report: ParentGraph,
): Promise<void> => {
  const target = participant("person:bazi-primary", "target", "naming_target");
  const auxiliaries = Array.from({ length: 4 }, (_, index) => participant(
    `person:nm02-aux-${index + 1}`,
    `aux-${index + 1}`,
    `family_aux_${index + 1}`,
  ));
  const bases: ParentGraph[] = [];
  for (const [index, binding] of auxiliaries.entries()) {
    bases.push(await privateBaziBase(
      input,
      `aiprod_nm02_aux_base_${index + 1}`,
      binding.personRef,
    ));
  }
  const candidate = withParticipants(order(
    "aiprod_nm02",
    "naming_from_existing_bazi_report",
    ["naming_author"],
  ), [target, ...auxiliaries], target.personRef);
  assert.ok(report.finalStage.rawResponseText);
  assert.ok(report.finalStage.rawOutputHash);
  const selectedReportDirectory = path.join(
    input.runtime.dataDir,
    "acceptance-selected-existing-bazi-report",
  );
  await mkdir(selectedReportDirectory, { recursive: true });
  const selectedReportFileName = "selected-existing-bazi-report.txt";
  const selectedReportFilePath = path.join(
    selectedReportDirectory,
    selectedReportFileName,
  );
  const selectedReportBytes = Buffer.from(
    report.finalStage.rawResponseText,
    "utf8",
  );
  await writeFile(selectedReportFilePath, selectedReportBytes);
  candidate.materials[0]!.inputRefs.push({
    id: `selected-report:${report.order.orderId}:${report.finalStage.stageId}`,
    kind: "selected_existing_bazi_report",
    summary:
      `用户精确选择的合法八字报告：${report.order.orderId}/`
      + `${report.finalStage.stageId}/${report.finalStage.executionId}`,
    filePath: selectedReportFilePath,
    fileName: selectedReportFileName,
    mimeType: "text/plain; charset=utf-8",
    sha256: report.finalStage.rawOutputHash as `sha256:${string}`,
    byteCount: selectedReportBytes.byteLength,
  });
  candidate.joinParents = bases.map((base, index) =>
    joinParent(base, auxiliaries[index]!));
  acceptNamingJoinGuards(input.runtime, candidate, "nm02");
  const before = input.gateway.requests.length;
  const result = await complete(input, candidate, "naming_author");
  const request = input.gateway.requests[before];
  assertNm02RequestEvidence({
    request,
    reportUrl: report.finalStage.aiFeedResult?.providerProof.webChatUrl,
    resultUrl: result.finalStage.aiFeedResult?.providerProof.webChatUrl,
  });
};

const acceptHehunThreeContexts = async (
  input: GraphAcceptanceInput,
): Promise<ParentGraph> => {
  const partyABinding = participant("person:hehun-a", "party-a", "party_a");
  const partyBBinding = participant("person:hehun-b", "party-b", "party_b");
  const partyA = await complete(input, withParticipants(
    order("aiprod_hehun_party_a", "hehun_canonical_party_a_interpretation", [
      "party_a_interpretation",
    ]),
    [partyABinding],
    partyABinding.personRef,
  ), "party_a_interpretation");
  const partyB = await complete(input, withParticipants(
    order("aiprod_hehun_party_b", "hehun_canonical_party_b_interpretation", [
      "party_b_interpretation",
    ]),
    [partyBBinding],
    partyBBinding.personRef,
  ), "party_b_interpretation");
  const finalOrder = withParticipants(
    order("aiprod_hehun_final", "hehun_ai_analysis", ["final_compatibility"]),
    [partyABinding, partyBBinding],
    null,
  );
  finalOrder.joinParents = [
    joinParent(partyA, partyABinding),
    joinParent(partyB, partyBBinding),
  ];
  assertDuplicateHehunPartyRejected(input.runtime, finalOrder);
  assert.throws(
    () => createXuanxueAiProductionOrder(input.runtime, {
      ...finalOrder,
      orderId: "aiprod_hehun_wrong_party_stage",
      sourceTaskId: "source:aiprod_hehun_wrong_party_stage",
      requestHash: hash("aiprod_hehun_wrong_party_stage"),
      joinParents: finalOrder.joinParents.map((binding, index) => index === 0
        ? { ...binding, stageId: "base_interpretation" }
        : binding),
    }),
    /HEHUN_THREE_CONTEXTS_REQUIRED/u,
    "party A and party B joins must bind their exact private stages",
  );
  const final = await complete(input, finalOrder, "final_compatibility");
  const finalRequest = input.gateway.requests.find(
    (request) => request.taskIdentity.sourceTaskId
      === `${finalOrder.orderId}:final_compatibility`,
  );
  assertHehunRequestEvidence({
    request: finalRequest,
    urls: [
      partyA.finalStage.aiFeedResult?.providerProof.webChatUrl,
      partyB.finalStage.aiFeedResult?.providerProof.webChatUrl,
      final.finalStage.aiFeedResult?.providerProof.webChatUrl,
    ],
  });
  return final;
};

const acceptSameConversationFollowup = async (
  input: GraphAcceptanceInput,
  parent: ParentGraph,
  productId: "bazi_report_followup" | "qimen_report_followup" | "hehun_report_followup",
  stageId: "question_analysis" | "followup",
): Promise<void> => {
  const candidate = order(`aiprod_${productId}`, productId, [stageId]);
  candidate.frozenSubject = parent.order.frozenSubject;
  candidate.conversationParent = conversationParent(parent, "same_conversation");
  const result = await complete(input, candidate, stageId);
  assert.equal(
    result.finalStage.aiFeedResult?.providerProof.webChatUrl,
    parent.finalStage.aiFeedResult?.providerProof.webChatUrl,
  );
};

export const acceptXuanxueOrderGraphs = async (
  input: GraphAcceptanceInput,
): Promise<AcceptedOrderGraphs> => {
  const bazi = await acceptBaziForkSiblings(input);
  await acceptNamingTargetAndFourAuxiliaries(input, bazi.base);
  const hehun = await acceptHehunThreeContexts(input);
  const qimen = await complete(input, order(
    "aiprod_qimen_parent",
    "qimen_professional_answer",
    ["analysis"],
  ), "analysis");
  await acceptSameConversationFollowup(
    input,
    bazi.analysis,
    "bazi_report_followup",
    "question_analysis",
  );
  await acceptSameConversationFollowup(
    input,
    qimen,
    "qimen_report_followup",
    "followup",
  );
  await acceptSameConversationFollowup(
    input,
    hehun,
    "hehun_report_followup",
    "followup",
  );
  await acceptExistingReportNamingWithAuxiliaries(input, bazi.analysis);
  return {
    hehun: hehun.order,
    qimenFollowupParent: qimen.order,
    qimenFollowupParentFinal: qimen.finalStage,
  };
};
