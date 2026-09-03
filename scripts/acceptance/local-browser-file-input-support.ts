import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import type { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { executeExtensionFileInput } from
  "../../src/lib/browser/chrome-extension/extension-file-input-runtime.js";

type FileInputScenario = Readonly<{
  nodeIds: readonly number[];
  facts?: Readonly<Record<string, unknown>>;
  selectedCount?: number;
  approvedSetVerified?: boolean;
  acceptVerified?: boolean;
  driftBeforeDispatch?: boolean;
  failReadback?: boolean;
  onFileInput?: () => void;
}>;

const fileMechanicalFacts = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  connected: true, layout: true, visible: true,
  computedDisplay: "block", computedVisibility: "visible", computedOpacity: "1", effectiveOpacity: "1",
  displayHidden: false, visibilityHidden: false, opacityHidden: false,
  hidden: false, ariaHidden: false, inert: false, disabled: false, ariaDisabled: false,
  role: "", name: "", testId: "", label: "", value: "", checked: null, type: "file",
  bounds: { x: 0, y: 0, width: 10, height: 10 }, viewport: true, hitTest: true,
  nativeCauseCode: null, nativeStage: "runtime-call-function-on", multiple: true, accept: "",
  ...overrides,
});

const runFileInputScenario = async (input: FileInputScenario) => {
  let fileInputs = 0; let queries = 0; let targetChecks = 0;
  const runtime = { async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.querySelectorAll") {
      queries += 1;
      if (input.failReadback && queries > 1) throw new Error("Could not find node with given id");
      return { nodeIds: [...input.nodeIds] };
    }
    if (method === "DOM.describeNode") {
      const attributes = ["type", "file", "accept", String(input.facts?.accept ?? "")];
      if (input.facts?.multiple !== false) attributes.push("multiple", "");
      return { node: { nodeId: parameters?.nodeId, nodeName: "INPUT", attributes } };
    }
    if (method === "DOM.resolveNode") return { object: { objectId: `file-node-${parameters?.nodeId}` } };
    if (method === "Runtime.releaseObject") return {};
    if (method === "Runtime.callFunctionOn") {
      if (String(parameters?.functionDeclaration).includes("approvedSetVerified")) return { result: { value: {
        selectedFileCount: input.selectedCount ?? 2,
        approvedSetVerified: input.approvedSetVerified ?? true,
        acceptVerified: input.acceptVerified ?? true,
      } } };
      return { result: { value: fileMechanicalFacts(input.facts) } };
    }
    if (method === "DOM.setFileInputFiles") { fileInputs += 1; input.onFileInput?.(); return {}; }
    throw new Error(`UNEXPECTED_FILE_INPUT_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  const result = await executeExtensionFileInput({
    runtime,
    target: { tabId: 108, targetRef: "target-108", documentRef: "document-8", navigationEpoch: 8 },
    assertCurrent: () => {
      targetChecks += 1;
      if (input.driftBeforeDispatch && targetChecks === 3) throw new Error("BROWSER_DOCUMENT_INVALID");
    },
    selector: "#upload-files",
    approvedFiles: [
      { grantRef: "grant-a", contentHash: `sha256:${"a".repeat(64)}`, maxBytes: 10_000 },
      { grantRef: "grant-b", contentHash: `sha256:${"b".repeat(64)}`, maxBytes: 20_000 },
    ],
    resolvedFilePaths: ["/approved/a.pdf", "/approved/b.pdf"],
  });
  return { result, fileInputs, targetChecks };
};

export const exerciseFileInput = async (): Promise<void> => {
  const success = await runFileInputScenario({ nodeIds: [7], selectedCount: 2 });
  assert.deepEqual(success.result, {
    selectedFileCount: 2, candidateCount: 1, identityRevalidated: true,
    approvedSetVerified: true, acceptVerified: true, mutationCount: 1, postconditionVerified: true,
  });
  assert.equal(success.fileInputs, 1, "the complete approved set must use one physical file-input command");
  assert.ok(success.targetChecks >= 6, "Target and Document must be rebound before and after the physical input");
  for (const [scenario, expectedCount, expectedCode, qualificationStage] of [
    [{ nodeIds: [] }, 0, "BROWSER_DOM_CANDIDATE_MISSING", "candidate-set"],
    [{ nodeIds: [7, 8] }, 2, "BROWSER_DOM_CANDIDATE_AMBIGUOUS", "candidate-set"],
    [{ nodeIds: [7], facts: { disabled: true } }, 1, "BROWSER_FILE_INPUT_NOT_QUALIFIED", "actionability"],
    [{ nodeIds: [7], facts: { multiple: false } }, 1, "BROWSER_FILE_INPUT_NOT_QUALIFIED", "actionability"],
    [{ nodeIds: [7], facts: { accept: "not-an-accept-policy" } }, 1, "BROWSER_FILE_INPUT_NOT_QUALIFIED", "actionability"],
  ] as const) {
    const rejected = await runFileInputScenario(scenario);
    assert.deepEqual(rejected.result, { candidateCount: expectedCount, qualificationStage,
      identityRevalidated: false,
      mutationCount: 0, postconditionVerified: false, qualificationRejected: true, failureCode: expectedCode });
    assert.equal(rejected.fileInputs, 0);
  }
  await assert.rejects(runFileInputScenario({ nodeIds: [7], driftBeforeDispatch: true }), /BROWSER_DOCUMENT_INVALID/u);
  let failedReadbackInputs = 0;
  await assert.rejects(runFileInputScenario({ nodeIds: [7], failReadback: true,
    onFileInput: () => { failedReadbackInputs += 1; } }), /BROWSER_DOM_NODE_STALE/u,
  "an unreadable after-action file set must stay DISPATCHED/unknown instead of inventing a count");
  assert.equal(failedReadbackInputs, 1);
  for (const mismatch of [{ approvedSetVerified: false }, { acceptVerified: false }]) {
    const rejected = await runFileInputScenario({ nodeIds: [7], ...mismatch });
    assert.equal(rejected.fileInputs, 1, "a failed exact-set readback must preserve the one physical input fact");
    assert.equal(rejected.result.postconditionVerified, false);
    assert.equal(rejected.result.failureCode, "BROWSER_POSTCONDITION_FAILED");
  }
};
