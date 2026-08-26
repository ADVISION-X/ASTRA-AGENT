import { existsSync } from "node:fs";
import { producerModePassed, staticClauses, staticEvidenceRefs, validateStaticInspection } from "../../shared/static-inspection-contract.js";

import {
  Node,
  Project,
  SyntaxKind,
  type ArrayLiteralExpression,
  type CallExpression,
  type ObjectLiteralExpression,
  type SourceFile,
} from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { type InspectorContext, type InspectorEvaluation, type InspectorFinding, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";
import { inspectExternalIngressIdentity, inspectPerSiteHmac } from "./external-ingress-identity-inspector.js";

type Summary = {
  wildcardCorsViolations: number;
  guardMissingViolations: number;
  ingressIdentityViolations: number;
  perSiteHmacViolations: number;
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
const websocketUpgradePath = "src/app/workbench-browser-websocket-upgrade.ts";

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
  perSiteHmacViolations: 0,
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
  findings.push(createFinding({ evidenceMode: "static.ast",
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
    return astIdentifierName(nameNode) ?? null;
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
    if (externalAllowed === true && booleanLiteral(element, "requiresSiteHmac") !== true) {
      summary.unauthenticatedExternalRouteViolations += 1;
      addFinding(findings, {
        checkId: "workbench-api-boundary/external-route-requires-site-hmac",
        lawId: lawIds.auth,
        filePath: boundaryPath,
        message: "Every externalApiAllowed route must require a per-site HMAC.",
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
        createServerNames.add(astIdentifierName(named.getAliasNode()) ?? named.getName());
      }
    }
    const namespaceImport = item.getNamespaceImport();
    if (namespaceImport) {
      const namespaceName = astIdentifierName(namespaceImport);
      if (namespaceName) namespaceNames.add(namespaceName);
    }
  }
  return { createServerNames, namespaceNames };
};

const isHttpCreateServerCall = (call: CallExpression, names: { createServerNames: Set<string>; namespaceNames: Set<string> }): boolean => {
  const expression = call.getExpression();
  if (Node.isIdentifier(expression) && names.createServerNames.has(astIdentifierName(expression) ?? "")) {
    return true;
  }
  if (Node.isPropertyAccessExpression(expression) && expression.getName() === "createServer") {
    const left = expression.getExpression();
    return Node.isIdentifier(left) && names.namespaceNames.has(astIdentifierName(left) ?? "");
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
  if (Node.isIdentifier(first)) return astIdentifierName(first) === "callbackUrl";
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
      if (Node.isIdentifier(expression) && astIdentifierName(expression) === "fetch" && firstArgumentIsCallbackUrl(call)) {
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

const inspectRequiredFiles = (
  project: Project,
  findings: InspectorFinding[],
  lawId: string,
): SourceFile[] => {
  const files = [boundaryPath, serverPath, websocketUpgradePath];
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
  return files
    .map((repoPath) => source(project, repoPath))
    .filter((item): item is SourceFile => item !== null);
};

const inspectExtensionPairingBoundary = (
  project: Project,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const boundary = source(project, boundaryPath);
  const server = source(project, serverPath);
  const upgrade = source(project, websocketUpgradePath);
  if (!boundary || !server || !upgrade) return;
  const combined = [boundary.getFullText(), server.getFullText(), upgrade.getFullText()].join("\n");
  for (const required of [
    "GRASSEYE_BROWSER_EXTENSION_ORIGIN",
    "GRASSEYE_TOOL_EXTENSION_ID_HEADER",
    "localExtensionAllowed",
    "local-extension",
    "route_not_extension_allowed",
    "no-store, max-age=0",
    "no-cache",
    "no-referrer",
    "nosniff",
  ]) {
    if (combined.includes(required)) continue;
    addFinding(findings, {
      checkId: "workbench-api-boundary/extension-pairing-bootstrap",
      lawId,
      filePath: boundaryPath,
      message: `The fixed extension pairing boundary must retain ${required}.`,
    });
  }
  if (!upgrade.getFullText().includes("origin !== GRASSEYE_BROWSER_EXTENSION_ORIGIN")
    || !upgrade.getFullText().includes("!isLoopback(address)")) {
    addFinding(findings, {
      checkId: "workbench-api-boundary/extension-websocket-origin",
      lawId,
      filePath: websocketUpgradePath,
      message: "Browser WebSocket upgrade must require both loopback transport and the exact fixed extension Origin.",
    });
  }
};



const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const lawIds = {
    ingress: selectLawId(context.planEntry.lawIds, "LAW-WORKBENCH-API-BOUNDARY-001-V6"),
    cors: selectLawId(context.planEntry.lawIds, "LAW-WORKBENCH-API-BOUNDARY-001-V6"),
    auth: selectLawId(context.planEntry.lawIds, "LAW-WORKBENCH-API-BOUNDARY-001-V6"),
    route: selectLawId(context.planEntry.lawIds, "LAW-WORKBENCH-API-BOUNDARY-001-V6"),
    shape: selectLawId(context.planEntry.lawIds, "LAW-WORKBENCH-API-BOUNDARY-001-V6"),
    callback: selectLawId(context.planEntry.lawIds, "LAW-WORKBENCH-API-BOUNDARY-001-V6"),
    audit: selectLawId(context.planEntry.lawIds, "LAW-WORKBENCH-API-BOUNDARY-001-V6"),
  };
  const findings: InspectorFinding[] = [];
  const summary = initialSummary();
  const requiredFiles = inspectRequiredFiles(context.project, findings, lawIds.ingress);
  const inspectedFiles = new Set<string>(requiredFiles.map((file) => toRepoPath(file.getFilePath())));
  const boundaryFile = source(context.project, boundaryPath);
  if (boundaryFile) {
    inspectRouteRules(boundaryFile, findings, summary, lawIds);
    inspectForbiddenKeys(boundaryFile, findings, summary, lawIds.shape);
    inspectExternalIngressIdentity({ boundaryPath, file: boundaryFile, findings, lawId: lawIds.ingress, summary });
    inspectPerSiteHmac({ boundaryPath, file: boundaryFile, findings, lawId: lawIds.auth, summary });
  }
  inspectExtensionPairingBoundary(context.project, findings, lawIds.ingress);
  inspectSecondServers(context.project, findings, summary, lawIds.ingress);
  inspectCallbackEscapes(context.project, findings, summary, lawIds.callback);

  return {
    capabilityDomain: domain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...context.targetPaths],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const evaluation = await inspectDomainEvaluation(context);
  const lawId = "LAW-WORKBENCH-API-BOUNDARY-001-V6";
  const findings = evaluation.findings.filter((finding) => finding.lawId === lawId);
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain, reportedLawIds: evaluation.reportedLawIds,
    lawResults: [{ lawId, assertions: [
      { clauses: staticClauses(0), evidenceMode: "static.ast", passed: producerModePassed(findings, "static.ast"), refs: staticEvidenceRefs(context, lawId, "static.ast") },
      { clauses: staticClauses(0), evidenceMode: "static.contract", passed: producerModePassed(findings, "static.contract"), refs: staticEvidenceRefs(context, lawId, "static.contract") },
    ], findings }], inspectedFiles: evaluation.inspectedFiles,
  });
};
