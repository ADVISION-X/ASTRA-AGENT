import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";

import { geometryGuardInspectionConfig as config } from "./inspection-constants.js";
import type { GeometryPresenceState } from "./inspection-types.js";
import { geometryGuardInspectionUtils as support } from "./inspection-utils.js";

type AuditProject = Parameters<typeof support.getSourceFile>[0];

export async function loadGeometryPresenceState(project: AuditProject): Promise<GeometryPresenceState> {
  const requiredPresence = await Promise.all(config.REQUIRED_FILES.map(async (filePath) => ({
    filePath,
    exists: Boolean(support.getSourceFile(project, filePath)) || await fileExists(pathFromRepoRoot(filePath)),
  })));
  const forbiddenPresence = await Promise.all(config.FORBIDDEN_FILES.map(async (filePath) => ({
    filePath,
    exists: await fileExists(pathFromRepoRoot(filePath)),
  })));
  const geometryFilePaths = await listFilesRecursive(pathFromRepoRoot(config.ROOT), { extensions: [".ts"] });
  return { requiredPresence, forbiddenPresence, geometryFilePaths };
}