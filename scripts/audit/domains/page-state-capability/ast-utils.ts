import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { createAuditProject, getSourceFileOrThrow, hasCallExpression, hasCallExpressionPath, hasExportModuleSpecifier, hasImportModuleSpecifier, hasLiteralTextFragment } from "../_shared/ast-helpers.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { fileExists } from "../../core/filesystem.js";

export const ROOT = "src/capabilities/page-state";
export const AUDIT_ROOT = "scripts/audit/domains/page-state-capability";
export const CHILDREN = [
  "detect-login-state",
  "detect-safety-page",
  "detect-feed-ready",
  "detect-video-stable",
  "detect-comment-panel-state",
  "detect-modal-overlay-state",
  "detect-page-abnormality",
  "detect-platform-page-kind",
] as const;

export const CANONICAL_FILES = [
  `${ROOT}/ability-group.ts`,
  `${ROOT}/contract.ts`,
  `${ROOT}/schema.ts`,
  `${ROOT}/registry.ts`,
  `${ROOT}/index.ts`,
  `${ROOT}/runtime/page-state-executor.ts`,
  `${ROOT}/runtime/page-state-runtime-context.ts`,
  `${ROOT}/runtime/page-state-input-gate.ts`,
  `${ROOT}/runtime/page-state-payload-budget-gate.ts`,
  `${ROOT}/runtime/observation-source-gate.ts`,
  `${ROOT}/runtime/observation-proof-binding-gate.ts`,
  `${ROOT}/runtime/snapshot-freshness-gate.ts`,
  `${ROOT}/runtime/platform-profile-gate.ts`,
  `${ROOT}/runtime/state-classification-gate.ts`,
  `${ROOT}/runtime/page-state-output-boundary-gate.ts`,
  `${ROOT}/runtime/proceed-decision-gate.ts`,
  `${ROOT}/runtime/page-state-fingerprint.ts`,
  `${ROOT}/runtime/page-state-result-builder.ts`,
  `${ROOT}/runtime/page-state-proof-builder.ts`,
  `${ROOT}/runtime/page-state-dispatch-failure.ts`,
  `${ROOT}/runtime/page-state-clock.ts`,
  `${ROOT}/ports/page-state-clock-port.ts`,
  `${ROOT}/ports/page-state-profile-port.ts`,
  `${ROOT}/shared/page-state-types.ts`,
  `${ROOT}/shared/page-state-policy.ts`,
  `${ROOT}/shared/page-state-result.ts`,
  `${ROOT}/shared/page-state-proof.ts`,
  `${ROOT}/shared/page-state-failure.ts`,
  `${ROOT}/shared/page-state-observation.ts`,
  `${ROOT}/shared/page-state-profile.ts`,
] as const;

export function createPageStateAuditProject(): Project {
  return createAuditProject();
}

export function getSource(project: Project, repoRelativePath: string): SourceFile {
  return getSourceFileOrThrow(project, repoRelativePath);
}

export async function missingCanonicalFiles(): Promise<string[]> {
  const missing: string[] = [];
  for (const path of CANONICAL_FILES) {
    if (!(await fileExists(pathFromRepoRoot(path)))) {
      missing.push(path);
    }
  }
  for (const childId of CHILDREN) {
    for (const suffix of ["contract.ts", "schema.ts", "implementation.ts"]) {
      const path = `${ROOT}/children/${childId}/${suffix}`;
      if (!(await fileExists(pathFromRepoRoot(path)))) {
        missing.push(path);
      }
    }
  }
  return missing;
}

export function getPageStateSources(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${ROOT}/`));
}

export function hasForbiddenEscape(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => {
    if (Node.isAsExpression(node)) {
      const typeNode = node.getTypeNode();
      return typeNode?.getText() === "any" || node.getText().includes("as unknown as");
    }
    return false;
  })
    || sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword)
    || sourceFile.getImportDeclarations().some((declaration) => declaration.getModuleSpecifierValue() === "require")
    || sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === "require")
    || hasLiteralTextFragment(sourceFile, "@ts-ignore")
    || hasLiteralTextFragment(sourceFile, "@ts-expect-error")
    || hasLiteralTextFragment(sourceFile, "eslint-disable");
}

export function hasDateOutsideClock(sourceFile: SourceFile): boolean {
  const repoPath = toRepoRelativePath(sourceFile.getFilePath());
  if (repoPath === `${ROOT}/runtime/page-state-clock.ts`) {
    return false;
  }

  return sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) => expression.getExpression().getText() === "Date")
    || sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((expression) => {
      const callee = expression.getExpression();
      return Node.isPropertyAccessExpression(callee)
        && callee.getExpression().getText() === "Date"
        && (callee.getName() === "now" || callee.getName() === "parse");
    });
}

export function isThinAbilityGroup(sourceFile: SourceFile): boolean {
  return hasCallExpressionPath(sourceFile, ["PageStateAbilityInputSchema", "safeParse"])
    && hasCallExpression(sourceFile, "executePageState")
    && !hasCallExpression(sourceFile, "createPageStateRegistry")
    && !hasCallExpression(sourceFile, "createSystemPageStateClock")
    && !hasCallExpression(sourceFile, "createDefaultPageStateProfilePort");
}

export function leaksPrivatePageStatePath(sourceFile: SourceFile): boolean {
  const repoPath = toRepoRelativePath(sourceFile.getFilePath());
  if (repoPath.startsWith(`${ROOT}/`) || repoPath.startsWith("scripts/audit/")) {
    return false;
  }

  return sourceFile.getImportDeclarations().some((declaration) => {
    const specifier = declaration.getModuleSpecifierValue();
    return specifier.includes("/capabilities/page-state/runtime/") || specifier.includes("/capabilities/page-state/children/");
  });
}

export function hasForbiddenCapabilityImport(sourceFile: SourceFile): boolean {
  return [
    "capabilities/ai",
    "capabilities/screenshot",
    "capabilities/visual-target",
    "capabilities/mouse-click",
    "capabilities/mouse-scroll",
    "capabilities/post-action-verification",
    "capabilities/forensics-persistence",
  ].some((marker) => hasImportModuleSpecifier(sourceFile, marker) || hasExportModuleSpecifier(sourceFile, marker));
}