import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { executionFailure, executionFailureMetadata } from "../../../lib/execution-failure.js";
import { buildGptExecutionProfile } from "../index.js";
import { gptCanonicalHash } from "../contract.js";
import { productionGptAtomicIdentity } from "../production-atomic-call.js";
import { repairStoppedEmptyResponse } from "../production-stopped-empty-retry.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";
import { fakeBrowser, exactAssistantTurnReply } from "./gpt-exact-target-browser-fixture.js";
import { conversationUrl } from "./gpt-conversation-fixture.js";

const hash = (digit: string): `sha256:${string}` => `sha256:${digit.repeat(64)}`;
type Repair = Parameters<typeof repairStoppedEmptyResponse>[0];
async function fixture(completeAfter: number, unconfirmed = false, budget = 5) {
  const harness = createGptAcceptanceHarness("five-retry-contract");
  const input = { canonicalConversationUrl: conversationUrl, probeBudgetMs: 200_000,
    userTurnId: "00000000-0000-4000-8000-000000000003", turnMarker: "five-retry" };
  const intent = harness.buildIntent("checkpoint_gpt_text_response", input);
  const atomic = productionGptAtomicIdentity(intent, 0);
  let replies = 0, retries = 0, menus = 0, budgets = 0;
  const observe = async () => {
    const browser = fakeBrowser(command => {
      if (command.kind !== "readExactAssistantTurn") throw new Error("RETRY_OBSERVATION_MUST_NOT_MUTATE");
      return exactAssistantTurnReply(command, replies >= completeAfter ? "complete response" : "");
    }).browser;
    return browser.runAtomicStep(atomic, () => harness.gpt.execute(intent, { dataDir: "/tmp/gpt-five-retry-contract",
      browser, browserAtomicIdentity: atomic, settleLiveStoppedEmpty: true,
      waitForProviderObservation: async () => "reobserve" }));
  };
  const initial = await observe();
  const profile = buildGptExecutionProfile({ profileRef: "acceptance:five-retry", startModelDisplayName: "GPT-5.6 Sol",
    requestedReasoningValue: 5, executorIdentityRef: "acceptance", acceptanceRef: "acceptance", acceptanceVersion: "v1" });
  const evidence = { evidenceRef: "evidence:retry", evidenceHash: hash("b"), sourceAttemptId: intent.attemptId,
    exactCallIdentityHash: hash("c"), artifactRefs: [] };
  const root: Repair["root"] = { exactCallIdentityHash: hash("c"), childCapabilityId: "submit_exact_gpt_turn_once",
    effectScope: "provider_effect", browserOutcome: "CONFIRMED", mutationOutcome: "confirmed",
    providerEffectIdentityHash: hash("a"), terminalAt: new Date().toISOString(), evidenceRef: "browser-mutation:root",
    evidenceHash: hash("b"), submitIdentity: { ...atomic, childCapabilityId: "submit_exact_gpt_turn_once", callId: "submit" },
    canonicalConversationUrl: conversationUrl, userTurnId: input.userTurnId };
  const repair: Repair = { dataDir: "/tmp/gpt-five-retry-contract", signal: new AbortController().signal,
    call: { sessionKey: "five-retry", productStepId: intent.productStepId, callId: intent.callId,
      actionOrdinal: intent.actionOrdinal, child: "checkpoint_gpt_text_response", input },
    intent, root, profile, promptHash: gptCanonicalHash("approved original prompt"), initial, readRetry: () => null,
    assertBudget: () => { budgets += 1; if (budgets > budget) throw executionFailure("failed", "RETRY_BUDGET_EXHAUSTED"); },
    executeMenu: async call => { menus += 1; assert.equal(call.input.retryOrdinal, menus);
      return { ...evidence, value: { state: "menu-ready" }, effectReceipt: null }; },
    executeRetry: async call => {
      retries += 1;
      assert.equal(call.callId, `stopped-empty-retry:${hash("a").slice(7)}:${retries}`);
      assert.equal(call.input.previousEffectIdentityHash, retries === 1 ? hash("a") : hash(String(retries - 1)));
      assert.equal(call.input.approvedModel, profile.startModelDisplayName);
      return { ...evidence, value: { state: "generation-started", userTurnId: input.userTurnId,
        promptHash: repair.promptHash, preEmptyObservationRevisionHash: hash("d") }, effectReceipt: {
        effectScope: "provider_effect", providerEffectIdentityHash: hash(String(retries)),
        outcome: unconfirmed ? "DISPATCHED" : "CONFIRMED", mutationOutcome: "confirmed", terminalAt: new Date().toISOString(),
        evidenceRef: `browser-mutation:retry:${retries}`, evidenceHash: hash(String(retries)) } };
    }, observe: async () => { replies += 1; return observe(); },
  };
  return { repair, counts: () => ({ menus, retries, budgets }) };
}
export async function verifyStoppedEmptyRecoveryContract(): Promise<void> {
  const recovered = await fixture(1);
  assert.equal((await repairStoppedEmptyResponse(recovered.repair)).status, "success");
  assert.equal(recovered.counts().retries, 1);
  const fifth = await fixture(5);
  assert.equal((await repairStoppedEmptyResponse(fifth.repair)).status, "success");
  assert.equal(fifth.counts().retries, 5);
  const exhausted = await fixture(6);
  const result = await repairStoppedEmptyResponse(exhausted.repair);
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_RESPONSE_STOPPED_EMPTY");
  assert.equal(result.proof.stoppedEmptyProof?.retries.length, 5);
  assert.deepEqual(result.proof.stoppedEmptyProof?.retries.map(retry => retry.ordinal), [1, 2, 3, 4, 5]);
  assert.equal(result.proof.browserFact?.providerEffectIdentityHash, hash("5"));
  assert.equal(new Set(result.proof.stoppedEmptyProof?.retries.map(retry => retry.effectIdentityHash)).size, 5);
  const unknown = await fixture(6, true);
  await assert.rejects(repairStoppedEmptyResponse(unknown.repair), /GPT_RETRY_BROWSER_RECEIPT_INVALID/u);
  assert.equal(unknown.counts().retries, 1);
  const limited = await fixture(6, false, 2);
  let failure: unknown;
  try { await repairStoppedEmptyResponse(limited.repair); } catch (error) { failure = error; }
  assert.equal(limited.counts().retries, 2);
  assert.equal(executionFailureMetadata(failure)?.browserEffect?.providerEffectIdentityHash, hash("2"));
}
