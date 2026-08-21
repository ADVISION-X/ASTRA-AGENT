import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorOutput, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { isPublicCapabilityFacadePath, isPublicPluginFacadePath } from "../../shared/no-regex.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";

type Finding = ReturnType<typeof createFinding>;

const pagePath = "src/app/workbench-home-page.ts";
const clientPath = "src/app/workbench-home-client.ts";
const appShellPath = "src/app/app-shell/app-shell.ts";
const appShellLayoutPath = "src/app/app-shell/app-shell-layout.ts";
const appShellAmazonInvoiceWorkspacePath = "src/app/app-shell/amazon-invoice-workspace.ts";
const appShellSidebarPath = "src/app/app-shell/sidebar.ts";
const appShellCommandBarPath = "src/app/app-shell/command-bar.ts";
const appShellInspectorPath = "src/app/app-shell/inspector.ts";
const appShellRuntimeConsolePath = "src/app/app-shell/runtime-console.ts";
const stylesPath = "src/app/workbench-home-styles.ts";
const serverPath = "src/app/create-workbench-server.ts";
const browserChannelClientPath = "src/app/workbench-browser-extension-channel-client.ts";
const browserChannelRoutesPath = "src/app/workbench-browser-extension-channel-routes.ts";
const inspectorPath = "scripts/audit/domains/local-app-shell/inspector.ts";

const appShellSurfacePaths = [
  pagePath,
  appShellPath,
  appShellLayoutPath,
  appShellAmazonInvoiceWorkspacePath,
  appShellSidebarPath,
  appShellCommandBarPath,
  appShellInspectorPath,
  appShellRuntimeConsolePath,
] as const;

const getSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const identifierSymbolName = (node: Node): string | undefined => Node.isIdentifier(node) ? node.getSymbol()?.getEscapedName().toString() : undefined;
const propertyAccessPath = (node: Node): readonly string[] | undefined => {
  if (Node.isIdentifier(node)) return [node.getSymbol()?.getEscapedName().toString() ?? node.getText()];
  if (!Node.isPropertyAccessExpression(node)) return undefined;
  const prefix = propertyAccessPath(node.getExpression());
  return prefix === undefined ? undefined : [...prefix, node.getName()];
};
const callCount = (source: SourceFile, expectedPath: readonly string[]): number => source.getDescendantsOfKind(SyntaxKind.CallExpression)
  .filter((call) => propertyAccessPath(call.getExpression())?.join(".") === expectedPath.join(".")).length;
const callName = (call: Node): string | undefined => {
  if (!Node.isCallExpression(call)) return undefined;
  const path = propertyAccessPath(call.getExpression());
  return path?.[path.length - 1] ?? identifierSymbolName(call.getExpression());
};
const literalValues = (source: SourceFile): readonly string[] => source.getDescendants().flatMap((node) => {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return [node.getLiteralValue()];
  return [];
});

const semanticSourceTokens = (context: InspectorContext, repoPath: string): string[] => {
  const source = getSourceFile(context, repoPath);
  if (!source) return [];
  return source.getDescendants().flatMap((node) => {
    if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
      return [node.getLiteralValue()];
    }
    if (Node.isTemplateHead(node) || Node.isTemplateMiddle(node) || Node.isTemplateTail(node)) {
      return [node.getLiteralText()];
    }
    if (Node.isPropertyAccessExpression(node)) return [node.getName()];
    if (Node.isIdentifier(node)) {
      const name = node.getSymbol()?.getEscapedName().toString();
      return name ? [name] : [];
    }
    return [];
  });
};

const semanticSurface = (context: InspectorContext, paths: readonly string[]): string =>
  paths.flatMap((repoPath) => semanticSourceTokens(context, repoPath)).join("\n");

const pushFinding = (
  findings: Finding[],
  input: {
    checkId: string;
    lawId: string;
    filePath: string;
    message: string;
    evidence?: string | undefined;
  },
): void => {
  findings.push(createFinding(input));
};

const requireMarker = (input: {
  findings: Finding[];
  lawId: string;
  filePath: string;
  text: string;
  marker: string;
  checkId: string;
}): void => {
  if (input.text.includes(input.marker)) {
    return;
  }
  pushFinding(input.findings, {
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.filePath,
    message: `${input.filePath} is missing ${input.marker}.`,
  });
};

const inspectRootSurface = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const pageText = semanticSurface(context, appShellSurfacePaths);
  const clientText = semanticSurface(context, [clientPath]);
  requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker: "data-workbench-shell", checkId: "local-app-shell/root-shell" });
  requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker: "data-job-flow-list", checkId: "local-app-shell/job-list" });
  requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker: "data-health-status", checkId: "local-app-shell/health-status" });
  requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker: "data-mode-status", checkId: "local-app-shell/mode-status" });
  requireMarker({ findings, lawId, filePath: clientPath, text: clientText, marker: "/api/health", checkId: "local-app-shell/health-api" });
  requireMarker({ findings, lawId, filePath: clientPath, text: clientText, marker: "/api/mode", checkId: "local-app-shell/mode-api" });
};

const inspectJobInputs = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const pageText = semanticSurface(context, appShellSurfacePaths);
  const requiredAmazonFields = [
    "marketplace",
    "sellerCentralEntryUrl",
    "amazonOrderId",
    "invoiceNo",
    "invoicePdf",
  ];
  for (const fieldName of requiredAmazonFields) {
    requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker: fieldName, checkId: "local-app-shell/amazon-input" });
  }
};

const inspectStatusWindow = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const pageText = semanticSurface(context, appShellSurfacePaths);
  for (const marker of ["data-task-status-panel", "data-task-reason", "data-evidence-ref", "data-raw-result"]) {
    requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker, checkId: "local-app-shell/status-window" });
  }
};

const inspectForbiddenPageTerms = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const pageText = semanticSurface(context, [...appShellSurfacePaths, clientPath, stylesPath]);
  const forbiddenMarkers = [
    "universal mission dashboard",
    "commander console",
    "visual runtime control",
    "next-action",
    "next action",
    "action plan",
    "data-browser-control",
    "data-dom-control",
  ] as const;
  const matchedMarker = forbiddenMarkers.find((marker) => pageText.toLowerCase().includes(marker));
  if (!matchedMarker) {
    return;
  }
  pushFinding(findings, {
    checkId: "local-app-shell/forbidden-dashboard",
    lawId,
    filePath: pagePath,
    message: "Local app shell contains forbidden dashboard, planner, or control surface.",
    evidence: matchedMarker,
  });
};

const inspectWorkbenchExtensionPageChannel = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const client = getSourceFile(context, browserChannelClientPath);
  const routes = getSourceFile(context, browserChannelRoutesPath);
  if (!client || !routes) {
    pushFinding(findings, {
      checkId: "local-app-shell/workbench-extension-channel",
      lawId,
      filePath: !client ? browserChannelClientPath : browserChannelRoutesPath,
      message: "The one Workbench extension page client and its route facade must both exist.",
    });
    return;
  }

  const clientSymbols = new Set(semanticSourceTokens(context, browserChannelClientPath));
  for (const symbol of ["WORKBENCH_EXTENSION_CHANNEL_PORT_NAME", "GRASSEYE_BROWSER_EXTENSION_ID", "pageSessionGrant"]) {
    if (!clientSymbols.has(symbol)) {
      pushFinding(findings, {
        checkId: "local-app-shell/workbench-extension-channel",
        lawId,
        filePath: browserChannelClientPath,
        message: `Workbench extension page client must bind ${symbol}.`,
      });
    }
  }

  const script = client.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)
    .find((literal) => literal.getLiteralValue().includes("openWorkbenchExtensionChannel"));
  const pageClient = script
    ? context.project.createSourceFile("/virtual/workbench-browser-extension-channel-client.js", script.getLiteralValue(), { overwrite: true })
    : undefined;
  const clientConnects = pageClient ? callCount(pageClient, ["runtime", "connect"]) : 0;
  if (clientConnects !== 1) {
    pushFinding(findings, {
      checkId: "local-app-shell/workbench-extension-channel",
      lawId,
      filePath: browserChannelClientPath,
      message: "Only the root Workbench page client may call runtime.connect, exactly once.",
    });
  }

  const expectedRoutes = [
    "/api/browser-extension-channel/open",
    "/api/browser-extension-channel/inbound",
    "/api/browser-extension-channel/next",
  ] as const;
  const browserChannelRoutes = literalValues(routes)
    .filter((value) => value.startsWith("/api/browser-extension-channel/"));
  const routeSet = new Set(browserChannelRoutes);
  if (browserChannelRoutes.length !== expectedRoutes.length || expectedRoutes.some((route) => !routeSet.has(route))) {
    pushFinding(findings, {
      checkId: "local-app-shell/workbench-extension-channel",
      lawId,
      filePath: browserChannelRoutesPath,
      message: "Workbench extension route registration must be exactly open, inbound, and next; a fourth route is forbidden.",
    });
  }

  const routeSymbols = new Set(semanticSourceTokens(context, browserChannelRoutesPath));
  for (const symbol of ["handleWorkbenchBrowserExtensionChannelRequest", "workbenchBrowserExtensionChannel"]) {
    if (!routeSymbols.has(symbol)) {
      pushFinding(findings, {
        checkId: "local-app-shell/workbench-extension-channel",
        lawId,
        filePath: browserChannelRoutesPath,
        message: `Workbench extension route facade must call only ${symbol}.`,
      });
    }
  }

  const handler = routes.getFunctions().find((candidate) => candidate.getName() === "handleWorkbenchBrowserExtensionChannelRequest");
  const facadeCalls = handler?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => callName(call) === "workbenchBrowserExtensionChannel") ?? [];
  if (!handler || facadeCalls.length !== 1) {
    pushFinding(findings, {
      checkId: "local-app-shell/workbench-extension-channel",
      lawId,
      filePath: browserChannelRoutesPath,
      message: "The one Browser-channel route handler must make exactly one Workbench Handle workbenchBrowserExtensionChannel call.",
    });
  }

  const privateBrowserImport = routes.getImportDeclarations().find((declaration) => {
    const target = declaration.getModuleSpecifierSourceFile();
    return target !== undefined && getRepoSourcePath(target).startsWith("src/lib/browser/");
  });
  if (privateBrowserImport) {
    pushFinding(findings, {
      checkId: "local-app-shell/workbench-extension-channel-boundary",
      lawId,
      filePath: browserChannelRoutesPath,
      message: "Workbench extension routes must not import Browser runtime directly; they use the Workbench Handle facade.",
      evidence: privateBrowserImport.getModuleSpecifierValue(),
    });
  }

  const forbiddenSymbols = ["connectNative", "debugger", "executeCommand", "selector", "target", "permit", "actionPlan", "nextAction"];
  for (const source of [client, routes]) {
    const symbols = new Set(semanticSourceTokens(context, getRepoSourcePath(source)));
    const forbidden = forbiddenSymbols.find((symbol) => symbols.has(symbol));
    if (forbidden) {
      pushFinding(findings, {
        checkId: "local-app-shell/workbench-extension-channel-boundary",
        lawId,
        filePath: getRepoSourcePath(source),
        message: "Workbench extension page channel must not own browser actions, command data, or business flow.",
        evidence: forbidden,
      });
    }
  }
};

const inspectAppImports = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!repoPath.startsWith("src/app/")) {
      continue;
    }
    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const target = importDeclaration.getModuleSpecifierSourceFile();
      if (!target) {
        continue;
      }
      const targetPath = getRepoSourcePath(target);
      if (!targetPath.startsWith("src/plugins/") && !targetPath.startsWith("src/capabilities/")) {
        continue;
      }
      pushFinding(findings, {
        checkId: "local-app-shell/private-owner-import",
        lawId,
        filePath: repoPath,
        message: `${repoPath} imports job or ability owner code directly.`,
        evidence: targetPath,
      });
    }
  }
};

const inspectLocalRuntimeImports = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!repoPath.startsWith("src/lib/local-runtime/")) {
      continue;
    }
    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const target = importDeclaration.getModuleSpecifierSourceFile();
      if (!target) {
        continue;
      }
      const targetPath = getRepoSourcePath(target);
      if (targetPath.startsWith("src/plugins/") && !isPublicPluginFacadePath(targetPath)) {
        pushFinding(findings, {
          checkId: "local-app-shell/private-plugin-import",
          lawId,
          filePath: repoPath,
          message: `${repoPath} imports plugin-owned code outside the plugin public facade.`,
          evidence: targetPath,
        });
      }
      if (targetPath.startsWith("src/capabilities/") && !isPublicCapabilityFacadePath(targetPath)) {
        pushFinding(findings, {
          checkId: "local-app-shell/private-capability-import",
          lawId,
          filePath: repoPath,
          message: `${repoPath} imports ability-group code outside the public facade.`,
          evidence: targetPath,
        });
      }
    }
  }
};

const inspectAstProjectAccess = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  if (context.project.getSourceFile(resolveFromRepo(inspectorPath))) {
    return;
  }
  pushFinding(findings, {
    checkId: "local-app-shell/inspector-ast-project",
    lawId,
    filePath: inspectorPath,
    message: "Local app shell inspector must be visible to the audit ts-morph project.",
  });
};



const inspectDomainEvaluation = async (context: InspectorContext): Promise<Omit<InspectorOutput, "executedChecks">> => {
  const surfaceLawId = selectLawId(context.planEntry.lawIds, "APEX-LOCAL-APP-SHELL-001-V1");
  const inputLawId = selectLawId(context.planEntry.lawIds, "APEX-LOCAL-APP-SHELL-002-V1");
  const statusLawId = selectLawId(context.planEntry.lawIds, "APEX-LOCAL-APP-SHELL-003-V1");
  const boundaryLawId = selectLawId(context.planEntry.lawIds, "APEX-LOCAL-APP-SHELL-004-V1");
  const browserChannelLawId = selectLawId(context.planEntry.lawIds, "APEX-LOCAL-APP-SHELL-006-V1");
  const findings: Finding[] = [];
  const inspectedFiles = new Set<string>([
    pagePath,
    clientPath,
    appShellPath,
    appShellLayoutPath,
    appShellAmazonInvoiceWorkspacePath,
    appShellSidebarPath,
    appShellCommandBarPath,
    appShellInspectorPath,
    appShellRuntimeConsolePath,
    stylesPath,
    serverPath,
    browserChannelClientPath,
    browserChannelRoutesPath,
    inspectorPath,
  ]);

  inspectAstProjectAccess(context, findings, boundaryLawId);
  inspectRootSurface(context, findings, surfaceLawId);
  inspectJobInputs(context, findings, inputLawId);
  inspectStatusWindow(context, findings, statusLawId);
  inspectForbiddenPageTerms(context, findings, boundaryLawId);
  inspectAppImports(context, findings, boundaryLawId);
  inspectLocalRuntimeImports(context, findings, boundaryLawId);
  inspectWorkbenchExtensionPageChannel(context, findings, browserChannelLawId);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,

    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("local-app-shell requires a runner-owned check session.");
  let reportJson: unknown;
  let reportMarkdown: string | undefined;
  await context.checks.runAll(async () => {
    const evaluation = await inspectDomainEvaluation(context);
    reportJson = evaluation.reportJson;
    reportMarkdown = evaluation.reportMarkdown;
    return {
      findings: evaluation.findings,
      evidenceRefs: [context.planEntry.ownerInspectorPath, ...evaluation.inspectedFiles],
    };
  });
  return context.checks.output({
    ...(reportJson === undefined ? {} : { reportJson }),
    ...(reportMarkdown === undefined ? {} : { reportMarkdown }),
  });
};
