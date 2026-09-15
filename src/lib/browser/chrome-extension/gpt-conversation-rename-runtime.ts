import type { BrowserDomIntent } from "../exact-target/browser-dom-intent.js";
import { requireCanonicalGptConversationUrl } from "../exact-target/browser-site-policy-registry.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { executeFillIntent } from "./dom-intent-runtime.js";
import {
  executeClickIntent,
  executeKeypressIntent,
} from "./dom-pointer-intent-runtime.js";
import {
  attribute,
  describeNode,
  documentState,
  queryCandidateSet,
} from "./dom-query-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";

type RenameIntent = Extract<BrowserDomIntent, { kind: "renameExactGptConversation" }>;
type CurrentDocumentAssertion = () => void;

const RENAME_MENU_ITEM_SELECTOR = "[role='menuitem']";
const TITLE_EDITOR_SELECTOR = "input[aria-label='聊天标题'][name='title-editor']";
const RENAME_LOGICAL_INPUT_GAP_MS = 1_500;
const waitForNextRenameInput = (): Promise<void> => new Promise((resolve) =>
  globalThis.setTimeout(resolve, RENAME_LOGICAL_INPUT_GAP_MS));

const selectorValue = (value: string): string => value
  .replaceAll("\\", "\\\\")
  .replaceAll('"', '\\"');

const selectorsFor = (canonicalConversationUrl: string): Readonly<{
  conversation: string;
  menuButton: string;
}> => {
  const canonical = requireCanonicalGptConversationUrl(canonicalConversationUrl);
  const url = new URL(canonical);
  const conversationId = url.pathname.slice("/c/".length);
  const href = selectorValue(url.pathname);
  return Object.freeze({
    conversation: `a[data-sidebar-item='true'][href="${href}"]`,
    menuButton: `a[data-sidebar-item='true'][href="${href}"] button[data-conversation-options-trigger="${conversationId}"]`,
  });
};

const failureReceipt = (
  mutationCount: 0 | 1 | 2 | 3 | 4,
  failureCode: string,
  nativeCauseCode: string | null = null,
  candidateCount = 1,
): Readonly<Record<string, unknown>> => Object.freeze({
  renameState: "failed",
  candidateCount,
  identityRevalidated: false,
  mutationCount,
  postconditionVerified: false,
  failureCode: /^BROWSER_[A-Z0-9_]+$/u.test(failureCode)
    ? failureCode : "BROWSER_POSTCONDITION_FAILED",
  nativeCauseCode,
});

const receiptRecord = (value: unknown): Readonly<Record<string, unknown>> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>> : Object.freeze({});

const completedStep = (
  value: unknown,
  completedBefore: 0 | 1 | 2 | 3,
): Readonly<{ ok: true }> | Readonly<{ ok: false; receipt: Readonly<Record<string, unknown>> }> => {
  const record = receiptRecord(value);
  const mutationCount = record.mutationCount === 1 ? completedBefore + 1 : completedBefore;
  if (record.mutationCount === 1 && record.postconditionVerified === true) return { ok: true };
  const native = typeof record.nativeCauseCode === "string" ? record.nativeCauseCode : null;
  const failure = typeof record.failureCode === "string"
    ? record.failureCode : "BROWSER_POSTCONDITION_FAILED";
  return { ok: false, receipt: failureReceipt(
    mutationCount as 0 | 1 | 2 | 3 | 4, failure, native,
    Number.isSafeInteger(record.candidateCount) ? Number(record.candidateCount) : 1,
  ) };
};

const exactCandidate = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  selector: string,
): Promise<number> => {
  const candidates = await queryCandidateSet(runtime, target.tabId, selector, 2);
  if (candidates.eligibleCount !== 1) {
    throw new Error(candidates.eligibleCount > 1
      ? "BROWSER_DOM_CANDIDATE_AMBIGUOUS" : "BROWSER_DOM_CANDIDATE_MISSING");
  }
  return candidates.eligibleNodeIds[0]!;
};

const absent = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  selector: string,
  textEquals?: string,
): Promise<boolean> => {
  const candidates = await queryCandidateSet(
    runtime, target.tabId, selector, 2, undefined,
    textEquals === undefined ? undefined : { value: textEquals, exact: true },
  );
  return candidates.rawCount === 0;
};

const applyRenameInputs = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: RenameIntent,
  assertCurrent: CurrentDocumentAssertion,
  started: () => void,
  selectors: ReturnType<typeof selectorsFor>,
): Promise<Readonly<Record<string, unknown>>> => {
  const menu = completedStep(await executeClickIntent(runtime, target, {
    kind: "click", selector: selectors.menuButton, expectedMatches: 1,
    postClickMatch: { selector: RENAME_MENU_ITEM_SELECTOR, expectedMatches: 1,
      textEquals: "重命名", timeoutMs: intent.timeoutMs },
  }, assertCurrent, started), 0);
  if (!menu.ok) return menu.receipt;
  await waitForNextRenameInput();
  const editor = completedStep(await executeClickIntent(runtime, target, {
    kind: "click", selector: RENAME_MENU_ITEM_SELECTOR, expectedTextEquals: "重命名",
    expectedMatches: 1,
    postClickMatch: { selector: TITLE_EDITOR_SELECTOR, expectedMatches: 1,
      timeoutMs: intent.timeoutMs },
  }, assertCurrent, started), 1);
  if (!editor.ok) return editor.receipt;
  await waitForNextRenameInput();
  const filled = completedStep(await executeFillIntent(runtime, target, {
    kind: "fill", selector: TITLE_EDITOR_SELECTOR, approvedText: intent.targetTitle,
    clearBeforeType: true, expectedMatches: 1,
  }, assertCurrent, started), 2);
  if (!filled.ok) return filled.receipt;
  await waitForNextRenameInput();
  const saved = completedStep(await executeKeypressIntent(runtime, target, {
    kind: "keypress", selector: TITLE_EDITOR_SELECTOR, key: "Enter", expectedMatches: 1,
    postKeypressMatch: {
      selector: `${selectors.conversation}[aria-label="${selectorValue(intent.targetTitle)}"]`,
      expectedMatches: 1, timeoutMs: intent.timeoutMs,
    },
  }, assertCurrent, started), 3);
  return saved.ok ? Object.freeze({
    renameState: "renamed", candidateCount: 1, identityRevalidated: true,
    mutationCount: 4, postconditionVerified: true,
  }) : saved.receipt;
};

export const executeGptConversationRename = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: RenameIntent,
  assertCurrent: CurrentDocumentAssertion,
): Promise<unknown> => {
  const selectors = selectorsFor(intent.canonicalConversationUrl);
  let physicalInputCount: 0 | 1 | 2 | 3 | 4 = 0;
  const started = (): void => {
    physicalInputCount = (physicalInputCount + 1) as 1 | 2 | 3 | 4;
  };
  try {
    assertCurrent();
    const current = await documentState(runtime, target.tabId);
    if (requireCanonicalGptConversationUrl(current.url) !== intent.canonicalConversationUrl) {
      return failureReceipt(0, "BROWSER_DOCUMENT_INVALID");
    }
    if (!(await absent(runtime, target, RENAME_MENU_ITEM_SELECTOR, "重命名"))
      || !(await absent(runtime, target, TITLE_EDITOR_SELECTOR))) {
      return failureReceipt(0, "BROWSER_DOM_ACTION_NOT_QUALIFIED");
    }
    const conversationNodeId = await exactCandidate(runtime, target, selectors.conversation);
    const currentTitle = attribute(
      await describeNode(runtime, target.tabId, conversationNodeId), "aria-label",
    );
    if (currentTitle === intent.targetTitle) return Object.freeze({
      renameState: "already-exact", candidateCount: 1, identityRevalidated: true,
      mutationCount: 0, postconditionVerified: true,
    });

    return await applyRenameInputs(runtime, target, intent, assertCurrent, started, selectors);
  } catch (error) {
    const code = error instanceof Error ? error.message : "BROWSER_POSTCONDITION_FAILED";
    const candidateCount = code === "BROWSER_DOM_CANDIDATE_AMBIGUOUS" ? 2
      : code === "BROWSER_DOM_CANDIDATE_MISSING" ? 0 : 1;
    return failureReceipt(physicalInputCount, code, null, candidateCount);
  }
};
