import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { decodeBrowserMutationReceipt } from "../../src/lib/browser/exact-target/browser-mutation-receipt.js";
import { preflightReceiptObservationHash } from "../../src/lib/browser/exact-target/browser-special-mutation-receipt.js";
import { BROWSER_DOM_CANDIDATE_MISSING_STAGES, browserPostconditionNativeCauseValid } from "../../src/lib/browser/exact-target/browser-interaction-native-cause.js";
import { CANDIDATE_MISSING_STAGE_SOURCE, candidateMissingFailure, candidateMissingStage } from "../../src/lib/browser/chrome-extension/dom-candidate-missing-stage.js";

const hash = `sha256:${"a".repeat(64)}` as const;
const click = { kind: "dom-intent" as const, intent: { kind: "click" as const, selector: "button", expectedMatches: 1,
  postClickMatch: { selector: "done", expectedMatches: 1 } } };
const key = { kind: "dom-intent" as const, intent: { kind: "keypress" as const, selector: "button", key: "Enter" as const,
  expectedMatches: 1, postKeypressMatch: { selector: "done", expectedMatches: 1 } } };
const fill = { kind: "dom-intent" as const, intent: { kind: "fill" as const,
  selector: "form[data-chatgpt-composer] [data-composer-markdown][contenteditable='true'][role='textbox']",
  approvedText: "approved", clearBeforeType: false, expectedMatches: 1 } };
const file = { kind: "file-input" as const, selector: "form[data-chatgpt-composer] input[type='file'][aria-label='附加文件']",
  activation: { selector: "[data-mention-list-scroll-area] > div:first-child > button[data-list-navigation-item='true']:first-child",
    scope: { selector: "[data-composer-overlay-floating-ui='true']" }, expectedText: "上传" },
  approvedFiles: [{ grantRef: "grant", contentHash: hash, maxBytes: 64 }], resolvedFilePaths: ["/approved/one.txt"] };
const ack = { kind: "dom-intent" as const, intent: { kind: "acknowledgeKnownGptRateLimit" as const,
  targetRefHash: hash, documentRefHash: hash, dispatchNotAfter: null } };
const physical = { candidateCount: 1, identityRevalidated: true, mutationCount: 1, postconditionVerified: true };
const qualification = { candidateCount: 1, identityRevalidated: false, mutationCount: 0, postconditionVerified: false,
  qualificationRejected: true, qualificationStage: "actionability", failureCode: "BROWSER_FILE_INPUT_NOT_QUALIFIED", nativeCauseCode: null };
type Command = Parameters<typeof decodeBrowserMutationReceipt>[0];
const decode = (command: Command, row: object) => decodeBrowserMutationReceipt(command, row, preflightReceiptObservationHash(row));
const invalid = (command: Command, row: object): void => { assert.throws(() => decode(command, row), /BROWSER_AUTH_TRANSCRIPT_INVALID/u); };
const expect = (command: Command, row: object, terminal: "confirmed" | "rejected", outcome: "no" | "confirmed",
  code: string | null, cause: string | null, count: number): void => {
  assert.deepEqual(decode(command, row), { terminal, mutationOutcome: outcome, failureCode: code, nativeCauseCode: cause, physicalInputCount: count });
};

const qualificationReceipts = (): void => {
  expect(file, physical, "confirmed", "confirmed", null, null, 1);
  for (const extra of [{ resolvedFilePaths: ["/secret"] }, { failureCode: "BROWSER_POSTCONDITION_FAILED" },
    { selectedFileCount: 1, approvedSetVerified: true, acceptVerified: true }]) invalid(file, { ...physical, ...extra });
  invalid(click, qualification);
  const interaction = { ...qualification, candidateCount: 0, qualificationStage: "candidate-set", failureCode: "BROWSER_TARGET_NOT_INTERACTIVE" };
  for (const nativeCauseCode of ["BROWSER_TARGET_INVALID", "BROWSER_DOCUMENT_INVALID", "BROWSER_ORIGIN_REJECTED"])
    expect(click, { ...interaction, nativeCauseCode }, "rejected", "no", interaction.failureCode, nativeCauseCode, 0);
  for (const nativeCauseCode of ["BROWSER_DEVTOOLS_CONFLICT", "raw uncontrolled cause"]) invalid(click, { ...interaction, nativeCauseCode });
  for (const command of [click, key, fill]) {
    const cause = command.intent.kind === "click" ? "BROWSER_DOM_ACTION_HIT_TEST_FAILED" : "BROWSER_DOM_CANDIDATE_MISSING";
    const row = { ...qualification, failureCode: "BROWSER_DOM_ACTION_NOT_QUALIFIED", nativeCauseCode: cause };
    expect(command, row, "rejected", "no", row.failureCode, cause, 0);
  }
  for (const command of [key, fill]) invalid(command, { ...qualification,
    failureCode: "BROWSER_DOM_ACTION_NOT_QUALIFIED", nativeCauseCode: "BROWSER_DOM_ACTION_HIT_TEST_FAILED" });
  const missing = { ...qualification, candidateCount: 0, qualificationStage: "candidate-set", failureCode: "BROWSER_DOM_CANDIDATE_MISSING" };
  expect(click, missing, "rejected", "no", missing.failureCode, null, 0);
  invalid(click, { ...missing, candidateCount: 1 });
  const pageClassifier = new Function(`${CANDIDATE_MISSING_STAGE_SOURCE}\nreturn candidateMissing;`)() as (rawScope: number, eligibleScope: number, raw: number) => string;
  for (const [counts, stage] of [[[0, 0, 0], "BROWSER_DOM_SCOPE_ABSENT"], [[3, 0, 0], "BROWSER_DOM_SCOPE_INELIGIBLE"],
    [[1, 1, 0], "BROWSER_DOM_SELECTOR_ABSENT"], [[1, 1, 2], "BROWSER_DOM_CANDIDATE_INELIGIBLE"]] as const) {
    const failure = candidateMissingFailure(pageClassifier(counts[0], counts[1], counts[2])); assert.equal(failure?.message, "BROWSER_DOM_CANDIDATE_MISSING");
    assert.equal(candidateMissingStage(failure), stage);
  }
  assert.throws(() => candidateMissingFailure("BROWSER_DOM_CANDIDATE_MISSING:UNKNOWN"), /BROWSER_DOM_READ_INVALID/u);
  for (const command of [click, key, fill, ack]) for (const cause of BROWSER_DOM_CANDIDATE_MISSING_STAGES)
    expect(command, { ...missing, nativeCauseCode: cause }, "rejected", "no", missing.failureCode, cause, 0);
  invalid(file, { ...missing, nativeCauseCode: "BROWSER_DOM_SELECTOR_ABSENT" });
  for (const cause of ["BROWSER_DOM_SCOPE_MISSING", "NO_LAYOUT_BOX"]) invalid(click, { ...missing, nativeCauseCode: cause });
  invalid(click, { ...missing, candidateCount: 2, failureCode: "BROWSER_DOM_CANDIDATE_AMBIGUOUS", nativeCauseCode: "BROWSER_DOM_CANDIDATE_INELIGIBLE" });
};

const freshReceipts = (): void => {
  const retained = { filled: true, candidateCount: 0, identityRevalidated: false, mutationCount: 1,
    retainedValueVerified: false, postconditionVerified: false, failureCode: "BROWSER_POSTCONDITION_FAILED", nativeCauseCode: "BROWSER_DOM_CANDIDATE_MISSING" };
  expect(fill, retained, "rejected", "confirmed", retained.failureCode, retained.nativeCauseCode, 1);
  for (const cause of [undefined, "BROWSER_TARGET_INVALID"]) invalid(fill, { ...retained, nativeCauseCode: cause });
  expect(click, { ...physical, clicked: true, postconditionRawCount: 1, postconditionEligibleCount: 1,
    postconditionRejections: [] }, "confirmed", "confirmed", null, null, 1);
  const hidden = { ...physical, clicked: true, postconditionVerified: false, postconditionRawCount: 1, postconditionEligibleCount: 0,
    postconditionRejections: [{ index: 0, reasons: ["ARIA_HIDDEN"] }], failureCode: "BROWSER_POSTCONDITION_FAILED", nativeCauseCode: "ARIA_HIDDEN" };
  expect(click, hidden, "rejected", "confirmed", hidden.failureCode, hidden.nativeCauseCode, 1);
  invalid(click, { ...hidden, postconditionRejections: [] }); invalid(click, { ...hidden, nativeCauseCode: "BROWSER_DOM_CANDIDATE_MISSING" });
};

const indexedReceipts = (): void => {
  const header = { schemaVersion: "grasseye.browser.dom-observation.v2", exactCallIdentityHash: hash, targetRefHash: hash,
    documentRefHash: hash, currentUrl: "https://chatgpt.com/", observationRevisionHash: hash, observedAt: "2026-09-04T00:00:00.000Z" };
  for (let mismatch = 0; mismatch < 20; mismatch += 1) {
    const queries = Array.from({ length: 20 }, (_, index) => ({ queryId: `q${index}`, selector: `[data-q='${index}']`, maxMatches: 1,
      fields: [], expectedEligibleCount: 1 }));
    const command = { kind: "dom-intent" as const, intent: { kind: "click" as const, selector: "button", expectedMatches: 1,
      postClickObservation: { timeoutMs: 5_000, queries } } };
    const packet = { ...header, queries: queries.map((query, index) => ({ queryId: query.queryId,
      rawCount: index === mismatch ? 0 : 1, eligibleCount: index === mismatch ? 0 : 1, rejections: [] })) };
    const cause = `BROWSER_POSTCONDITION_Q${mismatch}__BROWSER_DOM_CANDIDATE_MISSING`;
    const row = { ...physical, clicked: true, postconditionVerified: false, postconditionObservation: packet,
      failureCode: "BROWSER_POSTCONDITION_FAILED", nativeCauseCode: cause };
    expect(command, row, "rejected", "confirmed", row.failureCode, cause, 1);
    for (const forged of [`BROWSER_POSTCONDITION_Q${(mismatch + 1) % 20}__BROWSER_DOM_CANDIDATE_MISSING`,
      `BROWSER_POSTCONDITION_Q${mismatch}__BROWSER_DOM_CANDIDATE_AMBIGUOUS`, "BROWSER_DOM_CANDIDATE_MISSING",
      "BROWSER_POSTCONDITION_Q20__NO_LAYOUT_BOX"]) invalid(command, { ...row, nativeCauseCode: forged });
    const eligiblePacket = { ...packet, queries: packet.queries.map(query => ({ ...query, rawCount: 1, eligibleCount: 1 })) };
    const selectedCommand = { ...command, intent: { ...command.intent, postClickObservation: { ...command.intent.postClickObservation,
      clickedCandidateAttribute: { name: "aria-checked" as const, equals: "true" as const } } } };
    const selected = { ...physical, clicked: true, postconditionObservation: eligiblePacket,
      clickedCandidateAttributeReadback: { name: "aria-checked", value: "true", verified: true } };
    expect(selectedCommand, selected, "confirmed", "confirmed", null, null, 1);
    invalid(selectedCommand, { ...selected, clickedCandidateAttributeReadback: { name: "aria-checked", value: "false", verified: false } });
    const layoutPacket = { ...packet, queries: packet.queries.map((query, index) => index === mismatch
      ? { ...query, rawCount: 1, rejections: [{ index: 0, reasons: ["NO_LAYOUT_BOX"] }] } : query) };
    const layoutCause = `BROWSER_POSTCONDITION_Q${mismatch}__NO_LAYOUT_BOX`;
    expect(command, { ...row, postconditionObservation: layoutPacket, nativeCauseCode: layoutCause }, "rejected", "confirmed", row.failureCode, layoutCause, 1);
  }
  assert.equal(browserPostconditionNativeCauseValid("BROWSER_POSTCONDITION_Q19__NO_LAYOUT_BOX"), true);
  assert.equal(browserPostconditionNativeCauseValid("BROWSER_POSTCONDITION_Q20__NO_LAYOUT_BOX"), false);
};
export const exerciseStrictMutationReceipts = (): void => { qualificationReceipts(); freshReceipts(); indexedReceipts(); };
