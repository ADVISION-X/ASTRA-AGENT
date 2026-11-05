import { SyntaxKind, type SourceFile } from "ts-morph";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { createLocalFinding, extensionDebuggerRuntimePath, requireSource, sourcePaths,
  targetAuthorityPath, extensionCommandRuntimePath } from "./inspector-support.js";

const paths = {
  authority: targetAuthorityPath,
  readiness: "src/lib/browser/chrome-extension/extension-interaction-readiness.ts",
  runtime: extensionDebuggerRuntimePath,
  commands: extensionCommandRuntimePath,
  registry: sourcePaths[8],
  detector: "src/lib/browser/chrome-extension/gpt-rate-limit-dialog.ts",
  access: "src/lib/browser/chrome-extension/chatgpt-page-access-gate.ts",
  dialog: "src/lib/browser/exact-target/browser-gpt-rate-limit-preflight.ts",
} as const;
type Sources = Record<keyof typeof paths, SourceFile>;
const method = (source: SourceFile, owner: string, name: string): string =>
  source.getClass(owner)?.getMethod(name)?.getText() ?? "";
const has = (text: string, facts: readonly string[]): boolean =>
  facts.every(fact => text.replace(/\s/gu, "").includes(fact.replace(/\s/gu, "")));
const requireContract = (condition: boolean, findings: InspectorFinding[], lawId: string,
  filePath: string, message: string): void => {
  if (!condition) findings.push(createLocalFinding({
    checkId: "browser-authority/interaction-readiness", lawId, filePath, message,
  }));
};
const countCalls = (source: SourceFile, owner: string, name: string, callee: string): number =>
  source.getClass(owner)?.getMethod(name)?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(call => call.getExpression().getText() === callee).length ?? 0;

const inspectInteractionLease = (s: Sources, findings: InspectorFinding[], lawId: string): void => {
  const owner = "ExtensionInteractionReadiness", authority = "ExtensionTargetAuthority";
  const ensure = method(s.readiness, owner, "ensureInteractionReady");
  const ready = method(s.readiness, owner, "assertInteractionReady");
  const capture = method(s.readiness, owner, "captureTabActivation");
  const noTabUrl = s.readiness.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .filter(property => property.getName() === "url" && property.getExpression().getText() !== "frame").length === 0;
  const facts = [
    has(method(s.authority, authority, "executeRegisteredCommandCycle"), ['mutationClass === "mutation"',
      "this.interactionReadiness.executeMutation(target, execute, assertCommandActive",
      'mutationClass === "observation"', "this.interactionReadiness.executeObservation(target, execute, assertCommandActive, permit)"]),
    countCalls(s.authority, authority, "executeRegisteredCommandCycle", "this.interactionReadiness.executeMutation") === 1,
    countCalls(s.authority, authority, "executeRegisteredCommandCycle", "this.interactionReadiness.executeObservation") === 1,
    countCalls(s.readiness, owner, "executeMutation", "this.ensureInteractionReady") === 1,
    countCalls(s.readiness, owner, "executeObservation", "this.ensureInteractionReady") === 1,
    countCalls(s.readiness, owner, "executeMutation", "this.debuggerRuntime.withProviderInputGuard") === 1,
    has(ensure, ["if (!tab.active)", "this.captureTabActivation(tab, target.tabId)",
      "targetRef: target.targetRef", "documentRef: target.documentRef", "tabId: target.tabId", "loaderId: frame.loaderId",
      "active.target?.[key as keyof ExtensionExactTarget] === value", "!identityMatches", "!target.expectedUrl",
      "`${url.origin}${url.pathname}` !== target.expectedUrl",
      "this.assertInteractionReady(lease)"]),
    countCalls(s.readiness, owner, "ensureInteractionReady", "this.debuggerRuntime.activateTab") === 1,
    countCalls(s.readiness, owner, "ensureInteractionReady", "readExtensionMainFrame") === 1,
    countCalls(s.readiness, owner, "ensureInteractionReady", "gptWebClaimOriginForUrl") === 1,
    ensure.indexOf("this.captureTabActivation(tab, target.tabId)") < ensure.indexOf("await readExtensionMainFrame("),
    has(method(s.readiness, owner, "requireInteractiveTab"), ["tab.id !== target.tabId",
      "!Number.isSafeInteger(tab.windowId)", "tab.active !== true", "tab.discarded !== false"]),
    has(capture, ["this.requireInteractiveTab(tab, { tabId })",
      "if (!this.activeTabsByWindow.has(windowId)) this.recordActiveTab(windowId, tabId)",
      "const generation = this.activeTabsByWindow.get(windowId)!.generation",
      "activation?.tabId !== tabId || activation.generation !== generation",
      'throw interactionFailure("BROWSER_TARGET_INVALID")', "assertActivation();", "return assertActivation"]),
    has(ready, ["lease.assertActivation()",
      "current.targetRef !== lease.targetRef", "current.documentRef !== lease.documentRef", "current.tabId !== lease.tabId",
      "current.chromeTargetId !== lease.chromeTargetId", "this.navigationGeneration !== lease.generation"]),
    countCalls(s.readiness, owner, "assertInteractionReady", "this.resolveExactTarget") === 1,
    countCalls(s.authority, authority, "start", "this.chromeApi.tabs.onActivated.addListener") === 1,
    has(method(s.authority, authority, "start"), ["this.interactionReadiness.recordActiveTab(info.windowId, info.tabId)"]),
    has(method(s.authority, authority, "start"), ['method === "Page.frameNavigated" && !frame?.parentId',
      'method === "Page.navigatedWithinDocument" && parameters?.frameId === this.activeMainFrameId',
      "this.interactionReadiness.invalidateNavigation()", "this.consumeFrameNavigationAfterBarrier(target.tabId)"]),
    method(s.authority, authority, "start").indexOf("this.interactionReadiness.invalidateNavigation()")
      < method(s.authority, authority, "start").indexOf("this.consumeFrameNavigationAfterBarrier(target.tabId)"),
    noTabUrl,
  ];
  requireContract(facts.every(Boolean), findings, lawId, paths.readiness,
    "Every mutation and observation must qualify the exact Tab/current Document and synchronously reuse the one window activation-generation guard.");
};

const inspectMutationFailure = (s: Sources, findings: InspectorFinding[], lawId: string): void => {
  const mutation = s.readiness.getClass("ExtensionInteractionReadiness")?.getMethod("executeMutation");
  const returns = mutation?.getDescendantsOfKind(SyntaxKind.ReturnStatement) ?? [];
  const success = returns[0]?.getExpression()?.asKind(SyntaxKind.AwaitExpression)?.getExpression().asKind(SyntaxKind.CallExpression);
  const body = mutation?.getText() ?? "";
  requireContract(s.readiness.getVariableDeclaration("interactionRejectedReceipt") === undefined
    && returns.length === 1 && success?.getExpression().getText() === "this.debuggerRuntime.withProviderInputGuard"
    && has(body, ["assertInput();", "const lease = await this.ensureInteractionReady(target, assertInput, permit)",
      'permit.childCapabilityId === "submit_exact_gpt_turn_once"', 'permit.replayPolicy === "provider-effect-once"',
      "target.expectedUrl === GPT_WEB_START_URL", "target.pendingSubmit = { commandId: permit.commandId, state }",
      "this.assertInteractionReady(lease, state.started && target.pendingSubmit?.state === state)",
      "if (!state.started && target.pendingSubmit?.state === state) target.pendingSubmit = null",
      "await this.debuggerRuntime.awaitPageReadPermission()", "throw Object.assign(error instanceof Error ? error",
      "browserInputStarted: state.started", "browserPhysicalInputCount: state.physicalInputCount"]),
  findings, lawId, paths.readiness,
  "Preflight interaction refusal must throw through the original errorCode producer; partial input state must survive the original barrier.");
  requireContract(has(method(s.readiness, "ExtensionInteractionReadiness", "ensureInteractionReady"), [
    'const ack = permit.childCapabilityId === "acknowledge_known_gpt_rate_limit"',
    'permit.childCapabilityId === "get_submitted_gpt_conversation_url"', 'permit.replayPolicy === "observation-only"',
    "target.pendingSubmit?.state.started === true", "target.pendingSubmit.commandId !== permit.commandId && !locator",
    "!ack && !locator && `${url.origin}${url.pathname}` !== target.expectedUrl",
  ]), findings, lawId, paths.readiness,
  "The first-submit pending window borrows the original input state, blocks ordinary input, and leaves only the existing locator read and exact acknowledgement qualification open.");
};

const inspectLogicalAccess = (s: Sources, findings: InspectorFinding[], lawId: string): void => {
  const owner = "ExtensionTargetAuthority", boundary = method(s.authority, owner, "executeRegisteredCommand");
  const send = method(s.runtime, "ExtensionDebuggerRuntime", "send");
  const facts = [
    has(s.authority.getClass(owner)?.getConstructors()[0]?.getText() ?? "", ["this.debuggerRuntime.requireLogicalPageAccessCycles()"]),
    countCalls(s.authority, owner, "executeRegisteredCommand", "this.debuggerRuntime.withLogicalPageAccess") === 1,
    countCalls(s.authority, owner, "acquireJobBoundChatGptTarget", "this.debuggerRuntime.withLogicalPageAccess") === 1,
    countCalls(s.authority, owner, "consumeFrameNavigationAfterBarrier", "this.debuggerRuntime.withLogicalPageAccess") === 1,
    has(boundary, ['const ack = command.kind === "dom-intent" && command.intent.kind === "acknowledgeKnownGptRateLimit"',
      'ack ? "rate-limit-ack" : "ordinary"', "ack ? async () => undefined",
      "this.pageAccessGate.enter()", "this.pageAccessGate.awaitTransientDomConfirmationStage(transient)"]),
    has(send, ["this.logicalPageAccess.required && !this.logicalPageAccess.active", "BROWSER_PAGE_ACCESS_CYCLE_REQUIRED"]),
    has(s.runtime.getText(), ["urgentLogicalPageAccessQueue.shift()", "ordinaryLogicalPageAccessQueue.shift()"]),
    has(s.detector.getText(), ["intent.dispatchNotAfter === null", "Date.parse(intent.dispatchNotAfter)"]),
  ];
  requireContract(facts.every(Boolean), findings, lawId, paths.authority,
    "All CDP page work must use the sole logical-access cycle; only the exact deadline-bound rate-limit acknowledgement may bypass the shared delay.");
};

const inspectPhysicalInput = (s: Sources, findings: InspectorFinding[], lawId: string): void => {
  const activate = s.runtime.getClass("ExtensionDebuggerRuntime")?.getMethod("activateTab");
  const updates = activate?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(call => call.getExpression().getText() === "this.chromeApi.tabs.update") ?? [];
  const args = updates[0]?.getArguments() ?? [];
  const send = method(s.runtime, "ExtensionDebuggerRuntime", "send");
  const facts = [
    updates.length === 1, args[0]?.getText() === "tabId", (args[1]?.getText() ?? "").replace(/\s/gu, "") === "{active:true}",
    has(activate?.getText() ?? "", ["this.executePageAction"]),
    send.indexOf("guard.assertInteractive()") >= 0,
    send.indexOf("guard.state.started = true") > send.indexOf("guard.assertInteractive()"),
    send.indexOf("this.chromeApi.debugger.sendCommand") > send.indexOf("guard.state.started = true"),
    has(s.registry.getVariableDeclaration("admitExtensionCommand")?.getText() ?? "", ["mutationClass: expectedMutationClass"]),
    has(s.commands.getVariableDeclaration("executeExtensionCommandReply")?.getText() ?? "", ["registered.mutationClass"]),
  ];
  requireContract(facts.every(Boolean), findings, lawId, paths.runtime,
    "Activate only the exact Tab once through the existing action gate; preserve mutation class and assert interaction identity before marking physical input started.");
};

const inspectRateLimitGate = (s: Sources, findings: InspectorFinding[], lawId: string): void => {
  if (lawId !== "LAW-LOCAL-BROWSER-SESSION-004-V60") return;
  requireContract(has(s.access.getText(), ["CHATGPT_LOGICAL_ACCESS_INTERVAL_MS = 1_500",
    "private lastAccessStartedAt = performance.now()", "this.lastAccessStartedAt + CHATGPT_LOGICAL_ACCESS_INTERVAL_MS",
    "this.tail = entered.then(() => undefined, () => undefined)"])
    && has(s.authority.getText(), ["private readonly pageAccessGate = new ChatGptPageAccessGate()"]),
  findings, lawId, paths.access, "All jobs and Tabs must share the extension-process 1.5-second logical-access gate, including its initial wait.");
  requireContract(has(s.dialog.getText(), ['KNOWN_GPT_RATE_LIMIT_TITLE = "请求过于频繁"',
    "KNOWN_GPT_RATE_LIMIT_BODY = Object.freeze([", 'KNOWN_GPT_RATE_LIMIT_ACK = "明白了"', 'state === "exact_present"'])
    && has(s.detector.getText(), ["lines.length === exactLines.length", "line === exactLines[index]",
      "rawDialogs.length === 1", "rawButtons.length === 1", "actionableButtons.length === 1",
      'const state = eligibleDialogs.length === 0 ? "absent" : exact ? "exact_present" : "mismatch"'])
    && has(s.authority.getText(), ['if (preflight.state === "exact_present") return knownGptRateLimitBlockerReceipt(preflight)']),
  findings, lawId, paths.detector, "Only one exact known dialog with its unique actionable acknowledgement may block the original request and enter the urgent acknowledgement path.");
};

const inspectNoFocus = (context: InspectorContext, findings: InspectorFinding[], lawId: string): void => {
  for (const source of context.project.getSourceFiles()) {
    if (!source.getFilePath().replaceAll("\\", "/").includes("/src/lib/browser/chrome-extension/")) continue;
    const windowFocus = source.getDescendantsOfKind(SyntaxKind.CallExpression)
      .some(call => call.getExpression().getText().endsWith("windows.update"));
    const front = source.getDescendantsOfKind(SyntaxKind.StringLiteral)
      .some(literal => literal.getLiteralValue() === "Page.bringToFront");
    requireContract(!windowFocus && !front, findings, lawId,
      source.getFilePath().slice(context.sealedRoot.length + 1).replaceAll("\\", "/"),
      "The sole interaction gate must never add window focus or Page.bringToFront fallback authority.");
  }
};

export const inspectInteractionReadiness = (context: InspectorContext,
  findings: InspectorFinding[], lawId: string): void => {
  const sources = {} as Sources;
  for (const [key, path] of Object.entries(paths)) {
    const source = requireSource(context, findings, lawId, path);
    if (!source) return;
    sources[key as keyof Sources] = source;
  }
  inspectInteractionLease(sources, findings, lawId);
  inspectMutationFailure(sources, findings, lawId);
  inspectLogicalAccess(sources, findings, lawId);
  inspectPhysicalInput(sources, findings, lawId);
  inspectRateLimitGate(sources, findings, lawId);
  inspectNoFocus(context, findings, lawId);
};
