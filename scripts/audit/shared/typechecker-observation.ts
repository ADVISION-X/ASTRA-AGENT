import { createHash } from "node:crypto";
import type { Project } from "ts-morph";

import { getRepoSourcePath, listActiveSourceFiles } from "./source-files.js";

export const observeTypeCheckerRelations = (
  project: Project, targetPaths?: readonly string[],
): string => {
  const targets = targetPaths ? new Set(targetPaths) : null;
  const relations = listActiveSourceFiles(project)
    .filter((sourceFile) => targets === null || targets.has(getRepoSourcePath(sourceFile)))
    .map((sourceFile) => {
      const repoPath = getRepoSourcePath(sourceFile);
      const exports = sourceFile.getExportSymbols().map((symbol) => {
        const target = symbol.isAlias() ? symbol.getAliasedSymbol() : symbol;
        const declaration = target?.getDeclarations()[0];
        return `${symbol.getName()}:${declaration?.getType().getText(declaration) ?? "missing"}`;
      }).sort();
      return `${repoPath}\0${exports.length ? exports.join("\0") : "no-exports"}`;
    }).sort();
  if (!relations.length) throw new Error("TYPECHECKER_OBSERVATION_EMPTY");
  return `typechecker:${createHash("sha256").update(relations.join("\0")).digest("hex")}`;
};
