import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";
import { approvedFile, conversationUrl, promptHash } from "./gpt-conversation-fixture.js";
import { coherentObservationPacket, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";

export const verifySubmitProofs = async (): Promise<void> => {
  for (const [name, files, userTurnId] of [
    ["localization", [], "00000000-0000-4000-8000-000000000001"],
    ["approved-batch", [approvedFile], "00000000-0000-4000-8000-000000000007"],
    ["third-turn", [], "00000000-0000-4000-8000-000000000012"],
  ] as const) {
    let outgoing = 0, gate = 0;
    const fixture = fakeBrowser(intent => {
      assert.equal(intent.kind, "click");
      if (intent.kind !== "click") throw new Error("SUBMIT_MUST_ONLY_CLICK");
      assert.equal(intent.preClickExactOutgoingTurn?.expectedPromptHash, promptHash);
      assert.deepEqual(intent.preClickExactOutgoingTurn?.expectedAttachmentLabels, files.map(file => file.providerDisplayName));
      assert.equal(intent.postClickObservation?.queries[0]?.selector, intent.preClickExactOutgoingTurn?.userTurnSelector);
      assert.equal(intent.postClickObservation?.queries[0]?.latestGptUserTurn, true);
      assert.equal(intent.postClickObservation?.queries[1]?.expectedEligibleCount, 1);
      outgoing += 1;
      const queries = intent.postClickObservation!.queries.map(({ expectedEligibleCount: _count, ...query }) => query);
      return { mutationCount: 1, postconditionVerified: true, postconditionObservation: coherentObservationPacket({ queries }, {
        "submitted-user-turn": { rawCount: 1, eligibleCount: 1, matches: [{ turnKey: userTurnId, exactGptUserPromptHash: promptHash }] },
        "empty-composer": { rawCount: 1, eligibleCount: 1, matches: [{}] },
      }, conversationUrl) };
    }, { initialUrl: conversationUrl });
    const result = await createGptAcceptanceHarness(`gpt-proof-submit-${name}`).execute("submit_exact_gpt_turn_once", fixture.browser, { files, promptHash }, {
      assertProviderInputAllowed: () => { gate += 1; assert.equal(fixture.physicalMutations(), 0); },
    });
    assert.equal(result.status, "success", result.failureCode ?? name);
    assert.equal(result.value?.status, "CONFIRMED"); assert.equal(result.value?.userTurnId, userTurnId);
    assert.equal(result.proof.internalDecisionCode, "ACT"); assert.equal(result.proof.browserFact?.browserOutcome, "CONFIRMED");
    assert.deepEqual([gate, outgoing, fixture.physicalMutations()], [1, 1, 1]);
  }
  for (const count of [0, 1] as const) {
    const fixture = fakeBrowser(intent => {
      if (intent.kind !== "click") throw new Error("FAILED_SUBMIT_CANNOT_OBSERVE_OR_REPLAY");
      const queries = intent.postClickObservation!.queries.map(({ expectedEligibleCount: _count, ...query }) => query);
      return { mutationCount: count, postconditionVerified: true, postconditionObservation: coherentObservationPacket({ queries }, {
        "submitted-user-turn": { rawCount: 1, eligibleCount: 1, matches: [{ turnKey: "00000000-0000-4000-8000-000000000003", exactGptUserPromptHash: `sha256:${"f".repeat(64)}` }] },
        "empty-composer": { rawCount: 1, eligibleCount: 1, matches: [{}] },
      }, conversationUrl) };
    }, { initialUrl: conversationUrl });
    const result = await createGptAcceptanceHarness(`gpt-proof-submit-negative-${count}`).execute("submit_exact_gpt_turn_once", fixture.browser, { files: [], promptHash });
    assert.equal(result.status, "failed"); assert.equal(fixture.physicalMutations(), count);
    assert.equal(result.failureCode, count === 0 ? "GPT_BROWSER_TERMINAL_FACT_REQUIRED" : "GPT_SUBMITTED_USER_TURN_PROMPT_HASH_MISMATCH");
    assert.equal(result.proof.committedMutation, count === 0 ? "no" : "confirmed");
    assert.equal(result.proof.browserFact?.effectScope, "provider_effect");
    assert.equal(result.proof.browserFact?.browserOutcome, "CONFIRMED");
    assert.equal(result.proof.browserFact?.mutationOutcome, count === 0 ? "no" : "confirmed");
  }
};
