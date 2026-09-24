import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { readFile } from "node:fs/promises";
import { executionFailure, typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { readProductionDeviceJobStatus } from "../../src/lib/local-runtime/production/cloud-reconciliation-client.js";
import { serializeTerminalFailure, serializeTerminalFailureTransport } from
  "../../src/lib/local-runtime/production/terminal-failure.js";

/** Verifies the public failure transport and the Runtime/Website authority boundary. */
export const verifyRecoveryFailureTransport = async (
  providerEffectHash: `sha256:${string}`,
): Promise<void> => {
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
  const remoteFailureCore = serializeTerminalFailureTransport(
    executionFailure("failed", "REMOTE_FAILURE_FACT"),
  );
  const remoteFailure = { ...remoteFailureCore, from_status: "failed", to_status: "failed",
    attempt_id: "attempt:remote-failure", lease_version: 3 };
  const deviceStatus = (attemptFailure: unknown) => ({
    schema_version: "xuanxue-ai-device-job-status.v6",
    job_id: "job:remote-failure",
    status: "failed",
    current_reason: null,
    attempt_failure: attemptFailure,
    control_intent: { schema_version: "xuanxue-ai-control-intent.v6",
      job_id: "job:remote-failure", control_epoch: 0, intent: "none", reason_code: null },
    next_action_code: "ACTIVE_ATTEMPT",
    terminal_status: null,
    terminal_payload_hash: null,
    business_admission_receipt: null,
    business_consumer_error: null,
    accepted_attempt_count: 1,
    write_receipts: [],
    staged_result: null,
    staged_artifact_receipts: [],
  });
  const parsedRemote = await readProductionDeviceJobStatus({
    request: async () => deviceStatus(remoteFailure),
  } as never, "job:remote-failure");
  assert.deepEqual(parsedRemote.attempt_failure, remoteFailure);
  await assert.rejects(readProductionDeviceJobStatus({
    request: async () => deviceStatus(serializeTerminalFailure(
      executionFailure("failed", "LEGACY_REMOTE_FAILURE"),
    )),
  } as never, "job:remote-failure"),
  (error: unknown) => typedExecutionFailure(error)?.code === "V6_DEVICE_ATTEMPT_FAILURE_INVALID");
  const runtimeClaimPaths = ["runtime-claim.ts", "runtime-claim-recovery.ts",
    "runtime-claim-source-readback-failure.ts", "runtime-claim-preproduct.ts"];
  const runtimeClaims = await Promise.all(runtimeClaimPaths.map(async (path) => readFile(new URL(
    `../../src/lib/local-runtime/production/${path}`, import.meta.url,
  ), "utf8")));
  for (const runtimeClaim of runtimeClaims) {
    assert.doesNotMatch(runtimeClaim, /browser-mutation-authority|browser-mutations\.sqlite/u,
      "Runtime must transport the public typed effect fact without reading Browser private storage");
  }
  const runtimeClaim = runtimeClaims[0]!;
  assert.match(runtimeClaim, /serializeTerminalFailureTransport/u);
  assert.doesNotMatch(runtimeClaim, /provider_effect_identity_hash: _effectTransportOnly/u);
  assert.match(runtimeClaim, /buildProductionLeaseRelease/u);
  const runtimeLoops = await readFile(new URL(
    "../../src/lib/local-runtime/production/runtime-loops.ts", import.meta.url,
  ), "utf8");
  assert.match(runtimeLoops,
    /const browser = state\.browserAuthority\.readProductionRuntimeState\(\);[\s\S]*?browser\.browserAuthorityState === "present"[\s\S]*?if \(!eligible\) return 1_000;[\s\S]*?requestClaimBatch/u,
    "the worker must fail closed before claiming when Browser Authority is absent");
};
