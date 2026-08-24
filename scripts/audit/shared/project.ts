import { Project } from "ts-morph";
import { resolve } from "node:path";

import { repoRoot } from "./paths.js";

export const createAuditProject = (root = repoRoot, targetPaths: readonly string[] = []): Project => {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
    },
  });

  const sourcePaths = targetPaths.filter((path) => /\.(?:[cm]?[jt]sx?)$/u.test(path));
  if (sourcePaths.length) project.addSourceFilesAtPaths(sourcePaths.map((path) => resolve(root, path)));

  return project;
};
