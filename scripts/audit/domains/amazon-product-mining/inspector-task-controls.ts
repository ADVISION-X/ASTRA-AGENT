import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import {
  getRequiredSourceFile,
  hasCallToLocalIdentifier,
  hasIdentifier,
  fileIncludesText,
  hasStringLiteral,
  trackSourceFile,
} from "./inspector-ast-shared.js";

const sourceExports = (sourceFile: SourceFile, exportName: string): boolean =>
  sourceFile.getExportedDeclarations().has(exportName);

const objectHasRouteKey = (sourceFile: SourceFile, routeKey: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((objectLiteral) =>
    objectLiteral.getProperties().some((property) => {
      if (!Node.isPropertyAssignment(property)) return false;
      const nameNode = property.getNameNode();
      return Node.isStringLiteral(nameNode) && nameNode.getLiteralValue() === routeKey;
    }),
  );

const enumArrayHasValues = (
  sourceFile: SourceFile,
  declarationName: string,
  values: readonly string[],
): boolean => {
  const declaration = sourceFile.getVariableDeclaration(declarationName);
  const rawInitializer = declaration?.getInitializer();
  const initializer = Node.isArrayLiteralExpression(rawInitializer)
    ? rawInitializer
    : Node.isAsExpression(rawInitializer)
      ? rawInitializer.getExpressionIfKind(SyntaxKind.ArrayLiteralExpression)
      : undefined;
  if (!initializer) return false;
  const literals = new Set(initializer.getElements()
    .filter(Node.isStringLiteral)
    .map((literal) => literal.getLiteralValue()));
  return values.every((value) => literals.has(value));
};

const taskControlContracts = [
  "src/plugins/amazon-product-mining/amazon-product-mining.schema.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.storage.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.storage-schema.ts",
  "src/plugins/amazon-product-mining/index.ts",
    "src/app/workbench-amazon-product-mining-routes.ts",
    "src/app/skills/amazon-product-mining/amazon-product-mining-workspace.ts",
    "src/app/workbench-home-client.ts",
    "src/app/workbench-home-amazon-product-mining-review-client.ts",
    "src/lib/local-runtime/workbench.ts",
  "src/lib/local-runtime/workbench-handle.ts",
] as const;

type TaskControlFiles = Record<typeof taskControlContracts[number], SourceFile | undefined>;

type TaskControlChecks = {
  appOk: boolean;
  flowOk: boolean;
  indexOk: boolean;
  routesOk: boolean;
  schemaOk: boolean;
  storageOk: boolean;
  workbenchOk: boolean;
};

const loadTaskControlFiles = (
  context: InspectorContext,
  inspectedFiles: Set<string>,
): TaskControlFiles => Object.fromEntries(taskControlContracts.map((repoPath) => {
    const sourceFile = getRequiredSourceFile(context, repoPath);
    trackSourceFile(inspectedFiles, sourceFile);
    return [repoPath, sourceFile] as const;
  })) as TaskControlFiles;

const inspectTaskControlCore = (files: TaskControlFiles) => {
  const schema = files["src/plugins/amazon-product-mining/amazon-product-mining.schema.ts"];
  const flow = files["src/plugins/amazon-product-mining/amazon-product-mining.flow.ts"];
  const storage = files["src/plugins/amazon-product-mining/amazon-product-mining.storage.ts"];
  const storageSchema = files["src/plugins/amazon-product-mining/amazon-product-mining.storage-schema.ts"];
  const pluginIndex = files["src/plugins/amazon-product-mining/index.ts"];
  return {
    schemaOk: Boolean(schema
      && hasStringLiteral(schema, "paused")
      && hasStringLiteral(schema, "terminated")
      && hasIdentifier(schema, "AmazonKeywordProviderKindSchema")),
    flowOk: Boolean(flow
      && hasCallToLocalIdentifier(flow, "ensureTaskRecord")
      && hasCallToLocalIdentifier(flow, "haltIfAmazonOperatorControlled")
      && hasCallToLocalIdentifier(flow, "getAmazonLinkedProductDetail")
      && hasCallToLocalIdentifier(flow, "hasAmazonKeywordOpportunityReview")),
    storageOk: Boolean(storage
      && storageSchema
      && hasIdentifier(storage, "listTasksByStatuses")
      && fileIncludesText(storageSchema, "provider_kind")),
    indexOk: Boolean(pluginIndex
      && sourceExports(pluginIndex, "pauseAmazonProductMiningTask")
      && sourceExports(pluginIndex, "continueAmazonProductMiningTask")
      && sourceExports(pluginIndex, "terminateAmazonProductMiningTask")
      && sourceExports(pluginIndex, "continueInterruptedAmazonProductMiningTasks")
      && enumArrayHasValues(pluginIndex, "RUNNING_TASK_STATUSES", ["created", "keyword_generating", "keyword_ready", "mining", "packaging"])),
  };
};

const inspectTaskControlSurface = (files: TaskControlFiles) => {
  const routes = files["src/app/workbench-amazon-product-mining-routes.ts"];
  const workspace = files["src/app/skills/amazon-product-mining/amazon-product-mining-workspace.ts"];
  const reviewClient = files["src/app/workbench-home-amazon-product-mining-review-client.ts"];
  const workbench = files["src/lib/local-runtime/workbench.ts"];
  const workbenchHandle = files["src/lib/local-runtime/workbench-handle.ts"];
  return {
    routesOk: Boolean(routes
      && objectHasRouteKey(routes, "POST:/api/amazon-product-mining/pause")
      && objectHasRouteKey(routes, "POST:/api/amazon-product-mining/continue")
      && objectHasRouteKey(routes, "POST:/api/amazon-product-mining/terminate")),
    appOk: Boolean(workspace
      && reviewClient
      && fileIncludesText(workspace, "data-amazon-product-mining-task-controls")
      && fileIncludesText(workspace, "data-amazon-product-mining-pause")
      && fileIncludesText(workspace, "data-amazon-product-mining-continue")
      && fileIncludesText(workspace, "data-amazon-product-mining-terminate")
      && fileIncludesText(reviewClient, "sendAmazonProductMiningControl")),
    workbenchOk: Boolean(workbench
      && workbenchHandle
      && hasCallToLocalIdentifier(workbench, "continueInterruptedAmazonProductMiningTasks")
      && hasIdentifier(workbenchHandle, "pauseAmazonProductMiningTask")
      && hasIdentifier(workbenchHandle, "continueAmazonProductMiningTask")
      && hasIdentifier(workbenchHandle, "terminateAmazonProductMiningTask")),
  };
};

const inspectTaskControlFiles = (files: TaskControlFiles): TaskControlChecks => ({
  ...inspectTaskControlCore(files),
  ...inspectTaskControlSurface(files),
});

const allTaskControlChecksPass = (checks: TaskControlChecks): boolean =>
  Object.values(checks).every(Boolean);

export const inspectAmazonTaskResumeAndControls = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const checks = inspectTaskControlFiles(loadTaskControlFiles(context, inspectedFiles));
  if (allTaskControlChecksPass(checks)) {
    return;
  }

  findings.push(createFinding({
    checkId: "amazon-mining/task-resume-and-controls",
    lawId,
    filePath: "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts",
    message: "Amazon Product Mining must provide persisted breakpoint continuation plus real Pause, Continue, and Terminate controls across plugin, routes, App UI, and startup.",
    evidence: JSON.stringify({
      ...checks,
    }),
  }));
};
