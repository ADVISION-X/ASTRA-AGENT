import { readFileSync } from "node:fs";
import { extname } from "node:path";

import { resolveFromRepo, toRepoPath } from "../../../shared/paths.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import {
  isLawfulManifestEntryFile,
  type ZombieExemptionManifest,
} from "./zombie-exemption-manifest.js";

export type ZombieLiveEntryPoint = {
  entryKind: "manifest" | "owner-inspector" | "package-script";
  filePath: string;
  reason: string;
  scriptName: string | null;
};

type GeneratedPlanLike = {
  ownerInspectorPath: string;
};

const sourceEntryExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

const unwrapQuotedToken = (token: string): string => {
  let current = token.trim();
  if (current.length >= 2) {
    const first = current[0];
    const last = current[current.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      current = current.slice(1, -1);
    }
  }
  return current;
};

const splitPackageScriptCommand = (command: string): string[] => {
  const tokens: string[] = [];
  let currentToken = "";
  let quote: '"' | "'" | undefined;

  for (const character of command) {
    if ((character === '"' || character === "'") && quote === undefined) {
      quote = character;
      currentToken += character;
      continue;
    }
    if (character === quote) {
      quote = undefined;
      currentToken += character;
      continue;
    }
    if (quote === undefined && (character === " " || character === "\t" || character === "\n")) {
      if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = "";
      }
      continue;
    }
    currentToken += character;
  }

  if (currentToken.length > 0) {
    tokens.push(currentToken);
  }
  return tokens;
};

const normalizeEntrypointToken = (token: string): string | null => {
  const unwrapped = unwrapQuotedToken(token);
  const candidate = unwrapped.includes("=") ? unwrapQuotedToken(unwrapped.split("=").at(-1) ?? "") : unwrapped;
  if (!candidate) {
    return null;
  }

  let repoPath = candidate.replaceAll("\\", "/");
  if (repoPath.startsWith("./")) {
    repoPath = repoPath.slice(2);
  }
  if (repoPath.startsWith("../")) {
    repoPath = toRepoPath(resolveFromRepo(repoPath));
  }
  if (!sourceEntryExtensions.has(extname(repoPath))) {
    return null;
  }
  return repoPath;
};

const readPackageJsonScripts = (): Record<string, string> => {
  const parsed = JSON.parse(readFileSync(resolveFromRepo("package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  return parsed.scripts ?? {};
};

export const collectZombieLiveEntrypoints = (input: {
  generatedPlan: readonly GeneratedPlanLike[];
  governedFiles: readonly GovernedFile[];
  manifest: ZombieExemptionManifest;
  packageScripts?: Readonly<Record<string, string>> | undefined;
}): {
  entryFiles: Set<string>;
  liveEntryPoints: ZombieLiveEntryPoint[];
} => {
  const governedPathSet = new Set(input.governedFiles.map((governedFile) => governedFile.repoPath));
  const entryFiles = new Set<string>();
  const liveEntryPoints: ZombieLiveEntryPoint[] = [];

  for (const [scriptName, command] of Object.entries(input.packageScripts ?? readPackageJsonScripts())) {
    for (const token of splitPackageScriptCommand(command)) {
      const entryPath = normalizeEntrypointToken(token);
      if (!entryPath || !governedPathSet.has(entryPath) || entryFiles.has(entryPath)) {
        continue;
      }
      entryFiles.add(entryPath);
      liveEntryPoints.push({
        entryKind: "package-script",
        filePath: entryPath,
        reason: `package.json script ${scriptName}`,
        scriptName,
      });
    }
  }

  for (const planEntry of input.generatedPlan) {
    if (!governedPathSet.has(planEntry.ownerInspectorPath) || entryFiles.has(planEntry.ownerInspectorPath)) {
      continue;
    }
    entryFiles.add(planEntry.ownerInspectorPath);
    liveEntryPoints.push({
      entryKind: "owner-inspector",
      filePath: planEntry.ownerInspectorPath,
      reason: "generated-plan owner inspector dynamic load",
      scriptName: null,
    });
  }

  for (const governedFile of input.governedFiles) {
    if (!isLawfulManifestEntryFile(input.manifest, governedFile.repoPath) || entryFiles.has(governedFile.repoPath)) {
      continue;
    }
    entryFiles.add(governedFile.repoPath);
    liveEntryPoints.push({
      entryKind: "manifest",
      filePath: governedFile.repoPath,
      reason: "explicit lawful external entry manifest",
      scriptName: null,
    });
  }

  return {
    entryFiles,
    liveEntryPoints: liveEntryPoints.sort((left, right) => left.filePath.localeCompare(right.filePath)),
  };
};