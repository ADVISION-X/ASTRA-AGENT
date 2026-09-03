import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import { inspectNode, queryCandidateSet } from "./dom-query-runtime.js";

const sha256Text = async (value: string): Promise<`sha256:${string}`> => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

export const executeExactAssistantTurnRead = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  assistantTurnId: string,
  assertCurrent: () => void,
): Promise<unknown> => {
  const selector = `[data-testid="${assistantTurnId}"][data-turn="assistant"] [data-message-author-role="assistant"]`;
  const candidates = await queryCandidateSet(debuggerRuntime, target.tabId, selector, 2);
  if (candidates.rawCount !== 1 || candidates.eligibleCount !== 1 || candidates.eligibleNodeIds.length !== 1) {
    throw new Error(candidates.eligibleCount === 0
      ? "BROWSER_DOM_CANDIDATE_MISSING" : "BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  }
  assertCurrent();
  const observed = await inspectNode(
    debuggerRuntime, target.tabId, candidates.eligibleNodeIds[0]!, ["outerHtml", "semanticText"],
  );
  assertCurrent();
  const rawDomHtml = observed.outerHtml;
  const semanticText = observed.semanticText;
  if (typeof rawDomHtml !== "string" || typeof semanticText !== "string") {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return Object.freeze({
    schemaVersion: "grasseye.browser.exact-assistant-turn.v1" as const,
    targetRefHash: await sha256Text(target.targetRef),
    documentRefHash: await sha256Text(target.documentRef),
    assistantTurnId,
    rawDomHtml,
    rawDomHash: await sha256Text(rawDomHtml),
    semanticText,
    semanticTextHash: await sha256Text(semanticText),
    observedAt: new Date().toISOString(),
  });
};
