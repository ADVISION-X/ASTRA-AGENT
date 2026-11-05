import type { SourceModuleTarget } from "./source-module-targets.js";

const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs"] as const;

export const hasSourceExtension = (repoPath: string): boolean =>
  sourceExtensions.some((extension) => repoPath.endsWith(extension));

export const splitLines = (text: string): string[] => {
  const lines: string[] = [];
  let current = "";
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "\r") {
      if (text[index + 1] === "\n") {
        index += 1;
      }
      lines.push(current);
      current = "";
      continue;
    }
    if (character === "\n") {
      lines.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  lines.push(current);
  return lines;
};

export const pathSegments = (repoPath: string): string[] => repoPath.split("/").filter((segment) => segment.length > 0);

export const isPluginOwnerPath = (repoPath: string): boolean => {
  const segments = pathSegments(repoPath);
  return segments[0] === "src" && segments[1] === "plugins" && segments.length >= 3;
};

export const isCapabilityOwnerPath = (repoPath: string): boolean => {
  const segments = pathSegments(repoPath);
  return segments[0] === "src" && segments[1] === "capabilities" && segments.length >= 3;
};

export const isPrivateCapabilityRuntimePath = (repoPath: string): boolean => {
  const segments = pathSegments(repoPath);
  return isCapabilityOwnerPath(repoPath) && (segments[3] === "runtime" || segments[3] === "children");
};

export const isPublicCapabilityFacadePath = (repoPath: string): boolean => {
  const segments = pathSegments(repoPath);
  return isCapabilityOwnerPath(repoPath) && segments.length === 4 && segments[3] === "index.ts";
};

export const isTopLevelPluginFile = (repoPath: string): boolean => {
  const segments = pathSegments(repoPath);
  const fileName = segments[2] ?? "";
  return segments.length === 3
    && segments[0] === "src"
    && segments[1] === "plugins"
    && (fileName.endsWith(".ts") || fileName.endsWith(".tsx"));
};

const paperFactoryStepEntrypoints: Readonly<Record<string, string>> = {
  "src/plugins/c01-user-dialogue/index.ts": "executeUserDialogue",
  "src/plugins/s01-research-brief/index.ts": "executeResearchBrief",
  "src/plugins/s02-research-plan/index.ts": "executeResearchPlan",
  "src/plugins/s03-material-acquisition/index.ts": "executeMaterialAcquisition",
  "src/plugins/s04-evidence-processing/index.ts": "executeEvidenceProcessing",
  "src/plugins/s05-subtopic-research/index.ts": "executeSubtopicResearch",
  "src/plugins/s06-evidence-verification/index.ts": "executeEvidenceVerification",
  "src/plugins/s07-manuscript-authoring/index.ts": "executeManuscriptAuthoring",
  "src/plugins/s08-manuscript-review/index.ts": "executeManuscriptReview",
  "src/plugins/s09-originality-citation-check/index.ts": "executeOriginalityCitationCheck",
  "src/plugins/s10-research-package/index.ts": "executeResearchPackage",
};

export const isPaperFactoryStepImport = (sourcePath: string, target: SourceModuleTarget): boolean =>
  sourcePath === "src/plugins/s00-paper-factory/flow.ts"
  && target.edgeKind === "import" && !target.namespaceImport
  && target.namedBindings.length === 1
  && target.namedBindings[0] === paperFactoryStepEntrypoints[target.targetPath];
