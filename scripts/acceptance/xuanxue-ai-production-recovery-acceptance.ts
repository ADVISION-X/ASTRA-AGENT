import assert from "node:assert/strict";
import path from "node:path";

import {
  createXuanxueAiProductionOrder,
  executeXuanxueAiProductionOrder,
  XuanxueAiProductionStore,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import { FixtureGateway, hash, order } from "./xuanxue-ai-production-fixture.js";

type RecoveryInput = {
  dataDir: string;
  runtime: XuanxueAiProductionRuntime;
  gateway: FixtureGateway;
};

const acceptTerminalAttachmentRecovery = async ({ dataDir, runtime }: RecoveryInput): Promise<void> => {
  const terminalAttachmentOrder = order(
    "aiprod_terminal_attachment_no_reentry",
    "qimen_professional_answer",
    ["analysis"],
  );
  terminalAttachmentOrder.materials[0]!.inputRefs = [{
    id: "terminal-attachment-fixture",
    kind: "package_manifest_json",
    summary: "terminal attachment transport acceptance fixture",
    filePath: "/fixture/terminal-attachment-fixture.json",
    fileName: "terminal-attachment-fixture.json",
    mimeType: "application/json",
    sha256: hash("terminal-attachment-fixture"),
    byteCount: 27,
  }];
  const terminalAttachmentGateway = new FixtureGateway();
  const terminalAttachmentStore = new XuanxueAiProductionStore(
    path.join(dataDir, "terminal-attachment-no-reentry"),
  );
  const terminalAttachmentRuntime: XuanxueAiProductionRuntime = {
    ...runtime,
    aiInputGateway: terminalAttachmentGateway,
    store: terminalAttachmentStore,
  };
  createXuanxueAiProductionOrder(terminalAttachmentRuntime, terminalAttachmentOrder);
  terminalAttachmentGateway.faults.terminalAttachment.set(
    `${terminalAttachmentOrder.orderId}:analysis`,
    1,
  );
  const callsBefore = terminalAttachmentGateway.requests.length;
  const result = await executeXuanxueAiProductionOrder(
    terminalAttachmentRuntime,
    terminalAttachmentOrder.orderId,
  );
  assert.equal(result.status, "failed");
  assert.equal(terminalAttachmentGateway.requests.length - callsBefore, 1);
  const replay = await executeXuanxueAiProductionOrder(
    terminalAttachmentRuntime,
    terminalAttachmentOrder.orderId,
  );
  assert.equal(replay.status, "failed");
  assert.equal(terminalAttachmentGateway.requests.length - callsBefore, 1);
  assert.equal(
    replay.stages[0]?.aiFeedResult?.providerProof.attachmentUploadProof?.uploadAttemptId,
    "fixture-terminal-attachment-attempt",
  );
  terminalAttachmentStore.close();

};

const acceptPreSubmitBlockRecovery = async ({ dataDir, runtime }: RecoveryInput): Promise<void> => {
  const blockedOrder = order(
    "aiprod_public_provider_input_blocked_before_submission",
    "public_knowledge_article_pipeline",
    ["corpus_research", "article_synthesis", "article_image_generation"],
  );
  blockedOrder.materials[0]!.inputRefs = [{
    id: "public-corpus-fixture",
    kind: "public_knowledge_ready_corpus",
    summary: "governed public knowledge corpus",
    filePath: "/fixture/public-corpus.md",
    fileName: "00-本领域READY古籍全集.md",
    mimeType: "text/markdown; charset=utf-8",
    sha256: hash("public-corpus-fixture"),
    byteCount: 27,
  }];
  const blockedGateway = new FixtureGateway();
  const blockedStore = new XuanxueAiProductionStore(
    path.join(dataDir, "public-provider-input-blocked-before-submission"),
  );
  const blockedRuntime: XuanxueAiProductionRuntime = {
    ...runtime,
    aiInputGateway: blockedGateway,
    store: blockedStore,
  };
  createXuanxueAiProductionOrder(blockedRuntime, blockedOrder);
  blockedGateway.faults.terminalAttachment.set(`${blockedOrder.orderId}:corpus_research`, 1);
  const blocked = await executeXuanxueAiProductionOrder(blockedRuntime, blockedOrder.orderId);
  assert.equal(blocked.status, "failed");
  assert.match(blocked.failureReason ?? "", /^XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_BLOCKED_BEFORE_SUBMISSION:/u);
  assert.equal(blockedGateway.requests.length, 1);
  assert.equal(blocked.stages[0]?.aiFeedResult?.providerProof.attachmentUploadProof?.status, "failed");
  assert.equal(blocked.stages[0]?.aiFeedResult?.providerProof.webChatUrl, null);
  const blockedReplay = await executeXuanxueAiProductionOrder(blockedRuntime, blockedOrder.orderId);
  assert.equal(blockedReplay.status, "failed");
  assert.equal(blockedGateway.requests.length, 1);
  blockedStore.close();
};

const acceptAttachmentRecovery = async (input: RecoveryInput): Promise<void> => {
  await acceptTerminalAttachmentRecovery(input);
  await acceptPreSubmitBlockRecovery(input);
};

const acceptRetryRecovery = async ({ runtime, gateway }: RecoveryInput): Promise<void> => {
  const transientOrder = order("aiprod_transient_stage_retry", "qimen_professional_answer", ["analysis"]);
  createXuanxueAiProductionOrder(runtime, transientOrder);
  gateway.faults.transient.set(`${transientOrder.orderId}:analysis`, 1);
  const beforeTransient = gateway.requests.length;
  const transientPending = await executeXuanxueAiProductionOrder(runtime, transientOrder.orderId);
  assert.equal(transientPending.status, "recovery_pending");
  assert.equal(gateway.requests.length - beforeTransient, 1,
    "one recoverable failure must return to the Cloud recovery chain without an in-lease Stage replay");
  const transientResult = await executeXuanxueAiProductionOrder(runtime, transientOrder.orderId);
  assert.equal(transientResult.status, "completed");
  assert.equal(gateway.requests.length - beforeTransient, 2);
  assert.equal(
    new Set(gateway.executionIds.slice(beforeTransient)).size,
    1,
    "a recoverable transport failure must retain one execution id so a captured turn can never be resubmitted",
  );
  assert.equal(gateway.supersededExecutionIds.slice(beforeTransient).filter(Boolean).length, 0);

  const monitoredOrder = order("aiprod_submitted_monitor_interference", "qimen_professional_answer", ["analysis"]);
  createXuanxueAiProductionOrder(runtime, monitoredOrder);
  gateway.faults.submittedReview.set(`${monitoredOrder.orderId}:analysis`, 1);
  const beforeMonitor = gateway.requests.length;
  const monitoredResult = await executeXuanxueAiProductionOrder(runtime, monitoredOrder.orderId);
  assert.equal(monitoredResult.status, "review_required");
  assert.equal(gateway.requests.length - beforeMonitor, 1);
  assert.equal(
    new Set(gateway.executionIds.slice(beforeMonitor)).size,
    1,
    "a submitted turn interrupted by a second physical tab must stop without another logical submission",
  );
  assert.equal(gateway.supersededExecutionIds.slice(beforeMonitor).filter(Boolean).length, 0);

  const contaminatedNaming = order("aiprod_contaminated_naming", "naming_from_existing_bazi_report", ["naming_author"]);
  contaminatedNaming.frozenSubject.participants[0]!.roleCode = "naming_target";
  contaminatedNaming.frozenSubject.participantManifestHash = hash(JSON.stringify(contaminatedNaming.frozenSubject.participants));
  gateway.faults.contaminated.set(`${contaminatedNaming.orderId}:naming_author`, 1);
  const beforeContaminated = gateway.requests.length;
  createXuanxueAiProductionOrder(runtime, contaminatedNaming);
  const contaminated = await executeXuanxueAiProductionOrder(runtime, contaminatedNaming.orderId);
  assert.equal(contaminated.status, "failed");
  assert.equal(gateway.requests.length - beforeContaminated, 1);
  const ids = gateway.executionIds.slice(beforeContaminated);
  assert.equal(new Set(ids).size, 1);
  assert.equal(gateway.supersededExecutionIds.slice(beforeContaminated).filter(Boolean).length, 0);
  assert.match(contaminated.stages[0]?.rawResponseText ?? "", /filecite/u);
  assert.equal(transientResult.stages[0]?.attemptCount, 2);
};

const acceptIdentityRecovery = async ({ runtime, gateway }: RecoveryInput): Promise<void> => {
  const freshPendingOrder = order("aiprod_fresh_conversation_pending", "qimen_professional_answer", ["analysis"]);
  createXuanxueAiProductionOrder(runtime, freshPendingOrder);
  gateway.faults.freshConversationPending.set(`${freshPendingOrder.orderId}:analysis`, 1);
  const beforeFresh = gateway.requests.length;
  const freshPending = await executeXuanxueAiProductionOrder(runtime, freshPendingOrder.orderId);
  assert.equal(freshPending.status, "recovery_pending");
  assert.equal(gateway.requests.length - beforeFresh, 1,
    "a bounded page-hydration failure must leave the current lease instead of replaying the whole Stage");
  const fresh = await executeXuanxueAiProductionOrder(runtime, freshPendingOrder.orderId);
  assert.equal(fresh.status, "completed");
  assert.equal(
    new Set(gateway.executionIds.slice(beforeFresh)).size,
    1,
    "a still-hydrating fresh root resumes the same execution id on the next recovery entry",
  );
  assert.equal(
    gateway.requests.slice(beforeFresh).length,
    2,
    "the recoverable hydration observation must resume the same job only after returning through recovery",
  );
  assert.equal(gateway.supersededExecutionIds.slice(beforeFresh).filter(Boolean).length, 0);

  const boundedOrder = order("aiprod_bounded_pre_submit_identity_replacement", "qimen_professional_answer", ["analysis"]);
  createXuanxueAiProductionOrder(runtime, boundedOrder);
  gateway.faults.preSubmitIdentityConflict.set(`${boundedOrder.orderId}:analysis`, 2);
  const beforeBounded = gateway.requests.length;
  const bounded = await executeXuanxueAiProductionOrder(runtime, boundedOrder.orderId);
  assert.equal(bounded.status, "review_required");
  const ids = gateway.executionIds.slice(beforeBounded);
  assert.equal(new Set(ids).size, 1);
  assert.equal(ids.length, 1);
  assert.equal(
    gateway.supersededExecutionIds.slice(beforeBounded).filter(Boolean).length,
    0,
    "a foreign pre-submit identity must stop without creating a replacement execution",
  );
};

export const acceptXuanxueAiProductionRecovery = async (input: RecoveryInput): Promise<void> => {
  await acceptAttachmentRecovery(input);
  await acceptRetryRecovery(input);
  await acceptIdentityRecovery(input);
};
