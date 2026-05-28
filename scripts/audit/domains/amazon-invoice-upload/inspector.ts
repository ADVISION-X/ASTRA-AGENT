import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Node,
  Project,
  SyntaxKind,
  type ArrayLiteralExpression,
  type ObjectLiteralExpression,
  type SourceFile,
} from "ts-morph";

import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { loadGeneratedAuditPlan } from "../../core/load-audit-plan.js";
import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { createAuditProject } from "../../shared/project.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";

const domain = "amazon-invoice-upload";
const lawPath = ".github/instructions/agent-rules/modules/module-amazon-invoice-upload.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye Amazon Invoice Upload Unified Chain 施工图.md";
const processPath = "docs/法案辅助文件/amazon_invoice_upload_process.md";
const ownerRoot = "src/plugins/amazon-invoice-upload";
const downloadFlowPath = `${ownerRoot}/amazon-tax-invoice-download.flow.ts`;
const evidencePath = `${ownerRoot}/amazon-tax-invoice-download-evidence.ts`;
const routesPath = "src/app/workbench-amazon-routes.ts";
const boundaryPath = "src/app/workbench-api-boundary.ts";
const appShellLayoutPath = "src/app/app-shell/app-shell-layout.ts";
const selfPath = "scripts/audit/domains/amazon-invoice-upload/inspector.ts";

const evidenceStepIds = [
  "AID-01",
  "AID-02",
  "AID-03",
  "AID-04",
  "AID-05",
  "AID-06",
  "AID-07",
  "AID-08",
  "AID-09",
  "AID-10",
  "AID-11",
] as const;

const forbiddenExternalKeys = [
  "selector",
  "actionPlan",
  "browserCommand",
  "flowStep",
  "documentId",
  "downloadUrl",
  "cookie",
  "sellerCentralCookie",
  "browserProfileDirectory",
] as const;

const requiredDownloadRoutes = [
  "/api/plugins/amazon-invoice-upload/download/start",
  "/api/plugins/amazon-invoice-upload/download/status/",
  "/api/plugins/amazon-invoice-upload/download/latest",
  "/api/plugins/amazon-invoice-upload/download/artifact/",
] as const;

type PropertyValue = string | boolean | null;

const source = (project: Project, repoPath: string): SourceFile | null =>
  project.getSourceFile(resolveFromRepo(repoPath)) ?? null;

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

const propertyName = (property: Node): string | null => {
  if (!Node.isPropertyAssignment(property)) return null;
  const nameNode = property.getNameNode();
  if (Node.isStringLiteral(nameNode)) return nameNode.getLiteralText();
  if (Node.isIdentifier(nameNode)) return nameNode.getText();
  return property.getName();
};

const property = (objectLiteral: ObjectLiteralExpression, name: string) =>
  objectLiteral.getProperties().find((item) => propertyName(item) === name);

const propertyValue = (objectLiteral: ObjectLiteralExpression, name: string): PropertyValue => {
  const item = property(objectLiteral, name);
  if (!item || !Node.isPropertyAssignment(item)) return null;
  const initializer = item.getInitializer();
  if (!initializer) return null;
  if (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer)) {
    return initializer.getLiteralText();
  }
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

const stringLiteralValues = (file: SourceFile): Set<string> =>
  new Set([
    ...file.getDescendantsOfKind(SyntaxKind.StringLiteral).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((item) => item.getLiteralText()),
  ]);

const literalCorpus = (file: SourceFile): string =>
  [...stringLiteralValues(file)].join("\n");

const inspectRequiredFiles = (
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const repoPath of [lawPath, blueprintPath, processPath, downloadFlowPath, evidencePath, routesPath, boundaryPath, appShellLayoutPath, selfPath]) {
    if (!existsSync(resolveFromRepo(repoPath))) {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/required-file",
        lawId,
        filePath: repoPath,
        message: `${repoPath} must exist.`,
      });
    }
  }
};

const inspectNoSecondChainPaths = (
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const repoPath of [
    "src/plugins/amazon-tax-invoice-download",
    "src/plugins/amazon-invoice-download",
    "scripts/audit/domains/amazon-tax-invoice-download",
  ]) {
    if (existsSync(resolveFromRepo(repoPath))) {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/no-second-chain-path",
        lawId,
        filePath: repoPath,
        message: "Amazon tax invoice download must not create a second skill, plugin, or audit domain.",
      });
    }
  }
};

const inspectEvidenceMap = (
  file: SourceFile | null,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  if (!file) return;
  const values = stringLiteralValues(file);
  for (const stepId of evidenceStepIds) {
    if (!values.has(stepId)) {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/evidence-step-id-missing",
        lawId,
        filePath: evidencePath,
        message: `Evidence step ${stepId} must be represented in the canonical Evidence Map export.`,
      });
    }
  }
};

const inspectDownloadFlow = (
  file: SourceFile | null,
  findings: InspectorFinding[],
  lawIds: { evidence: string; owner: string; artifact: string },
): void => {
  if (!file) return;
  const repoPath = toRepoPath(file.getFilePath());
  if (!repoPath.startsWith(ownerRoot)) {
    addFinding(findings, {
      checkId: "amazon-invoice-upload/download-flow-owner",
      lawId: lawIds.owner,
      filePath: repoPath,
      message: "Download flow must live under src/plugins/amazon-invoice-upload.",
    });
  }
  const values = stringLiteralValues(file);
  for (const stepId of evidenceStepIds) {
    if (!values.has(stepId)) {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/download-flow-step-id",
        lawId: lawIds.evidence,
        filePath: downloadFlowPath,
        message: `Download flow must cite Evidence Map step ${stepId}.`,
      });
    }
  }
  const calls = file.getDescendantsOfKind(SyntaxKind.CallExpression);
  if (!calls.some((call) => Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === "recordAmazonDomStepTrace")) {
    addFinding(findings, {
      checkId: "amazon-invoice-upload/download-flow-dom-trace",
      lawId: lawIds.evidence,
      filePath: downloadFlowPath,
      message: "Download flow must call recordAmazonDomStepTrace.",
    });
  }
  if (!values.has("manual_required")) {
    addFinding(findings, {
      checkId: "amazon-invoice-upload/download-flow-manual-required",
      lawId: lawIds.evidence,
      filePath: downloadFlowPath,
      message: "Download flow must expose manual_required gates.",
    });
  }
  if (values.has("documentId")) {
    addFinding(findings, {
      checkId: "amazon-invoice-upload/no-document-id-log",
      lawId: lawIds.artifact,
      filePath: downloadFlowPath,
      message: "Download flow must not persist or log Amazon download documentId.",
    });
  }
};

const inspectBoundaryRoutes = (
  file: SourceFile | null,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  if (!file) return;
  const rules = exportedArray(file, "WORKBENCH_API_ROUTE_RULES");
  const routeObjects = rules?.getElements().filter(Node.isObjectLiteralExpression) ?? [];
  for (const route of requiredDownloadRoutes) {
    const rule = routeObjects.find((item) => propertyValue(item, "path") === route);
    if (!rule) {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/download-route-rule-missing",
        lawId,
        filePath: boundaryPath,
        message: `API Boundary must allowlist ${route}.`,
      });
      continue;
    }
    if (propertyValue(rule, "externalApiAllowed") !== true || propertyValue(rule, "requiresApiKey") !== true || propertyValue(rule, "jobOwner") !== "amazon-invoice-upload") {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/download-route-rule-shape",
        lawId,
        filePath: boundaryPath,
        message: `${route} must be externalApiAllowed true, requiresApiKey true, and jobOwner amazon-invoice-upload.`,
      });
    }
  }
  const keys = exportedArray(file, "EXTERNAL_REQUEST_FORBIDDEN_KEYS");
  const actual = new Set(keys?.getElements().filter(Node.isStringLiteral).map((item) => item.getLiteralText()) ?? []);
  for (const key of forbiddenExternalKeys) {
    if (!actual.has(key)) {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/forbidden-external-key",
        lawId,
        filePath: boundaryPath,
        message: `External request forbidden keys must include ${key}.`,
      });
    }
  }
};

const inspectAppShell = (
  file: SourceFile | null,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  if (!file) return;
  const corpus = literalCorpus(file);
  for (const value of ["download", "upload", "latest", "evidence", "Start Download", "Latest Download", "Open Artifact"]) {
    if (!corpus.includes(value)) {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/app-shell-surface",
        lawId,
        filePath: appShellLayoutPath,
        message: `Amazon invoice App Shell surface must expose ${value}.`,
      });
    }
  }
  for (const forbidden of ["selector", "actionPlan", "browserCommand", "documentId", "browserProfileDirectory"]) {
    if (corpus.includes(forbidden)) {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/app-shell-forbidden-field",
        lawId,
        filePath: appShellLayoutPath,
        message: `Amazon invoice Download UI must not expose ${forbidden}.`,
      });
    }
  }
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawIds = {
    owner: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-001-V1"),
    evidence: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-002-V1"),
    api: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-005-V1"),
    ui: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-006-V1"),
    artifact: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-007-V1"),
  };
  const findings: InspectorFinding[] = [];
  inspectRequiredFiles(findings, lawIds.owner);
  inspectNoSecondChainPaths(findings, lawIds.owner);
  inspectEvidenceMap(source(context.project, evidencePath), findings, lawIds.evidence);
  inspectDownloadFlow(source(context.project, downloadFlowPath), findings, lawIds);
  inspectBoundaryRoutes(source(context.project, boundaryPath), findings, lawIds.api);
  inspectAppShell(source(context.project, appShellLayoutPath), findings, lawIds.ui);

  return {
    capabilityDomain: domain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [
      lawPath,
      blueprintPath,
      processPath,
      downloadFlowPath,
      evidencePath,
      routesPath,
      boundaryPath,
      appShellLayoutPath,
      selfPath,
    ],
  };
};

const runInspectorFromCli = async (): Promise<void> => {
  buildAuditArtifacts();
  const planEntry = loadGeneratedAuditPlan().find((entry) => entry.capabilityDomain === domain);
  if (!planEntry) {
    throw new Error("amazon-invoice-upload audit plan entry is missing.");
  }
  const output = await inspectDomain({
    project: createAuditProject(),
    planEntry,
    generatedPlan: [planEntry],
    completedReports: {},
  });
  if (output.findings.length > 0) {
    throw new Error(`amazon-invoice-upload failed with ${output.findings.length} finding(s).`);
  }
  process.stdout.write("[AUDIT] amazon-invoice-upload PASS\n");
};

const isEntrypoint = (): boolean => {
  const invokedPath = process.argv[1];
  return invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url);
};

if (isEntrypoint()) {
  await runInspectorFromCli();
}
