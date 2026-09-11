import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import type { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { executeRegisteredDomIntent } from
  "../../src/lib/browser/chrome-extension/dom-intent-runtime.js";
import { mutationInfrastructureReply } from "./local-browser-dom-runtime-fixture.js";

const noPageReadBarrier = async (): Promise<void> => undefined;

type FillState = {
  text: string;
  candidateReads: number;
  finalReadNodeId: number | null;
  events: Readonly<Record<string, unknown>>[];
};

const keyEventReply = (
  state: FillState,
  parameters?: Readonly<Record<string, unknown>>,
): Readonly<Record<string, never>> => {
  state.events.push(parameters ?? {});
  if (parameters?.type === "rawKeyDown" && parameters.key === "Backspace") state.text = "";
  return {};
};

const describedEditableNode = (
  state: FillState,
  parameters?: Readonly<Record<string, unknown>>,
) => {
  if (state.text.length === 0) state.finalReadNodeId = Number(parameters?.nodeId);
  return { node: { nodeId: parameters?.nodeId, backendNodeId: 107,
    nodeName: "DIV", attributes: ["contenteditable", "true"],
    children: state.text.length === 0 ? [] : [{ nodeName: "P", nodeValue: state.text }] } };
};

const contentEditableReply = (
  state: FillState,
  method: string,
  parameters?: Readonly<Record<string, unknown>>,
): unknown | undefined => {
  if (method === "DOM.requestNode") {
    state.candidateReads += 1;
    return { nodeId: state.candidateReads === 1 ? 7 : 8 };
  }
  if (method === "Runtime.callFunctionOn"
    && String(parameters?.functionDeclaration ?? "").includes("browserExactEditableText(this)")) {
    return { result: { value: state.text } };
  }
  if (method === "DOM.querySelectorAll") return { nodeIds: [7] };
  if (method === "DOM.focus") return {};
  if (method === "Input.dispatchKeyEvent") return keyEventReply(state, parameters);
  if (method === "Input.insertText") { state.text += String(parameters?.text ?? ""); return {}; }
  if (method === "DOM.describeNode") return describedEditableNode(state, parameters);
  return undefined;
};

export const exerciseContentEditableFill = async (): Promise<void> => {
  const state: FillState = { text: "stale SEO prompt", candidateReads: 0, finalReadNodeId: null, events: [] };
  const runtime = { awaitPageReadPermission: noPageReadBarrier,
    async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    const local = contentEditableReply(state, method, parameters);
    if (local !== undefined) return local;
    const infrastructure = mutationInfrastructureReply(method, parameters);
    if (infrastructure !== undefined) return infrastructure;
    throw new Error(`UNEXPECTED_CONTENTEDITABLE_FILL_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  const cleared = await executeRegisteredDomIntent(runtime, { tabId: 103 } as never, {
    kind: "fill", selector: "#prompt-textarea", approvedText: "", clearBeforeType: true, expectedMatches: 1,
  }, () => undefined);
  assert.deepEqual(cleared, { filled: true, candidateCount: 1, identityRevalidated: true,
    mutationCount: 1, retainedValueVerified: true, postconditionVerified: true });
  assert.equal(state.candidateReads, 2, "fill postcondition must bind a fresh current candidate");
  assert.equal(state.finalReadNodeId, 8, "fill postcondition must not reuse the pre-action nodeId");
  assert.deepEqual(state.events, [
    { type: "rawKeyDown", key: "a", code: "KeyA", commands: ["selectAll"] },
    { type: "keyUp", key: "a", code: "KeyA" },
    { type: "rawKeyDown", key: "Backspace", code: "Backspace" },
    { type: "keyUp", key: "Backspace", code: "Backspace" },
  ]);
};

export const exerciseFillReadbackRejection = async (): Promise<void> => {
  let candidateReads = 0;
  const runtime = { awaitPageReadPermission: noPageReadBarrier,
    async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    if (method === "Runtime.callFunctionOn" && parameters?.returnByValue === false) {
      candidateReads += 1;
      return candidateReads === 1
        ? { result: { type: "object", subtype: "node", objectId: "candidate-node" } }
        : { result: { type: "string", value: "BROWSER_DOM_CANDIDATE_MISSING" } };
    }
    if (method === "Runtime.callFunctionOn"
      && String(parameters?.functionDeclaration ?? "").includes("browserExactEditableText(this)")) {
      return { result: { value: "stale" } };
    }
    const infrastructure = mutationInfrastructureReply(method, parameters);
    if (infrastructure !== undefined) return infrastructure;
    if (method === "DOM.focus" || method === "Input.insertText") return {};
    if (method === "DOM.describeNode") return { node: { nodeId: 7, backendNodeId: 107,
      nodeName: "DIV", attributes: ["contenteditable", "true"],
      children: [{ nodeName: "P", nodeValue: "stale" }] } };
    throw new Error(`UNEXPECTED_FILL_READBACK_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  const rejected = await executeRegisteredDomIntent(runtime, { tabId: 117 } as never, {
    kind: "fill", selector: "#prompt-textarea", approvedText: "approved",
    clearBeforeType: false, expectedMatches: 1,
  }, () => undefined);
  assert.deepEqual(rejected, {
    filled: true, candidateCount: 0, identityRevalidated: false, mutationCount: 1,
    retainedValueVerified: false, postconditionVerified: false,
    failureCode: "BROWSER_POSTCONDITION_FAILED",
    nativeCauseCode: "BROWSER_DOM_CANDIDATE_MISSING",
  });
};
