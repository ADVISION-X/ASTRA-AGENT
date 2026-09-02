import assert from "../audit/shared/governance-exam-assert.js";

import { decodeBrowserMutationReceipt } from
  "../../src/lib/browser/exact-target/browser-mutation-receipt.js";

const clickCommand = { kind: "dom-intent" as const, intent: {
  kind: "click" as const, selector: "button", expectedMatches: 1,
  postClickMatch: { selector: "done", expectedMatches: 1 },
} };

const fileCommand = { kind: "file-input" as const, selector: "#upload-files",
  approvedFiles: [{ grantRef: "grant-one", contentHash: `sha256:${"a".repeat(64)}` as const,
    maxBytes: 64 }], resolvedFilePaths: ["/approved/one.txt"] };
const keypressCommand = { kind: "dom-intent" as const, intent: {
  kind: "keypress" as const, selector: "button", key: "Enter" as const, expectedMatches: 1,
  postKeypressMatch: { selector: "done", expectedMatches: 1 },
} };
const fillCommand = { kind: "dom-intent" as const, intent: {
  kind: "fill" as const, selector: "#prompt-textarea", approvedText: "approved",
  clearBeforeType: false, expectedMatches: 1,
} };

export const exerciseStrictMutationReceipts = (): void => {
  const fileSuccess = { candidateCount: 1, identityRevalidated: true, mutationCount: 1,
    selectedFileCount: 1, approvedSetVerified: true, acceptVerified: true,
    postconditionVerified: true };
  assert.deepEqual(decodeBrowserMutationReceipt(fileCommand, fileSuccess), {
    terminal: "confirmed", mutationOutcome: "confirmed", failureCode: null,
  });
  for (const forged of [
    { ...fileSuccess, resolvedFilePaths: ["/secret.txt"] },
    { ...fileSuccess, failureCode: "BROWSER_POSTCONDITION_FAILED" },
  ]) assert.throws(() => decodeBrowserMutationReceipt(fileCommand, forged),
    /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
    "file-input success receipts must reject extra or contradictory fields");

  const crossKindFailure = { candidateCount: 1, qualificationStage: "actionability",
    identityRevalidated: false, mutationCount: 0,
    postconditionVerified: false, qualificationRejected: true,
    failureCode: "BROWSER_FILE_INPUT_NOT_QUALIFIED" };
  assert.throws(() => decodeBrowserMutationReceipt(clickCommand, crossKindFailure),
    /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
    "DOM commands must reject file-input-only qualification causes");
  for (const command of [clickCommand, keypressCommand, fillCommand] as const) {
    const failureCode = "BROWSER_DOM_ACTION_NOT_QUALIFIED" as const;
    assert.deepEqual(decodeBrowserMutationReceipt(command, {
    ...crossKindFailure, failureCode,
  }), { terminal: "rejected", mutationOutcome: "no", failureCode },
  "pointer, keyboard, and fill actionability may truthfully reject one locked candidate with zero input");
  }
  assert.deepEqual(decodeBrowserMutationReceipt(clickCommand, {
    ...crossKindFailure, candidateCount: 0, qualificationStage: "candidate-set",
    failureCode: "BROWSER_DOM_CANDIDATE_MISSING",
  }), { terminal: "rejected", mutationOutcome: "no",
    failureCode: "BROWSER_DOM_CANDIDATE_MISSING" });
  assert.throws(() => decodeBrowserMutationReceipt(clickCommand, {
    ...crossKindFailure, qualificationStage: "candidate-set", failureCode: "BROWSER_DOM_CANDIDATE_MISSING",
  }), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  "candidate-set causes and candidate counts must describe the same fact");
};
