import { existsSync, readFileSync } from "node:fs";
import { Node, SyntaxKind, type MethodDeclaration, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";

type Law = Readonly<{ lawId: string; clauseId: string }>;
type Rule = Readonly<{ checkId: string; law: Law; verify: (context: InspectorContext) => readonly InspectorFinding[] }>;

const laws = {
  exact: { lawId: "APEX-LOCAL-BROWSER-001-V3", clauseId: "apex-local-browser-001-v3-exact-authority-lease" },
  auth: { lawId: "APEX-LOCAL-BROWSER-002-V3", clauseId: "apex-local-browser-002-v3-authority-atomicity" },
  chain: { lawId: "APEX-LOCAL-BROWSER-003-V3", clauseId: "apex-local-browser-003-v3-single-chain" },
  command: { lawId: "APEX-LOCAL-BROWSER-004-V3", clauseId: "apex-local-browser-004-v3-governed-command-plane" },
  release: { lawId: "APEX-LOCAL-BROWSER-005-V2", clauseId: "apex-local-browser-005-v2-release-identity" },
  crossRepo: { lawId: "APEX-LOCAL-BROWSER-006-V2", clauseId: "apex-local-browser-006-v2-cross-repo-fence-proof" },
  privacy: { lawId: "GRASSEYE-SECURITY-PRIVACY-BROWSER-001-V2", clauseId: "grasseye-security-privacy-browser-001-v2-secrets-and-paths" },
} as const;

const requiredFiles = [
  "src/lib/browser/browser-authority-api.ts", "src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts",
  "src/lib/browser/infrastructure/browser-authority-issuer.ts", "src/lib/browser/infrastructure/browser-authority-broker.ts",
  "src/lib/browser/exact-target/browser-target-lease-manager.ts", "src/lib/browser/exact-target/browser-command-actor.ts",
  "src/lib/browser/protocol/browser-protocol.schema.json", "src/lib/browser/protocol/generated/browser-protocol.generated.ts",
  "src/lib/browser/chrome-extension/manifest.json", "src/lib/browser/chrome-extension/external-port-actor.ts",
  "src/lib/browser/transport/workbench-extension-channel.ts", "src/lib/browser/release/cws-extension-release-identity.ts",
  "src/lib/browser/release/cws-extension-release-proof.ts", "src/lib/browser/profile/browser-process-supervisor.ts",
] as const;
const retiredPaths = [
  "src/lib/browser/browser-controller.ts", "src/lib/browser/current-chrome-browser-controller.ts",
  "src/lib/browser/current-chrome-browser-controller-runtime.ts", "src/lib/local-runtime/workbench-browser-support.ts",
  "src/lib/local-runtime/workbench-video-download-support.ts",
  "src/lib/browser/native-messaging-host", "src/lib/browser/chrome-extension/native-port-actor.ts",
  "src/lib/browser/release/browser-activation-tuple.schema.json", "src/lib/browser/release/release-signing-trust.json",
] as const;

const report = (rule: Rule, filePath: string, message: string, line?: number): InspectorFinding => createFinding({
  checkId: rule.checkId, lawId: rule.law.lawId, clauseId: rule.law.clauseId, filePath, message, ...(line === undefined ? {} : { line }),
});
const sourceAt = (context: InspectorContext, path: string): SourceFile | undefined => context.project.getSourceFile(resolveFromRepo(path));
const productionSourceFiles = (context: InspectorContext): readonly SourceFile[] => context.project.getSourceFiles().filter((file) => file.getFilePath().includes("/src/"));
const identifierNames = (file: SourceFile): ReadonlySet<string> => new Set(file.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()));
const sourcePath = (file: SourceFile): string => toRepoPath(file.getFilePath());
const identifierSymbolName = (node: Node): string | undefined => Node.isIdentifier(node) ? node.getSymbol()?.getEscapedName().toString() : undefined;
const propertyAccessPath = (node: Node): readonly string[] | undefined => {
  if (Node.isIdentifier(node)) return [node.getSymbol()?.getEscapedName().toString() ?? node.getText()];
  if (!Node.isPropertyAccessExpression(node)) return undefined;
  const prefix = propertyAccessPath(node.getExpression());
  return prefix === undefined ? undefined : [...prefix, node.getName()];
};
const callCount = (file: SourceFile, expectedPath: readonly string[]): number => file.getDescendantsOfKind(SyntaxKind.CallExpression)
  .filter((call) => propertyAccessPath(call.getExpression())?.join(".") === expectedPath.join(".")).length;
const callName = (call: Node): string | undefined => {
  if (!Node.isCallExpression(call)) return undefined;
  const path = propertyAccessPath(call.getExpression());
  return path?.[path.length - 1] ?? identifierSymbolName(call.getExpression());
};
const callbackAt = (call: Node): Node | undefined => {
  if (!Node.isCallExpression(call)) return undefined;
  const callback = call.getArguments()[0];
  return callback && (Node.isArrowFunction(callback) || Node.isFunctionExpression(callback)) ? callback : undefined;
};
const namedCallStart = (callback: Node, name: string): number | undefined => callback.getDescendantsOfKind(SyntaxKind.CallExpression)
  .find((call) => callName(call) === name)?.getStart();
const tailCallCount = (file: SourceFile, expectedTail: readonly string[]): number => file.getDescendantsOfKind(SyntaxKind.CallExpression)
  .filter((call) => {
    const path = propertyAccessPath(call.getExpression());
    return path !== undefined && path.slice(-expectedTail.length).join(".") === expectedTail.join(".");
  }).length;
const literalValues = (file: Node): readonly string[] => file.getDescendants().flatMap((node) => {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return [node.getLiteralValue()];
  return [];
});

const required = (rule: Rule): readonly InspectorFinding[] => requiredFiles.flatMap((path) => existsSync(resolveFromRepo(path)) ? [] : [report(rule, path, "required terminal Browser Authority file is missing")]);
const absentPaths = (rule: Rule): readonly InspectorFinding[] => retiredPaths.flatMap((path) => existsSync(resolveFromRepo(path)) ? [report(rule, path, "retired Browser path remains reachable")] : []);
const forbiddenIdentifiers = (rule: Rule, context: InspectorContext, identifiers: readonly string[]): readonly InspectorFinding[] => productionSourceFiles(context).flatMap((file) => {
  const present = identifierNames(file);
  return identifiers.flatMap((identifier) => present.has(identifier) ? [report(rule, sourcePath(file), `forbidden AST identifier remains reachable: ${identifier}`)] : []);
});
const requiredIdentifiers = (rule: Rule, context: InspectorContext, path: string, identifiers: readonly string[]): readonly InspectorFinding[] => {
  const file = sourceAt(context, path);
  if (!file) return [report(rule, path, "required TypeScript production source is missing")];
  const present = identifierNames(file);
  return identifiers.flatMap((identifier) => present.has(identifier) ? [] : [report(rule, path, `required AST identifier is missing: ${identifier}`)]);
};
const requiredDiskFiles = (rule: Rule, paths: readonly string[]): readonly InspectorFinding[] => paths.flatMap((path) => existsSync(resolveFromRepo(path)) ? [] : [report(rule, path, "required Browser release artifact source is missing")]);
const requiredMv3ServiceWorker = (rule: Rule, context: InspectorContext): readonly InspectorFinding[] => {
  const manifestPath = "src/lib/browser/chrome-extension/manifest.json";
  const sourcePath = "src/lib/browser/chrome-extension/service-worker.ts";
  if (!existsSync(resolveFromRepo(manifestPath))) return [report(rule, manifestPath, "required MV3 manifest is missing")];
  const manifest = JSON.parse(readFileSync(resolveFromRepo(manifestPath), "utf8")) as {
    background?: { service_worker?: unknown };
    manifest_version?: unknown;
  };
  if (manifest.manifest_version !== 3 || manifest.background?.service_worker !== "service-worker.js") {
    return [report(rule, manifestPath, "MV3 manifest must name only service-worker.js as its background service worker")];
  }
  return sourceAt(context, sourcePath) === undefined
    ? [report(rule, sourcePath, "MV3 manifest service-worker source is missing")]
    : [];
};
const requireExactWorkbenchOrigin = (rule: Rule): readonly InspectorFinding[] => {
  const manifestPath = "src/lib/browser/chrome-extension/manifest.json";
  if (!existsSync(resolveFromRepo(manifestPath))) return [report(rule, manifestPath, "required MV3 manifest is missing")];
  const manifest = JSON.parse(readFileSync(resolveFromRepo(manifestPath), "utf8")) as {
    permissions?: unknown;
    host_permissions?: unknown;
    externally_connectable?: { matches?: unknown };
  };
  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  const hostPermissions = Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [];
  const matches = manifest.externally_connectable?.matches;
  const exactLoopback = Array.isArray(matches) && matches.length === 1 && matches[0] === "http://127.0.0.1/*";
  const debuggerOnly = permissions.length === 1 && permissions[0] === "debugger";
  return [
    ...(exactLoopback ? [] : [report(rule, manifestPath, "MV3 externally_connectable must allow exactly http://127.0.0.1/*")]),
    ...(debuggerOnly ? [] : [report(rule, manifestPath, "MV3 production manifest permissions must contain only debugger")]),
    ...(hostPermissions.length === 0 ? [] : [report(rule, manifestPath, "MV3 production manifest host_permissions must be empty")]),
  ];
};
const requireExternalPortBoundary = (rule: Rule, context: InspectorContext): readonly InspectorFinding[] => {
  const path = "src/lib/browser/chrome-extension/external-port-actor.ts";
  const file = sourceAt(context, path);
  if (!file) return [report(rule, path, "required external Port actor source is missing")];
  const literals = new Set(literalValues(file));
  const expectedSymbols = [
    "ExtensionExternalPortActor",
    "assertExactWorkbenchPortSender",
    "assertPageSessionGrant",
    "revokeCurrent",
    "replyChannelToken",
    "sourceChannelToken",
  ];
  const missingSymbols = expectedSymbols.filter((symbol) => !identifierNames(file).has(symbol));
  const externalListeners = productionSourceFiles(context).flatMap((source) => source.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => propertyAccessPath(call.getExpression())?.join(".") === "chrome.runtime.onConnectExternal.addListener")
    .map((call) => ({ source, call })));
  const listener = externalListeners[0]?.call;
  const listenerCallback = listener ? callbackAt(listener) : undefined;
  const senderCheck = listenerCallback ? namedCallStart(listenerCallback, "assertExactWorkbenchPortSender") : undefined;
  const actorStart = listenerCallback?.getDescendantsOfKind(SyntaxKind.NewExpression)
    .find((expression) => identifierSymbolName(expression.getExpression()) === "ExtensionExternalPortActor")?.getStart();
  const disconnectListeners = tailCallCount(file, ["onDisconnect", "addListener"]);
  const disconnect = file.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => propertyAccessPath(call.getExpression())?.slice(-2).join(".") === "onDisconnect.addListener");
  const disconnectCallback = disconnect ? callbackAt(disconnect) : undefined;
  const firstDisconnectCall = disconnectCallback?.getDescendantsOfKind(SyntaxKind.CallExpression)[0];
  const urlParserCount = file.getDescendantsOfKind(SyntaxKind.NewExpression)
    .filter((expression) => identifierSymbolName(expression.getExpression()) === "URL").length;
  return [
    ...missingSymbols.map((symbol) => report(rule, path, `external Port actor must enforce ${symbol}`)),
    ...(externalListeners.length === 1 && externalListeners[0]?.source === file
      ? []
      : [report(rule, path, "the whole production source tree must register exactly one onConnectExternal listener, in external-port-actor.ts")]),
    ...(senderCheck !== undefined && actorStart !== undefined && senderCheck < actorStart
      ? []
      : [report(rule, path, "accepted external Port must validate exact sender before creating its actor")]),
    ...(file.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => callName(call) === "assertPageSessionGrant")
      ? []
      : [report(rule, path, "external Port actor must validate the first-frame page-session grant before authority or commands")]),
    ...(disconnectListeners === 1 && firstDisconnectCall !== undefined && callName(firstDisconnectCall) === "revokeCurrent"
      ? []
      : [report(rule, path, "the onDisconnect callback must revokeCurrent as its first side effect")]),
    ...(urlParserCount >= 1 ? [] : [report(rule, path, "external Port actor must parse sender.url with URL semantics")]),
    ...["http:", "127.0.0.1", "/", "grasseye-browser-authority-v1"].flatMap((value) => literals.has(value)
      ? []
      : [report(rule, path, `external Port actor must enforce exact sender boundary value: ${value}`)]),
  ];
};
const requireCwsReleaseBinding = (rule: Rule, context: InspectorContext): readonly InspectorFinding[] => {
  const path = "src/lib/browser/release/cws-extension-release-identity.ts";
  const file = sourceAt(context, path);
  if (!file) return [report(rule, path, "required CWS release identity source is missing")];
  const expectedSymbols = [
    "CwsExtensionReleaseIdentity",
    "cwsReviewReceiptRef",
    "installedExtensionId",
    "installedExtensionVersion",
    "sourcePackageHash",
    "permissionPolicyHash",
    "originPolicyHash",
    "assertCwsReleaseIdentity",
  ];
  const result = expectedSymbols.flatMap((symbol) => identifierNames(file).has(symbol)
    ? []
    : [report(rule, path, `CWS release identity must bind ${symbol}`)]);
  const freezeGuard = file.getFunctions().find((candidate) => candidate.getName() === "assertNotFrozenLegacyVersion");
  const frozenVersionRejected = freezeGuard !== undefined
    && freezeGuard.getDescendantsOfKind(SyntaxKind.IfStatement).length >= 1
    && literalValues(freezeGuard).includes("0.1.1");
  return [
    ...result,
    ...(frozenVersionRejected ? [] : [report(rule, path, "CWS release identity must explicitly reject frozen v0.1.1 in assertNotFrozenLegacyVersion")]),
  ];
};
const orderedCalls = (rule: Rule, context: InspectorContext, path: string, methodName: string, firstName: string, secondName: string): readonly InspectorFinding[] => {
  const file = sourceAt(context, path);
  const method = file?.getDescendants().find((node): node is MethodDeclaration => Node.isMethodDeclaration(node) && node.getName() === methodName);
  if (!method) return [report(rule, path, `required method is missing: ${methodName}`)];
  const callStart = (name: string): number | undefined => method.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression) && expression.getName() === name;
  })?.getStart();
  const first = callStart(firstName);
  const second = callStart(secondName);
  return first === undefined || second === undefined || first >= second ? [report(rule, path, `${firstName} must occur before ${secondName} in ${methodName}`)] : [];
};
const requiredMethodCalls = (rule: Rule, context: InspectorContext, path: string, methodName: string, callNames: readonly string[]): readonly InspectorFinding[] => {
  const file = sourceAt(context, path);
  const method = file?.getDescendants().find((node): node is MethodDeclaration => Node.isMethodDeclaration(node) && node.getName() === methodName);
  if (!method) return [report(rule, path, `required method is missing: ${methodName}`)];
  const present = new Set(method.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression) ? [expression.getName()] : [];
  }));
  return callNames.flatMap((callName) => present.has(callName) ? [] : [report(rule, path, `required AST call is missing from ${methodName}: ${callName}`)]);
};

const r = (checkId: string, law: Law, verify: Rule["verify"]): Rule => ({ checkId, law, verify });
const rules: readonly Rule[] = [
  r("browser-old-path/retired-zero", laws.exact, (context) => [
    ...required(rules[0]!), ...absentPaths(rules[0]!),
    ...forbiddenIdentifiers(rules[0]!, context, ["BrowserTargetSession", "CurrentChromeBrowserController", "createTargetSession"]),
  ]),
  r("browser-auth/no-unauth-session-type", laws.auth, (context) => forbiddenIdentifiers(rules[1]!, context, ["UnauthenticatedBrowserSession", "BrowserTargetSession"])),
  r("browser-auth/no-transport-ready-boolean", laws.auth, (context) => forbiddenIdentifiers(rules[2]!, context, ["transportReady"])),
  r("browser-auth/no-preauth-command-surface", laws.auth, (context) => requiredIdentifiers(rules[3]!, context, "src/lib/browser/infrastructure/browser-authority-broker.ts", ["BrowserAuthorityBroker", "acquireForExecution"])),
  r("browser-auth/no-fire-and-forget-startup", laws.auth, (context) => requiredMethodCalls(rules[4]!, context, "src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts", "start", ["acquire", "start"])),
  r("browser-auth/authority-mint-only-after-proof", laws.auth, (context) => [
    ...requiredIdentifiers(rules[5]!, context, "src/lib/browser/infrastructure/browser-authority-issuer.ts", ["BrowserAuthorityIssuer", "commitAuthenticationProof", "BrowserAuthenticationProof", "signCurrentCommandPermit"]),
    ...requiredMethodCalls(rules[5]!, context, "src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts", "commitWorkbenchAuthentication", ["assertCwsReleaseIdentity", "commitAuthentication"]),
  ]),
  r("browser-auth/revoke-before-side-effects", laws.auth, (context) => orderedCalls(rules[6]!, context, "src/lib/browser/transport/transport-actor.ts", "disconnect", "revokeCurrent", "dispatch")),
  r("browser-auth/authority-liveness-lease", laws.auth, (context) => requiredIdentifiers(rules[7]!, context, "src/lib/browser/infrastructure/browser-authority-liveness-lease.ts", ["BrowserAuthorityLivenessLeaseV1", "createLivenessLease"])),
  r("browser-auth/no-command-after-liveness-expiry", laws.auth, (context) => requiredIdentifiers(rules[8]!, context, "src/lib/browser/infrastructure/browser-authority-certificate.ts", ["assertCertificateLive"])),
  r("browser-auth/heartbeat-cannot-mint-authority", laws.auth, (context) => requiredIdentifiers(rules[9]!, context, "src/lib/browser/chrome-extension/authenticated-heartbeat.ts", ["assertAuthenticatedHeartbeat"])),
  r("browser-channel/no-page-session-rebind", laws.chain, (context) => forbiddenIdentifiers(rules[10]!, context, ["rebindController", "rebindHost", "rebindPageSession"])),
  r("browser-channel/original-reply-channel", laws.chain, (context) => [
    ...requiredIdentifiers(rules[11]!, context, "src/lib/browser/transport/command-permit.ts", ["replyChannelToken", "browserCommandPermitMacPayload"]),
    ...requiredIdentifiers(rules[11]!, context, "src/lib/browser/chrome-extension/command-permit-validator.ts", ["replyChannelToken", "commandPermitKey", "browserCommandPermitMacPayload", "assertExtensionCommandPermit"]),
    ...requiredIdentifiers(rules[11]!, context, "src/lib/browser/chrome-extension/external-port-actor.ts", ["ExtensionExternalPortActor", "sourceChannelToken", "replyChannelToken"]),
    ...requiredMv3ServiceWorker(rules[11]!, context),
  ]),
  r("browser-auth/production-fixture-zero", laws.chain, (context) => forbiddenIdentifiers(rules[12]!, context, ["FixtureBrowserController", "FixtureBrowserAuthority"])),
  r("browser-channel/no-native-host-surface", laws.chain, (context) => [
    ...absentPaths(rules[13]!),
    ...forbiddenIdentifiers(rules[13]!, context, ["connectNative", "NativePortActor", "NativeMessaging", "NativeHost"]),
    ...requireExactWorkbenchOrigin(rules[13]!),
    ...requireExternalPortBoundary(rules[13]!, context),
  ]),
  r("browser-command/bounded-admission-budget", laws.command, (context) => [
    ...requiredIdentifiers(rules[14]!, context, "src/lib/browser/transport/browser-command-admission-budget.ts", ["BrowserCommandAdmissionBudget", "BROWSER_COMMAND_MAX_QUEUED", "BROWSER_COMMAND_MAX_IN_FLIGHT"]),
    ...requiredMethodCalls(rules[14]!, context, "src/lib/browser/exact-target/browser-command-actor.ts", "execute", ["assertCurrentAuthority", "enter", "send", "leave"]),
    ...requiredIdentifiers(rules[14]!, context, "src/lib/browser/exact-target/browser-target-lease-manager.ts", ["signCurrentCommandPermit", "commandFrameMac"]),
    ...requiredIdentifiers(rules[14]!, context, "src/lib/browser/chrome-extension/command-permit-validator.ts", ["commandPermitKey", "browserCommandPermitMacPayload", "subtle"]),
  ]),
  r("browser-file/artifact-grant-no-raw-path", laws.command, (context) => [
    ...requiredIdentifiers(rules[15]!, context, "src/lib/browser/exact-target/browser-file-artifact-grant.ts", ["BrowserFileArtifactGrantV1", "grantRef", "contentHash"]),
    ...forbiddenIdentifiers(rules[15]!, context, ["evaluate", "evaluateTarget", "setFileInputFiles"]),
  ]),
  r("browser-release/cws-release-identity", laws.release, (context) => requireCwsReleaseBinding(rules[16]!, context)),
  r("browser-profile/dedicated-production-profile", laws.release, (context) => requiredIdentifiers(rules[17]!, context, "src/lib/browser/profile/dedicated-profile-policy.ts", ["BrowserDedicatedProfilePolicy", "disallowDefaultProfile"])),
  r("browser-profile/installed-extension-readback", laws.release, (context) => requiredIdentifiers(rules[18]!, context, "src/lib/browser/profile/browser-profile-config.ts", ["GRASSEYE_BROWSER_EXTENSION_ID", "extensionId"])),
  r("browser-profile/exact-workbench-origin-readback", laws.release, (context) => requiredIdentifiers(rules[19]!, context, "src/lib/browser/transport/workbench-extension-channel.ts", ["WORKBENCH_PAGE_ORIGIN", "pageSessionGrant"])),
  r("browser-release/cws-identity-proof-separation", laws.release, () => requiredDiskFiles(rules[20]!, ["src/lib/browser/release/cws-extension-release-identity.ts", "src/lib/browser/release/cws-extension-release-proof.ts"])),
  r("browser-release/cws-review-and-installed-readback", laws.release, (context) => [
    ...requiredDiskFiles(rules[21]!, [
      "src/lib/browser/release/cws-extension-release-identity.ts",
      "src/lib/browser/release/cws-extension-release-proof.ts",
      "scripts/acceptance/local-browser-real-chrome-terminal.acceptance.ts",
    ]),
    ...requireCwsReleaseBinding(rules[21]!, context),
  ]),
  r("browser-release/anti-rollback-and-revocation", laws.release, () => requiredDiskFiles(rules[22]!, ["src/lib/browser/release/browser-release-security-policy.schema.json"])),
  r("browser-release/no-apple-signing-gate", laws.release, (context) => [
    ...absentPaths(rules[23]!),
    ...forbiddenIdentifiers(rules[23]!, context, ["Notarization", "DeveloperIdApplication", "NativeHost"]),
  ]),
  r("browser-cross-repo/authority-proof-v2", laws.crossRepo, (context) => requiredIdentifiers(rules[24]!, context, "src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-proof.ts", ["AgentBrowserAuthorityProofV2", "AgentRuntimeReceiptV2", "no_action_during_authority_absence"])),
  r("browser-cross-repo/ordered-authority-window-chain", laws.crossRepo, (context) => requiredIdentifiers(rules[25]!, context, "src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-proof.ts", ["windows", "handover_receipt_chain_hash", "unresolved_outcome_unknown_count"])),
  r("browser-privacy/no-owner-boundary-leak", laws.privacy, (context) => forbiddenIdentifiers(rules[26]!, context, ["localStorage", "sessionStorage", "document.cookie"])),
];

const executeRule = (context: InspectorContext, rule: Rule) => ({ findings: rule.verify(context), evidenceRefs: [context.planEntry.ownerInspectorPath, ...requiredFiles] });

const runAuthorityChecks = async (context: InspectorContext): Promise<void> => {
  await context.checks.run("browser-old-path/retired-zero", async () => executeRule(context, rules[0]!));
  await context.checks.run("browser-auth/no-unauth-session-type", async () => executeRule(context, rules[1]!));
  await context.checks.run("browser-auth/no-transport-ready-boolean", async () => executeRule(context, rules[2]!));
  await context.checks.run("browser-auth/no-preauth-command-surface", async () => executeRule(context, rules[3]!));
  await context.checks.run("browser-auth/no-fire-and-forget-startup", async () => executeRule(context, rules[4]!));
  await context.checks.run("browser-auth/authority-mint-only-after-proof", async () => executeRule(context, rules[5]!));
  await context.checks.run("browser-auth/revoke-before-side-effects", async () => executeRule(context, rules[6]!));
  await context.checks.run("browser-auth/authority-liveness-lease", async () => executeRule(context, rules[7]!));
  await context.checks.run("browser-auth/no-command-after-liveness-expiry", async () => executeRule(context, rules[8]!));
};

const runChainAndCommandChecks = async (context: InspectorContext): Promise<void> => {
  await context.checks.run("browser-auth/heartbeat-cannot-mint-authority", async () => executeRule(context, rules[9]!));
  await context.checks.run("browser-channel/no-page-session-rebind", async () => executeRule(context, rules[10]!));
  await context.checks.run("browser-channel/original-reply-channel", async () => executeRule(context, rules[11]!));
  await context.checks.run("browser-auth/production-fixture-zero", async () => executeRule(context, rules[12]!));
  await context.checks.run("browser-channel/no-native-host-surface", async () => executeRule(context, rules[13]!));
  await context.checks.run("browser-command/bounded-admission-budget", async () => executeRule(context, rules[14]!));
  await context.checks.run("browser-file/artifact-grant-no-raw-path", async () => executeRule(context, rules[15]!));
  await context.checks.run("browser-release/cws-release-identity", async () => executeRule(context, rules[16]!));
  await context.checks.run("browser-profile/dedicated-production-profile", async () => executeRule(context, rules[17]!));
};

const runReleaseAndCrossRepoChecks = async (context: InspectorContext): Promise<void> => {
  await context.checks.run("browser-profile/installed-extension-readback", async () => executeRule(context, rules[18]!));
  await context.checks.run("browser-profile/exact-workbench-origin-readback", async () => executeRule(context, rules[19]!));
  await context.checks.run("browser-release/cws-identity-proof-separation", async () => executeRule(context, rules[20]!));
  await context.checks.run("browser-release/cws-review-and-installed-readback", async () => executeRule(context, rules[21]!));
  await context.checks.run("browser-release/anti-rollback-and-revocation", async () => executeRule(context, rules[22]!));
  await context.checks.run("browser-release/no-apple-signing-gate", async () => executeRule(context, rules[23]!));
  await context.checks.run("browser-cross-repo/authority-proof-v2", async () => executeRule(context, rules[24]!));
  await context.checks.run("browser-cross-repo/ordered-authority-window-chain", async () => executeRule(context, rules[25]!));
  await context.checks.run("browser-privacy/no-owner-boundary-leak", async () => executeRule(context, rules[26]!));
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  await runAuthorityChecks(context);
  await runChainAndCommandChecks(context);
  await runReleaseAndCrossRepoChecks(context);
  return context.checks.output({ reportJson: { checkCount: rules.length } });
};
