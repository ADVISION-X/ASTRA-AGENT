import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { resolveCoherentPointerAction } from "./dom-coherent-candidate.js";
import { executeCoherentObservation } from "./dom-coherent-observation.js";
import { dispatchPointerClickSequence } from "./dom-pointer-intent-runtime.js";
import { inspectNode } from "./dom-query-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import {
  currentGptPageIdentity,
  readWithTransientDomConfirmation,
} from "./chatgpt-page-access-gate.js";

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
  expectedText: string;
}>;
type ActivationPoint = Readonly<{ kind: "point"; point: PointerAction }>
  | Readonly<{ kind: "rejection"; value: Readonly<Record<string, unknown>> }>;
type ApprovedFile = Readonly<{
  grantRef: string;
  contentHash: `sha256:${string}`;
  maxBytes: number;
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
  const approvedNames = input.resolvedFilePaths.map((path) =>
    path.slice(path.lastIndexOf("/") + 1).normalize("NFC"));
  if (input.selector !== "form[data-chatgpt-composer] input[type='file'][aria-label='附加文件']"
    || input.activation?.selector !== "[data-mention-list-scroll-area] > div:first-child > button[data-list-navigation-item='true']:first-child, [data-mention-list-scroll-area] > div[data-mention-section-id='chatgpt-actions'] > div[data-mention-section-items='true'] > button[data-list-navigation-item='true']:first-child, [data-mention-list-scroll-area] > div[data-mention-section-id='chatgpt-context'] > div[data-mention-section-items='true'] > button[data-list-navigation-item='true']:first-child"
    || input.activation?.scope?.selector !== "[data-composer-overlay-floating-ui='true']"
    || input.activation?.expectedText !== "上传"
    || input.approvedFiles.length < 1 || input.approvedFiles.length > 20
    || input.resolvedFilePaths.length !== input.approvedFiles.length
    || new Set(input.approvedFiles.map((file) => file.grantRef)).size !== input.approvedFiles.length
    || input.approvedFiles.some((file) => !file.grantRef || !/^sha256:[a-f0-9]{64}$/u.test(file.contentHash)
      || !Number.isSafeInteger(file.maxBytes) || file.maxBytes < 1)
    || input.resolvedFilePaths.some((filePath) => !filePath.startsWith("/"))
    || approvedNames.some((name) => name.length === 0)
    || new Set(approvedNames).size !== approvedNames.length) {
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

type PointerAction = Awaited<ReturnType<typeof resolveCoherentPointerAction>>;

const activationRejection = (error: unknown): Readonly<Record<string, unknown>> | null => {
  const code = error instanceof Error ? error.message : "";
  if (code === "BROWSER_DOM_CANDIDATE_MISSING") return reject(0, code, "candidate-set");
  if (code === "BROWSER_DOM_CANDIDATE_AMBIGUOUS") return reject(2, code, "candidate-set");
  if (/^BROWSER_DOM_ACTION_[A-Z_]+$/u.test(code)) {
    return reject(1, "BROWSER_FILE_INPUT_NOT_QUALIFIED", "actionability");
  }
  return null;
};

const activationPoint = async (
  input: ExtensionFileInput,
): Promise<ActivationPoint> =>
  readWithTransientDomConfirmation<ActivationPoint>({
    read: async () => {
      input.assertCurrent(input.target.targetRef, input.target.documentRef);
      try {
      const point = await resolveCoherentPointerAction(input.runtime, input.target, {
        selector: input.activation.selector,
        scope: input.activation.scope,
        text: { value: input.activation.expectedText, exact: false },
      });
        return { value: Object.freeze({ kind: "point" as const, point }), transient: false };
      } catch (error) {
        const rejection = activationRejection(error);
        if (!rejection) throw error;
        const code = error instanceof Error ? error.message : "";
        return { value: Object.freeze({ kind: "rejection" as const, value: rejection }),
          transient: code === "BROWSER_DOM_CANDIDATE_MISSING"
            || code === "BROWSER_DOM_NODE_STALE"
            || /^BROWSER_DOM_ACTION_(?:NODE_DISCONNECTED|NO_LAYOUT_BOX|NOT_VISIBLE|INERT|DISABLED|ARIA_DISABLED)$/u.test(code) };
      }
    },
    continuity: async () => {
      input.assertCurrent(input.target.targetRef, input.target.documentRef);
      return currentGptPageIdentity(input.runtime, input.target.tabId);
    },
  });

const readConfirmedFileInput = async (input: ExtensionFileInput): Promise<Candidate> => {
  const confirmed = await readWithTransientDomConfirmation<Candidate | Readonly<{ error: unknown }>>({
    read: async () => {
      input.assertCurrent(input.target.targetRef, input.target.documentRef);
      try {
        const value = await readExactFileInput(
          input.runtime, input.target, input.assertCurrent, input.selector,
        );
        return { value, transient: value.candidateCount === 0 };
      } catch (error) {
        if (qualificationFailure(error) !== "BROWSER_DOM_NODE_STALE") throw error;
        return { value: Object.freeze({ error }), transient: true };
      }
    },
    continuity: async () => {
      input.assertCurrent(input.target.targetRef, input.target.documentRef);
      return currentGptPageIdentity(input.runtime, input.target.tabId);
    },
  });
  if ("error" in confirmed) throw confirmed.error;
  return confirmed;
};

const selectApprovedFiles = async (
  input: ExtensionFileInput,
  candidate: Candidate,
): Promise<Readonly<Record<string, unknown>> | null> => {
  let interceptionMayBeEnabled = false;
  let selectionAccepted = false;
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
    const activation = await activationPoint(input);
    if (activation.kind === "rejection") return activation.value;
    await input.runtime.captureFileChooserOpened(
      input.target.tabId,
      5_000,
      () => dispatchPointerClickSequence(input.runtime, input.target, activation.point, [1],
        () => input.assertCurrent(input.target.targetRef, input.target.documentRef)),
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
          input.assertCurrent(input.target.targetRef, input.target.documentRef);
          selectionAccepted = true;
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
  if (!selectionAccepted) throw new Error("BROWSER_FILE_CHOOSER_MISMATCH");
  return null;
};

const readComposerAttachmentPhase = async (input: ExtensionFileInput): Promise<Readonly<{
  currentUrl: string; valid: boolean; cardNames: readonly string[]; uploadingCount: number;
}>> => {
  input.assertCurrent(input.target.targetRef, input.target.documentRef);
  const observed = await executeCoherentObservation(input.runtime, input.target, [
    { queryId: "attachment-composer", selector: "form[data-chatgpt-composer]", maxMatches: 2, fields: [] },
    { queryId: "attachment-cards", selector: ":is(button, div[role='button']).composer-attachment-surface[aria-label]",
      scope: { selector: "form[data-chatgpt-composer]" }, maxMatches: 20, fields: ["ariaLabel"] },
    { queryId: "attachment-uploading",
      selector: "[role='progressbar']",
      scope: { selector: "form[data-chatgpt-composer]" }, maxMatches: 20, fields: [] },
  ]);
  input.assertCurrent(input.target.targetRef, input.target.documentRef);
  const [composer, cards, uploading] = observed.queries;
  const cardNames = (cards!.matches as readonly Readonly<Record<string, unknown>>[])
    .map((card) => typeof card.ariaLabel === "string" ? card.ariaLabel.normalize("NFC") : "");
  const valid = composer!.rawCount === 1 && composer!.eligibleCount === 1
    && cards!.rawCount === cards!.eligibleCount && uploading!.rawCount === uploading!.eligibleCount
    && cardNames.length === cards!.eligibleCount
    && typeof uploading!.eligibleCount === "number";
  return Object.freeze({ currentUrl: observed.currentUrl, valid, cardNames,
    uploadingCount: uploading!.eligibleCount as number });
};

const composerUploadObserved = (
  input: ExtensionFileInput,
  before: Awaited<ReturnType<typeof readComposerAttachmentPhase>>,
  after: Awaited<ReturnType<typeof readComposerAttachmentPhase>>,
): boolean => {
  const approvedNames = new Set(input.resolvedFilePaths.map((path) =>
    path.slice(path.lastIndexOf("/") + 1).normalize("NFC")));
  return after.valid && after.currentUrl === before.currentUrl
    && new Set(after.cardNames).size === after.cardNames.length
    && after.cardNames.every((name) => approvedNames.has(name))
    && after.uploadingCount <= input.approvedFiles.length
    && (after.uploadingCount > 0 || after.cardNames.length === input.approvedFiles.length);
};

export const executeExtensionFileInput = async (
  input: ExtensionFileInput,
): Promise<Readonly<Record<string, unknown>>> => {
  assertFileInputRequest(input);
  let candidate: Candidate;
  try {
    candidate = await readConfirmedFileInput(input);
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
  const before = await readComposerAttachmentPhase(input);
  if (!before.valid || before.cardNames.length !== 0 || before.uploadingCount !== 0) {
    return reject(1, "BROWSER_FILE_INPUT_NOT_QUALIFIED", "actionability");
  }
  const selectionRejection = await selectApprovedFiles(input, candidate);
  if (selectionRejection) return selectionRejection;
  const after = await readComposerAttachmentPhase(input);
  const postconditionVerified = composerUploadObserved(input, before, after);
  return Object.freeze({
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    postconditionVerified,
    ...(postconditionVerified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }),
  });
};
