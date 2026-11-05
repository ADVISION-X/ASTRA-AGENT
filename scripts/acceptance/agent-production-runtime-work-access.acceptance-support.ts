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
import { claimTask } from "./agent-production-runtime-fixtures.js";

export async function exerciseWorkAccessTransport(): Promise<void> {
  const route = productionRoutePolicy("astra_paper_research", "prepare_brief");
  const task = buildProductTask(route, { parameters: { submission_id: "submission:work", original_text: "论文需求",
    input_version: 1, research_tier: "high" } });
  const control = new TextEncoder().encode(JSON.stringify(route.result_contract));
  const prepared = { ...task, material_refs: task.material_refs.map(item => item.role === "result_contract"
    ? { ...item, bytes: control.byteLength, sha256: sha256(control) } : item) };
  const { request_hash: _requestHash, job_id: _jobId, ...canonical } = prepared;
  const job = claimTask({ ...prepared, request_hash: hashCanonical(canonical) });
  const source = job.material_refs.find(item => item.role === "research_input")!;
  const session = { device: { server_base_url: "https://work-access-test.invalid" },
    authorizationHeaders: async (headers: Record<string, string>) => headers } as unknown as ProductionWorkerSession;
  const savedFetch = globalThis.fetch, paths: string[] = [];
  const root = await mkdtemp(join(tmpdir(), "astra-work-access-"));
  let overrides: Record<string, unknown> = {};
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname !== "work-access-test.invalid") return savedFetch(input, init);
    paths.push(url.pathname);
    assert.equal(new Headers(init?.headers).get("x-ai-execution-fence-hash"), job.grant.execution_fence.fence_hash);
    if (!url.pathname.endsWith("/work-access")) return new Response(control);
    return Response.json({ ok: true, data: { material_id: source.material_id, url: "https://objects.invalid/signed-original",
      expires_at: new Date(Date.now() + 60_000).toISOString(), sha256: source.sha256, bytes: source.bytes,
      filename: source.display_name, ...overrides } });
  };
  try {
    const port = createWorkAccessPort(session, job, new AbortController().signal);
    const access = await port(source.material_id);
    assert.equal(access.sha256, source.sha256);
    const before = paths.length;
    await assert.rejects(port("foreign-material"), /WORK_ACCESS_MATERIAL_UNAUTHORIZED/u);
    assert.equal(paths.length, before);
    for (const values of [{ expires_at: "invalid" }, { expires_at: "2000-01-01T00:00:00.000Z" },
      { bytes: 0 }, { sha256: "invalid" }, { material_id: "foreign" }, { url: "http://objects.invalid/original" }]) {
      overrides = values;
      await assert.rejects(port(source.material_id));
    }
    overrides = {};
    paths.length = 0;
    const downloaded = await downloadProductionMaterials(session, job, root, new AbortController().signal);
    assert.deepEqual(downloaded.map(item => item.role), ["result_contract"]);
    assert.equal(paths.length, 1);
    assert(!paths.some(path => path.includes(encodeURIComponent(source.material_id))));
    assert.deepEqual(new Uint8Array(await readFile(downloaded[0]!.local_path)), control);
    const abort = new AbortController(); abort.abort();
    const canceled = createWorkAccessPort(session, job, abort.signal);
    await assert.rejects(canceled(source.material_id));
    assert.equal(paths.length, 1);
  } finally {
    globalThis.fetch = savedFetch;
    await rm(root, { recursive: true, force: true });
  }
}
