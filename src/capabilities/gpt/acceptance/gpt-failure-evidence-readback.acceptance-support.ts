import { createHash } from "node:crypto";
import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import type {
  GptChildCapabilityId,
  GptChildCapabilityIntent,
  GptChildCapabilityResult,
  GptChildInputMap,
} from "../contract.js";
import { isPendingExactEvidence, readExactGptEvidenceFact } from "../evidence-fact.js";
import { typedGptExecutionFailure } from "../execution-fault.js";
import { persistGptChildEvidence } from "../evidence-writer.js";
import { executeProductionGptAtomicCall } from "../production-atomic-call.js";
import type { GptEvidenceStorePort } from "../production-ports.js";
import { serializeTerminalFailure } from "../../../lib/local-runtime/production/terminal-failure.js";
import { throwGptChildFailure } from "../production-child-support.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";
import { coherentObservationPacket, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

type StoredEvidence = Readonly<{ recordRef: string; record: Readonly<Record<string, unknown>> }>;
const evidenceHarness = () => {
  let stored: StoredEvidence | null = null;
  const evidenceStore: GptEvidenceStorePort = {
    appendRecord: async (input) => {
      const recordRef = "record:gpt-failed-readback";
      stored = Object.freeze({ recordRef, record: Object.freeze({
        missionId: input.missionId, runId: input.runId, stepId: input.stepId,
        sourceAbilityGroupId: input.sourceCapabilityId,
        sourceChildCapabilityId: input.sourceChildCapabilityId,
        idempotencyKey: input.idempotencyKey, payload: input.recordPayload,
        artifactRefs: Object.freeze([...(input.artifactRefs ?? [])]),
      }) });
      return { status: "success", recordRef };
    },
    appendArtifact: async () => ({ status: "failed" }),
    readRecordRef: async (input) => stored?.recordRef === input.recordRef
      ? { status: "success", recordRef: stored.recordRef, record: stored.record }
      : { status: "failed" },
    readArtifactRef: async () => ({ status: "failed" }),
    readExactCallEvidence: async () => stored,
  };
  return Object.freeze({ evidenceStore, stored: () => stored });
};

const intentFor = <K extends GptChildCapabilityId>(
  result: GptChildCapabilityResult<K>,
  input: GptChildInputMap[K],
): GptChildCapabilityIntent<K> => {
  const proof = result.proof;
  return Object.freeze({
    childCapabilityId: proof.childCapabilityId as K, executionId: proof.executionId,
    jobId: proof.jobId, attemptId: proof.attemptId, pluginId: proof.pluginId,
    pluginVersion: proof.pluginVersion, productStepId: proof.productStepId,
    callId: proof.callId, inputHash: proof.inputHash, actionOrdinal: proof.actionOrdinal,
    input,
  }) as GptChildCapabilityIntent<K>;
};

export const exerciseFailedEvidenceReadback = async <K extends GptChildCapabilityId>(
  result: GptChildCapabilityResult<K>,
  input: GptChildInputMap[K],
  expectedFailure: ReturnType<typeof serializeTerminalFailure>,
): Promise<void> => {
  const { evidenceStore } = evidenceHarness();
  const proof = result.proof;
  const intent = intentFor(result, input);
  await persistGptChildEvidence({
    result, intent, evidenceStore, jobId: proof.jobId, attemptId: proof.attemptId,
    stepId: proof.productStepId, exactCallIdentityHash: proof.exactCallIdentityHash,
  });
  let replayedFailure: unknown = null;
  try {
    await readExactGptEvidenceFact({
      evidenceStore, intent, exactCallIdentityHash: proof.exactCallIdentityHash,
    });
  } catch (error) { replayedFailure = error; }
  const typed = typedGptExecutionFailure(replayedFailure);
  assert.deepEqual(serializeTerminalFailure(replayedFailure), expectedFailure);
  assert.deepEqual(typed?.proofFacts?.browserFact, result.proof.browserFact);
  assert.deepEqual(typed?.proofFacts?.candidateCardinality, result.proof.candidateCardinality);
  assert.deepEqual(typed?.proofFacts?.factResultIds, result.proof.factResultIds);
};

export const exerciseBrowserRejectedEvidenceReadback = async (): Promise<void> => {
  const { execute } = createGptAcceptanceHarness("gpt-browser-rejected-evidence");
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      composer: Object.freeze({
        rawCount: 1,
        eligibleCount: 1,
        matches: Object.freeze([{ semanticTextHash: hash("stale draft") }]),
      }),
    });
    if (intent.kind === "fill") return {
      filled: true, mutationCount: 1, retainedValueVerified: false, postconditionVerified: false,
      failureCode: "BROWSER_POSTCONDITION_FAILED",
      nativeCauseCode: "BROWSER_FILL_RETAINED_VALUE_MISMATCH",
    };
    throw new Error(`UNEXPECTED_REJECTED_CLEAN_CHAT_INTENT:${intent.kind}`);
  });
  const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 1_000 });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "BROWSER_POSTCONDITION_FAILED");
  assert.equal(result.failureCause?.code, "BROWSER_FILL_RETAINED_VALUE_MISMATCH");
  assert.equal(result.proof.committedMutation, "confirmed");
  assert.equal(result.proof.browserFact?.browserOutcome, "REJECTED");
  assert.equal(result.proof.browserFact?.evidenceRef, "browser-mutation:acceptance-call");
  assert.equal(result.proof.browserFact?.evidenceHash, `sha256:${"9".repeat(64)}`);
  assert.equal(fixture.physicalMutations(), 1);
  let serialized: ReturnType<typeof serializeTerminalFailure> | null = null;
  try { throwGptChildFailure(result); }
  catch (error) { serialized = serializeTerminalFailure(error); }
  assert.deepEqual(serialized, {
    code: "BROWSER_POSTCONDITION_FAILED",
    mutation_outcome: "confirmed",
    effect_scope: "target_local",
    child_capability_id: "prepare_clean_gpt_chat",
    browser_outcome: "REJECTED",
    evidence_ref: "browser-mutation:acceptance-call",
    evidence_hash: `sha256:${"9".repeat(64)}`,
    cause: { name: "Error", code: "BROWSER_FILL_RETAINED_VALUE_MISMATCH" },
  });
  const intent = intentFor<"prepare_clean_gpt_chat">(
    result, Object.freeze({ timeoutMs: 1_000 }),
  );
  const recovered = await executeProductionGptAtomicCall({
    dataDir: "/tmp/gpt-rejected-wal-readback",
    gpt: Object.freeze({
      abilityGroupId: "gpt" as const,
      transport: "gpt-web" as const,
      listChildCapabilityIds: () => Object.freeze(["prepare_clean_gpt_chat" as const]),
      execute: async () => { throw new Error("REJECTED_WAL_MUST_NOT_REPLAY_GPT"); },
    }),
    store: {} as never,
    browsers: {} as never,
    intent,
    browserCall: { browser: fixture.browser, facade: fixture.browser, providerWaitLog: null },
    signal: new AbortController().signal,
  });
  assert.equal(recovered.result.failureCode, "BROWSER_POSTCONDITION_FAILED");
  assert.equal(recovered.result.proof.nativeFailureCode, "BROWSER_FILL_RETAINED_VALUE_MISMATCH");
  let recoveredFailure: unknown = null;
  try { throwGptChildFailure(recovered.result); }
  catch (error) { recoveredFailure = error; }
  assert.deepEqual(serializeTerminalFailure(recoveredFailure), serialized,
    "a rejected Browser WAL readback must preserve the exact outer and native failure tuple");
  await exerciseFailedEvidenceReadback(result, Object.freeze({ timeoutMs: 1_000 }), serialized!);
};

export const exerciseBrowserRejectedDispatchedEvidenceReadback = async (): Promise<void> => {
  const { execute } = createGptAcceptanceHarness("gpt-browser-rejected-dispatched-evidence");
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      composer: Object.freeze({
        rawCount: 1,
        eligibleCount: 1,
        matches: Object.freeze([{ semanticTextHash: hash("stale draft") }]),
      }),
    });
    if (intent.kind === "fill") return {
      mutationCount: 1,
      terminalRejectedDispatched: true,
      failureCode: "BROWSER_CAPABILITY_REJECTED",
    };
    throw new Error(`UNEXPECTED_REJECTED_DISPATCHED_INTENT:${intent.kind}`);
  });
  const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 1_000 });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "BROWSER_CAPABILITY_REJECTED");
  assert.equal(result.proof.committedMutation, "dispatched");
  assert.equal(result.proof.browserFact?.browserOutcome, "REJECTED");
  assert.equal(result.proof.browserFact?.mutationOutcome, "dispatched");
  assert.equal(result.proof.browserFact?.evidenceRef, "browser-mutation:acceptance-call");
  assert.equal(fixture.physicalMutations(), 1);
  let serialized: ReturnType<typeof serializeTerminalFailure> | null = null;
  try { throwGptChildFailure(result); }
  catch (error) { serialized = serializeTerminalFailure(error); }
  assert.deepEqual(serialized, {
    code: "BROWSER_CAPABILITY_REJECTED",
    mutation_outcome: "dispatched",
    effect_scope: "target_local",
    child_capability_id: "prepare_clean_gpt_chat",
    browser_outcome: "REJECTED",
    evidence_ref: "browser-mutation:acceptance-call",
    evidence_hash: `sha256:${"9".repeat(64)}`,
    cause: { name: "Error", code: null },
  });
  const intent = intentFor<"prepare_clean_gpt_chat">(
    result, Object.freeze({ timeoutMs: 1_000 }),
  );
  const recovered = await executeProductionGptAtomicCall({
    dataDir: "/tmp/gpt-rejected-dispatched-wal-readback",
    gpt: Object.freeze({
      abilityGroupId: "gpt" as const,
      transport: "gpt-web" as const,
      listChildCapabilityIds: () => Object.freeze(["prepare_clean_gpt_chat" as const]),
      execute: async () => { throw new Error("REJECTED_DISPATCHED_WAL_MUST_NOT_REPLAY_GPT"); },
    }),
    store: {} as never,
    browsers: {} as never,
    intent,
    browserCall: { browser: fixture.browser, facade: fixture.browser, providerWaitLog: null },
    signal: new AbortController().signal,
  });
  assert.equal(recovered.result.failureCode, "BROWSER_CAPABILITY_REJECTED");
  assert.equal(recovered.result.proof.committedMutation, "dispatched");
  assert.equal(recovered.result.proof.browserFact?.browserOutcome, "REJECTED");
  let recoveredFailure: unknown = null;
  try { throwGptChildFailure(recovered.result); }
  catch (error) { recoveredFailure = error; }
  assert.deepEqual(serializeTerminalFailure(recoveredFailure), serialized,
    "a rejected+dispatched Browser WAL readback must preserve the terminal tuple without replay");
  await exerciseFailedEvidenceReadback(result, Object.freeze({ timeoutMs: 1_000 }), serialized!);
};

export const exerciseBrowserDispatchedEvidenceReadback = async (): Promise<void> => {
  const { execute } = createGptAcceptanceHarness("gpt-browser-dispatched-evidence");
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      composer: Object.freeze({ rawCount: 1, eligibleCount: 1,
        matches: Object.freeze([{ semanticTextHash: hash("stale draft") }]) }),
    });
    if (intent.kind === "fill") return { mutationCount: 1, receiptMissing: true };
    throw new Error(`UNEXPECTED_DISPATCHED_CLEAN_CHAT_INTENT:${intent.kind}`);
  });
  const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 1_000 });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "BROWSER_COMMAND_RECEIPT_MISSING");
  assert.equal(result.proof.committedMutation, "dispatched");
  assert.equal(result.proof.postconditionResult, "pending");
  assert.equal(result.proof.browserFact?.browserOutcome, "DISPATCHED");
  assert.equal(result.proof.browserFact?.mutationOutcome, "dispatched");
  assert.equal(result.proof.browserFact?.evidenceRef, "browser-mutation:acceptance-call");
  const intent = intentFor<"prepare_clean_gpt_chat">(
    result, Object.freeze({ timeoutMs: 1_000 }),
  );
  const persistence = evidenceHarness();
  await persistGptChildEvidence({
    result, intent, evidenceStore: persistence.evidenceStore,
    jobId: result.proof.jobId, attemptId: result.proof.attemptId,
    stepId: result.proof.productStepId, exactCallIdentityHash: result.proof.exactCallIdentityHash,
  });
  const pending = await readExactGptEvidenceFact({
    evidenceStore: persistence.evidenceStore,
    intent,
    exactCallIdentityHash: result.proof.exactCallIdentityHash,
  });
  assert.equal(isPendingExactEvidence(pending), true);
  const payload = persistence.stored()?.record.payload as Readonly<Record<string, unknown>>;
  const failureProof = payload.failure_proof as Readonly<Record<string, unknown>>;
  assert.deepEqual(failureProof.browser_fact, {
    exact_call_identity_hash: result.proof.exactCallIdentityHash,
    child_capability_id: "prepare_clean_gpt_chat",
    effect_scope: "target_local",
    browser_outcome: "DISPATCHED",
    mutation_outcome: "dispatched",
    terminal_at: null,
    evidence_ref: "browser-mutation:acceptance-call",
    evidence_hash: `sha256:${"9".repeat(64)}`,
  });

  const readback = Object.freeze({
    ...result,
    proof: Object.freeze({
      ...result.proof,
      childReasonCode: "GPT_CHAT_DRAFT_CLEAR_FAILED",
      committedMutation: "no" as const,
      postconditionResult: "failed" as const,
      browserFact: null,
      nativeFailureCode: "GPT_CHAT_ATTACHMENT_PRESENT",
    }),
    failureCode: "GPT_CHAT_DRAFT_CLEAR_FAILED",
    failureCause: Object.freeze({ name: "Error", code: "GPT_CHAT_ATTACHMENT_PRESENT" }),
    failureBrowserEffect: null,
  }) as GptChildCapabilityResult<"prepare_clean_gpt_chat">;
  const atomic = await executeProductionGptAtomicCall({
    dataDir: "/tmp/gpt-dispatched-readback",
    gpt: Object.freeze({
      abilityGroupId: "gpt" as const,
      transport: "gpt-web" as const,
      listChildCapabilityIds: () => Object.freeze(["prepare_clean_gpt_chat" as const]),
      execute: async () => readback as never,
    }),
    store: {} as never,
    browsers: {} as never,
    intent,
    browserCall: { browser: fixture.browser, facade: fixture.browser, providerWaitLog: null },
    signal: new AbortController().signal,
  });
  assert.equal(atomic.result.proof.browserFact?.browserOutcome, "DISPATCHED");
  assert.equal(atomic.result.proof.postconditionResult, "pending");
  let replayed: unknown = null;
  try { throwGptChildFailure(atomic.result); }
  catch (error) { replayed = error; }
  assert.deepEqual(serializeTerminalFailure(replayed), {
    code: "GPT_CHAT_DRAFT_CLEAR_FAILED",
    mutation_outcome: "dispatched",
    effect_scope: "target_local",
    child_capability_id: "prepare_clean_gpt_chat",
    browser_outcome: "DISPATCHED",
    evidence_ref: "browser-mutation:acceptance-call",
    evidence_hash: `sha256:${"9".repeat(64)}`,
    cause: { name: "Error", code: "GPT_CHAT_ATTACHMENT_PRESENT" },
  });
};
