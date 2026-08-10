import assert from "node:assert/strict";

import {
  createXuanxueAiProductionOrder,
  executeXuanxueAiProductionOrder,
  XuanxueAiProductionCoordinator,
  type XuanxueAiOrderRecord,
  type XuanxueAiProductionOrder,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import {
  XuanxueAiProductionCloudClaimedJobSchema,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-contract.js";
import {
  executeXuanxueAiProductionCloudReplayGraph,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-worker.js";
import {
  FixtureGateway,
  hash,
  order,
} from "./xuanxue-ai-production-fixture.js";

export interface ParentRebuildAcceptanceInput {
  readonly runtime: XuanxueAiProductionRuntime;
  readonly gateway: FixtureGateway;
}

type StageRecord = XuanxueAiOrderRecord["stages"][number];

const completeParent = async (
  input: ParentRebuildAcceptanceInput,
  parent: XuanxueAiProductionOrder,
): Promise<StageRecord> => {
  createXuanxueAiProductionOrder(input.runtime, parent);
  const completed = await executeXuanxueAiProductionOrder(
    input.runtime,
    parent.orderId,
  );
  const stage = completed.stages[0]!;
  assert.ok(stage.rawOutputHash && stage.aiFeedResult);
  return stage;
};

const loseProviderConversation = (
  input: ParentRebuildAcceptanceInput,
  stage: StageRecord,
  eventType: string,
): StageRecord => input.runtime.store.updateStage({
  ...stage,
  aiFeedResult: {
    ...stage.aiFeedResult!,
    providerProof: {
      ...stage.aiFeedResult!.providerProof,
      webChatUrl: null,
    },
  },
  updatedAt: new Date().toISOString(),
}, eventType);

const qimenFollowupAfterLoss = (
  parent: XuanxueAiProductionOrder,
  stage: Pick<StageRecord, "executionId" | "rawOutputHash">,
  orderId: string,
): XuanxueAiProductionOrder => ({
  ...order(orderId, "qimen_report_followup", ["followup"]),
  frozenSubject: parent.frozenSubject,
  conversationParent: {
    relation: "same_conversation",
    jobId: parent.orderId,
    stageId: "analysis",
    executionId: stage.executionId,
    rawOutputHash: stage.rawOutputHash!,
    inputBundleHash: parent.inputBundleHash,
    conversationScopeRef: parent.conversationScopeRef,
  },
});

const executeWithCoordinator = async (
  input: ParentRebuildAcceptanceInput,
  orderId: string,
): Promise<XuanxueAiOrderRecord> => {
  const coordinator = new XuanxueAiProductionCoordinator(input.runtime);
  const result = await coordinator.execute(orderId);
  await coordinator.close();
  return result;
};

const acceptLostProviderParent = async (
  input: ParentRebuildAcceptanceInput,
): Promise<void> => {
  const parent = order(
    "aiprod_lost_parent_conversation",
    "qimen_professional_answer",
    ["analysis"],
  );
  const stage = await completeParent(input, parent);
  loseProviderConversation(input, stage, "fixture_parent_conversation_lost");
  const child = qimenFollowupAfterLoss(
    parent,
    stage,
    "aiprod_followup_after_parent_loss",
  );
  createXuanxueAiProductionOrder(input.runtime, child);
  const before = input.gateway.requests.length;
  const result = await executeWithCoordinator(input, child.orderId);
  assert.equal(result.status, "completed", result.failureReason ?? undefined);
  assert.equal(
    input.gateway.requests.length - before,
    2,
    "a missing parent chat must replay the parent first, then ask the follow-up",
  );
  const rebuilt = input.runtime.store.readParentConversationRebuild({
    parentJobId: parent.orderId,
    parentStageId: "analysis",
    originalRawOutputHash: stage.rawOutputHash!,
  });
  assert.ok(rebuilt);
  const request = input.gateway.requests.find(
    (candidate) => candidate.runId === child.orderId,
  );
  assert.equal(
    request?.providerContinuationRef?.providerPageUrl,
    rebuilt.providerPageUrl,
  );
};

const closeDivergentChild = (
  input: ParentRebuildAcceptanceInput,
  childId: string,
): void => {
  const blocked = input.runtime.store.readOrder(childId)!;
  const reason = "XUANXUE_AI_PRODUCTION_PARENT_REBUILD_HASH_MISMATCH";
  input.runtime.store.updateStage({
    ...blocked.stages[0]!,
    status: "review_required",
    progressPhase: "terminal",
    failureReason: reason,
    updatedAt: new Date().toISOString(),
  }, "fixture_divergent_parent_rebuild_closed");
  input.runtime.store.updateOrder({
    orderId: childId,
    status: "review_required",
    failureReason: reason,
    updatedAt: new Date().toISOString(),
    eventType: "fixture_divergent_parent_rebuild_closed",
  });
};

const assertOriginalParentPreserved = (input: {
  acceptance: ParentRebuildAcceptanceInput;
  parent: XuanxueAiProductionOrder;
  original: StageRecord;
  lost: StageRecord;
}): void => {
  const preserved = input.acceptance.runtime.store.readOrder(
    input.parent.orderId,
  );
  assert.equal(preserved?.status, "completed");
  assert.equal(preserved?.stages[0]?.executionId, input.original.executionId);
  assert.equal(preserved?.stages[0]?.rawOutputHash, input.original.rawOutputHash);
  assert.equal(
    preserved?.stages[0]?.aiFeedResult?.providerProof.webChatUrl,
    input.lost.aiFeedResult?.providerProof.webChatUrl,
  );
  assert.equal(input.acceptance.runtime.store.readParentConversationRebuild({
    parentJobId: input.parent.orderId,
    parentStageId: "analysis",
    originalRawOutputHash: input.original.rawOutputHash!,
  }), null);
};

const acceptDivergentRebuild = async (
  input: ParentRebuildAcceptanceInput,
): Promise<void> => {
  const parent = order(
    "aiprod_divergent_parent_rebuild",
    "qimen_professional_answer",
    ["analysis"],
  );
  const original = await completeParent(input, parent);
  const lost = loseProviderConversation(
    input,
    original,
    "fixture_divergent_parent_conversation_lost",
  );
  const child = qimenFollowupAfterLoss(
    parent,
    original,
    "aiprod_child_blocked_by_divergent_parent",
  );
  createXuanxueAiProductionOrder(input.runtime, child);
  input.gateway.divergeParentRebuilds = true;
  try {
    const result = await executeWithCoordinator(input, child.orderId);
    assert.equal(result.status, "recovery_pending");
    assert.match(result.failureReason ?? "", /PARENT_REBUILD_HASH_MISMATCH/u);
  } finally {
    input.gateway.divergeParentRebuilds = false;
  }
  assertOriginalParentPreserved({ acceptance: input, parent, original, lost });
  closeDivergentChild(input, child.orderId);
};

const acceptFirstForkStageRebuild = async (
  input: ParentRebuildAcceptanceInput,
): Promise<void> => {
  const base = order(
    "aiprod_lost_bazi_base_before_first_fork",
    "bazi_canonical_base_interpretation",
    ["base_interpretation"],
  );
  const baseStage = await completeParent(input, base);
  loseProviderConversation(input, baseStage, "fixture_bazi_base_conversation_lost");
  const child: XuanxueAiProductionOrder = {
    ...order(
      "aiprod_bz05_after_base_loss",
      "bazi_chart_interpretation",
      ["chart_interpretation"],
    ),
    frozenSubject: base.frozenSubject,
    conversationParent: {
      relation: "forked_from_checkpoint",
      jobId: base.orderId,
      stageId: "base_interpretation",
      executionId: baseStage.executionId,
      rawOutputHash: baseStage.rawOutputHash!,
      inputBundleHash: base.inputBundleHash,
      conversationScopeRef: base.conversationScopeRef,
    },
  };
  createXuanxueAiProductionOrder(input.runtime, child);
  const before = input.gateway.requests.length;
  const result = await executeWithCoordinator(input, child.orderId);
  assert.equal(result.status, "completed", result.failureReason ?? undefined);
  assert.equal(
    input.gateway.requests.length - before,
    2,
  );
  assert.ok(input.gateway.requests.find(
    (request) => request.runId === child.orderId,
  )?.providerForkRef);
};

const acceptCloudForkParentReplayOrder = async (
  input: ParentRebuildAcceptanceInput,
): Promise<void> => {
  const cases = [
    ["bazi_chart_interpretation", "chart_interpretation"],
    ["bazi_ai_full_analysis", "question_analysis"],
  ] as const;
  for (const [productId, stageId] of cases) {
    const suffix = stageId.replaceAll("_", "-");
    const base = order(
      `aiprod_cloud_replay_base_${suffix}`,
      "bazi_canonical_base_interpretation",
      ["base_interpretation"],
    );
    const baseHash = hash(JSON.stringify({
      stage: "base_interpretation",
      verdict: "fixture-transport-only",
    }));
    const parent: XuanxueAiProductionOrder = {
      ...order(`aiprod_cloud_replay_parent_${suffix}`, productId, [stageId]),
      frozenSubject: base.frozenSubject,
      conversationParent: {
        relation: "forked_from_checkpoint",
        jobId: base.orderId,
        stageId: "base_interpretation",
        executionId:
          `xuanxue-ai-production:${base.orderId}:base_interpretation`,
        rawOutputHash: baseHash,
        inputBundleHash: base.inputBundleHash,
        conversationScopeRef: base.conversationScopeRef,
      },
    };
    const before = input.gateway.requests.length;
    await executeXuanxueAiProductionCloudReplayGraph({
      createOrder: (candidate) => createXuanxueAiProductionOrder(
        input.runtime,
        candidate as XuanxueAiProductionOrder,
      ),
      executeOrder: (orderId) => executeXuanxueAiProductionOrder(
        input.runtime,
        orderId,
      ),
    }, {
      parentReplayDependencies: [base],
      parentReplay: parent,
    });
    const requests = input.gateway.requests.slice(before);
    assert.equal(requests.length, 2);
    assert.equal(requests[0]?.runId, base.orderId);
    assert.equal(requests[1]?.runId, parent.orderId);
    assert.equal(
      requests[1]?.providerForkRef?.priorTaskId,
      `xuanxue-ai-production:${base.orderId}:base_interpretation`,
    );
    assert.equal(
      input.runtime.store.readOrder(parent.orderId)?.status,
      "completed",
      `${productId} cloud replay must execute its base before the parent`,
    );
  }
};

const cloudMaterial = (
  candidate: XuanxueAiProductionOrder["materials"][number],
) => ({
  stage_id: candidate.stageId,
  prompt_package_id: candidate.promptPackageId,
  prompt_contract_id: candidate.promptContractId,
  output_schema_ref: candidate.expectedOutputSchemaRef,
  expected_output_kind: candidate.expectedOutputKind,
  text_prompt: candidate.textPrompt,
  timeout_ms: candidate.timeoutMs,
  max_input_chars: candidate.maxInputChars,
  max_file_count: candidate.maxFileCount,
  max_file_bytes: candidate.maxFileBytes,
  inputs: [],
});

const cloudSubject = (candidate: XuanxueAiProductionOrder) => ({
  privacy_owner_ref: candidate.frozenSubject.privacyOwnerRef,
  snapshot_ref: candidate.frozenSubject.snapshotRef,
  snapshot_hash: candidate.frozenSubject.snapshotHash,
  case_revision_ref: candidate.frozenSubject.caseRevisionRef,
  primary_person_ref: candidate.frozenSubject.primaryPersonRef,
  participant_manifest_hash: candidate.frozenSubject.participantManifestHash,
  participants: candidate.frozenSubject.participants.map((participant) => ({
    slot_ref: participant.slotRef,
    role_code: participant.roleCode,
    person_ref: participant.personRef,
    profile_version_ref: participant.profileVersionRef,
    chart_state_ref: participant.chartStateRef,
    chart_state_version: participant.chartStateVersion,
    chart_state_hash: participant.chartStateHash,
    purpose_code: participant.purposeCode,
    authorization_receipt_ref: participant.authorizationReceiptRef,
  })),
});

const cloudOrderIdentity = (candidate: XuanxueAiProductionOrder) => ({
  job_id: candidate.orderId,
  source_task_id: candidate.sourceTaskId,
  product_id: candidate.productId,
  service_class: candidate.serviceClass,
  trigger_kind: candidate.triggerKind,
  lineage_id: candidate.lineageId,
  reflection_snapshot_ref: candidate.reflectionSnapshotRef,
  reflection_plan_id: candidate.reflectionPlanId,
  input_bundle_ref: candidate.inputBundleRef,
  input_bundle_hash: candidate.inputBundleHash,
  request_hash: candidate.requestHash,
});

const parseCloudReplayClaim = (
  parent: XuanxueAiProductionOrder,
  child: XuanxueAiProductionOrder,
) => XuanxueAiProductionCloudClaimedJobSchema.parse({
  protocol_version: "xuanxue-ai-production-v3",
  ...cloudOrderIdentity(child),
  idempotency_key: `idem:${child.orderId}`,
  frozen_subject: cloudSubject(child),
  conversation_scope_ref: child.conversationScopeRef,
  conversation_parent: {
    relation: child.conversationParent!.relation,
    job_id: parent.orderId,
    stage_id: "analysis",
    execution_id: child.conversationParent!.executionId,
    raw_output_hash: child.conversationParent!.rawOutputHash,
    input_bundle_hash: child.conversationParent!.inputBundleHash,
    conversation_scope_ref: child.conversationParent!.conversationScopeRef,
  },
  join_parents: [],
  continuation_parent_replay: {
    ...cloudOrderIdentity(parent),
    frozen_subject: cloudSubject(parent),
    conversation_scope_ref: parent.conversationScopeRef,
    conversation_parent: null,
    join_parents: [],
    dependency_replays: [],
    seeded_stages: [],
    materials: parent.materials.map(cloudMaterial),
    created_at: parent.createdAt,
  },
  seeded_stages: [],
  execution_lane: "supervised_local_gpt_web",
  materials: child.materials.map(cloudMaterial),
  status: "leased",
  lease_owner: "fixture-device",
  lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
  retry_not_before: null,
  result_json: null,
  failure_ledger: [],
  created_at: child.createdAt,
  updated_at: child.createdAt,
  lease_token: "fixture-lease-token",
  lease_version: 1,
});

const assertCloudReplayGraphGate = (
  cloudClaim: ReturnType<typeof parseCloudReplayClaim>,
): void => {
  assert.throws(
    () => XuanxueAiProductionCloudClaimedJobSchema.parse({
      ...cloudClaim,
      continuation_parent_replay: {
        ...cloudClaim.continuation_parent_replay!,
        conversation_parent: {
          relation: "forked_from_checkpoint",
          job_id: "aiprod_missing_replay_ancestor",
          stage_id: "base_interpretation",
          execution_id: "missing-ancestor-execution",
          raw_output_hash: hash("missing-ancestor-output"),
          input_bundle_hash: hash("missing-ancestor-input"),
          conversation_scope_ref: "missing-ancestor-scope",
        },
        dependency_replays: [],
      },
    }),
    /PARENT_REPLAY_GRAPH_INCOMPLETE/u,
  );
};

const acceptCloudRehydratedParent = async (
  input: ParentRebuildAcceptanceInput,
): Promise<void> => {
  const parent = order(
    "aiprod_cloud_replay_parent",
    "qimen_professional_answer",
    ["analysis"],
  );
  const originalHash = hash(JSON.stringify({
    stage: "analysis",
    verdict: "fixture-transport-only",
  }));
  const child = qimenFollowupAfterLoss(
    parent,
    {
      executionId: `xuanxue-ai-production:${parent.orderId}:analysis`,
      rawOutputHash: originalHash,
    },
    "aiprod_cloud_replay_child",
  );
  const cloudClaim = parseCloudReplayClaim(parent, child);
  assert.equal(cloudClaim.continuation_parent_replay?.job_id, parent.orderId);
  assertCloudReplayGraphGate(cloudClaim);
  createXuanxueAiProductionOrder(input.runtime, parent);
  createXuanxueAiProductionOrder(input.runtime, child);
  const before = input.gateway.requests.length;
  const result = await executeWithCoordinator(input, child.orderId);
  assert.equal(result.status, "completed", result.failureReason ?? undefined);
  assert.equal(
    input.gateway.requests.length - before,
    2,
    "a cloud replay package must reconstruct an absent local parent before the follow-up",
  );
  assert.ok(input.runtime.store.readParentConversationRebuild({
    parentJobId: parent.orderId,
    parentStageId: "analysis",
    originalRawOutputHash: originalHash,
  }));
};

export const acceptXuanxueParentRebuilds = async (
  input: ParentRebuildAcceptanceInput,
): Promise<void> => {
  await acceptLostProviderParent(input);
  await acceptDivergentRebuild(input);
  await acceptFirstForkStageRebuild(input);
  await acceptCloudForkParentReplayOrder(input);
  await acceptCloudRehydratedParent(input);
};
