import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { assertBrowserDomIntent } from "../../src/lib/browser/exact-target/browser-dom-intent.js";

const root = await mkdtemp(join(tmpdir(), "browser-mutation-attacks-"));
const hash = `sha256:${"b".repeat(64)}` as const;
const negativeHash = `sha256:${"d".repeat(64)}` as const;
const logicalMutationId = `sha256:${"c".repeat(64)}` as const;
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
  for (const key of ["ArrowLeft", "ArrowRight"] as const) {
    assert.equal(assertBrowserDomIntent({
      kind: "keypress",
      selector: "[role='slider']",
      key,
      repeat: 4,
      expectedMatches: 1,
      postKeypressMatch: { selector: "[role='slider'][aria-valuenow='3']", expectedMatches: 1, timeoutMs: 5_000 },
    }).kind, "keypress", `${key} must be admitted for the governed reasoning slider`);
  }
  assert.throws(() => assertBrowserDomIntent({
    kind: "keypress",
    selector: "[role='slider']",
    key: "ArrowRight",
    repeat: 5,
    expectedMatches: 1,
    postKeypressMatch: { selector: "[role='slider']", expectedMatches: 1 },
  } as never), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "a keypress repeat beyond the complete five-value slider must fail closed");
  assert.throws(() => assertBrowserDomIntent({
    kind: "keypress",
    selector: "[role='slider']",
    key: "Tab",
    expectedMatches: 1,
    postKeypressMatch: { selector: "[role='slider']", expectedMatches: 1 },
  } as never), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "keypress admission must stay closed to unowned keys");
  const store = new BrowserMutationStore(root);
  store.prepare({
    commandId: "command-1", logicalMutationId, ownerPluginId: "fixture-product-plugin",
    jobId: "job-1", attemptId: "attempt-1", leaseVersion: 1,
    executionFenceHash: hash, targetRef: "target-1", documentRef: "document-1",
    productStepId: "step-1", callId: "call-1", childCapabilityId: "open_gpt_model_selector_v2",
    effectScope: "target_local", actionOrdinal: 1,
    actionId: "browser.dom.click.v1", positivePostconditionHash: hash,
    negativePostconditionHash: negativeHash, requestHash: hash, payloadHash: hash,
  });
  assert.throws(() => store.resolve({ commandId: "command-1", ownerPluginId: "fixture-product-plugin", targetRef: "target-1", state: "CONFIRMED", proofHash: hash }), /BROWSER_MUTATION_STATE_CONFLICT/u);
  store.markDispatched("command-1");
  store.markReceiptMissing("command-1");
  assert.throws(() => store.prepare({
    commandId: "command-retry", logicalMutationId, ownerPluginId: "fixture-product-plugin",
    jobId: "job-1", attemptId: "attempt-2", leaseVersion: 2,
    executionFenceHash: hash, targetRef: "target-1", documentRef: "document-1",
    productStepId: "step-1", callId: "call-1", childCapabilityId: "open_gpt_model_selector_v2",
    effectScope: "target_local", actionOrdinal: 1,
    actionId: "browser.dom.click.v1", positivePostconditionHash: hash,
    negativePostconditionHash: negativeHash, requestHash: hash, payloadHash: hash,
  }), /BROWSER_LOGICAL_MUTATION_REPLAY_FORBIDDEN/u);
  assert.throws(() => store.resolve({ commandId: "command-1", ownerPluginId: "foreign-owner", targetRef: "target-1", state: "CONFIRMED", proofHash: hash }), /BROWSER_MUTATION_STATE_CONFLICT/u);
  assert.throws(() => store.resolve({ commandId: "command-1", ownerPluginId: "fixture-product-plugin", targetRef: "target-2", state: "CONFIRMED", proofHash: hash }), /BROWSER_MUTATION_STATE_CONFLICT/u);
  assert.equal(store.readDispatched("command-1")?.childCapabilityId, "open_gpt_model_selector_v2");
  assert.equal(store.atomicStepRecovery({
    jobId: "job-1", ownerPluginId: "fixture-product-plugin", productStepId: "step-1",
    callId: "call-1", childCapabilityId: "open_gpt_model_selector_v2",
    inputHash: hash, actionOrdinal: 1, targetRef: "target-1", effectScope: "target_local",
  })?.state, "dispatched");
  assert.equal(store.atomicStepRecovery({
    jobId: "job-1", ownerPluginId: "fixture-product-plugin", productStepId: "step-1",
    callId: "call-1", childCapabilityId: "open_gpt_model_selector_v2",
    inputHash: hash, actionOrdinal: 1, targetRef: "target-2", effectScope: "target_local",
  }), null, "target-local recovery identity must not cross Target generations");
  store.resolve({ commandId: "command-1", ownerPluginId: "fixture-product-plugin", targetRef: "target-1", state: "REJECTED", proofHash: hash });
  assert.equal(store.callRecoveryScope({
    jobId: "job-1", ownerPluginId: "fixture-product-plugin", productStepId: "step-1",
  }), null, "a target-local REJECTED action must not preserve and globally block the old Target");
  store.prepare({
    commandId: "command-new-target", logicalMutationId: `sha256:${"e".repeat(64)}`,
    ownerPluginId: "fixture-product-plugin", jobId: "job-1", attemptId: "attempt-2", leaseVersion: 2,
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
    ownerPluginId: "fixture-product-plugin", jobId: "job-1", attemptId: "attempt-2", leaseVersion: 2,
    executionFenceHash: hash, targetRef: "target-2", documentRef: "document-2",
    productStepId: "step-provider", callId: "call-provider", childCapabilityId: "submit_exact_gpt_turn_once",
    effectScope: "provider_effect", actionOrdinal: 13,
    actionId: "browser.dom.click.v1", positivePostconditionHash: hash,
    negativePostconditionHash: negativeHash, requestHash: hash, payloadHash: hash,
  });
  store.markDispatched("command-provider-effect");
  store.markConfirmed("command-provider-effect", hash);
  assert.equal(store.atomicStepRecovery({
    jobId: "job-1", ownerPluginId: "fixture-product-plugin", productStepId: "step-provider",
    callId: "call-provider", childCapabilityId: "submit_exact_gpt_turn_once",
    inputHash: hash, actionOrdinal: 13, targetRef: "target-replacement", effectScope: "provider_effect",
  })?.state, "confirmed", "provider effects must recover across Target/attempt generations without replay");
  store.close();
  process.stdout.write("LOCAL_BROWSER_RULE_MUTANTS_PASS\n");
} finally {
  await rm(root, { recursive: true, force: true });
}
