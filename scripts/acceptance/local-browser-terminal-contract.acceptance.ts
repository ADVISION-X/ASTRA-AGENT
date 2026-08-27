import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";

const hash = `sha256:${"a".repeat(64)}` as const;
const identity = (commandId: string) => ({
  commandId,
  ownerPluginId: "fixture-product-plugin",
  jobId: "job-1",
  attemptId: "attempt-1",
  leaseVersion: 1,
  executionFenceHash: hash,
  targetRef: "target-1",
  documentRef: "document-1",
  actionId: "browser.dom.click.v1",
  requestHash: hash,
  payloadHash: hash,
});

const root = await mkdtemp(join(tmpdir(), "browser-mutation-state-"));
try {
  const first = new BrowserMutationStore(root);
  first.prepare(identity("sent-command"));
  first.markSent("sent-command");
  first.prepare(identity("prepared-command"));
  first.close();

  const restarted = new BrowserMutationStore(root);
  assert.deepEqual(restarted.unknownForBinding({
    jobId: "job-1", attemptId: "attempt-1", leaseVersion: 1, executionFenceHash: hash,
  }), ["sent-command"]);
  assert.equal(restarted.readUnknown("prepared-command"), null);
  restarted.resolve({
    commandId: "sent-command",
    ownerPluginId: "fixture-product-plugin",
    targetRef: "target-1",
    state: "CONFIRMED",
    proofHash: hash,
  });
  assert.deepEqual(restarted.unknownForBinding({
    jobId: "job-1", attemptId: "attempt-1", leaseVersion: 1, executionFenceHash: hash,
  }), []);
  restarted.close();

  const supervisor = readFileSync("src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts", "utf8");
  const actor = readFileSync("src/lib/browser/exact-target/browser-command-actor.ts", "utf8");
  assert.match(supervisor, /new BrowserMutationStore\(this\.options\.dataDir\)/u);
  assert.match(actor, /markSent[\s\S]*markUnknown/u);
  assert.doesNotMatch(`${supervisor}\n${actor}`, /BrowserProofJournal|proof-events\.ndjson/u);
  process.stdout.write("LOCAL_BROWSER_TERMINAL_CONTRACT_PASS\n");
} finally {
  await rm(root, { recursive: true, force: true });
}
