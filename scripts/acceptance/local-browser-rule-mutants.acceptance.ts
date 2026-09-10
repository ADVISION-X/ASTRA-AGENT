import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { assertBrowserDomIntent } from "../../src/lib/browser/exact-target/browser-dom-intent.js";

const root = await mkdtemp(join(tmpdir(), "browser-mutation-attacks-"));
const hash = `sha256:${"b".repeat(64)}` as const;
const negativeHash = `sha256:${"d".repeat(64)}` as const;
const logicalMutationId = `sha256:${"c".repeat(64)}` as const;
const exactCallIdentityHash = `sha256:${"e".repeat(64)}` as const;
try {
  assert.deepEqual(assertBrowserDomIntent({
    kind: "hover", selector: "[role='menuitem'][aria-haspopup='menu']",
    expectedText: "模型", expectedMatches: 1,
    postHoverAttribute: { name: "aria-expanded", equals: "true", timeoutMs: 5_000 },
  }), {
    kind: "hover", selector: "[role='menuitem'][aria-haspopup='menu']",
    expectedText: "模型", expectedMatches: 1,
    postHoverAttribute: { name: "aria-expanded", equals: "true", timeoutMs: 5_000 },
  });
  assert.throws(() => assertBrowserDomIntent({
    kind: "hover", selector: "[role='menuitem']", expectedMatches: 1,
  } as never), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "a hover without its same-node expanded-state proof must fail closed");
  assert.throws(() => assertBrowserDomIntent({
    kind: "hover", selector: "[role='menuitem']", expectedMatches: 1,
    postHoverAttribute: { name: "aria-expanded", equals: "true", timeoutMs: 5_001 },
  }), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "an unbounded hover postcondition must fail closed");
  assert.throws(() => assertBrowserDomIntent({
    kind: "click", selector: "button", expectedMatches: 1,
  }), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "a click without one direct postcondition must fail before dispatch");
  const coherentClick = {
    kind: "click" as const, selector: "button", expectedMatches: 1,
    postClickObservation: { timeoutMs: 5_000, queries: [{
      queryId: "advanced", selector: "[data-active='true']", maxMatches: 2, fields: [] as const,
      expectedEligibleCount: 1,
    }] },
  };
  assert.equal(assertBrowserDomIntent(coherentClick).kind, "click");
  assert.throws(() => assertBrowserDomIntent({
    ...coherentClick,
    postClickObservation: { ...coherentClick.postClickObservation,
      queries: [{ ...coherentClick.postClickObservation.queries[0]!, expectedEligibleCount: 3 }] },
  }), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "a coherent postcondition cannot expect more eligible nodes than its bounded query permits");
  assert.throws(() => assertBrowserDomIntent({
    ...coherentClick,
    postClickObservation: { ...coherentClick.postClickObservation,
      queries: [{ ...coherentClick.postClickObservation.queries[0]!, semanticState: "open" }] },
  } as never), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "Browser admission must reject semantic fields outside the mechanical query contract");
  assert.equal(assertBrowserDomIntent({
    ...coherentClick,
    postClickObservation: { ...coherentClick.postClickObservation,
      queries: [{ ...coherentClick.postClickObservation.queries[0]!, fields: ["ariaExpanded"] }] },
  }).kind, "click",
  "an atomic click postcondition may return bounded mechanical fields in the same coherent packet");
  assert.throws(() => assertBrowserDomIntent({
    ...coherentClick,
    postClickObservation: { ...coherentClick.postClickObservation,
      queries: [{ ...coherentClick.postClickObservation.queries[0]!, fields: ["semanticTextHash"] }] },
  } as never), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "a synchronous atomic click postcondition cannot add semantic content hashing");
  assert.throws(() => assertBrowserDomIntent({
    ...coherentClick,
    postClickMatch: { selector: "[data-active='true']", expectedMatches: 1 },
  }), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "a click cannot carry a second postcondition path beside its coherent packet");
  const forkTransitionClick = {
    kind: "click" as const,
    selector: "[role='menuitem']",
    expectedTextEquals: "分支到新聊天",
    expectedMatches: 1,
    postClickTargetTransition: {
      kind: "gpt-fork-successor" as const,
      sourceCheckpoint: {
        assistantTurnId: "conversation-turn-10",
        canonicalConversationUrl: "https://chatgpt.com/c/opaque%20segment",
        promptHash: `sha256:${"1".repeat(64)}` as const,
        responseHash: `sha256:${"2".repeat(64)}` as const,
        turnMarker: "[GRASSEYE:fork]",
      },
      timeoutMs: 5_000,
    },
  };
  assert.equal(assertBrowserDomIntent(forkTransitionClick).kind, "click",
    "fork admission must accept turn 10+ and the current opaque conversation-segment contract");
  assert.throws(() => assertBrowserDomIntent({
    ...forkTransitionClick,
    postClickTargetTransition: { ...forkTransitionClick.postClickTargetTransition,
      sourceCheckpoint: { ...forkTransitionClick.postClickTargetTransition.sourceCheckpoint,
        assistantTurnId: "conversation-turn-1" } },
  }), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "fork admission must require a preceding user turn");
  assert.throws(() => assertBrowserDomIntent({
    ...forkTransitionClick,
    postClickTargetTransition: { ...forkTransitionClick.postClickTargetTransition,
      sourceCheckpoint: { ...forkTransitionClick.postClickTargetTransition.sourceCheckpoint,
        canonicalConversationUrl: "https://chatgpt.com/c/opaque%20segment?drift=1" } },
  }), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "fork admission must reject a non-canonical source URL");
  for (const key of ["ArrowLeft", "ArrowRight"] as const) {
    assert.equal(assertBrowserDomIntent({
      kind: "keypress",
      selector: "[role='menuitem'][aria-label='能力']:not([aria-disabled='true'])",
      key,
      repeat: 4,
      expectedMatches: 1,
      postKeypressMatch: { selector: "[role='slider'][aria-valuenow='3']", expectedMatches: 1,
        readEligibility: "non-actionable-aria-state", timeoutMs: 5_000 },
    }).kind, "keypress", `${key} must act on the capability item and only read the governed state slider`);
  }
  assert.throws(() => assertBrowserDomIntent({
    kind: "keypress",
    selector: "[role='menuitem'][aria-label='能力']:not([aria-disabled='true'])",
    key: "ArrowRight",
    repeat: 5,
    expectedMatches: 1,
    postKeypressMatch: { selector: "[role='slider']", expectedMatches: 1,
      readEligibility: "non-actionable-aria-state" },
  } as never), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "a keypress repeat beyond the complete five-value slider must fail closed");
  assert.throws(() => assertBrowserDomIntent({
    kind: "keypress",
    selector: "[role='menuitem'][aria-label='能力']:not([aria-disabled='true'])",
    key: "Tab",
    expectedMatches: 1,
    postKeypressMatch: { selector: "[role='slider']", expectedMatches: 1,
      readEligibility: "non-actionable-aria-state" },
  } as never), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "keypress admission must stay closed to unowned keys");
  const store = new BrowserMutationStore(root);
  store.prepare({
    commandId: "command-1", logicalMutationId, exactCallIdentityHash,
    ownerPluginId: "fixture-product-plugin", pluginVersion: 1,
    jobId: "job-1", attemptId: "attempt-1", leaseVersion: 1,
    executionFenceHash: hash, targetRef: "target-1", documentRef: "document-1",
    productStepId: "step-1", callId: "call-1", childCapabilityId: "open_gpt_model_selector_v2",
    effectScope: "target_local", actionOrdinal: 1,
    actionId: "browser.dom.click.v1", positivePostconditionHash: hash,
    negativePostconditionHash: negativeHash, requestHash: hash, payloadHash: hash,
  });
  assert.throws(() => store.resolve({ commandId: "command-1", ownerPluginId: "fixture-product-plugin", targetRef: "target-1", state: "CONFIRMED", mutationOutcome: "dispatched", proofHash: hash }), /BROWSER_MUTATION_STATE_CONFLICT/u);
  store.markDispatched("command-1");
  store.markReceiptMissing("command-1");
  store.prepare({
    commandId: "command-retry", logicalMutationId, exactCallIdentityHash,
    ownerPluginId: "fixture-product-plugin", pluginVersion: 1,
    jobId: "job-1", attemptId: "attempt-2", leaseVersion: 2,
    executionFenceHash: hash, targetRef: "target-1", documentRef: "document-1",
    productStepId: "step-1", callId: "call-1", childCapabilityId: "open_gpt_model_selector_v2",
    effectScope: "target_local", actionOrdinal: 1,
    actionId: "browser.dom.click.v1", positivePostconditionHash: hash,
    negativePostconditionHash: negativeHash, requestHash: hash, payloadHash: hash,
  });
  assert.throws(() => store.resolve({ commandId: "command-1", ownerPluginId: "foreign-owner", targetRef: "target-1", state: "CONFIRMED", mutationOutcome: "dispatched", proofHash: hash }), /BROWSER_MUTATION_STATE_CONFLICT/u);
  assert.throws(() => store.resolve({ commandId: "command-1", ownerPluginId: "fixture-product-plugin", targetRef: "target-2", state: "CONFIRMED", mutationOutcome: "dispatched", proofHash: hash }), /BROWSER_MUTATION_STATE_CONFLICT/u);
  assert.equal(store.readDispatched("command-1")?.childCapabilityId, "open_gpt_model_selector_v2");
  assert.equal(store.readAtomicStepOutcome({
    jobId: "job-1", attemptId: "attempt-1", ownerPluginId: "fixture-product-plugin",
    pluginVersion: 1, exactCallIdentityHash,
    actionOrdinal: 1, targetRef: "target-1", effectScope: "target_local",
  })?.state, "dispatched");
  assert.equal(store.readAtomicStepOutcome({
    jobId: "job-1", attemptId: "attempt-1", ownerPluginId: "fixture-product-plugin",
    pluginVersion: 1, exactCallIdentityHash,
    actionOrdinal: 1, targetRef: "target-2", effectScope: "target_local",
  }), null, "target-local recovery identity must not cross Target generations");
  store.resolve({ commandId: "command-1", ownerPluginId: "fixture-product-plugin", targetRef: "target-1", state: "REJECTED", mutationOutcome: "dispatched", proofHash: hash });
  const rejectedFact = store.readExactCallMutationFact({
    jobId: "job-1", attemptId: "attempt-1", ownerPluginId: "fixture-product-plugin",
    pluginVersion: 1, exactCallIdentityHash, actionOrdinal: 1,
  });
  assert.equal(rejectedFact?.outcome, "REJECTED");
  assert.equal(typeof rejectedFact?.terminalAt, "string");
  assert.equal(rejectedFact?.authorityRef, "browser-mutation:command-1");
  assert.equal(rejectedFact?.failureCode, "BROWSER_POSTCONDITION_FAILED");
  assert.equal(rejectedFact?.nativeFailureCode, null);
  assert.match(rejectedFact?.authorityHash ?? "", /^sha256:[a-f0-9]{64}$/u);
  assert.throws(() => store.readExactCallMutationFact({
    jobId: "job-1", attemptId: "attempt-1", ownerPluginId: "fixture-product-plugin",
    pluginVersion: 1, exactCallIdentityHash, actionOrdinal: 2,
  }), /BROWSER_ACTION_SEQUENCE_DRIFT/u,
  "actionOrdinal must be checked after exact effect identity lookup and must not create a second mutation");
  assert.throws(() => store.prepare({
    commandId: "command-cross-generation", logicalMutationId: `sha256:${"0".repeat(64)}`,
    exactCallIdentityHash, ownerPluginId: "fixture-product-plugin", pluginVersion: 1,
    jobId: "job-1", attemptId: "attempt-1", leaseVersion: 2,
    executionFenceHash: hash, targetRef: "target-2", documentRef: "document-2",
    productStepId: "step-1", callId: "call-1", childCapabilityId: "open_gpt_model_selector_v2",
    effectScope: "target_local", actionOrdinal: 1,
    actionId: "browser.dom.click.v1", positivePostconditionHash: hash,
    negativePostconditionHash: negativeHash, requestHash: hash, payloadHash: hash,
  }), /BROWSER_EXACT_CALL_REPLAY_FORBIDDEN/u,
  "verified target-local facts must prevent physical replay in a new Target generation");
  store.prepare({
    commandId: "command-new-target", logicalMutationId: `sha256:${"e".repeat(64)}`,
    exactCallIdentityHash: `sha256:${"1".repeat(64)}`,
    ownerPluginId: "fixture-product-plugin", pluginVersion: 1,
    jobId: "job-1", attemptId: "attempt-2", leaseVersion: 2,
    executionFenceHash: hash, targetRef: "target-2", documentRef: "document-2",
    productStepId: "step-1", callId: "call-1", childCapabilityId: "open_gpt_model_selector_v2",
    effectScope: "target_local", actionOrdinal: 1,
    actionId: "browser.dom.click.v1", positivePostconditionHash: hash,
    negativePostconditionHash: negativeHash, requestHash: hash, payloadHash: hash,
  });
  store.markDispatched("command-new-target");
  store.markConfirmed("command-new-target", hash);
  store.prepare({
    commandId: "command-provider-effect", logicalMutationId: `sha256:${"f".repeat(64)}`,
    exactCallIdentityHash: `sha256:${"2".repeat(64)}`,
    ownerPluginId: "fixture-product-plugin", pluginVersion: 1,
    jobId: "job-1", attemptId: "attempt-2", leaseVersion: 2,
    executionFenceHash: hash, targetRef: "target-2", documentRef: "document-2",
    productStepId: "step-provider", callId: "call-provider", childCapabilityId: "submit_exact_gpt_turn_once",
    effectScope: "provider_effect", actionOrdinal: 13,
    actionId: "browser.dom.click.v1", positivePostconditionHash: hash,
    negativePostconditionHash: negativeHash, requestHash: hash, payloadHash: hash,
  });
  store.markDispatched("command-provider-effect");
  store.markConfirmed("command-provider-effect", hash);
  assert.equal(store.readAtomicStepOutcome({
    jobId: "job-1", attemptId: "attempt-2", ownerPluginId: "fixture-product-plugin",
    pluginVersion: 1, exactCallIdentityHash: `sha256:${"2".repeat(64)}`,
    actionOrdinal: 13, targetRef: "target-replacement", effectScope: "provider_effect",
  })?.state, "confirmed", "provider effects must recover across Target/attempt generations without replay");
  store.close();
  process.stdout.write("LOCAL_BROWSER_RULE_MUTANTS_PASS\n");
} finally {
  await rm(root, { recursive: true, force: true });
}
