import { existsSync, readFileSync, readdirSync } from "node:fs";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorOutput, executedChecksForPlan } from "../../shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";

type Finding = ReturnType<typeof createFinding>;

const launchPath = "scripts/startup/launch-grasseye.mjs";
const logPath = "scripts/startup/lib/terminal-structured-log.mjs";
const helperPath = "scripts/startup/lib/startup-log-helpers.mjs";
const readinessPath = "scripts/startup/lib/service-readiness.mjs";
const processControlPath = "scripts/startup/lib/process-control.mjs";
const portListenerPath = "scripts/startup/lib/port-listener-ops.mjs";
const sourceFingerprintPath = "scripts/startup/lib/source-fingerprint.mjs";
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

const sourceAstTokens = (sourceFile: SourceFile): string[] => [
  ...sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).map((node) => node.getName()),
];

const inspectForbiddenStartupSurface = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
  startupFiles: readonly string[],
): void => {
  const forbiddenMarkers = [
    "startup-registry-readiness",
    "registry_readiness",
    "GRASSEYE_STARTUP_ONLINE_AI_READINESS_JSON",
    "GRASSEYE_STARTUP_LOCAL_AI_READINESS_JSON",
    "MISSION_READINESS",
    "mission_runtime",
    "ci:full",
    "codex:entry-gate",
    "typecheck",
    "acceptance:",
    "amazon-invoice-upload.flow",
    "facebook-product-video-mining.flow",
    "dom-automation",
  ] as const;

  for (const filePath of startupFiles) {
    const sourceFile = getProjectSource(context, filePath);
    if (!sourceFile) continue;
    const tokens = sourceAstTokens(sourceFile).map((token) => token.toLocaleLowerCase());
    const matchedMarker = forbiddenMarkers.find((marker) =>
      tokens.some((token) => token.includes(marker.toLocaleLowerCase())));
    if (!matchedMarker) {
      continue;
    }
    pushFinding(findings, {
      lawId,
      checkId: "startup/forbidden-surface",
      filePath,
      message: "Startup contains forbidden job, AI, CI, registry, DOM, or ability surface.",
      evidence: matchedMarker,
    });
  }
};

const inspectReadinessProbe = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const launchSource = getProjectSource(context, launchPath);
  if (!launchSource || !hasApiHealthProbe(launchSource)) {
    pushFinding(findings, {
      lawId,
      checkId: "startup/health-probe",
      filePath: launchPath,
      message: "Startup must probe /api/health for readiness.",
    });
  }
  const probesRootHtml = launchSource?.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    const firstArgument = callExpression.getArguments()[0];
    return Node.isIdentifier(expression)
      && expression.getText() === "fetch"
      && Boolean(firstArgument && Node.isIdentifier(firstArgument) && firstArgument.getText() === "baseUrl");
  }) ?? false;
  if (probesRootHtml) {
    pushFinding(findings, {
      lawId,
      checkId: "startup/homepage-probe",
      filePath: launchPath,
      message: "Startup must not use root HTML as the primary readiness probe.",
    });
  }
};

const inspectStructuredReport = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const terminalLogSource = getProjectSource(context, logPath);
  const helperSource = getProjectSource(context, helperPath);
  const astTokens = [terminalLogSource, helperSource].flatMap((sourceFile) =>
    sourceFile ? sourceAstTokens(sourceFile) : []);
  const requiredFields = ["phase", "component", "eventType", "status", "message", "refs", "durationMs", "failureReason"];
  const missingFields = requiredFields.filter((field) => !astTokens.includes(field));
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

const collectHotMountOrderMetrics = (launchSource: SourceFile) => {
  const hotProbeStart = callStartInFunction(launchSource, "preparePort", "probeExistingWorkbench");
  const clearStart = callStartInFunction(launchSource, "preparePort", "clearWorkbenchPort");
  const startServiceStart = callStartInFunction(launchSource, "performLaunch", "startService");
  const preparePortStart = callStartInFunction(launchSource, "performLaunch", "preparePort");
  return {
    hasHotMountedBranch: hasHotMountedReturnBranch(launchSource),
    probesBeforeClear: hotProbeStart !== undefined && clearStart !== undefined && hotProbeStart < clearStart,
    preparesBeforeStart: preparePortStart !== undefined && startServiceStart !== undefined && preparePortStart < startServiceStart,
  };
};

const hasStringLiteral = (sourceFile: SourceFile, value: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .some((literal) => literal.getLiteralValue() === value);

const hasIdentifier = (sourceFile: SourceFile, value: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => identifier.getText() === value);

const hasObjectPropertyName = (sourceFile: SourceFile, value: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .some((property) => property.getName() === value);

const collectHotMountFreshnessMetrics = (
  launchSource: SourceFile,
  readinessSource: SourceFile,
  sourceFingerprintSource: SourceFile,
) => ({
  importsFingerprint: hasNamedImport(launchSource, "source-fingerprint", "buildStartupSourceFingerprint"),
  computesFingerprint: hasCall(launchSource, "buildStartupSourceFingerprint"),
  passesFingerprintEnv: hasObjectPropertyName(launchSource, "GRASSEYE_SOURCE_FINGERPRINT"),
  checksHealthFingerprint: hasIdentifier(readinessSource, "expectedSourceFingerprint")
    && hasIdentifier(readinessSource, "sourceFingerprint"),
  sourceUsesSha256: hasStringLiteral(sourceFingerprintSource, "sha256"),
});

const collectHotMountHealthMetrics = (readinessSource: SourceFile) => {
  const responseJsonCall = readinessSource
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((callExpression) => {
      const expression = callExpression.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === "json";
    });
  return {
    healthLiteral: hasApiHealthProbe(readinessSource),
    realFetchCall: hasCall(readinessSource, "fetch"),
    jsonValidationCall: hasCall(readinessSource, "isWorkbenchHealthReport"),
    responseJsonCall,
  };
};

const readObjectBindingDefaultNumber = (
  sourceFile: SourceFile,
  functionName: string,
  bindingName: string,
): number | null => {
  const parameterNameNode = sourceFile.getFunction(functionName)?.getParameters()[0]?.getNameNode();
  if (!parameterNameNode || !Node.isObjectBindingPattern(parameterNameNode)) {
    return null;
  }
  for (const element of parameterNameNode.getElements()) {
    if (element.getName() !== bindingName) {
      continue;
    }
    const initializer = element.getInitializer();
    if (!initializer || !Node.isNumericLiteral(initializer)) {
      return null;
    }
    return Number(initializer.getLiteralValue());
  }
  return null;
};

const inspectColdStartHealthBudget = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const readinessSource = getProjectSource(context, readinessPath);
  if (!readinessSource) {
    pushFinding(findings, {
      lawId,
      checkId: "startup/cold-start-health-budget-source",
      filePath: readinessPath,
      message: "Startup readiness source must be visible to the audit ts-morph project.",
    });
    return;
  }

  const attempts = readObjectBindingDefaultNumber(readinessSource, "waitForWorkbenchHealth", "attempts");
  const delayMs = readObjectBindingDefaultNumber(readinessSource, "waitForWorkbenchHealth", "delayMs");
  const budgetMs = attempts === null || delayMs === null ? null : attempts * delayMs;
  process.stdout.write(
    `[AUDIT][startup-entrypoint][cold-start-budget] attempts=${String(attempts ?? "missing")} delayMs=${String(delayMs ?? "missing")} budgetMs=${String(budgetMs ?? "missing")}\n`,
  );

  if (budgetMs === null || budgetMs < 60_000 || delayMs === null || delayMs < 250 || delayMs > 1_000) {
    pushFinding(findings, {
      lawId,
      checkId: "startup/cold-start-health-budget",
      filePath: readinessPath,
      message: "Started-service /api/health readiness must keep a production cold-start budget of at least 60000ms with a 250-1000ms poll interval.",
      evidence: JSON.stringify({ attempts, delayMs, budgetMs }),
    });
  }
};

const collectHotMountStabilityMetrics = (launchSource: SourceFile) => ({
  verifiesTransientHotMount: launchSource.getFunction("verifyHotMountedWorkbenchStability") !== undefined,
  usesSharedPortClearAfterTransientHotMount: launchSource.getFunction("clearWorkbenchPort") !== undefined,
  reportsTransientHealth: hasStringLiteral(launchSource, "existing workbench health was transient; port clear may proceed"),
});

const inspectHotMountAst = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const launchSource = getProjectSource(context, launchPath);
  const readinessSource = getProjectSource(context, readinessPath);
  const sourceFingerprintSource = getProjectSource(context, sourceFingerprintPath);
  if (!launchSource || !readinessSource || !sourceFingerprintSource) {
    pushFinding(findings, {
      lawId,
      checkId: "startup/hot-mount-ast-source",
      filePath: launchPath,
      message: "Startup hot-mount sources must be visible to the audit ts-morph project.",
    });
    return;
  }

  const importsHotMount = hasNamedImport(launchSource, "service-readiness", "probeExistingWorkbench");
  const metrics = {
    importsHotMount,
    ...collectHotMountOrderMetrics(launchSource),
    ...collectHotMountHealthMetrics(readinessSource),
    ...collectHotMountFreshnessMetrics(launchSource, readinessSource, sourceFingerprintSource),
    ...collectHotMountStabilityMetrics(launchSource),
  };

  if (Object.values(metrics).some((value) => value === false)) {
    pushFinding(findings, {
      lawId,
      checkId: "startup/hot-mount-before-clear",
      filePath: launchPath,
      message: "Startup must probe /api/health for hot mount before clearing the port, and must reject stale source fingerprints.",
      evidence: JSON.stringify(metrics),
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
  const coldStartBudgetLawId = selectLawId(context.planEntry.lawIds, "APEX-STARTUP-007-V1");
  const inspectedFiles = new Set([packagePath, launchPath, logPath, helperPath, readinessPath, processControlPath, portListenerPath, sourceFingerprintPath, inspectorPath]);
  const startupFiles = listStartupFiles().map((filePath) => toRepoPath(resolveFromRepo(filePath)));
  startupFiles.forEach((filePath) => inspectedFiles.add(filePath));
  const findings: Finding[] = [];

  inspectAstProjectAccess(context, findings, boundaryLawId);
  inspectSingleGate(findings, singleGateLawId);
  inspectForbiddenStartupSurface(context, findings, boundaryLawId, startupFiles);
  inspectReadinessProbe(context, findings, readinessLawId);
  inspectStructuredReport(context, findings, reportLawId);
  inspectRealPortClear(context, findings, portClearLawId);
  inspectHotMountAst(context, findings, hotMountLawId);
  inspectColdStartHealthBudget(context, findings, coldStartBudgetLawId);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
      executedChecks: executedChecksForPlan(context),
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};
