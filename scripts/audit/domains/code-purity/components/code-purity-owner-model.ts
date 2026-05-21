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

const resolveRootOwner = (repoPath: string): string => {
  if (repoPath.startsWith("src/app/")) {
    return "app-shell";
  }
  if (repoPath.startsWith("src/mediator/")) {
    return "mediator";
  }
  if (repoPath.startsWith("src/lib/browser/")) {
    return "browser";
  }
  if (repoPath.startsWith("src/lib/storage/")) {
    return "storage";
  }
  if (repoPath.startsWith("src/lib/runtime-logs/")) {
    return "runtime-logs";
  }
  if (repoPath.startsWith("src/lib/local-runtime/")) {
    return "local-runtime";
  }
  if (repoPath.startsWith("src/lib/online-ai/")) {
    return "online-ai";
  }
  if (repoPath.startsWith("src/lib/")) {
    return "lib";
  }
  if (repoPath.startsWith("src/types/")) {
    return "types";
  }
  if (repoPath.startsWith("scripts/startup/")) {
    return "startup";
  }
  if (repoPath.startsWith("scripts/acceptance/")) {
    return "acceptance";
  }
  return repoPath.startsWith("scripts/audit/") ? "audit-core" : "unknown";
};

export const resolveCodePurityOwner = (repoPath: string): string =>
  resolvePluginOwner(repoPath) ?? resolveCapabilityOwner(repoPath) ?? resolveAuditOwner(repoPath) ?? resolveRootOwner(repoPath);

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

const resolveSourceRole = (repoPath: string): CodePurityRole => {
  if (repoPath.startsWith("src/app/") || repoPath.startsWith("src/lib/local-runtime/")) {
    return "app-shell";
  }
  if (repoPath.startsWith("src/mediator/")) {
    return "mediator-route";
  }
  if (/^src\/plugins\/[^/]+\/.*\.flow\.ts$/u.test(repoPath)) {
    return "job-flow";
  }
  if (repoPath.startsWith("src/plugins/") && schemaLikeFilePattern.test(repoPath)) {
    return "job-schema";
  }
  if (repoPath.startsWith("src/plugins/")) {
    return "job-step";
  }
  if (/^src\/capabilities\/[^/]+\/index\.ts$/u.test(repoPath)) {
    return "ability-group";
  }
  if (repoPath.startsWith("src/capabilities/dom-automation/runtime/") || repoPath.startsWith("src/lib/browser/")) {
    return "browser-primitive";
  }
  if (/^src\/capabilities\/[^/]+\/(runtime|children)\//u.test(repoPath)) {
    return "child-ability";
  }
  if (repoPath.startsWith("src/capabilities/") && (repoPath.includes("/contracts/") || schemaLikeFilePattern.test(repoPath))) {
    return "type-contract";
  }
  if (repoPath.startsWith("src/capabilities/")) {
    return "ability-group";
  }
  if (repoPath.startsWith("src/lib/runtime-logs/") || repoPath.startsWith("src/capabilities/forensics-persistence/")) {
    return "log-writer";
  }
  if (repoPath.startsWith("src/lib/storage/")) {
    return "storage-adapter";
  }
  if (repoPath.startsWith("src/types/") || schemaLikeFilePattern.test(repoPath)) {
    return "type-contract";
  }
  return "infrastructure";
};

export const resolveCodePurityRole = (repoPath: string): CodePurityRole => resolveScriptRole(repoPath) ?? resolveSourceRole(repoPath);

export const resolveCodePurityBudget = (repoPath: string, role: CodePurityRole): FileBudget => {
  switch (role) {
    case "job-flow":
      return jobFlowBudget;
    case "job-schema":
    case "type-contract":
      return schemaBudget;
    case "mediator-route":
      return mediatorBudget;
    case "ability-group":
      return abilityFacadeBudget;
    case "child-ability":
      return childAbilityBudget;
    case "browser-primitive":
      return browserPrimitiveBudget;
    case "log-writer":
    case "storage-adapter":
      return evidenceBudget;
    case "app-shell":
      return appShellBudget;
    case "startup-script":
      return startupBudget;
    case "acceptance-smoke":
      return acceptanceBudget;
    case "audit-inspector":
      return auditInspectorBudget;
    case "audit-phase":
      return auditPhaseBudget;
    case "job-step":
      return jobStepBudget;
    case "infrastructure":
      return repoPath.startsWith("src/lib/") ? infrastructureBudget : jobStepBudget;
  }
};