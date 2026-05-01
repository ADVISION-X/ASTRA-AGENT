import type { SourceFile } from "ts-morph";

import { getImportedSourcePaths } from "./purity-import-analysis.js";

const splitRelativePath = (relativePath: string): string[] =>
  relativePath.split("/").filter((segment) => segment.length > 0);

const getLibOwner = (libSegment: string): string => {
  const libOwners: Record<string, string> = {
    browser: "browser-primitive-adapter",
    "local-ai": "ai-runtime-adapter",
    "local-runtime": "local-runtime-composition-root",
    storage: "forensics-storage-adapter",
  };
  return libOwners[libSegment] ?? libSegment;
};

const getDirectSrcOwner = (parts: string[]): string | undefined => {
  if (parts[0] !== "src") {
    return undefined;
  }
  if (parts[1] === "map-plugins") {
    return "map-plugin-package";
  }
  if (parts[1] === "app") {
    return "commander-console";
  }
  if (parts[1] === "types") {
    return "types";
  }
  return undefined;
};

const getNestedSrcOwner = (parts: string[]): string | undefined =>
  parts[0] !== "src"
    ? undefined
    : parts[1] === "capabilities" || parts[1] === "features"
      ? parts[2]
      : parts[1] === "lib" && parts[2] === "storage" && parts[3] === "evidence-store"
        ? "forensics-storage-adapter"
        : parts[1] === "lib" && parts[2]
          ? getLibOwner(parts[2])
          : undefined;

const getSrcOwner = (parts: string[]): string | undefined =>
  getDirectSrcOwner(parts) ?? getNestedSrcOwner(parts);

const getScriptOwner = (parts: string[]): string | undefined => {
  if (parts[0] === "scripts" && parts[1] === "audit" && parts[2] === "domains" && parts[3]) {
    return parts[3];
  }
  if (parts[0] === "scripts" && parts[1] === "startup") {
    return "startup-entrypoint";
  }
  return undefined;
};

const getModuleOwner = (parts: string[]): string | undefined =>
  getSrcOwner(parts) ?? getScriptOwner(parts);

export const classifyOwnerBoundary = (relativePath: string): string => {
  const parts = splitRelativePath(relativePath);
  if (parts[0] === "src" && parts[1] === "types") {
    return "type-only";
  }
  return getModuleOwner(parts) ?? "unknown";
};

export const getImportedOwnerBoundaries = (sourceFile: SourceFile, relativePath: string): string[] => {
  const localOwner = classifyOwnerBoundary(relativePath);
  const owners = new Set<string>();
  for (const importedPath of getImportedSourcePaths(sourceFile)) {
    const owner = classifyOwnerBoundary(importedPath);
    if (owner === "unknown" || owner === "types" || owner === localOwner) {
      continue;
    }
    owners.add(owner);
  }

  return [...owners].sort((left, right) => left.localeCompare(right));
};
