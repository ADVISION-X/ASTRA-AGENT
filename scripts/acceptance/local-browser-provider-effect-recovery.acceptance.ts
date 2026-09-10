import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  BrowserMutationStore,
  type BrowserMutationIdentity,
} from "../../src/lib/browser/exact-target/browser-mutation-store.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const identity = (attemptId: string): BrowserMutationIdentity => Object.freeze({
  commandId: `command:${attemptId}`,
  logicalMutationId: hash(`provider-effect:${attemptId}`),
  exactCallIdentityHash: hash(`exact-call:${attemptId}`),
  ownerPluginId: "acceptance-product",
  pluginVersion: 1,
  jobId: "job:fresh-attempt",
  attemptId,
  leaseVersion: attemptId === "attempt:1" ? 1 : 2,
  executionFenceHash: hash(`fence:${attemptId}`),
  productStepId: "provider-submit",
  callId: "submit-once",
  childCapabilityId: "submit_exact_gpt_turn_once",
  effectScope: "provider_effect",
  actionOrdinal: 1,
  targetRef: `target:${attemptId}`,
  documentRef: `document:${attemptId}`,
  actionId: "browser.dom.click.v1",
  positivePostconditionHash: hash("positive"),
  negativePostconditionHash: hash("negative"),
  requestHash: hash("request"),
  payloadHash: hash("payload"),
});

const root = await mkdtemp(path.join(tmpdir(), "browser-attempt-fence-"));
try {
  const store = new BrowserMutationStore(root);
  const first = identity("attempt:1");
  store.prepare(first);
  store.markDispatched(first.commandId);
  assert.throws(() => store.prepare({ ...first, commandId: "command:attempt:1:again" }),
    /BROWSER_PROVIDER_EFFECT_REPLAY_FORBIDDEN|BROWSER_EXACT_CALL_REPLAY_FORBIDDEN/u,
    "one provider effect may dispatch only once inside an attempt");
  const second = identity("attempt:2");
  assert.notEqual(first.logicalMutationId, second.logicalMutationId);
  assert.doesNotThrow(() => store.prepare(second),
    "a Website-issued new attempt must receive a new provider-effect identity");
  store.close();
} finally {
  await rm(root, { recursive: true, force: true });
}

process.stdout.write("LOCAL_BROWSER_ATTEMPT_FENCE_ACCEPTANCE_PASS\n");
