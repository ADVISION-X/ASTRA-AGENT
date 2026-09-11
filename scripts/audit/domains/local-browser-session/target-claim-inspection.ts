import { Node, SyntaxKind } from "ts-morph";
import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import {
  brokerPath,
  createLocalFinding,
  extensionDebuggerRuntimePath,
  requireIdentifiers,
  requireSource,
  sourcePaths,
  stringLiterals,
  targetAuthorityPath,
} from "./inspector-support.js";

const targetClaimAwaiterPath = "src/lib/browser/chrome-extension/websocket-target-claim-awaiter.ts";
const interactionReadinessPath =
  "src/lib/browser/chrome-extension/extension-interaction-readiness.ts";
const sitePolicyPath = "src/lib/browser/exact-target/browser-site-policy-registry.ts";
const targetLeaseManagerPath = "src/lib/browser/exact-target/browser-target-lease-manager.ts";
const laneCoordinatorPath = "src/lib/browser/infrastructure/browser-lane-coordinator.ts";
const targetAcquirerPath = "src/lib/browser/infrastructure/browser-target-acquirer.ts";

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

const inspectInteractionAuthority = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const authority = requireSource(context, findings, lawId, targetAuthorityPath);
  const readiness = requireSource(context, findings, lawId, interactionReadinessPath);
  const runtime = requireSource(context, findings, lawId, extensionDebuggerRuntimePath);
  const actor = requireSource(context, findings, lawId, sourcePaths[1]);
  const commandRegistry = requireSource(context, findings, lawId, sourcePaths[8]);
  if (!authority || !readiness || !runtime || !actor || !commandRegistry) return;

  const authorityClass = authority.getClass("ExtensionTargetAuthority");
  const execute = authorityClass?.getMethod("executeRegisteredCommand");
  const start = authorityClass?.getMethod("start");
  const readinessClass = readiness.getClass("ExtensionInteractionReadiness");
  const executeMutation = readinessClass?.getMethod("executeMutation");
  const ensure = readinessClass?.getMethod("ensureInteractionReady");
  const assertReady = readinessClass?.getMethod("assertInteractionReady");
  const activate = runtime.getClass("ExtensionDebuggerRuntime")?.getMethod("activateTab");
  const send = runtime.getClass("ExtensionDebuggerRuntime")?.getMethod("send");
  const admit = commandRegistry.getVariableDeclaration("admitExtensionCommand");
  const executeActor = actor.getClass("ExtensionWebSocketActor")?.getMethod("executeCommand");
  if (!authorityClass || !execute || !readinessClass || !executeMutation || !ensure
    || !assertReady || !start || !activate || !send
    || !admit || !executeActor) {
    interactionReadinessFinding(findings, lawId, interactionReadinessPath,
      "The existing Browser Authority must own the complete interaction-readiness gate.");
    return;
  }

  const executeText = execute.getText();
  const ensureText = ensure.getText();
  const assertText = assertReady.getText();
  const startText = start.getText();
  const activateText = activate.getText();
  const sendText = send.getText();
  const admitText = admit.getText();
  const actorText = executeActor.getText();

  const nonFrameUrlReads = readinessClass.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .filter((property) => property.getName() === "url"
      && property.getExpression().getText() !== "frame");
  const authorityExact = executeText.includes('mutationClass === "mutation"')
    && exactCallCount(execute, "this.interactionReadiness.executeMutation") === 1
    && exactCallCount(executeMutation, "this.ensureInteractionReady") === 1
    && exactCallCount(executeMutation, "this.debuggerRuntime.withProviderInputGuard") === 1
    && ensureText.includes("tab.active !== true")
    && exactCallCount(ensure, "this.debuggerRuntime.activateTab") === 1
    && exactCallCount(ensure, "this.debuggerRuntime.readTab") === 3
    && exactCallCount(ensure, "readExtensionMainFrame") === 1
    && ensureText.includes("activeState.target?.targetRef !== target.targetRef")
    && ensureText.includes("frame.loaderId !== activeState.loaderId")
    && exactCallCount(ensure, "requireGptWebPolicyForUrl") === 1
    && nonFrameUrlReads.length === 0
    && ensureText.indexOf("this.recordActiveTab(windowId, target.tabId)")
      < ensureText.indexOf("readExtensionMainFrame(this.debuggerRuntime, target.tabId)")
    && ensureText.includes("active.generation !== activationGeneration")
    && assertText.includes("active.generation !== lease.generation")
    && exactCallCount(assertReady, "this.resolveExactTarget") === 1
    && exactCallCount(start, "this.chromeApi.tabs.onActivated.addListener") === 1
    && startText.includes("this.interactionReadiness.recordActiveTab");
  if (!authorityExact) interactionReadinessFinding(findings, lawId, interactionReadinessPath,
    "Mutation execution must use one exact-tab activation/readback lease, DevTools main-frame Origin truth, and no Tab.url dependency.");

  const updateCalls = activate.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getExpression().getText() === "this.chromeApi.tabs.update");
  const updateArguments = updateCalls[0]?.getArguments() ?? [];
  const runtimeExact = updateCalls.length === 1
    && updateArguments[0]?.getText() === "tabId"
    && updateArguments[1]?.getText().replace(/\s/gu, "") === "{active:true}"
    && activateText.includes("this.executePageAction")
    && sendText.indexOf("guard.assertInteractive()") >= 0
    && sendText.indexOf("guard.state.started = true") > sendText.indexOf("guard.assertInteractive()")
    && sendText.indexOf("this.chromeApi.debugger.sendCommand") > sendText.indexOf("guard.state.started = true");
  if (!runtimeExact) interactionReadinessFinding(findings, lawId, extensionDebuggerRuntimePath,
    "The fixed runtime must activate once through the existing page-action gate and synchronously check interaction identity before marking Provider input started.");

  if (!admitText.includes("mutationClass: expectedMutationClass")
    || !actorText.includes("registeredCommand.mutationClass")) {
    interactionReadinessFinding(findings, lawId, sourcePaths[8],
      "Command admission must preserve the actual mutation class through the sole encrypted actor into Browser Authority.");
  }

  const forbidden = context.project.getSourceFiles().filter((source) => {
    const path = source.getFilePath().replaceAll("\\", "/");
    if (!path.includes("/src/lib/browser/chrome-extension/")) return false;
    const hasWindowFocus = source.getDescendantsOfKind(SyntaxKind.CallExpression)
      .some((call) => call.getExpression().getText().endsWith("windows.update"));
    const hasBringToFront = source.getDescendantsOfKind(SyntaxKind.StringLiteral)
      .some((literal) => literal.getLiteralValue() === "Page.bringToFront");
    return hasWindowFocus || hasBringToFront;
  });
  for (const source of forbidden) interactionReadinessFinding(findings, lawId,
    source.getFilePath().slice(context.sealedRoot.length + 1).replaceAll("\\", "/"),
    "The unique interaction gate must not add window focus or Page.bringToFront fallback authority.");
};

const inspectJobBoundClaimOrder = (actor: ReturnType<typeof requireSource>, findings: InspectorFinding[], lawId: string): void => {
  const actorClass = actor?.getClass("ExtensionWebSocketActor");
  const readyText = actorClass?.getMethod("acceptReady")?.getText() ?? "";
  const acquisitionText = actorClass?.getMethod("acceptTargetAcquire")?.getText() ?? "";
  const decryptIndex = acquisitionText.indexOf("await decrypt(");
  const claimIndex = acquisitionText.indexOf("await this.targetAuthority.acquireJobBoundChatGptTarget(");
  if (readyText.includes("this.commandReady = true")
    && !readyText.includes("acquireJobBoundChatGptTarget")
    && acquisitionText.includes("!this.commandReady")
    && decryptIndex >= 0
    && claimIndex > decryptIndex) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/job-bound-target-claim", lawId, filePath: sourcePaths[1],
    message: "READY must leave Target absent; only one authenticated TARGET_ACQUIRE may invoke the exact target owner.",
  }));
};

const inspectServerClaimOrder = (serverClaim: string, findings: InspectorFinding[], lawId: string): void => {
  const policyIndex = serverClaim.indexOf("requireGptWebClaimOrigin(input.claimOrigin)");
  const workspaceIndex = serverClaim.indexOf("this.establishClaimBoundWorkspace()");
  if (policyIndex >= 0 && workspaceIndex > policyIndex) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/job-bound-target-claim", lawId, filePath: sourcePaths[3],
    message: "The server must validate the exact ChatGPT policy before Session Workspace establishment.",
  }));
};

const inspectBrokerClaimMonotonicity = (brokerText: string, findings: InspectorFinding[], lawId: string): void => {
  if (brokerText.includes("current.targetRef !== claim.targetRef")
    && brokerText.includes("claim.navigationEpoch !== current.navigationEpoch + 1")) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/job-bound-target-claim", lawId, filePath: brokerPath,
    message: "The Broker must reject target replacement and non-monotonic Document claims on one authority epoch.",
  }));
};

const inspectDispatchedMutationReleaseGuard = (
  leaseManager: ReturnType<typeof requireSource>,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const method = leaseManager?.getClass("BrowserTargetLeaseManager")?.getMethod("createTargetLease")?.getText() ?? "";
  const closeAt = method.indexOf("close: async");
  const guardAt = method.indexOf("state.pendingMutationCommandIds.length > 0", closeAt);
  const physicalCloseAt = method.indexOf('command("browser.close-target.v1"', closeAt);
  const parkAt = method.indexOf("park: async");
  const physicalParkAt = method.indexOf('command("browser.park-target.v1"', parkAt);
  if (parkAt >= 0 && physicalParkAt > parkAt
    && closeAt >= 0 && guardAt > closeAt && physicalCloseAt > guardAt) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/dispatched-mutation-target-release", lawId, filePath: targetLeaseManagerPath,
    message: "The Browser Owner must park a recovery Target while rejecting physical close for unresolved DISPATCHED mutations.",
  }));
};

const inspectExactChatGptPolicy = (source: ReturnType<typeof requireSource>, findings: InspectorFinding[], lawId: string): void => {
  const text = source?.getFullText() ?? "";
  const claimOrigin = source?.getVariableDeclaration("requireGptWebClaimOrigin")?.getText() ?? "";
  if (text.includes('export const GPT_WEB_ORIGIN = "https://chatgpt.com" as const')
    && text.includes('export const GPT_WEB_START_URL = "https://chatgpt.com/" as const')
    && /siteId: "gpt-web",\s*allowedOrigins: \[GPT_WEB_ORIGIN\]/u.test(text)
    && claimOrigin.includes("value !== GPT_WEB_ORIGIN")) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/job-bound-target-claim", lawId, filePath: sitePolicyPath,
    message: "The gpt-web policy must own one exact https://chatgpt.com/ start URL.",
  }));
};

const recoveryInspectionIsExact = (source: string): boolean => source.includes("debuggerRuntime.readTargets()")
  && source.includes("candidate.tabId === tabId")
  && (source.includes('candidate.type === "page"') || source.includes('candidates[0]!.type !== "page"'))
  && (source.includes("candidate.attached === true") || source.includes("candidates[0]!.attached !== true"))
  && !source.includes("tabs.query")
  && !source.includes("Page.bringToFront");

const inspectCanonicalConversationPolicy = (
  sitePolicyText: string,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const required of ["requireCanonicalGptConversationUrl", 'segments[1] === "c"',
    'url.search !== ""', 'url.hash !== ""']) if (!sitePolicyText.includes(required)) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/canonical-gpt-conversation", lawId,
      filePath: sitePolicyPath,
      message: `The Browser-owned canonical conversation policy is missing ${required}.`,
    }));
  }
};

const inspectJobBoundClaimPolicy = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const targetAuthority = requireSource(context, findings, lawId, targetAuthorityPath);
  const sitePolicy = requireSource(context, findings, lawId, sitePolicyPath);
  const actor = requireSource(context, findings, lawId, sourcePaths[1]);
  const supervisor = requireSource(context, findings, lawId, sourcePaths[3]);
  const broker = requireSource(context, findings, lawId, brokerPath);
  const leaseManager = requireSource(context, findings, lawId, targetLeaseManagerPath);
  const lane = requireSource(context, findings, lawId, laneCoordinatorPath);
  const targetAcquirer = requireSource(context, findings, lawId, targetAcquirerPath);
  if (!targetAuthority || !sitePolicy || !actor || !supervisor || !broker
    || !leaseManager || !lane || !targetAcquirer) return;
  requireIdentifiers(targetAuthority, [
    "acquireJobBoundChatGptTarget", "createBackgroundTab", "removeTab", "GPT_WEB_START_URL",
    "requireGptWebPolicyForUrl", "waitForCreatedTarget", "navigationPublication",
    "parkActiveTarget", "parkedLoaderIds", "attachedTabId", "singleParkedTargetRef",
    "publishMainFrameNavigation",
  ], findings, lawId, "The fixed extension must create, validate and retain exactly one visible system Target for all GPT turns.");
  requireIdentifiers(supervisor, [
    "requireGptWebClaimOrigin", "establishClaimBoundWorkspace", "pendingJobBoundTargetAcquisition",
    "acquireJobBoundTargetLease",
  ], findings, lawId,
  "The server must bind initial Target acquisition to one current job request before establishing Session Workspace.");
  requireIdentifiers(lane, ["BrowserTargetAcquirer", "targetAcquirer", "ensureAvailableTarget"], findings, lawId,
    "The sole Browser lane must delegate target acquisition to its one private target acquirer.");
  requireIdentifiers(targetAcquirer, [
    "acquireJobBoundTarget", "requestPreauthorizedTargetAcquisition", "pendingJobBoundTargetAcquisition",
    "expectedTargetRef", "resolvePending", "rejectPending",
  ], findings, lawId, "The target acquirer must bind acquisition to the current queued job and exact recovery target.");
  requireIdentifiers(broker, ["current", "targetRef", "navigationEpoch"], findings, lawId,
    "The sole Broker must reject target replacement and non-monotonic Document claims.");
  inspectJobBoundClaimOrder(actor, findings, lawId);
  inspectServerClaimOrder(supervisor.getClass("BrowserInfrastructureSupervisor")?.getMethod("onTargetClaim")?.getText() ?? "", findings, lawId);
  inspectBrokerClaimMonotonicity(broker.getFullText(), findings, lawId);
  const targetAuthorityText = targetAuthority.getFullText();
  if (!recoveryInspectionIsExact(targetAuthorityText)) findings.push(createLocalFinding({
    checkId: "browser-authority/job-bound-target-claim", lawId, filePath: targetAuthorityPath,
    message: "MV3 recovery may inspect only the exact prior attached tabId and must never scan candidates or foreground a Tab.",
  }));
  inspectDispatchedMutationReleaseGuard(leaseManager, findings, lawId);
  inspectExactChatGptPolicy(sitePolicy, findings, lawId);
  inspectCanonicalConversationPolicy(sitePolicy.getFullText(), findings, lawId);
};

export const inspectTargetClaimGuards = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const channel = requireSource(context, findings, lawId, sourcePaths[0]);
  const actor = requireSource(context, findings, lawId, sourcePaths[1]);
  const awaiter = requireSource(context, findings, lawId, targetClaimAwaiterPath);
  if (!channel || !actor || !awaiter) return;
  requireIdentifiers(channel, ["sendTargetClaimAcknowledgement", "parseBrowserAuthorityTargetClaim", "nonNegativeIntegerField"], findings, lawId,
    "Workbench target admission must accept epoch zero and return one encrypted acknowledgement.");
  requireIdentifiers(actor, ["TargetClaimAwaiter", "targetClaims", "sendTargetFrame", "acceptTargetClaimAcknowledgement"], findings, lawId,
    "The extension actor must route target claims through the one acknowledgement awaiter.");
  requireIdentifiers(actor, ["acceptTargetAcquire", "acquireJobBoundChatGptTarget"], findings, lawId,
    "The authenticated job-bound frame must trigger the fixed extension target owner and report a non-fatal diagnostic on failure.");
  if (!stringLiterals(actor).includes("job-bound-target-acquisition")) findings.push(createLocalFinding({
    checkId: "browser-authority/job-bound-target-claim", lawId, filePath: sourcePaths[1],
    message: "Job-bound target acquisition failure must remain a non-fatal authenticated diagnostic.",
  }));
  requireIdentifiers(awaiter, ["TargetClaimAwaiter", "begin", "accept", "fail"], findings, lawId,
    "The extension must not report target success before the Workbench acknowledgement.");
  const parseClaim = channel.getVariableDeclaration("parseBrowserAuthorityTargetClaim");
  const parseClaimText = parseClaim?.getText() ?? "";
  for (const required of [
    'stringField(body, "claimOrigin")', "requireGptWebClaimOrigin(claimOrigin)",
    '["targetRef", "documentRef", "navigationEpoch", "claimOrigin"]',
  ]) if (!parseClaimText.includes(required)) findings.push(createLocalFinding({
    checkId: "browser-authority/target-claim-origin-only",
    lawId,
    filePath: sourcePaths[0],
    message: `TARGET_CLAIM must carry exact claimOrigin only; missing ${required}.`,
  }));
  if (/stringField\(body,\s*["'](?:url|currentUrl)["']\)/u.test(parseClaimText)) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/target-claim-origin-only",
      lawId,
      filePath: sourcePaths[0],
      message: "TARGET_CLAIM must not carry current or canonical conversation URL.",
    }));
  }
  const navigationEpoch = parseClaim?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "navigationEpoch");
  const initializer = navigationEpoch?.getInitializerIfKind(SyntaxKind.CallExpression)?.getExpression();
  if (!initializer || !Node.isIdentifier(initializer) || astIdentifierName(initializer) !== "nonNegativeIntegerField") {
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority",
      lawId,
      filePath: sourcePaths[0],
      message: "The first target claim must parse navigationEpoch with the non-negative integer boundary so epoch zero remains valid.",
    }));
  }
  if (/GRASSEYE_CLAIM_ACTIVE_TARGET|claimActiveTarget/u.test(actor.getFullText())) findings.push(createLocalFinding({
    checkId: "browser-authority/job-bound-target-claim", lawId, filePath: sourcePaths[1],
    message: "The retired manual active-tab claim handler must be physically absent.",
  }));
  inspectJobBoundClaimPolicy(context, findings, lawId);
};

export const inspectInteractionReadiness = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => inspectInteractionAuthority(context, findings, lawId);
