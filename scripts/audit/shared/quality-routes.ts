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
  "ai-input-gateway": "acceptance:ai-input-gateway",
  "app-shell-ui": "acceptance:app-shell-ui",
  "capability-governance": "acceptance:capability-governance",
  "code-purity": "acceptance:code-purity-zombie-deep",
  "forensics-persistence-capability": "acceptance:forensics-persistence-capability",
  "local-app-shell": "acceptance:local-app-shell",
  "local-browser-session": "acceptance:local-browser-terminal",
  "runtime-log-spine": "acceptance:runtime-log-spine",
  "startup-entrypoint": "acceptance:startup-entrypoint",
  "system-security": "acceptance:system-security",
  "workbench-api-boundary": "acceptance:workbench-api-boundary",
  "xuanxue-ai-production": "acceptance:xuanxue-ai-production",
  "xuanxue-ai-production-localization-contract": "acceptance:xuanxue-ai-production-localization-contract",
};

const dynamicScripts: Readonly<Record<string, Readonly<Partial<Record<string, string>>>>> = {
  "ai-input-gateway": {
    "dynamic.browser": "acceptance:xuanxue-ai-production:real-chrome",
    "dynamic.provider": "acceptance:xuanxue-ai-production:real-proof-verify",
    "dynamic.authorization": "acceptance:xuanxue-ai-production:real-proof-verify",
  },
  "local-app-shell": {
    "dynamic.browser": "proof:local-shell-current-runtime",
    "dynamic.service": "proof:local-shell-current-runtime",
  },
  "local-browser-session": {
    "dynamic.browser": "acceptance:local-browser-real-chrome",
    "dynamic.storage": "acceptance:local-browser-real-chrome",
    "dynamic.recovery": "proof:local-browser-journal-recovery",
  },
  "startup-entrypoint": { "dynamic.service": "proof:local-shell-current-runtime" },
  "xuanxue-ai-production": {
    "dynamic.browser": "acceptance:xuanxue-ai-production:real-chrome",
    "dynamic.service": "acceptance:xuanxue-ai-production:real-proof-verify",
    "dynamic.database": "acceptance:xuanxue-ai-production:real-proof-verify",
    "dynamic.storage": "acceptance:xuanxue-ai-production:real-proof-verify",
    "dynamic.provider": "acceptance:xuanxue-ai-production:real-proof-verify",
    "dynamic.authorization": "acceptance:xuanxue-ai-production:real-proof-verify",
    "dynamic.recovery": "proof:xuanxue-ai-production:recovery",
    "dynamic.performance": "proof:xuanxue-ai-production:72h-soak",
  },
};

// Proof producers report only native observations. Clause authority stays in
// the unique quality route so a successful command cannot self-attest broader
// law coverage than the route was admitted to prove.
const proofClauses: Readonly<Record<string, readonly string[]>> = {
  "LAW-AI-INPUT-GATEWAY-001-V1\0exam.golden": ["summary"],
  "LAW-AI-INPUT-GATEWAY-002-V2\0dynamic.authorization": ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:6", "summary"],
  "LAW-AI-INPUT-GATEWAY-002-V2\0dynamic.browser": ["forbidden:2", "forbidden:3", "forbidden:4", "forbidden:6", "summary"],
  "LAW-AI-INPUT-GATEWAY-002-V2\0dynamic.provider": ["forbidden:1", "forbidden:4", "forbidden:5", "summary"],
  "LAW-AI-INPUT-GATEWAY-002-V2\0exam.golden": ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:4", "forbidden:5", "forbidden:6", "summary"],
  "LAW-AI-INPUT-GATEWAY-003-V1\0exam.golden": ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:4", "forbidden:5", "forbidden:6", "summary"],
  "LAW-AI-INPUT-GATEWAY-004-V1\0exam.golden": ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "summary"],
  "LAW-AI-INPUT-GATEWAY-005-V4\0exam.golden": ["forbidden:0", "forbidden:1", "forbidden:10", "forbidden:11", "forbidden:12", "forbidden:13", "forbidden:14", "forbidden:15", "forbidden:2", "forbidden:3", "forbidden:4", "forbidden:5", "forbidden:6", "forbidden:7", "forbidden:8", "forbidden:9", "summary"],
  "LAW-AI-INPUT-GATEWAY-006-V2\0exam.golden": ["forbidden:0", "summary"],
  "LAW-AI-INPUT-GATEWAY-007-V2\0exam.golden": ["forbidden:0", "summary"],
  "LAW-APP-SHELL-UI-001-V2\0exam.golden": ["forbidden:0", "forbidden:2", "forbidden:3", "forbidden:4", "forbidden:9", "summary"],
  "LAW-APP-SHELL-UI-002-V1\0exam.golden": ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:4", "summary"],
  "LAW-APP-SHELL-UI-003-V3\0exam.golden": ["forbidden:0", "forbidden:1", "forbidden:2", "summary"],
  "LAW-CAPABILITY-GOVERNANCE-001-V2\0exam.golden": ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:4", "forbidden:5", "summary"],
  "LAW-CODE-PURITY-003-V1\0exam.golden": ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "summary"],
  "LAW-FORENSICS-PERSISTENCE-CAPABILITY-001-V3\0exam.golden": ["forbidden:0", "summary"],
  "LAW-FORENSICS-PERSISTENCE-CAPABILITY-002-V3\0exam.golden": ["forbidden:0", "summary"],
  "LAW-FORENSICS-PERSISTENCE-CAPABILITY-003-V3\0exam.golden": ["forbidden:0", "summary"],
  "LAW-LOCAL-APP-SHELL-001-V5\0dynamic.browser": ["forbidden:7", "summary"],
  "LAW-LOCAL-APP-SHELL-001-V5\0dynamic.service": ["forbidden:4", "forbidden:8", "summary"],
  "LAW-LOCAL-APP-SHELL-001-V5\0exam.golden": ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:5", "forbidden:6", "summary"],
  "LAW-LOCAL-APP-SHELL-002-V3\0exam.golden": ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "summary"],
  "LAW-LOCAL-APP-SHELL-003-V2\0dynamic.service": ["forbidden:0", "forbidden:1", "summary"],
  "LAW-LOCAL-APP-SHELL-003-V2\0exam.golden": ["forbidden:2", "summary"],
  "LAW-LOCAL-BROWSER-SESSION-001-V4\0dynamic.browser": ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:4", "forbidden:5", "forbidden:6", "forbidden:7", "forbidden:8", "forbidden:9", "summary"],
  "LAW-LOCAL-BROWSER-SESSION-002-V5\0dynamic.browser": ["forbidden:0", "forbidden:1", "forbidden:10", "forbidden:11", "forbidden:12", "forbidden:13", "forbidden:2", "forbidden:3", "forbidden:4", "forbidden:5", "forbidden:6", "forbidden:7", "forbidden:8", "forbidden:9", "summary"],
  "LAW-LOCAL-BROWSER-SESSION-003-V8\0dynamic.browser": ["forbidden:0", "forbidden:1", "forbidden:10", "forbidden:11", "forbidden:12", "forbidden:13", "forbidden:2", "forbidden:3", "forbidden:4", "forbidden:5", "forbidden:6", "forbidden:7", "forbidden:8", "forbidden:9", "summary"],
  "LAW-LOCAL-BROWSER-SESSION-004-V8\0dynamic.recovery": ["forbidden:12", "forbidden:13", "forbidden:14", "forbidden:15", "summary"],
  "LAW-LOCAL-BROWSER-SESSION-004-V8\0dynamic.storage": ["forbidden:10", "forbidden:11", "forbidden:12", "forbidden:13", "forbidden:14", "forbidden:15", "summary"],
  "LAW-LOCAL-BROWSER-SESSION-004-V8\0exam.golden": ["forbidden:0", "forbidden:2", "forbidden:5", "forbidden:6", "forbidden:7", "forbidden:8", "forbidden:9", "summary"],
  "LAW-LOCAL-BROWSER-SESSION-004-V8\0exam.property": ["forbidden:1", "forbidden:3", "forbidden:4", "summary"],
  "LAW-LOCAL-BROWSER-SESSION-005-V5\0dynamic.browser": ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:4", "forbidden:5", "forbidden:6", "summary"],
  "LAW-LOCAL-BROWSER-SESSION-006-V3\0dynamic.browser": ["forbidden:0", "summary"],
  "LAW-RUNTIME-LOG-SPINE-001-V3\0exam.golden": ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:4", "forbidden:5", "summary"],
  "LAW-RUNTIME-LOG-SPINE-002-V3\0exam.golden": ["forbidden:0", "summary"],
  "LAW-RUNTIME-LOG-SPINE-003-V3\0exam.golden": ["forbidden:0", "summary"],
  "LAW-STARTUP-ENTRYPOINT-001-V4\0dynamic.service": ["forbidden:11", "summary"],
  "LAW-STARTUP-ENTRYPOINT-001-V4\0exam.golden": ["forbidden:0", "forbidden:1", "forbidden:10", "forbidden:2", "forbidden:3", "forbidden:4", "forbidden:5", "forbidden:6", "forbidden:7", "forbidden:8", "forbidden:9", "summary"],
  "LAW-STARTUP-ENTRYPOINT-002-V4\0dynamic.service": ["forbidden:0", "summary"],
  "LAW-STARTUP-ENTRYPOINT-002-V4\0exam.golden": ["forbidden:3", "forbidden:4", "forbidden:5", "forbidden:6", "summary"],
  "LAW-SYSTEM-SECURITY-001-V2\0exam.golden": ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:4", "forbidden:5", "summary"],
  "LAW-WORKBENCH-API-BOUNDARY-001-V6\0exam.golden": ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:4", "forbidden:5", "forbidden:6", "forbidden:7", "forbidden:8", "summary"],
  "LAW-XUANXUE-AI-PRODUCTION-001-V11\0dynamic.authorization": ["forbidden:2", "forbidden:3", "forbidden:4", "forbidden:5", "summary"],
  "LAW-XUANXUE-AI-PRODUCTION-001-V11\0dynamic.browser": ["forbidden:1", "forbidden:13", "forbidden:5", "summary"],
  "LAW-XUANXUE-AI-PRODUCTION-001-V11\0dynamic.database": ["forbidden:10", "forbidden:13", "forbidden:14", "forbidden:4", "summary"],
  "LAW-XUANXUE-AI-PRODUCTION-001-V11\0dynamic.performance": ["forbidden:15", "summary"],
  "LAW-XUANXUE-AI-PRODUCTION-001-V11\0dynamic.provider": ["forbidden:13", "forbidden:14", "forbidden:15", "summary"],
  "LAW-XUANXUE-AI-PRODUCTION-001-V11\0dynamic.recovery": ["forbidden:10", "forbidden:11", "summary"],
  "LAW-XUANXUE-AI-PRODUCTION-001-V11\0dynamic.service": ["forbidden:10", "forbidden:11", "forbidden:4", "forbidden:6", "forbidden:7", "forbidden:9", "summary"],
  "LAW-XUANXUE-AI-PRODUCTION-001-V11\0dynamic.storage": ["forbidden:10", "forbidden:11", "forbidden:13", "forbidden:14", "summary"],
  "LAW-XUANXUE-AI-PRODUCTION-001-V11\0exam.golden": ["forbidden:0", "forbidden:1", "forbidden:12", "forbidden:13", "forbidden:15", "forbidden:16", "forbidden:17", "forbidden:2", "forbidden:3", "forbidden:5", "forbidden:6", "forbidden:7", "forbidden:8", "forbidden:9", "summary"],
  "LAW-XUANXUE-AI-PRODUCTION-001-V11\0exam.property": ["forbidden:14", "summary"],
  "LAW-XUANXUE-AI-PRODUCTION-001-V11\0exam.state-machine": ["forbidden:10", "forbidden:11", "forbidden:4", "summary"],
  "LAW-XUANXUE-AI-PRODUCTION-LOCALIZATION-CONTRACT-001-V5\0exam.golden": ["forbidden:0", "summary"],
};

export const proofClausesFor = (lawId: string, mode: string): string[] => {
  const clauses = proofClauses[`${lawId}\0${mode}`]
    ?? fail("LAW_EVIDENCE_MISSING", `${lawId}:${mode}:clause-route`);
  return [...clauses];
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
