import { governanceAssert as assert } from
  "../../../../scripts/audit/shared/governance-exam-assert.js";
import {
  gptAttachmentProviderDisplayName,
  normalizeGptProviderAttachmentLabel,
} from "../schema.js";
import type { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";
import { coherentObservationPacket, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";
import { providerAttachmentName } from "./gpt-exact-target-source-support.js";
import { withSyntheticDom } from "../../../../scripts/acceptance/local-browser-dom-function-fixture.js";
import { conversationFacts } from "./gpt-exact-target-conversation-fixture.js";

export const attachmentSha256 = `sha256:${"1".repeat(64)}` as const;
export const approvedAttachment = Object.freeze({
  artifactRef: "artifact:1", displayName: "甲.pdf", sha256: attachmentSha256, bytes: 10,
});

export const exerciseNativeAttachmentCardConsumers = async (
  execute: ReturnType<typeof createGptAcceptanceHarness>["execute"],
): Promise<void> => withSyntheticDom(async page => {
  const files = [
    { ...approvedAttachment, displayName: "payment.png" },
    { ...approvedAttachment, artifactRef: "artifact:json", displayName: "contract.json" },
  ];
  const names = files.map(file => providerAttachmentName(file.displayName, file.artifactRef));
  for (const scenario of ["image", "json", "mixed", "missing", "foreign", "duplicate", "image-pending", "json-pending", "empty"] as const) {
    const selected = files.filter((_file, index) => scenario !== "empty"
      && (scenario !== "image" || index === 0) && (scenario !== "json" || index === 1));
    const image = ["json", "missing", "empty"].includes(scenario) ? "" : `<div role="button"
      class="composer-attachment-surface ${scenario === "image-pending" ? "cursor-wait" : ""}"
      aria-label="${scenario === "foreign" ? "foreign.png" : names[0]}">Image</div>`;
    const json = ["image", "empty"].includes(scenario) ? "" : `<button
      class="composer-attachment-surface ${scenario === "json-pending" ? "cursor-wait" : ""}"
      aria-label="${scenario === "duplicate" ? names[0] : names[1]}">JSON</button>`;
    await page.setContent(`<form data-chatgpt-composer>${image}${json}
      <span class="composer-attachment-surface">decoration</span>
      <div class="composer-attachment-surface" aria-label="decoration">decoration</div></form>
      <div role="button" class="composer-attachment-surface" aria-label="outside.png">Outside</div>`);
    const fixture = fakeBrowser(async intent => {
      if (intent.kind !== "observe") throw new Error("CARD_RECONCILIATION_MUST_NOT_ACT");
      const facts = await page.evaluate(queries => Object.fromEntries(queries.map(query => {
        const scopes = query.scope ? Array.from(document.querySelectorAll(query.scope.selector)) : [document.documentElement];
        const nodes = scopes.flatMap(scope => Array.from(scope.querySelectorAll(query.selector)));
        const eligible = nodes.filter(node => node.getClientRects().length > 0);
        return [query.queryId, { rawCount: nodes.length, eligibleCount: eligible.length,
          matches: eligible.map(node => ({ ariaLabel: node.getAttribute("aria-label") ?? "" })) }];
      })), intent.queries.filter(query => ["attachments", "attachment-items", "attachment-pending", "attachment-uploading"].includes(query.queryId)));
      return coherentObservationPacket(intent, { ...conversationFacts(""), ...attachmentControlFacts("open"),
        "attachment-composer": { rawCount: 1, eligibleCount: 1 }, ...facts });
    }, { onWait: duration => { now += duration; } });
    let now = 0;
    const native = Date.now;
    Date.now = () => now;
    try {
      const result = await execute("reconcile_gpt_attachment_set", fixture.browser, { files: selected, timeoutMs: 1500 });
      const valid = ["image", "json", "mixed", "empty"].includes(scenario);
      assert.equal(result.status, valid ? "success" : "failed", scenario);
      if (!valid) assert.ok(result.failureCode?.startsWith(scenario.endsWith("pending")
        ? "GPT_ATTACHMENT_UPLOAD_TIMEOUT:" : "GPT_ATTACHMENT_SET_MISMATCH:"), scenario);
      if (scenario === "image") {
        assert.equal((await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 1500 })).failureCode, "GPT_CHAT_ATTACHMENT_PRESENT");
        const foreign = await execute("attach_approved_gpt_files_once", fixture.browser, { files: [] });
        assert.ok(foreign.failureCode?.startsWith("GPT_ATTACHMENT_SET_MISMATCH:"), scenario);
      }
      if (scenario === "foreign") {
        assert.ok((await execute("attach_approved_gpt_files_once", fixture.browser, { files })).failureCode
          ?.startsWith("GPT_ATTACHMENT_COMPOSER_FOREIGN_CARDS:"));
      }
      if (scenario === "empty") {
        assert.equal((await execute("attach_approved_gpt_files_once", fixture.browser, { files: [] })).status, "success");
      }
      assert.equal(fixture.physicalMutations(), 0, scenario);
    } finally { Date.now = native; }
  }
});
export const hiddenPopoverRejections = Object.freeze(Array.from({ length: 22 }, (_, index) => Object.freeze({
  index, reasons: Object.freeze(["NO_LAYOUT_BOX"]),
})));

export const attachmentControlFacts = (state: "absent" | "closed" | "open") => ({
  "attachment-control": {
    rawCount: state === "absent" ? 0 : 1,
    eligibleCount: state === "absent" ? 0 : 1,
    matches: state === "absent" ? [] : [{ disabled: false, ariaDisabled: false }],
  },
  "active-menu": state === "open" ? {
    rawCount: 23, eligibleCount: 1, matches: [{}], rejections: hiddenPopoverRejections,
  } : { rawCount: 22, eligibleCount: 0, rejections: hiddenPopoverRejections },
  "upload-choice": state === "open" ? {
    scopeRawCount: 23, scopeEligibleCount: 1, scopeRejections: hiddenPopoverRejections,
    rawCount: 19, eligibleCount: 1, matches: [{}],
    rejections: Array.from({ length: 18 }, (_, offset) => ({
      index: offset + 1, reasons: ["TEXT_MISMATCH"],
    })),
  } : {
    scopeRawCount: 22, scopeEligibleCount: 0, scopeRejections: hiddenPopoverRejections,
    rawCount: 0, eligibleCount: 0,
  },
});

export const exerciseAttachmentNameNormalization = (): void => {
  assert.equal(
    gptAttachmentProviderDisplayName("甲.pdf", "job:gpt-exact-target", "artifact:1"),
    gptAttachmentProviderDisplayName("甲.pdf", "job:gpt-exact-target", "artifact:1"),
    "one job and artifact must retain one Provider filename across attempts",
  );
  assert.notEqual(
    gptAttachmentProviderDisplayName("甲.pdf", "job:gpt-exact-target", "artifact:1"),
    gptAttachmentProviderDisplayName("甲.pdf", "job:another", "artifact:1"),
    "different jobs must not share an attachment Provider filename",
  );
  assert.equal(normalizeGptProviderAttachmentLabel("approved(5).pdf", ["approved.pdf"]),
    "approved.pdf", "one Provider-only final numeric duplicate suffix must preserve approved attachment identity");
  assert.equal(normalizeGptProviderAttachmentLabel("approved(5)", ["approved"]),
    "approved", "the same final numeric suffix rule must apply to an attachment without an extension");
  assert.equal(normalizeGptProviderAttachmentLabel("approved(20260920-014044).pdf", ["approved.pdf"]),
    "approved.pdf", "one Provider-only final date-time suffix must preserve approved attachment identity");
  assert.equal(normalizeGptProviderAttachmentLabel("approved(20260920-014044)", ["approved"]),
    "approved", "the same final date-time suffix rule must apply without an extension");
  assert.equal(normalizeGptProviderAttachmentLabel("approved(5).pdf", ["approved.pdf", "approved(5).pdf"]),
    "approved(5).pdf", "an explicitly approved numeric-parenthetical name must win before normalization");
  assert.equal(normalizeGptProviderAttachmentLabel(
    "approved(20260920-014044).pdf",
    ["approved.pdf", "approved(20260920-014044).pdf"],
  ), "approved(20260920-014044).pdf",
  "an explicitly approved date-time-parenthetical name must win before normalization");
  assert.equal(normalizeGptProviderAttachmentLabel("approved(copy).pdf", ["approved.pdf"]),
    "approved(copy).pdf", "a non-numeric parenthetical rename must remain unexpected");
  for (const invalid of [
    "approved (20260920-014044).pdf",
    "approved(2026092-014044).pdf",
    "approved(20260920-01404).pdf",
    "approved(20260920_014044).pdf",
    "approved(5)(20260920-014044).pdf",
  ]) assert.equal(normalizeGptProviderAttachmentLabel(invalid, ["approved.pdf"]), invalid,
    `an unapproved Provider suffix shape must remain unexpected: ${invalid}`);
  for (const [observed, approved] of [
    ["approved(5)(20260920-014044).pdf", "approved(5).pdf"],
    ["approved(20260920-014044)(7).pdf", "approved(20260920-014044).pdf"],
  ] as const) assert.equal(normalizeGptProviderAttachmentLabel(observed, [approved]), observed,
    `a second Provider suffix must remain unexpected when the approved name ends in a suffix: ${observed}`);
};

/** Closed label-shape and duplicate diagnostics of a terminal attachment set mismatch. */
export const exerciseAttachmentLabelDiagnostics = async (
  execute: ReturnType<typeof createGptAcceptanceHarness>["execute"],
  attachmentFacts: (ready: boolean, pending?: boolean, observedLabel?: string) =>
    Parameters<typeof coherentObservationPacket>[1],
): Promise<void> => {
  const approvedProviderName = providerAttachmentName("甲.pdf", "artifact:1");
  const approvedStem = approvedProviderName.slice(0, approvedProviderName.lastIndexOf("."));
  for (const [shape, observedLabel] of [
    ["SPACE_PAREN_DIGITS", `${approvedStem} (2).pdf`],
    ["TOKEN_ABSENT", "甲.pdf"],
    ["EXT_CHANGED", `${approvedStem}.txt`],
    ["PREFIX_OF_APPROVED", approvedStem.slice(0, 4)],
    ["UNRELATED", approvedProviderName.replace(/(?=\.[^./]+$)/u, "(copy)")],
  ] as const) {
    const shapeFixture = fakeBrowser((intent) => {
      if (intent.kind === "observe") return coherentObservationPacket(intent, attachmentFacts(true, false, observedLabel));
      throw new Error(`LABEL_SHAPE_RECONCILIATION_MUST_NOT_ACT:${intent.kind}`);
    });
    const shapeRejected = await execute("reconcile_gpt_attachment_set", shapeFixture.browser,
      { files: [approvedAttachment], timeoutMs: 1_500 });
    assert.equal(shapeRejected.status, "failed");
    assert.ok(shapeRejected.failureCode?.endsWith(`:labels=missing:1,unexpected:1,dup:0,shape:${shape}`),
      `${shape} must be the closed diagnostic for this label: ${shapeRejected.failureCode ?? "none"}`);
    assert.ok(!shapeRejected.failureCode?.includes("甲"), "the diagnostic must never carry observed label text");
  }

  const duplicateFixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      ...attachmentFacts(true),
      "attachment-items": { rawCount: 2, eligibleCount: 2, matches: [
        { ariaLabel: approvedProviderName }, { ariaLabel: approvedProviderName.replace(/(?=\.[^./]+$)/u, "(1)") },
      ] },
    });
    throw new Error(`LABEL_DUPLICATE_RECONCILIATION_MUST_NOT_ACT:${intent.kind}`);
  });
  const duplicateRejected = await execute("reconcile_gpt_attachment_set", duplicateFixture.browser,
    { files: [approvedAttachment], timeoutMs: 1_500 });
  assert.ok(duplicateRejected.failureCode?.endsWith(":labels=missing:0,unexpected:0,dup:1,shape:none"),
    `a normalized duplicate must be counted without shape codes: ${duplicateRejected.failureCode ?? "none"}`);
};

/** The A1 pre-upload gate: a foreign composer card must block attach_approved_gpt_files_once
 * before any browser mutation, while an empty composer or an already-approved card must not. */
export const exerciseForeignComposerCardGate = async (
  execute: ReturnType<typeof createGptAcceptanceHarness>["execute"],
): Promise<void> => {
  const approvedProviderName = providerAttachmentName("甲.pdf", "artifact:1");
  const controlFacts = attachmentControlFacts("open");

  const foreignCardFixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      ...controlFacts,
      "attachment-composer": { rawCount: 1, eligibleCount: 1 },
      "attachment-items": { rawCount: 1, eligibleCount: 1, matches: [{ ariaLabel: "外来文件.pdf" }] },
    });
    throw new Error(`FOREIGN_CARD_GATE_MUST_NOT_ACT:${intent.kind}`);
  }, {
    onAttachFile: () => { throw new Error("ATTACH_MUST_NOT_BE_CALLED_WHEN_FOREIGN_CARDS_PRESENT"); },
  });
  const foreignCardRejected = await execute("attach_approved_gpt_files_once", foreignCardFixture.browser,
    { files: [approvedAttachment] });
  assert.equal(foreignCardRejected.status, "failed");
  assert.ok(foreignCardRejected.failureCode?.startsWith("GPT_ATTACHMENT_COMPOSER_FOREIGN_CARDS:cards=1:foreign=1"),
    `expected a FOREIGN_CARDS rejection: ${foreignCardRejected.failureCode ?? "none"}`);
  assert.ok(!foreignCardRejected.failureCode?.includes("外来"),
    "the foreign-card failure code must never carry observed label text");

  let attachedInput: unknown = null;
  const sameBatchFixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      ...controlFacts,
      "attachment-composer": { rawCount: 1, eligibleCount: 1 },
      "attachment-items": { rawCount: 1, eligibleCount: 1, matches: [{ ariaLabel: approvedProviderName }] },
    });
    throw new Error(`FOREIGN_CARD_GATE_MUST_NOT_OBSERVE:${intent.kind}`);
  }, { onAttachFile: (input) => { attachedInput = input; } });
  const sameBatchAccepted = await execute("attach_approved_gpt_files_once", sameBatchFixture.browser,
    { files: [approvedAttachment] });
  assert.equal(sameBatchAccepted.status, "success",
    sameBatchAccepted.failureCode ?? "an already-approved same-batch card must not block upload");
  assert.ok(attachedInput, "an existing same-batch card must not block the upload");

  attachedInput = null;
  const emptyComposerFixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      ...controlFacts,
      "attachment-composer": { rawCount: 1, eligibleCount: 1 },
      "attachment-items": { rawCount: 0, eligibleCount: 0 },
    });
    throw new Error(`FOREIGN_CARD_GATE_MUST_NOT_OBSERVE:${intent.kind}`);
  }, { onAttachFile: (input) => { attachedInput = input; } });
  const emptyComposerAccepted = await execute("attach_approved_gpt_files_once", emptyComposerFixture.browser,
    { files: [approvedAttachment] });
  assert.equal(emptyComposerAccepted.status, "success",
    emptyComposerAccepted.failureCode ?? "an empty composer must not change upload behavior");
  assert.ok(attachedInput, "an empty composer must still allow the upload");
};
