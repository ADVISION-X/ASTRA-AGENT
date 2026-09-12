import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProductionGptBrowserLifecycle } from "../production-browser-lifecycle.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { HASH_A, HASH_B, task } from "../../../../scripts/acceptance/agent-production-runtime-fixtures.js";

const temporary = await mkdtemp(path.join(tmpdir(), "agent-mismatch-acceptance-"));
try {
  const runtimeLogger = createRuntimeLogger({
    producer: "agent-mismatch-acceptance", owner: "production-runtime", component: "gpt-child", terminalEnabled: false,
    fileSink: { directoryPath: path.join(temporary, "runtime-logs") },
  });
  const waitTask = task({
    jobId: "job:agent-mismatch-acceptance", productId: "payment_screenshot_observation", actionId: "observe",
  });
  let selections = 0;
  const providerEffectIdentityHash = `sha256:${"8".repeat(64)}` as const;
  const submitIdentity = {
    resultRevision: 0, productStepId: "corpus_research", callId: "turn-submit",
    childCapabilityId: "submit_exact_gpt_turn_once", inputHash: HASH_A,
    actionOrdinal: 1, replayPolicy: "provider-effect-once" as const,
  };
  const originalBrowser = {
    target: { targetRef: "target:provider-wait:original" },
    pendingMutationCount: () => 0,
    requiresMutationRecovery: () => false,
    readAtomicStepOutcome: () => ({
      state: "confirmed", mutationOutcome: "confirmed", providerEffectIdentityHash,
      terminalPayload: {
        canonicalConversationUrl: "https://chatgpt.com/c/mismatch",
        userTurnId: "conversation-turn-1",
      },
    }),
    executeDomIntent: async () => { selections += 1; },
    park: async () => undefined,
    close: async () => undefined,
  };
  const mismatchedBrowser = {
    ...originalBrowser,
    target: { targetRef: "target:provider-wait:mismatched" },
  };
  let mismatchAcquisitions = 0;
  const mismatchLifecycle = new ProductionGptBrowserLifecycle(
    {
      acquireJobBoundTargetLease: async () => {
        mismatchAcquisitions += 1;
        return mismatchAcquisitions === 1 ? originalBrowser : mismatchedBrowser;
      },
    } as never,
    runtimeLogger,
    HASH_A,
    {
      jobId: waitTask.job_id, attemptId: "attempt:provider-wait-mismatch",
      resultRevision: 0,
      deviceId: "device:1", leaseVersion: 1,
      executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
      expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
      abortSignal: new AbortController().signal,
    },
  );
  const mismatchActive = await mismatchLifecycle.browserFor(
    "session:provider-wait-mismatch",
    "corpus_research",
    "text-wait",
  );
  mismatchLifecycle.recordConfirmedProviderEffect(mismatchActive, {
    exactCallIdentityHash: `sha256:${"6".repeat(64)}`,
    providerEffectIdentityHash,
    childCapabilityId: "submit_exact_gpt_turn_once", effectScope: "provider_effect",
    browserOutcome: "CONFIRMED", mutationOutcome: "confirmed",
    terminalAt: "2026-09-12T00:00:00.000Z", evidenceRef: "browser-mutation:submit",
    evidenceHash: `sha256:${"5".repeat(64)}`,
  }, submitIdentity, "https://chatgpt.com/c/mismatch", "conversation-turn-1");
  assert.equal(await mismatchLifecycle.yieldForProviderProbe(
    mismatchActive, "corpus_research", "text-wait", "checkpoint_gpt_text_response",
    "https://chatgpt.com/c/mismatch", Date.now() + 1_000,
  ), "reobserve");
  assert.equal(mismatchActive.browser.target.targetRef, "target:provider-wait:mismatched",
    "confirmed readback must accept a replacement system Target");
  assert.equal(selections, 1,
    "the canonical conversation URL, not historical Target identity, must locate readback");
  await mismatchLifecycle.settle(null);

  let recoveryTargetMode: string | undefined;
  const recoveryLifecycle = new ProductionGptBrowserLifecycle(
    {
      acquireJobBoundTargetLease: async (_binding: unknown, _ownerId: unknown, wait: Readonly<{
        targetMode: string;
      }>) => {
        recoveryTargetMode = wait.targetMode;
        return {
          target: { targetRef: "target:confirmed-submit" },
          pendingMutationCount: () => 0,
          park: async () => undefined,
          close: async () => undefined,
        };
      },
    } as never,
    runtimeLogger,
    HASH_A,
    {
      jobId: waitTask.job_id, attemptId: "attempt:confirmed-submit-recovery",
      resultRevision: 0,
      deviceId: "device:1", leaseVersion: 1,
      executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
      expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
      abortSignal: new AbortController().signal,
    },
  );
  await recoveryLifecycle.browserFor(
    "session:confirmed-submit-recovery", "observe", "turn-submit", "confirmed-readback",
  );
  assert.equal(recoveryTargetMode, "confirmed-readback",
    "confirmed-submit recovery must acquire the current system Target without a root reset");
  await recoveryLifecycle.settle(null);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
