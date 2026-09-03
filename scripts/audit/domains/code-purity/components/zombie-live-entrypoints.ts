import { readFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

import { resolveFromRepo, toRepoPath } from "../../../shared/paths.js";
import type { GovernedFile } from "./code-purity-governed-files.js";

export type ZombieLiveEntryPoint = {
  entryKind: "native-child-process" | "native-config" | "owner-inspector" | "package-script";
  filePath: string;
  reason: string;
  scriptName: string | null;
};

type GeneratedPlanLike = {
  ownerInspectorPath: string;
};

type LiveEntrypointInput = {
  generatedPlan: readonly GeneratedPlanLike[];
  governedFiles: readonly GovernedFile[];
  packageScripts?: Readonly<Record<string, string>> | undefined;
  sealedRoot: string;
  targetPaths: readonly string[];
};

type LiveEntryState = {
  entryFiles: Set<string>;
  liveEntryPoints: ZombieLiveEntryPoint[];
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

const spawnedDirectoryEntries = (
  sourceFile: GovernedFile,
  governedPathSet: ReadonlySet<string>,
): string[] => {
  const source = sourceFile.sourceFile.getFullText();
  if (!source.includes('from "node:child_process"')
    || !source.includes("spawnSync(process.execPath")
    || !source.includes('from "node:fs"')
    || !source.includes("readdirSync(")) return [];
  const entries = new Set<string>();
  for (const match of source.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*resolve\(\s*["']([^"']+)["']\s*\)/gu)) {
    const directoryVariable = match[1]!;
    const directory = match[2]!.replace(/^\.\//u, "").replace(/\/$/u, "");
    if (!source.includes(`readdirSync(${directoryVariable})`)
      || !source.includes(`resolve(${directoryVariable},`)) continue;
    for (const suffixMatch of source.matchAll(/\.endsWith\(\s*["']([^"']+)["']\s*\)/gu)) {
      const suffix = suffixMatch[1]!;
      for (const path of governedPathSet) {
        if (path.startsWith(`${directory}/`) && path.endsWith(suffix)) entries.add(path);
      }
    }
  }
  return [...entries];
};

const addLiveEntry = (
  state: LiveEntryState,
  entry: ZombieLiveEntryPoint,
): void => {
  if (state.entryFiles.has(entry.filePath)) return;
  state.entryFiles.add(entry.filePath);
  state.liveEntryPoints.push(entry);
};

const addPackageEntries = (
  state: LiveEntryState,
  governedPathSet: ReadonlySet<string>,
  packageScripts: Readonly<Record<string, string>>,
): void => {
  for (const [scriptName, command] of Object.entries(packageScripts)) {
    for (const token of splitPackageScriptCommand(command)) {
      const entryPath = normalizeEntrypointToken(token);
      if (!entryPath || !governedPathSet.has(entryPath)) continue;
      addLiveEntry(state, {
        entryKind: "package-script",
        filePath: entryPath,
        reason: `package.json script ${scriptName}`,
        scriptName,
      });
    }
  }
};

const addPlanEntries = (
  state: LiveEntryState,
  governedPathSet: ReadonlySet<string>,
  generatedPlan: readonly GeneratedPlanLike[],
): void => {
  for (const planEntry of generatedPlan) {
    if (!governedPathSet.has(planEntry.ownerInspectorPath)) continue;
    addLiveEntry(state, {
      entryKind: "owner-inspector",
      filePath: planEntry.ownerInspectorPath,
      reason: "generated-plan owner inspector dynamic load",
      scriptName: null,
    });
  }
};

const addNativeConfigEntries = (state: LiveEntryState, input: LiveEntrypointInput): void => {
  const nativeConfigSources = input.targetPaths.filter((path) => [".json", ".html"].includes(extname(path)))
    .map((path) => ({ path, source: readFileSync(resolve(input.sealedRoot, path), "utf8") }));
  for (const governedFile of input.governedFiles) {
    if (state.entryFiles.has(governedFile.repoPath)) continue;
    const runtimeName = `${basename(governedFile.repoPath, extname(governedFile.repoPath))}.js`;
    const nativeOwner = nativeConfigSources.find((config) => config.source.includes(runtimeName));
    if (!nativeOwner) continue;
    addLiveEntry(state, {
      entryKind: "native-config",
      filePath: governedFile.repoPath,
      reason: `${nativeOwner.path} references ${runtimeName}`,
      scriptName: null,
    });
  }
};

const addSpawnedEntries = (
  state: LiveEntryState,
  governedFiles: readonly GovernedFile[],
  governedPathSet: ReadonlySet<string>,
): void => {
  for (const sourcePath of [...state.entryFiles]) {
    const sourceFile = governedFiles.find((file) => file.repoPath === sourcePath);
    if (!sourceFile) continue;
    for (const entryPath of spawnedDirectoryEntries(sourceFile, governedPathSet)) {
      addLiveEntry(state, {
        entryKind: "native-child-process",
        filePath: entryPath,
        reason: `${sourcePath} discovers and executes the closed filename suffix`,
        scriptName: null,
      });
    }
  }
};

export const collectZombieLiveEntrypoints = (input: LiveEntrypointInput): LiveEntryState => {
  const governedPathSet = new Set(input.governedFiles.map((governedFile) => governedFile.repoPath));
  const state: LiveEntryState = { entryFiles: new Set(), liveEntryPoints: [] };
  addPackageEntries(state, governedPathSet, input.packageScripts ?? readPackageJsonScripts());
  addPlanEntries(state, governedPathSet, input.generatedPlan);
  addNativeConfigEntries(state, input);
  addSpawnedEntries(state, input.governedFiles, governedPathSet);

  return {
    entryFiles: state.entryFiles,
    liveEntryPoints: state.liveEntryPoints.sort((left, right) => left.filePath.localeCompare(right.filePath)),
  };
};
