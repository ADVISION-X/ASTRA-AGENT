import { writeJsonFile } from "./filesystem.js";
import { generatedArtifactPaths } from "./generated-artifact-paths.js";
import { pathFromRepoRoot } from "./paths.js";
import type { TouchedFilesArtifact } from "./touched-files.js";

export const writeTouchedFilesArtifact = async (artifact: TouchedFilesArtifact): Promise<void> => {
  await writeJsonFile(pathFromRepoRoot(generatedArtifactPaths.touchedFiles), artifact);
};
