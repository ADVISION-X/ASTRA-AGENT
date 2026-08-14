import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import {
  fileIncludesText,
  getRequiredSourceFile,
  hasIdentifier,
  hasStringLiteral,
  trackSourceFile,
} from "./inspector-ast-shared.js";

type KeywordFullPackageInspectionFiles = {
  acceptanceFile: SourceFile | undefined;
  aiPackageFile: SourceFile | undefined;
  webChatComposerFile: SourceFile | undefined;
  packageFile: SourceFile | undefined;
  reviewFile: SourceFile | undefined;
  webChatSubmitFile: SourceFile | undefined;
};

const collectKeywordFullPackageInspectionFiles = (
  context: InspectorContext,
  inspectedFiles: Set<string>,
): KeywordFullPackageInspectionFiles => {
  const packageFile = getRequiredSourceFile(context, "src/plugins/amazon-product-mining/amazon-product-mining.keyword-full-package.ts");
  const reviewFile = getRequiredSourceFile(context, "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review.ts");
  const aiPackageFile = getRequiredSourceFile(context, "src/capabilities/ai-input-gateway/runtime/ai-feed-input-package.ts");
  const webChatComposerFile = getRequiredSourceFile(context, "src/capabilities/ai-input-gateway/providers/web-chat-composer-scripts.ts");
  const webChatSubmitFile = getRequiredSourceFile(context, "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts");
  const acceptanceFile = getRequiredSourceFile(context, "scripts/acceptance/amazon-product-mining-keyword-opportunity-review.acceptance.ts");
  [packageFile, reviewFile, aiPackageFile, webChatComposerFile, webChatSubmitFile, acceptanceFile].forEach((sourceFile) => trackSourceFile(inspectedFiles, sourceFile));
  return { acceptanceFile, aiPackageFile, webChatComposerFile, packageFile, reviewFile, webChatSubmitFile };
};

const inspectKeywordPackageBuilder = (packageFile: SourceFile | undefined): boolean =>
  Boolean(packageFile
    && hasIdentifier(packageFile, "buildKeywordFullEvidencePackage")
    && hasStringLiteral(packageFile, "keyword-full-package-zip")
    && hasIdentifier(packageFile, "writeKeywordPackageZip")
    && hasStringLiteral(packageFile, "00-keyword-master-report")
    && hasStringLiteral(packageFile, "03-reviews")
    && hasStringLiteral(packageFile, "package-integrity-report.json"));

const inspectKeywordReviewRuntime = (reviewFile: SourceFile | undefined): boolean =>
  Boolean(reviewFile
    && hasIdentifier(reviewFile, "buildKeywordFullEvidencePackage")
	    && hasIdentifier(reviewFile, "providerProofContainsKeywordPackageFiles")
	    && !fileIncludesText(reviewFile, "maxFileCount: 0")
	    && fileIncludesText(reviewFile, "keyword_full_package_integrity_failed")
	    && fileIncludesText(reviewFile, "keyword_full_package_files_not_confirmed_by_provider_proof"));

const inspectKeywordPackageGateway = (aiPackageFile: SourceFile | undefined): boolean =>
  Boolean(aiPackageFile
    && hasIdentifier(aiPackageFile, "isDocumentEvidenceRef")
    && fileIncludesText(aiPackageFile, "application/zip"));

const variableBodyCallsIdentifier = (
  sourceFile: SourceFile,
  variableName: string,
  calledIdentifier: string,
): boolean => {
  const initializer = sourceFile.getVariableDeclaration(variableName)?.getInitializer();
  return Boolean(initializer?.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (Node.isIdentifier(expression)) {
      return astIdentifierName(expression) === calledIdentifier;
    }
    return Node.isPropertyAccessExpression(expression)
      && expression.getName() === calledIdentifier;
  }));
};

const inspectWebChatPackageAttachmentPreservation = (webChatSubmitFile: SourceFile | undefined): boolean =>
  Boolean(webChatSubmitFile
    && hasIdentifier(webChatSubmitFile, "requestHasUploadableInputRefs")
    && hasIdentifier(webChatSubmitFile, "clearComposerBeforePromptPaste")
    && hasIdentifier(webChatSubmitFile, "pastePromptIntoComposer")
    && hasIdentifier(webChatSubmitFile, "clearComposer")
    && variableBodyCallsIdentifier(webChatSubmitFile, "clearComposerBeforePromptPaste", "requestHasUploadableInputRefs")
    && variableBodyCallsIdentifier(webChatSubmitFile, "clearComposerBeforePromptPaste", "clearComposer")
    && variableBodyCallsIdentifier(webChatSubmitFile, "pastePromptIntoComposer", "clearComposerBeforePromptPaste"));

const inspectWebChatPackageExactAttachmentBinding = (webChatComposerFile: SourceFile | undefined): boolean =>
  Boolean(webChatComposerFile
    && hasIdentifier(webChatComposerFile, "buildWaitForExactAttachmentCountScript")
    && hasIdentifier(webChatComposerFile, "expectedFileNames")
    && !hasIdentifier(webChatComposerFile, "buildWaitForAttachmentCountScript"));

const inspectKeywordPackageAcceptance = (acceptanceFile: SourceFile | undefined): boolean =>
  Boolean(acceptanceFile
    && fileIncludesText(acceptanceFile, "keyword-full-package-zip")
    && hasIdentifier(acceptanceFile, "existsSync")
    && hasIdentifier(acceptanceFile, "filePath"));

const inspectKeywordFullPackageChecks = (files: KeywordFullPackageInspectionFiles) => ({
  packageOk: inspectKeywordPackageBuilder(files.packageFile),
  reviewOk: inspectKeywordReviewRuntime(files.reviewFile),
  gatewayOk: inspectKeywordPackageGateway(files.aiPackageFile),
  webChatAttachmentOk: inspectWebChatPackageAttachmentPreservation(files.webChatSubmitFile),
  webChatExactAttachmentBindingOk: inspectWebChatPackageExactAttachmentBinding(files.webChatComposerFile),
  acceptanceOk: inspectKeywordPackageAcceptance(files.acceptanceFile),
});

export const inspectKeywordFullPackageHandoff = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const checks = inspectKeywordFullPackageChecks(collectKeywordFullPackageInspectionFiles(context, inspectedFiles));
  if (checks.packageOk && checks.reviewOk && checks.gatewayOk && checks.webChatAttachmentOk && checks.webChatExactAttachmentBindingOk && checks.acceptanceOk) return;
  findings.push(createFinding({
    checkId: "amazon-mining/keyword-full-package-handoff",
    lawId,
    filePath: "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review.ts",
    message: "Keyword opportunity review must build and upload a keyword full package transport archive; inline navigation cannot be the sole review evidence.",
    evidence: `packageOk=${Boolean(checks.packageOk)};reviewOk=${Boolean(checks.reviewOk)};gatewayOk=${Boolean(checks.gatewayOk)};webChatAttachmentOk=${Boolean(checks.webChatAttachmentOk)};webChatExactAttachmentBindingOk=${Boolean(checks.webChatExactAttachmentBindingOk)};acceptanceOk=${Boolean(checks.acceptanceOk)}`,
  }));
};
