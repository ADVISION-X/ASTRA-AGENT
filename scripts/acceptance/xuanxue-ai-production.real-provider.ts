import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

import { XuanxueDynamicProofBindingContract } from "../../src/capabilities/ai-input-gateway/schema.js";
import {
  attestXuanxueAiProductionProviderRun,
  XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import {
  canonicalXuanxueRealRunRoot,
  currentXuanxueSourceCandidate,
  readXuanxueRealChromeEvidence,
  realChromeEvidenceArgument,
  realDynamicProofBindingArgument,
  validateBoundRuntimeReceipt,
} from "./xuanxue-ai-production-real-proof-support.js";

type ResponseCheckpoint = {
  rawOutputRef: string;
  rawOutputHash: `sha256:${string}`;
  byteCount: number;
};

type ProviderRecord = {
  executionId: string;
  status: string;
  updatedAt: string;
  submission: {
    canonicalConversationUrl?: string | null;
    previousUserMessageCount?: number;
    previousAssistantCount?: number;
  } | null;
  responseCheckpoint: ResponseCheckpoint | null;
  forkActionProof: { parentConversationUrl: string } | null;
  uploadedFiles: Array<{ inputRefId: string; fileName: string }>;
  attachmentUploadProof: {
    status: string;
    expectedFileCount: number;
    detectedFileCount: number;
  } | null;
};

const runRoot = process.env.XUANXUE_AI_REAL_RUN_ROOT?.trim();
assert.ok(runRoot, "XUANXUE_AI_REAL_RUN_ROOT is required");
assert.equal(
  path.resolve(runRoot),
  canonicalXuanxueRealRunRoot(),
  "real Provider proof must consume the production Workbench data directory",
);
const bindingPath = realDynamicProofBindingArgument();
const evidencePath = realChromeEvidenceArgument();
const bindingRaw = await readFile(bindingPath, "utf8");
const dynamicProofBinding = XuanxueDynamicProofBindingContract.validate(
  JSON.parse(bindingRaw),
  currentXuanxueSourceCandidate(),
  XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
);
const evidence = readXuanxueRealChromeEvidence(evidencePath);
validateBoundRuntimeReceipt({ evidence, binding: dynamicProofBinding, runRoot });
const executionDirectory = path.join(
  runRoot,
  "runtime-data",
  "ai-input-gateway",
  "web-chat-executions",
);
const records = await Promise.all((await readdir(executionDirectory)).map(
  async (name): Promise<ProviderRecord> => {
    const rawRecord = await readFile(path.join(executionDirectory, name), "utf8");
    const record = JSON.parse(rawRecord) as ProviderRecord;
    XuanxueDynamicProofBindingContract.assertProviderRecordHash(
      dynamicProofBinding,
      record.executionId,
      rawRecord,
    );
    return record;
  },
));
const byId = new Map(records.map((record) => [record.executionId, record]));
assert.equal(byId.size, records.length, "provider executionId must be unique");
assert.deepEqual(
  [...Object.keys(dynamicProofBinding.provider_record_hashes)].sort(),
  [...byId.keys()].sort(),
  "provider record set must exactly match the bound real run",
);
const terminalJobIds = [...new Set(records.map((record) => {
  const prefix = "xuanxue-ai-production:";
  const lastSeparator = record.executionId.lastIndexOf(":");
  assert.ok(record.executionId.startsWith(prefix) && lastSeparator > prefix.length);
  return record.executionId.slice(prefix.length, lastSeparator);
}))].sort();
assert.deepEqual(
  terminalJobIds,
  dynamicProofBinding.cloud_terminal_job_ids,
  "provider records must exactly match the bound Cloud terminal jobs",
);
const cloudAttestation = await attestXuanxueAiProductionProviderRun({
  dataDir: runRoot,
  candidateHash: dynamicProofBinding.candidate_hash,
  terminalJobIds,
  predecessor: {
    deviceId: evidence.runtimeReceipt.device_id,
    deviceEpoch: evidence.runtimeReceipt.device_epoch,
    workerSessionId: evidence.runtimeReceipt.worker_session_id,
    workerSessionEpoch: evidence.runtimeReceipt.worker_session_epoch,
    runtimeAttestationReceiptHash: evidence.runtimeReceipt.runtime_attestation_receipt_hash,
  },
  readRuntimeState: async () => ({
    businessInFlight: 0,
    browserActionInFlight: evidence.runtimeReceipt.browser_lane_state === "busy" ? 1 : 0,
    browserAuthorityState: evidence.runtimeReceipt.browser_authority_state,
    browserTargetState: evidence.runtimeReceipt.browser_target_state,
    browserLaneState: evidence.runtimeReceipt.browser_lane_state,
    drainState: "open",
    ledgerReconciled: true,
  }),
});

const id = (orderId: string, stageId: string): string =>
  `xuanxue-ai-production:${orderId}:${stageId}`;
const requireRecord = (orderId: string, stageId: string): ProviderRecord => {
  const executionId = id(orderId, stageId);
  const record = byId.get(executionId);
  assert.ok(record, `missing real provider record ${executionId}`);
  assert.equal(record.status, "response_captured", executionId);
  assert.ok(record.submission?.canonicalConversationUrl, executionId);
  assert.ok(record.responseCheckpoint, executionId);
  XuanxueDynamicProofBindingContract.assertTimestampFresh(
    record.updatedAt,
    dynamicProofBinding,
    `${executionId}.updatedAt`,
  );
  return record;
};
const url = (record: ProviderRecord): string => {
  const value = record.submission?.canonicalConversationUrl;
  assert.ok(value, record.executionId);
  return value;
};

const base = requireRecord("aiprod_bazi_private_base", "base_interpretation");
const bz05 = requireRecord("aiprod_bz05", "chart_interpretation");
const bz03 = requireRecord("aiprod_bz03", "question_analysis");
const nm01Question = requireRecord("aiprod_nm01", "question_analysis");
const nm01Author = requireRecord("aiprod_nm01", "naming_author");
for (const child of [bz05, bz03, nm01Question]) {
  assert.equal(child.forkActionProof?.parentConversationUrl, url(base));
  assert.notEqual(url(child), url(base));
}
assert.equal(new Set([url(bz05), url(bz03), url(nm01Question)]).size, 3);
assert.equal(url(nm01Question), url(nm01Author));

const partyA = requireRecord("aiprod_hehun_party_a", "party_a_interpretation");
const partyB = requireRecord("aiprod_hehun_party_b", "party_b_interpretation");
const hehunFinal = requireRecord("aiprod_hehun_final", "final_compatibility");
assert.equal(new Set([url(partyA), url(partyB), url(hehunFinal)]).size, 3);
assert.equal(url(requireRecord("aiprod_hehun_report_followup", "followup")), url(hehunFinal));

const qimen = requireRecord("aiprod_qimen_parent", "analysis");
assert.equal(url(requireRecord("aiprod_qimen_report_followup", "followup")), url(qimen));
assert.equal(url(requireRecord("aiprod_bazi_report_followup", "question_analysis")), url(bz03));

for (const prefix of ["aiprod_naming_aux_base", "aiprod_nm02_aux_base"]) {
  for (let ordinal = 1; ordinal <= 4; ordinal += 1) {
    requireRecord(`${prefix}_${ordinal}`, "base_interpretation");
  }
}
const nm02 = requireRecord("aiprod_nm02", "naming_author");
assert.notEqual(url(nm02), url(bz03));
assert.equal(nm02.submission?.previousUserMessageCount, 0);
assert.equal(nm02.submission?.previousAssistantCount, 0);

const assertUploads = (
  record: ProviderRecord,
  count: number,
  requiredRefFragments: readonly string[],
): void => {
  assert.equal(record.uploadedFiles.length, count);
  assert.equal(record.attachmentUploadProof?.status, "attachments_stable");
  assert.equal(record.attachmentUploadProof?.expectedFileCount, count);
  assert.equal(record.attachmentUploadProof?.detectedFileCount, count);
  for (const fragment of requiredRefFragments) {
    assert.ok(record.uploadedFiles.some((file) => file.inputRefId.includes(fragment)), fragment);
  }
  assert.equal(new Set(record.uploadedFiles.map((file) => file.fileName)).size, count);
};
assertUploads(nm01Author, 6, [
  ":prior:question_analysis", ":typed-participant-manifest",
  ":participant:aux-1", ":participant:aux-2", ":participant:aux-3", ":participant:aux-4",
]);
assertUploads(hehunFinal, 3, [
  ":typed-participant-manifest", ":participant:party-a", ":participant:party-b",
]);
assertUploads(nm02, 6, [
  "selected-report:", ":typed-participant-manifest",
  ":participant:aux-1", ":participant:aux-2", ":participant:aux-3", ":participant:aux-4",
]);

const readCheckpoint = async (checkpoint: ResponseCheckpoint): Promise<string> => {
  const executionId = records.find(
    (record) => record.responseCheckpoint === checkpoint,
  )?.executionId;
  assert.ok(executionId, "checkpoint must belong to one bound execution");
  const expectedCheckpoint = path.join(
    runRoot,
    "runtime-data",
    "ai-input-gateway",
    "web-chat-response-checkpoints",
    `${createHash("sha256").update(executionId).digest("hex")}.txt`,
  );
  assert.equal(path.resolve(checkpoint.rawOutputRef), path.resolve(expectedCheckpoint));
  const bytes = await readFile(expectedCheckpoint);
  const actualHash = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  assert.equal(bytes.byteLength, checkpoint.byteCount, "provider checkpoint byte count");
  assert.equal(actualHash, checkpoint.rawOutputHash, "provider checkpoint hash");
  return bytes.toString("utf8");
};
const outputs = await Promise.all(records.map(async (record) => ({
  executionId: record.executionId,
  text: await readCheckpoint(record.responseCheckpoint!),
})));
const tokens = outputs.map((output) =>
  output.text.match(/XUANXUE_[a-f0-9]{8}_\d{2}/u)?.[0] ?? null);
assert.ok(tokens.every(Boolean));
assert.equal(new Set(tokens).size, records.length);

const databasePath = path.join(runRoot, "plugin-tasks", "xuanxue-ai-production", "xuanxue_ai_production.sqlite");
const database = new Database(databasePath, { readonly: true, fileMustExist: true });
const integrity = database.pragma("integrity_check", { simple: true });
assert.equal(integrity, "ok", "production database integrity");
const orderRows = database.prepare<[], { source_task_id: string; status: string }>(
  "select source_task_id,status from production_orders order by source_task_id",
).all();
database.close();
const terminalOrders = new Map(orderRows.map((row) => [row.source_task_id, row.status]));
for (const jobId of terminalJobIds) assert.equal(terminalOrders.get(jobId), "completed", `durable terminal order ${jobId}`);
const databaseReceipt = createHash("sha256").update(JSON.stringify(orderRows)).digest("hex");
const checkpointDirectory = path.join(runRoot, "runtime-data", "ai-input-gateway", "web-chat-response-checkpoints");
const storageReceipt = createHash("sha256").update(outputs.map((output) => {
  const record = byId.get(output.executionId)!;
  return `${output.executionId}:${record.responseCheckpoint!.rawOutputHash}:${record.responseCheckpoint!.byteCount}`;
}).sort().join("\n")).digest("hex");

const continuationReceipt = {
  schemaVersion: "xuanxue-ai-provider-continuation-proof.v1",
  runId: dynamicProofBinding.run_id,
  candidateHash: dynamicProofBinding.candidate_hash,
  contractManifestHash: dynamicProofBinding.contract_manifest_hash,
  predecessor: {
    extensionId: evidence.extensionId,
    deviceId: evidence.runtimeReceipt.device_id,
    deviceEpoch: evidence.runtimeReceipt.device_epoch,
    workerSessionId: evidence.runtimeReceipt.worker_session_id,
    workerSessionEpoch: evidence.runtimeReceipt.worker_session_epoch,
    runtimeAttestationReceiptHash: evidence.runtimeReceipt.runtime_attestation_receipt_hash,
  },
  successor: {
    deviceId: cloudAttestation.deviceId,
    deviceEpoch: cloudAttestation.deviceEpoch,
    workerSessionId: cloudAttestation.workerSessionId,
    workerSessionEpoch: cloudAttestation.workerSessionEpoch,
    runtimeAttestationReceiptHash: cloudAttestation.runtimeAttestationReceiptHash,
  },
  terminalReceiptHashes: cloudAttestation.terminalReceiptHashes,
  capturedAt: cloudAttestation.heartbeatAt,
};
process.stdout.write(`${JSON.stringify({
  marker: "[ACCEPTANCE][XUANXUE-AI-PRODUCTION][REAL-PROVIDER]",
  runRoot,
  runId: dynamicProofBinding.run_id,
  candidateHash: dynamicProofBinding.candidate_hash,
  contractManifestHash: dynamicProofBinding.contract_manifest_hash,
  recordCount: records.length,
  continuationReceipt,
  cloudTerminalJobCount: cloudAttestation.terminalJobIds.length,
  status: "PASS",
}, null, 2)}\n`);
const attestationReceipt = continuationReceipt.successor.runtimeAttestationReceiptHash.replace(/^sha256:/u, "");
const providerReceipt = Object.values(dynamicProofBinding.provider_record_hashes)[0];
assert.ok(providerReceipt);
emitQualityProofObservation({ lawId: "LAW-XUANXUE-AI-PRODUCTION-001-V11", evidenceMode: "dynamic.service", clauses: ["forbidden:10","forbidden:11","forbidden:4","forbidden:6","forbidden:7","forbidden:9","summary"],
  locator: executionDirectory, receipt: attestationReceipt,
  observedValue: `predecessor=${continuationReceipt.predecessor.workerSessionId};successor=${continuationReceipt.successor.workerSessionId}` });
emitQualityProofObservation({ lawId: "LAW-XUANXUE-AI-PRODUCTION-001-V11", evidenceMode: "dynamic.database", clauses: ["forbidden:10","forbidden:13","forbidden:14","forbidden:4","summary"],
  locator: databasePath, receipt: databaseReceipt,
  observedValue: `integrity=${integrity};completedOrders=${terminalJobIds.length}` });
emitQualityProofObservation({ lawId: "LAW-XUANXUE-AI-PRODUCTION-001-V11", evidenceMode: "dynamic.storage", clauses: ["forbidden:10","forbidden:11","forbidden:13","forbidden:14","summary"],
  locator: checkpointDirectory, receipt: storageReceipt,
  observedValue: `checkpoints=${outputs.length};uniqueHashes=${new Set(outputs.map((output) => byId.get(output.executionId)!.responseCheckpoint!.rawOutputHash)).size}` });
emitQualityProofObservation({ lawId: "LAW-XUANXUE-AI-PRODUCTION-001-V11", evidenceMode: "dynamic.provider", clauses: ["forbidden:13","forbidden:14","forbidden:15","summary"],
  locator: executionDirectory, receipt: providerReceipt.replace(/^sha256:/u, ""),
  observedValue: `records=${records.length};uniqueTokens=${new Set(tokens).size}` });
emitQualityProofObservation({ lawId: "LAW-XUANXUE-AI-PRODUCTION-001-V11", evidenceMode: "dynamic.authorization", clauses: ["forbidden:2","forbidden:3","forbidden:4","forbidden:5","summary"],
  locator: executionDirectory, receipt: attestationReceipt,
  observedValue: `device=${continuationReceipt.successor.deviceId};sessionEpoch=${continuationReceipt.successor.workerSessionEpoch}` });
emitQualityProofObservation({ lawId: "LAW-AI-INPUT-GATEWAY-002-V2", evidenceMode: "dynamic.provider", clauses: ["forbidden:1","forbidden:4","forbidden:5","summary"],
  locator: executionDirectory, receipt: providerReceipt.replace(/^sha256:/u, ""),
  observedValue: `exactProviderRecords=${records.length};rawResponses=${outputs.length}` });
emitQualityProofObservation({ lawId: "LAW-AI-INPUT-GATEWAY-002-V2", evidenceMode: "dynamic.authorization", clauses: ["forbidden:0","forbidden:1","forbidden:2","forbidden:3","forbidden:6","summary"],
  locator: executionDirectory, receipt: attestationReceipt,
  observedValue: `authorizedDevice=${continuationReceipt.successor.deviceId};workerSession=${continuationReceipt.successor.workerSessionId}` });
