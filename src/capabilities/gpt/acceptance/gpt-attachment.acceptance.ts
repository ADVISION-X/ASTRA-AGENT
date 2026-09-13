import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import { executionFailure } from "../../../lib/execution-failure.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";
import { coherentObservationPacket, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";
import { providerAttachmentName } from "./gpt-exact-target-source-support.js";
import {
  GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR,
  GPT_ATTACHMENT_CONTROL_SELECTOR,
  GPT_ATTACHMENT_PENDING_ACTION_SELECTOR,
  GPT_COMPOSER_FORM_SELECTOR,
} from "./gpt-page-fixture-selectors.js";
import {
  approvedAttachment, attachmentControlFacts, exerciseAttachmentNameNormalization,
  hiddenPopoverRejections,
} from "./gpt-attachment-name.acceptance-support.js";

const { execute } = createGptAcceptanceHarness("gpt-attachment");
exerciseAttachmentNameNormalization();

{
  let simulatedNow = 0;
  let observeCount = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      observeCount += 1;
      return coherentObservationPacket(intent, attachmentControlFacts(simulatedNow === 0 ? "absent" : "closed"));
    }
    if (intent.kind === "click" && intent.selector === GPT_ATTACHMENT_CONTROL_SELECTOR) {
      assert.deepEqual(intent.scope, { selector: GPT_COMPOSER_FORM_SELECTOR });
      assert.equal(intent.postClickObservation?.timeoutMs, 5_000);
      assert.equal(intent.postClickObservation?.queries.find((query) => query.queryId === "active-menu")?.maxMatches, 2,
        "the GPT menu query must remain inside the Browser permit's 1..20 bound");
      assert.deepEqual(intent.postClickObservation?.queries.map((query) => [
        query.queryId, query.scope?.selector, query.expectedEligibleCount,
      ]), [
        ["attachment-control", GPT_COMPOSER_FORM_SELECTOR, 1],
        ["active-menu", undefined, 1],
        ["upload-choice", GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR, 1],
      ]);
      assert.deepEqual(intent.postClickObservation?.queries.map((query) => [
        query.queryId, query.fields,
      ]), [
        ["attachment-control", ["disabled", "ariaDisabled"]],
        ["active-menu", []],
        ["upload-choice", []],
      ], "attachment admission must not invent ARIA owner or expansion requirements");
      const queries = intent.postClickObservation!.queries
        .map(({ expectedEligibleCount: _expected, ...query }) => query);
      return {
        postconditionVerified: true,
        postconditionObservation: coherentObservationPacket({ queries }, attachmentControlFacts("open")),
      };
    }
    throw new Error(`UNEXPECTED_ATTACHMENT_CONTROL_HYDRATION_INTENT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("open_gpt_attachment_control", fixture.browser, {});
    assert.equal(result.status, "success", result.failureCode ?? "attachment control hydration failed");
    assert.equal(result.value?.state, "upload-choice-ready");
    assert.equal(observeCount, 2,
      "fully absent attachment control must hydrate before the one click and never read again after it");
    assert.equal(fixture.waitDurations().length, 1);
    assert.equal(fixture.physicalMutations(), 1);
    assert.deepEqual(result.proof.candidateCardinality, { raw: 19, eligible: 1 },
      "scoped exact text eligibility, not global raw count, must settle the menu");
  } finally {
    Date.now = nativeDateNow;
  }
}

{
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, attachmentControlFacts("open"));
    throw new Error(`ATTACHMENT_ALREADY_DONE_MUST_NOT_ACT:${intent.kind}`);
  });
  const result = await execute("open_gpt_attachment_control", fixture.browser, {});
  assert.equal(result.status, "success", result.failureCode ?? "attachment DONE readback failed");
  assert.equal(result.value?.state, "upload-choice-ready");
  assert.equal(fixture.physicalMutations(), 0, "an already-DONE attachment menu must not click again");
}

{
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      ...attachmentControlFacts("closed"),
      "attachment-control": { rawCount: 2, eligibleCount: 2 },
    });
    throw new Error(`ATTACHMENT_PARTIAL_CONFLICT_MUST_NOT_ACT:${intent.kind}`);
  });
  const result = await execute("open_gpt_attachment_control", fixture.browser, {});
  assert.equal(result.status, "failed");
  assert.ok(result.failureCode?.startsWith("GPT_ATTACHMENT_CONTROL_QUALIFICATION_INVALID:"));
  assert.ok(result.failureCode?.includes("attachment-control[scope=1/1;raw=2;eligible=2"));
  assert.equal(result.proof.observationRevisionHash, `sha256:${"4".repeat(64)}`);
  assert.equal(fixture.waitDurations().length, 0);
  assert.equal(fixture.physicalMutations(), 0);
}

{
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      ...attachmentControlFacts("closed"),
      "attachment-control": {
        scopeRawCount: 2, scopeEligibleCount: 1,
        rawCount: 1, eligibleCount: 1,
        scopeRejections: [{ index: 1, reasons: ["INERT"] }],
      },
    });
    throw new Error(`ATTACHMENT_SCOPE_AMBIGUITY_MUST_NOT_ACT:${intent.kind}`);
  });
  const result = await execute("open_gpt_attachment_control", fixture.browser, {});
  assert.equal(result.status, "failed");
  assert.ok(result.failureCode?.startsWith("GPT_ATTACHMENT_CONTROL_QUALIFICATION_INVALID:"));
  assert.ok(result.failureCode?.includes("attachment-control[scope=2/1;raw=1;eligible=1;rejected=1.INERT"));
  assert.equal(fixture.waitDurations().length, 0,
    "an ineligible competing composer scope must fail without waiting");
  assert.equal(fixture.physicalMutations(), 0);
}

for (const conflict of ["control-ineligible", "active-scope-ambiguous", "leaf-missing", "leaf-ambiguous"] as const) {
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      const facts = attachmentControlFacts(conflict === "control-ineligible" ? "closed" : "open");
      if (conflict === "control-ineligible") return coherentObservationPacket(intent, {
        ...facts,
        "attachment-control": {
          rawCount: 1, eligibleCount: 0,
          rejections: [{ index: 0, reasons: ["NO_LAYOUT_BOX"] }],
          nativeCauseCode: "NO_LAYOUT_BOX", nativeCauseCount: 1,
        },
      });
      if (conflict === "active-scope-ambiguous") return coherentObservationPacket(intent, {
        ...facts,
        "upload-choice": {
          scopeRawCount: 23, scopeEligibleCount: 2,
          scopeRejections: hiddenPopoverRejections.slice(0, 21),
          rawCount: 2, eligibleCount: 2,
        },
      });
      if (conflict === "leaf-missing") return coherentObservationPacket(intent, {
        ...facts,
        "upload-choice": {
          scopeRawCount: 23, scopeEligibleCount: 1,
          scopeRejections: hiddenPopoverRejections,
          rawCount: 19, eligibleCount: 0,
          rejections: Array.from({ length: 19 }, (_, index) => ({ index, reasons: ["TEXT_MISMATCH"] })),
        },
      });
      return coherentObservationPacket(intent, {
        ...facts,
        "upload-choice": {
          scopeRawCount: 23, scopeEligibleCount: 1,
          scopeRejections: hiddenPopoverRejections,
          rawCount: 19, eligibleCount: 2,
          rejections: Array.from({ length: 17 }, (_, index) => ({ index: index + 2, reasons: ["TEXT_MISMATCH"] })),
        },
      });
    }
    throw new Error(`ATTACHMENT_CONFLICT_MUST_NOT_ACT:${conflict}:${intent.kind}`);
  });
  const result = await execute("open_gpt_attachment_control", fixture.browser, {});
  assert.equal(result.status, "failed");
  assert.ok(result.failureCode?.startsWith("GPT_ATTACHMENT_CONTROL_QUALIFICATION_INVALID:"));
  assert.ok(result.failureCode?.includes("attachment-control["));
  assert.ok(result.failureCode?.includes("upload-choice["));
  assert.ok(result.failureCode?.includes(`revision=sha256:${"4".repeat(64)}`));
  if (conflict === "control-ineligible") {
    assert.ok(result.failureCode?.includes("native=NO_LAYOUT_BOX/1"));
    assert.equal(result.proof.nativeFailureCode, "NO_LAYOUT_BOX");
  }
  assert.equal(result.proof.observationRevisionHash, `sha256:${"4".repeat(64)}`);
  assert.equal(fixture.waitDurations().length, 0, "attachment partial conflicts must fail without waiting");
  assert.equal(fixture.physicalMutations(), 0);
}

{
  let observations = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      observations += 1;
      return coherentObservationPacket(intent, attachmentControlFacts("closed"));
    }
    if (intent.kind === "click" && intent.postClickObservation) {
      const queries = intent.postClickObservation.queries
        .map(({ expectedEligibleCount: _expected, ...query }) => query);
      return {
        postconditionVerified: true,
        postconditionObservation: coherentObservationPacket({ queries }, {
          ...attachmentControlFacts("open"),
          "upload-choice": {
            scopeRawCount: 23, scopeEligibleCount: 1,
            scopeRejections: hiddenPopoverRejections,
            rawCount: 19, eligibleCount: 0,
            rejections: Array.from({ length: 19 }, (_, index) => ({ index, reasons: ["TEXT_MISMATCH"] })),
          },
        }),
      };
    }
    throw new Error(`ATTACHMENT_FAILED_POSTCONDITION_MUST_NOT_REREAD:${intent.kind}`);
  });
  const result = await execute("open_gpt_attachment_control", fixture.browser, {});
  assert.equal(result.status, "failed");
  assert.ok(result.failureCode?.startsWith("GPT_ATTACHMENT_CONTROL_OPEN_PENDING:"));
  assert.equal(result.proof.committedMutation, "confirmed");
  assert.equal(result.proof.postconditionResult, "failed");
  assert.equal(observations, 1, "a failed attachment postcondition must not issue a follow-up DOM observation");
  assert.equal(fixture.physicalMutations(), 1);
}

{
  let simulatedNow = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, attachmentControlFacts("absent"));
    throw new Error(`ATTACHMENT_TIMEOUT_MUST_NOT_ACT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("open_gpt_attachment_control", fixture.browser, {});
    assert.equal(result.status, "failed");
    assert.ok(result.failureCode?.startsWith("GPT_ATTACHMENT_CONTROL_HYDRATION_TIMEOUT:"));
    assert.equal(simulatedNow, 5_000, "attachment hydration must not exceed its strict five-second ceiling");
    assert.equal(fixture.physicalMutations(), 0);
  } finally {
    Date.now = nativeDateNow;
  }
}

for (const driftField of ["targetRefHash", "documentRefHash"] as const) {
  let simulatedNow = 0;
  let observations = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      observations += 1;
      const packet = coherentObservationPacket(intent,
        attachmentControlFacts(observations === 1 ? "absent" : "closed"));
      return observations === 1 ? packet : { ...packet, [driftField]: `sha256:${"5".repeat(64)}` };
    }
    throw new Error(`ATTACHMENT_DOCUMENT_DRIFT_MUST_NOT_ACT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("open_gpt_attachment_control", fixture.browser, {});
    assert.equal(result.status, "failed");
    assert.ok(result.failureCode?.startsWith("GPT_ATTACHMENT_CONTROL_HYDRATION_DOCUMENT_CHANGED:"));
    assert.equal(result.proof.committedMutation, "no");
    assert.equal(fixture.physicalMutations(), 0);
  } finally {
    Date.now = nativeDateNow;
  }
}

const attachmentFacts = (
  ready: boolean,
  pending = false,
  observedLabel = providerAttachmentName("甲.pdf", "artifact:1"),
) => ({
  "attachment-composer": { rawCount: 1, eligibleCount: 1 },
  "attachment-items": {
    rawCount: 1, eligibleCount: 1,
    matches: [{ ariaLabel: observedLabel }],
  },
  "attachment-uploading": { rawCount: ready ? 0 : 1, eligibleCount: ready ? 0 : 1 },
  "attachment-pending": { rawCount: pending ? 1 : 0, eligibleCount: pending ? 1 : 0 },
});

let attachedInput: unknown = null;
const attachmentMutationFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") return coherentObservationPacket(intent, {
    "attachment-control": { rawCount: 1, eligibleCount: 1 },
    "upload-choice": { rawCount: 1, eligibleCount: 1 },
  });
  throw new Error(`UNEXPECTED_ATTACHMENT_MUTATION_INTENT:${intent.kind}`);
}, {
  onAttachFile: (input) => { attachedInput = input; },
});
const attachmentMutation = await execute(
  "attach_approved_gpt_files_once",
  attachmentMutationFixture.browser,
  { files: [approvedAttachment] },
);
assert.equal(attachmentMutation.status, "success", attachmentMutation.failureCode ?? "attachment dispatch failed");
assert.equal(attachmentMutation.value?.mutationSent, true);
assert.deepEqual(attachedInput, {
  selector: "#upload-files",
  activation: {
    selector: "div.__menu-item[tabindex='0'] span",
    scope: { selector: "#thread-bottom div.popover[aria-busy='false']" },
    expectedTextEquals: "从电脑上传",
  },
  approvedArtifacts: [{
    artifactRef: approvedAttachment.artifactRef,
    providerDisplayName: providerAttachmentName(approvedAttachment.displayName, approvedAttachment.artifactRef),
    expectedSha256: approvedAttachment.sha256,
    bytes: approvedAttachment.bytes,
  }],
});
assert.equal(attachmentMutation.proof.committedMutation, "confirmed");
assert.equal(attachmentMutationFixture.documentCalls(), 1);
assert.equal(attachmentMutationFixture.physicalMutations(), 1,
  "GPT must send one approved artifact-ref batch to Browser Authority");

const extraFieldBlocked = await execute(
  "attach_approved_gpt_files_once",
  attachmentMutationFixture.browser,
  { files: [{ ...approvedAttachment, filePath: "/forbidden/path" }] } as never,
);
assert.equal(extraFieldBlocked.status, "failed");
assert.equal(extraFieldBlocked.failureCode, "GPT_ATTACHMENT_INPUT_INVALID");

let uploadObservations = 0;
const uploadingFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") {
    uploadObservations += 1;
    assert.deepEqual(intent.queries.map((query) => [query.queryId, query.scope?.selector]), [
      ["attachment-composer", undefined],
      ["attachment-items", GPT_COMPOSER_FORM_SELECTOR],
      ["attachment-uploading", GPT_COMPOSER_FORM_SELECTOR],
      ["attachment-pending", GPT_COMPOSER_FORM_SELECTOR],
    ], "attachment readiness must use one composer-scoped card/spinner/pending observation without a ready-icon reader");
    assert.equal(intent.queries.find((query) => query.queryId === "attachment-pending")?.selector,
      GPT_ATTACHMENT_PENDING_ACTION_SELECTOR, "readiness must consume the one live-proven Provider busy signal");
    return coherentObservationPacket(intent, uploadObservations === 1
      ? attachmentFacts(false) : attachmentFacts(true, uploadObservations === 2));
  }
  throw new Error(`UNEXPECTED_ATTACHMENT_UPLOAD_INTENT:${intent.kind}`);
});
const uploaded = await execute("reconcile_gpt_attachment_set", uploadingFixture.browser, {
  files: [approvedAttachment], timeoutMs: 10_000,
});
assert.equal(uploaded.status, "success", uploaded.failureCode ?? "uploaded attachment reconciliation failed");
assert.equal(uploaded.value?.files[0]?.providerDisplayName, providerAttachmentName("甲.pdf", "artifact:1"));
assert.equal(uploadObservations, 3, "card plus zero spinner must wait until the Provider pending action clears");
assert.deepEqual(uploadingFixture.waitDurations(), [2_000, 3_000],
  "busy attachment checks must start with the exact 2s then 3s cadence");
assert.equal(uploadingFixture.physicalMutations(), 0, "attachment reconciliation must remain read-only");
assert.equal(uploaded.proof.observationRevisionHash, `sha256:${"4".repeat(64)}`);
assert.deepEqual(uploaded.proof.candidateCardinality, { raw: 1, eligible: 1 });

const approvedProviderName = providerAttachmentName("甲.pdf", "artifact:1");
const providerSuffixedName = approvedProviderName.replace(/(?=\.[^./]+$)/u, "(2)");
const providerSuffixFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") {
    return coherentObservationPacket(intent, attachmentFacts(true, false, providerSuffixedName));
  }
  throw new Error(`PROVIDER_SUFFIX_RECONCILIATION_MUST_NOT_ACT:${intent.kind}`);
});
const providerSuffixReconciled = await execute(
  "reconcile_gpt_attachment_set",
  providerSuffixFixture.browser,
  { files: [approvedAttachment], timeoutMs: 1_000 },
);
assert.equal(providerSuffixReconciled.status, "success",
  providerSuffixReconciled.failureCode ?? "Provider duplicate suffix was not normalized");
assert.equal(providerSuffixFixture.physicalMutations(), 0,
  "Provider suffix normalization must remain a read-only comparison");

const providerRenameFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") {
    return coherentObservationPacket(intent,
      attachmentFacts(true, false, approvedProviderName.replace(/(?=\.[^./]+$)/u, "(copy)")));
  }
  throw new Error(`PROVIDER_RENAME_RECONCILIATION_MUST_NOT_ACT:${intent.kind}`);
});
const providerRenameRejected = await execute(
  "reconcile_gpt_attachment_set",
  providerRenameFixture.browser,
  { files: [approvedAttachment], timeoutMs: 1_000 },
);
assert.equal(providerRenameRejected.status, "failed");
assert.ok(providerRenameRejected.failureCode?.startsWith("GPT_ATTACHMENT_SET_MISMATCH:"),
  "non-numeric Provider renames must still fail closed");
assert.equal(providerRenameFixture.physicalMutations(), 0);

let noLayoutCardReads = 0;
const noLayoutAttachmentFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") {
    noLayoutCardReads += 1;
    return coherentObservationPacket(intent, noLayoutCardReads === 1 ? {
      ...attachmentFacts(true),
      "attachment-items": {
        rawCount: 1, eligibleCount: 0, matches: [],
        rejections: [{ index: 0, reasons: ["NO_LAYOUT_BOX"] }],
        nativeCauseCode: "NO_LAYOUT_BOX", nativeCauseCount: 1,
      },
    } : attachmentFacts(true));
  }
  throw new Error(`UNEXPECTED_NO_LAYOUT_ATTACHMENT_INTENT:${intent.kind}`);
});
const recoveredNoLayoutAttachment = await execute(
  "reconcile_gpt_attachment_set",
  noLayoutAttachmentFixture.browser,
  { files: [approvedAttachment], timeoutMs: 2_000 },
);
assert.equal(recoveredNoLayoutAttachment.status, "success",
  recoveredNoLayoutAttachment.failureCode ?? "no-layout attachment card did not recover");
assert.equal(noLayoutCardReads, 2, "a no-layout card must be queried fresh before readiness");
assert.equal(noLayoutAttachmentFixture.physicalMutations(), 0,
  "a no-layout attachment card must never authorize a mutation");
assert.equal(noLayoutAttachmentFixture.waitDurations().length, 1);
assert.ok(noLayoutAttachmentFixture.waitDurations()[0]! > 0
  && noLayoutAttachmentFixture.waitDurations()[0]! <= 2_000,
  "a pending attachment probe must consume exactly one bounded first interval");

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
assert.equal(staleAttachmentFixture.waitDurations().length, 1);
assert.ok(staleAttachmentFixture.waitDurations()[0]! > 0
  && staleAttachmentFixture.waitDurations()[0]! <= 2_000,
  "a stale observation must consume one bounded current interval before a fresh read");
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
  assert.equal(simulatedNow, 70_000, "upload completion must be observed on the next scheduled check");
  assert.deepEqual(delayedUploadFixture.waitDurations(), [
    2_000, 3_000, 5_000, 7_000, 9_000, 11_000, 11_000, 11_000, 11_000,
  ], "attachment checks must use 2/3/5/7/9/11 seconds then retain the 11s ceiling");
} finally {
  Date.now = nativeDateNow;
}

let uploadTimeoutNow = 0;
const uploadTimeoutFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") return coherentObservationPacket(intent, attachmentFacts(true, true));
  throw new Error(`UNEXPECTED_ATTACHMENT_TIMEOUT_INTENT:${intent.kind}`);
}, { onWait: (durationMs) => { uploadTimeoutNow += durationMs; } });
const nativeTimeoutDateNow = Date.now;
Date.now = () => uploadTimeoutNow;
try {
  const uploadTimedOut = await execute("reconcile_gpt_attachment_set", uploadTimeoutFixture.browser, {
    files: [approvedAttachment], timeoutMs: 1_000,
  });
  assert.equal(uploadTimedOut.status, "failed");
  assert.ok(uploadTimedOut.failureCode?.startsWith("GPT_ATTACHMENT_UPLOAD_TIMEOUT:cards=1:uploading=0:pending=1:expected=1:"));
  assert.equal(uploadTimedOut.proof.observationRevisionHash, `sha256:${"4".repeat(64)}`);
  assert.equal(uploadTimeoutNow, 1_000, "attachment reconciliation must stop at the exact Product deadline");
  assert.deepEqual(uploadTimeoutFixture.waitDurations(), [1_000],
    "the final cadence interval must be clipped to the remaining Product deadline");
  assert.equal(uploadTimeoutFixture.physicalMutations(), 0,
    "timed-out reconciliation must never mutate the page");
} finally {
  Date.now = nativeTimeoutDateNow;
}
