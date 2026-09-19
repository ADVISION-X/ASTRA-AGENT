#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const TOOL = resolve(new URL("./production-source.mjs", import.meta.url).pathname);
const hash = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "gpt-production-source-acceptance-"));
  const repo = join(root, "repo");
  const runtimeDb = join(root, "production-runtime.sqlite");
  const browserDb = join(root, "browser-mutations.sqlite");
  const taskRoot = join(root, "tasks");
  const jobId = "aiprod_acceptance";
  const attemptId = "22222222-2222-4222-8222-222222222222";
  const materialName = "production-input.bin";
  const material = Buffer.from("test-only-byte-exact-material", "utf8");
  const requestHash = hash("request");
  await mkdir(join(repo, ".agents/skills/gpt-page-operation-evidence/references/product-flow-projections"), { recursive: true });
  await mkdir(join(repo, "src/plugins/acceptance-plugin"), { recursive: true });
  await mkdir(join(repo, "src/capabilities/gpt/children"), { recursive: true });
  await mkdir(join(taskRoot, jobId, "materials"), { recursive: true });
  await writeFile(join(repo, "src/plugins/acceptance-plugin/SKILL.md"), "production owner\n");
  await writeFile(join(repo, "src/plugins/acceptance-plugin/index.ts"), "export const flow = true;\n");
  await writeFile(join(repo, "src/capabilities/gpt/contract.ts"), "export const contract = true;\n");
  await writeFile(join(repo, ".agents/skills/gpt-page-operation-evidence/references/product-flow-projections/acceptance-plugin.json"),
    `${JSON.stringify({ schemaVersion: "gpt-page-operation-product-projection.v1", owner: "gpt-page-operation-evidence",
      sourcePluginId: "acceptance-plugin", sourcePluginVersion: 1,
      traceAuthority: { kind: "durable-product-forensics", sequenceOwner: "accepted-production-attempt",
        currentFlowSourcesRole: "projection-only" },
      flowOwnerSources: ["src/plugins/acceptance-plugin/SKILL.md", "src/plugins/acceptance-plugin/index.ts"],
      routes: [{ productId: "acceptance_product", actionId: "acceptance_action",
        materialPolicy: { kind: "exact-task-material-set", requiredRoles: ["source"] },
        topology: { kind: "single-task-action-stage" } }] })}\n`);
  await writeFile(join(taskRoot, jobId, "materials", materialName), material);
  const task = { job_id: jobId, source_task_id: "source-acceptance", request_hash: requestHash,
    product_id: "acceptance_product", action_id: "acceptance_action", business_context_hash: hash("context"),
    parameters: { locale: "zh-CN" }, result_contract_id: "website-agent-result", result_contract_version: 1,
    material_refs: [{ material_id: "material-1", ordinal: 0, role: "source", display_name: materialName,
      sha256: hash(material), bytes: material.byteLength, media_type: "application/octet-stream", storage_class: "task_scoped" }] };
  const runtime = new DatabaseSync(runtimeDb);
  runtime.exec(`create table production_tasks(job_id text primary key,request_hash text,task_json text,
    status text,current_attempt_id text,current_reason text,result_json text,attempt_failure_json text,
    created_at text,updated_at text);
    create table production_outbox(idempotency_key text primary key,kind text,path text,method text,
    headers_json text,body_blob blob,created_at text,sent_at text,last_error text,response_json text,
    response_hash text,receipt_hash text,next_delivery_at text);`);
  runtime.prepare("insert into production_tasks values(?,?,?,?,?,?,?,?,?,?)").run(jobId, requestHash,
    JSON.stringify(task), "failed", attemptId, "GPT_ATTACHMENT_SET_MISMATCH", null,
    JSON.stringify({ code: "GPT_ATTACHMENT_SET_MISMATCH", child_capability_id: "reconcile_gpt_attachment_set" }),
    "2026-09-08T00:00:00.000Z", "2026-09-08T00:00:01.000Z");
  runtime.close();
  const browser = new DatabaseSync(browserDb);
  browser.exec(`create table browser_mutations(command_id text,exact_call_identity_hash text,product_step_id text,
    call_id text,child_capability_id text,action_ordinal integer,request_hash text,payload_hash text,proof_hash text,
    state text,mutation_outcome text,reason text,native_cause_code text,terminal_at text,updated_at text,
    job_id text,attempt_id text)`);
  browser.close();
  return { root, repo, runtimeDb, browserDb, taskRoot, jobId, attemptId, materialName };
}

function run(data, output, expected = 0) {
  const result = spawnSync(process.execPath, [TOOL, "--repo", data.repo, "--runtime-db", data.runtimeDb,
    "--task-root", data.taskRoot, "--browser-db", data.browserDb, "--job-id", data.jobId,
    "--attempt-id", data.attemptId, "--output", output], { encoding: "utf8" });
  assert.equal(result.status, expected, result.stderr || result.stdout);
  return result;
}

async function main() {
  const data = await fixture();
  const output = join(data.root, "source.json");
  run(data, output);
  const source = JSON.parse(await readFile(output, "utf8"));
  assert.equal(source.sourceKind, "PRODUCTION_RUNTIME_DURABLE_TASK");
  assert.equal(source.synthetic, false);
  assert.equal(source.actualTrace.length, 0);
  assert.equal(source.taskStatus, "failed");
  assert.equal(source.flowStatus, "PARTIAL");
  assert.equal(source.terminalBranch, null);
  assert.deepEqual(source.flowGaps, ["TERMINAL_OUTCOME_TRACE_MISSING"]);
  assert.equal(source.terminalBranchProof, null);
  await writeFile(join(data.taskRoot, data.jobId, "materials", data.materialName), "tampered");
  assert.match(run(data, join(data.root, "tampered.json"), 1).stderr, /PRODUCT_MATERIAL_BYTE_MISMATCH/u);
  process.stdout.write("production-source acceptance passed\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
