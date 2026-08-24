import { Project } from "ts-morph";
import { resolve } from "node:path";

import { repoRoot } from "./paths.js";

export const createAuditProject = (root = repoRoot): Project => {
  const project = new Project({
    tsConfigFilePath: resolve(root, "tsconfig.json"),
    compilerOptions: {
      allowJs: true,
    },
  });

  project.addSourceFilesAtPaths([
    resolve(root, "src/**/*.js"),
    resolve(root, "src/**/*.jsx"),
    resolve(root, "src/**/*.mjs"),
    resolve(root, "scripts/**/*.js"),
    resolve(root, "scripts/**/*.jsx"),
    resolve(root, "scripts/**/*.mjs"),
  ]);

  return project;
};
