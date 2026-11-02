import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getEventListeners } from "node:events";
import { zipSync } from "fflate";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { executeClaim } from "../../src/lib/local-runtime/production/runtime-claim.js";
import { downloadProductionMaterials } from "../../src/lib/local-runtime/production/cloud-client.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { hashCanonical, sha256, type LocalProductionMaterial, type ProductionExecutionLease } from "../../src/lib/local-runtime/production/contracts.js";
import { runtimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
import { websiteAgentTaskFromClaim } from "../../src/lib/local-runtime/production/transport-protocol.js";
import { productionRuntimeTaskPath } from "../../src/lib/local-runtime/production/runtime-storage-inventory.js";
import { HASH_A, claimTask, task, shutdownRuntimeFixture, deviceStatusWithoutAdmission, stageResultForAcceptance, resultFor } from "./agent-production-runtime-fixtures.js";

type Clock = Readonly<{ tick: () => Promise<void>; advance: (ms: number) => Promise<void>; timers: Readonly<{ size: number }> }>;
const json = (data: unknown): Response => new Response(JSON.stringify({ ok: true, data }), {
  headers: { "content-type": "application/json" },
});
const materialBytes = (ordinal: number) => Buffer.from(zipSync({
  "material.json": [Buffer.from(JSON.stringify({ ordinal, content: "material" })), { mtime: new Date("2020-01-01T00:00:00Z") }],
}));

const materialJob = (name: string) => {
  const materials = ["localization_reference_archive", "localization_work_archive"].map((role, ordinal) => {
    const bytes = materialBytes(ordinal);
    return { material_id: `material:${ordinal}`, ordinal, role, display_name: `${ordinal}.zip`,
      object_ref: `object:${ordinal}`, sha256: sha256(bytes), bytes: bytes.byteLength,
      media_type: "application/zip", storage_class: "private_owner_scoped", owner_scope_hash: HASH_A,
      trust_class: "locked_fact", may_issue_instruction: false };
  });
  const claimed = claimTask(task({ jobId: `job:material-${name}`, productId: "localization_report_translation",
    actionId: "report_translation", materialRefs: materials,
    extra: { parameters: { target_locale: "en-US", source_resource_id: "source:fixture", source_version: "v1",
      source_sha256: HASH_A, policy_version: "v1" } } }));
  const now = Date.now();
  return { ...claimed, grant: { ...claimed.grant, server_now: new Date(now).toISOString(),
    lease_expires_at: new Date(now + 90_000).toISOString() } };
};
const renewReceipt = (jobId: string) => ({
  schema_version: "xuanxue-ai-lease-renew-receipt.v6", job_id: jobId,
  server_now: new Date(Date.now()).toISOString(), lease_expires_at: new Date(Date.now() + 90_000).toISOString(),
  renew_after_ms: 20_000, control_intent: { schema_version: "xuanxue-ai-control-intent.v6", job_id: jobId,
    intent: "none", control_epoch: 0, reason_code: null },
});

const fixture = async (name: string) => {
  const directory = await mkdtemp(join(tmpdir(), "agent-material-lease-"));
  const store = new ProductionRuntimeStore(directory), job = materialJob(name), abort = new AbortController();
  const directoryPath = join(productionRuntimeTaskPath(directory, job.job_id), "materials");
  const controls = {
    download: async (ordinal: number, _signal: AbortSignal): Promise<Response> => new Response(materialBytes(ordinal)),
    renew: async (): Promise<unknown> => renewReceipt(job.job_id),
    authorize: async (): Promise<void> => undefined,
    readPhysicalInput: (): "zero" => "zero",
    remote: async (): Promise<unknown> => deviceStatusWithoutAdmission(job.job_id).request(),
  };
  let preflightRenewed = false;
  const observed = { downloads: [] as number[], renews: [] as number[], preflightRenews: 0, executions: 0, terminals: 0,
    materials: [] as readonly LocalProductionMaterial[], budget: null as ProductionExecutionLease | null };
  const runtimeLogger = createRuntimeLogger({ producer: "agent-material-lease-acceptance", owner: "production-runtime",
    component: "production-runtime", terminalEnabled: false, fileSink: { directoryPath: join(directory, "logs") } });
  const session = { device: { server_base_url: "http://127.0.0.1:4322" }, workerSessionId: job.grant.worker_session_id,
    workerSessionEpoch: job.grant.worker_session_epoch,
    authorizationHeaders: async (headers: Record<string, string>) => { await controls.authorize(); return headers; },
    request: async (path: string, init?: RequestInit): Promise<unknown> => {
      if (path.endsWith("/device-status")) return controls.remote();
      if (path.endsWith("/renew")) {
        if (!preflightRenewed) { preflightRenewed = true; observed.preflightRenews++; return renewReceipt(job.job_id); }
        observed.renews.push(performance.now()); return controls.renew();
      }
      assert.ok(path.endsWith("/terminal"), `unexpected material fixture request:${path}`);
      observed.terminals++;
      const body = JSON.parse(Buffer.from(init!.body as Uint8Array).toString("utf8"));
      return { schema_version: "xuanxue-ai-terminal-receipt.v6", job_id: job.job_id, terminal_status: "completed",
        payload_hash: body.payload_hash, failure: null, first_terminal: true,
        device_id: job.grant.device_id, device_epoch: job.grant.device_epoch,
        worker_session_id: session.workerSessionId, worker_session_epoch: session.workerSessionEpoch,
        runtime_attestation_receipt_hash: HASH_A };
    } };
  const state = shutdownRuntimeFixture({ store, dataDir: directory, runtimeLogger, session: session as never,
    browser: { readJobPhysicalInputState: () => controls.readPhysicalInput() } });
  state.activeAbort.set(job.job_id, abort);
  state.executor.execute = async (_task, materials, budget, _parent, complete) => {
    observed.executions++; observed.materials = materials; observed.budget = budget;
    assert.equal(budget.abort_signal, abort.signal); assert.equal(materials.length, 2);
    assert.ok(budget.expires_at_monotonic > performance.now(), "download must preserve a live original budget");
    const result = await complete!({ payload: { transport_fixture: true }, evidence_refs: ["evidence:fixture"] });
    return { record: store.readTask(job.job_id)!, result, providerEffectReadbackProof: null };
  };
  return { directory, directoryPath, store, job, abort, state, controls, observed };
};
type Fixture = Awaited<ReturnType<typeof fixture>>;

const artifactResponse = (url: URL, init: RequestInit): Response => {
  const bytes = Buffer.from(init.body as Uint8Array), pieces = url.pathname.split("/");
  const role = pieces.at(-2)!, hash = sha256(bytes);
  return json({ schema_version: "xuanxue-ai-material-receipt.v6", artifact_id: decodeURIComponent(pieces.at(-1)!),
    role, object_ref: `object:${hash}`, sha256: hash, byte_length: bytes.byteLength, media_type: "application/json",
    state: "staged", receipt_hash: hashCanonical({ role, hash }) });
};

const installTransport = (run: Fixture): void => {
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.includes("/artifacts/")) return artifactResponse(url, init!);
    assert.ok(url.pathname.includes("/materials/"), `unexpected physical transport:${url.pathname}`);
    assert.equal(run.store.readTask(run.job.job_id)?.current_attempt_id, run.job.grant.attempt_id);
    assert.equal(run.store.readTask(run.job.job_id)?.current_reason, "EXECUTING");
    assert.equal(new Headers(init?.headers).get("x-ai-execution-fence-hash"), run.job.grant.execution_fence.fence_hash);
    const ordinal = Number(decodeURIComponent(url.pathname.split("/").at(-1)!).split(":").at(-1));
    assert.ok(init?.signal, "material transport must receive its actual abort signal");
    run.observed.downloads.push(ordinal);
    return run.controls.download(ordinal, init!.signal!);
  };
};

const until = async (clock: Clock, predicate: () => boolean): Promise<void> => {
  for (let turn = 0; turn < 100 && !predicate(); turn++) {
    await clock.tick(); await new Promise<void>(resolve => setImmediate(resolve));
  }
  assert.ok(predicate(), "actual material operation did not reach its controlled boundary");
};

const withFixture = async (name: string, action: (run: Fixture) => Promise<void>): Promise<void> => {
  const previous = globalThis.fetch, run = await fixture(name);
  installTransport(run);
  try { await action(run); }
  finally { globalThis.fetch = previous; run.store.close(); await rm(run.directory, { recursive: true, force: true }); }
};

const pendingMaterial = (signal: AbortSignal, body: boolean): Promise<Response> => {
  if (body) return Promise.resolve(new Response(new ReadableStream({ start(controller) {
    const aborted = () => controller.error(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
  } })));
  return new Promise<Response>((_resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
  });
};

const verifyBoundaryFailure = async (run: Fixture, materialSpan = true): Promise<void> => {
  assert.equal(run.observed.executions, 0); assert.equal(run.observed.terminals, 0);
  assert.equal(run.store.readAttemptFailureRaw(run.job.job_id), null, "preparation must never create a Product first fact");
  assert.equal(run.store.readTask(run.job.job_id)?.current_attempt_id, run.job.grant.attempt_id);
  const events = [];
  const logDirectory = join(run.directory, "logs", "agent-material-lease-acceptance");
  for (const file of await readdir(logDirectory)) {
    if (file.endsWith(".jsonl")) events.push(...(await readFile(join(logDirectory, file), "utf8")).trim().split("\n").map(line => JSON.parse(line)));
  }
  const failed = events.filter(event => event.outcome === "failed");
  assert.equal(failed.some(event => event.operation === "material.download-verify"), materialSpan);
  assert.ok(failed.some(event => event.operation === "job.execute"));
  assert.equal(failed.some(event => event.failure?.code === "JOB_EXECUTION_FAILED"), false);
};

const exerciseLongDownload = async (clock: Clock, retry = false): Promise<void> => {
  await withFixture(retry ? "long-retry" : "long", async run => {
    let release!: () => void, renewals = 0;
    if (retry) run.controls.renew = async () => {
      if (++renewals === 1) throw runtimeTransportFailure("TRANSIENT_RENEW", 500);
      return renewReceipt(run.job.job_id);
    };
    run.controls.download = async (ordinal, signal) => {
      if (ordinal === 0) await new Promise<void>(resolve => { release = resolve; });
      assert.equal(signal.aborted, false);
      return new Response(materialBytes(ordinal));
    };
    const start = performance.now(), work = executeClaim(run.state, run.job);
    await until(clock, () => !!release);
    for (let turn = 1; turn <= 5; turn++) {
      await clock.advance(20_000);
      if (retry && turn === 1) await clock.advance(5_000);
      await until(clock, () => run.observed.renews.length === turn + Number(retry));
      assert.equal(run.observed.executions, 0);
      assert.equal(run.abort.signal.aborted, false);
    }
    release(); await work;
    assert.equal(run.observed.preflightRenews, 1, "the original current fence is renewed before material preparation");
    assert.deepEqual(run.observed.renews.map(time => time - start),
      retry ? [20_000, 25_000, 45_000, 65_000, 85_000, 105_000] : [20_000, 40_000, 60_000, 80_000, 100_000]);
    assert.deepEqual(run.observed.downloads, [0, 1]); assert.equal(run.observed.executions, 1);
    assert.equal(run.observed.budget!.attempt_id, run.job.grant.attempt_id);
    assert.equal(run.observed.budget!.lease_version, run.job.grant.lease_version);
    assert.equal(run.observed.budget!.execution_fence_hash, run.job.grant.execution_fence.fence_hash);
    assert.equal(run.observed.budget!.expires_at_monotonic, performance.now() + 80_000);
    for (const material of run.observed.materials) {
      const bytes = await readFile(material.local_path);
      assert.equal(bytes.byteLength, material.bytes); assert.equal(sha256(bytes), material.sha256);
    }
    assert.equal(run.store.readTask(run.job.job_id)?.status, "completed");
    assert.ok(run.store.readTask(run.job.job_id)?.result); assert.equal(run.observed.terminals, 1);
    assert.equal(clock.timers.size, 0); assert.equal(getEventListeners(run.abort.signal, "abort").length, 0);
  });
};

const exercisePreparationAbort = async (clock: Clock): Promise<void> => {
  for (const mode of ["fetch-cancel", "body-pause", "session", "schema", "budget", "retry", "local"] as const) {
    await withFixture(mode, async run => {
      let entered = false, physical: AbortSignal | undefined, renews = 0;
      run.controls.download = (ordinal, signal) => {
        assert.equal(ordinal, 0); entered = true; physical = signal;
        return pendingMaterial(signal, mode === "body-pause");
      };
      run.controls.renew = async () => {
        renews++;
        if (mode === "retry" && renews === 1) throw runtimeTransportFailure("TRANSIENT_RENEW", 500);
        if (mode === "session") throw runtimeTransportFailure("AI_SESSION_REVOKED", 403);
        if (mode === "schema") return { not_a_lease_receipt: true };
        if (mode === "retry") throw runtimeTransportFailure("AI_LEASE_FENCE_STALE", 409);
        const reply = renewReceipt(run.job.job_id);
        if (mode === "budget") reply.lease_expires_at = reply.server_now;
        else { reply.control_intent.intent = mode === "body-pause" ? "pause_requested" : "cancel_requested";
          reply.control_intent.control_epoch = 1; }
        return reply;
      };
      const work = executeClaim(run.state, run.job);
      await until(clock, () => entered);
      if (mode === "local") run.abort.abort("PRODUCTION_RUNTIME_STOPPED");
      else { await clock.advance(20_000); if (mode === "retry") await clock.advance(5_000); }
      await work; await verifyBoundaryFailure(run);
      assert.equal(physical!.aborted, true); assert.deepEqual(run.observed.downloads, [0]);
      assert.equal(renews, mode === "local" ? 0 : mode === "retry" ? 2 : 1);
      assert.equal(clock.timers.size, 0); assert.equal(getEventListeners(run.abort.signal, "abort").length, 0);
    });
  }
};

const exerciseAbortBoundaries = async (clock: Clock): Promise<void> => {
  for (const mode of ["pre", "headers", "last-body"] as const) {
    await withFixture(mode, async run => {
      let release!: () => void;
      if (mode === "pre") run.abort.abort("PRODUCTION_RUNTIME_STOPPED");
      if (mode === "headers") run.controls.authorize = () => new Promise(resolve => { release = resolve; });
      if (mode === "last-body") run.controls.download = async ordinal => {
        const response = new Response(materialBytes(ordinal)), read = response.arrayBuffer.bind(response);
        response.arrayBuffer = async () => {
          const bytes = await read();
          if (ordinal === 1) run.abort.abort("PRODUCTION_RUNTIME_STOPPED");
          return bytes;
        };
        return response;
      };
      const work = executeClaim(run.state, run.job);
      if (mode === "headers") { await until(clock, () => !!release); run.abort.abort("PRODUCTION_RUNTIME_STOPPED"); release(); }
      await work;
      if (mode === "pre") {
        assert.equal(run.observed.executions, 0); assert.equal(run.observed.terminals, 0);
        assert.equal(run.store.readTask(run.job.job_id)?.current_attempt_id, run.job.grant.attempt_id);
      } else await verifyBoundaryFailure(run);
      assert.equal(run.observed.downloads.length, mode === "last-body" ? 2 : 0);
      assert.equal(clock.timers.size, 0);
    });
  }
};

const exercisePreparationFailures = async (clock: Clock): Promise<void> => {
  for (const mode of ["http409", "http500", "network", "body", "bytes", "hash", "write"] as const) {
    await withFixture(mode, async run => {
      if (mode === "write") {
        await mkdir(run.directoryPath, { recursive: true }); await writeFile(join(run.directoryPath, "0.zip"), "conflict");
      }
      run.controls.download = async ordinal => {
        if (mode === "network") throw new Error("FETCH_NETWORK_FAILURE");
        if (mode === "body") return new Response(new ReadableStream({ start(controller) { controller.error(new Error("BODY_FAILURE")); } }));
        if (mode === "bytes") return new Response("x");
        if (mode === "hash") return new Response(Buffer.alloc(materialBytes(ordinal).byteLength));
        if (mode === "http409" || mode === "http500") {
          const status = mode === "http409" ? 409 : 500;
          return new Response(JSON.stringify({ ok: false, error: { code: "MATERIAL_REJECTED", message: "rejected", status,
            request_id: "request:material" } }), { status });
        }
        return new Response(materialBytes(ordinal));
      };
      await executeClaim(run.state, run.job); await verifyBoundaryFailure(run);
      assert.deepEqual(run.observed.downloads, [0]); assert.equal(clock.timers.size, 0);
    });
  }
  await withFixture("invalid-directory", async run => {
    run.job.job_id = "job:invalid/path"; run.job.grant.job_id = run.job.job_id;
    run.job.grant.execution_fence.job_id = run.job.job_id;
    run.state.activeAbort.set(run.job.job_id, run.abort);
    await executeClaim(run.state, run.job); await verifyBoundaryFailure(run, false);
    assert.deepEqual(run.observed.downloads, []); assert.equal(clock.timers.size, 0);
  });
  await withFixture("same-attempt-preparation", async run => {
    run.store.acceptTask(websiteAgentTaskFromClaim(run.job), run.job.grant.attempt_id);
    run.job.grant.same_accepted_attempt = true;
    let browserReads = 0;
    run.controls.readPhysicalInput = () => { browserReads++; throw new Error("PREPARATION_MUST_NOT_READ_BROWSER"); };
    run.controls.download = async () => new Response("invalid bytes");
    await executeClaim(run.state, run.job); await verifyBoundaryFailure(run);
    assert.equal(browserReads, 0);
    assert.match(run.state.lastErrorCode!, /^MATERIAL_DOWNLOAD_IDENTITY_MISMATCH/u);
    assert.equal(clock.timers.size, 0);
  });
};

const exerciseIdempotentAndRecovery = async (clock: Clock): Promise<void> => {
  await withFixture("idempotent", async run => {
    run.store.acceptTask(websiteAgentTaskFromClaim(run.job), run.job.grant.attempt_id);
    run.store.markExecuting(run.job.job_id);
    const first = await downloadProductionMaterials(run.state.session, run.job, run.directoryPath, run.abort.signal);
    const second = await downloadProductionMaterials(run.state.session, run.job, run.directoryPath, run.abort.signal);
    assert.deepEqual(second, first); assert.deepEqual(await readdir(run.directoryPath), ["0.zip", "1.zip"]);
  });
  for (const deliveryOnly of [false, true]) {
    await withFixture(`staged-${deliveryOnly}`, async run => {
      const accepted = websiteAgentTaskFromClaim(run.job);
      run.store.acceptTask(accepted, run.job.grant.attempt_id);
      stageResultForAcceptance(run.store, run.job.job_id, run.job.grant.attempt_id, resultFor(accepted));
      run.job.grant.same_accepted_attempt = true; run.job.grant.delivery_only = deliveryOnly;
      await executeClaim(run.state, run.job);
      assert.deepEqual(run.observed.downloads, []); assert.equal(run.observed.executions, 0);
      assert.equal(run.store.readTask(run.job.job_id)?.status, "completed"); assert.equal(clock.timers.size, 0);
    });
  }
  await withFixture("bad-authority", async run => {
    const remote = await deviceStatusWithoutAdmission(run.job.job_id).request();
    run.controls.remote = async () => ({ ...remote, accepted_attempt_count: 2 });
    await executeClaim(run.state, run.job);
    assert.deepEqual(run.observed.downloads, []); assert.equal(run.store.readTask(run.job.job_id), null);
  });
};

export const exerciseMaterialLeaseBoundary = async (
  tick: Clock["tick"], advance: Clock["advance"], timers: Clock["timers"],
): Promise<void> => {
  const clock = { tick, advance, timers };
  await exerciseLongDownload(clock);
  await exerciseLongDownload(clock, true);
  await exercisePreparationAbort(clock);
  await exerciseAbortBoundaries(clock);
  await exercisePreparationFailures(clock);
  await exerciseIdempotentAndRecovery(clock);
};
