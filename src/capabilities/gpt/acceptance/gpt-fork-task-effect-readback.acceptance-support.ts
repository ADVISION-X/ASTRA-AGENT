import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { failureCode } from "../../../lib/execution-failure.js";
import { readCompletedGptChildResult } from "../completed-result.js";
import type { GptEvidenceStorePort } from "../production-ports.js";
import type { ExactGptCallFacts, ProductGptCallInput } from "../product-api.js";

type Hash = `sha256:${string}`;
type Fixture = Readonly<{
  call: ProductGptCallInput<"fork_exact_gpt_conversation_at_checkpoint">;
  evidence: NonNullable<ExactGptCallFacts["evidence"]>;
  facts(overrides?: Partial<ExactGptCallFacts>): ExactGptCallFacts;
  relation: Readonly<Record<string, unknown>>;
  store: GptEvidenceStorePort;
  success: { count: number };
}>;

const createForkFixture = async (store: GptEvidenceStorePort, hash: (value: string) => Hash): Promise<Fixture> => {
  const hashA = hash("a");
  const hashB = hash("b");
  const call: ProductGptCallInput<"fork_exact_gpt_conversation_at_checkpoint"> = Object.freeze({
    child: "fork_exact_gpt_conversation_at_checkpoint", productStepId: "fork-task-effect-readback",
    callId: "fork-call", actionOrdinal: 7,
    input: Object.freeze({
      sourceAssistantTurnId: "conversation-turn-2", sourceCanonicalConversationUrl: "https://chatgpt.com/c/fork-source",
      sourcePromptHash: hashA, sourceResponseHash: hashB,
      sourceTurnMarker: "[GRASSEYE:fork-task-effect-readback]", timeoutMs: 1_000,
    }),
  });
  const childUrl = "https://chatgpt.com/c/fork-child";
  const relation = Object.freeze({
    schemaVersion: "agent-gpt-fork-relation-artifact.v1",
    sourceCanonicalConversationUrl: call.input.sourceCanonicalConversationUrl,
    sourceAssistantTurnId: call.input.sourceAssistantTurnId,
    childCanonicalConversationUrl: childUrl,
    sourceToChildRelationHash: hash([
      call.input.sourceCanonicalConversationUrl, call.input.sourceTurnMarker, call.input.sourcePromptHash,
      call.input.sourceAssistantTurnId, call.input.sourceResponseHash, childUrl,
    ].join("\n")),
  });
  const persisted = await store.appendArtifact({
    missionId: "job:gpt-native-checkpoint-readback", runId: "attempt:gpt-native-checkpoint-readback",
    idempotencyKey: "fork-task-effect-valid", artifactType: "other", mimeType: "application/json",
    content: JSON.stringify(relation),
  });
  const artifactRef = persisted.status === "success" ? persisted.artifactRef : undefined;
  if (!artifactRef) throw new Error("FORK_TASK_EFFECT_ARTIFACT_SETUP_FAILED");
  const evidence = Object.freeze({
    owner: "forensics-persistence" as const, evidenceRef: "record:fork-task-effect",
    evidenceHash: hash("fork-task-effect-evidence"), readbackVerified: true as const,
    artifactRefs: Object.freeze([artifactRef]),
  });
  const mutation = Object.freeze({
    owner: "browser" as const, sourceAttemptId: "attempt:prior-fork", effectScope: "provider_effect" as const,
    outcome: "CONFIRMED" as const, terminalAt: "2026-09-05T00:00:00.000Z",
    productStepId: call.productStepId, callId: call.callId, childCapabilityId: call.child,
    actionOrdinal: call.actionOrdinal,
  });
  const facts = (overrides: Partial<ExactGptCallFacts> = {}): ExactGptCallFacts => Object.freeze({
    exactCallIdentityHash: hash("fork-task-effect-identity"), mutation, evidence, continuation: null, ...overrides,
  });
  return Object.freeze({ call, evidence, facts, relation, store, success: { count: 0 } });
};

const exerciseValidFork = async (fixture: Fixture): Promise<void> => {
  const completed = await readCompletedGptChildResult({
    call: fixture.call, facts: fixture.facts(), evidenceStore: fixture.store,
    onSuccess: () => { fixture.success.count += 1; },
  });
  assert.equal((completed?.value as Readonly<{ childCanonicalConversationUrl: string }> | undefined)
    ?.childCanonicalConversationUrl, "https://chatgpt.com/c/fork-child");
  assert.equal(fixture.success.count, 1);
};

const exerciseRejectedForkFacts = async (fixture: Fixture): Promise<void> => {
  let evidenceOnlyFailure: unknown;
  try {
    await readCompletedGptChildResult({
      call: fixture.call, facts: fixture.facts({ mutation: null }), evidenceStore: fixture.store,
      onSuccess: () => { fixture.success.count += 1; },
    });
  } catch (error) { evidenceOnlyFailure = error; }
  assert.equal(failureCode(evidenceOnlyFailure), "GPT_FORK_TASK_EFFECT_RECEIPT_INVALID");
  const mutation = fixture.facts().mutation!;
  let unconfirmedMutationFailure: unknown;
  try {
    await readCompletedGptChildResult({
      call: fixture.call,
      facts: fixture.facts({ mutation: Object.freeze({ ...mutation, outcome: "DISPATCHED", terminalAt: null }) }),
      evidenceStore: fixture.store, onSuccess: () => { fixture.success.count += 1; },
    });
  } catch (error) { unconfirmedMutationFailure = error; }
  assert.equal(failureCode(unconfirmedMutationFailure), "GPT_FORK_TASK_EFFECT_RECEIPT_INVALID");
  assert.equal(fixture.success.count, 1, "invalid fork facts must not publish success");
};

const exerciseTamperedForkRelation = async (fixture: Fixture, hash: (value: string) => Hash): Promise<void> => {
  const tampered = await fixture.store.appendArtifact({
    missionId: "job:gpt-native-checkpoint-readback", runId: "attempt:gpt-native-checkpoint-readback",
    idempotencyKey: "fork-task-effect-tampered", artifactType: "other", mimeType: "application/json",
    content: JSON.stringify({ ...fixture.relation, sourceToChildRelationHash: hash("another relation") }),
  });
  const artifactRef = tampered.status === "success" ? tampered.artifactRef : undefined;
  if (!artifactRef) throw new Error("FORK_TASK_EFFECT_TAMPER_SETUP_FAILED");
  let relationFailure: unknown;
  try {
    await readCompletedGptChildResult({
      call: fixture.call,
      facts: fixture.facts({ evidence: Object.freeze({ ...fixture.evidence, artifactRefs: [artifactRef] }) }),
      evidenceStore: fixture.store, onSuccess: () => { fixture.success.count += 1; },
    });
  } catch (error) { relationFailure = error; }
  assert.equal(failureCode(relationFailure), "GPT_FORK_RELATION_TASK_ARTIFACT_INVALID");
  assert.equal(fixture.success.count, 1, "a relation artifact not bound to current input must not publish success");
};

export const exerciseForkTaskEffectReadback = async (
  store: GptEvidenceStorePort,
  hash: (value: string) => Hash,
): Promise<void> => {
  const fixture = await createForkFixture(store, hash);
  await exerciseValidFork(fixture);
  await exerciseRejectedForkFacts(fixture);
  await exerciseTamperedForkRelation(fixture, hash);
};
