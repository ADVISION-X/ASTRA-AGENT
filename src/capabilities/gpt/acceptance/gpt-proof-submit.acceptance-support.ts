import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";
import { approvedFile, conversationUrl, promptHash } from "./gpt-conversation-fixture.js";
import { coherentObservationPacket, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";

const exerciseSubmit = async (
  scope: string,
  files: readonly typeof approvedFile[],
  expectedAttachmentLabels: readonly string[],
  latestUserTurnId: string | null,
  expectedUserTurnId: string,
) => {
  let exactOutgoingTurnChecked = false;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "click") {
      assert.equal(intent.preClickExactOutgoingTurn?.expectedPromptHash, promptHash);
      assert.deepEqual(intent.preClickExactOutgoingTurn?.expectedAttachmentLabels, expectedAttachmentLabels);
      assert.equal(intent.postClickObservation?.queries[0]?.selector,
        intent.preClickExactOutgoingTurn?.userTurnSelector);
      assert.equal(intent.postClickObservation?.queries[0]?.latestGptUserTurn, true);
      exactOutgoingTurnChecked = true;
      const queries = intent.postClickObservation!.queries
        .map(({ expectedEligibleCount: _expected, ...query }) => query);
      return { postconditionVerified: true,
        postconditionObservation: coherentObservationPacket({ queries }, {
          "submitted-user-turn": { rawCount: 1, eligibleCount: 1,
            matches: [{ turnKey: expectedUserTurnId, exactGptUserPromptHash: promptHash }] },
          "empty-composer": { rawCount: 1, eligibleCount: 1, matches: [{}] },
        }, conversationUrl) };
    }
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      "latest-user-turn": latestUserTurnId === null ? { rawCount: 0, eligibleCount: 0 }
        : { rawCount: 1, eligibleCount: 1, matches: [{ turnKey: latestUserTurnId }] },
    }, conversationUrl);
    throw new Error(`UNEXPECTED_SUBMIT_PROOF_INTENT:${intent.kind}`);
  }, { initialUrl: conversationUrl });
  let providerGateChecks = 0;
  const result = await createGptAcceptanceHarness(scope).execute(
    "submit_exact_gpt_turn_once", fixture.browser, { files, promptHash }, {
      assertProviderInputAllowed: () => {
        providerGateChecks += 1;
        assert.equal(fixture.physicalMutations(), 0,
          "the durable provider gate must be rechecked before the physical submit");
      },
    },
  );
  assert.equal(result.status, "success", result.failureCode ?? "submit proof failed");
  assert.equal(result.value?.status, "CONFIRMED");
  assert.equal(result.value?.userTurnId, expectedUserTurnId);
  assert.equal(exactOutgoingTurnChecked, true);
  assert.equal(providerGateChecks, 1);
  assert.equal(fixture.physicalMutations(), 1);
};

export const verifySubmitProofs = async (): Promise<void> => {
  await exerciseSubmit("gpt-proof-submit-localization", [], [], null, "00000000-0000-4000-8000-000000000001");
  await exerciseSubmit("gpt-proof-submit-with-attachment", [approvedFile],
    [approvedFile.providerDisplayName], "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000007");
  await exerciseSubmit("gpt-proof-submit-third-turn", [], [],
    "00000000-0000-4000-8000-000000000007", "00000000-0000-4000-8000-000000000012");

  {
    const fixture = fakeBrowser((intent) => {
      if (intent.kind !== "click") throw new Error(`UNEXPECTED_FAILED_SUBMIT_INTENT:${intent.kind}`);
      const queries = intent.postClickObservation!.queries
        .map(({ expectedEligibleCount: _expected, ...query }) => query);
      return { postconditionVerified: true,
        postconditionObservation: coherentObservationPacket({ queries }, {
          "submitted-user-turn": { rawCount: 1, eligibleCount: 1,
            matches: [{ turnKey: "00000000-0000-4000-8000-000000000003", exactGptUserPromptHash: `sha256:${"f".repeat(64)}` }] },
          "empty-composer": { rawCount: 1, eligibleCount: 1, matches: [{}] },
        }, conversationUrl) };
    }, { initialUrl: conversationUrl });
    const result = await createGptAcceptanceHarness("gpt-proof-submit-failed-readback").execute(
      "submit_exact_gpt_turn_once", fixture.browser, { files: [], promptHash },
    );
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "GPT_SUBMITTED_USER_TURN_PROMPT_HASH_MISMATCH");
    assert.equal(result.proof.committedMutation, "confirmed");
    assert.equal(result.proof.browserFact?.effectScope, "provider_effect");
    assert.equal(result.proof.browserFact?.browserOutcome, "CONFIRMED");
    assert.equal(result.proof.browserFact?.mutationOutcome, "confirmed");
  }
};
