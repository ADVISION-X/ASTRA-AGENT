import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { assertBrowserDomIntent } from "../../src/lib/browser/exact-target/browser-dom-intent.js";

const root = await mkdtemp(join(tmpdir(), "browser-mutation-attacks-"));
const hash = `sha256:${"b".repeat(64)}` as const;
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
  const store = new BrowserMutationStore(root);
  store.prepare({
    commandId: "command-1", logicalMutationId, ownerPluginId: "fixture-product-plugin",
    jobId: "job-1", attemptId: "attempt-1", leaseVersion: 1,
    executionFenceHash: hash, targetRef: "target-1", documentRef: "document-1",
    actionId: "browser.dom.click.v1", requestHash: hash, payloadHash: hash,
  });
  assert.throws(() => store.resolve({ commandId: "command-1", ownerPluginId: "fixture-product-plugin", targetRef: "target-1", state: "CONFIRMED", proofHash: hash }), /BROWSER_OUTCOME_UNKNOWN/u);
  store.markSent("command-1");
  store.markUnknown("command-1", "transport outcome unknown");
  assert.throws(() => store.prepare({
    commandId: "command-retry", logicalMutationId, ownerPluginId: "fixture-product-plugin",
    jobId: "job-1", attemptId: "attempt-2", leaseVersion: 2,
    executionFenceHash: hash, targetRef: "target-1", documentRef: "document-1",
    actionId: "browser.dom.click.v1", requestHash: hash, payloadHash: hash,
  }), /BROWSER_LOGICAL_MUTATION_REPLAY_FORBIDDEN/u);
  assert.throws(() => store.resolve({ commandId: "command-1", ownerPluginId: "foreign-owner", targetRef: "target-1", state: "CONFIRMED", proofHash: hash }), /BROWSER_OUTCOME_UNKNOWN/u);
  assert.throws(() => store.resolve({ commandId: "command-1", ownerPluginId: "fixture-product-plugin", targetRef: "target-2", state: "CONFIRMED", proofHash: hash }), /BROWSER_OUTCOME_UNKNOWN/u);
  assert.equal(store.readUnknown("command-1")?.commandId, "command-1");
  store.close();
  process.stdout.write("LOCAL_BROWSER_RULE_MUTANTS_PASS\n");
} finally {
  await rm(root, { recursive: true, force: true });
}
