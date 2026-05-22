import { existsSync, readFileSync, readdirSync } from "node:fs";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";

type Finding = ReturnType<typeof createFinding>;

const launchPath = "scripts/startup/launch-grasseye.mjs";
const logPath = "scripts/startup/lib/terminal-structured-log.mjs";
const helperPath = "scripts/startup/lib/startup-log-helpers.mjs";
const readinessPath = "scripts/startup/lib/service-readiness.mjs";
const processControlPath = "scripts/startup/lib/process-control.mjs";
const portListenerPath = "scripts/startup/lib/port-listener-ops.mjs";
const packagePath = "package.json";
const inspectorPath = "scripts/audit/domains/startup-entrypoint/inspector.ts";

const readRepoFile = (repoPath: string): string => readFileSync(resolveFromRepo(repoPath), "utf8");

const listStartupFiles = (relativeDir = "scripts/startup"): string[] =>
  readdirSync(resolveFromRepo(relativeDir), { withFileTypes: true }).flatMap((entry) => {
    const childPath = `${relativeDir}/${entry.name}`;
    return entry.isDirectory() ? listStartupFiles(childPath) : [childPath];
  });

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

const inspectSingleGate = (findings: Finding[], lawId: string): void => {
  const packageJson = JSON.parse(readRepoFile(packagePath)) as { scripts?: Record<string, string> };
  const startupCommand = packageJson.scripts?.["grasseye:start"];
  if (startupCommand !== "node scripts/startup/launch-grasseye.mjs") {
    pushFinding(findings, {
      lawId,
      checkId: "startup/single-command",
      filePath: packagePath,
      message: "grasseye:start must point to scripts/startup/launch-grasseye.mjs.",
      evidence: startupCommand,
    });
  }
  if (!existsSync(resolveFromRepo(launchPath))) {
    pushFinding(findings, {
      lawId,
      checkId: "startup/missing-entrypoint",
      filePath: launchPath,
      message: "Startup entrypoint is missing.",
    });
  }
};

const inspectForbiddenStartupSurface = (findings: Finding[], lawId: string, startupFiles: readonly string[]): void => {
  const forbiddenPatterns = [
    /startup-registry-readiness/iu,
    /registry_readiness/iu,
    /GRASSEYE_STARTUP_(?:ONLINE|LOCAL)_AI_READINESS_JSON/u,
    /MISSION_READINESS/iu,
    /mission_runtime/iu,
    /ci:full|codex:entry-gate|typecheck|acceptance:/u,
    /amazon-invoice-upload\.flow|facebook-product-video-mining\.flow/u,
    /dom-automation/u,
  ] as const;

  for (const filePath of startupFiles) {
    const fileText = readRepoFile(filePath);
    const matchedPattern = forbiddenPatterns.find((pattern) => pattern.test(fileText));
    if (!matchedPattern) {
      continue;
    }
    pushFinding(findings, {
      lawId,
      checkId: "startup/forbidden-surface",
      filePath,
      message: "Startup contains forbidden job, AI, CI, registry, DOM, or ability surface.",
      evidence: String(matchedPattern),
    });
  }
};

const inspectReadinessProbe = (findings: Finding[], lawId: string): void => {
  const launchText = readRepoFile(launchPath);
  if (!launchText.includes("/api/health")) {
    pushFinding(findings, {
      lawId,
      checkId: "startup/health-probe",
      filePath: launchPath,
      message: "Startup must probe /api/health for readiness.",
    });
  }
  if (/fetch\(baseUrl\)/u.test(launchText)) {
    pushFinding(findings, {
      lawId,
      checkId: "startup/homepage-probe",
      filePath: launchPath,
      message: "Startup must not use root HTML as the primary readiness probe.",
    });
  }
};

const inspectStructuredReport = (findings: Finding[], lawId: string): void => {
  const terminalLogText = readRepoFile(logPath);
  const helperText = readRepoFile(helperPath);
  const requiredFields = ["phase", "component", "eventType", "status", "message", "refs", "durationMs", "failureReason"];
  const missingFields = requiredFields.filter((field) => !terminalLogText.includes(field) && !helperText.includes(field));
  if (missingFields.length > 0) {
    pushFinding(findings, {
      lawId,
      checkId: "startup/structured-report-fields",
      filePath: logPath,
      message: "Startup structured terminal report is missing required fields.",
      evidence: missingFields.join(","),
    });
  }
};

const inspectAstProjectAccess = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const inspectorSource = context.project.getSourceFile(resolveFromRepo(inspectorPath));
  if (inspectorSource) {
    return;
  }
  pushFinding(findings, {
    lawId,
    checkId: "startup/inspector-ast-project",
    filePath: inspectorPath,
    message: "Startup inspector must be visible to the audit ts-morph project.",
  });
};

const getProjectSource = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const hasNamedImport = (sourceFile: SourceFile, modulePart: string, importedName: string): boolean =>
  sourceFile.getImportDeclarations().some((declaration) => {
    const moduleSpecifier = declaration.getModuleSpecifierValue();
    return moduleSpecifier.includes(modulePart) && declaration.getNamedImports().some((namedImport) => namedImport.getName() === importedName);
  });

const hasCall = (sourceFile: SourceFile, callName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === callName;
  });

const countCalls = (sourceFile: SourceFile, callName: string): number =>
  sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((callExpression) => {
      const expression = callExpression.getExpression();
      return Node.isIdentifier(expression) && expression.getText() === callName;
    }).length;

const callStartInFunction = (sourceFile: SourceFile, functionName: string, callName: string): number | undefined => {
  const declaration = sourceFile.getFunction(functionName);
  return declaration
    ?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((callExpression) => {
      const expression = callExpression.getExpression();
      return Node.isIdentifier(expression) && expression.getText() === callName;
    })
    ?.getStart();
};

const hasHotMountedReturnBranch = (sourceFile: SourceFile): boolean => {
  const declaration = sourceFile.getFunction("preparePort");
  return declaration?.getDescendantsOfKind(SyntaxKind.IfStatement).some((ifStatement) => {
    const expression = ifStatement.getExpression();
    const checksMounted = Node.isPropertyAccessExpression(expression) && expression.getName() === "mounted";
    const returnsHotMounted = ifStatement.getThenStatement().getDescendantsOfKind(SyntaxKind.ReturnStatement).some((returnStatement) => {
      const returnExpression = returnStatement.getExpression();
      if (!Node.isObjectLiteralExpression(returnExpression)) {
        return false;
      }
      return returnExpression.getProperties().some((property) => {
        if (!Node.isPropertyAssignment(property)) {
          return false;
        }
        const name = property.getName();
        const initializer = property.getInitializer();
        return name === "hotMounted" && initializer?.getKind() === SyntaxKind.TrueKeyword;
      });
    });
    return checksMounted && returnsHotMounted;
  }) ?? false;
};

const templateExpressionHasApiHealthLiteral = (sourceFile: SourceFile): boolean =>
  sourceFile
    .getDescendantsOfKind(SyntaxKind.TemplateExpression)
    .some((templateExpression) => [
      templateExpression.getHead().getLiteralText(),
      ...templateExpression.getTemplateSpans().map((span) => span.getLiteral().getLiteralText()),
    ].some((text) => text.includes("/api/health")));

const hasApiHealthLiteral = (sourceFile: SourceFile): boolean =>
  sourceFile
    .getDescendants()
    .some((node) => {
      if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
        return node.getLiteralText().includes("/api/health");
      }
      return false;
    });

const hasApiHealthProbe = (sourceFile: SourceFile): boolean =>
  hasApiHealthLiteral(sourceFile) || templateExpressionHasApiHealthLiteral(sourceFile);

const inspectRealPortClear = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const processControlSource = getProjectSource(context, processControlPath);
  const portListenerSource = getProjectSource(context, portListenerPath);
  if (!processControlSource || !portListenerSource) {
    pushFinding(findings, {
      lawId,
      checkId: "startup/port-clear-ast-source",
      filePath: processControlPath,
      message: "Startup port clear helpers must be visible to the audit ts-morph project.",
    });
    return;
  }

  const hasListenerDiscovery = hasNamedImport(processControlSource, "port-listener-ops", "getListeningProcessIds");
  const hasTermination = hasNamedImport(processControlSource, "port-listener-ops", "terminateProcess");
  const listenerChecks = countCalls(processControlSource, "getListeningProcessIds");
  const terminationCalls = countCalls(processControlSource, "terminateProcess");
  const killLiteral = processControlSource
    .getDescendantsOfKind(SyntaxKind.StringLiteral)
    .some((literal) => literal.getLiteralValue() === "SIGKILL");
  if (!hasListenerDiscovery || !hasTermination || listenerChecks < 3 || terminationCalls < 1 || !killLiteral) {
    pushFinding(findings, {
      lawId,
      checkId: "startup/port-clear-real-path",
      filePath: processControlPath,
      message: "Port clear must discover listeners, terminate them, and re-check after graceful and forceful cleanup.",
      evidence: JSON.stringify({ hasListenerDiscovery, hasTermination, listenerChecks, terminationCalls, killLiteral }),
    });
  }

  if (!hasCall(portListenerSource, "execFileAsync") || !hasCall(portListenerSource, "parsePidList")) {
    pushFinding(findings, {
      lawId,
      checkId: "startup/port-listener-discovery",
      filePath: portListenerPath,
      message: "Port listener discovery must execute a real OS listener query and parse PIDs.",
    });
  }
};

const inspectHotMountAst = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const launchSource = getProjectSource(context, launchPath);
  const readinessSource = getProjectSource(context, readinessPath);
  if (!launchSource || !readinessSource) {
    pushFinding(findings, {
      lawId,
      checkId: "startup/hot-mount-ast-source",
      filePath: launchPath,
      message: "Startup hot-mount sources must be visible to the audit ts-morph project.",
    });
    return;
  }

  const importsHotMount = hasNamedImport(launchSource, "service-readiness", "probeExistingWorkbench");
  const hotProbeStart = callStartInFunction(launchSource, "preparePort", "probeExistingWorkbench");
  const clearStart = callStartInFunction(launchSource, "preparePort", "clearPortListeners");
  const startServiceStart = callStartInFunction(launchSource, "performLaunch", "startService");
  const preparePortStart = callStartInFunction(launchSource, "performLaunch", "preparePort");
  const hasHotMountedBranch = hasHotMountedReturnBranch(launchSource);
  const probesBeforeClear = hotProbeStart !== undefined && clearStart !== undefined && hotProbeStart < clearStart;
  const preparesBeforeStart = preparePortStart !== undefined && startServiceStart !== undefined && preparePortStart < startServiceStart;
  const healthLiteral = hasApiHealthProbe(readinessSource);
  const realFetchCall = hasCall(readinessSource, "fetch");
  const jsonValidationCall = hasCall(readinessSource, "isWorkbenchHealthReport");
  const responseJsonCall = readinessSource
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((callExpression) => {
      const expression = callExpression.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === "json";
    });

  if (!importsHotMount || !hasHotMountedBranch || !probesBeforeClear || !preparesBeforeStart || !healthLiteral || !realFetchCall || !responseJsonCall || !jsonValidationCall) {
    pushFinding(findings, {
      lawId,
      checkId: "startup/hot-mount-before-clear",
      filePath: launchPath,
      message: "Startup must probe /api/health for hot mount before clearing the port or starting a duplicate server.",
      evidence: JSON.stringify({ importsHotMount, hasHotMountedBranch, probesBeforeClear, preparesBeforeStart, healthLiteral, realFetchCall, responseJsonCall, jsonValidationCall }),
    });
  }
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const singleGateLawId = selectLawId(context.planEntry.lawIds, "APEX-STARTUP-001-V1");
  const boundaryLawId = selectLawId(context.planEntry.lawIds, "APEX-STARTUP-002-V1");
  const readinessLawId = selectLawId(context.planEntry.lawIds, "APEX-STARTUP-003-V1");
  const reportLawId = selectLawId(context.planEntry.lawIds, "APEX-STARTUP-004-V1");
  const portClearLawId = selectLawId(context.planEntry.lawIds, "APEX-STARTUP-005-V1");
  const hotMountLawId = selectLawId(context.planEntry.lawIds, "APEX-STARTUP-006-V1");
  const inspectedFiles = new Set([packagePath, launchPath, logPath, helperPath, readinessPath, processControlPath, portListenerPath, inspectorPath]);
  const startupFiles = listStartupFiles().map((filePath) => toRepoPath(resolveFromRepo(filePath)));
  startupFiles.forEach((filePath) => inspectedFiles.add(filePath));
  const findings: Finding[] = [];

  inspectAstProjectAccess(context, findings, boundaryLawId);
  inspectSingleGate(findings, singleGateLawId);
  inspectForbiddenStartupSurface(findings, boundaryLawId, startupFiles);
  inspectReadinessProbe(findings, readinessLawId);
  inspectStructuredReport(findings, reportLawId);
  inspectRealPortClear(context, findings, portClearLawId);
  inspectHotMountAst(context, findings, hotMountLawId);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};
