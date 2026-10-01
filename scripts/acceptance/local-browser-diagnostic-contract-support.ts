import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import { parseBrowserAuthorityDiagnostic } from
  "../../src/lib/browser/transport/browser-authority-diagnostic.js";
import { parseBrowserAuthorityTargetClaim } from
  "../../src/lib/browser/transport/browser-authority-frame-payload.js";
import { BrowserAuthorityWebSocket } from
  "../../src/lib/browser/transport/browser-authority-websocket.js";

export const exerciseBrowserDiagnosticContract = (): void => {
  const jobRefHash = `sha256:${"a".repeat(64)}` as const;
  assert.deepEqual(parseBrowserAuthorityTargetClaim({
    targetRef: "target-tab-7", documentRef: "document-7", navigationEpoch: 0,
    claimOrigin: "https://chatgpt.com", jobRefHash,
  }), { targetRef: "target-tab-7", documentRef: "document-7", navigationEpoch: 0,
    claimOrigin: "https://chatgpt.com", jobRefHash });
  assert.throws(() => parseBrowserAuthorityTargetClaim({
    targetRef: "target-tab-7", documentRef: "document-7", navigationEpoch: 0,
    claimOrigin: "https://chatgpt.com", jobRefHash, title: "must-not-cross-wire",
  }), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  "page title is not an admitted Target claim wire field");

  assert.deepEqual(parseBrowserAuthorityDiagnostic({
    reasonCode: "BROWSER_DOCUMENT_INVALID", failedFrameKind: "COMMAND", failedFrameSequence: 7,
    diagnosticSource: "extension-runtime", runtimeEventType: "command-handler",
    commandStage: "target-resolution", commandKind: "dom-intent", commandIntentKind: "click",
    capabilityId: "browser.dom.click.v1", targetRef: "target-tab-7",
    nativeCauseCode: "CHROME_DEBUGGER_TARGET_CLOSED", encodedByteLength: 0,
  }).refs, {
    failedFrameKind: "COMMAND", failedFrameSequence: "7", encodedByteLength: "0",
    diagnosticSource: "extension-runtime", runtimeEventType: "command-handler",
    commandStage: "target-resolution", commandKind: "dom-intent", commandIntentKind: "click",
    capabilityId: "browser.dom.click.v1", targetRef: "target-tab-7",
    nativeCauseCode: "CHROME_DEBUGGER_TARGET_CLOSED",
  });
  for (const invalid of [
    { errorName: "Error" },
    { runtimeEventType: "unbounded-runtime-event" },
    { targetRef: "raw-uncontrolled-target" },
    { nativeCauseCode: "raw-uncontrolled-cause" },
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

  const rejected: Error[] = [];
  const timeout = setTimeout(() => undefined, 10_000);
  const websocket = new BrowserAuthorityWebSocket({
  onMutationReceipt: () => { throw new Error("UNEXPECTED_MUTATION_RECEIPT"); },
    pairingSecret: "a".repeat(64), onPairingStarted: () => {}, onHeartbeat: () => {},
    onAuthenticated: () => { throw new Error("UNUSED_AUTHENTICATION"); }, onTargetClaim: () => {},
    onTargetRevoke: () => {}, onDiagnostic: () => {}, onRevoked: () => {},
  });
  Reflect.set(websocket, "active", {
    socket: { send: () => {}, close: () => {} }, keys: {}, lastClientSequence: 0,
    nextServerSequence: 1, lastHeartbeatAt: Date.now(), replies: new Map([[7, {
      targetRef: "target-tab-7", replyChannelToken: "reply-7", permitSequence: 7,
      resolve: () => {}, reject: (error: Error) => { rejected.push(error); }, timeout,
    }]]),
  });
  websocket.rejectTargetCommands(
    "target-tab-7", "BROWSER_DEVTOOLS_CONFLICT", "CHROME_DEBUGGER_CANCELED_BY_USER",
  );
  assert.equal(rejected[0]?.message, "BROWSER_DEVTOOLS_CONFLICT");
  assert.equal((rejected[0]?.cause as { code?: string } | undefined)?.code,
    "CHROME_DEBUGGER_CANCELED_BY_USER",
    "a Target detach must reject the in-flight exact command with its native cause");

};
