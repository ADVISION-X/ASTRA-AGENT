import type { Project, SourceFile } from "ts-morph";

import { getRepoSourcePath, lineCountOf, listActiveSourceFiles } from "../../../shared/source-files.js";
import {
  resolveCodePurityBudget,
  resolveCodePurityOwner,
  resolveCodePurityRole,
  type CodePurityRole,
  type FileBudget,
} from "./code-purity-owner-model.js";

export type GovernedFile = {
  budget: FileBudget;
  lineCount: number;
  owner: string;
  repoPath: string;
  role: CodePurityRole;
  sourceFile: SourceFile;
};

export const collectCodePurityGovernedFiles = (project: Project): GovernedFile[] =>
  listActiveSourceFiles(project)
    .map((sourceFile) => {
      const repoPath = getRepoSourcePath(sourceFile);
      const role = resolveCodePurityRole(repoPath);
      return {
        budget: resolveCodePurityBudget(repoPath, role),
        lineCount: lineCountOf(sourceFile),
        owner: resolveCodePurityOwner(repoPath),
        repoPath,
        role,
        sourceFile,
      };
    })
    .sort((left, right) => left.repoPath.localeCompare(right.repoPath));
