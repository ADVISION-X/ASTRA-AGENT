import type { BrowserAuthorityFrame } from "../transport/browser-authority-frame-codec.js";
import { browserCommandErrorCode, encodeText, pairingErrorCode } from "./websocket-actor-crypto.js";

export const extensionFrameDiagnostic = (
  error: unknown,
  frame: BrowserAuthorityFrame | null,
  data: unknown,
): Record<string, unknown> => ({
  reasonCode: pairingErrorCode(error),
  failedFrameKind: frame?.kind ?? "UNDECODED",
  failedFrameSequence: frame?.sequence ?? 0,
  diagnosticSource: "extension-frame",
  runtimeEventType: "message-handler",
  errorName: error instanceof Error ? error.name : "UnknownError",
  encodedByteLength: typeof data === "string" ? encodeText(data).byteLength : 0,
});

export const extensionRuntimeDiagnostic = (
  error: unknown,
  runtimeEventType: "unhandledrejection" | "worker-error" | "liveness-pulse" | "automatic-target-claim",
  failedFrameSequence: number,
): Record<string, unknown> => ({
  reasonCode: browserCommandErrorCode(error),
  failedFrameKind: "EXTENSION_RUNTIME",
  failedFrameSequence,
  diagnosticSource: "extension-runtime",
  runtimeEventType,
  errorName: error instanceof Error && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u.test(error.name) ? error.name : "UnknownError",
  encodedByteLength: 0,
});
