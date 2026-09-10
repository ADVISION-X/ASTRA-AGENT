import { existsSync } from "node:fs";

import {
  Node,
  Project,
  SyntaxKind,
  type ArrayLiteralExpression,
  type CallExpression,
  type ObjectLiteralExpression,
  type SourceFile,
} from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import {
  producerModePassed,
  recordStaticCheck,
  staticClauses,
  staticEvidenceRefs,
  validateStaticInspection,
} from "../../shared/static-inspection-contract.js";
import type {
  InspectorContext,
  InspectorEvaluation,
  InspectorFinding,
  SessionInspectorOutput,
} from "../../shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";

const domain = "workbench-api-boundary";
const lawKey = "LAW-WORKBENCH-API-BOUNDARY-001-V7";
const boundaryPath = "src/app/workbench-api-boundary.ts";
const serverPath = "src/app/create-workbench-server.ts";
const websocketUpgradePath = "src/app/workbench-browser-websocket-upgrade.ts";

const addFinding = (
  findings: InspectorFinding[],
  lawId: string,
  checkId: string,
  filePath: string,
  message: string,
): void => {
  findings.push(createFinding({ evidenceMode: "static.ast", checkId, lawId, filePath, message }));
};

const source = (project: Project, repoPath: string): SourceFile | null =>
  project.getSourceFile(resolveFromRepo(repoPath)) ?? null;

const propertyText = (object: ObjectLiteralExpression, name: string): string | null => {
  const property = object.getProperty(name);
  if (!property || !Node.isPropertyAssignment(property)) return null;
  const value = property.getInitializer();
  return value && (Node.isStringLiteral(value) || Node.isNoSubstitutionTemplateLiteral(value))
    ? value.getLiteralText()
    : null;
};

const literalArray = (file: SourceFile, name: string): ArrayLiteralExpression | null => {
  const declaration = file.getVariableDeclaration(name);
  let initializer = declaration?.getInitializer();
  while (initializer && (Node.isAsExpression(initializer) || Node.isSatisfiesExpression(initializer))) {
    initializer = initializer.getExpression();
  }
  return initializer && Node.isArrayLiteralExpression(initializer) ? initializer : null;
};

const inspectRouteRules = (
  file: SourceFile,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const rules = literalArray(file, "WORKBENCH_API_ROUTE_RULES");
  if (!rules) {
    addFinding(findings, lawId, "workbench-api-boundary/route-rules", boundaryPath,
      "WORKBENCH_API_ROUTE_RULES must be a literal array.");
    return;
  }
  const actual = new Map<string, string>();
  for (const element of rules.getElements()) {
    if (!Node.isObjectLiteralExpression(element)) {
      addFinding(findings, lawId, "workbench-api-boundary/route-rule-literal", boundaryPath,
        "Every Workbench route must be a literal object.");
      continue;
    }
    const method = propertyText(element, "method");
    const path = propertyText(element, "path");
    const audience = propertyText(element, "audience");
    if (method !== "GET" || !path?.startsWith("/api/")
      || (audience !== "local-ui" && audience !== "local-extension")) {
      addFinding(findings, lawId, "workbench-api-boundary/local-route-shape", boundaryPath,
        "Workbench routes must be exact GET routes for local-ui or local-extension only.");
      continue;
    }
    if (actual.has(path)) {
      addFinding(findings, lawId, "workbench-api-boundary/duplicate-route", boundaryPath,
        `Duplicate Workbench route ${path}.`);
    }
    actual.set(path, audience);
  }
  const expected = new Map([
    ["/api/health", "local-ui"],
    ["/api/browser-authority/pairing", "local-extension"],
    ["/api/production-runtime/operations-snapshot", "local-ui"],
  ]);
  if (JSON.stringify([...actual]) !== JSON.stringify([...expected])) {
    addFinding(findings, lawId, "workbench-api-boundary/route-denominator", boundaryPath,
      "Workbench must expose only health, extension pairing, and production operations snapshot routes.");
  }
};

const inspectNoExternalIngress = (
  file: SourceFile,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const sourceText = file.getFullText();
  const forbidden = [
    "externalApiAllowed",
    "requiresSiteHmac",
    "GRASSEYE_EXTERNAL_",
    "x-grasseye-signature",
    "x-grasseye-source-system",
    "x-grasseye-request-id",
    "EXTERNAL_REQUEST_FORBIDDEN_KEYS",
    "callbackUrl",
    "createHmac",
    "timingSafeEqual",
  ];
  for (const token of forbidden) {
    if (!sourceText.includes(token)) continue;
    addFinding(findings, lawId, "workbench-api-boundary/no-external-ingress", boundaryPath,
      `External ingress implementation remains: ${token}.`);
  }
};

const importNamesFromHttp = (file: SourceFile): { createServerNames: Set<string>; namespaceNames: Set<string> } => {
  const createServerNames = new Set<string>();
  const namespaceNames = new Set<string>();
  for (const item of file.getImportDeclarations()) {
    if (!["node:http", "http"].includes(item.getModuleSpecifierValue())) continue;
    for (const named of item.getNamedImports()) {
      if (named.getName() === "createServer") {
        createServerNames.add(astIdentifierName(named.getAliasNode()) ?? named.getName());
      }
    }
    const namespaceImport = item.getNamespaceImport();
    const namespaceName = namespaceImport ? astIdentifierName(namespaceImport) : undefined;
    if (namespaceName) namespaceNames.add(namespaceName);
  }
  return { createServerNames, namespaceNames };
};

const isHttpCreateServerCall = (
  call: CallExpression,
  names: { createServerNames: Set<string>; namespaceNames: Set<string> },
): boolean => {
  const expression = call.getExpression();
  if (Node.isIdentifier(expression)) return names.createServerNames.has(astIdentifierName(expression) ?? "");
  if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "createServer") return false;
  const owner = expression.getExpression();
  return Node.isIdentifier(owner) && names.namespaceNames.has(astIdentifierName(owner) ?? "");
};

const inspectSecondServers = (project: Project, findings: InspectorFinding[], lawId: string): void => {
  for (const file of project.getSourceFiles()) {
    const repoPath = toRepoPath(file.getFilePath());
    if (!repoPath.startsWith("src/plugins/") && !repoPath.startsWith("src/capabilities/")) continue;
    const names = importNamesFromHttp(file);
    for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (isHttpCreateServerCall(call, names)) {
        addFinding(findings, lawId, "workbench-api-boundary/no-second-server", repoPath,
          "Plugins and capabilities must not create an HTTP server.");
      }
    }
  }
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
    "local-extension",
    "route_not_extension_allowed",
    "no-store, max-age=0",
    "no-cache",
    "no-referrer",
    "nosniff",
  ]) {
    if (!combined.includes(required)) {
      addFinding(findings, lawId, "workbench-api-boundary/extension-pairing", boundaryPath,
        `The fixed extension pairing boundary must retain ${required}.`);
    }
  }
  if (!upgrade.getFullText().includes("origin !== GRASSEYE_BROWSER_EXTENSION_ORIGIN")
    || !upgrade.getFullText().includes("!isLoopback(address)")) {
    addFinding(findings, lawId, "workbench-api-boundary/extension-websocket-origin", websocketUpgradePath,
      "Browser WebSocket upgrade must require loopback transport and the fixed extension Origin.");
  }
};

const inspectRequiredFiles = (findings: InspectorFinding[], lawId: string): void => {
  for (const repoPath of [boundaryPath, serverPath, websocketUpgradePath]) {
    if (!existsSync(resolveFromRepo(repoPath))) {
      addFinding(findings, lawId, "workbench-api-boundary/required-file", repoPath, `${repoPath} must exist.`);
    }
  }
  if (existsSync(resolveFromRepo("src/app/workbench-multipart.ts"))) {
    addFinding(findings, lawId, "workbench-api-boundary/retired-multipart", "src/app/workbench-multipart.ts",
      "Multipart parsing for the retired external ingress must be absent.");
  }
};

const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const lawId = selectLawId(context.planEntry.lawIds, lawKey);
  const findings: InspectorFinding[] = [];
  const staticCheckReceipts: InspectorEvaluation["staticCheckReceipts"] = [];
  const run = (check: string, implementation: (...args: never[]) => unknown, action: () => void): void => recordStaticCheck({
    check, findings, implementation, lawIds: [lawId], receipts: staticCheckReceipts, run: action,
  });
  const boundary = source(context.project, boundaryPath);
  run("inspectRequiredFiles", inspectRequiredFiles, () => inspectRequiredFiles(findings, lawId));
  if (boundary) {
    run("inspectRouteRules", inspectRouteRules, () => inspectRouteRules(boundary, findings, lawId));
    run("inspectNoExternalIngress", inspectNoExternalIngress, () => inspectNoExternalIngress(boundary, findings, lawId));
  }
  run("inspectSecondServers", inspectSecondServers, () => inspectSecondServers(context.project, findings, lawId));
  run("inspectExtensionPairingBoundary", inspectExtensionPairingBoundary,
    () => inspectExtensionPairingBoundary(context.project, findings, lawId));
  return {
    capabilityDomain: domain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...context.targetPaths],
    staticCheckReceipts,
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const evaluation = await inspectDomainEvaluation(context);
  const findings = evaluation.findings.filter((finding) => finding.lawId === lawKey);
  const assertion = (mode: string, checks: string[]) => ({
    clauses: staticClauses(0),
    evidenceMode: mode,
    passed: producerModePassed(evaluation.staticCheckReceipts, lawKey, checks),
    refs: staticEvidenceRefs(context, lawKey, mode, staticClauses(0), evaluation.staticCheckReceipts, checks),
  });
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: evaluation.reportedLawIds,
    lawResults: [{ lawId: lawKey, assertions: [
      assertion("static.ast", ["inspectRouteRules", "inspectNoExternalIngress", "inspectSecondServers"]),
      assertion("static.contract", ["inspectRequiredFiles", "inspectExtensionPairingBoundary"]),
    ], findings }],
    inspectedFiles: evaluation.inspectedFiles,
  });
};
