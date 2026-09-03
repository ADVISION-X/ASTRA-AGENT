import assert from "../../../../scripts/audit/shared/governance-exam-assert.js";

import { executionFailure } from "../../../lib/execution-failure.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";
import { coherentObservationPacket, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";
import { providerAttachmentName } from "./gpt-exact-target-source-support.js";

const { execute } = createGptAcceptanceHarness("gpt-attachment");
const sha256 = `sha256:${"1".repeat(64)}` as const;
const approvedAttachment = Object.freeze({
  artifactRef: "artifact:1", displayName: "甲.pdf", sha256, bytes: 10,
});
const attachmentFacts = (ready: boolean) => ({
  "attachment-region": { rawCount: 1, eligibleCount: 1 },
  "attachment-items": {
    rawCount: 1, eligibleCount: 1,
    matches: [{ ariaLabel: providerAttachmentName("甲.pdf", "artifact:1") }],
  },
  "attachment-ready": { rawCount: ready ? 1 : 0, eligibleCount: ready ? 1 : 0 },
  "attachment-uploading": { rawCount: ready ? 0 : 1, eligibleCount: ready ? 0 : 1 },
});

const attachmentFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") return coherentObservationPacket(intent, attachmentFacts(false));
  throw new Error(`UNEXPECTED_ATTACHMENT_READBACK_INTENT:${intent.kind}`);
});
const attachmentReadback = await execute("attach_approved_gpt_files_once", attachmentFixture.browser, {
  files: [approvedAttachment],
}, "readback");
assert.equal(attachmentReadback.status, "failed");
assert.equal(attachmentReadback.failureCode, "GPT_ATTACHMENT_BROWSER_ARTIFACT_GRANT_REQUIRED");
assert.equal(attachmentFixture.documentCalls(), 0,
  "blocked attachment execution must not infer a valid prior dispatch from DOM state");
assert.equal(attachmentFixture.physicalMutations(), 0,
  "blocked attachment execution must never dispatch or replay an upload");

const attachmentMutationBlockedFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") return coherentObservationPacket(intent, {
    "attachment-control": { rawCount: 1, eligibleCount: 1 },
    "upload-choice": { rawCount: 1, eligibleCount: 1 },
  });
  throw new Error(`UNEXPECTED_ATTACHMENT_MUTATION_INTENT:${intent.kind}`);
});
const attachmentMutationBlocked = await execute(
  "attach_approved_gpt_files_once",
  attachmentMutationBlockedFixture.browser,
  { files: [approvedAttachment] },
);
assert.equal(attachmentMutationBlocked.status, "failed");
assert.equal(attachmentMutationBlocked.failureCode, "GPT_ATTACHMENT_BROWSER_ARTIFACT_GRANT_REQUIRED");
assert.equal(attachmentMutationBlockedFixture.documentCalls(), 0);
assert.equal(attachmentMutationBlockedFixture.physicalMutations(), 0,
  "GPT must fail closed instead of registering a path or dispatching a Browser upload");

const extraFieldBlocked = await execute(
  "attach_approved_gpt_files_once",
  attachmentMutationBlockedFixture.browser,
  { files: [{ ...approvedAttachment, filePath: "/forbidden/path" }] } as never,
);
assert.equal(extraFieldBlocked.status, "failed");
assert.equal(extraFieldBlocked.failureCode, "GPT_ATTACHMENT_INPUT_INVALID");

let uploadObservations = 0;
const uploadingFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") {
    uploadObservations += 1;
    return coherentObservationPacket(intent, attachmentFacts(uploadObservations >= 3));
  }
  throw new Error(`UNEXPECTED_ATTACHMENT_UPLOAD_INTENT:${intent.kind}`);
});
const uploaded = await execute("reconcile_gpt_attachment_set", uploadingFixture.browser, {
  files: [approvedAttachment], timeoutMs: 2_000,
});
assert.equal(uploaded.status, "success", uploaded.failureCode ?? "uploaded attachment reconciliation failed");
assert.equal(uploaded.value?.files[0]?.providerDisplayName, providerAttachmentName("甲.pdf", "artifact:1"));
assert.equal(uploadObservations, 3, "attachment name alone must not complete reconciliation");
assert.equal(uploadingFixture.waitDurations().length, 2, "pending upload must wait only between fresh observations");
assert.equal(uploadingFixture.physicalMutations(), 0, "attachment reconciliation must remain read-only");
assert.equal(uploaded.proof.observationRevisionHash, `sha256:${"4".repeat(64)}`);
assert.deepEqual(uploaded.proof.candidateCardinality, { raw: 1, eligible: 1 });

let staleReadyReads = 0;
const staleAttachmentFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") {
    staleReadyReads += 1;
    if (staleReadyReads === 1) throw executionFailure("failed", "BROWSER_DOM_NODE_STALE");
    return coherentObservationPacket(intent, attachmentFacts(true));
  }
  throw new Error(`UNEXPECTED_STALE_ATTACHMENT_INTENT:${intent.kind}`);
});
const recoveredStaleAttachment = await execute("reconcile_gpt_attachment_set", staleAttachmentFixture.browser, {
  files: [approvedAttachment], timeoutMs: 2_000,
});
assert.equal(recoveredStaleAttachment.status, "success",
  recoveredStaleAttachment.failureCode ?? "stale attachment observation did not recover");
assert.equal(staleReadyReads, 2, "stale attachment nodes must be discarded and queried fresh");
assert.equal(staleAttachmentFixture.physicalMutations(), 0, "stale attachment recovery must remain read-only");

let simulatedNow = 0;
const delayedUploadFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") {
    return coherentObservationPacket(intent, attachmentFacts(simulatedNow >= 61_000));
  }
  throw new Error(`UNEXPECTED_DELAYED_ATTACHMENT_INTENT:${intent.kind}`);
}, { onWait: (durationMs) => { simulatedNow += durationMs; } });
const nativeDateNow = Date.now;
Date.now = () => simulatedNow;
try {
  const delayedUpload = await execute("reconcile_gpt_attachment_set", delayedUploadFixture.browser, {
    files: [approvedAttachment], timeoutMs: 70_000,
  });
  assert.equal(delayedUpload.status, "success", delayedUpload.failureCode ?? "delayed attachment upload failed");
  assert.ok(simulatedNow >= 61_000, "upload completion must be observed after the retired 60s ceiling");
} finally {
  Date.now = nativeDateNow;
}

const uploadTimeoutFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") return coherentObservationPacket(intent, attachmentFacts(false));
  throw new Error(`UNEXPECTED_ATTACHMENT_TIMEOUT_INTENT:${intent.kind}`);
});
const uploadTimedOut = await execute("reconcile_gpt_attachment_set", uploadTimeoutFixture.browser, {
  files: [approvedAttachment], timeoutMs: 1_000,
});
assert.equal(uploadTimedOut.status, "failed");
assert.equal(uploadTimedOut.failureCode, "GPT_ATTACHMENT_UPLOAD_TIMEOUT:ready=0:uploading=1:expected=1");
assert.equal(uploadTimeoutFixture.physicalMutations(), 0, "timed-out reconciliation must never mutate the page");
