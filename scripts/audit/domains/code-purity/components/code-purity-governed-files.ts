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

const ignoredPathSegments = new Set(["test", "tests", "fixture", "fixtures", "__tests__"]);
const fixtureFileExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs"];

const hasIgnoredSegment = (repoPath: string): boolean =>
  repoPath.split("/").some((segment) => ignoredPathSegments.has(segment));

const hasFixtureSuffix = (repoPath: string): boolean =>
  fixtureFileExtensions.some((extension) => repoPath.endsWith(`.fixture${extension}`));

const isGovernedPath = (repoPath: string): boolean => !hasIgnoredSegment(repoPath) && !hasFixtureSuffix(repoPath);

export const collectCodePurityGovernedFiles = (project: Project): GovernedFile[] =>
  listActiveSourceFiles(project)
    .filter((sourceFile) => isGovernedPath(getRepoSourcePath(sourceFile)))
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