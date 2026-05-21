import { Project } from "ts-morph";

import { resolveFromRepo } from "./paths.js";

export const createAuditProject = (): Project =>
  new Project({
    tsConfigFilePath: resolveFromRepo("tsconfig.json"),
  });