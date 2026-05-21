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
  target: number;
  hardLimit: number;
  disaster: number;
};

const jobFlowBudget: FileBudget = { label: "job-flow file", target: 180, hardLimit: 280, disaster: 420 };
const jobStepBudget: FileBudget = { label: "job step/support file", target: 150, hardLimit: 240, disaster: 360 };
const schemaBudget: FileBudget = { label: "schema/result/type file", target: 220, hardLimit: 360, disaster: 520 };
const mediatorBudget: FileBudget = { label: "mediator route file", target: 100, hardLimit: 160, disaster: 240 };
const abilityFacadeBudget: FileBudget = { label: "ability-group public facade", target: 120, hardLimit: 200, disaster: 300 };
const childAbilityBudget: FileBudget = { label: "child ability runtime file", target: 140, hardLimit: 240, disaster: 360 };
const browserPrimitiveBudget: FileBudget = { label: "browser or DOM runtime primitive", target: 170, hardLimit: 300, disaster: 450 };
const evidenceBudget: FileBudget = { label: "evidence/runtime log file", target: 150, hardLimit: 260, disaster: 400 };
const appShellBudget: FileBudget = { label: "local app shell file", target: 140, hardLimit: 240, disaster: 360 };
const infrastructureBudget: FileBudget = { label: "src/lib infrastructure file", target: 150, hardLimit: 260, disaster: 400 };
const startupBudget: FileBudget = { label: "script/startup file", target: 170, hardLimit: 280, disaster: 420 };
const acceptanceBudget: FileBudget = { label: "acceptance smoke file", target: 180, hardLimit: 320, disaster: 480 };
const auditInspectorBudget: FileBudget = { label: "audit owner inspector", target: 180, hardLimit: 320, disaster: 480 };
const auditPhaseBudget: FileBudget = { label: "audit helper/phase file", target: 140, hardLimit: 240, disaster: 360 };

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

const resolveSourceOwner = (repoPath: string): string | null => {
  if (repoPath.startsWith("src/app/")) {
    return "app-shell";
  }
  if (repoPath.startsWith("src/mediator/")) {
    return "mediator";
  }
  return repoPath.startsWith("src/types/") ? "types" : null;
};

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

const resolveScriptRole = (repoPath: string): CodePurityRole | null => {
  if (/^scripts\/audit\/domains\/[^/]+\/inspector\.ts$/u.test(repoPath)) {
    return "audit-inspector";
  }
  if (repoPath.startsWith("scripts/audit/")) {
    return "audit-phase";
  }
  if (repoPath.startsWith("scripts/acceptance/")) {
    return "acceptance-smoke";
  }
  return repoPath.startsWith("scripts/startup/") ? "startup-script" : null;
};

const resolvePluginRole = (repoPath: string): CodePurityRole | null => {
  if (resolveByPattern(repoPath, [[/^src\/plugins\/[^/]+\/.*\.flow\.ts$/u, "job-flow"]] as const) === "job-flow") {
    return "job-flow";
  }
  if (repoPath.startsWith("src/plugins/") && schemaLikeFilePattern.test(repoPath)) {
    return "job-schema";
  }
  return repoPath.startsWith("src/plugins/") ? "job-step" : null;
};

const resolveCapabilityRole = (repoPath: string): CodePurityRole | null => {
  const directRole = resolveByPattern(repoPath, [
    [/^src\/capabilities\/[^/]+\/index\.ts$/u, "ability-group"],
    [/^src\/capabilities\/[^/]+\/(runtime|children)\//u, "child-ability"],
  ] as const);
  if (directRole) {
    return directRole as CodePurityRole;
  }
  if (repoPath.startsWith("src/capabilities/dom-automation/runtime/") || repoPath.startsWith("src/lib/browser/")) {
    return "browser-primitive";
  }
  if (repoPath.startsWith("src/capabilities/") && (repoPath.includes("/contracts/") || schemaLikeFilePattern.test(repoPath))) {
    return "type-contract";
  }
  return repoPath.startsWith("src/capabilities/") ? "ability-group" : null;
};

const resolveLibraryRole = (repoPath: string): CodePurityRole | null => {
  if (repoPath.startsWith("src/lib/runtime-logs/") || repoPath.startsWith("src/capabilities/forensics-persistence/")) {
    return "log-writer";
  }
  if (repoPath.startsWith("src/lib/storage/")) {
    return "storage-adapter";
  }
  return repoPath.startsWith("src/lib/") ? "infrastructure" : null;
};

const resolveSourceRole = (repoPath: string): CodePurityRole => {
  if (repoPath.startsWith("src/app/") || repoPath.startsWith("src/lib/local-runtime/")) {
    return "app-shell";
  }
  if (repoPath.startsWith("src/mediator/")) {
    return "mediator-route";
  }
  const pluginRole = resolvePluginRole(repoPath);
  if (pluginRole) {
    return pluginRole;
  }
  const capabilityRole = resolveCapabilityRole(repoPath);
  if (capabilityRole) {
    return capabilityRole;
  }
  const libraryRole = resolveLibraryRole(repoPath);
  if (libraryRole) {
    return libraryRole;
  }
  return repoPath.startsWith("src/types/") || schemaLikeFilePattern.test(repoPath) ? "type-contract" : "infrastructure";
};

export const resolveCodePurityRole = (repoPath: string): CodePurityRole => resolveScriptRole(repoPath) ?? resolveSourceRole(repoPath);

const budgetByRole: Record<Exclude<CodePurityRole, "infrastructure">, FileBudget> = {
  "ability-group": abilityFacadeBudget,
  "acceptance-smoke": acceptanceBudget,
  "app-shell": appShellBudget,
  "audit-inspector": auditInspectorBudget,
  "audit-phase": auditPhaseBudget,
  "browser-primitive": browserPrimitiveBudget,
  "child-ability": childAbilityBudget,
  "job-flow": jobFlowBudget,
  "job-schema": schemaBudget,
  "job-step": jobStepBudget,
  "log-writer": evidenceBudget,
  "mediator-route": mediatorBudget,
  "startup-script": startupBudget,
  "storage-adapter": evidenceBudget,
  "type-contract": schemaBudget,
};

export const resolveCodePurityBudget = (repoPath: string, role: CodePurityRole): FileBudget =>
  role === "infrastructure" ? (repoPath.startsWith("src/lib/") ? infrastructureBudget : jobStepBudget) : budgetByRole[role];