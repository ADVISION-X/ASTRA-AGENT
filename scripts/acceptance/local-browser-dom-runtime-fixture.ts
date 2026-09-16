export const browserDomFacts = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  connected: true, layout: true, visible: true,
  computedDisplay: "block", computedVisibility: "visible", computedOpacity: "1", effectiveOpacity: "1",
  displayHidden: false, visibilityHidden: false, opacityHidden: false,
  hidden: false, ariaHidden: false, inert: false, disabled: false, ariaDisabled: false,
  role: "", name: "", testId: "", label: "", value: "", checked: null, type: "",
  bounds: { x: 0, y: 0, width: 10, height: 10 }, viewport: true, hitTest: true,
  nativeCauseCode: null, nativeStage: "runtime-call-function-on", ...overrides,
});

const infrastructureReplies: Readonly<Record<string, unknown>> = Object.freeze({
  "Page.getFrameTree": { frameTree: { frame: { loaderId: "loader-current" } } },
  "Page.getNavigationHistory": { currentIndex: 0,
    entries: [{ url: "https://chatgpt.com/", title: "ChatGPT" }] },
  "DOM.getDocument": { root: { nodeId: 1 } },
  "DOM.requestNode": { nodeId: 7 },
  "Runtime.releaseObject": {},
});

export const mutationInfrastructureReply = (
  method: string,
  parameters?: Readonly<Record<string, unknown>>,
): unknown | undefined => {
  if (method === "Runtime.callFunctionOn"
    && String(parameters?.functionDeclaration ?? "").includes("browserExactEditableText(this)")) return undefined;
  let reply = infrastructureReplies[method];
  if (method === "DOM.resolveNode") reply = { object: {
    objectId: parameters?.nodeId === 1 ? "candidate-root" : `node-${parameters?.nodeId}`,
  } };
  if (method === "Runtime.callFunctionOn") reply = { result: { value: browserDomFacts() } };
  if (method === "Runtime.callFunctionOn" && parameters?.returnByValue === false) {
    reply = { result: { type: "object", subtype: "node", objectId: "candidate-node" } };
  }
  if (method === "Runtime.callFunctionOn" && parameters?.returnByValue === true
    && String(parameters.functionDeclaration).includes("spec.output")) {
    reply = { result: { value: { x: 5, y: 5 } } };
  }
  return reply;
};
