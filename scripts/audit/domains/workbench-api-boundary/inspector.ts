import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Node,
  Project,
  SyntaxKind,
  type ArrayLiteralExpression,
  type CallExpression,
  type ObjectLiteralExpression,
  type SourceFile,
} from "ts-morph";

import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { loadGeneratedAuditPlan } from "../../core/load-audit-plan.js";
import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { createAuditProject } from "../../shared/project.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";
import { inspectExternalIngressIdentity } from "./external-ingress-identity-inspector.js";

type Summary = {
  wildcardCorsViolations: number;
  guardMissingViolations: number;
  ingressIdentityViolations: number;
  unauthenticatedExternalRouteViolations: number;
  broadExternalRouteViolations: number;
  secondServerViolations: number;
  callbackEscapeViolations: number;
  forbiddenKeyViolations: number;
  regexViolations: number;
};

const domain = "workbench-api-boundary";
const boundaryPath = "src/app/workbench-api-boundary.ts";
const serverPath = "src/app/create-workbench-server.ts";
const httpPath = "src/app/workbench-http.ts";
const selfPath = "scripts/audit/domains/workbench-api-boundary/inspector.ts";
const lawPath = ".github/instructions/agent-rules/modules/module-workbench-api-boundary.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye_Workbench_API_Boundary_施工图.md";

const requiredForbiddenKeys = [
  "selector",
  "selectors",
  "coordinate",
  "coordinates",
  "x",
  "y",
  "browserCommand",
  "nextAction",
  "actionPlan",
  "flowStep",
  "documentId",
  "downloadUrl",
  "abilityGroupId",
  "childCapabilityId",
  "capabilityCallId",
  "evidenceRefOverride",
  "cookie",
  "sellerCentralCookie",
  "browserProfileDirectory",
] as const;

const initialSummary = (): Summary => ({
  wildcardCorsViolations: 0,
  guardMissingViolations: 0,
  ingressIdentityViolations: 0,
  unauthenticatedExternalRouteViolations: 0,
  broadExternalRouteViolations: 0,
  secondServerViolations: 0,
  callbackEscapeViolations: 0,
  forbiddenKeyViolations: 0,
  regexViolations: 0,
});

const addFinding = (
  findings: InspectorFinding[],
  input: {
    checkId: string;
    filePath: string;
    lawId: string;
    message: string;
  },
): void => {
  findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.filePath,
    message: input.message,
  }));
};

const source = (project: Project, repoPath: string): SourceFile | null =>
  project.getSourceFile(resolveFromRepo(repoPath)) ?? null;

const propertyName = (property: Node): string | null => {
  if (!Node.isPropertyAssignment(property)) return null;
  const nameNode = property.getNameNode();
  if (Node.isStringLiteral(nameNode)) {
    return nameNode.getLiteralText();
  }
  if (Node.isIdentifier(nameNode)) {
    return nameNode.getText();
  }
  return property.getName();
};

const property = (objectLiteral: ObjectLiteralExpression, name: string) =>
  objectLiteral.getProperties().find((item) => propertyName(item) === name);

const literalText = (objectLiteral: ObjectLiteralExpression, name: string): string | null => {
  const item = property(objectLiteral, name);
  if (!item || !Node.isPropertyAssignment(item)) return null;
  const initializer = item.getInitializer();
  return initializer && (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer))
    ? initializer.getLiteralText()
    : null;
};

const booleanLiteral = (objectLiteral: ObjectLiteralExpression, name: string): boolean | null => {
  const item = property(objectLiteral, name);
  if (!item || !Node.isPropertyAssignment(item)) return null;
  const initializer = item.getInitializer();
  if (!initializer) return null;
  if (initializer.getKind() === SyntaxKind.TrueKeyword) return true;
  if (initializer.getKind() === SyntaxKind.FalseKeyword) return false;
  return null;
};

const exportedArray = (file: SourceFile, name: string): ArrayLiteralExpression | null => {
  const declarations = file.getExportedDeclarations().get(name) ?? [];
  const declaration = declarations.find(Node.isVariableDeclaration);
  const initializer = declaration?.getInitializer();
  if (!initializer) return null;
  if (Node.isArrayLiteralExpression(initializer)) return initializer;
  if (Node.isAsExpression(initializer)) {
    const expression = initializer.getExpression();
    return Node.isArrayLiteralExpression(expression) ? expression : null;
  }
  return null;
};

const inspectWildcardCors = (
  file: SourceFile,
  findings: InspectorFinding[],
  summary: Summary,
  lawId: string,
): void => {
  for (const objectLiteral of file.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
    if (literalText(objectLiteral, "access-control-allow-origin") === "*") {
      summary.wildcardCorsViolations += 1;
      addFinding(findings, {
        checkId: "workbench-api-boundary/no-wildcard-cors",
        lawId,
        filePath: httpPath,
        message: "workbench-http.ts must not set wildcard CORS.",
      });
    }
  }
};

const inspectServerGuardImport = (
  file: SourceFile,
  findings: InspectorFinding[],
  summary: Summary,
  lawId: string,
): void => {
  const hasImport = file.getImportDeclarations().some((item) =>
    item.getModuleSpecifierValue() === "./workbench-api-boundary.js"
    && item.getNamedImports().some((named) => named.getName() === "handleWorkbenchApiBoundary"));
  if (!hasImport) {
    summary.guardMissingViolations += 1;
    addFinding(findings, {
      checkId: "workbench-api-boundary/guard-import",
      lawId,
      filePath: serverPath,
      message: "create-workbench-server.ts must import handleWorkbenchApiBoundary.",
    });
  }
};

const statementIndexContainingCall = (file: SourceFile, functionName: string): number | null => {
  const handleRequest = file.getFunction("handleRequest");
  const body = handleRequest?.getBodyOrThrow().asKindOrThrow(SyntaxKind.Block);
  const statements = body?.getStatements() ?? [];
  const index = statements.findIndex((statement) =>
    statement.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
      const expression = call.getExpression();
      return Node.isIdentifier(expression) && expression.getText() === functionName;
    }));
  return index >= 0 ? index : null;
};

const inspectGuardBeforeDispatch = (
  file: SourceFile,
  findings: InspectorFinding[],
  summary: Summary,
  lawId: string,
): void => {
  const guardIndex = statementIndexContainingCall(file, "handleWorkbenchApiBoundary");
  const routeIndex = statementIndexContainingCall(file, "handleKnownWorkbenchApiRequest");
  if (guardIndex === null || routeIndex === null || guardIndex > routeIndex) {
    summary.guardMissingViolations += 1;
    addFinding(findings, {
      checkId: "workbench-api-boundary/guard-before-route-dispatch",
      lawId,
      filePath: serverPath,
      message: "handleWorkbenchApiBoundary must run before handleKnownWorkbenchApiRequest.",
    });
  }
};

const inspectRouteRules = (
  file: SourceFile,
  findings: InspectorFinding[],
  summary: Summary,
  lawIds: { auth: string; route: string },
): void => {
  const rules = exportedArray(file, "WORKBENCH_API_ROUTE_RULES");
  if (!rules) {
    summary.guardMissingViolations += 1;
    addFinding(findings, {
      checkId: "workbench-api-boundary/route-rules-export",
      lawId: lawIds.route,
      filePath: boundaryPath,
      message: "WORKBENCH_API_ROUTE_RULES must be an exported array literal.",
    });
    return;
  }
  for (const element of rules.getElements()) {
    if (!Node.isObjectLiteralExpression(element)) continue;
    const externalAllowed = booleanLiteral(element, "externalApiAllowed");
    if (externalAllowed === true && booleanLiteral(element, "requiresApiKey") !== true) {
      summary.unauthenticatedExternalRouteViolations += 1;
      addFinding(findings, {
        checkId: "workbench-api-boundary/external-route-requires-key",
        lawId: lawIds.auth,
        filePath: boundaryPath,
        message: "Every externalApiAllowed route must require an API key.",
      });
    }
    const pathPattern = literalText(element, "pathPattern");
    const path = literalText(element, "path");
    if (externalAllowed === true && pathPattern === "prefix" && (path === "/api/" || path === "/api")) {
      summary.broadExternalRouteViolations += 1;
      addFinding(findings, {
        checkId: "workbench-api-boundary/no-broad-external-prefix",
        lawId: lawIds.route,
        filePath: boundaryPath,
        message: "External routes must not use a broad /api prefix.",
      });
    }
    if (externalAllowed === true && path === "/api/**") {
      summary.broadExternalRouteViolations += 1;
      addFinding(findings, {
        checkId: "workbench-api-boundary/no-api-glob-route",
        lawId: lawIds.route,
        filePath: boundaryPath,
        message: "External routes must not use /api/**.",
      });
    }
  }
};

const importNamesFromHttp = (file: SourceFile): { createServerNames: Set<string>; namespaceNames: Set<string> } => {
  const createServerNames = new Set<string>();
  const namespaceNames = new Set<string>();
  for (const item of file.getImportDeclarations()) {
    const specifier = item.getModuleSpecifierValue();
    if (specifier !== "node:http" && specifier !== "http") continue;
    for (const named of item.getNamedImports()) {
      if (named.getName() === "createServer") {
        createServerNames.add(named.getAliasNode()?.getText() ?? named.getName());
      }
    }
    const namespaceImport = item.getNamespaceImport();
    if (namespaceImport) {
      namespaceNames.add(namespaceImport.getText());
    }
  }
  return { createServerNames, namespaceNames };
};

const isHttpCreateServerCall = (call: CallExpression, names: { createServerNames: Set<string>; namespaceNames: Set<string> }): boolean => {
  const expression = call.getExpression();
  if (Node.isIdentifier(expression) && names.createServerNames.has(expression.getText())) {
    return true;
  }
  if (Node.isPropertyAccessExpression(expression) && expression.getName() === "createServer") {
    const left = expression.getExpression();
    return Node.isIdentifier(left) && names.namespaceNames.has(left.getText());
  }
  return false;
};

const inspectSecondServers = (
  project: Project,
  findings: InspectorFinding[],
  summary: Summary,
  lawId: string,
): void => {
  for (const file of project.getSourceFiles()) {
    const repoPath = toRepoPath(file.getFilePath());
    if (!repoPath.startsWith("src/plugins/") && !repoPath.startsWith("src/capabilities/")) continue;
    const names = importNamesFromHttp(file);
    for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (isHttpCreateServerCall(call, names)) {
        summary.secondServerViolations += 1;
        addFinding(findings, {
          checkId: "workbench-api-boundary/no-plugin-capability-http-server",
          lawId,
          filePath: repoPath,
          message: "Plugins and capabilities must not create HTTP servers.",
        });
      }
    }
  }
};

const firstArgumentIsCallbackUrl = (call: CallExpression): boolean => {
  const first = call.getArguments()[0];
  if (!first) return false;
  if (Node.isIdentifier(first)) return first.getText() === "callbackUrl";
  return Node.isPropertyAccessExpression(first) && first.getName() === "callbackUrl";
};

const inspectCallbackEscapes = (
  project: Project,
  findings: InspectorFinding[],
  summary: Summary,
  lawId: string,
): void => {
  for (const file of project.getSourceFiles()) {
    const repoPath = toRepoPath(file.getFilePath());
    if (!repoPath.startsWith("src/plugins/")) continue;
    for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expression = call.getExpression();
      if (Node.isIdentifier(expression) && expression.getText() === "fetch" && firstArgumentIsCallbackUrl(call)) {
        summary.callbackEscapeViolations += 1;
        addFinding(findings, {
          checkId: "workbench-api-boundary/no-plugin-callback-fetch",
          lawId,
          filePath: repoPath,
          message: "Plugins must not directly fetch callbackUrl.",
        });
      }
    }
  }
};

const inspectForbiddenKeys = (
  file: SourceFile,
  findings: InspectorFinding[],
  summary: Summary,
  lawId: string,
): void => {
  const keys = exportedArray(file, "EXTERNAL_REQUEST_FORBIDDEN_KEYS");
  const actual = new Set(keys?.getElements().filter(Node.isStringLiteral).map((item) => item.getLiteralText()) ?? []);
  for (const key of requiredForbiddenKeys) {
    if (!actual.has(key)) {
      summary.forbiddenKeyViolations += 1;
      addFinding(findings, {
        checkId: "workbench-api-boundary/forbidden-key-missing",
        lawId,
        filePath: boundaryPath,
        message: `EXTERNAL_REQUEST_FORBIDDEN_KEYS must contain ${key}.`,
      });
    }
  }
};

const inspectNoRegex = (
  file: SourceFile,
  findings: InspectorFinding[],
  summary: Summary,
  lawId: string,
): void => {
  const regexLiterals = file.getDescendantsOfKind(SyntaxKind.RegularExpressionLiteral);
  const regexConstructors = file.getDescendantsOfKind(SyntaxKind.NewExpression)
    .filter((item) => {
      const expression = item.getExpression();
      return Node.isIdentifier(expression) && expression.getText() === "RegExp";
    });
  const forbiddenCalls = file.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => {
      const expression = call.getExpression();
      return Node.isPropertyAccessExpression(expression)
        && ["match", "replace", "search"].some((name) => expression.getName() === name);
    });
  const count = regexLiterals.length + regexConstructors.length + forbiddenCalls.length;
  if (count > 0) {
    summary.regexViolations += count;
    addFinding(findings, {
      checkId: "workbench-api-boundary/no-regex-in-inspector",
      lawId,
      filePath: selfPath,
      message: "Workbench API Boundary inspector must not use regex or regex-like source scanning calls.",
    });
  }
};

const inspectRequiredFiles = (
  project: Project,
  findings: InspectorFinding[],
  lawId: string,
): SourceFile[] => {
  const files = [lawPath, blueprintPath, boundaryPath, serverPath, httpPath, selfPath];
  for (const repoPath of files) {
    if (!existsSync(resolveFromRepo(repoPath))) {
      addFinding(findings, {
        checkId: "workbench-api-boundary/required-file",
        lawId,
        filePath: repoPath,
        message: `${repoPath} must exist.`,
      });
    }
  }
  return [boundaryPath, serverPath, httpPath, selfPath]
    .map((repoPath) => source(project, repoPath))
    .filter((item): item is SourceFile => item !== null);
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawIds = {
    ingress: selectLawId(context.planEntry.lawIds, "GRASSEYE-WORKBENCH-API-BOUNDARY-001-V1"),
    cors: selectLawId(context.planEntry.lawIds, "GRASSEYE-WORKBENCH-API-BOUNDARY-002-V1"),
    auth: selectLawId(context.planEntry.lawIds, "GRASSEYE-WORKBENCH-API-BOUNDARY-003-V1"),
    route: selectLawId(context.planEntry.lawIds, "GRASSEYE-WORKBENCH-API-BOUNDARY-004-V1"),
    shape: selectLawId(context.planEntry.lawIds, "GRASSEYE-WORKBENCH-API-BOUNDARY-005-V1"),
    callback: selectLawId(context.planEntry.lawIds, "GRASSEYE-WORKBENCH-API-BOUNDARY-006-V1"),
    audit: selectLawId(context.planEntry.lawIds, "GRASSEYE-WORKBENCH-API-BOUNDARY-008-V1"),
  };
  const findings: InspectorFinding[] = [];
  const summary = initialSummary();
  const requiredFiles = inspectRequiredFiles(context.project, findings, lawIds.ingress);
  const inspectedFiles = new Set<string>([lawPath, blueprintPath, ...requiredFiles.map((file) => toRepoPath(file.getFilePath()))]);
  const boundaryFile = source(context.project, boundaryPath);
  const serverFile = source(context.project, serverPath);
  const httpFile = source(context.project, httpPath);
  const selfFile = source(context.project, selfPath);

  if (httpFile) inspectWildcardCors(httpFile, findings, summary, lawIds.cors);
  if (serverFile) {
    inspectServerGuardImport(serverFile, findings, summary, lawIds.ingress);
    inspectGuardBeforeDispatch(serverFile, findings, summary, lawIds.ingress);
  }
  if (boundaryFile) {
    inspectRouteRules(boundaryFile, findings, summary, lawIds);
    inspectForbiddenKeys(boundaryFile, findings, summary, lawIds.shape);
    inspectExternalIngressIdentity({ boundaryPath, file: boundaryFile, findings, lawId: lawIds.ingress, summary });
  }
  inspectSecondServers(context.project, findings, summary, lawIds.ingress);
  inspectCallbackEscapes(context.project, findings, summary, lawIds.callback);
  if (selfFile) inspectNoRegex(selfFile, findings, summary, lawIds.audit);

  const status = findings.length > 0 ? "FAIL" : "PASS";
  return {
    capabilityDomain: domain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
    reportJson: {
      generatedAt: new Date().toISOString(),
      status,
      findings,
      summary,
    },
  };
};

const runInspectorFromCli = async (): Promise<void> => {
  buildAuditArtifacts();
  const planEntry = loadGeneratedAuditPlan().find((entry) => entry.capabilityDomain === domain);
  if (!planEntry) {
    throw new Error("workbench-api-boundary audit plan entry is missing.");
  }
  const output = await inspectDomain({
    project: createAuditProject(),
    planEntry,
    generatedPlan: [planEntry],
    completedReports: {},
  });
  if (output.findings.length > 0) {
    throw new Error(`workbench-api-boundary failed with ${output.findings.length} finding(s).`);
  }
  process.stdout.write("[AUDIT] workbench-api-boundary PASS\n");
};

const isEntrypoint = (): boolean => {
  const invokedPath = process.argv[1];
  return invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url);
};

if (isEntrypoint()) {
  await runInspectorFromCli();
}
