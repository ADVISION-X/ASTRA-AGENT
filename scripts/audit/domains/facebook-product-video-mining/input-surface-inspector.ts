import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const facebookPagePath = "src/app/workbench-home-page.ts";
const facebookWorkspacePath = "src/app/app-shell/app-shell-layout.ts";
const facebookClientPath = "src/app/workbench-home-client.ts";
const facebookSchemaPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.schema.ts";
const facebookSelectionExportPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.selection-export.ts";

const sourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const literalValues = (file: import("ts-morph").Node | undefined): string[] => file
  ? [
      ...file.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralText()),
      ...file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((literal) => literal.getLiteralText()),
      ...file.getDescendantsOfKind(SyntaxKind.TemplateHead).map((literal) => literal.getLiteralText()),
      ...file.getDescendantsOfKind(SyntaxKind.TemplateMiddle).map((literal) => literal.getLiteralText()),
      ...file.getDescendantsOfKind(SyntaxKind.TemplateTail).map((literal) => literal.getLiteralText()),
    ]
  : [];

const hasLiteralFragment = (file: import("ts-morph").Node | undefined, fragment: string): boolean =>
  literalValues(file).some((literal) => literal.includes(fragment));

const hasIdentifier = (file: SourceFile | undefined, identifierName: string): boolean =>
  file?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) =>
    identifier.getText() === identifierName) ?? false;

const hasFormBackedProperty = (file: SourceFile | undefined, propertyName: string): boolean =>
  file?.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => {
    if (property.getName() !== propertyName) {
      return false;
    }
    return property.getInitializer()?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((access) =>
      Node.isIdentifier(access.getExpression()) && access.getExpression().getText() === "form") ?? false;
  }) ?? false;

const inspectTargetCountInput = (
  findings: InspectorFinding[],
  lawId: string,
  pageFiles: readonly (import("ts-morph").Node | undefined)[],
): void => {
  if (!pageFiles.some((file) => hasLiteralFragment(file, 'name="targetProductCount"'))) {
    findings.push(createFinding({
      checkId: "facebook-mining/minimal-target-count-input",
      lawId,
      filePath: facebookPagePath,
      message: "Facebook workbench must expose targetProductCount as the only operator mission input.",
    }));
  }
};

const inspectForbiddenVisibleInputs = (
  findings: InspectorFinding[],
  lawId: string,
  pageFiles: readonly (import("ts-morph").Node | undefined)[],
): void => {
  const forbiddenVisibleFields = ["feedEntryUrl", "providerKind", "modelName", "maxRounds", "maxMinutes"] as const;
  const visibleField = forbiddenVisibleFields.find((fieldName) =>
    pageFiles.some((file) => hasLiteralFragment(file, `name="${fieldName}"`)));
  if (visibleField) {
    findings.push(createFinding({
      checkId: "facebook-mining/forbidden-visible-advanced-input",
      lawId,
      filePath: facebookPagePath,
      message: "Facebook workbench must not expose feed URL, provider, model, max rounds, or max minutes inputs.",
      evidence: visibleField,
    }));
  }
};

const inspectForbiddenClientPayload = (
  findings: InspectorFinding[],
  lawId: string,
  clientFile: SourceFile | undefined,
): void => {
  const forbiddenPayloadField = ["feedEntryUrl", "providerKind", "modelName", "maxRounds", "maxMinutes"]
    .find((fieldName) => hasFormBackedProperty(clientFile, fieldName));
  if (forbiddenPayloadField) {
    findings.push(createFinding({
      checkId: "facebook-mining/forbidden-client-payload-advanced-input",
      lawId,
      filePath: facebookClientPath,
      message: "Facebook client mission payload must submit only targetProductCount from the visible form.",
      evidence: forbiddenPayloadField,
    }));
  }
};

const inspectSchemaDefaults = (
  findings: InspectorFinding[],
  lawId: string,
  schemaFile: SourceFile | undefined,
): void => {
  for (const marker of [
    "DEFAULT_FACEBOOK_MINING_FEED_ENTRY_URL",
    "DEFAULT_FACEBOOK_MINING_PROVIDER_KIND",
    "DEFAULT_FACEBOOK_MINING_MAX_MINUTES",
    "FACEBOOK_MINING_ROUNDS_PER_TARGET",
  ]) {
    if (!hasIdentifier(schemaFile, marker)) {
      findings.push(createFinding({
        checkId: "facebook-mining/schema-default-mission-parameter",
        lawId,
        filePath: facebookSchemaPath,
        message: `Facebook mission schema must own automatic default marker ${marker}.`,
      }));
    }
  }
};

export const inspectMinimalOperatorInput = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const pageFiles = [sourceFile(context, facebookPagePath), sourceFile(context, facebookWorkspacePath)];
  const facebookWorkspace = pageFiles[1]?.getVariableDeclaration("renderFacebookWorkspace")?.getInitializer();
  const scopedPageFiles = [pageFiles[0], facebookWorkspace];
  const clientFile = sourceFile(context, facebookClientPath);
  const schemaFile = sourceFile(context, facebookSchemaPath);
  for (const repoPath of [facebookPagePath, facebookWorkspacePath, facebookClientPath, facebookSchemaPath]) {
    inspectedFiles.add(repoPath);
  }
  inspectTargetCountInput(findings, lawId, scopedPageFiles);
  inspectForbiddenVisibleInputs(findings, lawId, scopedPageFiles);
  inspectForbiddenClientPayload(findings, lawId, clientFile);
  inspectSchemaDefaults(findings, lawId, schemaFile);
};

export const inspectSavedRecordExportSurface = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const pageFiles = [sourceFile(context, facebookPagePath), sourceFile(context, facebookWorkspacePath)];
  const clientFile = sourceFile(context, facebookClientPath);
  const exportFile = sourceFile(context, facebookSelectionExportPath);
  for (const repoPath of [facebookPagePath, facebookWorkspacePath, facebookClientPath, facebookSelectionExportPath]) {
    inspectedFiles.add(repoPath);
  }
  if (
    !pageFiles.some((file) => hasLiteralFragment(file, "data-facebook-record-list"))
    || !pageFiles.some((file) => hasLiteralFragment(file, "data-facebook-export"))
  ) {
    findings.push(createFinding({
      checkId: "facebook-mining/saved-records-visible-export",
      lawId,
      filePath: facebookPagePath,
      message: "Facebook workbench must display saved product records and expose an export control.",
    }));
  }
  if (
    !hasLiteralFragment(clientFile, "/api/facebook-product-video-mining/results?runId=")
    || !hasLiteralFragment(clientFile, "/api/facebook-product-video-mining/export?runId=")
  ) {
    findings.push(createFinding({
      checkId: "facebook-mining/saved-records-client-fetch",
      lawId,
      filePath: facebookClientPath,
      message: "Facebook client must read saved records and export selection data for the active run.",
    }));
  }
  if (
    !hasLiteralFragment(exportFile, "c.status = 'saved'")
    || !hasLiteralFragment(exportFile, "c.ai_selected_option_id = 'PRODUCT_SEEDING'")
  ) {
    findings.push(createFinding({
      checkId: "facebook-mining/export-saved-product-only",
      lawId,
      filePath: facebookSelectionExportPath,
      message: "Facebook selection export must include only saved PRODUCT_SEEDING candidates.",
    }));
  }
};

export { inspectFacebookSafetyDefaults } from "./input-surface-safety-inspector.js";
