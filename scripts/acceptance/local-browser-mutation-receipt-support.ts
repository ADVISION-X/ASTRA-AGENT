import { preflightReceiptObservationHash } from "../../src/lib/browser/exact-target/browser-special-mutation-receipt.js";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import { decodeBrowserMutationReceipt } from
  "../../src/lib/browser/exact-target/browser-mutation-receipt.js";
import {
  BROWSER_DOM_CANDIDATE_MISSING_STAGES, browserPostconditionNativeCauseValid,
} from "../../src/lib/browser/exact-target/browser-interaction-native-cause.js";
import { CANDIDATE_MISSING_STAGE_SOURCE, candidateMissingFailure, candidateMissingStage } from
  "../../src/lib/browser/chrome-extension/dom-candidate-missing-stage.js";

const clickCommand = { kind: "dom-intent" as const, intent: {
  kind: "click" as const, selector: "button", expectedMatches: 1,
  postClickMatch: { selector: "done", expectedMatches: 1 },
} };

const fileCommand = { kind: "file-input" as const, selector: "form[data-chatgpt-composer] input[type='file'][aria-label='附加文件']",
  activation: { selector: "[data-mention-list-scroll-area] > div:first-child > button[data-list-navigation-item='true']:first-child",
    scope: { selector: "[data-composer-overlay-floating-ui='true']" },
    expectedText: "上传" },
  approvedFiles: [{ grantRef: "grant-one", contentHash: `sha256:${"a".repeat(64)}` as const,
    maxBytes: 64 }], resolvedFilePaths: ["/approved/one.txt"] };
const keypressCommand = { kind: "dom-intent" as const, intent: {
  kind: "keypress" as const, selector: "button", key: "Enter" as const, expectedMatches: 1,
  postKeypressMatch: { selector: "done", expectedMatches: 1 },
} };
const fillCommand = { kind: "dom-intent" as const, intent: {
  kind: "fill" as const, selector: "form[data-chatgpt-composer] [data-composer-markdown][contenteditable='true'][role='textbox']", approvedText: "approved",
  clearBeforeType: false, expectedMatches: 1,
} };
const visibleMatchEvidence = {
  postconditionRawCount: 1, postconditionEligibleCount: 1, postconditionRejections: [],
} as const;
const observationClickCommand = { kind: "dom-intent" as const, intent: {
  kind: "click" as const, selector: "button", expectedMatches: 1,
  postClickObservation: { timeoutMs: 5_000, queries: [
    { queryId: "entry", selector: "[role='menuitem']", maxMatches: 2, fields: [],
      expectedEligibleCount: 0 },
    { queryId: "advanced", selector: "[data-active='true']", maxMatches: 2, fields: [],
      expectedEligibleCount: 1 },
  ] },
} };
const selectedCandidateCommand = { kind: "dom-intent" as const, intent: {
  ...observationClickCommand.intent,
  postClickObservation: {
    ...observationClickCommand.intent.postClickObservation,
    clickedCandidateAttribute: { name: "aria-checked" as const, equals: "true" as const },
  },
} };
const observationPacket = (advancedEligibleCount: number) => ({
  schemaVersion: "grasseye.browser.dom-observation.v2",
  exactCallIdentityHash: `sha256:${"1".repeat(64)}`,
  targetRefHash: `sha256:${"2".repeat(64)}`,
  documentRefHash: `sha256:${"3".repeat(64)}`,
  currentUrl: "https://chatgpt.com/",
  observationRevisionHash: `sha256:${"4".repeat(64)}`,
  observedAt: "2026-09-04T00:00:00.000Z",
  queries: [
    { queryId: "entry", rawCount: 1, eligibleCount: 0,
      rejections: [{ index: 0, reasons: ["ARIA_HIDDEN"] }] },
    { queryId: "advanced", rawCount: advancedEligibleCount, eligibleCount: advancedEligibleCount,
      rejections: [] },
  ],
});

const crossKindFailure = { candidateCount: 1, qualificationStage: "actionability",
  identityRevalidated: false, mutationCount: 0,
  postconditionVerified: false, qualificationRejected: true,
  failureCode: "BROWSER_FILE_INPUT_NOT_QUALIFIED", nativeCauseCode: null };

const exerciseFileAndQualificationReceipts = (): void => {
  const fileSuccess = { candidateCount: 1, identityRevalidated: true, mutationCount: 1,
    postconditionVerified: true };
  assert.deepEqual(decodeBrowserMutationReceipt(fileCommand, fileSuccess, preflightReceiptObservationHash(fileSuccess)), {
    terminal: "confirmed", mutationOutcome: "confirmed", failureCode: null, nativeCauseCode: null,
    physicalInputCount: 1,
  });
  for (const forged of [
    { ...fileSuccess, resolvedFilePaths: ["/secret.txt"] },
    { ...fileSuccess, failureCode: "BROWSER_POSTCONDITION_FAILED" },
    { ...fileSuccess, selectedFileCount: 1, approvedSetVerified: true, acceptVerified: true },
  ]) assert.throws(() => decodeBrowserMutationReceipt(fileCommand, forged, preflightReceiptObservationHash(forged)),
    /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
    "file-input success receipts must reject extra or contradictory fields");

  assert.throws(() => decodeBrowserMutationReceipt(clickCommand, crossKindFailure, preflightReceiptObservationHash(crossKindFailure)),
    /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
    "DOM commands must reject file-input-only qualification causes");
  const interactionFailure = { ...crossKindFailure, candidateCount: 0,
    qualificationStage: "candidate-set", failureCode: "BROWSER_TARGET_NOT_INTERACTIVE" };
  assert.deepEqual(decodeBrowserMutationReceipt(clickCommand, {
    ...interactionFailure, nativeCauseCode: "BROWSER_ORIGIN_REJECTED",
  }, preflightReceiptObservationHash({
    ...interactionFailure, nativeCauseCode: "BROWSER_ORIGIN_REJECTED",
  })), { terminal: "rejected", mutationOutcome: "no",
    failureCode: "BROWSER_TARGET_NOT_INTERACTIVE", nativeCauseCode: "BROWSER_ORIGIN_REJECTED",
    physicalInputCount: 0 });
  for (const nativeCauseCode of ["BROWSER_DEVTOOLS_CONFLICT", "raw uncontrolled cause"]) {
    assert.throws(() => decodeBrowserMutationReceipt(clickCommand, {
      ...interactionFailure, nativeCauseCode,
    }, preflightReceiptObservationHash({
      ...interactionFailure, nativeCauseCode,
    })), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
    "interaction receipts must reject every cause outside the fixed safe close set");
  }
  for (const command of [clickCommand, keypressCommand, fillCommand] as const) {
    const failureCode = "BROWSER_DOM_ACTION_NOT_QUALIFIED" as const;
    const nativeCauseCode = command.intent.kind === "click"
      ? "BROWSER_DOM_ACTION_HIT_TEST_FAILED" as const : "BROWSER_DOM_CANDIDATE_MISSING" as const;
    assert.deepEqual(decodeBrowserMutationReceipt(command, {
    ...crossKindFailure, failureCode, nativeCauseCode,
  }, preflightReceiptObservationHash({
    ...crossKindFailure, failureCode, nativeCauseCode,
  })), { terminal: "rejected", mutationOutcome: "no", failureCode, nativeCauseCode,
    physicalInputCount: 0 },
  "pointer, keyboard, and fill actionability may truthfully reject one locked candidate with zero input");
  }
  for (const command of [keypressCommand, fillCommand] as const) assert.throws(() =>
    decodeBrowserMutationReceipt(command, {
      ...crossKindFailure, failureCode: "BROWSER_DOM_ACTION_NOT_QUALIFIED",
      nativeCauseCode: "BROWSER_DOM_ACTION_HIT_TEST_FAILED",
    }, preflightReceiptObservationHash({
      ...crossKindFailure, failureCode: "BROWSER_DOM_ACTION_NOT_QUALIFIED",
      nativeCauseCode: "BROWSER_DOM_ACTION_HIT_TEST_FAILED",
    })), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  "keyboard actions must reject pointer-only native causes");
  assert.deepEqual(decodeBrowserMutationReceipt(clickCommand, {
    ...crossKindFailure, candidateCount: 0, qualificationStage: "candidate-set",
    failureCode: "BROWSER_DOM_CANDIDATE_MISSING", nativeCauseCode: null,
  }, preflightReceiptObservationHash({
    ...crossKindFailure, candidateCount: 0, qualificationStage: "candidate-set",
    failureCode: "BROWSER_DOM_CANDIDATE_MISSING", nativeCauseCode: null,
  })), { terminal: "rejected", mutationOutcome: "no",
    failureCode: "BROWSER_DOM_CANDIDATE_MISSING", nativeCauseCode: null,
    physicalInputCount: 0 });
  assert.throws(() => decodeBrowserMutationReceipt(clickCommand, {
    ...crossKindFailure, qualificationStage: "candidate-set", failureCode: "BROWSER_DOM_CANDIDATE_MISSING",
  }, preflightReceiptObservationHash({
    ...crossKindFailure, qualificationStage: "candidate-set", failureCode: "BROWSER_DOM_CANDIDATE_MISSING",
  })), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  "candidate-set causes and candidate counts must describe the same fact");
};

const exerciseCandidateMissingStageReceipts = (): void => {
  const pageClassifier = new Function(`${CANDIDATE_MISSING_STAGE_SOURCE}\nreturn candidateMissing;`)() as
    (scopeRaw: number, scopeEligible: number, raw: number) => string;
  for (const [counts, stage] of [
    [[0, 0, 0], "BROWSER_DOM_SCOPE_ABSENT"],
    [[3, 0, 0], "BROWSER_DOM_SCOPE_INELIGIBLE"],
    [[1, 1, 0], "BROWSER_DOM_SELECTOR_ABSENT"],
    [[1, 1, 2], "BROWSER_DOM_CANDIDATE_INELIGIBLE"],
  ] as const) {
    const reply = pageClassifier(counts[0], counts[1], counts[2]);
    assert.equal(reply, `BROWSER_DOM_CANDIDATE_MISSING:${stage}`, "the executed page source must classify by counts only");
    const decoded = candidateMissingFailure(reply);
    assert.equal(decoded?.message, "BROWSER_DOM_CANDIDATE_MISSING", "the primary failure code must stay unchanged");
    assert.equal(candidateMissingStage(decoded), stage);
  }
  assert.throws(() => candidateMissingFailure("BROWSER_DOM_CANDIDATE_MISSING:UNKNOWN"), /BROWSER_DOM_READ_INVALID/u);
  const candidateMissing = { ...crossKindFailure, candidateCount: 0, qualificationStage: "candidate-set",
    failureCode: "BROWSER_DOM_CANDIDATE_MISSING" };
  const rateLimitCommand = { kind: "dom-intent" as const, intent: {
    kind: "acknowledgeKnownGptRateLimit" as const, targetRefHash: `sha256:${"2".repeat(64)}` as const,
    documentRefHash: `sha256:${"3".repeat(64)}` as const, dispatchNotAfter: null,
  } };
  for (const command of [clickCommand, keypressCommand, fillCommand, rateLimitCommand] as const) {
    for (const nativeCauseCode of BROWSER_DOM_CANDIDATE_MISSING_STAGES) {
      assert.deepEqual(decodeBrowserMutationReceipt(command, { ...candidateMissing, nativeCauseCode }, preflightReceiptObservationHash({ ...candidateMissing, nativeCauseCode })), {
        terminal: "rejected", mutationOutcome: "no", failureCode: "BROWSER_DOM_CANDIDATE_MISSING",
        nativeCauseCode, physicalInputCount: 0,
      }, `${command.intent.kind} must persist the Browser-owned candidate-set stage`);
    }
  }
  for (const [command, nativeCauseCode, reason] of [
    [fileCommand, "BROWSER_DOM_SELECTOR_ABSENT", "file-input keeps the null-only candidate-set cause"],
    [clickCommand, "BROWSER_DOM_SCOPE_MISSING", "unknown stages fail closed"],
    [clickCommand, "NO_LAYOUT_BOX", "stages never reuse per-node eligibility reasons"],
  ] as const) assert.throws(() => decodeBrowserMutationReceipt(command, { ...candidateMissing, nativeCauseCode }, preflightReceiptObservationHash({ ...candidateMissing, nativeCauseCode })),
    /BROWSER_AUTH_TRANSCRIPT_INVALID/u, reason);
  assert.throws(() => decodeBrowserMutationReceipt(clickCommand, {
    ...candidateMissing, candidateCount: 2, failureCode: "BROWSER_DOM_CANDIDATE_AMBIGUOUS",
    nativeCauseCode: "BROWSER_DOM_CANDIDATE_INELIGIBLE",
  }, preflightReceiptObservationHash({
    ...candidateMissing, candidateCount: 2, failureCode: "BROWSER_DOM_CANDIDATE_AMBIGUOUS",
    nativeCauseCode: "BROWSER_DOM_CANDIDATE_INELIGIBLE",
  })), /BROWSER_AUTH_TRANSCRIPT_INVALID/u, "only a missing candidate set may carry a missing stage");
};

const exerciseFreshReadbackReceipts = (): void => {
  const fillReadbackFailure = {
    filled: true, candidateCount: 0, identityRevalidated: false, mutationCount: 1,
    retainedValueVerified: false, postconditionVerified: false,
    failureCode: "BROWSER_POSTCONDITION_FAILED", nativeCauseCode: "BROWSER_DOM_CANDIDATE_MISSING",
  };
  assert.deepEqual(decodeBrowserMutationReceipt(fillCommand, fillReadbackFailure, preflightReceiptObservationHash(fillReadbackFailure)), {
    terminal: "rejected", mutationOutcome: "confirmed", failureCode: "BROWSER_POSTCONDITION_FAILED",
    nativeCauseCode: "BROWSER_DOM_CANDIDATE_MISSING", physicalInputCount: 1,
  });
  for (const forged of [
    { ...fillReadbackFailure, nativeCauseCode: undefined },
    { ...fillReadbackFailure, nativeCauseCode: "BROWSER_TARGET_INVALID" },
  ]) assert.throws(() => decodeBrowserMutationReceipt(fillCommand, forged, preflightReceiptObservationHash(forged)),
    /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
    "a failed fresh fill readback must preserve one admitted DOM cause");
  assert.deepEqual(decodeBrowserMutationReceipt(clickCommand, {
    clicked: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1,
    postconditionVerified: true, ...visibleMatchEvidence,
  }, preflightReceiptObservationHash({
    clicked: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1,
    postconditionVerified: true, ...visibleMatchEvidence,
  })), { terminal: "confirmed", mutationOutcome: "confirmed", failureCode: null, nativeCauseCode: null,
    physicalInputCount: 1 });
  const coherentSuccess = {
    clicked: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1,
    postconditionVerified: true, postconditionObservation: observationPacket(1),
  };
  assert.deepEqual(decodeBrowserMutationReceipt(observationClickCommand, coherentSuccess, preflightReceiptObservationHash(coherentSuccess)), {
    terminal: "confirmed", mutationOutcome: "confirmed", failureCode: null, nativeCauseCode: null,
    physicalInputCount: 1,
  }, "coherent postconditions must compare eligible cardinality without requiring raw DOM absence");
  const selectedCandidateSuccess = {
    ...coherentSuccess,
    clickedCandidateAttributeReadback: { name: "aria-checked", value: "true", verified: true },
  };
  assert.deepEqual(decodeBrowserMutationReceipt(selectedCandidateCommand, selectedCandidateSuccess, preflightReceiptObservationHash(selectedCandidateSuccess)), {
    terminal: "confirmed", mutationOutcome: "confirmed", failureCode: null, nativeCauseCode: null,
    physicalInputCount: 1,
  }, "the exact selected-candidate attribute readback is part of the successful click receipt");
  assert.throws(() => decodeBrowserMutationReceipt(selectedCandidateCommand, {
    ...selectedCandidateSuccess,
    clickedCandidateAttributeReadback: { name: "aria-checked", value: "false", verified: false },
  }, preflightReceiptObservationHash({
    ...selectedCandidateSuccess,
    clickedCandidateAttributeReadback: { name: "aria-checked", value: "false", verified: false },
  })), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  "a selected-candidate success cannot claim an unchecked clicked radio");
  const coherentFailure = {
    ...coherentSuccess, postconditionVerified: false, postconditionObservation: observationPacket(0),
    failureCode: "BROWSER_POSTCONDITION_FAILED",
    nativeCauseCode: "BROWSER_POSTCONDITION_Q1__BROWSER_DOM_CANDIDATE_MISSING",
  };
  assert.deepEqual(decodeBrowserMutationReceipt(observationClickCommand, coherentFailure, preflightReceiptObservationHash(coherentFailure)), {
    terminal: "rejected", mutationOutcome: "confirmed", failureCode: "BROWSER_POSTCONDITION_FAILED",
    nativeCauseCode: "BROWSER_POSTCONDITION_Q1__BROWSER_DOM_CANDIDATE_MISSING", physicalInputCount: 1,
  });
  assert.throws(() => decodeBrowserMutationReceipt(observationClickCommand, {
    ...coherentFailure, nativeCauseCode: "BROWSER_DOM_CANDIDATE_AMBIGUOUS",
  }, preflightReceiptObservationHash({
    ...coherentFailure, nativeCauseCode: "BROWSER_DOM_CANDIDATE_AMBIGUOUS",
  })), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  "coherent negative receipts must preserve the mechanical cause of the first mismatched query");
};

const exercisePostconditionEvidenceReceipts = (): void => {
  const ariaHiddenPostconditionFailure = {
    clicked: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1,
    postconditionVerified: false, postconditionRawCount: 1, postconditionEligibleCount: 0,
    postconditionRejections: [{ index: 0, reasons: ["ARIA_HIDDEN"] }],
    failureCode: "BROWSER_POSTCONDITION_FAILED", nativeCauseCode: "ARIA_HIDDEN",
  } as const;
  assert.deepEqual(decodeBrowserMutationReceipt(clickCommand, ariaHiddenPostconditionFailure, preflightReceiptObservationHash(ariaHiddenPostconditionFailure)), {
    terminal: "rejected", mutationOutcome: "confirmed",
    failureCode: "BROWSER_POSTCONDITION_FAILED", nativeCauseCode: "ARIA_HIDDEN",
    physicalInputCount: 1,
  }, "a failed match must retain raw and eligible counts plus the exact ARIA_HIDDEN cause");
  for (const forged of [
    { ...ariaHiddenPostconditionFailure, postconditionRejections: [] },
    { ...ariaHiddenPostconditionFailure, nativeCauseCode: "BROWSER_DOM_CANDIDATE_MISSING" },
  ]) assert.throws(() => decodeBrowserMutationReceipt(clickCommand, forged, preflightReceiptObservationHash(forged)),
    /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
    "postcondition evidence and native cause must describe the same candidate set");
};

const observationPacketHeader = {
  schemaVersion: "grasseye.browser.dom-observation.v2",
  exactCallIdentityHash: `sha256:${"1".repeat(64)}`,
  targetRefHash: `sha256:${"2".repeat(64)}`,
  documentRefHash: `sha256:${"3".repeat(64)}`,
  currentUrl: "https://chatgpt.com/",
  observationRevisionHash: `sha256:${"4".repeat(64)}`,
  observedAt: "2026-09-04T00:00:00.000Z",
} as const;

const observationCommandWithQueries = (queryCount: number) => ({
  kind: "dom-intent" as const,
  intent: {
    kind: "click" as const, selector: "button", expectedMatches: 1,
    postClickObservation: { timeoutMs: 5_000, queries: Array.from({ length: queryCount }, (_, index) => ({
      queryId: `q${index}`, selector: `[data-q='${index}']`, maxMatches: 1, fields: [],
      expectedEligibleCount: 1,
    })) },
  },
});

const observationPacketWithMismatch = (queryCount: number, mismatch: Readonly<{
  index: number; rawCount: number; eligibleCount: number;
  rejections?: readonly Readonly<{ index: number; reasons: readonly string[] }>[];
}>) => ({
  ...observationPacketHeader,
  queries: Array.from({ length: queryCount }, (_, index) => index === mismatch.index
    ? { queryId: `q${index}`, rawCount: mismatch.rawCount, eligibleCount: mismatch.eligibleCount,
      rejections: mismatch.rejections ?? [] }
    : { queryId: `q${index}`, rawCount: 1, eligibleCount: 1, rejections: [] }),
});

/** P-验收: the 20x11 closed-set query-index prefix on observational postcondition native causes. */
const exercisePostconditionQueryIndexCauses = (): void => {
  const sixQueryCommand = observationCommandWithQueries(6);
  const missingAtQ2 = {
    clicked: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1,
    postconditionVerified: false,
    postconditionObservation: observationPacketWithMismatch(6, { index: 2, rawCount: 0, eligibleCount: 0 }),
    failureCode: "BROWSER_POSTCONDITION_FAILED",
    nativeCauseCode: "BROWSER_POSTCONDITION_Q2__BROWSER_DOM_CANDIDATE_MISSING",
  };
  assert.deepEqual(decodeBrowserMutationReceipt(sixQueryCommand, missingAtQ2, preflightReceiptObservationHash(missingAtQ2)), {
    terminal: "rejected", mutationOutcome: "confirmed", failureCode: "BROWSER_POSTCONDITION_FAILED",
    nativeCauseCode: "BROWSER_POSTCONDITION_Q2__BROWSER_DOM_CANDIDATE_MISSING", physicalInputCount: 1,
  }, "P.1: a 6-query profile packet missing its 3rd query must surface Q2__BROWSER_DOM_CANDIDATE_MISSING");

  const invisibleAtQ0 = {
    clicked: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1,
    postconditionVerified: false,
    postconditionObservation: observationPacketWithMismatch(6, { index: 0, rawCount: 1, eligibleCount: 0,
      rejections: [{ index: 0, reasons: ["NO_LAYOUT_BOX"] }] }),
    failureCode: "BROWSER_POSTCONDITION_FAILED",
    nativeCauseCode: "BROWSER_POSTCONDITION_Q0__NO_LAYOUT_BOX",
  };
  assert.deepEqual(decodeBrowserMutationReceipt(sixQueryCommand, invisibleAtQ0, preflightReceiptObservationHash(invisibleAtQ0)), {
    terminal: "rejected", mutationOutcome: "confirmed", failureCode: "BROWSER_POSTCONDITION_FAILED",
    nativeCauseCode: "BROWSER_POSTCONDITION_Q0__NO_LAYOUT_BOX", physicalInputCount: 1,
  }, "P.2: the first query's own ineligibility reason must survive unchanged under the Q0 prefix");

  for (const forgedCause of [
    "BROWSER_POSTCONDITION_Q1__BROWSER_DOM_CANDIDATE_MISSING",
    "BROWSER_POSTCONDITION_Q2__BROWSER_DOM_CANDIDATE_AMBIGUOUS",
    "BROWSER_DOM_CANDIDATE_MISSING",
  ]) assert.throws(() => decodeBrowserMutationReceipt(sixQueryCommand, {
    ...missingAtQ2, nativeCauseCode: forgedCause,
  }, preflightReceiptObservationHash({
    ...missingAtQ2, nativeCauseCode: forgedCause,
  })), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  `P.3: a forged index or base cause (${forgedCause}) must never be accepted`);

  const singleMatchFailure = {
    clicked: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1,
    postconditionVerified: false, postconditionRawCount: 1, postconditionEligibleCount: 0,
    postconditionRejections: [{ index: 0, reasons: ["ARIA_HIDDEN"] }],
    failureCode: "BROWSER_POSTCONDITION_FAILED", nativeCauseCode: "ARIA_HIDDEN",
  } as const;
  assert.deepEqual(decodeBrowserMutationReceipt(clickCommand, singleMatchFailure, preflightReceiptObservationHash(singleMatchFailure)), {
    terminal: "rejected", mutationOutcome: "confirmed", failureCode: "BROWSER_POSTCONDITION_FAILED",
    nativeCauseCode: "ARIA_HIDDEN", physicalInputCount: 1,
  }, "P.4: single-match-type postconditions must keep their unprefixed native cause");

  assert.equal(browserPostconditionNativeCauseValid("BROWSER_POSTCONDITION_Q19__NO_LAYOUT_BOX"), true);
  assert.equal(browserPostconditionNativeCauseValid("BROWSER_POSTCONDITION_Q20__NO_LAYOUT_BOX"), false);
  const twentyQueryCommand = observationCommandWithQueries(20);
  const q19Failure = {
    clicked: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1,
    postconditionVerified: false,
    postconditionObservation: observationPacketWithMismatch(20, { index: 19, rawCount: 1, eligibleCount: 0,
      rejections: [{ index: 0, reasons: ["NO_LAYOUT_BOX"] }] }),
    failureCode: "BROWSER_POSTCONDITION_FAILED",
    nativeCauseCode: "BROWSER_POSTCONDITION_Q19__NO_LAYOUT_BOX",
  };
  assert.deepEqual(decodeBrowserMutationReceipt(twentyQueryCommand, q19Failure, preflightReceiptObservationHash(q19Failure)), {
    terminal: "rejected", mutationOutcome: "confirmed", failureCode: "BROWSER_POSTCONDITION_FAILED",
    nativeCauseCode: "BROWSER_POSTCONDITION_Q19__NO_LAYOUT_BOX", physicalInputCount: 1,
  }, "P.6: the last permitted query index (19) must be accepted");
  assert.throws(() => decodeBrowserMutationReceipt(twentyQueryCommand, {
    ...q19Failure, nativeCauseCode: "BROWSER_POSTCONDITION_Q20__NO_LAYOUT_BOX",
  }, preflightReceiptObservationHash({
    ...q19Failure, nativeCauseCode: "BROWSER_POSTCONDITION_Q20__NO_LAYOUT_BOX",
  })), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  "P.6: a query index beyond the 20-query cap must never be accepted");
};

export const exerciseStrictMutationReceipts = (): void => {
  exerciseFileAndQualificationReceipts();
  exerciseCandidateMissingStageReceipts();
  exerciseFreshReadbackReceipts();
  exercisePostconditionEvidenceReceipts();
  exercisePostconditionQueryIndexCauses();
};
