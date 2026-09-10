import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";

export const hash = `sha256:${"a".repeat(64)}` as const;
export const exactHash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
export const valueHash = (value: unknown): `sha256:${string}` => exactHash(JSON.stringify(value));

const identity = (commandId: string, attemptId: string) => ({
  commandId,
  exactCallIdentityHash: exactHash(`${attemptId}:${commandId}`),
  ownerPluginId: "fixture-product-plugin",
  pluginVersion: 1,
  jobId: "job-1",
  attemptId,
  leaseVersion: 1,
  executionFenceHash: hash,
  productStepId: "step-1",
  childCapabilityId: "open_gpt_model_selector_v2",
  callId: "call-1",
  effectScope: "target_local" as const,
  actionOrdinal: 1,
  targetRef: "target-1",
  documentRef: "document-1",
  actionId: "browser.dom.click.v1",
  positivePostconditionHash: hash,
  negativePostconditionHash: `sha256:${"b".repeat(64)}` as const,
  requestHash: hash,
  payloadHash: hash,
});

export const exerciseBrowserMutationStore = (root: string): void => {
  const first = new BrowserMutationStore(root);
  first.prepare(identity("old-command", "attempt-1"));
  first.markDispatched("old-command");
  first.close();

  const restarted = new BrowserMutationStore(root);
  assert.deepEqual(restarted.dispatchedForBinding({
    jobId: "job-1", attemptId: "attempt-2", leaseVersion: 1, executionFenceHash: hash,
  }), [], "a new attempt must not inherit old pending mutations");
  restarted.prepare(identity("new-command", "attempt-2"));
  restarted.markDispatched("new-command");
  assert.deepEqual(restarted.dispatchedForBinding({
    jobId: "job-1", attemptId: "attempt-2", leaseVersion: 1, executionFenceHash: hash,
  }), ["new-command"]);
  restarted.close();
};
