import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type {
  XuanyuanRequest,
  XuanyuanTaskRecord,
} from "../../src/plugins/xuanyuan/xuanyuan.schema.js";
import {
  startXuanyuanCloudWorker,
} from "../../src/plugins/xuanyuan/index.js";
import { writeXuanyuanCloudCredential } from "../../src/plugins/xuanyuan/xuanyuan-cloud-credential.js";

const digest = (text: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
const fixedHash = `sha256:${"a".repeat(64)}` as const;
const now = new Date().toISOString();

function cloudJob(sequence: number) {
  const identity = {
    protocol_version: "ai-acceptance-protocol-v1" as const,
    job_id: `aijob_00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    idempotency_key: `fixture:${sequence}`,
    source_task_id: `source-task-${sequence}`,
    parent_job_id: null,
    challenge_id: null,
    domain_id: sequence === 1 ? "bazi" : "qimen",
    stage: "base_analysis",
    attempt: 1,
    execution_lane: "local_gpt_web" as const,
    input_bundle_ref: `bundle:${sequence}`,
    input_bundle_hash: fixedHash,
    prompt_contract_ref: "fixture-prompt-v1",
    output_schema_ref: "fixture-output-v1",
    payload_json: { sequence },
    request_hash: fixedHash,
  };
  const execution = {
    status: "leased" as const,
    lease_owner: "aidev_fixture",
    lease_expires_at: new Date(Date.now() + 120_000).toISOString(),
    provider_execution_ref: null,
    raw_response_ref: null,
    raw_response_hash: null,
    raw_response_byte_count: null,
    provider_proof: null,
    provider_response: null,
    transport_warnings: [],
    created_at: now,
    updated_at: now,
    prompt_text: `fixture prompt ${sequence}`,
    inputs: [],
    lease_token: `ailease_fixture_${sequence}`,
    lease_version: 1,
    continuation: null,
  };
  return { ...identity, ...execution };
}

const jobs = [cloudJob(1), cloudJob(2)];
const resultBodies: Array<Record<string, unknown>> = [];
const checkpointPaths: string[] = [];
const checkpointStatuses: string[] = [];
const localRequests = new Map<string, XuanyuanRequest>();
let claimCount = 0;
let simultaneousExecutions = 0;
let activeExecutions = 0;
let resolveResults: (() => void) | undefined;
const resultsReady = new Promise<void>((resolve) => {
  resolveResults = resolve;
});

function capturedTask(taskId: string, request: XuanyuanRequest): XuanyuanTaskRecord {
  const rawResponseText = JSON.stringify({ task_id: taskId, accepted: true });
  const identity = {
    taskId,
    taskName: `系统验收｜${taskId.slice(-8).toUpperCase()}`,
    taskLabelKey: "system_acceptance",
    jobId: "xuanyuan",
    requestId: request.requestId,
    sourceProject: request.sourceProject,
    scenario: request.scenario,
    providerKind: "gpt-web-chat",
    status: "response_captured",
  } as const;
  const evidence = {
    requestSnapshot: request,
    promptPackageSnapshot: {
      promptPackageId: request.promptPackageId,
      promptContractId: request.promptContractId,
      expectedOutputSchemaRef: request.expectedOutputSchemaRef,
      textPrompt: request.textPrompt ?? "",
      inputRefs: request.inputRefs,
    },
    aiFeedResult: null,
    rawResponseText,
    rawOutputRef: `/private/${taskId}.txt`,
    rawOutputHash: digest(rawResponseText),
    providerProof: null,
    transportWarnings: [],
  } satisfies Pick<
    XuanyuanTaskRecord,
    "requestSnapshot" | "promptPackageSnapshot" | "aiFeedResult" | "rawResponseText"
    | "rawOutputRef" | "rawOutputHash" | "providerProof" | "transportWarnings"
  >;
  const lifecycle = {
    progress: {
      executionId: taskId,
      phase: "response_checkpointed",
      lastTransitionAt: now,
      attachmentUploadProof: null,
    },
    recovery: {
      attemptCount: 1,
      recoverable: false,
      lastAttemptStartedAt: now,
      lastFailureAt: null,
      lastFailureReason: null,
      recoveryDirective: "none",
    },
    continuationTaskId: null,
    conversationProof: null,
    failureReason: null,
    reviewRequiredReason: null,
    createdAt: now,
    updatedAt: now,
  } satisfies Pick<
    XuanyuanTaskRecord,
    "progress" | "recovery" | "continuationTaskId" | "conversationProof"
    | "failureReason" | "reviewRequiredReason" | "createdAt" | "updatedAt"
  >;
  return { ...identity, ...evidence, ...lifecycle };
}

const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const bodyText = Buffer.concat(chunks).toString("utf8");
  const body = bodyText ? JSON.parse(bodyText) as Record<string, unknown> : {};
  const pathname = new URL(request.url ?? "/", "http://fixture.invalid").pathname;
  let data: unknown = {};
  if (pathname.endsWith("/jobs/claim")) {
    data = { jobs: claimCount++ === 0 ? jobs : [] };
  } else if (pathname.endsWith("/checkpoints") || pathname.endsWith("/heartbeat")) {
    checkpointPaths.push(pathname);
    if (pathname.endsWith("/checkpoints") && typeof body.status === "string") {
      checkpointStatuses.push(body.status);
    }
  } else if (pathname.endsWith("/result")) {
    resultBodies.push(body);
    if (resultBodies.length === jobs.length) resolveResults?.();
  } else if (pathname.endsWith("/failure")) {
    assert.fail(`cloud worker reported an unexpected failure: ${bodyText}`);
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true, data }));
});

const dataDir = await mkdtemp(path.join(tmpdir(), "xuanyuan-cloud-worker-"));
try {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  process.env.XUANYUAN_CLOUD_BASE_URL = baseUrl;
  process.env.XUANYUAN_CLOUD_POLL_INTERVAL_MS = "1000";
  await writeXuanyuanCloudCredential(dataDir, {
    protocol_version: "ai-acceptance-protocol-v1",
    server_base_url: baseUrl,
    device_id: "aidev_fixture",
    device_name: "fixture-mac",
    credential: `aidc_${"x".repeat(40)}`,
    max_in_flight: 2,
    enrolled_at: now,
  });

  const handle = await startXuanyuanCloudWorker({
    dataDir,
    execution: {
      async enqueueTask(input) {
        const request = input as XuanyuanRequest;
        activeExecutions += 1;
        simultaneousExecutions = Math.max(simultaneousExecutions, activeExecutions);
        await new Promise<void>((resolve) => setTimeout(resolve, 80));
        activeExecutions -= 1;
        const task = capturedTask(`local_${request.requestId}`, request);
        localRequests.set(task.taskId, request);
        return task;
      },
      async getTaskStatus(taskId) {
        const request = localRequests.get(taskId);
        return request ? capturedTask(taskId, request) : null;
      },
    },
  });

  await Promise.race([
    resultsReady,
    new Promise<never>((_, reject) => setTimeout(
      () => reject(new Error("XUANYUAN_CLOUD_ACCEPTANCE_TIMEOUT")),
      8_000,
    )),
  ]);
  await handle.close();

  assert.equal(simultaneousExecutions, 2, "two claimed jobs must execute concurrently");
  assert.equal(resultBodies.length, 2, "both cloud jobs must return one terminal result");
  assert.deepEqual(
    resultBodies.map((body) => body.provider_execution_ref).sort(),
    jobs.map((job) => `local_${job.job_id}`).sort(),
    "provider results must remain bound to their stable cloud job identities",
  );
  assert.equal(
    new Set(resultBodies.map((body) => body.raw_response_hash)).size,
    2,
    "independent jobs must not overwrite or cross-wire response evidence",
  );
  assert(
    checkpointPaths.some((value) => value.endsWith("/result_uploading") === false),
    "checkpoint transport must be exercised before result acknowledgement",
  );
  for (const status of ["provider_submitted", "waiting_provider", "response_checkpointed"]) {
    assert.equal(
      checkpointStatuses.filter((value) => value === status).length,
      jobs.length,
      `each cloud job must preserve the ${status} checkpoint`,
    );
  }
  process.stdout.write(`${JSON.stringify({
    verdict: "PASS",
    owner: "xuanyuan/outbound-cloud-device",
    claimed_jobs: jobs.length,
    max_simultaneous_executions: simultaneousExecutions,
    returned_results: resultBodies.length,
  }, null, 2)}\n`);
} finally {
  delete process.env.XUANYUAN_CLOUD_BASE_URL;
  delete process.env.XUANYUAN_CLOUD_POLL_INTERVAL_MS;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(dataDir, { recursive: true, force: true });
}
