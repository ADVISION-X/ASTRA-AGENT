import type { Finding, InspectorContext } from "../../../core/schema.js";
import type { SourceFile } from "ts-morph";

import { inspectRetiredMapSystem } from "./scan-retired-map-system.js";
import { inspectVisualStoryCoherence } from "./scan-visual-story-coherence.js";
import { inspectZombieScan } from "./zombie-scan/index.js";

type SecondaryScanInput = {
  repoRoot: string;
  relativePaths: string[];
  sourceFilesByPath: Map<string, SourceFile>;
};

export const inspectSecondaryCodePurityScans = async (
  context: Pick<InspectorContext, "repoRoot">,
  input: SecondaryScanInput,
): Promise<Finding[]> => {
  const { relativePaths, sourceFilesByPath } = input;
  return [
    ...(await inspectRetiredMapSystem(relativePaths, sourceFilesByPath)),
    ...(await inspectVisualStoryCoherence(relativePaths, sourceFilesByPath)),
    ...(await inspectZombieScan(context.repoRoot, relativePaths)),
  ];
};