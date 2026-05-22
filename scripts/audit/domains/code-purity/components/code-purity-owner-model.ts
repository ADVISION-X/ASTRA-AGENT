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

const schemaLikeFilePattern = /(schema|contract|types?|result)\.tsx?$/u;

const resolveByPrefix = (repoPath: string, rules: readonly (readonly [string, string])[]): string | null =>
  rules.find(([prefix]) => repoPath.startsWith(prefix))?.[1] ?? null;

const resolveByPattern = (repoPath: string, rules: readonly (readonly [RegExp, string])[]): string | null =>
  rules.find(([pattern]) => pattern.test(repoPath))?.[1] ?? null;

const resolvePluginOwner = (repoPath: string): string | null => {
  const match = /^src\/plugins\/([^/]+)\//u.exec(repoPath);
  return match ? `plugin:${match[1]}` : null;
};

const resolveCapabilityOwner = (repoPath: string): string | null => {
  const match = /^src\/capabilities\/([^/]+)\//u.exec(repoPath);
  return match ? `capability:${match[1]}` : null;
};

const resolveAuditOwner = (repoPath: string): string | null => {
  const match = /^scripts\/audit\/domains\/([^/]+)\//u.exec(repoPath);
  return match ? `audit:${match[1]}` : null;
};

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
  (resolveByPattern(repoPath, [[/^scripts\/audit\/domains\/[^/]+\/inspector\.ts$/u, "audit-inspector"]] as const) as CodePurityRole | null) ??
  (resolveByPrefix(repoPath, [
    ["scripts/audit/", "audit-phase"],
    ["scripts/acceptance/", "acceptance-smoke"],
    ["scripts/startup/", "startup-script"],
  ]) as CodePurityRole | null);

const resolvePluginRole = (repoPath: string): CodePurityRole | null =>
  (resolveByPattern(repoPath, [[/^src\/plugins\/[^/]+\/.*\.flow\.ts$/u, "job-flow"]] as const) as CodePurityRole | null) ??
  (repoPath.startsWith("src/plugins/") && schemaLikeFilePattern.test(repoPath)
    ? "job-schema"
    : repoPath.startsWith("src/plugins/")
      ? "job-step"
      : null);

const resolveCapabilityPatternRole = (repoPath: string): CodePurityRole | null =>
  resolveByPattern(repoPath, [
    [/^src\/capabilities\/[^/]+\/index\.ts$/u, "ability-group"],
    [/^src\/capabilities\/[^/]+\/(runtime|children)\//u, "child-ability"],
  ] as const) as CodePurityRole | null;

const resolveCapabilitySurfaceRole = (repoPath: string): CodePurityRole | null => {
  if (repoPath.startsWith("src/capabilities/dom-automation/runtime/") || repoPath.startsWith("src/lib/browser/")) {
    return "browser-primitive";
  }
  if (repoPath.startsWith("src/capabilities/") && (repoPath.includes("/contracts/") || schemaLikeFilePattern.test(repoPath))) {
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
  repoPath.startsWith("src/types/") || schemaLikeFilePattern.test(repoPath) ? "type-contract" : "infrastructure";

const resolveSourceRole = (repoPath: string): CodePurityRole =>
  resolveRootSourceRole(repoPath) ??
  resolvePluginRole(repoPath) ??
  resolveCapabilityRole(repoPath) ??
  resolveLibraryRole(repoPath) ??
  resolveFallbackSourceRole(repoPath);

export const resolveCodePurityRole = (repoPath: string): CodePurityRole => resolveScriptRole(repoPath) ?? resolveSourceRole(repoPath);

export const resolveCodePurityBudget = (_repoPath: string, _role: CodePurityRole): FileBudget => sourceFileBudget;
