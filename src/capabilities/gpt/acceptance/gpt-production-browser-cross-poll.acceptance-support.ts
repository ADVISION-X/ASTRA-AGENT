import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProductionGptBrowserLifecycle } from "../production-browser-lifecycle.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { HASH_A, HASH_B } from "../../../../scripts/acceptance/agent-production-runtime-fixtures.js";

const temporary = await mkdtemp(path.join(tmpdir(), "agent-provider-conversation-acceptance-"));
try {
  const nativeDateNow = Date.now;
  let deadlineNow = 0;
  let deadlineAcquisitions = 0;
  let deadlineSelections = 0;
  Date.now = () => deadlineNow;
  try {
    const deadlineLifecycle = new ProductionGptBrowserLifecycle(
      {
        acquireJobBoundTargetLease: async () => {
          deadlineAcquisitions += 1;
          if (deadlineAcquisitions === 2) deadlineNow = 100;
          return {
            target: { targetRef: "target:deadline-race" },
            document: { documentRef: `document:deadline-race:${deadlineAcquisitions}` },
            pendingMutationCount: () => 0,
            requiresMutationRecovery: () => false,
            readAtomicStepOutcome: () => ({
              state: "confirmed", mutationOutcome: "confirmed",
              providerEffectIdentityHash: `sha256:${"8".repeat(64)}`,
              terminalPayload: {
                canonicalConversationUrl: "https://chatgpt.com/c/deadline",
                userTurnId: "conversation-turn-1",
              },
            }),
            executeDomIntent: async () => { deadlineSelections += 1; },
            park: async () => undefined,
            close: async () => undefined,
          };
        },
      } as never,
      createRuntimeLogger({
        producer: "agent-provider-deadline-acceptance", owner: "production-runtime",
        component: "gpt-child", terminalEnabled: false,
        fileSink: { directoryPath: path.join(temporary, "deadline-runtime-logs") },
      }),
      HASH_A,
      {
        jobId: "job:provider-deadline", attemptId: "attempt:provider-deadline",
        resultRevision: 0,
        deviceId: "device:1", leaseVersion: 1,
        executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
        expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
        abortSignal: new AbortController().signal,
      },
    );
    const deadlineActive = await deadlineLifecycle.browserFor(
      "session:provider-deadline", "corpus_research", "deadline-wait",
    );
    deadlineLifecycle.recordConfirmedProviderEffect(deadlineActive, {
      exactCallIdentityHash: `sha256:${"6".repeat(64)}`,
      providerEffectIdentityHash: `sha256:${"8".repeat(64)}`,
      childCapabilityId: "submit_exact_gpt_turn_once", effectScope: "provider_effect",
      browserOutcome: "CONFIRMED", mutationOutcome: "confirmed",
      terminalAt: "2026-09-12T00:00:00.000Z", evidenceRef: "browser-mutation:submit",
      evidenceHash: `sha256:${"5".repeat(64)}`,
    }, {
      resultRevision: 0, productStepId: "corpus_research", callId: "turn-submit",
      childCapabilityId: "submit_exact_gpt_turn_once", inputHash: HASH_A,
      actionOrdinal: 1, replayPolicy: "provider-effect-once",
    }, "https://chatgpt.com/c/deadline", "conversation-turn-1");
    assert.equal(await deadlineLifecycle.yieldForProviderProbe(
      deadlineActive, "corpus_research", "deadline-wait", "checkpoint_gpt_text_response",
      "https://chatgpt.com/c/deadline", 100,
    ), "deadline");
    assert.equal(deadlineSelections, 0,
      "a Product deadline reached during Browser acquisition must stop before touching the page");
    await deadlineLifecycle.settle(null);
  } finally {
    Date.now = nativeDateNow;
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
