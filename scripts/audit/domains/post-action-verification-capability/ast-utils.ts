import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { hasLiteralTextFragment } from "../_shared/ast-literal-queries.js";
import { hasExportModuleSpecifier } from "../_shared/ast-module-path-queries.js";
import {
  createAuditProject,
  getSourceFileOrThrow,
  hasCallExpression,
  hasCallExpressionPath,
  hasImportModuleSpecifier,
} from "../_shared/ast-helpers.js";

export const ROOT = "src/capabilities/post-action-verification";
export const CHILDREN = [
  "verify-page-opened",
  "verify-comments-panel-opened",
  "verify-comments-panel-closed",
  "verify-video-changed-after-scroll",
  "verify-not-interested-result",
  "verify-target-state-changed",
] as const;

export const CANONICAL_FILES = [
  `${ROOT}/ability-group.ts`,
  `${ROOT}/contract.ts`,
  `${ROOT}/schema.ts`,
  `${ROOT}/registry.ts`,
  `${ROOT}/index.ts`,
  `${ROOT}/runtime/post-action-verification-executor.ts`,
  `${ROOT}/runtime/post-action-verification-runtime-context.ts`,
  `${ROOT}/runtime/verification-input-gate.ts`,
  `${ROOT}/runtime/post-action-payload-budget-gate.ts`,
  `${ROOT}/runtime/action-proof-gate.ts`,
  `${ROOT}/runtime/evidence-source-gate.ts`,
  `${ROOT}/runtime/observation-proof-binding-gate.ts`,
  `${ROOT}/runtime/before-after-consistency-gate.ts`,
  `${ROOT}/runtime/verification-policy-gate.ts`,
  `${ROOT}/runtime/verification-decision-gate.ts`,
  `${ROOT}/runtime/post-action-output-boundary-gate.ts`,
  `${ROOT}/runtime/verification-result-builder.ts`,
  `${ROOT}/runtime/verification-proof-builder.ts`,
  `${ROOT}/runtime/verification-dispatch-failure.ts`,
  `${ROOT}/runtime/verification-clock.ts`,
  `${ROOT}/ports/post-action-evidence-read-port.ts`,
  `${ROOT}/ports/post-action-verification-clock-port.ts`,
  `${ROOT}/shared/post-action-types.ts`,
  `${ROOT}/shared/post-action-policy.ts`,
  `${ROOT}/shared/post-action-result.ts`,
  `${ROOT}/shared/post-action-proof.ts`,
  `${ROOT}/shared/post-action-failure.ts`,
  `${ROOT}/shared/post-action-evidence.ts`,
  `${ROOT}/shared/post-action-observation.ts`,
  `${ROOT}/shared/post-action-url.ts`,
] as const;

export function createPostActionAuditProject(): Project {
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

export function getOwnedSources(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${ROOT}/`));
}

export function isThinAbilityGroup(sourceFile: SourceFile): boolean {
  return hasCallExpressionPath(sourceFile, ["PostActionVerificationAbilityInputSchema", "safeParse"])
    && hasCallExpression(sourceFile, "executePostActionVerification")
    && !hasCallExpression(sourceFile, "createSystemPostActionVerificationClock")
    && !hasLiteralTextFragment(sourceFile, "createInlinePostActionEvidenceReadPort");
}

export function hasForbiddenEscape(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => {
    if (Node.isAsExpression(node)) {
      const typeNode = node.getTypeNode();
      return typeNode?.getText() === "any" || node.getText().includes("as unknown as") || typeNode?.getText() === "never";
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
  if (repoPath === `${ROOT}/runtime/verification-clock.ts`) {
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

export function leaksPrivatePostActionPath(sourceFile: SourceFile): boolean {
  const repoPath = toRepoRelativePath(sourceFile.getFilePath());
  if (repoPath.startsWith(`${ROOT}/`) || repoPath.startsWith("scripts/audit/")) {
    return false;
  }

  return sourceFile.getImportDeclarations().some((declaration) => {
    const specifier = declaration.getModuleSpecifierValue();
    return specifier.includes("/capabilities/post-action-verification/runtime/") || specifier.includes("/capabilities/post-action-verification/children/");
  });
}

export function hasForbiddenCapabilityImport(sourceFile: SourceFile): boolean {
  return [
    "capabilities/ai/",
    "capabilities/screenshot/",
    "capabilities/visual-target/",
    "capabilities/mouse-click/",
    "capabilities/mouse-scroll/",
    "capabilities/open/",
    "capabilities/forensics-persistence/",
  ].some((marker) => hasImportModuleSpecifier(sourceFile, marker) || hasExportModuleSpecifier(sourceFile, marker));
}