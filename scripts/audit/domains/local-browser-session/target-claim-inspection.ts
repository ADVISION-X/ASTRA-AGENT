import { Node, SyntaxKind } from "ts-morph";
import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { brokerPath, createLocalFinding, requireIdentifiers, requireSource, sourcePaths, stringLiterals, targetAuthorityPath } from "./inspector-support.js";

const targetClaimAwaiterPath = "src/lib/browser/chrome-extension/websocket-target-claim-awaiter.ts";
const sitePolicyPath = "src/lib/browser/exact-target/browser-site-policy-registry.ts";
const automaticClaimAcceptancePath = "scripts/acceptance/local-browser-auto-pairing.acceptance.ts";

const inspectReadyClaimOrder = (actorText: string, findings: InspectorFinding[], lawId: string): void => {
  const readyIndex = actorText.indexOf("this.commandReady = true");
  const claimIndex = actorText.indexOf("await this.targetAuthority.claimPreauthorizedChatGptTarget()");
  if (readyIndex >= 0 && claimIndex > readyIndex) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/automatic-target-claim", lawId, filePath: sourcePaths[1],
    message: "The exact automatic target claim must execute only after READY installs command authority.",
  }));
};

const inspectServerClaimOrder = (serverClaim: string, findings: InspectorFinding[], lawId: string): void => {
  const policyIndex = serverClaim.indexOf("requireGptWebChatPolicyForUrl(input.url)");
  const workspaceIndex = serverClaim.indexOf("this.establishClaimBoundWorkspace()");
  if (policyIndex >= 0 && workspaceIndex > policyIndex) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/automatic-target-claim", lawId, filePath: sourcePaths[3],
    message: "The server must validate the exact ChatGPT policy before Session Workspace establishment.",
  }));
};

const inspectBrokerClaimMonotonicity = (brokerText: string, findings: InspectorFinding[], lawId: string): void => {
  if (brokerText.includes("current.targetRef !== claim.targetRef")
    && brokerText.includes("claim.navigationEpoch !== current.navigationEpoch + 1")) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/automatic-target-claim", lawId, filePath: brokerPath,
    message: "The Broker must reject target replacement and non-monotonic Document claims on one authority epoch.",
  }));
};

const inspectAutomaticClaimAcceptance = (combined: string, findings: InspectorFinding[], lawId: string): void => {
  for (const required of ["BROWSER_DEVTOOLS_CONFLICT", "multiple exact ChatGPT targets", "active: false", "Page.getFrameTree"]) {
    if (combined.includes(required)) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/automatic-target-claim", lawId, filePath: automaticClaimAcceptancePath,
      message: `Automatic target claim must enforce and test ${required}.`,
    }));
  }
};

const inspectExactChatGptPolicy = (source: ReturnType<typeof requireSource>, findings: InspectorFinding[], lawId: string): void => {
  if (!source || (stringLiterals(source).includes("https://chatgpt.com/")
    && /siteId: "gpt-web-chat",\s*allowedOrigins: \["https:\/\/chatgpt\.com"\]/u.test(source.getFullText()))) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/automatic-target-claim", lawId, filePath: sitePolicyPath,
    message: "The gpt-web-chat policy must own one exact https://chatgpt.com/ start URL.",
  }));
};

const inspectAutomaticClaimPolicy = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const targetAuthority = requireSource(context, findings, lawId, targetAuthorityPath);
  const sitePolicy = requireSource(context, findings, lawId, sitePolicyPath);
  const actor = requireSource(context, findings, lawId, sourcePaths[1]);
  const supervisor = requireSource(context, findings, lawId, sourcePaths[3]);
  const broker = requireSource(context, findings, lawId, brokerPath);
  const acceptance = requireSource(context, findings, lawId, automaticClaimAcceptancePath);
  if (!targetAuthority || !sitePolicy || !actor || !supervisor || !broker || !acceptance) return;
  requireIdentifiers(targetAuthority, [
    "claimPreauthorizedChatGptTarget", "getTargets", "create", "GPT_WEB_CHAT_START_URL",
    "requireGptWebChatPolicyForUrl", "navigationPublication",
  ], findings, lawId, "The fixed extension must own the exact single-target, zero-target creation and navigation claim chain.");
  requireIdentifiers(supervisor, ["requireGptWebChatPolicyForUrl", "establishClaimBoundWorkspace"], findings, lawId,
    "The server must revalidate the exact ChatGPT policy before establishing Session Workspace.");
  requireIdentifiers(broker, ["current", "targetRef", "navigationEpoch"], findings, lawId,
    "The sole Broker must reject target replacement and non-monotonic Document claims.");
  inspectReadyClaimOrder(actor.getClass("ExtensionWebSocketActor")?.getMethod("acceptReady")?.getText() ?? "", findings, lawId);
  inspectServerClaimOrder(supervisor.getClass("BrowserInfrastructureSupervisor")?.getMethod("onTargetClaim")?.getText() ?? "", findings, lawId);
  inspectBrokerClaimMonotonicity(broker.getFullText(), findings, lawId);
  inspectAutomaticClaimAcceptance(`${targetAuthority.getFullText()}\n${acceptance.getFullText()}`, findings, lawId);
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
  requireIdentifiers(actor, ["claimPreauthorizedChatGptTarget"], findings, lawId,
    "READY must trigger the fixed extension automatic target owner and report a non-fatal diagnostic on failure.");
  if (!stringLiterals(actor).includes("automatic-target-claim")) findings.push(createLocalFinding({
    checkId: "browser-authority/automatic-target-claim", lawId, filePath: sourcePaths[1],
    message: "Automatic target claim failure must remain a non-fatal authenticated diagnostic.",
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
    checkId: "browser-authority/automatic-target-claim", lawId, filePath: sourcePaths[1],
    message: "The retired manual active-tab claim handler must be physically absent.",
  }));
  inspectAutomaticClaimPolicy(context, findings, lawId);
};
