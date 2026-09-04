import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { resolveCoherentPointerAction } from "./dom-coherent-candidate.js";
import { dispatchPointerClickSequence } from "./dom-intent-runtime.js";
import { inspectNode } from "./dom-query-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";

type CurrentTargetAssertion = (targetRef: string, documentRef: string) => void;
type Candidate = Readonly<{
  candidateCount: number;
  nodeId: number | null;
  backendNodeId: number | null;
  facts: Readonly<Record<string, unknown>> | null;
}>;
type FileInputActivation = Readonly<{
  selector: string;
  scope: Readonly<{ selector: string }>;
  expectedTextEquals: string;
}>;
type ApprovedFile = Readonly<{
  grantRef: string;
  contentHash: `sha256:${string}`;
  maxBytes: number;
}>;
type SelectionProof = Readonly<{
  selectedFileCount: number;
  approvedSetVerified: boolean;
  acceptVerified: boolean;
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

const reject = (
  candidateCount: number,
  failureCode: string,
  qualificationStage: "candidate-set" | "actionability",
): Readonly<Record<string, unknown>> =>
  Object.freeze({
    candidateCount,
    qualificationStage,
    identityRevalidated: false,
    mutationCount: 0,
    postconditionVerified: false,
    qualificationRejected: true,
    failureCode,
    nativeCauseCode: null,
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
    return Object.freeze({
      candidateCount: selection.nodeIds.length,
      nodeId: null,
      backendNodeId: null,
      facts: null,
    });
  }
  const exactNodeId = selection.nodeIds[0] as number;
  const described = record(record(await safeRead(() => runtime.send(
    target.tabId, "DOM.describeNode", { nodeId: exactNodeId },
  ))).node);
  if (!Number.isSafeInteger(described.backendNodeId)) throw new Error("BROWSER_DOM_READ_INVALID");
  const facts = await inspectNode(runtime, target.tabId, exactNodeId, [
    "tagName", "type", "connected", "disabled", "ariaDisabled", "multiple", "accept",
  ]);
  assertCurrent(target.targetRef, target.documentRef);
  return Object.freeze({
    candidateCount: 1,
    nodeId: exactNodeId,
    backendNodeId: described.backendNodeId as number,
    facts,
  });
};

const SELECTION_PROOF_FUNCTION = `async function (approvedFiles) {
  if (!(this instanceof HTMLInputElement) || this.type !== "file" || !this.files) return null;
  const acceptTokens = this.accept.split(",").map((token) => token.trim().toLowerCase()).filter(Boolean);
  const accepts = (file) => acceptTokens.length === 0 || acceptTokens.some((token) => {
    if (token.startsWith(".")) return file.name.toLowerCase().endsWith(token);
    if (token.endsWith("/*")) return file.type.toLowerCase().startsWith(token.slice(0, -1));
    return file.type.toLowerCase() === token;
  });
  const selected = [];
  for (const file of Array.from(this.files)) {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
    const contentHash = "sha256:" + Array.from(digest)
      .map((byte) => byte.toString(16).padStart(2, "0")).join("");
    selected.push({ contentHash, sizeBytes: file.size, acceptMatched: accepts(file) });
  }
  const remaining = approvedFiles.map((file) => ({ ...file }));
  const approvedSetVerified = selected.length === approvedFiles.length && selected.every((file) => {
    const index = remaining.findIndex((approved) => approved.contentHash === file.contentHash
      && file.sizeBytes <= approved.maxBytes);
    if (index < 0) return false;
    remaining.splice(index, 1);
    return true;
  }) && remaining.length === 0;
  return {
    selectedFileCount: selected.length,
    approvedSetVerified,
    acceptVerified: selected.every((file) => file.acceptMatched),
  };
}`;

const selectionProof = (value: unknown): SelectionProof => {
  const proof = record(value);
  if (!Number.isSafeInteger(proof.selectedFileCount) || (proof.selectedFileCount as number) < 0
    || typeof proof.approvedSetVerified !== "boolean" || typeof proof.acceptVerified !== "boolean") {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return Object.freeze({
    selectedFileCount: proof.selectedFileCount as number,
    approvedSetVerified: proof.approvedSetVerified,
    acceptVerified: proof.acceptVerified,
  });
};

const readSelectionProof = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  nodeId: number,
  approvedFiles: readonly ApprovedFile[],
): Promise<SelectionProof> => {
  const objectId = record(record(await safeRead(() => runtime.send(
    tabId, "DOM.resolveNode", { nodeId },
  ))).object).objectId;
  if (typeof objectId !== "string" || objectId.length === 0) throw new Error("BROWSER_DOM_READ_INVALID");
  let primaryFailure: unknown = null;
  try {
    const call = record(await safeRead(() => runtime.send(tabId, "Runtime.callFunctionOn", {
      objectId,
      functionDeclaration: SELECTION_PROOF_FUNCTION,
      arguments: [{ value: approvedFiles.map(({ contentHash, maxBytes }) => ({ contentHash, maxBytes })) }],
      returnByValue: true,
      awaitPromise: true,
      silent: true,
    })));
    return selectionProof(record(call.result).value);
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    try { await safeRead(() => runtime.send(tabId, "Runtime.releaseObject", { objectId })); }
    catch (error) { if (primaryFailure === null) throw new Error("BROWSER_DOM_READ_INVALID", { cause: error }); }
  }
};

const acceptPolicyValid = (value: unknown): boolean => typeof value === "string"
  && (value.trim().length === 0 || value.split(",").every((token) => {
    const normalized = token.trim().toLowerCase();
    return /^\.[a-z0-9]+$/u.test(normalized)
      || /^[a-z0-9][a-z0-9.+-]*\/(?:\*|[a-z0-9][a-z0-9.+-]*)$/u.test(normalized);
  }));

const qualificationFailure = (error: unknown): string | null => {
  const code = error instanceof Error ? error.message : "";
  return /^BROWSER_DOM_(?:NODE_STALE|READ_INVALID)$/u.test(code) ? code : null;
};

type ExtensionFileInput = Readonly<{
  runtime: ExtensionDebuggerRuntime; target: ExtensionExactTarget;
  assertCurrent: CurrentTargetAssertion; selector: string;
  activation: FileInputActivation;
  approvedFiles: readonly ApprovedFile[]; resolvedFilePaths: readonly string[];
}>;

const assertFileInputRequest = (input: ExtensionFileInput): void => {
  if (input.selector !== "#upload-files"
    || input.activation?.selector !== "div.__menu-item[tabindex='0'] span"
    || input.activation?.scope?.selector !== "#thread-bottom div.popover[aria-busy='false']"
    || input.activation?.expectedTextEquals !== "从电脑上传"
    || input.approvedFiles.length < 1 || input.approvedFiles.length > 20
    || input.resolvedFilePaths.length !== input.approvedFiles.length
    || new Set(input.approvedFiles.map((file) => file.grantRef)).size !== input.approvedFiles.length
    || input.approvedFiles.some((file) => !file.grantRef || !/^sha256:[a-f0-9]{64}$/u.test(file.contentHash)
      || !Number.isSafeInteger(file.maxBytes) || file.maxBytes < 1)
    || input.resolvedFilePaths.some((filePath) => !filePath.startsWith("/"))) {
    throw new Error("BROWSER_FILE_GRANT_INVALID");
  }
};

const fileInputQualified = (candidate: Candidate, selectedPathCount: number): boolean =>
  Number.isSafeInteger(candidate.backendNodeId)
  && candidate.facts?.tagName === "INPUT" && candidate.facts.type === "file"
  && candidate.facts.connected === true && candidate.facts.disabled === false
  && candidate.facts.ariaDisabled === false
  && (selectedPathCount === 1 || candidate.facts.multiple === true)
  && acceptPolicyValid(candidate.facts.accept);

const fileInputPostconditionVerified = (
  readback: Candidate,
  proof: SelectionProof | null,
  approvedFileCount: number,
): boolean => readback.candidateCount === 1 && readback.facts?.tagName === "INPUT"
  && readback.facts.type === "file" && readback.facts.connected === true
  && readback.facts.disabled === false && readback.facts.ariaDisabled === false
  && proof?.selectedFileCount === approvedFileCount
  && proof.approvedSetVerified && proof.acceptVerified;

export const executeExtensionFileInput = async (
  input: ExtensionFileInput,
): Promise<Readonly<Record<string, unknown>>> => {
  assertFileInputRequest(input);
  let candidate: Candidate;
  try {
    candidate = await readExactFileInput(input.runtime, input.target, input.assertCurrent, input.selector);
  } catch (error) {
    const code = qualificationFailure(error);
    if (code) return reject(0, code, "candidate-set");
    throw error;
  }
  if (candidate.candidateCount !== 1 || candidate.nodeId === null
    || candidate.backendNodeId === null || candidate.facts === null) {
    return reject(candidate.candidateCount, candidate.candidateCount === 0
      ? "BROWSER_DOM_CANDIDATE_MISSING" : "BROWSER_DOM_CANDIDATE_AMBIGUOUS", "candidate-set");
  }
  if (!fileInputQualified(candidate, input.resolvedFilePaths.length)) {
    return reject(1, "BROWSER_FILE_INPUT_NOT_QUALIFIED", "actionability");
  }
  let interceptionMayBeEnabled = false;
  let primaryFailure: unknown = null;
  const closeInterception = async (): Promise<void> => {
    if (!interceptionMayBeEnabled) return;
    interceptionMayBeEnabled = false;
    try {
      await input.runtime.send(input.target.tabId, "Page.setInterceptFileChooserDialog", { enabled: false });
    } catch (error) {
      throw new Error("BROWSER_FILE_CHOOSER_CLEANUP_FAILED", {
        cause: Object.freeze({ primaryFailure, cleanupFailure: error }),
      });
    }
  };
  try {
    input.assertCurrent(input.target.targetRef, input.target.documentRef);
    interceptionMayBeEnabled = true;
    await input.runtime.send(input.target.tabId, "Page.setInterceptFileChooserDialog", { enabled: true });
    let activationPoint;
    try {
      activationPoint = await resolveCoherentPointerAction(input.runtime, input.target, {
        selector: input.activation.selector,
        scope: input.activation.scope,
        text: { value: input.activation.expectedTextEquals, exact: true },
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "BROWSER_DOM_CANDIDATE_MISSING") return reject(0, code, "candidate-set");
      if (code === "BROWSER_DOM_CANDIDATE_AMBIGUOUS") return reject(2, code, "candidate-set");
      if (/^BROWSER_DOM_ACTION_[A-Z_]+$/u.test(code)) {
        return reject(1, "BROWSER_FILE_INPUT_NOT_QUALIFIED", "actionability");
      }
      throw error;
    }
    await input.runtime.captureFileChooserOpened(
      input.target.tabId,
      5_000,
      () => dispatchPointerClickSequence(
        input.runtime,
        input.target,
        activationPoint,
        [1],
        () => input.assertCurrent(input.target.targetRef, input.target.documentRef),
      ),
      async (chooser) => {
        try {
          input.assertCurrent(input.target.targetRef, input.target.documentRef);
          if (chooser.backendNodeId !== candidate.backendNodeId) {
            throw new Error("BROWSER_FILE_CHOOSER_MISMATCH");
          }
          await input.runtime.send(input.target.tabId, "DOM.setFileInputFiles", {
            backendNodeId: chooser.backendNodeId,
            files: [...input.resolvedFilePaths],
          });
        } catch (error) {
          primaryFailure = error;
          throw error;
        } finally {
          await closeInterception();
        }
      },
    );
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    await closeInterception();
  }
  input.assertCurrent(input.target.targetRef, input.target.documentRef);
  const readback = await readExactFileInput(
    input.runtime, input.target, input.assertCurrent, input.selector,
  );
  const proof = readback.nodeId === null ? null : await readSelectionProof(
    input.runtime, input.target.tabId, readback.nodeId, input.approvedFiles,
  );
  input.assertCurrent(input.target.targetRef, input.target.documentRef);
  const postconditionVerified = fileInputPostconditionVerified(readback, proof, input.approvedFiles.length);
  return Object.freeze({
    selectedFileCount: proof?.selectedFileCount ?? 0,
    approvedSetVerified: proof?.approvedSetVerified ?? false,
    acceptVerified: proof?.acceptVerified ?? false,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    postconditionVerified,
    ...(postconditionVerified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }),
  });
};
