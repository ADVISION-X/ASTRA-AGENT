import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { executionFailure, typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import {
  serializeTerminalFailure,
  serializeTerminalFailureTransport,
} from "../../src/lib/local-runtime/production/terminal-failure.js";
import { task } from "./agent-production-runtime-fixtures.js";

const directory = await mkdtemp(path.join(tmpdir(), "agent-fresh-attempt-"));
try {
  const providerEffectHash = `sha256:${"c".repeat(64)}` as const;
  assert.deepEqual(serializeTerminalFailureTransport(
    executionFailure("failed", "PRODUCT_EXECUTION_FAILED", { metadata: {
      mutationOutcome: "confirmed",
      browserEffect: {
        effectScope: "provider_effect", childCapabilityId: "submit_exact_gpt_turn_once",
        browserOutcome: "CONFIRMED", providerEffectIdentityHash: providerEffectHash,
      },
    }}),
  ), { ...serializeTerminalFailure(executionFailure("failed", "PRODUCT_EXECUTION_FAILED")),
    mutation_outcome: "confirmed", effect_scope: "provider_effect",
    child_capability_id: "submit_exact_gpt_turn_once", browser_outcome: "CONFIRMED",
    provider_effect_identity_hash: providerEffectHash, settled_result_payload_hash: null });
  const runtimeClaim = await readFile(new URL(
    "../../src/lib/local-runtime/production/runtime-claim.ts", import.meta.url,
  ), "utf8");
  assert.doesNotMatch(runtimeClaim, /browser-mutation-authority|browser-mutations\.sqlite/u,
    "Runtime must transport the public typed effect fact without reading Browser private storage");
  assert.match(runtimeClaim, /serializeTerminalFailureTransport/u);
  assert.match(runtimeClaim, /provider_effect_identity_hash: _effectTransportOnly/u);
  const runtimeLoops = await readFile(new URL(
    "../../src/lib/local-runtime/production/runtime-loops.ts", import.meta.url,
  ), "utf8");
  assert.match(runtimeLoops,
    /const browser = state\.browserAuthority\.readProductionRuntimeState\(\);[\s\S]*?browser\.browserAuthorityState === "present"[\s\S]*?if \(!eligible\) return 1_000;[\s\S]*?requestClaimBatch/u,
    "the worker must fail closed before claiming when Browser Authority is absent");
  const store = new ProductionRuntimeStore(directory);
  const job = task({
    jobId: "job:fresh-attempt",
    productId: "payment_screenshot_observation",
    actionId: "observe",
  });
  store.acceptTask(job, "attempt:1");
  store.recordAttemptFailure(
    job.job_id,
    "attempt:1",
    serializeTerminalFailure(executionFailure("failed", "PRODUCT_EXECUTION_FAILED")),
  );
  const artifactKey = "artifact:fresh-attempt";
  store.enqueue({
    idempotency_key: artifactKey,
    kind: "artifact",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/artifacts/result`,
    method: "PUT",
    headers: {},
    body: Buffer.from("result"),
  });
  await assert.rejects(
    store.deliverOutbox(artifactKey, async () => {
      throw executionFailure("failed", "CLOUD_TRANSPORT_UNAVAILABLE");
    }),
    (error: unknown) => typedExecutionFailure(error)?.code === "CLOUD_TRANSPORT_UNAVAILABLE",
  );
  await assert.rejects(
    store.deliverOutbox(artifactKey, async () => {
      throw new Error("AN_ALREADY_RECORDED_FAILURE_MUST_NOT_BE_REPLAYED");
    }),
    (error: unknown) => typedExecutionFailure(error)?.code === "CLOUD_TRANSPORT_UNAVAILABLE",
  );
  const regranted = store.acceptTask(job, "attempt:1");
  assert.equal(regranted.current_reason, "LEASE_REGRANTED");
  assert.equal(regranted.attempt_failure, null,
    "Website regrant of the same accepted attempt must permit zero-submit result convergence");
  const fresh = store.acceptTask(job, "attempt:2");
  assert.equal(fresh.current_attempt_id, "attempt:2");
  assert.equal(fresh.attempt_failure, null);
  assert.equal(fresh.staged_result, null);
  assert.equal(fresh.current_reason, "LEASE_GRANTED");
  assert.equal(store.readOutboxAuthority(artifactKey)?.lastError, "WEBSITE_ATTEMPT_REPLACED");
  await assert.rejects(
    store.deliverOutbox(artifactKey, async () => {
      throw new Error("A_SUPERSEDED_WRITE_MUST_NOT_BE_SENT");
    }),
    (error: unknown) => typedExecutionFailure(error)?.code === "WEBSITE_ATTEMPT_REPLACED",
  );
  store.close();
} finally {
  await rm(directory, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE][agent-production-runtime-fresh-attempt] PASS\n");
