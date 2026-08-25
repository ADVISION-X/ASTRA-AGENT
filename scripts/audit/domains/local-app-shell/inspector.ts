import {
  Node,
  SyntaxKind,
  type CallExpression,
  type Project,
  type SourceFile,
} from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorEvaluation, InspectorFinding, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { finalizeStaticInspection } from "../../shared/static-inspector-result.js";

const LAW_SHELL = "LAW-LOCAL-APP-SHELL-001-V5";
const LAW_BOUNDARY = "LAW-LOCAL-APP-SHELL-002-V3";
const LAW_STATUS = "LAW-LOCAL-APP-SHELL-003-V2";
const checkId = "local-app-shell/owner-contract";

const requiredPaths = Object.freeze([
  "src/app/server.ts",
  "src/app/create-workbench-server.ts",
  "src/app/workbench-browser-websocket-upgrade.ts",
  "src/lib/local-runtime/workbench-handle.ts",
  "src/lib/local-runtime/workbench-status.ts",
  "src/lib/local-runtime/workbench.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production.workbench-owner.ts",
]);

const normalizePath = (value: string): string => value.split("\\").join("/");
const sourcePath = (source: SourceFile): string => {
  const normalized = normalizePath(source.getFilePath());
  for (const root of ["src/", "scripts/"]) {
    const marker = `/${root}`;
    const index = normalized.lastIndexOf(marker);
    if (index >= 0) return normalized.slice(index + 1);
    if (normalized.startsWith(root)) return normalized;
  }
  return normalized.replace(/^\//u, "");
};
const sourceAt = (project: Project, path: string): SourceFile | undefined =>
  project.getSourceFiles().find((source) => sourcePath(source) === path);
const finding = (lawId: string, filePath: string, message: string, line?: number): InspectorFinding =>
  createFinding({
    checkId,
    lawId,
    clauseId: `${lawId.toLowerCase()}-requirement`,
    filePath,
    message,
    ...(line ? { line } : {}),
  });

const propertyCallName = (call: CallExpression): string | null => {
  const expression = call.getExpression();
  return Node.isPropertyAccessExpression(expression) ? expression.getName() : null;
};
const identifierName = (node: Node): string | null => {
  if (!Node.isIdentifier(node)) return null;
  return node.getSymbol()?.getName() ?? null;
};
const stringArgument = (call: CallExpression, index: number): string | null => {
  const argument = call.getArguments()[index];
  return argument && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))
    ? argument.getLiteralText()
    : null;
};
const localRuntimeSources = (project: Project): SourceFile[] => project.getSourceFiles()
  .filter((source) => sourcePath(source).startsWith("src/lib/local-runtime/") && !source.isDeclarationFile());

const inspectUniqueServer = (project: Project, findings: InspectorFinding[]): void => {
  const appSources = project.getSourceFiles().filter((source) => sourcePath(source).startsWith("src/app/") && !source.isDeclarationFile());
  const serverCalls = appSources.flatMap((source) => source.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => identifierName(call.getExpression()) === "createServer")
    .map((call) => ({ call, path: sourcePath(source) })));
  const listeners = appSources.flatMap((source) => source.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => propertyCallName(call) === "listen")
    .map((call) => ({ call, path: sourcePath(source) })));
  const upgrades = appSources.flatMap((source) => source.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => propertyCallName(call) === "on" && stringArgument(call, 0) === "upgrade")
    .map((call) => ({ call, path: sourcePath(source) })));
  for (const [name, entries] of [["HTTP server", serverCalls], ["HTTP listener", listeners], ["WebSocket upgrade registration", upgrades]] as const) {
    if (entries.length !== 1) findings.push(finding(LAW_SHELL, "src/app", `${name} count must be exactly one; observed ${entries.length}.`));
  }

  const server = sourceAt(project, "src/app/server.ts");
  const start = server?.getFunction("startLocalRuntime");
  if (!start) {
    findings.push(finding(LAW_SHELL, "src/app/server.ts", "startLocalRuntime is missing."));
    return;
  }
  const calls = start.getDescendantsOfKind(SyntaxKind.CallExpression);
  const startServer = calls.find((call) => identifierName(call.getExpression()) === "startServer");
  const initialize = calls.find((call) => propertyCallName(call) === "init");
  const guarded = initialize?.getAncestors().some((ancestor) => Node.isCallExpression(ancestor) && propertyCallName(ancestor) === "catch") ?? false;
  if (!startServer || !initialize || startServer.getStart() >= initialize.getStart() || !guarded) {
    findings.push(finding(LAW_SHELL, "src/app/server.ts", "the diagnostic HTTP shell must start before execution initialization and initialization failure must be caught."));
  }
};

const inspectLocalRuntimeBoundary = (project: Project, findings: InspectorFinding[], lawId?: string): void => {
  const forbiddenNames = new Set(["BrowserCommandActor", "BrowserTargetLeaseManager", "EventSource", "localStorage"]);
  const forbiddenControlFields = new Set(["browserCommand", "coordinate", "documentId", "nextAction", "selector", "targetId"]);
  for (const source of localRuntimeSources(project)) {
    const path = sourcePath(source);
    for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const name = identifierName(call.getExpression()) ?? propertyCallName(call);
      if ((!lawId || lawId === LAW_SHELL) && (name === "createServer" || name === "listen" || name === "setInterval")) {
        findings.push(finding(LAW_SHELL, path, `local-runtime cannot create ${name}; the App Server is the sole listener owner.`, call.getStartLineNumber()));
      }
    }
    if (lawId && lawId !== LAW_BOUNDARY) continue;
    for (const identifier of source.getDescendantsOfKind(SyntaxKind.Identifier)) {
      if (forbiddenNames.has(identifier.getText())) {
        findings.push(finding(LAW_BOUNDARY, path, `local-runtime exposes forbidden browser/UI authority ${identifier.getText()}.`, identifier.getStartLineNumber()));
      }
    }
    for (const property of source.getDescendantsOfKind(SyntaxKind.PropertySignature)) {
      if (forbiddenControlFields.has(property.getName())) {
        findings.push(finding(LAW_BOUNDARY, path, `App input/display contract exposes browser control field ${property.getName()}.`, property.getStartLineNumber()));
      }
    }
  }
};

const propertyLiteralValues = (source: SourceFile, aliasName: string): Map<string, string[]> => {
  const alias = source.getTypeAlias(aliasName);
  const properties = alias?.getDescendantsOfKind(SyntaxKind.PropertySignature) ?? [];
  return new Map(properties.map((property) => [
    property.getName(),
    property.getTypeNode()?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue()).sort() ?? [],
  ]));
};

const inspectSeparatedStatus = (project: Project, findings: InspectorFinding[]): void => {
  const path = "src/lib/local-runtime/workbench-status.ts";
  const status = sourceAt(project, path);
  if (!status) return;
  const expected = new Map<string, string[]>([
    ["shellState", ["ready", "stopped"]],
    ["cloudState", ["contract_blocked", "ready", "stopped", "transient_degraded"]],
    ["browserState", ["blocked", "ready"]],
    ["browserTargetState", ["absent", "claimed"]],
    ["executionState", ["blocked", "draining", "ready"]],
    ["claimAdmissionState", ["blocked", "draining", "eligible"]],
  ]);
  const actual = propertyLiteralValues(status, "AiProductionHealthSnapshot");
  for (const [name, values] of expected) {
    if (JSON.stringify(actual.get(name)) !== JSON.stringify(values)) {
      findings.push(finding(LAW_STATUS, path, `${name} must remain an independently typed status dimension.`));
    }
  }
  const declarations = status.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
  const startup = declarations.find((declaration) => declaration.getName() === "startupComponents");
  const allOk = declarations.find((declaration) => declaration.getName() === "allOk");
  const sliceCalls = startup?.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
    const argumentsList = call.getArguments();
    return propertyCallName(call) === "slice"
      && argumentsList.length === 2
      && Node.isNumericLiteral(argumentsList[0]) && argumentsList[0].getLiteralValue() === 0
      && Node.isNumericLiteral(argumentsList[1]) && argumentsList[1].getLiteralValue() === 2;
  }) ?? [];
  const allOkReceivers = allOk?.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText()) ?? [];
  if (sliceCalls.length !== 1 || !allOkReceivers.includes("startupComponents")) {
    findings.push(finding(LAW_STATUS, path, "Shell health aggregation must exclude Browser, Target, execution and claim admission readiness."));
  }

  const ownerPath = "src/plugins/xuanxue-ai-production/xuanxue-ai-production.workbench-owner.ts";
  const owner = sourceAt(project, ownerPath);
  const startupFailure = owner?.getVariableDeclaration("startupFailureHealth");
  const assignments = new Map((startupFailure?.getDescendantsOfKind(SyntaxKind.PropertyAssignment) ?? [])
    .map((property) => {
      const initializer = property.getInitializer();
      const value = initializer && (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer))
        ? initializer.getLiteralValue() : null;
      return [property.getName(), value] as const;
    }));
  if (assignments.get("shellState") !== "ready" || assignments.get("executionState") !== "blocked" || assignments.get("claimAdmissionState") !== "blocked") {
    findings.push(finding(LAW_STATUS, ownerPath, "Cloud/provider startup failure must keep Shell ready while execution and claim admission fail closed."));
  }
};

export const inspectLocalAppShellProject = (
  project: Project,
  targetPaths: readonly string[] = requiredPaths,
  lawId?: string,
): InspectorFinding[] => {
  const findings: InspectorFinding[] = [];
  const requiredForLaw = !lawId
    ? requiredPaths
    : lawId === LAW_SHELL
    ? requiredPaths
    : lawId === LAW_STATUS
      ? requiredPaths.filter((path) => path.includes("workbench-status") || path.includes("workbench-owner"))
      : [];
  for (const path of requiredForLaw) if (targetPaths.includes(path) && !sourceAt(project, path)) {
    findings.push(finding(lawId ?? (path.includes("workbench-status") ? LAW_STATUS : LAW_SHELL), path, "required local shell authority source is missing."));
  }
  if (!lawId || lawId === LAW_SHELL) inspectUniqueServer(project, findings);
  inspectLocalRuntimeBoundary(project, findings, lawId);
  if (!lawId || lawId === LAW_STATUS) inspectSeparatedStatus(project, findings);
  return findings.sort((left, right) => left.lawId.localeCompare(right.lawId) || (left.filePath ?? "").localeCompare(right.filePath ?? "") || left.message.localeCompare(right.message));
};

const evaluate = (context: InspectorContext): InspectorEvaluation => ({
  capabilityDomain: context.planEntry.capabilityDomain,
  reportedLawIds: context.planEntry.lawIds,
  findings: inspectLocalAppShellProject(context.project, context.targetPaths, context.planEntry.lawIds[0]),
  inspectedFiles: [...context.targetPaths],
});

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  return finalizeStaticInspection(context, [
    { lawId: LAW_SHELL, forbiddenCount: 9 },
    { lawId: LAW_BOUNDARY, forbiddenCount: 4 },
    { lawId: LAW_STATUS, forbiddenCount: 3 },
  ], evaluate);
};
