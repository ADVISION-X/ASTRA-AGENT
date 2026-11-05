import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { createWorkAccessPort } from "../../src/lib/local-runtime/production/work-access.js";
import { downloadProductionMaterials } from "../../src/lib/local-runtime/production/cloud-client.js";
import type { ProductionWorkerSession } from "../../src/lib/local-runtime/production/worker-session.js";
import { productionRoutePolicy } from "../../src/lib/local-runtime/production/route-policy.js";
import { sha256, hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { buildProductTask } from "./product-plugin-test-runtime.js";
import { reconcileContinuationParent } from "../../src/lib/local-runtime/production/runtime-claim-preproduct.js";
import { runtimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
import type { RuntimeState } from "../../src/lib/local-runtime/production/runtime-state.js";
import { claimTask, resultFor } from "./agent-production-runtime-fixtures.js";

async function exerciseStagedContinuation(input: ReturnType<typeof buildProductTask>): Promise<void> {
  const task = { ...input, material_refs: [...input.material_refs] };
  const result = resultFor(task);
  const staged = { task, status: "failed", staged_result: result, current_attempt_id: "attempt:parent" };
  const revision = { ...task, job_id: "job:revision", parent_task_ref: task.job_id, parent_result_ref: result.result_payload_ref,
    parent_result_hash: result.result_payload_hash, parameters: { ...task.parameters, revision_feedback: "补充证据" } };
  let received = false;
  let remoteStatus = 503;
  let reads = 0;
  let completions = 0;
  const state = {
    store: {
      readTask: (id: string) => id === task.job_id ? staged : undefined,
      readResultReceivingReceipt: () => received,
      completeTask: (id: string, stagedResult: unknown) => {
        assert.equal(id, task.job_id); assert.deepEqual(stagedResult, result);
        completions += 1;
      },
    },
    session: { request: async (path: string) => {
      assert(path.includes(encodeURIComponent(task.job_id)));
      reads += 1;
      throw runtimeTransportFailure("PARENT_RECEIPT_TRANSPORT", remoteStatus);
    } },
  } as unknown as RuntimeState;
  const signal = new AbortController().signal;
  assert.equal(await reconcileContinuationParent(state, revision, signal), false);
  assert.equal(reads, 1); assert.equal(completions, 0);
  remoteStatus = 403;
  await assert.rejects(reconcileContinuationParent(state, revision, signal), /PARENT_RECEIPT_TRANSPORT/u);
  await assert.rejects(reconcileContinuationParent(state, { ...revision, parameters: { input_version: 2 } }, signal), /PARENT_RESULT_BINDING/u);
  assert.equal(reads, 2); assert.equal(completions, 0);
  received = true;
  assert.equal(await reconcileContinuationParent(state, revision, signal), true);
  assert.equal(reads, 2); assert.equal(completions, 1);
}

export async function exerciseWorkAccessTransport(): Promise<void> {
  const route = productionRoutePolicy("astra_paper_research", "prepare_brief");
  const task = buildProductTask(route, { parameters: { submission_id: "submission:chat", original_text: "论文需求",
    input_version: 1, research_tier: "high", communication_locale: "zh-TW", manuscript_locale: "en-US",
    revision_feedback: null, research_input_names: ["原件.txt"] } });
  await exerciseStagedContinuation(task);
  const original = new TextEncoder().encode("原始研究材料");
  const control = new TextEncoder().encode(JSON.stringify(route.result_contract));
  const prepared = { ...task, material_refs: task.material_refs.map(item => {
    const bytes = item.role === "research_input" ? original : control;
    return { ...item, bytes: bytes.byteLength, sha256: sha256(bytes) };
  }) };
  const { request_hash: _requestHash, job_id: _jobId, ...canonical } = prepared;
  const job = claimTask({ ...prepared, request_hash: hashCanonical(canonical) });
  const source = job.material_refs.find(item => item.role === "research_input")!;
  const session = { device: { server_base_url: "https://materials-test.invalid" },
    authorizationHeaders: async (headers: Record<string, string>) => headers } as unknown as ProductionWorkerSession;
  const savedFetch = globalThis.fetch, paths: string[] = [];
  const root = await mkdtemp(join(tmpdir(), "astra-chat-materials-"));
  let corrupt = false;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname !== "materials-test.invalid") return savedFetch(input, init);
    paths.push(url.pathname);
    assert.equal(new Headers(init?.headers).get("x-ai-execution-fence-hash"), job.grant.execution_fence.fence_hash);
    if (!url.pathname.endsWith(encodeURIComponent(source.material_id))) return new Response(control);
    return new Response(corrupt ? "unverified original" : original);
  };
  try {
    const port = createWorkAccessPort(session, job, new AbortController().signal);
    await assert.rejects(port(source.material_id), /WORK_ACCESS_MATERIAL_UNAUTHORIZED/u);
    assert.equal(paths.length, 0);
    const downloaded = await downloadProductionMaterials(session, job, root, new AbortController().signal);
    assert.deepEqual(downloaded.map(item => item.role), ["research_input", "result_contract"]);
    assert.equal(paths.length, 2);
    assert.deepEqual(new Uint8Array(await readFile(downloaded[0]!.local_path)), original);
    assert.deepEqual(new Uint8Array(await readFile(downloaded[1]!.local_path)), control);
    corrupt = true;
    await assert.rejects(downloadProductionMaterials(session, job, root, new AbortController().signal),
      /MATERIAL_DOWNLOAD_IDENTITY_MISMATCH/u);
    const abort = new AbortController(); abort.abort();
    await assert.rejects(downloadProductionMaterials(session, job, root, abort.signal));
    assert.equal(paths.length, 3);
  } finally {
    globalThis.fetch = savedFetch;
    await rm(root, { recursive: true, force: true });
  }
}
