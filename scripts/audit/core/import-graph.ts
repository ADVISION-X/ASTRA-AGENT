import type { SourceFile } from "ts-morph";

import { toRepoRelativePath } from "./paths.js";

type ImportGraphFinding = {
  file: string;
  line: number;
  message: string;
};

const CAPABILITY_DOMAIN_BY_GROUP: Record<string, string> = {
  ai: "ai-capability",
  "commander-console": "commander-console-capability",
  "dom-automation": "dom-automation",
  "forensics-persistence": "forensics-persistence-capability",
  "geometry-guard": "geometry-guard-capability",
  "mouse-click": "mouse-click-capability",
  "mouse-scroll": "mouse-scroll-capability",
  "nerve-bus": "nerve-bus-capability",
  open: "open-capability",
  orchestration: "orchestration-capability",
  screenshot: "screenshot-capability",
  "text-input": "text-input-capability",
};

const DOMAIN_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ["src/lib/runtime-logs/", "runtime-logging"],
  ["src/lib/browser/", "security-privacy"],
  ["src/lib/storage/", "forensics-persistence-capability"],
  ["src/types/", "type-safety"],
];

const isPrivateOwnerPath = (repoRelativePath: string): boolean =>
  /\/(children|runtime|shared)\//.test(repoRelativePath);

const isTestLikeTarget = (targetPath: string): boolean =>
  /scripts\/acceptance/.test(targetPath) ||
  /(^|\/)(verify|smoke)(\/|$)/.test(targetPath) ||
  /(^|[/.])smoke([.-]|$)/.test(targetPath) ||
  /(^|[/.])capability-check([.-]|$)/.test(targetPath);

export const inferDomainFromPath = (repoRelativePath: string): string | null => {
  const capabilityMatch = repoRelativePath.match(/^src\/capabilities\/([^/]+)/);
  if (capabilityMatch) {
    const capabilityGroup = capabilityMatch[1];
    return capabilityGroup ? CAPABILITY_DOMAIN_BY_GROUP[capabilityGroup] ?? null : null;
  }
  const domainPrefix = DOMAIN_PREFIXES.find(([prefix]) => repoRelativePath.startsWith(prefix));
  if (domainPrefix) return domainPrefix[1];
  if (repoRelativePath.startsWith("scripts/audit/domains/")) {
    const domainName = repoRelativePath.split("/")[3];
    return domainName === "shared" ? null : domainName ?? null;
  }
  return null;
};

export const collectPrivateCrossOwnerImportFindings = (
  sourceFiles: SourceFile[],
  capabilityDomain: string,
  allowedCrossOwnerImports: string[] = [],
): ImportGraphFinding[] => {
  const findings: ImportGraphFinding[] = [];
  for (const sourceFile of sourceFiles) {
    const filePath = toRepoRelativePath(sourceFile.getFilePath());
    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const specifier = importDeclaration.getModuleSpecifierValue();
      if (allowedCrossOwnerImports.some((allowed) => specifier.includes(allowed))) continue;
      const targetFile = importDeclaration.getModuleSpecifierSourceFile();
      if (!targetFile) continue;
      const targetPath = toRepoRelativePath(targetFile.getFilePath());
      const targetDomain = inferDomainFromPath(targetPath);
      if (!targetDomain || targetDomain === capabilityDomain) continue;
      if (!isPrivateOwnerPath(targetPath)) continue;
      findings.push({
        file: filePath,
        line: importDeclaration.getStartLineNumber(),
        message: `private cross-owner import into ${targetDomain}: ${targetPath}`,
      });
    }
  }
  return findings;
};

export const collectCapabilityGroupPrivateImportFindings = (sourceFiles: SourceFile[]): ImportGraphFinding[] => {
  const findings: ImportGraphFinding[] = [];
  for (const sourceFile of sourceFiles) {
    const filePath = toRepoRelativePath(sourceFile.getFilePath());
    const sourceDomain = inferDomainFromPath(filePath);
    if (!sourceDomain) continue;
    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const targetFile = importDeclaration.getModuleSpecifierSourceFile();
      if (!targetFile) continue;
      const targetPath = toRepoRelativePath(targetFile.getFilePath());
      const targetDomain = inferDomainFromPath(targetPath);
      if (!targetDomain || targetDomain === sourceDomain) continue;
      if (!isPrivateOwnerPath(targetPath)) continue;
      findings.push({
        file: filePath,
        line: importDeclaration.getStartLineNumber(),
        message: `cross-group private import from ${sourceDomain} into ${targetDomain}: ${targetPath}`,
      });
    }
  }
  return findings;
};

export const collectForbiddenTargetImportFindings = (sourceFiles: SourceFile[]): ImportGraphFinding[] => {
  const findings: ImportGraphFinding[] = [];
  for (const sourceFile of sourceFiles) {
    const filePath = toRepoRelativePath(sourceFile.getFilePath());
    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const specifier = importDeclaration.getModuleSpecifierValue();
      const targetPath = importDeclaration.getModuleSpecifierSourceFile()
        ? toRepoRelativePath(importDeclaration.getModuleSpecifierSourceFileOrThrow().getFilePath())
        : specifier;
      if (!isTestLikeTarget(targetPath) && !isTestLikeTarget(specifier)) continue;
      findings.push({
        file: filePath,
        line: importDeclaration.getStartLineNumber(),
        message: `owner code imports forbidden verify/smoke target: ${specifier}`,
      });
    }
  }
  return findings;
};
