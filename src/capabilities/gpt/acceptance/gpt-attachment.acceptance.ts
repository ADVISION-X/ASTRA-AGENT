import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { executionFailure } from "../../../lib/execution-failure.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";
import { coherentObservationPacket, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";
import { providerAttachmentName } from "./gpt-exact-target-source-support.js";
import { approvedAttachment, attachmentControlFacts, exerciseAttachmentLabelDiagnostics, exerciseAttachmentNameNormalization,
  exerciseForeignComposerCardGate, hiddenPopoverRejections } from "./gpt-attachment-name.acceptance-support.js";
import { GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR, GPT_COMPOSER_FORM_SELECTOR, GPT_ATTACHMENT_PENDING_ACTION_SELECTOR,
  GPT_UPLOAD_FROM_COMPUTER_SELECTOR } from "./gpt-page-fixture-selectors.js";
const { execute } = createGptAcceptanceHarness("gpt-attachment");
const attachmentFacts = (ready: boolean, pending = false, observedLabel = providerAttachmentName("甲.pdf", "artifact:1")) => ({
  "attachment-composer": { rawCount: 1, eligibleCount: 1 },
  "attachment-items": { rawCount: 1, eligibleCount: 1, matches: [{ ariaLabel: observedLabel }] },
  "attachment-uploading": { rawCount: Number(!ready), eligibleCount: Number(!ready) },
  "attachment-pending": { rawCount: Number(pending), eligibleCount: Number(pending) },
});
const verifyMenu = async (): Promise<void> => {
  for (const scenario of ["hydrate", "done", "bad-post"] as const) {
    let reads = 0;
    const fixture = fakeBrowser(intent => {
      const queries = intent.kind === "observe" ? intent.queries : intent.kind === "click" ? intent.postClickObservation?.queries : undefined;
      assert.equal(queries?.find(query => query.queryId === "upload-choice")?.selector, GPT_UPLOAD_FROM_COMPUTER_SELECTOR);
      assert.equal(queries?.find(query => query.queryId === "upload-choice")?.textContains, "上传");
      if (intent.kind === "observe") { reads += 1; return coherentObservationPacket(intent, attachmentControlFacts(
        scenario === "done" ? "open" : scenario === "hydrate" && reads === 1 ? "absent" : "closed")); }
      if (intent.kind !== "click" || !intent.postClickObservation) throw new Error("ATTACHMENT_MENU_MUST_ONLY_CLICK");
      assert.deepEqual(intent.scope, { selector: GPT_COMPOSER_FORM_SELECTOR });
      assert.deepEqual(intent.postClickObservation.queries.map(query => [query.queryId, query.scope?.selector, query.expectedEligibleCount]),
        [["attachment-control", GPT_COMPOSER_FORM_SELECTOR, 1], ["active-menu", undefined, 1], ["upload-choice", GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR, 1]]);
      assert.deepEqual(intent.postClickObservation.queries.map(query => [query.queryId, query.fields]),
        [["attachment-control", ["disabled", "ariaDisabled"]], ["active-menu", []], ["upload-choice", []]]);
      const postQueries = intent.postClickObservation.queries.map(({ expectedEligibleCount: _count, ...query }) => query);
      return { mutationCount: 1, postconditionVerified: true, postconditionObservation: coherentObservationPacket({ queries: postQueries },
        scenario === "bad-post" ? attachmentControlFacts("closed") : attachmentControlFacts("open")) };
    });
    const result = await execute("open_gpt_attachment_control", fixture.browser, {});
    assert.equal(result.status, scenario === "bad-post" ? "failed" : "success");
    assert.equal(fixture.physicalMutations(), scenario === "done" ? 0 : 1);
    assert.equal(reads, scenario === "hydrate" ? 2 : 1);
    if (scenario === "bad-post") { assert.equal(result.proof.committedMutation, "confirmed"); assert.equal(result.proof.postconditionResult, "failed"); }
    if (scenario === "done") { assert.equal(result.proof.internalDecisionCode, "DONE"); assert.equal(result.proof.browserFact, null); }
  }
};
const verifyMenuConflicts = async (): Promise<void> => {
  for (const conflict of ["control-duplicate", "composer-duplicate", "control-no-layout", "menu-duplicate", "leaf-missing", "leaf-duplicate", "never-hydrates"] as const) {
    const fixture = fakeBrowser(intent => {
      if (intent.kind !== "observe") throw new Error("CONTRADICTORY_ATTACHMENT_MENU_MUST_NOT_ACT");
      const base = attachmentControlFacts(conflict === "never-hydrates" ? "absent" : conflict === "control-no-layout" ? "closed" : "open");
      if (conflict === "control-duplicate") return coherentObservationPacket(intent, { ...base, "attachment-control": { rawCount: 2, eligibleCount: 2 } });
      if (conflict === "composer-duplicate") return coherentObservationPacket(intent, { ...base, "attachment-control": { scopeRawCount: 2, scopeEligibleCount: 1, rawCount: 1, eligibleCount: 1, scopeRejections: [{ index: 1, reasons: ["INERT"] }] } });
      if (conflict === "control-no-layout") return coherentObservationPacket(intent, { ...base, "attachment-control": { rawCount: 1, eligibleCount: 0,
        rejections: [{ index: 0, reasons: ["NO_LAYOUT_BOX"] }], nativeCauseCode: "NO_LAYOUT_BOX", nativeCauseCount: 1 } });
      if (conflict === "menu-duplicate") return coherentObservationPacket(intent, { ...base, "upload-choice": { scopeRawCount: 23, scopeEligibleCount: 2, rawCount: 2, eligibleCount: 2, scopeRejections: hiddenPopoverRejections.slice(0, 21) } });
      if (conflict === "leaf-missing" || conflict === "leaf-duplicate") return coherentObservationPacket(intent, { ...base, "upload-choice": { scopeRawCount: 23, scopeEligibleCount: 1,
        scopeRejections: hiddenPopoverRejections, rawCount: 19, eligibleCount: conflict === "leaf-missing" ? 0 : 2,
        rejections: Array.from({ length: conflict === "leaf-missing" ? 19 : 17 }, (_, index) => ({ index, reasons: ["TEXT_MISMATCH"] })) } });
      return coherentObservationPacket(intent, base);
    });
    const result = await execute("open_gpt_attachment_control", fixture.browser, {});
    assert.equal(result.status, "failed"); assert.ok(result.failureCode?.startsWith("GPT_ATTACHMENT_CONTROL_QUALIFICATION_INVALID:"));
    assert.equal(fixture.physicalMutations(), 0); assert.deepEqual(fixture.waitDurations(), ["control-no-layout", "never-hydrates"].includes(conflict) ? [1500, 3000] : []);
    if (conflict === "control-no-layout") assert.equal(result.proof.nativeFailureCode, "NO_LAYOUT_BOX");
  }
  for (const field of ["targetRefHash", "documentRefHash"]) {
    let reads = 0;
    const fixture = fakeBrowser(intent => {
      if (intent.kind !== "observe") throw new Error("ATTACHMENT_IDENTITY_DRIFT_MUST_NOT_ACT"); reads += 1;
      const packet = coherentObservationPacket(intent, attachmentControlFacts(reads === 1 ? "absent" : "closed"));
      return reads === 1 ? packet : { ...packet, [field]: `sha256:${"5".repeat(64)}` };
    });
    assert.equal((await execute("open_gpt_attachment_control", fixture.browser, {})).failureCode, "GPT_DOM_CONFIRMATION_IDENTITY_CHANGED"); assert.equal(fixture.physicalMutations(), 0);
  }
};
const verifyBatch = async (): Promise<void> => {
  let batch: unknown, controlReads = 0;
  const fixture = fakeBrowser(intent => {
    if (intent.kind !== "observe") throw new Error("APPROVED_BATCH_MUST_ONLY_ATTACH");
    const choice = intent.queries.find(query => query.queryId === "upload-choice");
    if (choice) {
      controlReads += 1;
      assert.equal(choice.selector, GPT_UPLOAD_FROM_COMPUTER_SELECTOR);
      assert.deepEqual(choice.scope, { selector: GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR });
      assert.equal(choice.textContains, "上传");
    }
    return coherentObservationPacket(intent, { "attachment-control": { rawCount: 1, eligibleCount: 1 }, "upload-choice": { rawCount: 1, eligibleCount: 1 } });
  }, { onAttachFile: input => { batch = input; } });
  const result = await execute("attach_approved_gpt_files_once", fixture.browser, { files: [approvedAttachment] });
  assert.equal(result.status, "success", result.failureCode ?? "batch"); assert.equal(result.value?.mutationSent, true);
  assert.equal(controlReads, 1, "the batch must qualify the approved control exactly once");
  assert.deepEqual(Reflect.get(batch as object, "activation"), { selector: GPT_UPLOAD_FROM_COMPUTER_SELECTOR,
    scope: { selector: GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR }, expectedText: "上传" });
  const approvedArtifacts = Reflect.get(batch as object, "approvedArtifacts");
  assert.deepEqual(approvedArtifacts, [{ artifactRef: approvedAttachment.artifactRef, providerDisplayName: providerAttachmentName("甲.pdf", "artifact:1"),
    expectedSha256: approvedAttachment.sha256, bytes: approvedAttachment.bytes }]);
  assert.equal(fixture.documentCalls(), 2); assert.equal(fixture.physicalMutations(), 1); assert.equal(result.proof.committedMutation, "confirmed");
  assert.equal((await execute("attach_approved_gpt_files_once", fixture.browser, { files: [{ ...approvedAttachment, filePath: "/forbidden/path" }] } as never)).failureCode, "GPT_ATTACHMENT_INPUT_INVALID");
};
const verifyReconciliation = async (): Promise<void> => {
  let reads = 0;
  const settling = fakeBrowser(intent => {
    if (intent.kind !== "observe") throw new Error("RECONCILIATION_MUST_NOT_MUTATE"); reads += 1;
    assert.equal(intent.queries.find(query => query.queryId === "attachment-pending")?.selector, GPT_ATTACHMENT_PENDING_ACTION_SELECTOR);
    return coherentObservationPacket(intent, reads === 1 ? { ...attachmentFacts(false), "attachment-items": { rawCount: 0, eligibleCount: 0, matches: [] } }
      : attachmentFacts(true, reads === 2));
  });
  const result = await execute("reconcile_gpt_attachment_set", settling.browser, { files: [approvedAttachment], timeoutMs: 10000 });
  assert.equal(result.status, "success"); assert.equal(reads, 3); assert.deepEqual(settling.waitDurations(), [2000, 3000]); assert.equal(settling.physicalMutations(), 0);
  for (const suffix of ["(2)", "(20260920-014044)", "(copy)"]) {
    const label = providerAttachmentName("甲.pdf", "artifact:1").replace(/(?=\.[^./]+$)/u, suffix);
    const fixture = fakeBrowser(intent => { if (intent.kind !== "observe") throw new Error("SUFFIX_MUST_NOT_MUTATE"); return coherentObservationPacket(intent, attachmentFacts(true, false, label)); });
    const output = await execute("reconcile_gpt_attachment_set", fixture.browser, { files: [approvedAttachment], timeoutMs: 1500 });
    assert.equal(output.status, suffix === "(copy)" ? "failed" : "success"); assert.equal(fixture.physicalMutations(), 0);
  }
  for (const transient of ["stale", "no-layout"] as const) {
    let samples = 0;
    const fixture = fakeBrowser(intent => {
      if (intent.kind !== "observe") throw new Error("UPLOAD_TRANSIENT_MUST_NOT_ACT"); samples += 1;
      if (samples === 1 && transient === "stale") throw executionFailure("failed", "BROWSER_DOM_NODE_STALE");
      return coherentObservationPacket(intent, samples === 1 ? { ...attachmentFacts(true), "attachment-items": { rawCount: 1, eligibleCount: 0, matches: [],
        rejections: [{ index: 0, reasons: ["NO_LAYOUT_BOX"] }], nativeCauseCode: "NO_LAYOUT_BOX", nativeCauseCount: 1 } } : attachmentFacts(true));
    });
    assert.equal((await execute("reconcile_gpt_attachment_set", fixture.browser, { files: [approvedAttachment], timeoutMs: 2000 })).status, "success");
    assert.equal(samples, 2); assert.equal(fixture.waitDurations().length, 1); assert.equal(fixture.physicalMutations(), 0);
  }
};
const verifyDeadline = async (): Promise<void> => {
  for (const delayed of [true, false]) {
    let now = 0; const native = Date.now;
    const fixture = fakeBrowser(intent => { if (intent.kind !== "observe") throw new Error("UPLOAD_TIMEOUT_MUST_NOT_ACT");
      return coherentObservationPacket(intent, delayed ? attachmentFacts(now >= 61000) : attachmentFacts(true, true));
    }, { onWait: duration => { now += duration; } });
    Date.now = () => now;
    try {
      const result = await execute("reconcile_gpt_attachment_set", fixture.browser, { files: [approvedAttachment], timeoutMs: delayed ? 70000 : 1500 });
      assert.equal(result.status, delayed ? "success" : "failed"); assert.equal(now, delayed ? 70000 : 1500);
      assert.deepEqual(fixture.waitDurations(), delayed ? [2000, 3000, 5000, 7000, 9000, 11000, 11000, 11000, 11000] : [1500]);
      if (!delayed) { assert.ok(result.failureCode?.startsWith("GPT_ATTACHMENT_UPLOAD_TIMEOUT:")); assert.equal(result.failureCode?.includes(":labels="), false); }
      assert.equal(fixture.physicalMutations(), 0);
    } finally { Date.now = native; }
  }
};
exerciseAttachmentNameNormalization(); await verifyMenu(); await verifyMenuConflicts(); await verifyBatch(); await verifyReconciliation(); await verifyDeadline();
await exerciseAttachmentLabelDiagnostics(execute, attachmentFacts); await exerciseForeignComposerCardGate(execute);
