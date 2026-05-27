import { readFileSync } from "node:fs";

import { splitLines } from "../../../shared/no-regex.js";
import { resolveFromRepo } from "../../../shared/paths.js";

export const capabilityGovernanceLawPath = ".github/instructions/agent-rules/modules/module-capability-group-governance.instructions.md";
export const capabilityGovernanceBlueprintPath = "docs/法案辅助文件/GrassEye 能力组与子能力总纲施工图.md";

type BlueprintAbilityDeclaration = {
  label: string;
  ownerPath: string | null;
};

export type CapabilityFacadePolicy = {
  allowedPublicChildFunctionExports?: ReadonlySet<string>;
  mode: "factory-contract" | "public-child-functions";
};

export type CapabilitySourceOfTruth = {
  blueprintDeclaredAbilities: BlueprintAbilityDeclaration[];
  lawActiveCapabilityRoots: string[];
  lawInfrastructureRoots: string[];
};

const domPublicChildFunctionExports = new Set([
  "readDomSnapshotOnce",
  "locateDomElementOnce",
  "fillDomElementOnce",
  "clickDomElementOnce",
  "uploadApprovedFileOnce",
  "waitForDomStateOnce",
  "verifyDomStateOnce",
]);

const readRepoText = (repoPath: string): string => readFileSync(resolveFromRepo(repoPath), "utf8");

const trimBulletPrefix = (line: string): string => line.startsWith("- ") ? line.slice(2).trim() : line.trim();

const normalizeCapabilityRootPattern = (value: string): string =>
  value.endsWith("/**") ? value.slice(0, -3) : value;

const firstHeadingIndex = (lines: readonly string[], marker: string): number =>
  lines.findIndex((line) => line.trim() === marker);

const nextFenceIndex = (lines: readonly string[], startIndex: number): number =>
  lines.findIndex((line, index) => index > startIndex && line.trim().startsWith("```"));

const extractCodeBlockItemsAfterMarker = (documentText: string, marker: string): string[] => {
  const lines = splitLines(documentText);
  const markerIndex = firstHeadingIndex(lines, marker);
  if (markerIndex < 0) {
    return [];
  }
  const openingFenceIndex = nextFenceIndex(lines, markerIndex);
  if (openingFenceIndex < 0) {
    return [];
  }
  const closingFenceIndex = lines.findIndex((line, index) => index > openingFenceIndex && line.trim() === "```");
  if (closingFenceIndex < 0) {
    return [];
  }
  return lines
    .slice(openingFenceIndex + 1, closingFenceIndex)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .sort();
};

const extractBulletLabelsUnderHeading = (documentText: string, heading: string): string[] => {
  const lines = splitLines(documentText);
  const headingIndex = firstHeadingIndex(lines, heading);
  if (headingIndex < 0) {
    return [];
  }

  const labels: string[] = [];
  for (const line of lines.slice(headingIndex + 1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      break;
    }
    if (!trimmed.startsWith("- ")) {
      continue;
    }
    const content = trimBulletPrefix(trimmed);
    const colonIndex = content.indexOf(":") >= 0 ? content.indexOf(":") : content.indexOf("：");
    labels.push((colonIndex >= 0 ? content.slice(0, colonIndex) : content).trim());
  }
  return labels;
};

const normalizeBlueprintAbilityLabel = (label: string): string =>
  label
    .toLowerCase()
    .split("/")
    .map((part) => part.trim())
    .join(" / ");

const mapBlueprintAbilityLabelToOwnerPath = (label: string): string | null => {
  switch (normalizeBlueprintAbilityLabel(label)) {
    case "dom automation":
      return "src/capabilities/dom-automation";
    case "browser":
      return "src/lib/browser";
    case "ai input gateway / choice judge":
      return "src/capabilities/ai-input-gateway";
    case "evidence store / forensics persistence":
    case "evidence store":
      return "src/capabilities/forensics-persistence";
    case "runtime logs":
      return "src/lib/runtime-logs";
    case "video download":
      return "src/capabilities/video-download";
    default:
      return null;
  }
};

const uniqueSorted = (values: readonly string[]): string[] => [...new Set(values)].sort();

export const loadCapabilitySourceOfTruth = (): CapabilitySourceOfTruth => {
  const lawText = readRepoText(capabilityGovernanceLawPath);
  const blueprintText = readRepoText(capabilityGovernanceBlueprintPath);
  const lawActiveCapabilityRoots = extractCodeBlockItemsAfterMarker(lawText, "Approved active ability groups:");
  const lawInfrastructureRoots = extractCodeBlockItemsAfterMarker(
    lawText,
    "Approved infrastructure roots that are not ability groups:",
  );
  const blueprintDeclaredAbilities = extractBulletLabelsUnderHeading(
    blueprintText,
    "## 3. 当前现役能力组",
  ).map((label) => ({
    label,
    ownerPath: mapBlueprintAbilityLabelToOwnerPath(label),
  }));

  return {
    blueprintDeclaredAbilities,
    lawActiveCapabilityRoots: uniqueSorted(lawActiveCapabilityRoots.map(normalizeCapabilityRootPattern)),
    lawInfrastructureRoots: uniqueSorted(lawInfrastructureRoots.map(normalizeCapabilityRootPattern)),
  };
};

export const resolveCapabilityFacadePolicy = (capabilityRoot: string): CapabilityFacadePolicy => {
  if (capabilityRoot === "src/capabilities/dom-automation") {
    return {
      mode: "public-child-functions",
      allowedPublicChildFunctionExports: domPublicChildFunctionExports,
    };
  }
  return {
    mode: "factory-contract",
  };
};
