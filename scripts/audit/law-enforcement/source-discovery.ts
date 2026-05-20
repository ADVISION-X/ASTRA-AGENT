import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { LawRecord, OwnerManifest } from "../core/schema.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../core/paths.js";

export type DiscoveredLawSourceKind = "law" | "blueprint" | "manifest" | "generated";

export type DiscoveredLawSource = {
  readonly filePath: string;
  readonly sourceKind: DiscoveredLawSourceKind;
  readonly capabilityDomain: string | null;
  readonly relatedLawIds: readonly string[];
};

type LinkedBlueprint = {
  readonly capabilityDomain: string;
  readonly lawIds: readonly string[];
};

const walkFiles = (
  dirPath: string,
  matcher: (fileName: string) => boolean,
  acc: string[] = [],
): string[] => {
  if (!existsSync(dirPath)) return acc;
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const nextPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(nextPath, matcher, acc);
      continue;
    }
    if (entry.isFile() && matcher(entry.name)) {
      acc.push(nextPath);
    }
  }
  return acc;
};

const toSortedRelativePaths = (paths: string[]): string[] =>
  paths
    .map((filePath) => toRepoRelativePath(filePath))
    .sort((left, right) => left.localeCompare(right));

const parseApplyToPatterns = (instructionFile: string): string[] => {
  const text = readFileSync(pathFromRepoRoot(instructionFile), "utf8");
  const applyToLine = text.match(/^applyTo:\s*(.+)$/m)?.[1]?.trim();
  if (!applyToLine) return [];
  const normalized = applyToLine.replace(/^"|"$/g, "");
  return normalized
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.startsWith("docs/法案辅助文件/"));
};

const globToRegExp = (pattern: string): RegExp => {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "__DOUBLE_STAR__")
    .replace(/\*/g, "[^/]*")
    .replace(/__DOUBLE_STAR__/g, ".*");
  return new RegExp(`^${escaped}$`);
};

const appendBlueprintLink = (
  linkedBlueprints: Map<string, LinkedBlueprint>,
  filePath: string,
  capabilityDomain: string,
  lawIds: readonly string[],
): void => {
  const current = linkedBlueprints.get(filePath);
  if (current) {
    linkedBlueprints.set(filePath, {
      capabilityDomain: current.capabilityDomain,
      lawIds: [...new Set([...current.lawIds, ...lawIds])].sort((left, right) => left.localeCompare(right)),
    });
    return;
  }

  linkedBlueprints.set(filePath, {
    capabilityDomain,
    lawIds: [...new Set(lawIds)].sort((left, right) => left.localeCompare(right)),
  });
};

const discoverInstructionFiles = (): string[] =>
  toSortedRelativePaths(
    walkFiles(pathFromRepoRoot(".github/instructions"), (fileName) => fileName.endsWith(".instructions.md")),
  );

const discoverBlueprintFiles = (): string[] =>
  toSortedRelativePaths(
    walkFiles(pathFromRepoRoot("docs/法案辅助文件"), (fileName) => fileName.endsWith(".md")),
  );

const discoverGeneratedFiles = (): string[] =>
  toSortedRelativePaths(
    walkFiles(pathFromRepoRoot("scripts/audit/generated"), (fileName) => fileName.endsWith(".json") || fileName.endsWith(".jsonc")),
  );

const groupLawsByFile = (laws: LawRecord[]): Map<string, LawRecord[]> => {
  const lawsByFile = new Map<string, LawRecord[]>();
  for (const law of laws) {
    lawsByFile.set(law.lawFile, [...(lawsByFile.get(law.lawFile) ?? []), law]);
  }
  return lawsByFile;
};

const linkManifestBlueprints = (
  manifests: OwnerManifest[],
  linkedBlueprints: Map<string, LinkedBlueprint>,
): void => {
  for (const manifest of manifests) {
    for (const blueprintFile of manifest.readsBlueprintFiles ?? []) {
      appendBlueprintLink(linkedBlueprints, blueprintFile, manifest.capabilityDomain, manifest.allowedLawIds);
    }
  }
};

const linkApplyToBlueprints = (input: {
  instructionFiles: string[];
  blueprintFiles: string[];
  lawsByFile: Map<string, LawRecord[]>;
  linkedBlueprints: Map<string, LinkedBlueprint>;
}): void => {
  for (const instructionFile of input.instructionFiles) {
    const fileLaws = input.lawsByFile.get(instructionFile) ?? [];
    if (fileLaws.length === 0) continue;
    const lawIds = fileLaws.map((law) => law.lawId);
    for (const pattern of parseApplyToPatterns(instructionFile)) {
      const matcher = globToRegExp(pattern);
      for (const blueprintFile of input.blueprintFiles.filter((filePath) => matcher.test(filePath))) {
        appendBlueprintLink(input.linkedBlueprints, blueprintFile, fileLaws[0]?.capabilityDomain ?? "unknown", lawIds);
      }
    }
  }
};

const buildLawSources = (
  instructionFiles: string[],
  lawsByFile: Map<string, LawRecord[]>,
): DiscoveredLawSource[] => instructionFiles.map((filePath) => ({
  filePath,
  sourceKind: "law" as const,
  capabilityDomain: lawsByFile.get(filePath)?.[0]?.capabilityDomain ?? null,
  relatedLawIds: (lawsByFile.get(filePath) ?? []).map((law) => law.lawId),
}));

const buildBlueprintSources = (
  blueprintFiles: string[],
  linkedBlueprints: Map<string, LinkedBlueprint>,
): DiscoveredLawSource[] => blueprintFiles.map((filePath) => ({
  filePath,
  sourceKind: "blueprint" as const,
  capabilityDomain: linkedBlueprints.get(filePath)?.capabilityDomain ?? null,
  relatedLawIds: linkedBlueprints.get(filePath)?.lawIds ?? [],
}));

const buildManifestSources = (manifests: OwnerManifest[]): DiscoveredLawSource[] =>
  manifests
    .map((manifest) => ({
      filePath: `scripts/audit/domains/${manifest.capabilityDomain}/manifest.json`,
      sourceKind: "manifest" as const,
      capabilityDomain: manifest.capabilityDomain,
      relatedLawIds: manifest.allowedLawIds,
    }))
    .sort((left, right) => left.filePath.localeCompare(right.filePath));

const buildGeneratedSources = (
  generatedFiles: string[],
  laws: LawRecord[],
): DiscoveredLawSource[] => generatedFiles.map((filePath) => ({
  filePath,
  sourceKind: "generated" as const,
  capabilityDomain: null,
  relatedLawIds: filePath.endsWith("active-law-census.generated.json")
    || filePath.endsWith("owner-inspector-matrix.generated.json")
    ? laws.map((law) => law.lawId)
    : [],
}));

export const discoverLawSources = (
  laws: LawRecord[],
  manifests: OwnerManifest[],
): {
  sources: DiscoveredLawSource[];
  unmappedBlueprints: string[];
} => {
  const instructionFiles = discoverInstructionFiles();
  const blueprintFiles = discoverBlueprintFiles();
  const lawsByFile = groupLawsByFile(laws);
  const linkedBlueprints = new Map<string, LinkedBlueprint>();
  linkManifestBlueprints(manifests, linkedBlueprints);
  linkApplyToBlueprints({ instructionFiles, blueprintFiles, lawsByFile, linkedBlueprints });

  const blueprintSources = buildBlueprintSources(blueprintFiles, linkedBlueprints);
  return {
    sources: [
      ...buildLawSources(instructionFiles, lawsByFile),
      ...blueprintSources,
      ...buildManifestSources(manifests),
      ...buildGeneratedSources(discoverGeneratedFiles(), laws),
    ]
      .sort((left, right) => left.filePath.localeCompare(right.filePath)),
    unmappedBlueprints: blueprintSources
      .filter((source) => source.relatedLawIds.length === 0)
      .map((source) => source.filePath),
  };
};
