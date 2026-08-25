import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { buildRegistry, candidateSnapshot, gitCommit, REPORT, type Law, type Level, type Registry } from "../governance-authority.js";
import { canonicalBytes } from "../governance-json.js";
import { ROOT, fail, repositoryPaths, sha } from "../governance-runtime.js";
import { buildQualityReport, clausesForEvidenceMode, requiredModes, type LawExecutionResult, type QualityAssertion, type QualityFinding, type QualityParticipant } from "./quality-contract.js";
import { runInspectionWorker } from "./quality-inspector-worker.js";
import type { InspectorFinding, InspectorLawResult, SessionInspectorOutput } from "./inspector-contracts.js";

type TargetSet = { queryRef: string; count: number; sha256: string };
type ProofResult = { assertions: QualityAssertion[]; findings: QualityFinding[] };
type ProofRoute = { law: Law; mode: string };
type ProofResultInput = {
  kind: "exam" | "dynamic"; routes: ProofRoute[]; path: string; digest: string;
  locator: string; observedValue: string; passed: boolean; executionStatus: number | null;
};
type Dependency = { contractId: string; providerRepo: string; version: number };
type BoundParticipant = { path: string; report: QualityParticipant };
type QualityRunContext = {
  candidate: string;
  laws: Law[];
  registry: Registry;
  runDirectory: string;
  reportLevel: "READY" | "RELEASE";
};
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

const examScripts: Record<string, string> = {
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

const dynamicScripts: Record<string, Partial<Record<string, string>>> = {
  "local-app-shell": {
    "dynamic.browser": "acceptance:app-shell-ui:real-chrome",
    "dynamic.service": "acceptance:startup-entrypoint",
  },
  "local-browser-session": {
    "dynamic.browser": "acceptance:local-browser-real-chrome",
    "dynamic.recovery": "proof:local-browser-journal-recovery",
  },
  "startup-entrypoint": { "dynamic.service": "acceptance:startup-entrypoint" },
  "workbench-api-boundary": { "dynamic.browser": "acceptance:app-shell-ui:real-chrome" },
  "xuanxue-ai-production": {
    "dynamic.browser": "acceptance:xuanxue-ai-production:real-chrome",
    "dynamic.service": "acceptance:xuanxue-ai-production:real-proof-verify",
    "dynamic.provider": "acceptance:xuanxue-ai-production:real-proof-verify",
    "dynamic.authorization": "acceptance:xuanxue-ai-production:real-proof-verify",
    "dynamic.recovery": "acceptance:xuanxue-ai-production:real-proof-verify",
    "dynamic.performance": "acceptance:xuanxue-ai-production:real-proof-verify",
  },
};

const proofMarkers: Record<string, string> = {
  "acceptance:ai-input-gateway": "[ACCEPTANCE][ai-input-gateway-web-chat-concurrency] PASS",
  "acceptance:app-shell-ui": "[ACCEPTANCE][app-shell-skill-registry] PASS",
  "acceptance:architecture-active-plugin-mediators": "architecture-active-plugin-mediators-acceptance-ok",
  "acceptance:code-purity-zombie-deep": "code-purity-zombie-deep-acceptance-ok",
  "acceptance:forensics-persistence-capability": "[ACCEPTANCE] forensics-persistence-capability PASS",
  "acceptance:local-app-shell": "local-app-shell-acceptance-ok",
  "acceptance:local-browser-terminal": "LOCAL_RUNTIME_BROWSER_AUTHORITY_ACCEPTANCE_PASS",
  "acceptance:runtime-log-spine": "runtime-log-spine-ast-anti-escape-acceptance-ok",
  "acceptance:startup-entrypoint": "startup initialization health acceptance: PASS",
  "acceptance:system-security": "system-security-acceptance-ok",
  "acceptance:xuanxue-ai-production": "[ACCEPTANCE][XUANXUE-AI-PRODUCTION-CLOUD-ATTESTATION-V6] PASS",
  "acceptance:xuanxue-ai-production-localization-contract": "[ACCEPTANCE] localization generated projection PASS",
  "acceptance:app-shell-ui:real-chrome": "[ACCEPTANCE][APP-SHELL-UI][REAL-CHROME-PHYSICAL-CLEANUP]",
  "acceptance:local-browser-real-chrome": "\"status\":\"CHROME_VERIFIED\"",
  "proof:local-browser-journal-recovery": "\"status\":\"RECOVERY_VERIFIED\"",
  "acceptance:xuanxue-ai-production:real-chrome": "[ACCEPTANCE][XUANXUE-AI-PRODUCTION][REAL-CHROME-V6]",
  "acceptance:xuanxue-ai-production:real-proof-verify": "[ACCEPTANCE][XUANXUE-AI-PRODUCTION][REAL-PROVIDER]",
};

export const dynamicScriptFor = (domain: string, mode: string): string =>
  dynamicScripts[domain]?.[mode] ?? fail("RELEASE_EVIDENCE_MISSING", `${domain}:${mode}`);

const consumerDependencies = (): Dependency[] => repositoryPaths()
  .filter((path) => path.startsWith("docs/specs/") && path.endsWith(".json"))
  .flatMap((path) => {
    const spec = JSON.parse(readFileSync(resolve(ROOT, path), "utf8")) as { status?: string; specKind?: string; contract?: Partial<Dependency> };
    const contract = spec.contract;
    return spec.status === "active" && spec.specKind === "cross-repo-dependency"
      && typeof contract?.contractId === "string" && typeof contract.providerRepo === "string"
      && typeof contract.version === "number"
      ? [{ contractId: contract.contractId, providerRepo: contract.providerRepo, version: contract.version }]
      : [];
  });

const participantPath = (repo: string): string => {
  const configured = process.env.GRASSEYE_PROVIDER_REPOSITORIES?.trim();
  if (configured) {
    const paths = JSON.parse(configured) as Record<string, unknown>;
    if (typeof paths[repo] === "string") return resolve(paths[repo]);
  }
  if (repo === "ADVISION-X/xuanxue-web") return resolve(process.env.XUANXUE_WEBSITE_REPOSITORY?.trim() || "/Users/nexgen/Documents/xuanxue-web");
  return fail("EXTERNAL_SURFACE_AUTHORITY_MISSING", repo);
};

const gitAt = (path: string, args: string[]): string => execFileSync("git", args, {
  cwd: path, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
}).trim();

const providerContracts = (path: string, commit: string): Array<Dependency & { status: string; specKind: string }> => {
  const paths = gitAt(path, ["ls-tree", "-r", "--name-only", commit, "--", "docs/specs"])
    .split("\n").filter((current) => current.endsWith(".json"));
  return paths.flatMap((specPath) => {
    const spec = JSON.parse(gitAt(path, ["show", `${commit}:${specPath}`])) as {
      status?: string; specKind?: string; contract?: Partial<Dependency>;
    };
    const contract = spec.contract;
    return spec.status === "active" && spec.specKind === "cross-repo-contract"
      && typeof contract?.contractId === "string" && typeof contract.providerRepo === "string"
      && typeof contract.version === "number"
      ? [{ contractId: contract.contractId, providerRepo: contract.providerRepo, version: contract.version, status: spec.status, specKind: spec.specKind }]
      : [];
  });
};

export const assertExactProviderContract = (
  repo: string, dependency: Dependency, available: readonly Dependency[],
): void => {
  const matches = available.filter((contract) => contract.providerRepo === repo
    && contract.contractId === dependency.contractId && contract.version === dependency.version);
  if (matches.length !== 1) fail("EXTERNAL_SURFACE_AUTHORITY_MISSING", `${repo}:${dependency.contractId}:${dependency.version}`);
};

const bindReleaseParticipants = (): BoundParticipant[] => {
  const grouped = new Map<string, Dependency[]>();
  for (const dependency of consumerDependencies()) grouped.set(dependency.providerRepo, [
    ...(grouped.get(dependency.providerRepo) ?? []), dependency,
  ]);
  return [...grouped.entries()].sort(([left], [right]) => byteCompare(left, right)).map(([repo, dependencies]) => {
    const dependencySignatures = dependencies.map((dependency) => `${dependency.contractId}\0${dependency.version}`);
    if (dependencySignatures.length !== new Set(dependencySignatures).size) fail("EXTERNAL_SURFACE_AUTHORITY_MISSING", `${repo}:duplicate`);
    const path = participantPath(repo);
    const gitCommit = gitAt(path, ["rev-parse", "HEAD"]);
    const available = providerContracts(path, gitCommit);
    for (const dependency of dependencies) assertExactProviderContract(repo, dependency, available);
    const contracts = ordered(dependencySignatures).map((signature) => {
      const [contractId, version] = signature.split("\0");
      return { contractId: contractId!, version: Number(version) };
    });
    return { path, report: { repo, gitCommit, contracts } };
  });
};

const assertParticipantCommits = (participants: readonly BoundParticipant[]): void => {
  for (const participant of participants) if (gitAt(participant.path, ["rev-parse", "HEAD"]) !== participant.report.gitCommit) {
    fail("RELEASE_PARTICIPANT_DRIFT", participant.report.repo);
  }
};

const inspectorPath = (domain: string): string => `scripts/audit/domains/${domain}/inspector.ts`;
export const computeTargetPaths = (law: Law, registry: Registry): string[] => {
  const manifest = registry.domains.find((domain) => domain.capabilityDomain === law.capabilityDomain)
    ?? fail("ACTIVE_LAW_DENOMINATOR_MISMATCH", law.capabilityDomain);
  const paths = ordered([
    ...repositoryPaths().filter((path) => law.appliesTo.some((pattern) => matches(pattern, path))
      && !law.excludes.some((pattern) => matches(pattern, path))),
    ...law.contractRefs,
  ]);
  for (const path of paths) if (![...manifest.ownedPaths, ...manifest.observedPaths].some((pattern) => matches(pattern, path))) {
    fail("TARGET_OUTSIDE_DOMAIN_AUTHORITY", `${law.lawId}:${path}`);
  }
  return paths;
};

const targetSet = (lawId: string, paths: readonly string[]): TargetSet => ({
  queryRef: `scope:${lawId}#appliesTo-minus-excludes`,
  count: paths.length,
  sha256: sha(paths.map((path) => `${path}\n`).join("")),
});

const copyTargets = (paths: readonly string[], runDirectory: string, domain: string): string => {
  const root = mkdtempSync(resolve(runDirectory, `${domain}-sealed-`));
  for (const path of paths) {
    const destination = resolve(root, path);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(resolve(ROOT, path), destination);
  }
  return root;
};

export const parseInspectorOutput = (stdout: string, domain: string): SessionInspectorOutput => {
  const line = stdout.split("\n").find((current) => current.startsWith("GOVERNANCE_INSPECTOR_RESULT "));
  if (!line) fail("CHECK_EXECUTION_FAILED", `${domain}:missing inspector output`);
  try { return JSON.parse(line!.slice("GOVERNANCE_INSPECTOR_RESULT ".length)) as SessionInspectorOutput; }
  catch { return fail("CHECK_EXECUTION_FAILED", `${domain}:invalid inspector output`); }
};

const runStaticDomain = (
  domain: string,
  laws: Law[],
  targetPathsByLaw: ReadonlyMap<string, string[]>,
  runDirectory: string,
  level: "READY" | "RELEASE",
): LawExecutionResult[] => {
  const paths = ordered(laws.flatMap((law) => targetPathsByLaw.get(law.lawId) ?? []));
  const sealedRoot = copyTargets(paths, runDirectory, domain);
  const requestPath = resolve(runDirectory, `${domain}.inspection-request.json`);
  const request = {
    capabilityDomain: domain,
    laws: laws.map((law) => {
      const lawPaths = targetPathsByLaw.get(law.lawId) ?? [];
      return {
        lawId: law.lawId,
        clausesByMode: Object.fromEntries(law.evidenceModes.filter((mode) => mode.startsWith("static."))
          .map((mode) => [mode, clausesForEvidenceMode(law, requiredModes(law, level), mode)])),
        targetPaths: lawPaths,
        targetSet: targetSet(law.lawId, lawPaths),
      };
    }),
    ownerInspectorPath: inspectorPath(domain), sealedRoot, targetPaths: paths,
  };
  writeFileSync(requestPath, canonicalBytes(request), { mode: 0o600 });
  const worker = resolve(ROOT, "scripts/audit/shared/quality-inspector-worker.ts");
  if (runInspectionWorker.name !== "runInspectionWorker") fail("INSPECTOR_WORKER_INVALID", worker);
  const loader = resolve(ROOT, "node_modules/tsx/dist/loader.mjs");
  const execution = spawnSync(process.execPath, ["--import", loader, worker], {
    cwd: sealedRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, GOVERNANCE_INSPECTION_REQUEST: requestPath, GOVERNANCE_SEALED_ROOT: sealedRoot,
      GOVERNANCE_BINDING_CONTRACT: JSON.stringify({ targetPaths: paths }) },
  });
  if (execution.status !== 0) {
    process.stderr.write(execution.stderr || execution.stdout || `${domain} inspector failed\n`);
    fail("CHECK_EXECUTION_FAILED", `${domain}:static-inspector`);
  }
  const output = parseInspectorOutput(execution.stdout, domain);
  const lawIds = laws.map((law) => law.lawId);
  if (output.capabilityDomain !== domain || JSON.stringify(output.reportedLawIds) !== JSON.stringify(lawIds)) {
    fail("LAW_DENOMINATOR_MISSING", domain);
  }
  if (output.lawResults.length !== laws.length || !output.checkRuns.length) {
    fail("LAW_DENOMINATOR_MISSING", `${domain}:execution receipt`);
  }
  const allowed = new Set(paths);
  const escaped = output.inspectedFiles.filter((path) => !allowed.has(path));
  if (escaped.length) fail("TARGET_OUTSIDE_DOMAIN_AUTHORITY", `${domain}:${escaped.join(",")}`);
  const unknownFinding = output.lawResults.flatMap((result) => result.findings).find((finding) => !lawIds.includes(finding.lawId));
  if (unknownFinding) fail("LAW_DENOMINATOR_MISSING", `${domain}:${unknownFinding.lawId}`);
  return output.lawResults.map(staticLawResult);
};

const findingCode = (finding: InspectorFinding): string => `STATIC_${finding.checkId.replace(/[^A-Za-z0-9]+/gu, "_").toUpperCase()}`.replace(/_+$/u, "");
const staticLawResult = (result: InspectorLawResult): LawExecutionResult => ({
  lawId: result.lawId,
  assertions: result.assertions.map((assertion) => ({ ...assertion, clauses: [...assertion.clauses], refs: ordered(assertion.refs) })),
  findings: result.findings.map((finding) => ({
    code: findingCode(finding),
    evidenceRefs: ordered([`${finding.filePath ? "file:" + finding.filePath : "ast:scripts/audit/shared/quality-inspector-worker.ts"}#${encodeURIComponent(finding.checkId)}`]),
  })),
});

const lastObservation = (stdout: string): string => stdout.split("\n").map((line) => line.trim()).filter(Boolean).at(-1) ?? "";
export const assertCandidateStable = (expected: string, actual: string, label: string): void => {
  if (actual !== expected) fail("CANDIDATE_DRIFT", label);
};
const proofResults = (input: ProofResultInput): Map<string, ProofResult> => {
  const results = new Map<string, ProofResult>();
  for (const { law, mode } of input.routes) {
    const selector = encodeURIComponent(`lawId=${law.lawId};mode=${mode};locator=${input.locator};observed=${input.observedValue}`);
    const ref = `${input.kind}:${input.path}#${selector}@${input.digest}`;
    const current = results.get(law.lawId) ?? { assertions: [], findings: [] };
    current.assertions.push({
      clauses: clausesForEvidenceMode(law, requiredModes(law, input.kind === "exam" ? "READY" : "RELEASE"), mode),
      evidenceMode: mode, passed: input.passed, refs: [ref],
    });
    if (!input.passed) current.findings.push({ code: input.executionStatus === 0 ? "EMPTY_EVIDENCE_REFS" : "CHECK_EXECUTION_FAILED", evidenceRefs: [ref] });
    results.set(law.lawId, current);
  }
  return results;
};

const commandReceipt = (
  kind: "exam" | "dynamic", domain: string, script: string, routes: ProofRoute[],
  runDirectory: string, candidate: string,
): Map<string, ProofResult> => {
  const startedAt = new Date().toISOString();
  const before = candidateSnapshot();
  const timeoutMs = kind === "exam" ? 300_000 : 900_000;
  const execution = spawnSync("npm", ["run", script], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs, env: process.env });
  const after = candidateSnapshot();
  assertCandidateStable(before, after, script);
  assertCandidateStable(candidate, after, script);
  const token = sha(`${kind}:${script}`).slice(0, 12);
  const stdoutPath = resolve(runDirectory, `${kind}-${token}.stdout.txt`);
  const stderrPath = resolve(runDirectory, `${kind}-${token}.stderr.txt`);
  writeFileSync(stdoutPath, execution.stdout ?? "", { mode: 0o600 });
  writeFileSync(stderrPath, execution.stderr ?? "", { mode: 0o600 });
  const marker = proofMarkers[script] ?? fail("LAW_EVIDENCE_MISSING", `${script}:semantic marker`);
  const locator = `stdout:contains:${marker}`;
  const lastOutput = lastObservation(execution.stdout ?? "");
  const observedValue = (execution.stdout ?? "").includes(marker) ? marker : lastOutput;
  const passed = execution.status === 0 && observedValue === marker && execution.signal === null;
  const path = resolve(runDirectory, `${kind}-${token}.receipt.json`);
  const receipt = {
    schemaVersion: 2, kind, candidate, command: `npm run ${script}`, timeoutMs, startedAt,
    finishedAt: new Date().toISOString(), exitStatus: execution.status, signal: execution.signal ?? null,
    stdoutPath, stdoutSha256: sha(readFileSync(stdoutPath)), stderrPath, stderrSha256: sha(readFileSync(stderrPath)),
    observations: routes.map(({ law, mode }) => ({ lawId: law.lawId, evidenceMode: mode,
      locator, observedValue, passed })),
    cleanup: { processExited: execution.signal === null, temporaryEvidenceExternal: path.startsWith(resolve(tmpdir())) },
  };
  writeFileSync(path, canonicalBytes(receipt), { mode: 0o600 });
  const digest = sha(readFileSync(path));
  if (!passed) process.stderr.write(execution.stderr || execution.stdout || `${script} failed\n`);
  return proofResults({ kind, routes, path, digest, locator, observedValue, passed, executionStatus: execution.status });
};

const outputDirectory = (): string => {
  const requested = process.env.GRASSEYE_QUALITY_OUTPUT_DIR?.trim();
  if (requested) {
    const absolute = resolve(requested);
    if (!absolute.startsWith(`${resolve(tmpdir())}/`)) fail("CI_OUTPUT_PATH_INVALID", absolute);
    mkdirSync(absolute, { recursive: true });
    return absolute;
  }
  return mkdtempSync(resolve(tmpdir(), "grasseye-quality-"));
};

const addProofs = (resultsByLaw: Map<string, LawExecutionResult>, proofs: ReadonlyMap<string, ProofResult>): void => {
  for (const [lawId, proof] of proofs) {
    const current = resultsByLaw.get(lawId) ?? fail("LAW_DENOMINATOR_MISSING", lawId);
    current.assertions.push(...proof.assertions);
    current.findings.push(...proof.findings);
  }
};

const staticResults = (context: QualityRunContext): Map<string, LawExecutionResult> => {
  const targets = new Map(context.laws.map((law) => [law.lawId, computeTargetPaths(law, context.registry)]));
  const resultsByLaw = new Map<string, LawExecutionResult>();
  for (const domain of context.registry.domains) {
    const domainLaws = context.laws.filter((law) => law.capabilityDomain === domain.capabilityDomain);
    for (const result of runStaticDomain(domain.capabilityDomain, domainLaws, targets, context.runDirectory, context.reportLevel)) {
      if (resultsByLaw.has(result.lawId)) fail("LAW_EVIDENCE_DUPLICATE", result.lawId);
      resultsByLaw.set(result.lawId, result);
    }
    assertCandidateStable(context.candidate, candidateSnapshot(), domain.capabilityDomain);
  }
  return resultsByLaw;
};

const runExamProofs = (context: QualityRunContext, resultsByLaw: Map<string, LawExecutionResult>): void => {
  for (const domain of context.registry.domains) {
    const routes = context.laws.filter((law) => law.capabilityDomain === domain.capabilityDomain)
      .flatMap((law) => law.evidenceModes.filter((mode) => mode.startsWith("exam.")).map((mode) => ({ law, mode })));
    if (!routes.length) continue;
    const script = examScripts[domain.capabilityDomain] ?? fail("LAW_EVIDENCE_MISSING", `${domain.capabilityDomain}:exam`);
    addProofs(resultsByLaw, commandReceipt("exam", domain.capabilityDomain, script, routes, context.runDirectory, context.candidate));
  }
};

const runDynamicProofs = (context: QualityRunContext, resultsByLaw: Map<string, LawExecutionResult>): void => {
  const routesByScript = new Map<string, ProofRoute[]>();
  for (const law of context.laws) for (const mode of law.evidenceModes.filter((current) => current.startsWith("dynamic."))) {
    const script = dynamicScriptFor(law.capabilityDomain, mode);
    routesByScript.set(script, [...(routesByScript.get(script) ?? []), { law, mode }]);
  }
  for (const [script, routes] of routesByScript) addProofs(resultsByLaw,
    commandReceipt("dynamic", routes[0]!.law.capabilityDomain, script, routes, context.runDirectory, context.candidate));
};

export const runFullQuality = async (level: Level): Promise<{ reportPath: string; outcome: "PASS" | "FAIL" }> => {
  if (level === "CHANGE") fail("ENTRY_CONTRACT_MISMATCH", "full quality requires READY or RELEASE");
  const registry = buildRegistry();
  const laws = registry.laws;
  const candidate = candidateSnapshot();
  const commit = gitCommit();
  const runDirectory = outputDirectory();
  const boundParticipants = level === "RELEASE" ? bindReleaseParticipants() : [];
  const context: QualityRunContext = { candidate, laws, registry, runDirectory, reportLevel: level === "READY" ? "READY" : "RELEASE" };
  const resultsByLaw = staticResults(context);
  runExamProofs(context, resultsByLaw);
  if (level === "RELEASE") runDynamicProofs(context, resultsByLaw);
  const results = laws.map((law) => resultsByLaw.get(law.lawId) ?? fail("LAW_DENOMINATOR_MISSING", law.lawId));
  assertCandidateStable(candidate, candidateSnapshot(), level);
  assertParticipantCommits(boundParticipants);
  const report = buildQualityReport({
    level, gitCommit: commit, laws, results,
    participants: boundParticipants.map((participant) => participant.report),
  });
  const reportPath = process.env.CI || process.env.GRASSEYE_QUALITY_OUTPUT_DIR ? resolve(runDirectory, "law-quality.report.json") : resolve(ROOT, REPORT);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, canonicalBytes(report));
  process.stdout.write(`QUALITY_REPORT ${reportPath}\n${level}_${report.outcome}\n`);
  return { reportPath, outcome: report.outcome };
};
