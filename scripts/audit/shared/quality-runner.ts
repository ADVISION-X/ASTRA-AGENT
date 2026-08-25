import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { buildRegistry, candidateSnapshot, gitCommit, REPORT, type Law, type Level, type Registry } from "../governance-authority.js";
import { canonicalBytes } from "../governance-json.js";
import { ROOT, fail, repositoryPaths, sha } from "../governance-runtime.js";
import { buildQualityReport, clausesForEvidenceMode, requiredModes, type LawExecutionResult, type QualityAssertion, type QualityFinding, type QualityParticipant } from "./quality-contract.js";
import { runInspectionWorker } from "./quality-inspector-worker.js";
import type { InspectorFinding, SessionInspectorOutput } from "./inspector-contracts.js";

type TargetSet = { queryRef: string; count: number; sha256: string };
type StaticRun = { domain: string; findings: InspectorFinding[]; inspectorPath: string; targetSet: TargetSet };
type Dependency = { contractId: string; providerRepo: string; version: number };
type BoundParticipant = { path: string; report: QualityParticipant };
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

export const dynamicScriptFor = (domain: string, mode: string): string =>
  dynamicScripts[domain]?.[mode] ?? fail("PROJECT_CHECK_MISSING", `${domain}:${mode}`);

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
  return fail("RELEASE_PARTICIPANT_MISSING", repo);
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

const bindReleaseParticipants = (): BoundParticipant[] => {
  const grouped = new Map<string, Dependency[]>();
  for (const dependency of consumerDependencies()) grouped.set(dependency.providerRepo, [
    ...(grouped.get(dependency.providerRepo) ?? []), dependency,
  ]);
  return [...grouped.entries()].sort(([left], [right]) => byteCompare(left, right)).map(([repo, dependencies]) => {
    const dependencySignatures = dependencies.map((dependency) => `${dependency.contractId}\0${dependency.version}`);
    if (dependencySignatures.length !== new Set(dependencySignatures).size) fail("RELEASE_PARTICIPANT_CONTRACT_INVALID", `${repo}:duplicate`);
    const path = participantPath(repo);
    const gitCommit = gitAt(path, ["rev-parse", "HEAD"]);
    const available = providerContracts(path, gitCommit);
    for (const dependency of dependencies) {
      const matches = available.filter((contract) => contract.providerRepo === repo
        && contract.contractId === dependency.contractId && contract.version === dependency.version);
      if (matches.length !== 1) fail("RELEASE_PARTICIPANT_CONTRACT_INVALID", `${repo}:${dependency.contractId}:${dependency.version}`);
    }
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
const modeKind = (mode: string): string => ({
  "static.filesystem": "file", "static.text": "text", "static.ast": "ast", "static.types": "ast",
  "static.contract": "config", "static.dependency": "dependency", "static.config": "config",
  "static.json": "json", "static.yaml": "yaml", "static.sql": "sql", "static.migration": "file",
}[mode] ?? "file");

export const computeTargetPaths = (law: Law, registry: Registry): string[] => {
  const manifest = registry.domains.find((domain) => domain.capabilityDomain === law.capabilityDomain)
    ?? fail("ACTIVE_LAW_DENOMINATOR_MISMATCH", law.capabilityDomain);
  const paths = ordered([
    ...repositoryPaths().filter((path) => law.appliesTo.some((pattern) => matches(pattern, path))
      && !law.excludes.some((pattern) => matches(pattern, path))),
    ...law.contractRefs,
  ]);
  for (const path of paths) if (![...manifest.ownedPaths, ...manifest.observedPaths].some((pattern) => matches(pattern, path))) {
    fail("UNOWNED_PRODUCTION_FILE", `${law.lawId}:${path}`);
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

const parseInspectorOutput = (stdout: string, domain: string): SessionInspectorOutput => {
  const line = stdout.split("\n").find((current) => current.startsWith("GOVERNANCE_INSPECTOR_RESULT "));
  if (!line) fail("INSPECTOR_OUTPUT_INVALID", domain);
  try { return JSON.parse(line!.slice("GOVERNANCE_INSPECTOR_RESULT ".length)) as SessionInspectorOutput; }
  catch { return fail("INSPECTOR_OUTPUT_INVALID", domain); }
};

const runStaticDomain = (
  domain: string,
  law: Law,
  paths: string[],
  runDirectory: string,
): StaticRun => {
  const sealedRoot = copyTargets(paths, runDirectory, domain);
  const requestPath = resolve(runDirectory, `${domain}-${sha(law.lawId).slice(0, 12)}.inspection-request.json`);
  const request = { capabilityDomain: domain, lawIds: [law.lawId], ownerInspectorPath: inspectorPath(domain), sealedRoot, targetPaths: paths, targetSet: targetSet(law.lawId, paths) };
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
    return { domain, findings: [{ checkId: "quality/inspector-exception", lawId: law.lawId, clauseId: "summary", message: "Inspector process failed.", severity: "fatal", evidence: inspectorPath(domain) }], inspectorPath: inspectorPath(domain), targetSet: request.targetSet };
  }
  const output = parseInspectorOutput(execution.stdout, domain);
  if (output.capabilityDomain !== domain || JSON.stringify(output.reportedLawIds) !== JSON.stringify([law.lawId])) {
    fail("LAW_DENOMINATOR_MISMATCH", `${domain}:${law.lawId}`);
  }
  const expectedExecuted = [{ lawId: law.lawId, clauseId: `${law.lawId.toLowerCase()}-requirement`, checkId: `${domain}/owner-assertion-set` }];
  if (JSON.stringify(output.executedChecks) !== JSON.stringify(expectedExecuted) || output.checkRuns.length !== 1) {
    fail("INSPECTOR_OUTPUT_INVALID", `${domain}:${law.lawId}:execution receipt`);
  }
  const allowed = new Set(paths);
  const escaped = output.inspectedFiles.filter((path) => !allowed.has(path));
  if (escaped.length) fail("INSPECTOR_SCOPE_ESCAPE", `${domain}:${escaped.join(",")}`);
  const unknownFinding = output.findings.find((finding) => finding.lawId !== law.lawId);
  if (unknownFinding) fail("LAW_RESULT_INVALID", `${domain}:${unknownFinding.lawId}`);
  return { domain, findings: [...output.findings], inspectorPath: inspectorPath(domain), targetSet: request.targetSet };
};

const staticAssertions = (law: Law, run: StaticRun, level: "READY" | "RELEASE"): QualityAssertion[] => law.evidenceModes
  .filter((mode) => mode.startsWith("static."))
  .map((mode) => ({ clauses: clausesForEvidenceMode(law, requiredModes(law, level), mode), evidenceMode: mode, passed: run.findings.length === 0, refs: ordered([
    `${modeKind(mode)}:${run.inspectorPath}#inspectDomain`,
    `scope:${law.lawId}#appliesTo-minus-excludes`,
  ]) }));

const findingCode = (finding: InspectorFinding): string => `STATIC_${finding.checkId.replace(/[^A-Za-z0-9]+/gu, "_").toUpperCase()}`.replace(/_+$/u, "");
const staticFindings = (law: Law, run: StaticRun): QualityFinding[] => run.findings.map((finding) => ({
  code: findingCode(finding),
  evidenceRefs: ordered([`${finding.filePath ? "file:" + finding.filePath : "ast:" + run.inspectorPath}#${encodeURIComponent(finding.checkId)}`]),
}));

const examReceipt = (domain: string, script: string, runDirectory: string, candidate: string): { passed: boolean; ref: string; code: string } => {
  const startedAt = new Date().toISOString();
  const before = candidateSnapshot();
  const timeoutMs = 300_000;
  const execution = spawnSync("npm", ["run", script], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs, env: process.env });
  const after = candidateSnapshot();
  if (before !== after || after !== candidate) fail("CANDIDATE_DRIFT", script);
  const path = resolve(runDirectory, `${domain}.exam.json`);
  const receipt = { schemaVersion: 1, candidate, command: `npm run ${script}`, seed: "repository-deterministic", timeoutMs,
    startedAt, finishedAt: new Date().toISOString(), exitStatus: execution.status, signal: execution.signal ?? null,
    stdoutSha256: sha(execution.stdout ?? ""), stderrSha256: sha(execution.stderr ?? "") };
  writeFileSync(path, canonicalBytes(receipt), { mode: 0o600 });
  const digest = sha(readFileSync(path));
  const selector = encodeURIComponent(`command=npm run ${script};timeoutMs=${timeoutMs};exitStatus=${execution.status ?? "null"}`);
  const passed = execution.status === 0;
  if (!passed) process.stderr.write(execution.stderr || execution.stdout || `${script} failed\n`);
  return { passed, ref: `exam:${path}#${selector}@${digest}`, code: execution.error?.name === "Error" ? "EXAM_EXECUTION_ERROR" : "EXAM_FAILED" };
};

const dynamicReceipt = (
  script: string,
  runDirectory: string,
  candidate: string,
): { passed: boolean; ref: string; code: string } => {
  const startedAt = new Date().toISOString();
  const before = candidateSnapshot();
  const timeoutMs = 900_000;
  const execution = spawnSync("npm", ["run", script], {
    cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs, env: process.env,
  });
  const after = candidateSnapshot();
  if (before !== after || after !== candidate) fail("CANDIDATE_DRIFT", script);
  const token = sha(script).slice(0, 12);
  const stdoutPath = resolve(runDirectory, `dynamic-${token}.stdout.txt`);
  const stderrPath = resolve(runDirectory, `dynamic-${token}.stderr.txt`);
  writeFileSync(stdoutPath, execution.stdout ?? "", { mode: 0o600 });
  writeFileSync(stderrPath, execution.stderr ?? "", { mode: 0o600 });
  const path = resolve(runDirectory, `dynamic-${token}.receipt.json`);
  const receipt = {
    schemaVersion: 1, candidate, command: `npm run ${script}`, timeoutMs, startedAt,
    finishedAt: new Date().toISOString(), exitStatus: execution.status, signal: execution.signal ?? null,
    stdoutPath, stdoutSha256: sha(readFileSync(stdoutPath)), stderrPath, stderrSha256: sha(readFileSync(stderrPath)),
  };
  writeFileSync(path, canonicalBytes(receipt), { mode: 0o600 });
  const digest = sha(readFileSync(path));
  const outputPresent = Boolean((execution.stdout ?? "").trim());
  const passed = execution.status === 0 && outputPresent;
  if (!passed) process.stderr.write(execution.stderr || execution.stdout || `${script} failed\n`);
  const selector = encodeURIComponent(`command=npm run ${script};timeoutMs=${timeoutMs};exitStatus=${execution.status ?? "null"}`);
  return { passed, ref: `dynamic:${path}#${selector}@${digest}`, code: execution.error ? "DYNAMIC_EXECUTION_ERROR" : outputPresent ? "DYNAMIC_PROOF_FAILED" : "DYNAMIC_OUTPUT_INVALID" };
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

export const runFullQuality = async (level: Level): Promise<{ reportPath: string; outcome: "PASS" | "FAIL" }> => {
  if (level === "CHANGE") fail("ENTRY_CONTRACT_MISMATCH", "full quality requires READY or RELEASE");
  const registry = buildRegistry();
  const laws = registry.laws;
  const candidate = candidateSnapshot();
  const commit = gitCommit();
  const runDirectory = outputDirectory();
  const boundParticipants = level === "RELEASE" ? bindReleaseParticipants() : [];
  const staticRuns = new Map<string, StaticRun>();
  for (const law of laws) {
    const paths = computeTargetPaths(law, registry);
    const run = runStaticDomain(law.capabilityDomain, law, paths, runDirectory);
    staticRuns.set(law.lawId, run);
    if (candidateSnapshot() !== candidate) fail("CANDIDATE_DRIFT", law.lawId);
  }
  const exams = new Map<string, ReturnType<typeof examReceipt>>();
  for (const domain of registry.domains) if (laws.some((law) => law.capabilityDomain === domain.capabilityDomain && law.evidenceModes.some((mode) => mode.startsWith("exam.")))) {
    const script = examScripts[domain.capabilityDomain] ?? fail("PROJECT_CHECK_MISSING", `${domain.capabilityDomain}:exam`);
    exams.set(domain.capabilityDomain, examReceipt(domain.capabilityDomain, script, runDirectory, candidate));
  }
  const dynamics = new Map<string, ReturnType<typeof dynamicReceipt>>();
  if (level === "RELEASE") for (const law of laws) for (const mode of law.evidenceModes.filter((current) => current.startsWith("dynamic."))) {
    const script = dynamicScriptFor(law.capabilityDomain, mode);
    if (!dynamics.has(script)) dynamics.set(script, dynamicReceipt(script, runDirectory, candidate));
  }
  const results: LawExecutionResult[] = laws.map((law) => {
    const run = staticRuns.get(law.lawId) ?? fail("PROJECT_CHECK_MISSING", `${law.lawId}:static`);
    const exam = exams.get(law.capabilityDomain);
    const reportLevel = level === "READY" ? "READY" : "RELEASE";
    const assertions = [...staticAssertions(law, run, reportLevel), ...law.evidenceModes.filter((mode) => mode.startsWith("exam.")).map((mode) => ({
      clauses: clausesForEvidenceMode(law, requiredModes(law, reportLevel), mode), evidenceMode: mode, passed: exam?.passed ?? false, refs: [exam?.ref ?? `exam:package.json#${encodeURIComponent(examScripts[law.capabilityDomain] ?? "missing")}`],
    }))];
    const findings = [...staticFindings(law, run), ...(exam && !exam.passed ? [{ code: exam.code, evidenceRefs: [exam.ref] }] : [])];
    if (level === "RELEASE") for (const mode of law.evidenceModes.filter((current) => current.startsWith("dynamic."))) {
      const proof = dynamics.get(dynamicScriptFor(law.capabilityDomain, mode)) ?? fail("PROJECT_CHECK_MISSING", `${law.lawId}:${mode}`);
      assertions.push({ clauses: clausesForEvidenceMode(law, requiredModes(law, reportLevel), mode), evidenceMode: mode, passed: proof.passed, refs: [proof.ref] });
      if (!proof.passed) findings.push({ code: proof.code, evidenceRefs: [proof.ref] });
    }
    return { lawId: law.lawId, assertions, findings };
  });
  if (candidateSnapshot() !== candidate) fail("CANDIDATE_DRIFT", level);
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
