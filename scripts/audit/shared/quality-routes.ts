import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Registry } from "../governance-authority.js";
import { ROOT, fail, sha } from "../governance-runtime.js";

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

type ScriptDefinitions = Readonly<Record<string, string>>;
export const proofProducerDigestFromInputs = (
  rootScript: string, scripts: ScriptDefinitions, sources: Readonly<Record<string, string | Buffer>>,
): string => {
  const visited = new Set<string>();
  const sourcePaths = new Set<string>();
  const visit = (script: string): void => {
    if (visited.has(script)) return;
    const command = scripts[script] ?? fail("LAW_EVIDENCE_MISSING", `${script}:producer-command`);
    visited.add(script);
    for (const match of command.matchAll(/(?:^|\s)([A-Za-z0-9_./-]+\.(?:ts|mjs|js))(?=\s|$)/gu)) sourcePaths.add(match[1]!);
    for (const match of command.matchAll(/npm run ([A-Za-z0-9:_-]+)/gu)) visit(match[1]!);
  };
  visit(rootScript);
  const scriptEntries = [...visited].sort(byteCompare).map((name) => [name, scripts[name]!] as const);
  const sourceEntries = [...sourcePaths].sort(byteCompare).map((path) => {
    const bytes = sources[path] ?? fail("LAW_EVIDENCE_MISSING", `${rootScript}:producer-source:${path}`);
    return [path, sha(bytes)] as const;
  });
  return sha(JSON.stringify({ scripts: scriptEntries, sources: sourceEntries }));
};

const packageScripts = (): ScriptDefinitions =>
  (JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")) as { scripts: ScriptDefinitions }).scripts;
export const proofProducerDigest = (script: string): string => {
  const scripts = packageScripts();
  const sources: Record<string, Buffer> = {};
  const visited = new Set<string>();
  const collect = (name: string): void => {
    if (visited.has(name)) return;
    const command = scripts[name] ?? fail("LAW_EVIDENCE_MISSING", `${name}:producer-command`);
    visited.add(name);
    for (const match of command.matchAll(/(?:^|\s)([A-Za-z0-9_./-]+\.(?:ts|mjs|js))(?=\s|$)/gu)) {
      sources[match[1]!] = readFileSync(resolve(ROOT, match[1]!));
    }
    for (const match of command.matchAll(/npm run ([A-Za-z0-9:_-]+)/gu)) collect(match[1]!);
  };
  collect(script);
  return proofProducerDigestFromInputs(script, scripts, sources);
};

const proofProducerDigests: Readonly<Record<string, string>> = {
  "acceptance:ai-input-gateway": "ad434856120eb55efbeede9ebcc0a0aad0e4f12b893f3c1d8d0e1460c80a6c5a",
  "acceptance:app-shell-ui": "d72f3c17fc058b1627413bddaa0a3a04f0ec00cfb288d6ac21b13448e089da3b",
  "acceptance:architecture-active-plugin-mediators": "88590086f3889020b9130178083022119402893b6730c94c79642f42b497cd3c",
  "acceptance:code-purity-zombie-deep": "bbd3857b42ef61b86d83ef333acb52e247aab280a44517652cb05f046bf3e707",
  "acceptance:forensics-persistence-capability": "6339465403d9b963375e7077ea793ac9e3eee7e0e244f07becc89a3918841f4b",
  "acceptance:local-app-shell": "4af240acc32b8fb71ea0ae3377edd54956874cb3bc58d7dd25e04f199027ddd0",
  "acceptance:local-browser-real-chrome": "42dfc4714f4eaff78350bfaedc64c48549f92bcbc050084da787b63cd1628806",
  "acceptance:local-browser-terminal": "8bd41646ef28a50dec3808ea0949f4dfe240e0b8a8d36a4becdd7bd685778681",
  "acceptance:runtime-log-spine": "009da813d6e50d8a333f0668ef89b571ad2154cab7c358e05c9ec24b14db7971",
  "acceptance:startup-entrypoint": "9e2a2b874f0f3ff8b603b3fe5b27f28032956609381437b6ba31ff47178a15ba",
  "acceptance:system-security": "4eaf558de984a1832b18e1c07981f11327bc5a43c93db1461d9df04b3eeac8ec",
  "acceptance:xuanxue-ai-production": "b5b230e2189a6f03f5ad60e3fee9ed1656f11e973a0a9592ba7bc18984460931",
  "acceptance:xuanxue-ai-production-localization-contract": "c44b2b1fee08cde6297c98727bff66851abff88e08bc0962d185e7c342d7a725",
  "acceptance:xuanxue-ai-production:real-chrome": "4e1d6d0fda936ba410ac07b639104e3b2900fc13064c8a4d348406115051099e",
  "acceptance:xuanxue-ai-production:real-proof-verify": "824fd1be448e4ec68c06a9d0247aa9112e2b46418818b6c005921b6d26a709c2",
  "proof:local-browser-journal-recovery": "7d7800b62e274ef6d35534fa4df08a67c678efc99105f77efefbbb4816e8be80",
  "proof:local-shell-current-runtime": "78e62b345d03419e4100ad007407169b74e20ad3ff221c044d1d8854c27ab896",
};
export const assertProofProducerDigest = (script: string): void => {
  const expected = proofProducerDigests[script] ?? fail("LAW_EVIDENCE_MISSING", `${script}:producer-binding`);
  if (proofProducerDigest(script) !== expected) fail("LAW_EVIDENCE_MISSING", `${script}:producer-drift`);
};

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
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V9", "exam.golden")]: [0, 1, 2, 3, 5, 6, 7, 8, 9, 12, 13, 15],
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V9", "exam.property")]: [14],
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V9", "exam.state-machine")]: [4, 10, 11],
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V9", "dynamic.browser")]: [1, 5, 13],
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V9", "dynamic.service")]: [4, 6, 7, 9, 10, 11],
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V9", "dynamic.provider")]: [13, 14, 15],
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V9", "dynamic.authorization")]: [2, 3, 4, 5],
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V9", "dynamic.recovery")]: [10, 11],
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V9", "dynamic.performance")]: [15],
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-LOCALIZATION-CONTRACT-001-V4", "exam.golden")]: "all",
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
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V9", "exam.golden")]: "acceptance:xuanxue:dynamic-proof-binding",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V9", "exam.property")]: "acceptance:xuanxue:canonical-receipt-hash",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V9", "exam.state-machine")]: "acceptance:xuanxue:continuation-state-binding",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-LOCALIZATION-CONTRACT-001-V4", "exam.golden")]: "acceptance:xuanxue-localization:cloud-order",
};
const exactDynamicLocators: Readonly<Record<string, string>> = {
  [routeKey("LAW-LOCAL-BROWSER-SESSION-001-V4", "dynamic.browser")]: "dynamic:browser:authenticated-lifecycle",
  [routeKey("LAW-LOCAL-BROWSER-SESSION-002-V4", "dynamic.browser")]: "dynamic:browser:fixed-unpacked-authority",
  [routeKey("LAW-LOCAL-BROWSER-SESSION-003-V6", "dynamic.browser")]: "dynamic:browser:exact-target-claim",
  [routeKey("LAW-LOCAL-BROWSER-SESSION-004-V6", "dynamic.recovery")]: "dynamic:browser-journal:authorized-atomic-recovery",
  [routeKey("LAW-LOCAL-BROWSER-SESSION-005-V4", "dynamic.browser")]: "dynamic:browser:release-identity",
  [routeKey("LAW-LOCAL-BROWSER-SESSION-006-V2", "dynamic.browser")]: "dynamic:browser:opaque-proof-receipt",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V9", "dynamic.browser")]: "dynamic:xuanxue:bound-real-chrome",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V9", "dynamic.service")]: "dynamic:xuanxue:worker-session-continuation",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V9", "dynamic.provider")]: "dynamic:xuanxue:provider-record-checkpoints",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V9", "dynamic.authorization")]: "dynamic:xuanxue:session-attestation-rotation",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V9", "dynamic.recovery")]: "dynamic:xuanxue:terminal-continuation-receipts",
  [routeKey("LAW-XUANXUE-AI-PRODUCTION-001-V9", "dynamic.performance")]: "dynamic:xuanxue:provider-verification-duration",
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
