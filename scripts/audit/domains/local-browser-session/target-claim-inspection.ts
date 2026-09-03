import { Node, SyntaxKind } from "ts-morph";
import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { brokerPath, createLocalFinding, requireIdentifiers, requireSource, sourcePaths, stringLiterals, targetAuthorityPath } from "./inspector-support.js";

const targetClaimAwaiterPath = "src/lib/browser/chrome-extension/websocket-target-claim-awaiter.ts";
const sitePolicyPath = "src/lib/browser/exact-target/browser-site-policy-registry.ts";
const targetLeaseManagerPath = "src/lib/browser/exact-target/browser-target-lease-manager.ts";
const laneCoordinatorPath = "src/lib/browser/infrastructure/browser-lane-coordinator.ts";
const jobBoundClaimAcceptancePath = "scripts/acceptance/local-browser-auto-pairing.acceptance.ts";

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
  const policyIndex = serverClaim.indexOf("requireGptWebPolicyForUrl(input.url)");
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

const inspectJobBoundClaimAcceptance = (combined: string, findings: InspectorFinding[], lawId: string): void => {
  for (const required of [
    "BROWSER_DEVTOOLS_CONFLICT", "getTargetsCalls", "active: false", "Page.getFrameTree",
    "BROWSER_EXACT_TARGET_UNAVAILABLE", "single-Tab reuse", "removedTabs.includes",
    "targetTabRemoved", "replacement production Tab", "target-tab-4",
  ]) {
    if (combined.includes(required)) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/job-bound-target-claim", lawId, filePath: jobBoundClaimAcceptancePath,
      message: `Job-bound target claim must enforce and test ${required}.`,
    }));
  }
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
  if (!source || (stringLiterals(source).includes("https://chatgpt.com/")
    && /siteId: "gpt-web",\s*allowedOrigins: \["https:\/\/chatgpt\.com"\]/u.test(source.getFullText()))) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/job-bound-target-claim", lawId, filePath: sitePolicyPath,
    message: "The gpt-web policy must own one exact https://chatgpt.com/ start URL.",
  }));
};

const recoveryInspectionIsExact = (source: string): boolean => source.includes("chromeApi.debugger.getTargets()")
  && source.includes("candidate.tabId === tabId")
  && (source.includes('candidate.type === "page"') || source.includes('candidates[0]!.type !== "page"'))
  && (source.includes("candidate.attached === true") || source.includes("candidates[0]!.attached !== true"))
  && !source.includes("tabs.query")
  && !source.includes("Page.bringToFront");

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
  const acceptance = requireSource(context, findings, lawId, jobBoundClaimAcceptancePath);
  const leaseManager = requireSource(context, findings, lawId, targetLeaseManagerPath);
  const lane = requireSource(context, findings, lawId, laneCoordinatorPath);
  if (!targetAuthority || !sitePolicy || !actor || !supervisor || !broker || !acceptance
    || !leaseManager || !lane) return;
  requireIdentifiers(targetAuthority, [
    "acquireJobBoundChatGptTarget", "create", "remove", "GPT_WEB_START_URL",
    "requireGptWebPolicyForUrl", "waitForCreatedTarget", "navigationPublication",
    "parkActiveTarget", "parkedLoaderIds", "attachedTabId", "singleParkedTargetRef",
  ], findings, lawId, "The fixed extension must create, validate and retain exactly one visible system Target for all GPT turns.");
  requireIdentifiers(supervisor, [
    "requireGptWebPolicyForUrl", "establishClaimBoundWorkspace", "pendingJobBoundTargetAcquisition",
    "acquireJobBoundTargetLease",
  ], findings, lawId,
  "The server must bind initial Target acquisition to one current job request before establishing Session Workspace.");
  requireIdentifiers(lane, ["requestPreauthorizedTargetAcquisition", "pendingJobBoundTargetAcquisition"],
    findings, lawId, "The sole Browser lane must bind target acquisition to the current queued job.");
  requireIdentifiers(broker, ["current", "targetRef", "navigationEpoch"], findings, lawId,
    "The sole Broker must reject target replacement and non-monotonic Document claims.");
  inspectJobBoundClaimOrder(actor, findings, lawId);
  inspectServerClaimOrder(supervisor.getClass("BrowserInfrastructureSupervisor")?.getMethod("onTargetClaim")?.getText() ?? "", findings, lawId);
  inspectBrokerClaimMonotonicity(broker.getFullText(), findings, lawId);
  inspectJobBoundClaimAcceptance(`${targetAuthority.getFullText()}\n${acceptance.getFullText()}`, findings, lawId);
  const targetAuthorityText = targetAuthority.getFullText();
  if (!recoveryInspectionIsExact(targetAuthorityText)) findings.push(createLocalFinding({
    checkId: "browser-authority/job-bound-target-claim", lawId, filePath: targetAuthorityPath,
    message: "MV3 recovery may inspect only the exact prior attached tabId and must never scan candidates or foreground a Tab.",
  }));
  inspectDispatchedMutationReleaseGuard(leaseManager, findings, lawId);
  inspectExactChatGptPolicy(sitePolicy, findings, lawId);
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
