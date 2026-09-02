import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { inspectNode } from "./dom-query-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";

type CurrentTargetAssertion = (targetRef: string, documentRef: string) => void;
type Candidate = Readonly<{
  candidateCount: number;
  nodeId: number | null;
  facts: Readonly<Record<string, unknown>> | null;
}>;

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return value as Record<string, unknown>;
};

const safeRead = async <T>(operation: () => Promise<T>): Promise<T> => {
  try { return await operation(); }
  catch (error) {
    if (error instanceof Error && /^BROWSER_[A-Z_]+$/u.test(error.message)) throw error;
    const stale = error instanceof Error
      && /(?:could not find node|no node with given id|node.*(?:detached|does not exist|not found))/iu.test(error.message);
    throw new Error(stale ? "BROWSER_DOM_NODE_STALE" : "BROWSER_DOM_READ_INVALID", { cause: error });
  }
};

const reject = (candidateCount: number, failureCode: string): Readonly<Record<string, unknown>> =>
  Object.freeze({
    candidateCount,
    identityRevalidated: false,
    mutationCount: 0,
    postconditionVerified: false,
    qualificationRejected: true,
    failureCode,
  });

const readExactFileInput = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  assertCurrent: CurrentTargetAssertion,
  selector: string,
): Promise<Candidate> => {
  assertCurrent(target.targetRef, target.documentRef);
  const root = record(await safeRead(() => runtime.send(
    target.tabId, "DOM.getDocument", { depth: 1, pierce: true },
  ))).root;
  const nodeId = record(root).nodeId;
  if (!Number.isSafeInteger(nodeId)) throw new Error("BROWSER_DOM_READ_INVALID");
  const selection = record(await safeRead(() => runtime.send(
    target.tabId, "DOM.querySelectorAll", { nodeId, selector },
  )));
  if (!Array.isArray(selection.nodeIds)
    || !selection.nodeIds.every((value) => Number.isSafeInteger(value))) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  if (selection.nodeIds.length !== 1) {
    return Object.freeze({ candidateCount: selection.nodeIds.length, nodeId: null, facts: null });
  }
  const exactNodeId = selection.nodeIds[0] as number;
  const facts = await inspectNode(runtime, target.tabId, exactNodeId, [
    "tagName", "type", "connected", "disabled", "ariaDisabled", "multiple", "accept",
  ]);
  assertCurrent(target.targetRef, target.documentRef);
  return Object.freeze({ candidateCount: 1, nodeId: exactNodeId, facts });
};

const readSelectionCount = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  nodeId: number,
): Promise<number> => {
  const objectId = record(record(await runtime.send(tabId, "DOM.resolveNode", { nodeId })).object).objectId;
  if (typeof objectId !== "string" || objectId.length === 0) throw new Error("BROWSER_DOM_READ_INVALID");
  let primaryFailure: unknown = null;
  try {
    const call = record(await runtime.send(tabId, "Runtime.callFunctionOn", {
      objectId,
      functionDeclaration: "function () { return this instanceof HTMLInputElement && this.type === 'file' && this.files ? this.files.length : -1; }",
      returnByValue: true,
      awaitPromise: false,
      silent: true,
    }));
    const value = record(call.result).value;
    if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error("BROWSER_DOM_READ_INVALID");
    return value as number;
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    try { await runtime.send(tabId, "Runtime.releaseObject", { objectId }); }
    catch (error) { if (primaryFailure === null) throw new Error("BROWSER_DOM_READ_INVALID", { cause: error }); }
  }
};

const qualificationFailure = (error: unknown): string | null => {
  const code = error instanceof Error ? error.message : "";
  return /^BROWSER_DOM_(?:NODE_STALE|READ_INVALID)$/u.test(code) ? code : null;
};

export const executeExtensionFileInput = async (input: Readonly<{
  runtime: ExtensionDebuggerRuntime;
  target: ExtensionExactTarget;
  assertCurrent: CurrentTargetAssertion;
  selector: string;
  grantRefs: readonly string[];
  resolvedFilePaths: readonly string[];
}>): Promise<Readonly<Record<string, unknown>>> => {
  if (input.selector !== "#upload-files" || input.grantRefs.length < 1 || input.grantRefs.length > 20
    || input.resolvedFilePaths.length !== input.grantRefs.length
    || new Set(input.grantRefs).size !== input.grantRefs.length
    || input.resolvedFilePaths.some((filePath) => !filePath.startsWith("/"))) {
    throw new Error("BROWSER_FILE_GRANT_INVALID");
  }
  let candidate: Candidate;
  try {
    candidate = await readExactFileInput(input.runtime, input.target, input.assertCurrent, input.selector);
  } catch (error) {
    const code = qualificationFailure(error);
    if (code) return reject(0, code);
    throw error;
  }
  if (candidate.candidateCount !== 1 || candidate.nodeId === null || candidate.facts === null) {
    return reject(candidate.candidateCount, candidate.candidateCount === 0
      ? "BROWSER_DOM_CANDIDATE_MISSING" : "BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  }
  const qualified = candidate.facts.tagName === "INPUT" && candidate.facts.type === "file"
    && candidate.facts.connected === true && candidate.facts.disabled === false
    && candidate.facts.ariaDisabled === false
    && (input.resolvedFilePaths.length === 1 || candidate.facts.multiple === true)
    && typeof candidate.facts.accept === "string";
  if (!qualified) return reject(1, "BROWSER_FILE_INPUT_NOT_QUALIFIED");
  input.assertCurrent(input.target.targetRef, input.target.documentRef);
  await input.runtime.send(input.target.tabId, "DOM.setFileInputFiles", {
    nodeId: candidate.nodeId,
    files: [...input.resolvedFilePaths],
  });
  input.assertCurrent(input.target.targetRef, input.target.documentRef);
  let readback: Candidate;
  try {
    readback = await readExactFileInput(input.runtime, input.target, input.assertCurrent, input.selector);
  } catch (error) {
    const code = qualificationFailure(error);
    if (!code) throw error;
    return Object.freeze({
      candidateCount: 1, identityRevalidated: true, mutationCount: 1,
      postconditionVerified: false, failureCode: "BROWSER_POSTCONDITION_FAILED",
    });
  }
  const selectedFileCount = readback.nodeId === null
    ? -1 : await readSelectionCount(input.runtime, input.target.tabId, readback.nodeId);
  input.assertCurrent(input.target.targetRef, input.target.documentRef);
  const postconditionVerified = readback.candidateCount === 1 && readback.facts?.tagName === "INPUT"
    && readback.facts.type === "file" && readback.facts.connected === true
    && readback.facts.disabled === false && readback.facts.ariaDisabled === false
    && selectedFileCount === input.resolvedFilePaths.length;
  return Object.freeze({
    selectedFileCount,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    postconditionVerified,
    ...(postconditionVerified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }),
  });
};
