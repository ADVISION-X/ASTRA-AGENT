import {
  SyntaxKind,
  type ObjectLiteralExpression,
  type PropertyAccessExpression,
  type SourceFile,
} from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";

const PAGE_TAB_REUSE_FILES = [
  "src/plugins/amazon-product-mining/amazon-product-mining.search.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.product-detail.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.reviews.ts",
] as const;

const FLOW_TAB_OWNER_FILE = "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts";
const FLOW_TAB_OWNER_FILES = [
  FLOW_TAB_OWNER_FILE,
  "src/plugins/amazon-product-mining/amazon-product-mining.flow-support.ts",
] as const;

export type BrowserOpenCallDebug = {
  filePath: string;
  line: number;
  reusePolicy: string | null;
};

export type AmazonTabLifecycleDebug = {
  dedicatedWorkspaceTabCalls: BrowserOpenCallDebug[];
  pageNavigationCalls: BrowserOpenCallDebug[];
};

const getRequiredSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const trackSourceFile = (inspectedFiles: Set<string>, sourceFile: SourceFile | undefined): void => {
  if (sourceFile) {
    inspectedFiles.add(getRepoSourcePath(sourceFile));
  }
};

const getObjectLiteralStringPropertyValue = (
  objectLiteral: ObjectLiteralExpression,
  propertyName: string,
): string | null => {
  const property = objectLiteral.getProperty(propertyName)?.asKind(SyntaxKind.PropertyAssignment);
  const initializer = property?.getInitializer();
  const stringLiteral = initializer?.asKind(SyntaxKind.StringLiteral)
    ?? initializer?.asKind(SyntaxKind.NoSubstitutionTemplateLiteral);
  return stringLiteral ? stringLiteral.getLiteralText() : null;
};

const isBrowserControllerOpenCall = (propertyAccess: PropertyAccessExpression): boolean => {
  if (propertyAccess.getName() !== "open") {
    return false;
  }

  const propertySymbol = propertyAccess.getNameNode().getSymbol();
  const propertyDeclarationMatch = propertySymbol?.getDeclarations().some((declaration) => {
    const declarationSourcePath = getRepoSourcePath(declaration.getSourceFile());
    return declarationSourcePath === "src/lib/browser/browser-controller.ts"
      && declaration.getFirstAncestorByKind(SyntaxKind.InterfaceDeclaration)?.getName() === "BrowserController";
  });

  if (propertyDeclarationMatch) {
    return true;
  }

  const receiverSymbol = propertyAccess.getExpression().getType().getSymbol();
  return receiverSymbol?.getDeclarations().some((declaration) => {
    const declarationSourcePath = getRepoSourcePath(declaration.getSourceFile());
    return declarationSourcePath === "src/lib/browser/browser-controller.ts"
      && declaration.getKind() === SyntaxKind.InterfaceDeclaration
      && declaration.getSymbol()?.getName() === "BrowserController";
  }) ?? false;
};

const collectBrowserOpenCalls = (
  context: InspectorContext,
  inspectedFiles: Set<string>,
  repoPath: string,
): BrowserOpenCallDebug[] => {
  const sourceFile = getRequiredSourceFile(context, repoPath);
  trackSourceFile(inspectedFiles, sourceFile);
  if (!sourceFile) {
    return [];
  }

  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) => {
    const propertyAccess = call.getExpression().asKind(SyntaxKind.PropertyAccessExpression);
    if (!propertyAccess || !isBrowserControllerOpenCall(propertyAccess)) {
      return [];
    }

    const inputObject = call.getArguments()[0]?.asKind(SyntaxKind.ObjectLiteralExpression);
    return [{
      filePath: repoPath,
      line: call.getStartLineNumber(),
      reusePolicy: inputObject ? getObjectLiteralStringPropertyValue(inputObject, "reusePolicy") : null,
    }];
  });
};

export const inspectBrowserTabLifecycle = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): AmazonTabLifecycleDebug => {
  const pageNavigationCalls = PAGE_TAB_REUSE_FILES.flatMap((repoPath) => {
    const calls = collectBrowserOpenCalls(context, inspectedFiles, repoPath);
    if (calls.length === 0) {
      findings.push(createFinding({
        checkId: "amazon-mining/page-navigation-open-missing",
        lawId,
        filePath: repoPath,
        message: `${repoPath} must own a BrowserController.open call for page navigation.`,
      }));
      return [];
    }

    const invalidCalls = calls.filter((call) => call.reusePolicy !== "reuse-active-tab");
    for (const call of invalidCalls) {
      findings.push(createFinding({
        checkId: "amazon-mining/page-navigation-must-reuse-active-tab",
        lawId,
        filePath: call.filePath,
        line: call.line,
        message: "Amazon mining page navigation must set reusePolicy to reuse-active-tab to prevent Chrome tab explosion.",
        evidence: `reusePolicy=${call.reusePolicy ?? "<missing>"}`,
      }));
    }
    return calls;
  });

  const dedicatedWorkspaceTabCalls = FLOW_TAB_OWNER_FILES.flatMap((repoPath) =>
    collectBrowserOpenCalls(context, inspectedFiles, repoPath),
  );
  if (!dedicatedWorkspaceTabCalls.some((call) => call.reusePolicy === "open-new-tab")) {
    findings.push(createFinding({
      checkId: "amazon-mining/dedicated-workspace-tab-missing",
      lawId,
      filePath: FLOW_TAB_OWNER_FILE,
      message: "amazon-product-mining.flow.ts must create one dedicated workspace tab before page-loop navigation begins.",
      evidence: `reusePolicies=${dedicatedWorkspaceTabCalls.map((call) => call.reusePolicy ?? "<missing>").join(",") || "<none>"}`,
    }));
  }

  return {
    dedicatedWorkspaceTabCalls,
    pageNavigationCalls,
  };
};

export const buildAmazonMiningInspectorReport = (input: {
  findings: readonly InspectorFinding[];
  tabLifecycleDebug: AmazonTabLifecycleDebug;
}) => ({
  generatedAt: new Date().toISOString(),
  capabilityDomain: "amazon-product-mining",
  status: input.findings.length > 0 ? "FAIL" : "PASS",
  findingCount: input.findings.length,
  tabLifecycleDebug: input.tabLifecycleDebug,
});
