import type { Project } from "ts-morph";

import { classifyRepoPath, isCapabilityFacade } from "../../../shared/repo-path-classifier.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../../shared/source-files.js";

export const inspectCapabilityFacadeTypes = (input: {
  lawId: string;
  project: Project;
  pushFinding: (finding: {
    checkId: string; evidenceMode?: string; lawId: string; filePath: string; message: string;
  }) => void;
}): void => {
  for (const source of listActiveSourceFiles(input.project)) {
    const path = getRepoSourcePath(source);
    if (!isCapabilityFacade(classifyRepoPath(path))) continue;
    for (const symbol of source.getExportSymbols()) {
      const target = symbol.isAlias() ? symbol.getAliasedSymbol() : symbol;
      const declarations = target?.getDeclarations() ?? [];
      const type = declarations[0]?.getType().getText(declarations[0]) ?? "any";
      if (declarations.length && type !== "any") continue;
      input.pushFinding({
        checkId: "capability-group/untyped-facade-export",
        evidenceMode: "static.types",
        lawId: input.lawId,
        filePath: path,
        message: `${path} exports ${symbol.getName()} without a concrete declared type.`,
      });
    }
  }
};
