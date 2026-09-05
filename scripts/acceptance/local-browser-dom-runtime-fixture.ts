export const browserDomFacts = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  connected: true, layout: true, visible: true,
  computedDisplay: "block", computedVisibility: "visible", computedOpacity: "1", effectiveOpacity: "1",
  displayHidden: false, visibilityHidden: false, opacityHidden: false,
  hidden: false, ariaHidden: false, inert: false, disabled: false, ariaDisabled: false,
  role: "", name: "", testId: "", label: "", value: "", checked: null, type: "",
  bounds: { x: 0, y: 0, width: 10, height: 10 }, viewport: true, hitTest: true,
  nativeCauseCode: null, nativeStage: "runtime-call-function-on", ...overrides,
});

export const mutationInfrastructureReply = (
  method: string,
  parameters?: Readonly<Record<string, unknown>>,
): unknown | undefined => {
  if (method === "Runtime.callFunctionOn"
    && String(parameters?.functionDeclaration ?? "").includes("browserExactEditableText")) return undefined;
  let reply: unknown;
  if (method === "Page.getFrameTree") reply = { frameTree: { frame: { loaderId: "loader-current" } } };
  if (method === "DOM.getDocument") reply = { root: { nodeId: 1 } };
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
  if (method === "DOM.requestNode") reply = { nodeId: 7 };
  if (method === "Runtime.releaseObject") reply = {};
  return reply;
};
