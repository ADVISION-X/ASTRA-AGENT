#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { topologyAssessment } from "./production-source.mjs";

const TOOL = resolve(new URL("./production-source.mjs", import.meta.url).pathname);
const hash = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const withIntegrity = (record) => {
  const { integrityHash: _ignored, ...content } = record;
  return { ...content, integrityHash: hash(JSON.stringify(content)) };
};

function completionRecords(task, pluginId, payload) {
  const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8");
  const payloadHash = hash(payloadBytes);
  const objectRef = `production-result:${payloadHash}`;
  const receiptHash = hash(`receipt:${payloadHash}`);
  const response = { schema_version: "xuanxue-ai-material-receipt.v6", artifact_id: "result-payload",
    role: "result_payload", object_ref: objectRef, sha256: payloadHash, byte_length: payloadBytes.byteLength,
    media_type: "application/json", state: "staged", receipt_hash: receiptHash };
  const envelope = { schema_version: "website-agent-result.v1", job_id: task.job_id,
    source_task_id: task.source_task_id, product_id: task.product_id, action_id: task.action_id,
    plugin_id: pluginId, plugin_version: 1, result_contract_id: task.result_contract_id,
    result_contract_version: task.result_contract_version, result_payload_ref: objectRef,
    result_payload_hash: payloadHash, result_payload_bytes: payloadBytes.byteLength,
    result_payload_media_type: "application/json",
    result_object_receipt: { object_ref: objectRef, sha256: payloadHash, bytes: payloadBytes.byteLength,
      media_type: "application/json", receipt_hash: receiptHash }, evidence_refs: [],
    execution_receipt_hash: hash(`execution:${payloadHash}`) };
  return { payloadBytes, envelope, response, outbox: {
    idempotencyKey: `aipresult_${payloadHash.slice(-20)}`, path: `/internal/ai-production/v6/jobs/${task.job_id}/artifacts/result_payload/result-payload`,
    headers: { "content-type": "application/json", "x-ai-content-sha256": payloadHash,
      "x-ai-content-bytes": String(payloadBytes.byteLength) }, responseHash: hash(JSON.stringify(stable(response))),
  } };
}

function installCompletion(data, payload, currentAttemptId = data.attemptId) {
  const completion = completionRecords(data.task, data.pluginId, payload);
  const database = new DatabaseSync(data.runtimeDb);
  database.prepare("delete from production_outbox where path like ?")
    .run(`/internal/ai-production/v6/jobs/${data.jobId}/artifacts/result_payload/%`);
  database.prepare("insert into production_outbox values(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    completion.outbox.idempotencyKey, "artifact", completion.outbox.path, "PUT",
    JSON.stringify(completion.outbox.headers), completion.payloadBytes, "2026-09-08T00:00:00.000Z",
    "2026-09-08T00:00:01.000Z", null, JSON.stringify(completion.response), completion.outbox.responseHash,
    completion.response.receipt_hash, null,
  );
  database.prepare(`update production_tasks set status='completed',current_attempt_id=?,current_reason=null,
    result_json=? where job_id=?`).run(currentAttemptId, JSON.stringify(completion.envelope), data.jobId);
  database.close();
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "gpt-production-source-acceptance-"));
  const repo = join(root, "repo");
  const runtimeDb = join(root, "production-runtime.sqlite");
  const browserDb = join(root, "browser-mutations.sqlite");
  const taskRoot = join(root, "tasks");
  const forensicsRoot = join(root, "forensics");
  const jobId = "aiprod_acceptance";
  const attemptId = "22222222-2222-4222-8222-222222222222";
  const pluginId = "acceptance-plugin";
  const material = Buffer.from("test-only-byte-exact-material", "utf8");
  const materialSha = hash(material);
  const materialName = "production-input.bin";
  const contractDir = join(repo, "src/plugins", pluginId);
  const childDir = join(repo, "src/capabilities/gpt/children/prepare_clean_gpt_chat");
  await mkdir(contractDir, { recursive: true });
  await mkdir(childDir, { recursive: true });
  await mkdir(join(taskRoot, jobId, "materials"), { recursive: true });
  await mkdir(forensicsRoot, { recursive: true });
  await writeFile(join(contractDir, "SKILL.md"), "production owner\n");
  await writeFile(join(contractDir, "index.ts"), "export const flow = true;\n");
  await writeFile(join(childDir, "handler.ts"), "export const child = true;\n");
  await mkdir(join(repo, "src/capabilities/gpt"), { recursive: true });
  await writeFile(join(repo, "src/capabilities/gpt/contract.ts"), "export const contract = true;\n");
  const contract = {
    schemaVersion: "product-page-evidence-contract.v1", owner: pluginId, pluginId, pluginVersion: 1,
    traceAuthority: { kind: "durable-product-forensics", sequenceOwner: "accepted-production-attempt",
      currentFlowSourcesRole: "projection-only" },
    flowOwnerSources: [`src/plugins/${pluginId}/SKILL.md`, `src/plugins/${pluginId}/index.ts`],
    routes: [{ productId: "acceptance_product", actionId: "acceptance_action",
      materialPolicy: { kind: "exact-task-material-set", requiredRoles: ["source"] },
      topology: { kind: "single-task-action-stage" } }],
  };
  const contractPath = join(contractDir, "page-evidence-contract.json");
  await writeFile(contractPath, `${JSON.stringify(contract)}\n`);
  await writeFile(join(taskRoot, jobId, "materials", materialName), material);
  const requestHash = hash("request");
  const task = { job_id: jobId, source_task_id: "source-acceptance", request_hash: requestHash,
    product_id: "acceptance_product",
    action_id: "acceptance_action", business_context_hash: hash("context"), parameters: { locale: "zh-CN" },
    result_contract_id: "website-agent-result", result_contract_version: 1,
    material_refs: [{ material_id: "material-1", ordinal: 0, role: "source", display_name: materialName,
      sha256: materialSha, bytes: material.byteLength, media_type: "application/octet-stream", storage_class: "task_scoped" }] };
  const runtime = new DatabaseSync(runtimeDb);
  runtime.exec(`create table production_tasks(job_id text primary key,request_hash text,task_json text,identity_json text,
    status text,current_attempt_id text,current_reason text,result_json text,created_at text,updated_at text)`);
  runtime.exec(`create table production_attempt_failures(job_id text not null,attempt_id text not null,
    failure_json text not null,created_at text not null,primary key(job_id,attempt_id))`);
  runtime.exec(`create table production_outbox(idempotency_key text primary key,kind text,path text,method text,
    headers_json text,body_blob blob,created_at text,sent_at text,last_error text,response_json text,
    response_hash text,receipt_hash text,next_delivery_at text)`);
  const completion = completionRecords(task, pluginId, { status: "completed" });
  runtime.prepare("insert into production_tasks values(?,?,?,?,?,?,?,?,?,?)").run(jobId, requestHash,
    JSON.stringify(task), JSON.stringify({ plugin_id: pluginId, plugin_version: 1, request_hash: requestHash }),
    "completed", attemptId, null, JSON.stringify(completion.envelope),
    "2026-09-08T00:00:00.000Z", "2026-09-08T00:00:00.000Z");
  runtime.prepare("insert into production_outbox values(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    completion.outbox.idempotencyKey, "artifact", completion.outbox.path, "PUT",
    JSON.stringify(completion.outbox.headers), completion.payloadBytes, "2026-09-08T00:00:00.000Z",
    "2026-09-08T00:00:01.000Z", null, JSON.stringify(completion.response), completion.outbox.responseHash,
    completion.response.receipt_hash, null,
  );
  runtime.close();
  const browser = new DatabaseSync(browserDb);
  browser.exec(`create table browser_mutations(command_id text,exact_call_identity_hash text,product_step_id text,
    call_id text,child_capability_id text,action_ordinal integer,request_hash text,payload_hash text,proof_hash text,
    state text,mutation_outcome text,reason text,native_cause_code text,terminal_at text,updated_at text,
    job_id text,attempt_id text)`);
  browser.close();
  const inputHash = hash("production-child-input");
  const callId = "fresh-chat";
  const exactCallIdentityHash = hash(JSON.stringify([jobId, attemptId, pluginId, 1,
    "acceptance_action", callId, "prepare_clean_gpt_chat", inputHash]));
  const record = withIntegrity({ recordType: "evidence", missionId: jobId, runId: attemptId,
    payload: { plugin_version: 1, child_capability_id: "prepare_clean_gpt_chat", action_ordinal: 1,
      exact_call_identity_hash: exactCallIdentityHash, result_status: "success", failure_code: null,
      product_step_id: "acceptance_action", call_id: callId,
      input_hash: inputHash, page_input_role_hashes: {
        promptHash: null, responseHash: null, attachmentLabelHashes: null, attachmentSetHash: null,
        modelDisplayNameHash: null, reasoningRequirement: null, conversationUrlHash: null,
        turnMarkerHash: null, assistantTurnIdHash: null,
      },
      committed_mutation: "confirmed", postcondition_result: "passed", candidate_cardinality: { raw: 1, eligible: 1 },
      started_at: "2026-09-08T00:00:00.000Z", ended_at: "2026-09-08T00:00:01.000Z" },
    createdAt: "2026-09-08T00:00:01.000Z", stepId: "acceptance_action",
    capabilityCallId: `gpt-call:${exactCallIdentityHash.slice(7)}`, sourceAbilityGroupId: "gpt",
    sourceChildCapabilityId: "prepare_clean_gpt_chat", recordRef: "rec-acceptance" });
  const forensicsPath = join(forensicsRoot, `records-${attemptId.replaceAll("-", "_")}.ndjson`);
  await writeFile(forensicsPath, `${JSON.stringify(record)}\n`);
  return { root, repo, runtimeDb, browserDb, taskRoot, forensicsRoot, forensicsPath,
    contractPath, contract, jobId, attemptId, record, task, pluginId };
}

function run(data, output, expected = 0) {
  const result = spawnSync(process.execPath, [TOOL, "--repo", data.repo, "--runtime-db", data.runtimeDb,
    "--task-root", data.taskRoot, "--forensics-root", data.forensicsRoot, "--browser-db", data.browserDb,
    "--job-id", data.jobId, "--attempt-id", data.attemptId, "--output", output], { encoding: "utf8" });
  assert.equal(result.status, expected, result.stderr || result.stdout);
  return result;
}

async function main() {
  const terminalProof = { receiptHash: hash("receipt") };
  const orderedRoute = { actionId: "produce_article", topology: { kind: "ordered-product-stages",
    stageOrder: ["corpus_research", "article_synthesis", "article_image_generation"],
    legalTerminalBranches: ["research-declined", "article-package-complete", "production-failure"],
    terminalDecision: { path: "research.decision", declineValue: "decline", proceedValue: "proceed" } } };
  const truncatedSeo = topologyAssessment(orderedRoute, [{ productStepId: "corpus_research" }], {},
    "completed", terminalProof, null, { research: { decision: "proceed" } });
  assert.equal(truncatedSeo.status, "PARTIAL");
  assert.deepEqual(truncatedSeo.gaps, ["TRACE_STAGE_INCOMPLETE"]);
  const declinedSeo = topologyAssessment(orderedRoute, [{ productStepId: "corpus_research" }], {},
    "completed", terminalProof, null, { research: { decision: "decline" } });
  assert.equal(declinedSeo.status, "OBSERVED_COMPLETE_PATH");
  assert.equal(declinedSeo.terminalBranch, "research-declined");
  const localizationRoute = { actionId: "produce_locale_catalog", topology: {
    kind: "material-declared-cohort-triplet", cohortArrayField: "cohorts", cohortIdField: "cohort_id",
    passOrder: ["candidate-a", "candidate-b", "selector"] } };
  const truncatedLocalization = topologyAssessment(localizationRoute,
    [{ productStepId: "home:candidate-a" }, { productStepId: "home:candidate-b" }],
    { cohorts: [{ cohort_id: "home" }] }, "completed", terminalProof, null, { status: "completed" });
  assert.equal(truncatedLocalization.status, "PARTIAL");
  assert.deepEqual(truncatedLocalization.gaps, ["TRACE_STAGE_INCOMPLETE"]);
  const missingSingle = topologyAssessment({ actionId: "produce", topology: { kind: "single-task-action-stage" } },
    [], {}, "completed", terminalProof, null, { status: "completed" });
  assert.equal(missingSingle.status, "PARTIAL");
  assert.deepEqual(missingSingle.gaps, ["TRACE_STAGE_INCOMPLETE"]);

  const data = await fixture();
  const output = join(data.root, "source.json");
  run(data, output);
  const source = JSON.parse(await readFile(output, "utf8"));
  assert.equal(source.sourceKind, "PRODUCTION_RUNTIME_DURABLE_TASK");
  assert.equal(source.synthetic, false);
  assert.equal(source.materials.length, 1);
  assert.equal(source.actualTrace.length, 1);
  assert.match(source.actualTrace[0].traceEntryId, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(source.actualTrace[0].callId, null);
  assert.equal(source.actualTrace[0].inputBinding.source, "FORENSICS_SAFE_PROJECTION");
  assert.equal(source.actualTrace[0].inputBinding.inputHash, data.record.payload.input_hash);
  assert.equal(source.flowStatus, "OBSERVED_COMPLETE_PATH");
  assert.equal(source.terminalBranch, "task-action-complete");
  assert.equal(source.terminalBranchProof.kind, "DURABLE_COMPLETION_RECEIPT");
  assert.equal(source.terminalBranchProof.resultPayloadHash, hash(Buffer.from(JSON.stringify({ status: "completed" }))));
  assert.match(source.terminalBranchProof.resultPayloadOutboxHash, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(JSON.stringify(source).includes("candidateBinding"), false);
  assert.equal(JSON.stringify(source).includes("worktreeDigest"), false);

  const tamperedPayloadRuntime = new DatabaseSync(data.runtimeDb);
  tamperedPayloadRuntime.prepare("update production_outbox set body_blob=? where kind='artifact'")
    .run(Buffer.from(JSON.stringify({ status: "tampered" }), "utf8"));
  tamperedPayloadRuntime.close();
  assert.match(run(data, join(data.root, "tampered-result-payload.json"), 1).stderr,
    /PRODUCT_RESULT_OUTBOX_INVALID/u);
  installCompletion(data, { status: "completed" });

  const receiptDb = new DatabaseSync(data.browserDb);
  receiptDb.prepare("insert into browser_mutations values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    "command-wrong", data.record.payload.exact_call_identity_hash, "wrong-step", "actual-browser-call-id",
    "prepare_clean_gpt_chat", 1, hash("request"), hash("payload"), hash("proof"), "CONFIRMED",
    "confirmed", null, null, "2026-09-08T00:00:01.000Z", "2026-09-08T00:00:01.000Z",
    data.jobId, data.attemptId,
  );
  receiptDb.close();
  assert.match(run(data, join(data.root, "receipt-mismatch.json"), 1).stderr,
    /PRODUCT_FLOW_TRACE_MISMATCH:browser-receipt/u);
  const cleanReceiptDb = new DatabaseSync(data.browserDb);
  cleanReceiptDb.prepare("delete from browser_mutations where command_id='command-wrong'").run();
  cleanReceiptDb.close();

  const inputMismatchDb = new DatabaseSync(data.browserDb);
  inputMismatchDb.prepare("insert into browser_mutations values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    "command-input-wrong", data.record.payload.exact_call_identity_hash, "acceptance_action", "fresh-chat",
    "prepare_clean_gpt_chat", 1, hash("wrong-input"), hash("payload"), hash("proof"), "CONFIRMED",
    "confirmed", null, null, "2026-09-08T00:00:01.000Z", "2026-09-08T00:00:01.000Z",
    data.jobId, data.attemptId,
  );
  inputMismatchDb.close();
  assert.match(run(data, join(data.root, "input-binding-mismatch.json"), 1).stderr,
    /PRODUCT_INPUT_BINDING_MISMATCH/u);
  const cleanInputMismatchDb = new DatabaseSync(data.browserDb);
  cleanInputMismatchDb.prepare("delete from browser_mutations where command_id='command-input-wrong'").run();
  cleanInputMismatchDb.close();

  await writeFile(data.forensicsPath, `${JSON.stringify({ ...data.record, stepId: "tampered" })}\n`);
  assert.match(run(data, join(data.root, "tampered-trace.json"), 1).stderr,
    /PRODUCT_TRACE_INTEGRITY_MISMATCH/u);
  await writeFile(data.forensicsPath, `${JSON.stringify(data.record)}\n`);

  const missingReceiptRuntime = new DatabaseSync(data.runtimeDb);
  missingReceiptRuntime.prepare("update production_tasks set result_json=null where job_id=?").run(data.jobId);
  missingReceiptRuntime.close();
  const missingReceiptOutput = join(data.root, "missing-result-receipt.json");
  run(data, missingReceiptOutput);
  const missingReceipt = JSON.parse(await readFile(missingReceiptOutput, "utf8"));
  assert.equal(missingReceipt.flowStatus, "PARTIAL");
  assert.deepEqual(missingReceipt.flowGaps, ["DURABLE_RESULT_RECEIPT_MISSING"]);

  const runtime = new DatabaseSync(data.runtimeDb);
  runtime.prepare("update production_tasks set status='failed',current_reason='ACCEPTANCE_STOP',result_json=? where job_id=?")
    .run(JSON.stringify({ status: "failed" }), data.jobId);
  const failedRecord = withIntegrity({ ...data.record, payload: { ...data.record.payload,
    result_status: "failed", failure_code: "ACCEPTANCE_STOP" } });
  runtime.prepare("insert into production_attempt_failures values(?,?,?,?)").run(data.jobId, data.attemptId,
    JSON.stringify({ code: "ACCEPTANCE_STOP", child_capability_id: "prepare_clean_gpt_chat",
      evidence_hash: failedRecord.integrityHash }), "2026-09-08T00:00:02.000Z");
  runtime.close();
  await writeFile(data.forensicsPath, `${JSON.stringify(failedRecord)}\n`);
  const failedOutput = join(data.root, "failed-source.json");
  run(data, failedOutput);
  const failedSource = JSON.parse(await readFile(failedOutput, "utf8"));
  assert.equal(failedSource.flowStatus, "OBSERVED_COMPLETE_PATH");
  assert.equal(failedSource.terminalBranch, "production-failure");
  assert.equal(failedSource.terminalBranchProof.kind, "DURABLE_FAILURE_AND_TRACE_TERMINAL");
  assert.equal(failedSource.terminalBranchProof.terminalSource, "ATTEMPT_FAILURE_ROW");
  assert.equal(failedSource.terminalBranchProof.childCorrelation, "MATCHED");
  assert.equal(failedSource.terminalBranchProof.evidenceCorrelation, "MATCHED");
  assert.match(failedSource.terminalBranchProof.durableFailureReceiptHash, /^sha256:[a-f0-9]{64}$/u);
  assert.deepEqual(failedSource.flowGaps, []);

  const newerAttemptId = "44444444-4444-4444-8444-444444444444";
  const historicalRuntime = new DatabaseSync(data.runtimeDb);
  historicalRuntime.prepare(`update production_tasks set status='completed',current_attempt_id=?,current_reason=null,
    result_json=? where job_id=?`).run(newerAttemptId, JSON.stringify({ status: "completed" }), data.jobId);
  historicalRuntime.close();
  const exactHistoricalOutput = join(data.root, "exact-historical-failure.json");
  run(data, exactHistoricalOutput);
  const exactHistorical = JSON.parse(await readFile(exactHistoricalOutput, "utf8"));
  assert.equal(exactHistorical.taskStatus, "failed");
  assert.equal(exactHistorical.attemptTerminalSource, "ATTEMPT_FAILURE_ROW");
  assert.equal(exactHistorical.terminalBranch, "production-failure");

  const unavailableRuntime = new DatabaseSync(data.runtimeDb);
  unavailableRuntime.prepare("delete from production_attempt_failures where job_id=? and attempt_id=?")
    .run(data.jobId, data.attemptId);
  unavailableRuntime.close();
  const unavailableOutput = join(data.root, "historical-terminal-unavailable.json");
  run(data, unavailableOutput);
  const unavailable = JSON.parse(await readFile(unavailableOutput, "utf8"));
  assert.equal(unavailable.taskStatus, "historical-terminal-unavailable");
  assert.equal(unavailable.flowStatus, "PARTIAL");
  assert.deepEqual(unavailable.flowGaps, ["DURABLE_ATTEMPT_TERMINAL_UNAVAILABLE"]);

  const orderedContract = structuredClone(data.contract);
  orderedContract.routes[0].topology = { kind: "ordered-product-stages",
    stageOrder: ["stage-a", "stage-b"], legalTerminalBranches: ["research-declined", "article-package-complete", "production-failure"],
    terminalDecision: { path: "research.decision", declineValue: "decline", proceedValue: "proceed" } };
  await writeFile(data.contractPath, `${JSON.stringify(orderedContract)}\n`);
  installCompletion(data, { research: { decision: "proceed" } });
  const stageBCallId = "stage-b-call";
  const stageACallId = "stage-a-call";
  const stageBHash = hash(JSON.stringify([data.jobId, data.attemptId, data.pluginId, 1,
    "stage-b", stageBCallId, "prepare_clean_gpt_chat", data.record.payload.input_hash]));
  const stageAHash = hash(JSON.stringify([data.jobId, data.attemptId, data.pluginId, 1,
    "stage-a", stageACallId, "prepare_clean_gpt_chat", data.record.payload.input_hash]));
  const stageB = withIntegrity({ ...data.record, stepId: "stage-b",
    capabilityCallId: `gpt-call:${stageBHash.slice("sha256:".length)}`,
    recordRef: "rec-stage-b", payload: { ...data.record.payload,
      exact_call_identity_hash: stageBHash, product_step_id: "stage-b", call_id: stageBCallId, action_ordinal: 1,
      started_at: "2026-09-08T00:00:00.000Z", ended_at: "2026-09-08T00:00:01.000Z" } });
  const stageA = withIntegrity({ ...data.record, stepId: "stage-a",
    capabilityCallId: `gpt-call:${stageAHash.slice("sha256:".length)}`,
    recordRef: "rec-stage-a", payload: { ...data.record.payload,
      exact_call_identity_hash: stageAHash, product_step_id: "stage-a", call_id: stageACallId, action_ordinal: 2,
      started_at: "2026-09-08T00:00:02.000Z", ended_at: "2026-09-08T00:00:03.000Z" } });
  await writeFile(data.forensicsPath, `${JSON.stringify(stageB)}\n${JSON.stringify(stageA)}\n`);
  const historicalOutput = join(data.root, "historical-order.json");
  run(data, historicalOutput);
  const historical = JSON.parse(await readFile(historicalOutput, "utf8"));
  assert.equal(historical.flowStatus, "OBSERVED_COMPLETE_PATH");
  assert.equal(historical.terminalBranch, "article-package-complete");
  assert.equal(historical.flowProjectionStatus, "HISTORICAL_DRIFT");
  assert.deepEqual(historical.flowProjectionGaps,
    ["CURRENT_PRODUCT_STAGE_PROJECTION_DIFFERS_FROM_HISTORICAL_TRACE"]);

  installCompletion(data, { research: { decision: "decline" } });
  const declinedOutput = join(data.root, "explicit-decline.json");
  run(data, declinedOutput);
  const declined = JSON.parse(await readFile(declinedOutput, "utf8"));
  assert.equal(declined.flowStatus, "OBSERVED_COMPLETE_PATH");
  assert.equal(declined.terminalBranch, "research-declined");

  installCompletion(data, { research: { decision: "unknown" } });
  const branchMismatchOutput = join(data.root, "branch-mismatch.json");
  run(data, branchMismatchOutput);
  const branchMismatch = JSON.parse(await readFile(branchMismatchOutput, "utf8"));
  assert.equal(branchMismatch.flowStatus, "PARTIAL");
  assert.deepEqual(branchMismatch.flowGaps, ["DURABLE_RESULT_BRANCH_MISMATCH"]);

  await writeFile(join(data.taskRoot, data.jobId, "materials", "unexpected.bin"), "extra");
  const rejected = run(data, join(data.root, "rejected.json"), 1);
  assert.match(rejected.stderr, /PRODUCT_INPUT_INCOMPLETE/u);

  const toolSource = await readFile(TOOL, "utf8");
  assert.doesNotMatch(toolSource, /chrome:control-chrome|playwright|\.click\(|\.fill\(|setInputFiles/u);
  process.stdout.write("gpt-production-source-acceptance-ok\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
