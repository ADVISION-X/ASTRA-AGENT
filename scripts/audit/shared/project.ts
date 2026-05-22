import { Project } from "ts-morph";

import { resolveFromRepo } from "./paths.js";

export const createAuditProject = (): Project => {
  const project = new Project({
    tsConfigFilePath: resolveFromRepo("tsconfig.json"),
  });

  project.addSourceFilesAtPaths([
    resolveFromRepo("src/**/*.js"),
    resolveFromRepo("src/**/*.jsx"),
    resolveFromRepo("src/**/*.mjs"),
    resolveFromRepo("scripts/**/*.js"),
    resolveFromRepo("scripts/**/*.jsx"),
    resolveFromRepo("scripts/**/*.mjs"),
  ]);

  return project;
};