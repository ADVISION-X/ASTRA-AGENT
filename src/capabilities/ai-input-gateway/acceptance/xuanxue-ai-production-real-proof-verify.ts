import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import type { WebChatExecutionRecord } from "../runtime/web-chat-execution-state.js";
import { readWebChatResponseCheckpoint } from "../runtime/web-chat-response-checkpoint.js";

const runRoot = process.env.XUANXUE_AI_REAL_RUN_ROOT?.trim();
assert.ok(runRoot, "XUANXUE_AI_REAL_RUN_ROOT is required");
const executionDirectory = path.join(
  runRoot,
  "runtime-data",
  "ai-input-gateway",
  "web-chat-executions",
);
const records = await Promise.all((await readdir(executionDirectory)).map(
  async (name) => JSON.parse(
    await readFile(path.join(executionDirectory, name), "utf8"),
  ) as WebChatExecutionRecord,
));
const byId = new Map(records.map((record) => [record.executionId, record]));
const id = (orderId: string, stageId: string): string =>
  `xuanxue-ai-production:${orderId}:${stageId}`;
const requireRecord = (
  orderId: string,
  stageId: string,
): WebChatExecutionRecord => {
  const executionId = id(orderId, stageId);
  const record = byId.get(executionId);
  assert.ok(record, `missing real provider record ${executionId}`);
  assert.equal(record.status, "response_captured", executionId);
  assert.ok(record.submission?.canonicalConversationUrl, executionId);
  assert.ok(record.responseCheckpoint, executionId);
  return record;
};
const url = (record: WebChatExecutionRecord): string =>
  record.submission!.canonicalConversationUrl!;

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
assert.equal(
  url(requireRecord("aiprod_hehun_report_followup", "followup")),
  url(hehunFinal),
);

const qimen = requireRecord("aiprod_qimen_parent", "analysis");
assert.equal(
  url(requireRecord("aiprod_qimen_report_followup", "followup")),
  url(qimen),
);
assert.equal(
  url(requireRecord("aiprod_bazi_report_followup", "question_analysis")),
  url(bz03),
);

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
  record: WebChatExecutionRecord,
  count: number,
  requiredRefFragments: readonly string[],
): void => {
  assert.equal(record.uploadedFiles.length, count);
  assert.equal(record.attachmentUploadProof?.status, "attachments_stable");
  assert.equal(record.attachmentUploadProof?.expectedFileCount, count);
  assert.equal(record.attachmentUploadProof?.detectedFileCount, count);
  for (const fragment of requiredRefFragments) {
    assert.ok(record.uploadedFiles.some((file) =>
      file.inputRefId.includes(fragment)), fragment);
  }
  assert.equal(new Set(record.uploadedFiles.map((file) => file.fileName)).size, count);
};
assertUploads(nm01Author, 6, [
  ":prior:question_analysis",
  ":typed-participant-manifest",
  ":participant:aux-1",
  ":participant:aux-2",
  ":participant:aux-3",
  ":participant:aux-4",
]);
assertUploads(hehunFinal, 3, [
  ":typed-participant-manifest",
  ":participant:party-a",
  ":participant:party-b",
]);
assertUploads(nm02, 6, [
  "selected-report:",
  ":typed-participant-manifest",
  ":participant:aux-1",
  ":participant:aux-2",
  ":participant:aux-3",
  ":participant:aux-4",
]);

const outputs = await Promise.all(records.map(async (record) => ({
  executionId: record.executionId,
  text: await readWebChatResponseCheckpoint(record.responseCheckpoint!),
})));
const tokens = outputs.map((output) =>
  output.text.match(/XUANXUE_[a-f0-9]{8}_\d{2}/u)?.[0] ?? null);
assert.ok(tokens.every(Boolean));
assert.equal(new Set(tokens).size, records.length);

process.stdout.write(`${JSON.stringify({
  marker: "[ACCEPTANCE][XUANXUE-AI-PRODUCTION][REAL-PROOF-VERIFY]",
  runRoot,
  recordCount: records.length,
  bazi: {
    base: url(base),
    bz05: url(bz05),
    bz03: url(bz03),
    nm01: url(nm01Question),
    nm01Continuation: url(nm01Author),
  },
  hehun: [url(partyA), url(partyB), url(hehunFinal)],
  qimen: url(qimen),
  nm02: url(nm02),
  uploadCounts: {
    nm01: nm01Author.uploadedFiles.length,
    hehun: hehunFinal.uploadedFiles.length,
    nm02: nm02.uploadedFiles.length,
  },
  status: "PASS",
}, null, 2)}\n`);
