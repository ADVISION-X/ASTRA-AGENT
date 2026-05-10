import type { SourceFile } from "ts-morph";

import type { Finding } from "../../core/schema.js";
import { inspectRetiredMapSystem } from "./components/scan-retired-map-system.js";
import { inspectVisualStoryCoherence } from "./components/scan-visual-story-coherence.js";
import { inspectZombieScan } from "./components/zombie-scan/index.js";

export const runSupplementalScans = async (
  repoRoot: string,
  relativePaths: string[],
  sourceFilesByPath: Map<string, SourceFile>,
): Promise<Finding[]> => [
  ...(await inspectRetiredMapSystem(relativePaths, sourceFilesByPath)),
  ...(await inspectVisualStoryCoherence(relativePaths, sourceFilesByPath)),
  ...(await inspectZombieScan(repoRoot, relativePaths)),
];