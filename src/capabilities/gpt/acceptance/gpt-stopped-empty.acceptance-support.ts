import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import {
  advanceStoppedEmptyWindow,
  GPT_STOPPED_EMPTY_CONFIRMATION_MS,
} from "../children/checkpoint_gpt_text_response/handler.js";
import { throwGptChildFailure } from "../production-child-support.js";
import { serializeTerminalFailureTransport } from
  "../../../lib/local-runtime/production/terminal-failure.js";
import type { GptChildCapabilityResult } from "../contract.js";

const stoppedEmptyObservation = (input: Readonly<{
  generatingRaw?: number;
  semanticText?: string;
  observedAt?: string;
  identityHash?: `sha256:${string}`;
}> = {}) => ({
  generatingRaw: input.generatingRaw ?? 0,
  semanticText: input.semanticText ?? "",
  observedAt: input.observedAt ?? "2026-09-16T00:00:00.000Z",
  identityHash: input.identityHash ?? `sha256:${"a".repeat(64)}` as `sha256:${string}`,
});

const verifyStoppedEmptyWindow = (): void => {
  const emptyWindow = advanceStoppedEmptyWindow(null, stoppedEmptyObservation(), 10_000);
  assert.deepEqual(emptyWindow, { window: {
    sinceMonotonicMs: 10_000,
    firstObservedAt: "2026-09-16T00:00:00.000Z",
    observationCount: 1,
    identityHash: `sha256:${"a".repeat(64)}`,
  }, confirmed: false });
  assert.equal(advanceStoppedEmptyWindow(
    emptyWindow.window, stoppedEmptyObservation({ observedAt: "2026-09-16T00:19:59.999Z" }),
    10_000 + GPT_STOPPED_EMPTY_CONFIRMATION_MS - 1,
  ).confirmed, false);
  const confirmed = advanceStoppedEmptyWindow(
    emptyWindow.window, stoppedEmptyObservation({ observedAt: "2026-09-16T00:20:00.000Z" }),
    10_000 + GPT_STOPPED_EMPTY_CONFIRMATION_MS,
  );
  assert.equal(confirmed.confirmed, true);
  assert.equal(confirmed.window?.observationCount, 2);
  assert.deepEqual(advanceStoppedEmptyWindow(
    emptyWindow.window, stoppedEmptyObservation({ generatingRaw: 1 }),
    10_000 + GPT_STOPPED_EMPTY_CONFIRMATION_MS,
  ), { window: null, confirmed: false });
  assert.deepEqual(advanceStoppedEmptyWindow(
    emptyWindow.window, stoppedEmptyObservation({ semanticText: "answer" }),
    10_000 + GPT_STOPPED_EMPTY_CONFIRMATION_MS,
  ), { window: null, confirmed: false });
  const identityReset = advanceStoppedEmptyWindow(
    emptyWindow.window, stoppedEmptyObservation({
      observedAt: "2026-09-16T00:20:00.000Z",
      identityHash: `sha256:${"b".repeat(64)}`,
    }),
    10_000 + GPT_STOPPED_EMPTY_CONFIRMATION_MS,
  );
  assert.equal(identityReset.confirmed, false);
  assert.equal(identityReset.window?.sinceMonotonicMs, 10_000 + GPT_STOPPED_EMPTY_CONFIRMATION_MS);
  assert.equal(identityReset.window?.observationCount, 1);
};

const verifyStoppedEmptyTransport = (): void => {
  const terminalRevision = `sha256:${"c".repeat(64)}` as const;
  const stoppedEmptyProof = Object.freeze({
    firstObservedAt: "2026-09-16T00:00:00.000Z",
    terminalObservedAt: "2026-09-16T00:20:00.000Z",
    continuousMonotonicMs: GPT_STOPPED_EMPTY_CONFIRMATION_MS,
    observationCount: 16,
    identityHash: `sha256:${"a".repeat(64)}` as const,
    terminalObservationRevisionHash: terminalRevision,
  });
  let transported: unknown = null;
  try {
    throwGptChildFailure({
      status: "failed", value: null, failureCode: "GPT_RESPONSE_STOPPED_EMPTY",
      failureCause: null, failureBrowserEffect: null, reasoningRequirementResult: null,
      proof: {
        schemaVersion: "gpt-child-capability-proof.v2",
        childCapabilityId: "checkpoint_gpt_text_response", childContractVersion: 6,
        childStatus: "failed", childReasonCode: "GPT_RESPONSE_STOPPED_EMPTY",
        exactCallIdentityHash: `sha256:${"1".repeat(64)}`, internalDecisionCode: "FAIL_CLOSED",
        executionId: "execution:stopped-empty", jobId: "job:stopped-empty",
        attemptId: "attempt:stopped-empty", resultRevision: 0,
        productStepId: "step:stopped-empty", callId: "call:stopped-empty",
        inputHash: `sha256:${"2".repeat(64)}`, actionOrdinal: 1,
        authorityRefHashes: [`sha256:${"3".repeat(64)}`],
        factResultIds: ["gpt-assistant-turn-fact:stopped-empty"],
        candidateCardinality: { raw: 1, eligible: 1 }, observationRevisionHash: terminalRevision,
        committedMutation: "no", postconditionResult: "failed", browserFact: null,
        nativeFailureCode: "GPT_RESPONSE_STOPPED_EMPTY", stoppedEmptyProof,
        startedAt: "2026-09-16T00:00:00.000Z", endedAt: "2026-09-16T00:20:00.000Z",
        evidenceRef: "gpt-child-proof:stopped-empty", evidenceHash: `sha256:${"4".repeat(64)}`,
      },
    } satisfies GptChildCapabilityResult<"checkpoint_gpt_text_response">,
    undefined, undefined, {
      exactCallIdentityHash: `sha256:${"5".repeat(64)}`,
      providerEffectIdentityHash: `sha256:${"6".repeat(64)}`,
      childCapabilityId: "submit_exact_gpt_turn_once", effectScope: "provider_effect",
      browserOutcome: "CONFIRMED", mutationOutcome: "confirmed",
      terminalAt: "2026-09-15T23:59:00.000Z", evidenceRef: "browser-mutation:submit",
      evidenceHash: `sha256:${"7".repeat(64)}`,
    });
  } catch (error) { transported = serializeTerminalFailureTransport(error); }
  assert.equal(Reflect.get(transported as object, "evidence_ref"), "browser-mutation:submit");
  assert.equal(Reflect.get(transported as object, "evidence_hash"), `sha256:${"7".repeat(64)}`);
  assert.equal(Reflect.get(transported as object, "child_proof_ref"), "gpt-child-proof:stopped-empty");
  assert.equal(Reflect.get(transported as object, "child_proof_hash"), `sha256:${"4".repeat(64)}`);
  assert.deepEqual(Reflect.get(transported as object, "stopped_empty_proof"), {
    first_observed_at: stoppedEmptyProof.firstObservedAt,
    terminal_observed_at: stoppedEmptyProof.terminalObservedAt,
    continuous_monotonic_ms: stoppedEmptyProof.continuousMonotonicMs,
    observation_count: stoppedEmptyProof.observationCount,
    identity_hash: stoppedEmptyProof.identityHash,
    terminal_observation_revision_hash: terminalRevision,
  });
  assert.equal(Reflect.get(transported as object, "provider_effect_identity_hash"),
    `sha256:${"6".repeat(64)}`);
};

export const verifyStoppedEmptyRecoveryContract = (): void => {
  verifyStoppedEmptyWindow();
  verifyStoppedEmptyTransport();
};
