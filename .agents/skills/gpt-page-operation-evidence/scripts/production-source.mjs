#!/usr/bin/env node

import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { readdir, readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { pageInputBindingValid } from "./page-input-binding.mjs";

const SCHEMA = "gpt-page-operation-production-source.v1";
const PROJECTION_SCHEMA = "gpt-page-operation-product-projection.v1";
const HASH = /^sha256:[a-f0-9]{64}$/u;
const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/u;

function fail(code, detail = "") {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (!token.startsWith("--") || !value || value.startsWith("--")) fail("ARGUMENT_INVALID", token);
    args[token.slice(2)] = value;
    index += 1;
  }
  return args;
}

function required(args, key) {
  if (typeof args[key] !== "string" || args[key].length === 0) fail("ARGUMENT_REQUIRED", `--${key}`);
  return args[key];
}

const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;

const hash = (value) => `sha256:${createHash("sha256").update(
  Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8"),
).digest("hex")}`;

const exactStringList = (value) => Array.isArray(value) && value.every((entry) =>
  typeof entry === "string" && entry.length > 0) && new Set(value).size === value.length;

function validRouteContract(route) {
  if (!route || typeof route !== "object" || typeof route.productId !== "string" || route.productId.length === 0
    || typeof route.actionId !== "string" || route.actionId.length === 0
    || route.materialPolicy?.kind !== "exact-task-material-set"
    || !exactStringList(route.materialPolicy?.requiredRoles)) return false;
  const topology = route.topology ?? {};
  if (topology.legalStageCallSequences !== undefined || topology.legalCallSequencesByStage !== undefined
    || topology.allowedFailureCleanupCalls !== undefined || topology.callSequenceTemplate !== undefined) return false;
  if (topology.kind === "single-task-action-stage") return true;
  if (topology.kind === "ordered-product-stages") return exactStringList(topology.stageOrder)
    && exactStringList(topology.legalTerminalBranches)
    && typeof topology.terminalDecision?.path === "string" && topology.terminalDecision.path.length > 0
    && typeof topology.terminalDecision?.declineValue === "string" && topology.terminalDecision.declineValue.length > 0
    && typeof topology.terminalDecision?.proceedValue === "string" && topology.terminalDecision.proceedValue.length > 0
    && topology.terminalDecision.declineValue !== topology.terminalDecision.proceedValue;
  return topology.kind === "material-declared-cohort-triplet"
    && typeof topology.cohortArrayField === "string" && topology.cohortArrayField.length > 0
    && typeof topology.cohortIdField === "string" && topology.cohortIdField.length > 0
    && exactStringList(topology.passOrder);
}

async function json(path, code = "JSON_READ_FAILED") {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { fail(code, `${path}:${error instanceof Error ? error.message : String(error)}`); }
}

async function projectionForTask(repo, task) {
  const root = join(repo,
    ".agents/skills/gpt-page-operation-evidence/references/product-flow-projections");
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); }
  catch { fail("PRODUCT_FLOW_CONTRACT_INVALID", "projection-directory"); }
  const matches = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const path = join(root, entry.name);
    const contract = await json(path, "PRODUCT_FLOW_CONTRACT_INVALID");
    const route = contract?.routes?.find((candidate) => candidate?.productId === task.product_id
      && candidate?.actionId === task.action_id);
    if (route) matches.push({ path, contract, route });
  }
  if (matches.length !== 1) fail("PRODUCT_FLOW_CONTRACT_ROUTE_MISSING",
    `${task.product_id}/${task.action_id}`);
  const [{ path, contract, route }] = matches;
  if (contract.schemaVersion !== PROJECTION_SCHEMA || contract.owner !== "gpt-page-operation-evidence"
    || typeof contract.sourcePluginId !== "string" || !SAFE_SEGMENT.test(contract.sourcePluginId)
    || !Number.isSafeInteger(contract.sourcePluginVersion)
    || contract.traceAuthority?.kind !== "durable-product-forensics"
    || contract.traceAuthority?.sequenceOwner !== "accepted-production-attempt"
    || contract.traceAuthority?.currentFlowSourcesRole !== "projection-only"
    || !exactStringList(contract.flowOwnerSources)
    || contract.callSequenceTemplates !== undefined || !validRouteContract(route)) {
    fail("PRODUCT_FLOW_CONTRACT_INVALID", `${task.product_id}/${task.action_id}`);
  }
  return { path, contract, route };
}

async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

async function exactMaterialSet(task, materialRoot, route) {
  if (!Array.isArray(task.material_refs)) fail("PRODUCT_INPUT_INCOMPLETE", "task.material_refs");
  const refs = [...task.material_refs].sort((left, right) => left.ordinal - right.ordinal);
  const ordinals = refs.map((entry) => entry.ordinal);
  if (new Set(ordinals).size !== ordinals.length || ordinals.some((value, index) => value !== index)) {
    fail("PRODUCT_INPUT_INCOMPLETE", "material-ordinals");
  }
  const expectedNames = refs.map((entry) => entry.display_name).sort();
  const entries = await readdir(materialRoot, { withFileTypes: true });
  if (entries.some((entry) => !entry.isFile())) fail("PRODUCT_INPUT_INCOMPLETE", "material-directory-not-flat");
  const actualNames = entries.map((entry) => entry.name).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    fail("PRODUCT_INPUT_INCOMPLETE", `files=${actualNames.join(",")};expected=${expectedNames.join(",")}`);
  }
  const requiredRoles = route.materialPolicy?.requiredRoles ?? [];
  const actualRoles = refs.map((entry) => entry.role);
  for (const role of requiredRoles) if (!actualRoles.includes(role)) fail("PRODUCT_INPUT_INCOMPLETE", `role=${role}`);
  const materials = [];
  for (const ref of refs) {
    if (!Number.isSafeInteger(ref.bytes) || ref.bytes < 0 || !HASH.test(ref.sha256 ?? "")
      || typeof ref.display_name !== "string" || basename(ref.display_name) !== ref.display_name) {
      fail("PRODUCT_INPUT_INCOMPLETE", `descriptor=${String(ref.material_id ?? ref.ordinal)}`);
    }
    const path = join(materialRoot, ref.display_name);
    const bytes = await readFile(path);
    if (bytes.byteLength !== ref.bytes || hash(bytes) !== ref.sha256) {
      fail("PRODUCT_MATERIAL_BYTE_MISMATCH", ref.display_name);
    }
    materials.push(stable({
      materialIdHash: hash(ref.material_id), ordinal: ref.ordinal, role: ref.role,
      displayName: ref.display_name, bytes: ref.bytes, sha256: ref.sha256,
      mediaType: ref.media_type, storageClass: ref.storage_class,
    }));
  }
  return materials;
}

async function flowBinding(repo, contract, traceChildren) {
  const paths = new Set(contract.flowOwnerSources ?? []);
  paths.add("src/capabilities/gpt/contract.ts");
  for (const child of traceChildren) {
    if (!SAFE_SEGMENT.test(child)) fail("PRODUCT_FLOW_SOURCE_MISSING", child);
    const root = join(repo, "src/capabilities/gpt/children", child);
    try {
      for (const entry of await readdir(root, { withFileTypes: true })) {
        if (entry.isFile() && /\.(?:ts|tsx)$/u.test(entry.name)) paths.add(relative(repo, join(root, entry.name)).split(sep).join("/"));
      }
    } catch { fail("PRODUCT_FLOW_SOURCE_MISSING", child); }
  }
  const files = [];
  const repoRoot = `${resolve(repo)}${sep}`;
  for (const path of [...paths].sort()) {
    const absolute = resolve(repo, path);
    if (!absolute.startsWith(repoRoot)) fail("PRODUCT_FLOW_SOURCE_OUT_OF_SCOPE", path);
    let content;
    try { content = await readFile(absolute); } catch { fail("PRODUCT_FLOW_SOURCE_MISSING", path); }
    files.push({ path, sha256: hash(content) });
  }
  return stable({ files, digest: hash(JSON.stringify(stable(files))) });
}

function expectedStages(route, materialJson) {
  const topology = route.topology ?? {};
  if (topology.kind === "single-task-action-stage") return [route.actionId];
  if (topology.kind === "ordered-product-stages") {
    if (!Array.isArray(topology.stageOrder) || topology.stageOrder.length === 0) {
      fail("PRODUCT_FLOW_CONTRACT_INVALID", "stageOrder");
    }
    return topology.stageOrder;
  }
  if (topology.kind === "material-declared-cohort-triplet") {
    const cohorts = materialJson?.[topology.cohortArrayField];
    if (!Array.isArray(cohorts) || cohorts.length === 0) fail("PRODUCT_INPUT_INCOMPLETE", topology.cohortArrayField);
    const cohortIds = cohorts.map((cohort) => cohort?.[topology.cohortIdField]);
    if (cohortIds.some((id) => typeof id !== "string" || id.length === 0)
      || new Set(cohortIds).size !== cohortIds.length) fail("PRODUCT_INPUT_INCOMPLETE", "cohort-identities");
    if (!Array.isArray(topology.passOrder) || topology.passOrder.length === 0) {
      fail("PRODUCT_FLOW_CONTRACT_INVALID", "passOrder");
    }
    return cohorts.flatMap((cohort) => topology.passOrder.map((pass) => `${cohort[topology.cohortIdField]}:${pass}`));
  }
  fail("PRODUCT_FLOW_CONTRACT_INVALID", `topology=${String(topology.kind)}`);
}

function valueAtPath(value, path) {
  return path.split(".").reduce((current, key) => current?.[key], value);
}

export function topologyAssessment(route, trace, materialJson, taskStatus, completionReceiptProof,
  failureReceiptProof, durableResult) {
  const observedStages = trace.map((entry) => entry.productStepId)
    .filter((stage, index, stages) => index === 0 || stage !== stages[index - 1]);
  const topology = route.topology ?? {};
  const expected = expectedStages(route, materialJson);
  const matchesPrefix = JSON.stringify(observedStages) === JSON.stringify(expected.slice(0, observedStages.length));
  const flowProjectionStatus = matchesPrefix
    ? observedStages.length === expected.length ? "MATCHED_COMPLETE" : "MATCHED_PREFIX"
    : "HISTORICAL_DRIFT";
  const flowProjectionGaps = matchesPrefix
    ? expected.slice(observedStages.length).map((stage) => `UNOBSERVED_CURRENT_PRODUCT_STAGE:${stage}`)
    : ["CURRENT_PRODUCT_STAGE_PROJECTION_DIFFERS_FROM_HISTORICAL_TRACE"];
  const lastFailureIndex = trace.findLastIndex((entry) => entry.resultStatus === "failed");
  const common = { expectedStageCount: expected.length, observedStageCount: observedStages.length,
    flowProjectionStatus, flowProjectionGaps };
  if (taskStatus === "failed") {
    return lastFailureIndex >= 0 && failureReceiptProof ? { ...common, status: "OBSERVED_COMPLETE_PATH",
      terminalBranch: "production-failure", gaps: [], terminalBranchProof: {
        kind: "DURABLE_FAILURE_AND_TRACE_TERMINAL", failedTraceEntryId: trace[lastFailureIndex].traceEntryId,
        ...failureReceiptProof,
      } } : { ...common, status: "PARTIAL", terminalBranch: null,
      gaps: [lastFailureIndex < 0 ? "TERMINAL_OUTCOME_TRACE_MISSING" : "DURABLE_FAILURE_RECEIPT_MISSING"],
      terminalBranchProof: null };
  }
  if (taskStatus === "historical-terminal-unavailable") return { ...common, status: "PARTIAL", terminalBranch: null,
    gaps: ["DURABLE_ATTEMPT_TERMINAL_UNAVAILABLE"], terminalBranchProof: null };
  if (taskStatus !== "completed") return { ...common, status: "PARTIAL", terminalBranch: null,
    gaps: [`DURABLE_TASK_NOT_TERMINAL:${taskStatus}`], terminalBranchProof: null };
  if (!completionReceiptProof) return { ...common, status: "PARTIAL", terminalBranch: null,
    gaps: ["DURABLE_RESULT_RECEIPT_MISSING"], terminalBranchProof: null };
  let terminalBranch = "durable-task-complete";
  if (topology.kind === "single-task-action-stage") {
    if (matchesPrefix && observedStages.length < expected.length) return { ...common, status: "PARTIAL",
      terminalBranch: null, gaps: ["TRACE_STAGE_INCOMPLETE"], terminalBranchProof: null };
    terminalBranch = "task-action-complete";
  }
  if (topology.kind === "ordered-product-stages") {
    const decision = valueAtPath(durableResult, topology.terminalDecision.path);
    if (decision === topology.terminalDecision.declineValue
      && topology.legalTerminalBranches.includes("research-declined")) {
      if (matchesPrefix && observedStages.length !== 1) return { ...common, status: "PARTIAL",
        terminalBranch: null, gaps: [observedStages.length === 0
          ? "TRACE_STAGE_INCOMPLETE" : "TRACE_STAGE_BRANCH_MISMATCH"], terminalBranchProof: null };
      terminalBranch = "research-declined";
    }
    else if (decision === topology.terminalDecision.proceedValue
      && topology.legalTerminalBranches.includes("article-package-complete")) {
      if (matchesPrefix && observedStages.length < expected.length) return { ...common, status: "PARTIAL",
        terminalBranch: null, gaps: ["TRACE_STAGE_INCOMPLETE"], terminalBranchProof: null };
      terminalBranch = "article-package-complete";
    }
    else return { ...common, status: "PARTIAL", terminalBranch: null,
      gaps: ["DURABLE_RESULT_BRANCH_MISMATCH"], terminalBranchProof: null };
  }
  if (topology.kind === "material-declared-cohort-triplet") {
    if (matchesPrefix && observedStages.length < expected.length) return { ...common, status: "PARTIAL",
      terminalBranch: null, gaps: ["TRACE_STAGE_INCOMPLETE"], terminalBranchProof: null };
    if (matchesPrefix && observedStages.length === expected.length) terminalBranch = "locale-catalog-complete";
  }
  return { ...common, status: "OBSERVED_COMPLETE_PATH", terminalBranch, gaps: [],
    terminalBranchProof: { kind: "DURABLE_COMPLETION_RECEIPT", ...completionReceiptProof } };
}

function parsedJson(value, code) {
  if (typeof value !== "string" || value.length === 0) return null;
  try { return JSON.parse(value); } catch { fail(code); }
}

function failureTraceEvidenceHashes(traceEntry) {
  return new Set([
    traceEntry.evidenceHash,
    traceEntry.sourceEvidenceHash,
    traceEntry.failureBrowserEvidenceHash,
    ...(traceEntry.browserReceipts ?? []).flatMap((receipt) => [receipt.request_hash, receipt.payload_hash, receipt.proof_hash]),
  ].filter((value) => HASH.test(value ?? "")));
}

function validatedDurableResult(row, task, identity, outboxRows) {
  const envelope = parsedJson(row.result_json, "PRODUCT_RESULT_RECEIPT_INVALID");
  const receipt = envelope?.result_object_receipt;
  if (!envelope || envelope.schema_version !== "website-agent-result.v1"
    || envelope.job_id !== row.job_id || envelope.source_task_id !== task.source_task_id
    || envelope.product_id !== task.product_id || envelope.action_id !== task.action_id
    || envelope.plugin_id !== identity.plugin_id || envelope.plugin_version !== identity.plugin_version
    || envelope.result_contract_id !== task.result_contract_id
    || envelope.result_contract_version !== task.result_contract_version
    || typeof envelope.result_payload_ref !== "string" || envelope.result_payload_ref.length === 0
    || !HASH.test(envelope.result_payload_hash ?? "")
    || !Number.isSafeInteger(envelope.result_payload_bytes) || envelope.result_payload_bytes < 1
    || envelope.result_payload_media_type !== "application/json"
    || !receipt || receipt.object_ref !== envelope.result_payload_ref
    || receipt.sha256 !== envelope.result_payload_hash || receipt.bytes !== envelope.result_payload_bytes
    || receipt.media_type !== envelope.result_payload_media_type || !HASH.test(receipt.receipt_hash ?? "")
    || !HASH.test(envelope.execution_receipt_hash ?? "") || !Array.isArray(envelope.evidence_refs)
    || outboxRows.length !== 1) fail("PRODUCT_RESULT_RECEIPT_INVALID");
  const outbox = outboxRows[0];
  const response = parsedJson(outbox.response_json, "PRODUCT_RESULT_OUTBOX_INVALID");
  const headers = parsedJson(outbox.headers_json, "PRODUCT_RESULT_OUTBOX_INVALID");
  const payloadBytes = outbox.body_blob instanceof Uint8Array ? Buffer.from(outbox.body_blob) : null;
  if (outbox.kind !== "artifact" || outbox.method !== "PUT" || !payloadBytes
    || !outbox.path.includes(`/jobs/${encodeURIComponent(row.job_id)}/artifacts/result_payload/`)
    || !Number.isFinite(Date.parse(outbox.sent_at))
    || outbox.response_hash !== hash(JSON.stringify(stable(response)))
    || outbox.receipt_hash !== response?.receipt_hash
    || response?.role !== "result_payload" || response?.object_ref !== envelope.result_payload_ref
    || response?.sha256 !== envelope.result_payload_hash || response?.byte_length !== envelope.result_payload_bytes
    || response?.media_type !== envelope.result_payload_media_type || response?.receipt_hash !== receipt.receipt_hash
    || headers?.["x-ai-content-sha256"] !== envelope.result_payload_hash
    || headers?.["x-ai-content-bytes"] !== String(envelope.result_payload_bytes)
    || headers?.["content-type"] !== "application/json"
    || payloadBytes.byteLength !== envelope.result_payload_bytes
    || hash(payloadBytes) !== envelope.result_payload_hash) fail("PRODUCT_RESULT_OUTBOX_INVALID");
  const payload = parsedJson(payloadBytes.toString("utf8"), "PRODUCT_RESULT_PAYLOAD_INVALID");
  return {
    payload,
    proof: stable({
      receiptHash: hash(row.result_json),
      resultPayloadHash: envelope.result_payload_hash,
      resultObjectReceiptHash: receipt.receipt_hash,
      resultPayloadOutboxHash: hash(JSON.stringify(stable({
        idempotencyKeyHash: hash(outbox.idempotency_key), responseHash: outbox.response_hash,
        receiptHash: outbox.receipt_hash, sentAt: outbox.sent_at,
      }))),
    }),
  };
}

function durableAttemptTerminal(row, task, identity, attemptId, failureRow, resultPayloadRows, trace) {
  const isCurrentAttempt = attemptId === row.current_attempt_id;
  const lastFailure = trace.findLast((entry) => entry.resultStatus === "failed") ?? null;
  if (failureRow) {
    const failure = parsedJson(failureRow.failure_json, "PRODUCT_FAILURE_RECEIPT_INVALID");
    if (!failure || typeof failure.code !== "string" || failure.code.length === 0
      || !Number.isFinite(Date.parse(failureRow.created_at))) fail("PRODUCT_FAILURE_RECEIPT_INVALID");
    if (lastFailure && (!Number.isFinite(Date.parse(lastFailure.endedAt))
      || Date.parse(failureRow.created_at) < Date.parse(lastFailure.endedAt))) {
      fail("PRODUCT_FAILURE_RECEIPT_TRACE_MISMATCH", "terminal-time");
    }
    const childCorrelation = failure.child_capability_id == null ? "NOT_DECLARED"
      : lastFailure === null ? "TRACE_UNAVAILABLE"
        : lastFailure.childId === failure.child_capability_id ? "MATCHED" : "MISMATCH";
    const evidenceCorrelation = failure.evidence_hash == null ? "NOT_DECLARED"
      : lastFailure === null ? "TRACE_UNAVAILABLE"
        : failureTraceEvidenceHashes(lastFailure).has(failure.evidence_hash) ? "MATCHED" : "MISMATCH";
    if (childCorrelation === "MISMATCH" || evidenceCorrelation === "MISMATCH") {
      fail("PRODUCT_FAILURE_RECEIPT_TRACE_MISMATCH", `${childCorrelation}/${evidenceCorrelation}`);
    }
    return {
      status: "failed",
      reason: failure.code,
      durableResult: null,
      completionReceiptProof: null,
      source: "CURRENT_TASK_ATTEMPT_FAILURE",
      failureReceiptProof: stable({
        terminalSource: "CURRENT_TASK_ATTEMPT_FAILURE",
        durableFailureReceiptHash: hash(JSON.stringify(stable({
          jobId: row.job_id, attemptId, failureJson: failureRow.failure_json, createdAt: failureRow.created_at,
        }))),
        durableFailureCodeHash: hash(failure.code),
        traceFailureCodeHash: lastFailure?.failureCode ? hash(lastFailure.failureCode) : null,
        codeRelation: failure.code === lastFailure?.failureCode ? "EXACT" : "PRODUCT_FAILURE_WRAPS_TRACE_FAILURE",
        childCorrelation,
        evidenceCorrelation,
      }),
    };
  }
  if (!isCurrentAttempt) return { status: "historical-terminal-unavailable", reason: null,
    durableResult: null, completionReceiptProof: null, failureReceiptProof: null, source: "NONE" };
  const completedResult = row.status === "completed" && typeof row.result_json === "string" && row.result_json.length > 0
    ? validatedDurableResult(row, task, identity, resultPayloadRows) : null;
  if (row.status === "completed") return { status: "completed", reason: row.current_reason,
    durableResult: completedResult?.payload ?? null, completionReceiptProof: completedResult?.proof ?? null,
    failureReceiptProof: null, source: "CURRENT_TASK_ROW" };
  if (row.status === "failed") return { status: "failed", reason: row.current_reason,
    durableResult: null, completionReceiptProof: null, source: "CURRENT_TASK_ROW",
    failureReceiptProof: stable({
      terminalSource: "CURRENT_TASK_ROW",
      durableFailureReceiptHash: hash(JSON.stringify(stable({ jobId: row.job_id, attemptId,
        status: row.status, currentReason: row.current_reason, resultJson: row.result_json, updatedAt: row.updated_at }))),
      durableFailureCodeHash: typeof row.current_reason === "string" ? hash(row.current_reason) : null,
      traceFailureCodeHash: lastFailure?.failureCode ? hash(lastFailure.failureCode) : null,
      codeRelation: row.current_reason === lastFailure?.failureCode ? "EXACT" : "PRODUCT_FAILURE_WRAPS_TRACE_FAILURE",
      childCorrelation: "NOT_DECLARED",
      evidenceCorrelation: "NOT_DECLARED",
    }) };
  return { status: row.status, reason: row.current_reason, durableResult: null,
    completionReceiptProof: null, failureReceiptProof: null, source: "CURRENT_TASK_ROW" };
}

function browserReceipts(databasePath, jobId, attemptId) {
  let database;
  try {
    database = new DatabaseSync(databasePath, { readOnly: true });
    return database.prepare(`select command_id,exact_call_identity_hash,product_step_id,call_id,
      child_capability_id,action_ordinal,request_hash,payload_hash,proof_hash,state,mutation_outcome,
      reason,native_cause_code,terminal_at,updated_at from browser_mutations
      where job_id=? and attempt_id=? order by updated_at,command_id`).all(jobId, attemptId).map(stable);
  } catch (error) {
    fail("BROWSER_RECEIPT_READ_FAILED", error instanceof Error ? error.message : String(error));
  } finally { database?.close(); }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repo = resolve(required(args, "repo"));
  const runtimeDb = resolve(required(args, "runtime-db"));
  const taskRoot = resolve(required(args, "task-root"));
  const browserDb = resolve(required(args, "browser-db"));
  const jobId = required(args, "job-id");
  const requestedAttemptId = args["attempt-id"];
  if (!SAFE_SEGMENT.test(jobId) || (requestedAttemptId && !SAFE_SEGMENT.test(requestedAttemptId))) {
    fail("PRODUCT_TASK_IDENTITY_MISMATCH", "unsafe-segment");
  }
  const database = new DatabaseSync(runtimeDb, { readOnly: true });
  const row = database.prepare(`select job_id,request_hash,task_json,status,current_attempt_id,
    current_reason,result_json,attempt_failure_json,created_at,updated_at
    from production_tasks where job_id=?`).get(jobId);
  const attemptId = requestedAttemptId ?? row?.current_attempt_id;
  const failureRow = row && attemptId === row.current_attempt_id && row.attempt_failure_json
    ? { failure_json: row.attempt_failure_json, created_at: row.updated_at } : null;
  const currentResultEnvelope = row && attemptId === row.current_attempt_id && row.status === "completed"
    ? parsedJson(row.result_json, "PRODUCT_RESULT_RECEIPT_INVALID") : null;
  const resultPayloadRows = currentResultEnvelope?.result_payload_ref
    ? database.prepare(`select idempotency_key,kind,path,method,headers_json,body_blob,response_json,
      response_hash,receipt_hash,sent_at from production_outbox
      where kind='artifact' and response_json is not null
        and json_extract(response_json,'$.object_ref')=?`).all(currentResultEnvelope.result_payload_ref)
    : [];
  database.close();
  if (!row) fail("PRODUCT_TASK_NOT_FOUND", jobId);
  let task;
  try { task = JSON.parse(row.task_json); }
  catch { fail("PRODUCT_TASK_ENVELOPE_INVALID", jobId); }
  if (task.job_id !== row.job_id || task.request_hash !== row.request_hash) {
    fail("PRODUCT_TASK_IDENTITY_MISMATCH", jobId);
  }
  const { path: contractPath, contract, route } = await projectionForTask(repo, task);
  const identity = Object.freeze({
    plugin_id: contract.sourcePluginId,
    plugin_version: contract.sourcePluginVersion,
    request_hash: row.request_hash,
  });
  const materialRoot = join(taskRoot, jobId, "materials");
  const materials = await exactMaterialSet(task, materialRoot, route);
  // The governed runtime retains artifacts, not a per-child record ledger.  A source manifest may
  // therefore bind durable task/material/terminal facts while honestly reporting no call trace.
  const trace = [];
  const receipts = browserReceipts(browserDb, jobId, attemptId);
  const receiptByCall = Object.groupBy(receipts, (receipt) => receipt.exact_call_identity_hash);
  const actualTrace = trace.map((entry) => {
    const boundReceipts = receiptByCall[entry.exactCallIdentityHash] ?? [];
    if (boundReceipts.some((receipt) => receipt.product_step_id !== entry.productStepId
      || receipt.child_capability_id !== entry.childId
      || receipt.action_ordinal !== entry.actionOrdinal)) {
      fail("PRODUCT_FLOW_TRACE_MISMATCH", `browser-receipt=${entry.traceEntryId}`);
    }
    const callIds = [...new Set(boundReceipts.map((receipt) => receipt.call_id)
      .filter((callId) => typeof callId === "string" && callId.length > 0))];
    if (boundReceipts.length > 0 && callIds.length !== 1) {
      fail("PRODUCT_FLOW_TRACE_MISMATCH", `browser-receipt-call=${entry.traceEntryId}`);
    }
    const callId = callIds[0] ?? null;
    const receiptInputHashes = [...new Set(boundReceipts.map((receipt) => receipt.request_hash))];
    if (receiptInputHashes.some((value) => !HASH.test(value ?? "")) || receiptInputHashes.length > 1
      || (entry.forensicsInputHash && receiptInputHashes.length === 1
        && entry.forensicsInputHash !== receiptInputHashes[0])) {
      fail("PRODUCT_INPUT_BINDING_MISMATCH", entry.traceEntryId);
    }
    if (callId && receiptInputHashes[0]
      && hash(JSON.stringify([jobId, attemptId, identity.plugin_id, identity.plugin_version,
        entry.productStepId, callId, entry.childId, receiptInputHashes[0]])) !== entry.exactCallIdentityHash) {
      fail("PRODUCT_INPUT_BINDING_MISMATCH", entry.traceEntryId);
    }
    const inputHash = entry.forensicsInputHash ?? receiptInputHashes[0] ?? null;
    const roleHashes = entry.forensicsPageInputRoleHashes ?? {
      promptHash: null, responseHash: null, attachmentLabelHashes: null, attachmentSetHash: null,
      modelDisplayNameHash: null, reasoningRequirement: null, conversationUrlHash: null,
      turnMarkerHash: null, assistantTurnIdHash: null,
    };
    const inputBinding = stable({
      schemaVersion: "gpt-page-input-binding.v1",
      source: entry.forensicsInputHash ? "FORENSICS_SAFE_PROJECTION"
        : inputHash ? "BROWSER_MUTATION_RECEIPT_ONLY" : "UNAVAILABLE",
      inputHash,
      roleHashes,
    });
    if (!pageInputBindingValid(inputBinding)) fail("PRODUCT_INPUT_BINDING_INVALID", entry.traceEntryId);
    const { forensicsInputHash: _inputHash, forensicsCallId: _forensicsCallId,
      forensicsPageInputRoleHashes: _roles, ...publicEntry } = entry;
    return stable({ ...publicEntry, callId, inputBinding, browserReceipts: boundReceipts });
  });
  if (new Set(actualTrace.map((entry) => entry.traceEntryId)).size !== actualTrace.length) {
    fail("PRODUCT_FLOW_TRACE_MISMATCH", "duplicate-trace-entry");
  }
  const topologyMaterialRefs = route.topology?.kind === "material-declared-cohort-triplet"
    ? task.material_refs.filter((entry) => entry.role === "static_catalog_input") : [];
  if (route.topology?.kind === "material-declared-cohort-triplet" && topologyMaterialRefs.length !== 1) {
    fail("PRODUCT_INPUT_INCOMPLETE", "static_catalog_input");
  }
  const materialJson = route.topology?.kind === "material-declared-cohort-triplet"
    ? JSON.parse(await readFile(join(materialRoot, topologyMaterialRefs[0].display_name), "utf8")) : null;
  const terminal = durableAttemptTerminal(row, task, identity, attemptId, failureRow, resultPayloadRows, actualTrace);
  const flow = topologyAssessment(route, actualTrace, materialJson, terminal.status,
    terminal.completionReceiptProof, terminal.failureReceiptProof, terminal.durableResult);
  const contractBytes = await readFile(contractPath);
  const binding = await flowBinding(repo, contract, [...new Set(actualTrace.map((entry) => entry.childId))]);
  const taskBinding = stable({ jobId: row.job_id, requestHash: row.request_hash,
    taskEnvelopeHash: hash(row.task_json), businessContextHash: task.business_context_hash,
    productId: task.product_id, actionId: task.action_id, parametersHash: hash(JSON.stringify(stable(task.parameters))),
    resultContractId: task.result_contract_id, resultContractVersion: task.result_contract_version });
  const sourceSnapshotId = hash(JSON.stringify(stable({ taskBinding, materials })));
  const output = stable({
    schemaVersion: SCHEMA,
    sourceKind: "PRODUCTION_RUNTIME_DURABLE_TASK",
    synthetic: false,
    jobId: row.job_id,
    attemptId,
    productId: task.product_id,
    actionId: task.action_id,
    pluginId: identity.plugin_id,
    pluginVersion: identity.plugin_version,
    taskStatus: terminal.status,
    taskReason: terminal.reason,
    attemptTerminalSource: terminal.source,
    sourceSnapshotId,
    taskBinding,
    materials,
    materialSetHash: hash(JSON.stringify(stable(materials))),
    pageEvidenceContract: { path: relative(repo, contractPath).split(sep).join("/"), sha256: hash(contractBytes) },
    flowContractBinding: binding,
    flowContractDigest: hash(JSON.stringify(stable({ contract: hash(contractBytes), binding: binding.digest }))),
    flowStatus: flow.status,
    flowProjectionStatus: flow.flowProjectionStatus,
    flowProjectionGaps: flow.flowProjectionGaps,
    terminalBranch: flow.terminalBranch,
    terminalBranchProof: flow.terminalBranchProof,
    flowGaps: flow.gaps,
    expectedStageCount: flow.expectedStageCount ?? null,
    observedStageCount: flow.observedStageCount ?? [...new Set(actualTrace.map((entry) => entry.productStepId))].length,
    actualTrace,
    traceDigest: hash(JSON.stringify(actualTrace)),
    reportInputs: {
      "production-task-envelope": { kind: "HASH_ONLY", sha256: taskBinding.taskEnvelopeHash },
      "production-material-set": { kind: "EXACT_PRODUCTION_MATERIAL_SET", sha256: hash(JSON.stringify(stable(materials))), count: materials.length },
      "production-product-flow-trace": { kind: "ACTUAL_PRODUCT_TRACE", sha256: hash(JSON.stringify(actualTrace)), count: actualTrace.length },
      "production-prompt-contract": { kind: "PRODUCT_FLOW_SOURCE_BINDING", sha256: binding.digest },
      "production-continuation-trace": { kind: "ACTUAL_PRODUCT_TRACE_SUBSET", sha256: hash(JSON.stringify(actualTrace.filter((entry) => /continuation|focus|checkpoint/u.test(entry.childId)))), count: actualTrace.filter((entry) => /continuation|focus|checkpoint/u.test(entry.childId)).length },
      "production-image-contract": { kind: "PRODUCT_FLOW_SOURCE_BINDING", sha256: binding.digest }
    }
  });
  if (args.output) await atomicJson(resolve(args.output), output);
  process.stdout.write(`${JSON.stringify(args.output ? {
    status: "PRODUCTION_SOURCE_VERIFIED", output: resolve(args.output), productId: output.productId,
    actionId: output.actionId, sourceSnapshotId, flowStatus: output.flowStatus,
    terminalBranch: output.terminalBranch, flowGaps: output.flowGaps,
  } : output)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
