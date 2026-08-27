import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";

const root = await mkdtemp(join(tmpdir(), "browser-mutation-attacks-"));
const hash = `sha256:${"b".repeat(64)}` as const;
try {
  const store = new BrowserMutationStore(root);
  store.prepare({
    commandId: "command-1", ownerPluginId: "fixture-product-plugin",
    jobId: "job-1", attemptId: "attempt-1", leaseVersion: 1,
    executionFenceHash: hash, targetRef: "target-1", documentRef: "document-1",
    actionId: "browser.dom.click.v1", requestHash: hash, payloadHash: hash,
  });
  assert.throws(() => store.resolve({ commandId: "command-1", ownerPluginId: "fixture-product-plugin", targetRef: "target-1", state: "CONFIRMED", proofHash: hash }), /BROWSER_OUTCOME_UNKNOWN/u);
  store.markSent("command-1");
  store.markUnknown("command-1", "transport outcome unknown");
  assert.throws(() => store.resolve({ commandId: "command-1", ownerPluginId: "foreign-owner", targetRef: "target-1", state: "CONFIRMED", proofHash: hash }), /BROWSER_OUTCOME_UNKNOWN/u);
  assert.throws(() => store.resolve({ commandId: "command-1", ownerPluginId: "fixture-product-plugin", targetRef: "target-2", state: "CONFIRMED", proofHash: hash }), /BROWSER_OUTCOME_UNKNOWN/u);
  assert.equal(store.readUnknown("command-1")?.commandId, "command-1");
  store.close();
  process.stdout.write("LOCAL_BROWSER_RULE_MUTANTS_PASS\n");
} finally {
  await rm(root, { recursive: true, force: true });
}
