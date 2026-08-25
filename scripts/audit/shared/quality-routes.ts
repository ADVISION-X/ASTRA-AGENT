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
  "capability-governance": "acceptance:architecture-active-plugin-mediators",
  "code-purity": "acceptance:code-purity-zombie-deep",
  "forensics-persistence-capability": "acceptance:forensics-persistence-capability",
  "local-app-shell": "acceptance:local-app-shell",
  "local-browser-session": "acceptance:local-browser-terminal",
  "runtime-log-spine": "acceptance:runtime-log-spine",
  "startup-entrypoint": "acceptance:startup-entrypoint",
  "system-security": "acceptance:system-security",
  "xuanxue-ai-production": "acceptance:xuanxue-ai-production",
  "xuanxue-ai-production-localization-contract": "acceptance:xuanxue-ai-production-localization-contract",
};

const dynamicScripts: Readonly<Record<string, Readonly<Partial<Record<string, string>>>>> = {
  "local-app-shell": {
    "dynamic.browser": "proof:local-shell-current-runtime",
    "dynamic.service": "proof:local-shell-current-runtime",
  },
  "local-browser-session": {
    "dynamic.browser": "acceptance:local-browser-real-chrome",
    "dynamic.recovery": "proof:local-browser-journal-recovery",
  },
  "startup-entrypoint": { "dynamic.service": "proof:local-shell-current-runtime" },
  "workbench-api-boundary": { "dynamic.browser": "proof:local-shell-current-runtime" },
  "xuanxue-ai-production": {
    "dynamic.browser": "acceptance:xuanxue-ai-production:real-chrome",
    "dynamic.service": "acceptance:xuanxue-ai-production:real-proof-verify",
    "dynamic.provider": "acceptance:xuanxue-ai-production:real-proof-verify",
    "dynamic.authorization": "acceptance:xuanxue-ai-production:real-proof-verify",
    "dynamic.recovery": "acceptance:xuanxue-ai-production:real-proof-verify",
    "dynamic.performance": "acceptance:xuanxue-ai-production:real-proof-verify",
  },
};

export const examScriptFor = (domain: string): string =>
  examScripts[domain] ?? fail("LAW_EVIDENCE_MISSING", `${domain}:exam`);

export const dynamicScriptFor = (domain: string, mode: string): string =>
  dynamicScripts[domain]?.[mode] ?? fail("RELEASE_EVIDENCE_MISSING", `${domain}:${mode}`);

const routeKey = (lawId: string, mode: string): string => `${lawId}\0${mode}`;
type ClauseRoute = "all" | readonly number[];
const proofClauseRouteGroups: readonly Readonly<Record<string, ClauseRoute>>[] = [{
  [routeKey("LAW-AI-INPUT-GATEWAY-001-V1", "exam.golden")]: "all",
  [routeKey("LAW-AI-INPUT-GATEWAY-002-V1", "exam.golden")]: "all",
  [routeKey("LAW-AI-INPUT-GATEWAY-003-V1", "exam.golden")]: "all",
  [routeKey("LAW-AI-INPUT-GATEWAY-004-V1", "exam.golden")]: "all",
  [routeKey("LAW-AI-INPUT-GATEWAY-005-V4", "exam.golden")]: "all",
  [routeKey("LAW-AI-INPUT-GATEWAY-006-V1", "exam.golden")]: "all",
  [routeKey("LAW-AI-INPUT-GATEWAY-007-V1", "exam.golden")]: "all",
  [routeKey("LAW-APP-SHELL-UI-001-V2", "exam.golden")]: "all",
  [routeKey("LAW-APP-SHELL-UI-002-V1", "exam.golden")]: "all",
  [routeKey("LAW-APP-SHELL-UI-003-V2", "exam.golden")]: "all",
  [routeKey("LAW-CAPABILITY-GOVERNANCE-001-V1", "exam.golden")]: "all",
  [routeKey("LAW-CODE-PURITY-001-V2", "exam.golden")]: [2, 3, 7, 10, 15, 16],
  [routeKey("LAW-FORENSICS-PERSISTENCE-CAPABILITY-001-V2", "exam.golden")]: "all",
  [routeKey("LAW-FORENSICS-PERSISTENCE-CAPABILITY-002-V2", "exam.golden")]: "all",
  [routeKey("LAW-FORENSICS-PERSISTENCE-CAPABILITY-003-V2", "exam.golden")]: "all",
  [routeKey("LAW-LOCAL-APP-SHELL-001-V5", "exam.golden")]: [0, 1, 2, 3, 5, 6],
  [routeKey("LAW-LOCAL-APP-SHELL-001-V5", "dynamic.browser")]: [7],
  [routeKey("LAW-LOCAL-APP-SHELL-001-V5", "dynamic.service")]: [4, 8],
  [routeKey("LAW-LOCAL-APP-SHELL-002-V3", "exam.golden")]: "all",
  [routeKey("LAW-LOCAL-APP-SHELL-003-V2", "exam.golden")]: [2],
  [routeKey("LAW-LOCAL-APP-SHELL-003-V2", "dynamic.service")]: [0, 1],
  [routeKey("LAW-LOCAL-BROWSER-SESSION-001-V4", "dynamic.browser")]: "all",
  [routeKey("LAW-LOCAL-BROWSER-SESSION-002-V4", "dynamic.browser")]: "all",
  [routeKey("LAW-LOCAL-BROWSER-SESSION-003-V6", "dynamic.browser")]: "all",
}, {
  [routeKey("LAW-LOCAL-BROWSER-SESSION-004-V6", "exam.golden")]: [0, 2, 5, 6, 7, 8, 9],
  [routeKey("LAW-LOCAL-BROWSER-SESSION-004-V6", "exam.property")]: [1, 3, 4],
  [routeKey("LAW-LOCAL-BROWSER-SESSION-004-V6", "dynamic.recovery")]: [10, 11, 12, 13, 14, 15],
  [routeKey("LAW-LOCAL-BROWSER-SESSION-005-V4", "dynamic.browser")]: "all",
  [routeKey("LAW-LOCAL-BROWSER-SESSION-006-V2", "dynamic.browser")]: "all",
  [routeKey("LAW-RUNTIME-LOG-SPINE-001-V3", "exam.golden")]: "all",
  [routeKey("LAW-RUNTIME-LOG-SPINE-002-V2", "exam.golden")]: "all",
  [routeKey("LAW-RUNTIME-LOG-SPINE-003-V2", "exam.golden")]: "all",
  [routeKey("LAW-STARTUP-ENTRYPOINT-001-V4", "exam.golden")]: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  [routeKey("LAW-STARTUP-ENTRYPOINT-001-V4", "dynamic.service")]: [11],
  [routeKey("LAW-STARTUP-ENTRYPOINT-002-V1", "exam.golden")]: [1, 2, 3, 4],
  [routeKey("LAW-STARTUP-ENTRYPOINT-002-V1", "dynamic.service")]: [0],
  [routeKey("LAW-SYSTEM-SECURITY-001-V1", "exam.golden")]: "all",
  [routeKey("LAW-WORKBENCH-API-BOUNDARY-001-V4", "dynamic.browser")]: "all",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V8", "exam.golden")]: [0, 1, 2, 3, 5, 6, 7, 8, 9, 12, 13, 15],
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V8", "exam.property")]: [14],
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V8", "exam.state-machine")]: [4, 10, 11],
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V8", "dynamic.browser")]: [1, 5, 13],
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V8", "dynamic.service")]: [4, 6, 7, 9, 10, 11],
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V8", "dynamic.provider")]: [13, 14, 15],
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V8", "dynamic.authorization")]: [2, 3, 4, 5],
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V8", "dynamic.recovery")]: [10, 11],
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V8", "dynamic.performance")]: [15],
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-LOCALIZATION-CONTRACT-001-V3", "exam.golden")]: "all",
}];

export const proofClauseIndexesFor = (lawId: string, mode: string, forbiddenCount: number): number[] | null => {
  const key = routeKey(lawId, mode);
  const route = proofClauseRouteGroups.map((group) => group[key]).find((value) => value !== undefined);
  if (route === undefined) return null;
  const indexes = route === "all" ? Array.from({ length: forbiddenCount }, (_, index) => index) : [...route];
  if (!indexes.length || indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= forbiddenCount)
    || indexes.length !== new Set(indexes).size) fail("LAW_CHECK_ROUTE_MISSING", `${lawId}:${mode}:clause-route`);
  return indexes;
};
const exactExamLocators: Readonly<Record<string, string>> = {
  [routeKey("LAW-AI-INPUT-GATEWAY-001-V1", "exam.golden")]: "acceptance:provider-boundary:injected-browser",
  [routeKey("LAW-AI-INPUT-GATEWAY-002-V1", "exam.golden")]: "acceptance:exact-target:caller-owned-lease",
  [routeKey("LAW-AI-INPUT-GATEWAY-003-V1", "exam.golden")]: "acceptance:attachment-routing:transport-not-public",
  [routeKey("LAW-AI-INPUT-GATEWAY-004-V1", "exam.golden")]: "acceptance:attachment:opaque-grant-proof",
  [routeKey("LAW-AI-INPUT-GATEWAY-005-V4", "exam.golden")]: "acceptance:web-chat:bounded-session-controller",
  [routeKey("LAW-AI-INPUT-GATEWAY-006-V1", "exam.golden")]: "acceptance:provider-boundary:bounded-judge",
  [routeKey("LAW-AI-INPUT-GATEWAY-007-V1", "exam.golden")]: "acceptance:attachment:approved-input-refs",
  [routeKey("LAW-APP-SHELL-UI-001-V2", "exam.golden")]: "acceptance:app-shell-ui:single-shell-layout",
  [routeKey("LAW-APP-SHELL-UI-002-V1", "exam.golden")]: "acceptance:app-shell-ui:localization-completeness",
  [routeKey("LAW-APP-SHELL-UI-003-V2", "exam.golden")]: "acceptance:app-shell-ui:active-skill-registry",
  [routeKey("LAW-CAPABILITY-GOVERNANCE-001-V1", "exam.golden")]: "acceptance:capability-governance:mediator-mutant",
  [routeKey("LAW-CODE-PURITY-001-V2", "exam.golden")]: "acceptance:code-purity:zombie-mutant-matrix",
  [routeKey("LAW-FORENSICS-PERSISTENCE-CAPABILITY-001-V2", "exam.golden")]: "acceptance:forensics:append-only-record",
  [routeKey("LAW-FORENSICS-PERSISTENCE-CAPABILITY-002-V2", "exam.golden")]: "acceptance:forensics:artifact-index",
  [routeKey("LAW-FORENSICS-PERSISTENCE-CAPABILITY-003-V2", "exam.golden")]: "acceptance:forensics:storage-owner",
  [routeKey("LAW-LOCAL-APP-SHELL-001-V5", "exam.golden")]: "acceptance:local-shell:single-owned-shell",
  [routeKey("LAW-LOCAL-APP-SHELL-002-V3", "exam.golden")]: "acceptance:local-shell:boundary-mutants",
  [routeKey("LAW-LOCAL-APP-SHELL-003-V2", "exam.golden")]: "acceptance:local-shell:degraded-readiness",
  [routeKey("LAW-LOCAL-BROWSER-SESSION-004-V6", "exam.golden")]: "acceptance:browser-terminal:atomic-journal",
  [routeKey("LAW-LOCAL-BROWSER-SESSION-004-V6", "exam.property")]: "acceptance:browser-terminal:frame-property-model",
  [routeKey("LAW-RUNTIME-LOG-SPINE-001-V3", "exam.golden")]: "acceptance:runtime-log:redaction",
  [routeKey("LAW-RUNTIME-LOG-SPINE-002-V2", "exam.golden")]: "acceptance:runtime-log:stage-pair",
  [routeKey("LAW-RUNTIME-LOG-SPINE-003-V2", "exam.golden")]: "acceptance:runtime-log:debug-bundle",
  [routeKey("LAW-STARTUP-ENTRYPOINT-001-V4", "exam.golden")]: "acceptance:startup:shell-survives-dependency-failure",
  [routeKey("LAW-STARTUP-ENTRYPOINT-002-V1", "exam.golden")]: "acceptance:startup:local-port-and-artifact-boundary",
  [routeKey("LAW-SYSTEM-SECURITY-001-V1", "exam.golden")]: "acceptance:system-security:attack-mutants",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V8", "exam.golden")]: "acceptance:xuanxue:dynamic-proof-binding",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V8", "exam.property")]: "acceptance:xuanxue:canonical-receipt-hash",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V8", "exam.state-machine")]: "acceptance:xuanxue:continuation-state-binding",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-LOCALIZATION-CONTRACT-001-V3", "exam.golden")]: "acceptance:xuanxue-localization:contract-projection",
};
const exactDynamicLocators: Readonly<Record<string, string>> = {
  [routeKey("LAW-LOCAL-BROWSER-SESSION-001-V4", "dynamic.browser")]: "dynamic:browser:authenticated-lifecycle",
  [routeKey("LAW-LOCAL-BROWSER-SESSION-002-V4", "dynamic.browser")]: "dynamic:browser:fixed-unpacked-authority",
  [routeKey("LAW-LOCAL-BROWSER-SESSION-003-V6", "dynamic.browser")]: "dynamic:browser:exact-target-claim",
  [routeKey("LAW-LOCAL-BROWSER-SESSION-004-V6", "dynamic.recovery")]: "dynamic:browser-journal:authorized-atomic-recovery",
  [routeKey("LAW-LOCAL-BROWSER-SESSION-005-V4", "dynamic.browser")]: "dynamic:browser:release-identity",
  [routeKey("LAW-LOCAL-BROWSER-SESSION-006-V2", "dynamic.browser")]: "dynamic:browser:opaque-proof-receipt",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V8", "dynamic.browser")]: "dynamic:xuanxue:bound-real-chrome",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V8", "dynamic.service")]: "dynamic:xuanxue:worker-session-continuation",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V8", "dynamic.provider")]: "dynamic:xuanxue:provider-record-checkpoints",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V8", "dynamic.authorization")]: "dynamic:xuanxue:session-attestation-rotation",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V8", "dynamic.recovery")]: "dynamic:xuanxue:terminal-continuation-receipts",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V8", "dynamic.performance")]: "dynamic:xuanxue:provider-verification-duration",
};

const localRuntimeLocator = (lawId: string, mode: string, locator: string): boolean => {
  if (lawId === "LAW-LOCAL-APP-SHELL-001-V5" && mode === "dynamic.browser") return /^http:\/\/127\.0\.0\.1:\d+\/$/u.test(locator);
  if (lawId === "LAW-LOCAL-APP-SHELL-001-V5" && mode === "dynamic.service") return /^http:\/\/127\.0\.0\.1:\d+\/api\/health$/u.test(locator);
  if (lawId === "LAW-LOCAL-APP-SHELL-003-V2" && mode === "dynamic.service") return /^http:\/\/127\.0\.0\.1:\d+\/api\/health#components$/u.test(locator);
  if (lawId === "LAW-STARTUP-ENTRYPOINT-001-V4" && mode === "dynamic.service") return /^process:\d+$/u.test(locator);
  if (lawId === "LAW-STARTUP-ENTRYPOINT-002-V1" && mode === "dynamic.service") return /^tcp:\/\/127\.0\.0\.1:\d+$/u.test(locator);
  if (lawId === "LAW-WORKBENCH-API-BOUNDARY-001-V4" && mode === "dynamic.browser") return /^http:\/\/127\.0\.0\.1:\d+\/$/u.test(locator);
  return false;
};

export const observationMatchesRoute = (input: {
  kind: "exam" | "dynamic"; script: string; domain: string; lawId: string; mode: string;
  locator: string; observedValue: string;
}): boolean => {
  const expectedScript = input.kind === "exam" ? examScripts[input.domain] : dynamicScripts[input.domain]?.[input.mode];
  if (expectedScript !== input.script || input.observedValue.trim().length < 8
    || /^(?:fixed|pass|true)$/iu.test(input.observedValue.trim())) return false;
  const exact = (input.kind === "exam" ? exactExamLocators : exactDynamicLocators)[routeKey(input.lawId, input.mode)];
  return exact ? input.locator === exact : input.script === "proof:local-shell-current-runtime"
    && localRuntimeLocator(input.lawId, input.mode, input.locator);
};

export const relevantExamScripts = (paths: readonly string[], registry: Registry): string[] => {
  const domains = registry.domains.filter((domain) => paths.some((path) =>
    [...domain.ownedPaths, ...domain.observedPaths].some((pattern) => matches(pattern, path))));
  return ordered(domains.flatMap((domain) => {
    const hasExamLaw = registry.laws.some((law) => law.capabilityDomain === domain.capabilityDomain
      && law.evidenceModes.some((mode) => mode.startsWith("exam.")));
    return hasExamLaw ? [examScriptFor(domain.capabilityDomain)] : [];
  }));
};
