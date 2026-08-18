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
  assert.equal(result.status, "recovery_pending");
  assert.equal(terminalAttachmentGateway.requests.length - callsBefore, 1);
  const replay = await executeXuanxueAiProductionOrder(
    terminalAttachmentRuntime,
    terminalAttachmentOrder.orderId,
  );
  assert.equal(replay.status, "recovery_pending");
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
  assert.equal(monitoredResult.status, "completed");
  assert.equal(
    new Set(gateway.executionIds.slice(beforeMonitor)).size,
    1,
    "a submitted turn interrupted by a second physical monitor tab must resume the same execution without another logical submission",
  );
  assert.equal(gateway.supersededExecutionIds.slice(beforeMonitor).filter(Boolean).length, 0);

  const contaminatedNaming = order("aiprod_contaminated_naming", "naming_from_existing_bazi_report", ["naming_author"]);
  contaminatedNaming.frozenSubject.participants[0]!.roleCode = "naming_target";
  contaminatedNaming.frozenSubject.participantManifestHash = hash(JSON.stringify(contaminatedNaming.frozenSubject.participants));
  gateway.faults.contaminated.set(`${contaminatedNaming.orderId}:naming_author`, 1);
  const beforeContaminated = gateway.requests.length;
  createXuanxueAiProductionOrder(runtime, contaminatedNaming);
  const contaminated = await executeXuanxueAiProductionOrder(runtime, contaminatedNaming.orderId);
  assert.equal(contaminated.status, "completed");
  assert.equal(gateway.requests.length - beforeContaminated, 2);
  const ids = gateway.executionIds.slice(beforeContaminated);
  assert.equal(new Set(ids).size, 2);
  assert.equal(gateway.supersededExecutionIds.at(-1), ids[0]);
  assert.doesNotMatch(contaminated.result?.stages[0]?.rawResponseText ?? "", /filecite/u);
  assert.equal(transientResult.stages[0]?.attemptCount, 2);
};

const acceptIdentityRecovery = async ({ runtime, gateway }: RecoveryInput): Promise<void> => {
  const freshPendingOrder = order("aiprod_fresh_conversation_pending", "qimen_professional_answer", ["analysis"]);
  createXuanxueAiProductionOrder(runtime, freshPendingOrder);
  gateway.faults.freshConversationPending.set(`${freshPendingOrder.orderId}:analysis`, 1);
  const beforeFresh = gateway.requests.length;
  const fresh = await executeXuanxueAiProductionOrder(runtime, freshPendingOrder.orderId);
  assert.equal(fresh.status, "completed");
  assert.equal(
    new Set(gateway.executionIds.slice(beforeFresh)).size,
    1,
    "a still-hydrating fresh root is a recoverable wait on the same execution id",
  );
  assert.equal(gateway.supersededExecutionIds.slice(beforeFresh).filter(Boolean).length, 0);

  const boundedOrder = order("aiprod_bounded_pre_submit_identity_replacement", "qimen_professional_answer", ["analysis"]);
  createXuanxueAiProductionOrder(runtime, boundedOrder);
  gateway.faults.preSubmitIdentityConflict.set(`${boundedOrder.orderId}:analysis`, 2);
  const beforeBounded = gateway.requests.length;
  const bounded = await executeXuanxueAiProductionOrder(runtime, boundedOrder.orderId);
  assert.equal(bounded.status, "completed");
  const ids = gateway.executionIds.slice(beforeBounded);
  assert.equal(new Set(ids).size, 2);
  assert.equal(ids[1], ids[2]);
  assert.equal(
    ids[1] === ids[2],
    true,
    "a second identity conflict must recover on the replacement execution instead of minting restart:2",
  );
  assert.equal(
    gateway.supersededExecutionIds.slice(beforeBounded).filter(Boolean).length,
    1,
    "a stage may replace one proven foreign pre-submit identity only once",
  );
};

export const acceptXuanxueAiProductionRecovery = async (input: RecoveryInput): Promise<void> => {
  await acceptAttachmentRecovery(input);
  await acceptRetryRecovery(input);
  await acceptIdentityRecovery(input);
};
