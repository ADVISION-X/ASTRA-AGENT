import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { GPT_CHILD_CAPABILITY_CONTRACTS } from "../contract.js";
import { coherentObservationPacket, EXPECTED_GPT_CHILD_IDS, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";
import { assertGptExactTargetSourceShape } from "./gpt-exact-target-source-support.js";
import { exercisePreExecutionFailureEvidence } from "./gpt-failure-evidence-readback.acceptance-support.js";
import { conversationFacts } from "./gpt-exact-target-conversation-fixture.js";
import { exerciseExactModelSelection } from "./gpt-exact-target-model.acceptance-support.js";
import { execute, exerciseTransientProfileConfirmations, profile, profileFacts } from "./gpt-exact-target-profile-fixture.js";
import "./gpt-reasoning-requirement.acceptance.js";
assert.deepEqual(Object.keys(GPT_CHILD_CAPABILITY_CONTRACTS).sort(), EXPECTED_GPT_CHILD_IDS);
assert.equal(EXPECTED_GPT_CHILD_IDS.length, 15); assertGptExactTargetSourceShape(import.meta.url);

const verifyFreshChat = async (): Promise<void> => {
  let samples = 0;
  const hydrated = fakeBrowser(intent => {
    if (intent.kind !== "observe") throw new Error("CHAT_HYDRATION_MUST_NOT_ACT");
    samples += 1; return coherentObservationPacket(intent, conversationFacts(samples < 3 ? null : ""));
  });
  const ready = await execute("prepare_clean_gpt_chat", hydrated.browser, { timeoutMs: 60000 });
  assert.equal(ready.status, "success", ready.failureCode ?? "fresh chat"); assert.equal(samples, 3);
  assert.deepEqual(hydrated.waitDurations(), [1500, 3000]); assert.equal(hydrated.physicalMutations(), 0);
  for (const [field, code] of [["user", "GPT_CHAT_PRIOR_USER_TURN_PRESENT"], ["assistant", "GPT_CHAT_PRIOR_ASSISTANT_TURN_PRESENT"],
    ["attachments", "GPT_CHAT_ATTACHMENT_PRESENT"], ["generating", "GPT_CHAT_GENERATION_PRESENT"]] as const) {
    const fixture = fakeBrowser(intent => {
      if (intent.kind !== "observe") throw new Error("DIRTY_CHAT_MUST_NOT_ACT");
      return coherentObservationPacket(intent, conversationFacts("", { [field]: 1 }));
    });
    const failed = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 60000 });
    assert.equal(failed.failureCode, code); assert.equal(failed.status, "failed");
    assert.deepEqual(fixture.waitDurations(), []); assert.equal(fixture.physicalMutations(), 0);
  }
  let empty = false, reads = 0;
  const draft = fakeBrowser(intent => {
    if (intent.kind === "observe") { reads += 1; return coherentObservationPacket(intent, conversationFacts(empty ? "" : "stale draft")); }
    if (intent.kind === "fill") { assert.equal(intent.approvedText, ""); empty = true; return { mutationCount: 1 }; }
    throw new Error("DRAFT_CLEAR_MUST_ONLY_FILL");
  });
  const cleared = await execute("prepare_clean_gpt_chat", draft.browser, { timeoutMs: 60000 });
  assert.equal(cleared.status, "success"); assert.equal(cleared.value?.staleDraftCleared, true);
  assert.equal(reads, 2); assert.equal(draft.physicalMutations(), 1);
};
const verifyChatMode = async (): Promise<void> => {
  for (const scenario of ["valid", "wrong-attribute", "wrong-postcondition"] as const) {
    let mode: "work" | "chat" = "work";
    const fixture = fakeBrowser(intent => {
      if (intent.kind === "observe") return coherentObservationPacket(intent, conversationFacts("", { mode }));
      if (intent.kind !== "click" || !intent.postClickObservation) throw new Error("WORK_MODE_MUST_ONLY_CLICK");
      assert.equal(intent.expectedTextEquals, "聊天"); assert.match(intent.selector, /aria-label='撰写器模式'.*button:first-of-type/u);
      assert.deepEqual(intent.postClickObservation.queries.map(query => [query.queryId, query.expectedEligibleCount, query.textEquals, query.fields]),
        [["chat-mode", 1, "聊天", ["ariaPressed"]], ["work-mode", 1, "工作", ["ariaPressed"]]]);
      mode = scenario === "wrong-postcondition" ? "work" : "chat";
      const queries = intent.postClickObservation.queries.map(({ expectedEligibleCount: _count, ...query }) => query);
      return { mutationCount: 1, postconditionVerified: true, clickedCandidateAttributeReadback:
        { name: "aria-pressed", value: scenario === "wrong-attribute" ? "false" : "true", verified: scenario !== "wrong-attribute" },
        postconditionObservation: coherentObservationPacket({ queries }, conversationFacts("", { mode })) };
    }, { enforceClickedAttributeReadback: true });
    const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 60000 });
    assert.equal(result.status, scenario === "valid" ? "success" : "failed");
    if (scenario !== "valid") assert.equal(result.failureCode, scenario === "wrong-attribute" ? "BROWSER_AUTH_TRANSCRIPT_INVALID" : "GPT_CHAT_MODE_SELECTION_POSTCONDITION_INVALID");
    assert.equal(fixture.physicalMutations(), 1);
    if (scenario === "wrong-attribute") assert.equal(result.proof.committedMutation, "dispatched");
  }
  for (const [override, code, waits] of [[{ chatModeRaw: 0 }, "GPT_CHAT_MODE_MISSING", [1500, 3000]],
    [{ chatModeRaw: 2, chatModeEligible: 2 }, "GPT_CHAT_MODE_AMBIGUOUS", []], [{ chatModeEligible: 0 }, "GPT_CHAT_MODE_NOT_ACTIONABLE", [1500, 3000]],
    [{ workModeRaw: 0 }, "GPT_CHAT_MODE_MISSING", [1500, 3000]]] as const) {
    const fixture = fakeBrowser(intent => {
      if (intent.kind !== "observe") throw new Error("INVALID_CHAT_MODE_MUST_NOT_ACT");
      return coherentObservationPacket(intent, conversationFacts("", override));
    });
    const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 60000 });
    assert.equal(result.failureCode, code); assert.deepEqual(fixture.waitDurations(), waits); assert.equal(fixture.physicalMutations(), 0);
  }
  for (const [draft, mode, code] of [["stale draft", "work", "GPT_CHAT_MODE_WORK_SELECTED_WITH_DRAFT"], ["", "invalid", "GPT_CHAT_MODE_INVALID"]] as const) {
    const fixture = fakeBrowser(intent => {
      if (intent.kind !== "observe") throw new Error("INVALID_CHAT_MODE_MUST_NOT_ACT");
      return coherentObservationPacket(intent, conversationFacts(draft, { mode }));
    });
    assert.equal((await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 60000 })).failureCode, code); assert.equal(fixture.physicalMutations(), 0);
  }
};
const verifyProfileAction = async (): Promise<void> => {
  let open = false;
  const fixture = fakeBrowser(intent => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, profileFacts(intent, open));
    if (intent.kind !== "click" || !intent.postClickObservation) throw new Error("PROFILE_MUST_ONLY_CLICK_ONCE");
    open = !open;
    assert.deepEqual(intent.postClickObservation.queries.map(query => [query.queryId, query.expectedEligibleCount]), open
      ? [["popup", 1], ["simple-panel", 1], ["reasoning-control", 1], ["enabled-reasoning-control", 1], ["reasoning-value", 1], ["trigger", 1]]
      : [["popup", 0], ["trigger", 1], ["composer", 1]]);
    const queries = intent.postClickObservation.queries.map(({ expectedEligibleCount: _count, ...query }) => query);
    return { mutationCount: 1, postconditionVerified: true, postconditionObservation: coherentObservationPacket({ queries }, profileFacts({ queries }, open)) };
  });
  assert.equal((await execute("open_gpt_execution_profile", fixture.browser, { profile })).status, "success");
  assert.equal(fixture.physicalMutations(), 1);
  const done = await execute("open_gpt_execution_profile", fixture.browser, { profile });
  assert.equal(done.status, "success"); assert.equal(done.proof.internalDecisionCode, "DONE"); assert.equal(done.proof.browserFact, null);
  assert.equal(fixture.physicalMutations(), 1);
  assert.equal((await execute("close_gpt_execution_profile", fixture.browser, { profile })).status, "success");
  assert.equal(fixture.physicalMutations(), 2);
};
const verifyProfileFailure = async (): Promise<void> => {
  for (const id of ["popup", "simple-panel", "reasoning-control", "enabled-reasoning-control", "reasoning-value", "trigger"]) {
    for (const ambiguous of [true, false]) {
      const fixture = fakeBrowser(intent => {
        if (intent.kind !== "observe") throw new Error("PROFILE_CONTRADICTION_MUST_NOT_ACT");
        return coherentObservationPacket(intent, { ...profileFacts(intent, false), [id]: ambiguous ? { rawCount: 2, eligibleCount: 2 }
          : { rawCount: 1, eligibleCount: 0, rejections: [{ index: 0, reasons: ["NO_LAYOUT_BOX"] }], nativeCauseCode: "NO_LAYOUT_BOX", nativeCauseCount: 1 } });
      });
      const result = await execute("open_gpt_execution_profile", fixture.browser, { profile });
      assert.equal(result.status, "failed"); assert.ok(result.failureCode?.startsWith("GPT_EXECUTION_PROFILE_OPEN_QUALIFICATION_INVALID:"));
      for (const queryId of ["popup", "simple-panel", "reasoning-control", "enabled-reasoning-control", "reasoning-value", "trigger"]) assert.ok(result.failureCode?.includes(`${queryId}[`));
      if (!ambiguous) assert.equal(result.proof.nativeFailureCode, "NO_LAYOUT_BOX");
      assert.deepEqual(fixture.waitDurations(), ambiguous ? [] : [1500, 3000]); assert.equal(fixture.physicalMutations(), 0);
    }
  }
  let samples = 0;
  const badPost = fakeBrowser(intent => {
    if (intent.kind === "observe") { samples += 1; return coherentObservationPacket(intent, profileFacts(intent, false)); }
    if (intent.kind !== "click" || !intent.postClickObservation) throw new Error("UNEXPECTED_PROFILE_POSTCONDITION");
    const queries = intent.postClickObservation.queries.map(({ expectedEligibleCount: _count, ...query }) => query);
    return { mutationCount: 1, postconditionVerified: true, postconditionObservation: coherentObservationPacket({ queries },
      { ...profileFacts({ queries }, true), "reasoning-control": { rawCount: 0, eligibleCount: 0 } }) };
  });
  const failed = await execute("open_gpt_execution_profile", badPost.browser, { profile });
  assert.equal(failed.status, "failed"); assert.equal(failed.proof.committedMutation, "confirmed");
  assert.equal(samples, 1); assert.equal(badPost.physicalMutations(), 1);
  for (const field of ["exactCallIdentityHash", "targetRefHash", "documentRefHash", "currentUrl"]) {
    let reads = 0;
    const drift = fakeBrowser(intent => {
      if (intent.kind !== "observe") throw new Error("DRIFTED_PROFILE_MUST_NOT_ACT"); reads += 1;
      const packet = coherentObservationPacket(intent, reads === 1 ? {} : profileFacts(intent, false));
      return reads === 1 ? packet : { ...packet, [field]: field === "currentUrl" ? "https://chatgpt.com/c/another-conversation" : `sha256:${"5".repeat(64)}` };
    });
    const result = await execute("open_gpt_execution_profile", drift.browser, { profile });
    assert.equal(result.failureCode, "GPT_DOM_CONFIRMATION_IDENTITY_CHANGED"); assert.equal(result.proof.committedMutation, "no"); assert.equal(drift.physicalMutations(), 0);
  }
};
await verifyFreshChat(); await verifyChatMode(); await verifyProfileAction(); await verifyProfileFailure();
await exerciseTransientProfileConfirmations(); await exerciseExactModelSelection(); await exercisePreExecutionFailureEvidence();
