export type CodePurityRole =
  | "ability-group"
  | "acceptance-smoke"
  | "app-shell"
  | "audit-inspector"
  | "audit-phase"
  | "browser-primitive"
  | "child-ability"
  | "infrastructure"
  | "job-flow"
  | "job-schema"
  | "job-step"
  | "log-writer"
  | "mediator-route"
  | "startup-script"
  | "storage-adapter"
  | "type-contract";

export type FileBudget = {
  label: string;
  maxLines: number;
};

const sourceFileBudget: FileBudget = { label: "active executable source file", maxLines: 500 };

const schemaLikeStemTokens = new Set(["schema", "contract", "type", "types", "result"]);

const resolveByPrefix = (repoPath: string, rules: readonly (readonly [string, string])[]): string | null =>
  rules.find(([prefix]) => repoPath.startsWith(prefix))?.[1] ?? null;

const getPathSegments = (repoPath: string): string[] => repoPath.split("/").filter((segment) => segment.length > 0);

const getFileName = (repoPath: string): string => {
  const segments = getPathSegments(repoPath);
  return segments.at(-1) ?? "";
};

const trimTypeScriptExtension = (fileName: string): string => {
  for (const extension of [".tsx", ".ts", ".jsx", ".js", ".mjs"]) {
    if (fileName.endsWith(extension)) {
      return fileName.slice(0, fileName.length - extension.length);
    }
  }
  return fileName;
};

const isSchemaLikeFile = (repoPath: string): boolean =>
  trimTypeScriptExtension(getFileName(repoPath))
    .split(".")
    .some((token) => schemaLikeStemTokens.has(token));

const resolveOwnedSegment = (repoPath: string, prefix: string, ownerPrefix: string): string | null => {
  if (!repoPath.startsWith(prefix)) {
    return null;
  }
  const remainder = repoPath.slice(prefix.length);
  const ownerId = remainder.split("/")[0];
  return ownerId ? `${ownerPrefix}:${ownerId}` : null;
};

const isAuditInspectorPath = (repoPath: string): boolean => {
  const segments = getPathSegments(repoPath);
  return segments.length === 5
    && segments[0] === "scripts"
    && segments[1] === "audit"
    && segments[2] === "domains"
    && segments[4] === "inspector.ts";
};

const isPluginFlowPath = (repoPath: string): boolean =>
  repoPath.startsWith("src/plugins/") && getFileName(repoPath).endsWith(".flow.ts");

const isCapabilityFacadePath = (repoPath: string): boolean => {
  if (!repoPath.startsWith("src/capabilities/")) {
    return false;
  }
  const segments = getPathSegments(repoPath);
  return segments.length === 4 && segments[3] === "index.ts";
};

const isCapabilityRuntimePath = (repoPath: string): boolean => {
  if (!repoPath.startsWith("src/capabilities/")) {
    return false;
  }
  const segments = getPathSegments(repoPath);
  return segments.length >= 5 && (segments[3] === "runtime" || segments[3] === "children");
};

const resolvePluginOwner = (repoPath: string): string | null => resolveOwnedSegment(repoPath, "src/plugins/", "plugin");

const resolveCapabilityOwner = (repoPath: string): string | null => resolveOwnedSegment(repoPath, "src/capabilities/", "capability");

const resolveAuditOwner = (repoPath: string): string | null => resolveOwnedSegment(repoPath, "scripts/audit/domains/", "audit");

const resolveSourceOwner = (repoPath: string): string | null =>
  resolveByPrefix(repoPath, [
    ["src/app/", "app-shell"],
    ["src/mediator/", "mediator"],
    ["src/types/", "types"],
  ]);

const resolveLibOwner = (repoPath: string): string | null => {
  return resolveByPrefix(repoPath, [
    ["src/lib/browser/", "browser"],
    ["src/lib/storage/", "storage"],
    ["src/lib/runtime-logs/", "runtime-logs"],
    ["src/lib/local-runtime/", "local-runtime"],
    ["src/lib/online-ai/", "online-ai"],
  ]) ?? (repoPath.startsWith("src/lib/") ? "lib" : null);
};

const resolveScriptOwner = (repoPath: string): string | null => {
  return resolveByPrefix(repoPath, [
    ["scripts/startup/", "startup"],
    ["scripts/acceptance/", "acceptance"],
  ]) ?? (repoPath.startsWith("scripts/audit/") ? "audit-core" : null);
};

export const resolveCodePurityOwner = (repoPath: string): string =>
  resolvePluginOwner(repoPath) ??
  resolveCapabilityOwner(repoPath) ??
  resolveAuditOwner(repoPath) ??
  resolveSourceOwner(repoPath) ??
  resolveLibOwner(repoPath) ??
  resolveScriptOwner(repoPath) ??
  "unknown";

const resolveScriptRole = (repoPath: string): CodePurityRole | null =>
  (isAuditInspectorPath(repoPath) ? "audit-inspector" : null) ??
  (resolveByPrefix(repoPath, [
    ["scripts/audit/", "audit-phase"],
    ["scripts/acceptance/", "acceptance-smoke"],
    ["scripts/startup/", "startup-script"],
  ]) as CodePurityRole | null);

const resolvePluginRole = (repoPath: string): CodePurityRole | null =>
  (isPluginFlowPath(repoPath) ? "job-flow" : null) ??
  (repoPath.startsWith("src/plugins/") && isSchemaLikeFile(repoPath)
    ? "job-schema"
    : repoPath.startsWith("src/plugins/")
      ? "job-step"
      : null);

const resolveCapabilityPatternRole = (repoPath: string): CodePurityRole | null =>
  isCapabilityFacadePath(repoPath)
    ? "ability-group"
    : isCapabilityRuntimePath(repoPath)
      ? "child-ability"
      : null;

const resolveCapabilitySurfaceRole = (repoPath: string): CodePurityRole | null => {
  if (repoPath.startsWith("src/capabilities/dom-automation/runtime/") || repoPath.startsWith("src/lib/browser/")) {
    return "browser-primitive";
  }
  if (repoPath.startsWith("src/capabilities/") && (repoPath.includes("/contracts/") || isSchemaLikeFile(repoPath))) {
    return "type-contract";
  }
  return repoPath.startsWith("src/capabilities/") ? "ability-group" : null;
};

const resolveCapabilityRole = (repoPath: string): CodePurityRole | null =>
  resolveCapabilityPatternRole(repoPath) ?? resolveCapabilitySurfaceRole(repoPath);

const resolveLibraryRole = (repoPath: string): CodePurityRole | null =>
  (resolveByPrefix(repoPath, [
    ["src/lib/runtime-logs/", "log-writer"],
    ["src/capabilities/forensics-persistence/", "log-writer"],
    ["src/lib/storage/", "storage-adapter"],
  ]) as CodePurityRole | null) ?? (repoPath.startsWith("src/lib/") ? "infrastructure" : null);

const resolveRootSourceRole = (repoPath: string): CodePurityRole | null =>
  (resolveByPrefix(repoPath, [
    ["src/app/", "app-shell"],
    ["src/lib/local-runtime/", "app-shell"],
    ["src/mediator/", "mediator-route"],
  ]) as CodePurityRole | null);

const resolveFallbackSourceRole = (repoPath: string): CodePurityRole =>
  repoPath.startsWith("src/types/") || isSchemaLikeFile(repoPath) ? "type-contract" : "infrastructure";

const resolveSourceRole = (repoPath: string): CodePurityRole =>
  resolveRootSourceRole(repoPath) ??
  resolvePluginRole(repoPath) ??
  resolveCapabilityRole(repoPath) ??
  resolveLibraryRole(repoPath) ??
  resolveFallbackSourceRole(repoPath);

export const resolveCodePurityRole = (repoPath: string): CodePurityRole => resolveScriptRole(repoPath) ?? resolveSourceRole(repoPath);

export const resolveCodePurityBudget = (_repoPath: string, _role: CodePurityRole): FileBudget => sourceFileBudget;
