import { BROWSER_ERROR_CODES, type BrowserErrorCode } from "../protocol/generated/browser-protocol.generated.js";
import type { BrowserDiagnosticCommandStage } from "../transport/browser-authority-diagnostic.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";

type ReadStage = Extract<BrowserDiagnosticCommandStage,
  "rate-limit-preflight" | "exact-user-materialization" | "exact-assistant-observation">;
type ReadBinding = Readonly<{
  runtime: ExtensionDebuggerRuntime; target: ExtensionExactTarget;
  expectedMainFrameLoaderId: string; stage: ReadStage; assertCurrent(): void;
}>;

export class FixedDocumentReadFailure extends Error {
  public constructor(public readonly code: BrowserErrorCode,
    public readonly commandStage: ReadStage, cause: unknown) {
    super(code, { cause });
  }
}

const record = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return value as Record<string, unknown>;
};

const nativeCode = (error: unknown): BrowserErrorCode | null => error instanceof Error
  && (BROWSER_ERROR_CODES as readonly string[]).includes(error.message)
  ? error.message as BrowserErrorCode : null;

const assertPinnedDocument = async (binding: ReadBinding): Promise<void> => {
  binding.assertCurrent();
  const tree = record(await binding.runtime.send(binding.target.tabId, "Page.getFrameTree"));
  const frame = record(record(tree.frameTree).frame);
  binding.assertCurrent();
  if (!binding.expectedMainFrameLoaderId || frame.loaderId !== binding.expectedMainFrameLoaderId) {
    throw new Error("BROWSER_DOCUMENT_INVALID");
  }
};

const fixedExpression = (script: string, argument: unknown): string => `(async () => {
  try { return { kind: "value", value: await (${script}).call(document, ${JSON.stringify(argument)}) }; }
  catch (error) {
    const known = ["BROWSER_DOCUMENT_INVALID", "BROWSER_ORIGIN_REJECTED",
      "BROWSER_DOM_CANDIDATE_AMBIGUOUS", "BROWSER_DOM_READ_INVALID"];
    return { kind: "failure", code: error instanceof Error && known.includes(error.message)
      ? error.message : "BROWSER_DOM_SCRIPT_FAILED" };
  }
})()`;

const exceptionalReferences = (call: Record<string, unknown>): readonly string[] => {
  const result = call.result;
  const details = call.exceptionDetails;
  const exception = details && typeof details === "object" && !Array.isArray(details)
    ? (details as Record<string, unknown>).exception : null;
  return [...new Set([result, exception].flatMap((value) => {
    const id = value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>).objectId : null;
    return typeof id === "string" && id.length > 0 ? [id] : [];
  }))];
};

const settleFailedResponse = async (
  binding: ReadBinding, primary: FixedDocumentReadFailure, references: readonly string[],
): Promise<never> => {
  const causes: unknown[] = [primary.cause];
  try {
    await assertPinnedDocument(binding);
    for (const objectId of references) {
      try {
        binding.assertCurrent();
        await binding.runtime.send(binding.target.tabId, "Runtime.releaseObject", { objectId });
      } catch (error) { causes.push(error); }
    }
  } catch (error) { causes.push(error); }
  throw new FixedDocumentReadFailure(primary.code, primary.commandStage,
    new AggregateError(causes, "Fixed Document read failed; ancillary resource outcome retained"));
};

const decodeValue = <T>(call: Record<string, unknown>, decode: (value: unknown) => T | Promise<T>): T | Promise<T> => {
  const packet = record(record(call.result).value);
  if (Object.keys(packet).length !== 2) throw new Error("BROWSER_DOM_READ_INVALID");
  if (packet.kind === "failure" && Object.hasOwn(packet, "code")) {
    const codes = ["BROWSER_DOCUMENT_INVALID", "BROWSER_ORIGIN_REJECTED",
      "BROWSER_DOM_CANDIDATE_AMBIGUOUS", "BROWSER_DOM_READ_INVALID", "BROWSER_DOM_SCRIPT_FAILED"];
    if (typeof packet.code !== "string" || !codes.includes(packet.code)) throw new Error("BROWSER_DOM_READ_INVALID");
    throw new Error(packet.code);
  }
  if (packet.kind !== "value" || !Object.hasOwn(packet, "value")) throw new Error("BROWSER_DOM_READ_INVALID");
  return decode(packet.value);
};

/** Only Browser-owned fixed scripts enter here; no caller script or cross-call handle is accepted. */
export const readFixedDocument = async <T>(input: ReadBinding & Readonly<{
  script: string; argument: unknown; decode(value: unknown): T | Promise<T>;
}>): Promise<T> => {
  let executingNative = true;
  try {
    await assertPinnedDocument(input);
    input.assertCurrent();
    const raw = await input.runtime.send(input.target.tabId, "Runtime.evaluate", {
      expression: fixedExpression(input.script, input.argument),
      returnByValue: true, awaitPromise: true, silent: true,
    });
    executingNative = false;
    const call = record(raw);
    const references = exceptionalReferences(call);
    if (call.exceptionDetails !== undefined || references.length > 0) {
      const code = call.exceptionDetails !== undefined ? "BROWSER_DOM_SCRIPT_FAILED" : "BROWSER_DOM_READ_INVALID";
      return await settleFailedResponse(input, new FixedDocumentReadFailure(code, input.stage, raw), references);
    }
    executingNative = true;
    await assertPinnedDocument(input);
    executingNative = false;
    return await decodeValue(call, input.decode);
  } catch (error) {
    if (error instanceof FixedDocumentReadFailure) throw error;
    throw new FixedDocumentReadFailure(nativeCode(error)
      ?? (executingNative ? "BROWSER_DOM_EXECUTION_FAILED" : "BROWSER_DOM_READ_INVALID"), input.stage, error);
  }
};
