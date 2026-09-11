import { isBrowserCapabilityId } from "../protocol/generated/browser-protocol.generated.js";

const ALLOWED_KEYS = new Set([
  "reasonCode", "failedFrameKind", "failedFrameSequence", "diagnosticSource", "runtimeEventType",
  "commandStage", "commandKind", "commandIntentKind", "capabilityId", "targetRef", "nativeCauseCode",
  "encodedByteLength",
]);
const FRAME_KINDS = new Set([
  "PAIR_HELLO", "PAIR_CHALLENGE", "PAIR_PROOF", "AUTHENTICATED", "READY", "HEARTBEAT", "COMMAND",
  "MUTATION_PROGRESS", "REPLY", "TARGET_ACQUIRE", "TARGET_CLAIM", "TARGET_REVOKE", "DIAGNOSTIC", "REVOKE",
  "ARTIFACT_CHUNK", "UNDECODED", "EXTENSION_RUNTIME",
]);
const CONTROLLED_VALUES: Readonly<Record<string, ReadonlySet<string>>> = {
  diagnosticSource: new Set(["extension-frame", "extension-runtime"]),
  runtimeEventType: new Set(["message-handler", "command-handler", "unhandledrejection", "worker-error",
    "liveness-pulse", "job-bound-target-acquisition", "debugger-detach", "tab-remove"]),
  commandStage: new Set(["payload", "command-shape", "command-admission", "target-resolution", "registered-command"]),
  commandKind: new Set(["dom-intent", "observe", "screenshot", "file-input",
    "authenticated-media", "wait", "park-target", "close-target"]),
  commandIntentKind: new Set(["document", "observe", "readExactAssistantTurn", "inspect", "find", "readText",
    "readAttribute", "selectExactGptConversation", "click", "hover", "doubleClick", "keypress", "fill"]),
  nativeCauseCode: new Set(["CHROME_DEBUGGER_TARGET_CLOSED", "CHROME_DEBUGGER_CANCELED_BY_USER"]),
};

const controlledOptional = (
  body: Readonly<Record<string, unknown>>,
  name: string,
  allowed: ReadonlySet<string>,
): string | null => {
  const value = body[name];
  if (value === undefined) return null;
  if (typeof value !== "string" || !allowed.has(value)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return value;
};

type DiagnosticHeader = Readonly<Record<string, unknown>> & Readonly<{
  reasonCode: string;
  failedFrameKind: string;
  failedFrameSequence: number;
  encodedByteLength: number;
}>;

const diagnosticHeaderValid = (body: Readonly<Record<string, unknown>>): body is DiagnosticHeader =>
  typeof body.reasonCode === "string" && /^BROWSER_[A-Z_]+$/u.test(body.reasonCode)
  && typeof body.failedFrameKind === "string" && FRAME_KINDS.has(body.failedFrameKind)
  && Number.isSafeInteger(body.failedFrameSequence) && (body.failedFrameSequence as number) >= 0
  && Number.isSafeInteger(body.encodedByteLength) && (body.encodedByteLength as number) >= 0;

const addCapabilityAndTargetRefs = (
  body: Readonly<Record<string, unknown>>,
  refs: Record<string, string>,
): void => {
  if (body.capabilityId !== undefined) {
    if (typeof body.capabilityId !== "string" || !isBrowserCapabilityId(body.capabilityId)) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    refs.capabilityId = body.capabilityId;
  }
  if (body.targetRef === undefined) return;
  if (typeof body.targetRef !== "string" || !/^(?:target-tab-|job-owned-tab:)\d+$/u.test(body.targetRef)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  refs.targetRef = body.targetRef;
};

export const parseBrowserAuthorityDiagnostic = (
  body: Readonly<Record<string, unknown>>,
): Readonly<{ reasonCode: string; refs: Readonly<Record<string, string>> }> => {
  if (Object.keys(body).some((key) => !ALLOWED_KEYS.has(key))) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  if (!diagnosticHeaderValid(body)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const { reasonCode, failedFrameKind, failedFrameSequence: sequence, encodedByteLength: byteLength } = body;
  const refs: Record<string, string> = {
    failedFrameKind, failedFrameSequence: String(sequence), encodedByteLength: String(byteLength),
  };
  const diagnosticSource = controlledOptional(body, "diagnosticSource", CONTROLLED_VALUES.diagnosticSource!);
  const runtimeEventType = controlledOptional(body, "runtimeEventType", CONTROLLED_VALUES.runtimeEventType!);
  if (diagnosticSource === null || runtimeEventType === null) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  refs.diagnosticSource = diagnosticSource;
  refs.runtimeEventType = runtimeEventType;
  for (const [name, allowed] of Object.entries(CONTROLLED_VALUES)
    .filter(([name]) => name !== "diagnosticSource" && name !== "runtimeEventType")) {
    const value = controlledOptional(body, name, allowed);
    if (value !== null) refs[name] = value;
  }
  addCapabilityAndTargetRefs(body, refs);
  return Object.freeze({ reasonCode, refs: Object.freeze(refs) });
};
