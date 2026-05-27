import type { SourceFile } from "ts-morph";

import { getRepoSourcePath } from "../../../shared/source-files.js";

export const normalizeAuditTruthPath = (repoPath: string): string => {
  if (repoPath.startsWith("scripts/")) {
    return repoPath;
  }
  const markerIndex = repoPath.indexOf("/scripts/");
  return markerIndex >= 0 ? repoPath.slice(markerIndex + 1) : repoPath;
};

const splitAuditTruthPath = (repoPath: string): string[] => {
  const segments: string[] = [];
  let currentSegment = "";
  for (const character of normalizeAuditTruthPath(repoPath)) {
    if (character === "/") {
      segments.push(currentSegment);
      currentSegment = "";
      continue;
    }
    currentSegment += character;
  }
  segments.push(currentSegment);
  return segments;
};

export const isOwnerInspectorRepoPath = (repoPath: string): boolean => {
  const segments = splitAuditTruthPath(repoPath);
  return segments.length === 5
    && segments[0] === "scripts"
    && segments[1] === "audit"
    && segments[2] === "domains"
    && segments[4] === "inspector.ts";
};

export const isAuditTruthAuditScopeRepoPath = (repoPath: string): boolean => {
  const normalizedPath = normalizeAuditTruthPath(repoPath);
  return normalizedPath.startsWith("scripts/audit/domains/") || normalizedPath.startsWith("scripts/audit/shared/");
};

const hasAuditImport = (sourceFile: SourceFile): boolean =>
  sourceFile.getImportDeclarations().some((declaration) => {
    const moduleSpecifier = declaration.getModuleSpecifierValue();
    return moduleSpecifier === "../audit" || moduleSpecifier.startsWith("../audit/");
  });

export const isAuditTruthAcceptanceProofFile = (sourceFile: SourceFile): boolean => {
  const repoPath = normalizeAuditTruthPath(getRepoSourcePath(sourceFile));
  return repoPath.startsWith("scripts/acceptance/") && hasAuditImport(sourceFile);
};

export const isAuditTruthScanScopeFile = (sourceFile: SourceFile): boolean => {
  const repoPath = getRepoSourcePath(sourceFile);
  return isAuditTruthAuditScopeRepoPath(repoPath) || isAuditTruthAcceptanceProofFile(sourceFile);
};

export const isAuditTruthMetaQualityScopeFile = (sourceFile: SourceFile): boolean => {
  const repoPath = normalizeAuditTruthPath(getRepoSourcePath(sourceFile));
  return repoPath.startsWith("scripts/audit/domains/audit-truth/") || isAuditTruthAcceptanceProofFile(sourceFile);
};