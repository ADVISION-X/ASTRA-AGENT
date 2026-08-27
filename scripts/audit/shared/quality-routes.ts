import type { Registry } from "../governance-authority.js";
import { fail } from "../governance-runtime.js";

const byteCompare = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
const ordered = (values: readonly string[]): string[] => [...new Set(values)].sort(byteCompare);
const matches = (pattern: string, path: string): boolean => pattern === "**/*" || pattern === path
  || (pattern.endsWith("/**") && (path === pattern.slice(0, -3) || path.startsWith(`${pattern.slice(0, -3)}/`)))
  || (() => {
    const marker = "/**/*.";
    const index = pattern.indexOf(marker);
    return index >= 0 && path.startsWith(`${pattern.slice(0, index)}/`)
      && path.endsWith(`.${pattern.slice(index + marker.length)}`);
  })();

const examScripts: Readonly<Record<string, string>> = {
  "agent-production-runtime": "acceptance:agent-production-runtime",
  "app-shell-ui": "acceptance:app-shell-ui",
  "capability-governance": "acceptance:capability-governance",
  "code-purity": "acceptance:code-purity-zombie-deep",
  "forensics-persistence-capability": "acceptance:forensics-persistence-capability",
  gpt: "acceptance:gpt",
  "local-app-shell": "acceptance:local-app-shell",
  "local-browser-session": "acceptance:local-browser-terminal",
  "runtime-log-spine": "acceptance:runtime-log-spine",
  "startup-entrypoint": "acceptance:startup-entrypoint",
  "system-security": "acceptance:system-security",
  "workbench-api-boundary": "acceptance:workbench-api-boundary",
};

const dynamicScripts: Readonly<Record<string, Readonly<Partial<Record<string, string>>>>> = {
  gpt: {
    "dynamic.browser": "acceptance:agent-production-runtime:real-proof",
    "dynamic.provider": "acceptance:agent-production-runtime:real-proof",
    "dynamic.authorization": "acceptance:agent-production-runtime:real-proof",
    "dynamic.recovery": "acceptance:agent-production-runtime:real-proof",
  },
  "local-app-shell": {
    "dynamic.browser": "proof:local-shell-current-runtime",
    "dynamic.service": "proof:local-shell-current-runtime",
  },
  "local-browser-session": {
    "dynamic.browser": "acceptance:agent-production-runtime:real-proof",
    "dynamic.storage": "acceptance:agent-production-runtime:real-proof",
  },
  "runtime-log-spine": {
    "dynamic.browser": "acceptance:agent-production-runtime:real-proof",
    "dynamic.service": "acceptance:agent-production-runtime:real-proof",
    "dynamic.storage": "acceptance:agent-production-runtime:real-proof",
    "dynamic.recovery": "acceptance:agent-production-runtime:real-proof",
  },
  "startup-entrypoint": { "dynamic.service": "proof:local-shell-current-runtime" },
  "agent-production-runtime": {
    "dynamic.browser": "acceptance:agent-production-runtime:real-proof",
    "dynamic.service": "acceptance:agent-production-runtime:real-proof",
    "dynamic.database": "acceptance:agent-production-runtime:real-proof",
    "dynamic.storage": "acceptance:agent-production-runtime:real-proof",
    "dynamic.provider": "acceptance:agent-production-runtime:real-proof",
    "dynamic.authorization": "acceptance:agent-production-runtime:real-proof",
    "dynamic.recovery": "acceptance:agent-production-runtime:real-proof",
  },
};

export const examScriptFor = (domain: string): string =>
  examScripts[domain] ?? fail("LAW_EVIDENCE_MISSING", `${domain}:exam`);

export const dynamicScriptFor = (domain: string, mode: string): string =>
  dynamicScripts[domain]?.[mode] ?? fail("RELEASE_EVIDENCE_MISSING", `${domain}:${mode}`);

export const relevantExamScripts = (paths: readonly string[], registry: Registry): string[] => {
  const domains = registry.domains.filter((domain) => paths.some((path) =>
    [...domain.ownedPaths, ...domain.observedPaths].some((pattern) => matches(pattern, path))));
  return ordered(domains.flatMap((domain) => {
    const hasExamLaw = registry.laws.some((law) => law.capabilityDomain === domain.capabilityDomain
      && law.evidenceModes.some((mode) => mode.startsWith("exam.")));
    return hasExamLaw ? [examScriptFor(domain.capabilityDomain)] : [];
  }));
};
