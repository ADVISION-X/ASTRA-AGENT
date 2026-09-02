import assert from "../audit/shared/governance-exam-assert.js";

import { parseBrowserAuthorityDiagnostic } from
  "../../src/lib/browser/transport/browser-authority-diagnostic.js";
import { parseBrowserAuthorityTargetClaim } from
  "../../src/lib/browser/transport/browser-authority-websocket.js";

export const exerciseBrowserDiagnosticContract = (): void => {
  assert.deepEqual(parseBrowserAuthorityTargetClaim({
    targetRef: "target-tab-7", documentRef: "document-7", navigationEpoch: 0,
    url: "https://chatgpt.com/",
  }), { targetRef: "target-tab-7", documentRef: "document-7", navigationEpoch: 0,
    url: "https://chatgpt.com/" });
  assert.throws(() => parseBrowserAuthorityTargetClaim({
    targetRef: "target-tab-7", documentRef: "document-7", navigationEpoch: 0,
    url: "https://chatgpt.com/", title: "must-not-cross-wire",
  }), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  "page title is not an admitted Target claim wire field");

  assert.deepEqual(parseBrowserAuthorityDiagnostic({
    reasonCode: "BROWSER_DOCUMENT_INVALID", failedFrameKind: "COMMAND", failedFrameSequence: 7,
    diagnosticSource: "extension-runtime", runtimeEventType: "command-handler",
    commandStage: "target-resolution", commandKind: "dom-intent", commandIntentKind: "click",
    capabilityId: "browser.dom.click.v1", targetRef: "target-tab-7", encodedByteLength: 0,
  }).refs, {
    failedFrameKind: "COMMAND", failedFrameSequence: "7", encodedByteLength: "0",
    diagnosticSource: "extension-runtime", runtimeEventType: "command-handler",
    commandStage: "target-resolution", commandKind: "dom-intent", commandIntentKind: "click",
    capabilityId: "browser.dom.click.v1", targetRef: "target-tab-7",
  });
  for (const invalid of [
    { errorName: "Error" },
    { runtimeEventType: "unbounded-runtime-event" },
    { targetRef: "raw-uncontrolled-target" },
  ]) assert.throws(() => parseBrowserAuthorityDiagnostic({
    reasonCode: "BROWSER_DOCUMENT_INVALID", failedFrameKind: "COMMAND", failedFrameSequence: 7,
    diagnosticSource: "extension-runtime", runtimeEventType: "command-handler",
    encodedByteLength: 0, ...invalid,
  }), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  "diagnostic refs must be complete controlled values or fail the whole frame");
  assert.throws(() => parseBrowserAuthorityDiagnostic({
    reasonCode: "BROWSER_DOCUMENT_INVALID", failedFrameKind: "COMMAND", failedFrameSequence: 7,
    encodedByteLength: 0,
  }), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  "diagnostic source and event type are mandatory controlled facts");
};
