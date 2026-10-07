import { governanceAssert as assert } from
  "../../../../scripts/audit/shared/governance-exam-assert.js";

import type { GptChildCapabilityResult } from "../contract.js";
import { ProductionGptChildTools } from "../production-child-tools.js";
import { createGptAbilityGroup } from "../ability-group.js";
import type { GptProductionExecutionInput } from "../production-ports.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executionFailure } from "../../../lib/execution-failure.js";
import {
  serializeTerminalFailure,
  serializeTerminalFailureTransport,
} from "../../../lib/local-runtime/production/terminal-failure.js";
import { throwGptChildFailure } from "../production-child-support.js";

const exerciseRealEarlyFailures = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), "gpt-early-failure-"));
  try {
    const hash = `sha256:${"a".repeat(64)}` as const;
    const logger = createRuntimeLogger({ producer: "gpt-early-failure", owner: "gpt", component: "gpt-child",
      terminalEnabled: false, fileSink: { directoryPath: directory } });
    const input: GptProductionExecutionInput = { jobId: "job:early", attemptId: "attempt:early", resultRevision: 0,
      productId: "payment_screenshot_observation", ownerRef: "owner", subjectRef: "subject", authorizationRef: "authorization",
      deviceId: "device", leaseVersion: 1, executionFenceHash: hash, capabilityManifestHash: hash,
      expiresAtMonotonic: performance.now() + 30_000, commandTtlMs: 10_000, maxProviderTurns: 1,
      abortSignal: new AbortController().signal, parentSpanId: "parent:early" };
    let artifacts = 0, observations = 0;
    let acquisitionError: unknown = executionFailure("failed", "BROWSER_JOB_TARGET_ACQUISITION_TIMEOUT");
    const evidence = { appendArtifact: async () => { artifacts += 1; throw new Error("UNEXPECTED_FAILURE_ARTIFACT"); } };
    const tools = new ProductionGptChildTools(directory, hash, createGptAbilityGroup(), evidence as never, {
      acquireJobBoundTargetLease: async () => { throw acquisitionError; },
    } as never, logger, { assertProviderSubmitAllowed: () => undefined } as never);
    const execution = tools.createExecution(input);
    await assert.rejects(execution.tools.execute({ sessionKey: "session:early", productStepId: "observe",
      callId: "profile-open", child: "open_gpt_execution_profile", actionOrdinal: 1, input: { profile: {} as never } }),
    (error: unknown) => {
      const fact = serializeTerminalFailureTransport(error);
      assert.deepEqual([fact.code, fact.child_capability_id, fact.effect_scope, fact.browser_outcome, fact.evidence_ref],
        ["BROWSER_JOB_TARGET_ACQUISITION_TIMEOUT", null, null, null, null]);
      return true;
    });
    const cleanup = new Error("cleanup failure"), native = Object.assign(new Error("CHROME_DEBUGGER_TARGET_CLOSED"), { code: "CHROME_DEBUGGER_TARGET_CLOSED" });
    acquisitionError = new AggregateError([cleanup], "GPT_BROWSER_LIFECYCLE_FAILED", {
      cause: executionFailure("failed", "BROWSER_TARGET_INVALID", { cause: native }),
    });
    await assert.rejects(execution.tools.execute({ sessionKey: "session:aggregate", productStepId: "observe",
      callId: "profile-aggregate", child: "open_gpt_execution_profile", actionOrdinal: 2, input: { profile: {} as never } }),
    (error: unknown) => {
      assert(error instanceof AggregateError);
      assert.equal(error.errors[0], cleanup);
      const fact = serializeTerminalFailureTransport(error);
      assert.deepEqual([fact.code, fact.child_capability_id, fact.effect_scope], ["BROWSER_TARGET_INVALID", null, null]);
      assert.deepEqual(fact.cause, { name: "Error", code: "CHROME_DEBUGGER_TARGET_CLOSED" });
      return true;
    });
    const facade = { readAtomicStepOutcome: () => null, pendingMutationCount: () => 0,
      runAtomicStep: async (_identity: unknown, run: () => Promise<unknown>) => run(),
      executeDomIntent: async () => { observations += 1; throw executionFailure("failed", "BROWSER_TARGET_INVALID"); } };
    const browsers = { browserFor: async () => ({ facade, confirmedProviderEffect: null }) };
    await assert.rejects(Reflect.get(tools, "executeOne").call(tools, input, browsers, {
      sessionKey: "session:observation", productStepId: "observe", callId: "attachment-set",
      child: "reconcile_gpt_attachment_set", actionOrdinal: 1, input: { files: [], timeoutMs: 1_500 },
    }) as Promise<unknown>, (error: unknown) => {
      const fact = serializeTerminalFailureTransport(error);
      assert.deepEqual([fact.code, fact.child_capability_id, fact.effect_scope, fact.browser_outcome],
        ["BROWSER_TARGET_INVALID", null, null, null]);
      assert.ok(!fact.evidence_ref?.startsWith("browser-mutation:"));
      return true;
    });
    assert.equal(observations, 1, "the real observation Child reached its Browser port");
    assert.equal(artifacts, 0, "early failures cannot persist a fabricated answer or Browser proof");
    const events = (await readFile(logger.currentSegmentPath()!, "utf8")).trim().split("\n").map(line => JSON.parse(line));
    const starts = events.filter(event => event.kind === "span.started");
    assert.ok(starts.every(start => events.some(event => event.kind === "span.terminal" && event.spanId === start.spanId)));
    const identities = starts.map(event => event.typedIdentity);
    assert.deepEqual(identities.map(identity => [identity.kind, identity.jobId, identity.attemptId, identity.stepId,
      identity.capabilityCallId]), ["profile-open:open_gpt_execution_profile", "profile-aggregate:open_gpt_execution_profile",
      "attachment-set:reconcile_gpt_attachment_set"].map(call => ["gpt-call", "job:early", "attempt:early", "observe", call]));
  } finally { await rm(directory, { recursive: true, force: true }); }
};

export const exercisePreExecutionFailureEvidence = async (): Promise<void> => {
  await exerciseRealEarlyFailures();
  const failure = serializeTerminalFailure(executionFailure(
    "failed", "BROWSER_RECONCILIATION_SCOPE_INVALID",
  ));
  assert.equal(failure.code, "BROWSER_RECONCILIATION_SCOPE_INVALID");
  assert.equal(failure.mutation_outcome, "no");
  assert.equal(failure.child_capability_id, null);
  const providerEffectIdentityHash = `sha256:${"8".repeat(64)}` as const;
  let postSubmitFailure: unknown = null;
  try {
    throwGptChildFailure({
      failureCode: "GPT_RESPONSE_TIMEOUT", failureCause: null, failureBrowserEffect: null,
      proof: { childCapabilityId: "checkpoint_gpt_text_response", committedMutation: "no", browserFact: null,
        evidenceRef: "gpt-child-proof:checkpoint", evidenceHash: `sha256:${"7".repeat(64)}` },
    } as GptChildCapabilityResult, undefined, undefined, {
      exactCallIdentityHash: `sha256:${"6".repeat(64)}`,
      providerEffectIdentityHash, childCapabilityId: "submit_exact_gpt_turn_once",
      effectScope: "provider_effect", browserOutcome: "CONFIRMED", mutationOutcome: "confirmed",
      terminalAt: "2026-09-12T00:00:00.000Z", evidenceRef: "browser-mutation:submit",
      evidenceHash: `sha256:${"5".repeat(64)}`,
    });
  } catch (error) { postSubmitFailure = error; }
  assert.equal(serializeTerminalFailureTransport(postSubmitFailure).child_capability_id, "submit_exact_gpt_turn_once");
  assert.equal(serializeTerminalFailureTransport(postSubmitFailure).provider_effect_identity_hash,
    providerEffectIdentityHash, "a post-submit checkpoint failure must retain the confirmed effect identity");
};
