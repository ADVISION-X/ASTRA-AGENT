import { Node, SyntaxKind } from "ts-morph";
import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { createLocalFinding, extensionDebuggerRuntimePath, requireSource, sourcePaths,
  targetAuthorityPath } from "./inspector-support.js";

const interactionReadinessPath =
  "src/lib/browser/chrome-extension/extension-interaction-readiness.ts";
const gptRateLimitRuntimePath = "src/lib/browser/chrome-extension/gpt-rate-limit-dialog.ts";
const pageAccessGatePath = "src/lib/browser/chrome-extension/chatgpt-page-access-gate.ts";
const rateLimitContractPath = "src/lib/browser/exact-target/browser-gpt-rate-limit-preflight.ts";

const interactionReadinessFinding = (
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  message: string,
): void => {
  findings.push(createLocalFinding({
    checkId: "browser-authority/interaction-readiness",
    lawId,
    filePath,
    message,
  }));
};

const exactCallCount = (source: Node, expressionText: string): number =>
  source.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getExpression().getText() === expressionText).length;

const inspectRuntimeActivation = (
  input: Readonly<{ activate: Node; send: Node; admit: Node; executeActor: Node }>,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const activateText = input.activate.getText();
  const sendText = input.send.getText();
  const updateCalls = input.activate.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getExpression().getText() === "this.chromeApi.tabs.update");
  const updateArguments = updateCalls[0]?.getArguments() ?? [];
  const runtimeChecks = [
    updateCalls.length === 1,
    updateArguments[0]?.getText() === "tabId",
    updateArguments[1]?.getText().replace(/\s/gu, "") === "{active:true}",
    activateText.includes("this.executePageAction"),
    sendText.indexOf("guard.assertInteractive()") >= 0,
    sendText.indexOf("guard.state.started = true") > sendText.indexOf("guard.assertInteractive()"),
    sendText.indexOf("this.chromeApi.debugger.sendCommand") > sendText.indexOf("guard.state.started = true"),
  ];
  if (!runtimeChecks.every(Boolean)) interactionReadinessFinding(findings, lawId, extensionDebuggerRuntimePath,
    "The fixed runtime must activate once through the existing page-action gate and synchronously check interaction identity before marking Provider input started.");
  const commandChecks = [
    input.admit.getText().includes("mutationClass: expectedMutationClass"),
    input.executeActor.getText().includes("registeredCommand.mutationClass"),
  ];
  if (!commandChecks.every(Boolean)) interactionReadinessFinding(findings, lawId, sourcePaths[8],
    "Command admission must preserve the actual mutation class through the sole encrypted actor into Browser Authority.");
};

const inspectNoFocusFallback = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const forbidden = context.project.getSourceFiles().filter((source) => {
    const path = source.getFilePath().replaceAll("\\", "/");
    if (!path.includes("/src/lib/browser/chrome-extension/")) return false;
    const callsWindowFocus = source.getDescendantsOfKind(SyntaxKind.CallExpression)
      .some((call) => call.getExpression().getText().endsWith("windows.update"));
    const callsBringToFront = source.getDescendantsOfKind(SyntaxKind.StringLiteral)
      .some((literal) => literal.getLiteralValue() === "Page.bringToFront");
    return callsWindowFocus || callsBringToFront;
  });
  for (const source of forbidden) interactionReadinessFinding(findings, lawId,
    source.getFilePath().slice(context.sealedRoot.length + 1).replaceAll("\\", "/"),
    "The unique interaction gate must not add window focus or Page.bringToFront fallback authority.");
};

const interactionAuthorityExact = (input: Readonly<{
  execute: Node; executeBoundary: Node; executeMutation: Node; ensure: Node; assertReady: Node;
  acquireBoundary: Node; frameBoundary: Node; start: Node; constructor: Node;
  runtimeText: string; runtimeSendText: string; rateLimitText: string;
  nonFrameUrlReadCount: number;
}>): boolean => {
  const executeText = input.execute.getText();
  const ensureText = input.ensure.getText();
  const assertText = input.assertReady.getText();
  const startText = input.start.getText();
  return [executeText.includes('mutationClass === "mutation"'),
    exactCallCount(input.execute, "this.interactionReadiness.executeMutation") === 1,
    exactCallCount(input.executeMutation, "this.ensureInteractionReady") === 1,
    exactCallCount(input.executeMutation, "this.debuggerRuntime.withProviderInputGuard") === 1,
    ensureText.includes("tab.active !== true"),
    exactCallCount(input.ensure, "this.debuggerRuntime.activateTab") === 1,
    exactCallCount(input.ensure, "this.debuggerRuntime.readTab") === 3,
    exactCallCount(input.ensure, "readExtensionMainFrame") === 1,
    ensureText.includes("activeState.target?.targetRef !== target.targetRef"),
    ensureText.includes("frame.loaderId !== activeState.loaderId"),
    exactCallCount(input.ensure, "requireGptWebPolicyForUrl") === 1,
    input.nonFrameUrlReadCount === 0,
    ensureText.indexOf("this.recordActiveTab(windowId, target.tabId)")
      < ensureText.indexOf("readExtensionMainFrame(this.debuggerRuntime, target.tabId)"),
    ensureText.includes("active.generation !== activationGeneration"),
    assertText.includes("active.generation !== lease.generation"),
    exactCallCount(input.assertReady, "this.resolveExactTarget") === 1,
    exactCallCount(input.start, "this.chromeApi.tabs.onActivated.addListener") === 1,
    startText.includes("this.interactionReadiness.recordActiveTab"),
    input.constructor.getText().includes("this.debuggerRuntime.requireLogicalPageAccessCycles()"),
    exactCallCount(input.executeBoundary, "this.debuggerRuntime.withLogicalPageAccess") === 1,
    input.executeBoundary.getText().includes('acknowledgeRateLimit ? "rate-limit-ack" : "ordinary"'),
    exactCallCount(input.acquireBoundary, "this.debuggerRuntime.withLogicalPageAccess") === 1,
    exactCallCount(input.frameBoundary, "this.debuggerRuntime.withLogicalPageAccess") === 1,
    input.runtimeSendText.includes("this.logicalPageAccess.required && !this.logicalPageAccess.active"),
    input.runtimeSendText.includes("BROWSER_PAGE_ACCESS_CYCLE_REQUIRED"),
    input.runtimeText.includes("urgentLogicalPageAccessQueue.shift()"),
    input.runtimeText.includes("ordinaryLogicalPageAccessQueue.shift()"),
    input.executeBoundary.getText().includes("acknowledgeRateLimit ? async () => undefined"),
    input.rateLimitText.includes("intent.dispatchNotAfter === null"),
    input.rateLimitText.includes("Date.parse(intent.dispatchNotAfter)"),
  ].every(Boolean);
};

const inspectRateLimitGate = (
  context: InspectorContext, authorityText: string, detectorText: string,
  findings: InspectorFinding[], lawId: string,
): void => {
  if (lawId !== "LAW-LOCAL-BROWSER-SESSION-004-V54") return;
  const accessGate = requireSource(context, findings, lawId, pageAccessGatePath);
  const preflightContract = requireSource(context, findings, lawId, rateLimitContractPath);
  if (!accessGate || !preflightContract) return;
  const gateFacts = [
    "CHATGPT_LOGICAL_ACCESS_INTERVAL_MS = 1_500",
    "private lastAccessStartedAt = performance.now()",
    "this.lastAccessStartedAt + CHATGPT_LOGICAL_ACCESS_INTERVAL_MS",
    "this.tail = entered.then(() => undefined, () => undefined)",
  ];
  if (!gateFacts.every((fact) => accessGate.getFullText().includes(fact))
    || !authorityText.includes("private readonly pageAccessGate = new ChatGptPageAccessGate()")) {
    interactionReadinessFinding(findings, lawId, pageAccessGatePath,
      "All ChatGPT logical page accesses must share the 1.5-second extension-process gate.");
  }
  const exactDialogFacts = ["KNOWN_GPT_RATE_LIMIT_TITLE = \"请求过于频繁\"",
    "KNOWN_GPT_RATE_LIMIT_BODY = Object.freeze([", "KNOWN_GPT_RATE_LIMIT_ACK = \"明白了\"",
    'state === "exact_present"'];
  const detectorFacts = ["lines.length === exactLines.length",
    "line === exactLines[index]", "rawDialogs.length === 1",
    "rawButtons.length === 1", "actionableButtons.length === 1",
    'const state = eligibleDialogs.length === 0 ? "absent" : exact ? "exact_present" : "mismatch"'];
  if (!exactDialogFacts.every((fact) => preflightContract.getFullText().includes(fact))
    || !detectorFacts.every((fact) => detectorText.includes(fact))
    || !authorityText.includes("if (preflight.state === \"exact_present\") return knownGptRateLimitBlockerReceipt(preflight)")) {
    interactionReadinessFinding(findings, lawId, gptRateLimitRuntimePath,
      "The central preflight must match one exact rate-limit dialog and block the original action.");
  }
};

export const inspectInteractionReadiness = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const authority = requireSource(context, findings, lawId, targetAuthorityPath);
  const readiness = requireSource(context, findings, lawId, interactionReadinessPath);
  const runtime = requireSource(context, findings, lawId, extensionDebuggerRuntimePath);
  const actor = requireSource(context, findings, lawId, sourcePaths[1]);
  const commandRegistry = requireSource(context, findings, lawId, sourcePaths[8]);
  const gptRateLimitRuntime = requireSource(context, findings, lawId, gptRateLimitRuntimePath);
  if ([authority, readiness, runtime, actor, commandRegistry, gptRateLimitRuntime]
    .some((source) => !source)) return;

  const authorityClass = authority!.getClass("ExtensionTargetAuthority");
  const executeBoundary = authorityClass?.getMethod("executeRegisteredCommand");
  const execute = authorityClass?.getMethod("executeRegisteredCommandCycle");
  const acquireBoundary = authorityClass?.getMethod("acquireJobBoundChatGptTarget");
  const frameBoundary = authorityClass?.getMethod("consumeFrameNavigationAfterBarrier");
  const constructor = authorityClass?.getConstructors()[0];
  const start = authorityClass?.getMethod("start");
  const readinessClass = readiness!.getClass("ExtensionInteractionReadiness");
  const executeMutation = readinessClass?.getMethod("executeMutation");
  const ensure = readinessClass?.getMethod("ensureInteractionReady");
  const assertReady = readinessClass?.getMethod("assertInteractionReady");
  const activate = runtime!.getClass("ExtensionDebuggerRuntime")?.getMethod("activateTab");
  const send = runtime!.getClass("ExtensionDebuggerRuntime")?.getMethod("send");
  const admit = commandRegistry!.getVariableDeclaration("admitExtensionCommand");
  const executeActor = actor!.getClass("ExtensionWebSocketActor")?.getMethod("executeCommand");
  if ([authorityClass, executeBoundary, execute, acquireBoundary, frameBoundary,
    constructor, readinessClass, executeMutation, ensure, assertReady, start,
    activate, send, admit, executeActor].some((value) => !value)) {
    interactionReadinessFinding(findings, lawId, interactionReadinessPath,
      "The existing Browser Authority must own the complete interaction-readiness gate.");
    return;
  }

  const runtimeSendText = send!.getText();
  const runtimeText = runtime!.getFullText();
  const nonFrameUrlReads = readinessClass!.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .filter((property) => property.getName() === "url"
      && property.getExpression().getText() !== "frame");
  const authorityExact = interactionAuthorityExact({ execute: execute!, executeBoundary: executeBoundary!,
    executeMutation: executeMutation!, ensure: ensure!, assertReady: assertReady!,
    acquireBoundary: acquireBoundary!, frameBoundary: frameBoundary!, start: start!,
    constructor: constructor!, runtimeText,
    runtimeSendText, rateLimitText: gptRateLimitRuntime!.getFullText(),
    nonFrameUrlReadCount: nonFrameUrlReads.length });
  if (!authorityExact) interactionReadinessFinding(findings, lawId, interactionReadinessPath,
    "Mutation execution and every CDP page read must use one exact-tab logical-access cycle, with only the exact rate-limit acknowledgement bypassing the 1.5-second wait.");

  inspectRuntimeActivation({ activate: activate!, send: send!, admit: admit!,
    executeActor: executeActor! }, findings, lawId);
  inspectNoFocusFallback(context, findings, lawId);
  inspectRateLimitGate(context, authority!.getFullText(), gptRateLimitRuntime!.getFullText(), findings, lawId);
};
