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
const identity = (attemptId: string, revision = 0): BrowserMutationIdentity => Object.freeze({
  commandId: `command:${attemptId}:${revision}`,
  logicalMutationId: hash(`provider-effect:${revision}`),
  exactCallIdentityHash: hash(`exact-call:${revision}`),
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
  requestHash: hash(`request:${revision}`),
  payloadHash: hash(`payload:${revision}`),
});

const root = await mkdtemp(path.join(tmpdir(), "browser-attempt-fence-"));
try {
  const store = new BrowserMutationStore(root);
  const first = identity("attempt:1");
  const terminalPayload = {
    canonicalConversationUrl: "https://chatgpt.com/c/consultation-1",
    promptHash: hash("prompt"), userTurnId: "conversation-turn-1",
    exactCallIdentityHash: first.exactCallIdentityHash,
    observationRevisionHash: hash("observation"),
    targetRefHash: hash(first.targetRef), documentRefHash: hash(first.documentRef),
    rawCount: 1, eligibleCount: 1,
  };
  store.prepare(first);
  store.markDispatched(first.commandId);
  store.markConfirmed(first.commandId, hash("terminal-proof"), "confirmed", terminalPayload);
  assert.throws(() => store.prepare({ ...first, commandId: "command:attempt:1:again" }),
    /BROWSER_PROVIDER_EFFECT_REPLAY_FORBIDDEN|BROWSER_EXACT_CALL_REPLAY_FORBIDDEN/u,
    "one provider effect may dispatch only once inside an attempt");
  const second = identity("attempt:2");
  assert.equal(first.logicalMutationId, second.logicalMutationId);
  assert.throws(() => store.prepare(second),
    /BROWSER_PROVIDER_EFFECT_REPLAY_FORBIDDEN|BROWSER_EXACT_CALL_REPLAY_FORBIDDEN/u,
    "the same provider effect remains single-submit across attempts");
  const recovered = store.readAtomicStepOutcome({
    jobId: second.jobId, attemptId: second.attemptId, ownerPluginId: second.ownerPluginId,
    pluginVersion: second.pluginVersion, exactCallIdentityHash: second.exactCallIdentityHash,
    actionOrdinal: second.actionOrdinal, targetRef: second.targetRef, effectScope: "provider_effect",
  });
  assert.equal(recovered?.state, "confirmed");
  assert.deepEqual(recovered?.terminalPayload, terminalPayload);
  store.recordContinuation(`browser-mutation:${first.commandId}`, {
    sourceTaskRef: "task:bz05",
    consultationIdentityHash: hash("consultation-identity"),
  }, {
    canonicalConversationUrl: "https://chatgpt.com/c/consultation-1",
    promptHash: hash("prompt"), turnMarker: "[GRASSEYE:root]",
    assistantTurnId: "conversation-turn-2", semanticTextHash: hash("response"),
  });
  assert.doesNotThrow(() => store.recordContinuation(`browser-mutation:${first.commandId}`, {
    sourceTaskRef: "task:bz05",
    consultationIdentityHash: hash("consultation-identity"),
  }, {
    canonicalConversationUrl: "https://chatgpt.com/c/consultation-1",
    promptHash: hash("prompt"), turnMarker: "[GRASSEYE:root]",
    assistantTurnId: "conversation-turn-2", semanticTextHash: hash("response"),
  }));
  store.close();

  const restarted = new BrowserMutationStore(root);
  assert.deepEqual(restarted.readContinuation({
    consultationIdentityHash: hash("consultation-identity"),
    predecessorSourceTaskRef: "task:bz05",
  }), {
    canonicalConversationUrl: "https://chatgpt.com/c/consultation-1",
    promptHash: hash("prompt"), turnMarker: "[GRASSEYE:root]",
    assistantTurnId: "conversation-turn-2", semanticTextHash: hash("response"),
  });
  assert.throws(() => restarted.readContinuation({
    consultationIdentityHash: hash("wrong-consultation"),
    predecessorSourceTaskRef: "task:bz05",
  }), /BROWSER_CONTINUATION_MISSING/u, "wrong consultation identity fails closed");
  assert.throws(() => restarted.readContinuation({
    consultationIdentityHash: hash("consultation-identity"),
    predecessorSourceTaskRef: "task:wrong-predecessor",
  }), /BROWSER_CONTINUATION_FRONTIER_MISMATCH/u, "wrong direct predecessor fails closed");
  assert.throws(() => restarted.recordContinuation(`browser-mutation:${first.commandId}`, {
    sourceTaskRef: "task:other",
    consultationIdentityHash: hash("consultation-identity"),
  }, {
    canonicalConversationUrl: "https://chatgpt.com/c/consultation-1",
    promptHash: hash("prompt"), turnMarker: "[GRASSEYE:root]",
    assistantTurnId: "conversation-turn-2", semanticTextHash: hash("response"),
  }), /BROWSER_CONTINUATION_BINDING_INVALID/u, "a completed checkpoint cannot be rebound");
  assert.doesNotThrow(() => restarted.prepare(identity("attempt:2", 1)),
    "a Website-authorized new result revision receives a new provider effect");
  restarted.close();
} finally {
  await rm(root, { recursive: true, force: true });
}

process.stdout.write("LOCAL_BROWSER_ATTEMPT_FENCE_ACCEPTANCE_PASS\n");
