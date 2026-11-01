import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, resolve } from "node:path";
import { buildRegistry, parseLawSource, providerDomainForDependencySpec } from "../governance-authority.js";
import type { Law, Level, Registry } from "../governance-contract.js";
import { gitWorktreeStatus, gitCommit } from "../governance-git-state.js";
import { BASE, FUNCTIONAL, REPORT } from "./governance-paths.js";
import { canonicalBytes, rejectDuplicateJsonKeys } from "../governance-json.js";
import { ROOT, fail, repositoryPaths, sha } from "../governance-runtime.js";
import { buildQualityReport, qualityFailureFinding, type LawExecutionResult, type QualityAssertion, type QualityFinding, type QualityParticipant } from "./quality-contract.js";
import { runInspectionWorker } from "./quality-inspector-worker.js";
import type { InspectorFinding, InspectorLawResult, SessionInspectorOutput } from "./inspector-contracts.js";
import { producerClaimRoutesMatch, type QualityProofObservation, type QualityProofRequest } from "./proof-observation.js";
import { dynamicScriptFor, examScriptFor } from "./quality-routes.js";
import { validateProviderContractSpec, type ProviderContract } from "./provider-contract-authority.js";
import { assertQualityCommandPassed, collectQualityCheck, executeCaptured, mapWithConcurrency, writeQualityIssues, type QualityCheckIssue } from "./quality-process-execution.js";
import { createQualityOutputDirectory } from "./quality-output-directory.js";
import { byteCompare, orderedUnique as ordered } from "./quality-ordering.js";
import {
  assertExactProviderContract,
  assertParticipantCommitIdentity,
  type ProviderDependency,
} from "./quality-participant-binding.js";
import { copyTargets, sealedSnapshotDigest } from "./sealed-target-snapshot.js";
export { dynamicScriptFor } from "./quality-routes.js";
import { bindNativeProofObservations, type ProofRoute } from "./quality-proof-binding.js";
type TargetSet = { queryRef: string; count: number };
type ProofResult = { assertions: QualityAssertion[]; findings: QualityFinding[] };
type ProofResultInput = {
  routes: ProofRoute[];
  observations: ReadonlyMap<string, QualityProofObservation>;
  executionPassed: boolean;
};
type Dependency = ProviderDependency;
type BoundParticipant = { path: string; report: QualityParticipant };
type QualityRunContext = {
  candidate: string;
  laws: Law[];
  registry: Registry;
  runDirectory: string;
  issues: QualityCheckIssue[];
};
const STATIC_CONCURRENCY = Math.min(3, availableParallelism());
const EXAM_CONCURRENCY = Math.min(4, availableParallelism());
const matches = (pattern: string, path: string): boolean => pattern === "**/*" || pattern === path
  || (pattern.endsWith("/**") && (path === pattern.slice(0, -3) || path.startsWith(`${pattern.slice(0, -3)}/`)))
  || (() => {
    const marker = "/**/*.";
    const index = pattern.indexOf(marker);
    return index >= 0 && path.startsWith(`${pattern.slice(0, index)}/`)
      && path.endsWith(`.${pattern.slice(index + marker.length)}`);
  })();
const consumerDependencies = (): Dependency[] => repositoryPaths()
  .filter((path) => path.startsWith("docs/specs/") && path.endsWith(".json"))
  .flatMap((path) => {
    const spec = JSON.parse(readFileSync(resolve(ROOT, path), "utf8")) as { status?: string; specKind?: string; contract?: Partial<Dependency> };
    const contract = spec.contract;
    return spec.status === "active" && spec.specKind === "cross-repo-dependency"
      && typeof contract?.contractId === "string" && typeof contract.providerRepo === "string"
      && typeof contract.version === "number"
      ? [{ contractId: contract.contractId, providerRepo: contract.providerRepo,
        providerDomain: providerDomainForDependencySpec(path), version: contract.version }]
      : [];
  });
const participantPath = (repo: string): string => {
  const configured = process.env.GRASSEYE_PROVIDER_REPOSITORIES?.trim();
  if (!configured) return fail("EXTERNAL_SURFACE_AUTHORITY_MISSING", repo);
  let paths: Record<string, unknown>;
  try {
    rejectDuplicateJsonKeys(configured, "GRASSEYE_PROVIDER_REPOSITORIES");
    const parsed = JSON.parse(configured) as unknown;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("mapping required");
    paths = parsed as Record<string, unknown>;
  } catch {
    return fail("EXTERNAL_SURFACE_AUTHORITY_MISSING", `${repo}:invalid-provider-map`);
  }
  const configuredPath = paths[repo];
  if (typeof configuredPath !== "string" || !configuredPath.trim()) {
    return fail("EXTERNAL_SURFACE_AUTHORITY_MISSING", repo);
  }
  const providerPath = resolve(configuredPath);
  try {
    if (!existsSync(providerPath) || !lstatSync(providerPath).isDirectory()) throw new Error("directory required");
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: providerPath, stdio: "ignore" });
  } catch {
    return fail("EXTERNAL_SURFACE_AUTHORITY_MISSING", `${repo}:invalid-git-repository`);
  }
  return providerPath;
};
const gitAt = (path: string, args: string[]): string => execFileSync("git", args, {
  cwd: path, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
}).trim();
const providerLawDomains = (path: string, commit: string): Map<string, string> => {
  const laws = [
    ...parseLawSource(gitAt(path, ["show", `${commit}:${BASE}`]), BASE, "base-law", 100),
    ...parseLawSource(gitAt(path, ["show", `${commit}:${FUNCTIONAL}`]), FUNCTIONAL, "functional-law", 90),
  ];
  const lawDomains = new Map(laws.map((law) => [law.lawId, law.capabilityDomain]));
  if (lawDomains.size !== laws.length) fail("EXTERNAL_SURFACE_AUTHORITY_MISSING", `${commit}:provider-law-identity`);
  return lawDomains;
};
const providerContracts = (path: string, commit: string, repo: string): ProviderContract[] => {
  const lawDomains = providerLawDomains(path, commit);
  const paths = gitAt(path, ["ls-tree", "-r", "--name-only", commit, "--", "docs/specs"])
    .split("\n").filter((current) => current.endsWith(".json"));
  return paths.flatMap((specPath) => {
    const source = gitAt(path, ["show", `${commit}:${specPath}`]);
    rejectDuplicateJsonKeys(source, specPath);
    const spec = JSON.parse(source) as Record<string, unknown>;
    if (spec.status !== "active" || spec.specKind !== "cross-repo-contract") return [];
    return [validateProviderContractSpec(spec, repo, lawDomains, (artifactPath) => {
      try { gitAt(path, ["cat-file", "-e", `${commit}:${artifactPath}`]); return true; } catch { return false; }
    })];
  });
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
    if (gitAt(path, ["status", "--porcelain=v1", "--untracked-files=all"])) fail("RELEASE_PARTICIPANT_DRIFT", `${repo}:dirty`);
    const gitCommit = gitAt(path, ["rev-parse", "HEAD"]);
    const available = providerContracts(path, gitCommit, repo);
    for (const dependency of dependencies) assertExactProviderContract(repo, dependency, available);
    const contracts = ordered(dependencySignatures).map((signature) => {
      const [contractId, version] = signature.split("\0");
      return { contractId: contractId!, version: Number(version) };
    });
    return { path, report: { repo, gitCommit, contracts } };
  });
};
const assertParticipantCommits = (participants: readonly BoundParticipant[]): void => {
  for (const participant of participants) {
    assertParticipantCommitIdentity(participant.report.gitCommit, gitAt(participant.path, ["rev-parse", "HEAD"]), participant.report.repo);
    if (gitAt(participant.path, ["status", "--porcelain=v1", "--untracked-files=all"])) {
      fail("RELEASE_PARTICIPANT_DRIFT", `${participant.report.repo}:dirty`);
    }
  }
};
const inspectorPath = (domain: string): string => `scripts/audit/domains/${domain}/inspector.ts`;
export const computeTargetPaths = (
  law: Law,
  registry: Registry,
  repositoryPathSnapshot: readonly string[] = repositoryPaths(),
): string[] => {
  const manifest = registry.domains.find((domain) => domain.capabilityDomain === law.capabilityDomain)
    ?? fail("ACTIVE_LAW_DENOMINATOR_MISMATCH", law.capabilityDomain);
  const paths = ordered([
    ...repositoryPathSnapshot.filter((path) => law.appliesTo.some((pattern) => matches(pattern, path))
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
});
export const parseInspectorOutput = (stdout: string, domain: string): SessionInspectorOutput => {
  const line = stdout.split("\n").find((current) => current.startsWith("GOVERNANCE_INSPECTOR_RESULT "));
  if (!line) fail("CHECK_EXECUTION_FAILED", `${domain}:missing inspector output`);
  try { return JSON.parse(line!.slice("GOVERNANCE_INSPECTOR_RESULT ".length)) as SessionInspectorOutput; }
  catch { return fail("CHECK_EXECUTION_FAILED", `${domain}:invalid inspector output`); }
};
const runStaticDomain = async (
  domain: string,
  laws: Law[],
  targetPathsByLaw: ReadonlyMap<string, string[]>,
  runDirectory: string,
  registry: Registry,
): Promise<LawExecutionResult[]> => {
  const paths = ordered(laws.flatMap((law) => targetPathsByLaw.get(law.lawId) ?? []));
  const sealedRoot = copyTargets(paths, runDirectory, domain);
  const sealedBefore = sealedSnapshotDigest(sealedRoot, paths);
  const requestPath = resolve(runDirectory, `${domain}.inspection-request.json`);
  const request = {
    capabilityDomain: domain,
    laws: laws.map((law) => {
      const lawPaths = targetPathsByLaw.get(law.lawId) ?? [];
      return {
        lawId: law.lawId,
        forbiddenCount: law.forbidden.length,
        requiredStaticModes: law.evidenceModes.filter((mode) => mode.startsWith("static.")),
        targetPaths: lawPaths,
        targetSet: targetSet(law.lawId, lawPaths),
      };
    }),
    ownerInspectorPath: inspectorPath(domain),
    ownerInspectorPlan: registry.domains.map((entry) => ({
      capabilityDomain: entry.capabilityDomain,
      lawIds: [...entry.lawIds],
    })),
    sealedRoot,
    targetPaths: paths,
  };
  writeFileSync(requestPath, canonicalBytes(request), { mode: 0o600 });
  const worker = resolve(ROOT, "scripts/audit/shared/quality-inspector-worker.ts");
  if (runInspectionWorker.name !== "runInspectionWorker") fail("INSPECTOR_WORKER_INVALID", worker);
  const loader = resolve(ROOT, "node_modules/tsx/dist/loader.mjs");
  const inspectionStarted = performance.now();
  process.stderr.write(`[QUALITY][static:start] ${domain}\n`);
  const execution = await executeCaptured(process.execPath, ["--import", loader, worker], {
    cwd: sealedRoot,
    env: { ...process.env, GOVERNANCE_INSPECTION_REQUEST: requestPath, GOVERNANCE_SEALED_ROOT: sealedRoot,
      GOVERNANCE_BINDING_CONTRACT: JSON.stringify({ targetPaths: paths }) },
  });
  process.stderr.write(`[QUALITY][static:end] ${domain} elapsedMs=${Math.round(performance.now() - inspectionStarted)} status=${execution.status} signal=${execution.signal}\n`);
  try {
    if (sealedSnapshotDigest(sealedRoot, paths) !== sealedBefore) fail("INSPECTOR_WORKER_INVALID", `${domain}:sealed-target-drift`);
  } catch (error) {
    fail("INSPECTOR_WORKER_INVALID", `${domain}:sealed-target-invalid:${error instanceof Error ? error.message : String(error)}`);
  }
  if (execution.status !== 0) {
    process.stderr.write(execution.stderr || execution.stdout || `${domain} inspector failed\n`);
    assertQualityCommandPassed(execution, `${domain}:static-inspector`);
  }
  const output = parseInspectorOutput(execution.stdout, domain);
  const lawIds = laws.map((law) => law.lawId);
  if (output.capabilityDomain !== domain || JSON.stringify(output.reportedLawIds) !== JSON.stringify(lawIds)) {
    fail("LAW_DENOMINATOR_MISSING", domain);
  }
  if (output.lawResults.length !== laws.length) {
    fail("LAW_DENOMINATOR_MISSING", `${domain}:execution receipt`);
  }
  const resultLawIds = output.lawResults.map((result) => result.lawId);
  if (new Set(resultLawIds).size !== resultLawIds.length) fail("LAW_EVIDENCE_DUPLICATE", `${domain}:execution receipt`);
  if (resultLawIds.some((lawId) => !lawIds.includes(lawId))) fail("LAW_DENOMINATOR_MISSING", `${domain}:execution receipt ids`);
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
export const assertCandidateStable = (expected: string, actual: string, label: string): void => {
  if (actual !== expected) fail("CANDIDATE_DRIFT", label);
};
const assertCleanCandidate = (expectedCommit: string, label: string): void => {
  assertCandidateStable(expectedCommit, gitCommit(), label);
  if (gitWorktreeStatus().length) fail("CANDIDATE_DRIFT", `${label}:dirty-worktree`);
};
const proofResults = (input: ProofResultInput): Map<string, ProofResult> => {
  const results = new Map<string, ProofResult>();
  for (const { law, mode } of input.routes) {
    const observation = input.observations.get(`${law.lawId}\0${mode}`);
    const current = results.get(law.lawId) ?? { assertions: [], findings: [] };
    if (observation) {
      current.assertions.push({
        clauses: [...observation.clauses], evidenceMode: mode,
        passed: observation.passed, refs: ordered(observation.refs),
      });
      current.findings.push(...observation.findings);
    } else current.findings.push(qualityFailureFinding(law, "LAW_EVIDENCE_MISSING", `${mode}:native-observation`));
    if (!input.executionPassed) current.findings.push(qualityFailureFinding(law, "CHECK_EXECUTION_FAILED", `${mode}:proof-command`));
    results.set(law.lawId, current);
  }
  return results;
};
const executeProofCommand = async (
  kind: "exam" | "dynamic", script: string, routes: ProofRoute[],
  runDirectory: string, candidate: string, issues: QualityCheckIssue[],
): Promise<Map<string, ProofResult>> => {
  if (kind === "dynamic" && !producerClaimRoutesMatch(script,
    routes.map(({ law, mode }) => `${law.lawId}:${mode}`)))
    fail("RELEASE_EVIDENCE_MISSING", `${script}:producer-route-denominator`);
  const startedAt = new Date().toISOString();
  const proofRunId = sha(`${candidate}\0${kind}\0${script}\0${startedAt}\0${process.pid}`);
  const requests: QualityProofRequest[] = routes.map(({ law, mode }) => ({
    lawId: law.lawId, evidenceMode: mode, proofRunId, candidate, proofKind: kind,
  }));
  assertCleanCandidate(candidate, `${script}:before`);
  const timeoutMs = kind === "dynamic" ? 7_200_000
    : script === "acceptance:local-browser-terminal" ? 600_000 : 300_000;
  const token = sha(`${kind}:${script}`).slice(0, 12);
  const nativeReceiptDirectory = resolve(runDirectory, `${kind}-${token}-native-receipts`);
  mkdirSync(nativeReceiptDirectory, { recursive: false, mode: 0o700 });
  const execution = await executeCaptured("npm", ["run", script], {
    cwd: ROOT,
    timeout: timeoutMs,
    streamOutput: kind === "exam",
    env: {
      ...process.env,
      GOVERNANCE_PROOF_KIND: kind,
      GOVERNANCE_PROOF_RUN_ID: proofRunId,
      GOVERNANCE_PROOF_CANDIDATE: candidate,
      GOVERNANCE_PROOF_SCRIPT: script,
      GOVERNANCE_PROOF_TIMEOUT_MS: String(timeoutMs),
      GOVERNANCE_PROOF_RECEIPT_DIR: nativeReceiptDirectory,
    },
  });
  assertCleanCandidate(candidate, `${script}:after`);
  const stdoutPath = resolve(runDirectory, `${kind}-${token}.stdout.txt`);
  const stderrPath = resolve(runDirectory, `${kind}-${token}.stderr.txt`);
  writeFileSync(stdoutPath, execution.stdout ?? "", { mode: 0o600 });
  writeFileSync(stderrPath, execution.stderr ?? "", { mode: 0o600 });
  const assertCandidate = (): void => assertCleanCandidate(candidate, script);
  const executionPassed = await collectQualityCheck(`${kind}:${script}`, () => {
    assertQualityCommandPassed(execution, script);
    return true;
  }, assertCandidate, issues) === true;
  const observations = await collectQualityCheck(`${kind}:${script}:receipts`, () => {
    const bound = bindNativeProofObservations(execution.stdout, routes, requests, script, kind, nativeReceiptDirectory);
    if (bound.size !== routes.length) issues.push({ label: `${kind}:${script}:denominator`, status: "FAILED", message: "LAW_EVIDENCE_MISSING: native-observation-denominator" });
    return bound;
  }, assertCandidate, issues) ?? new Map<string, QualityProofObservation>();
  if (kind !== "exam" && (!executionPassed || observations.size !== routes.length)) {
    process.stderr.write(execution.stderr || execution.stdout || `${script} failed\n`);
  }
  return proofResults({
    routes, observations, executionPassed,
  });
};
const addProofs = (resultsByLaw: Map<string, LawExecutionResult>, proofs: ReadonlyMap<string, ProofResult>): void => {
  for (const [lawId, proof] of proofs) {
    const current = resultsByLaw.get(lawId) ?? fail("LAW_DENOMINATOR_MISSING", lawId);
    current.assertions.push(...proof.assertions);
    current.findings.push(...proof.findings);
  }
};
const staticResults = async (context: QualityRunContext): Promise<Map<string, LawExecutionResult>> => {
  const repositoryPathSnapshot = repositoryPaths();
  const targets = new Map(context.laws.map((law) => [
    law.lawId, computeTargetPaths(law, context.registry, repositoryPathSnapshot),
  ]));
  const resultsByLaw = new Map<string, LawExecutionResult>();
  const domainResults = await mapWithConcurrency(context.registry.domains, STATIC_CONCURRENCY, async (domain) => {
    const domainLaws = context.laws.filter((law) => law.capabilityDomain === domain.capabilityDomain);
    const results = await collectQualityCheck(`${domain.capabilityDomain}:static`, () => runStaticDomain(
      domain.capabilityDomain,
      domainLaws,
      targets,
      context.runDirectory,
      context.registry,
    ), () => assertCleanCandidate(context.candidate, domain.capabilityDomain), context.issues);
    return results ?? domainLaws.map((law) => ({ lawId: law.lawId, assertions: [],
      findings: [qualityFailureFinding(law, "CHECK_EXECUTION_FAILED", `${domain.capabilityDomain}:static-inspector`)] }));
  });
  for (const results of domainResults) {
    for (const result of results) {
      if (resultsByLaw.has(result.lawId)) fail("LAW_EVIDENCE_DUPLICATE", result.lawId);
      resultsByLaw.set(result.lawId, result);
    }
  }
  return resultsByLaw;
};
const runExamProofs = async (context: QualityRunContext, resultsByLaw: Map<string, LawExecutionResult>): Promise<void> => {
  const routedDomains = context.registry.domains.flatMap((domain) => {
    const routes = context.laws.filter((law) => law.capabilityDomain === domain.capabilityDomain)
      .flatMap((law) => law.evidenceModes.filter((mode) => mode.startsWith("exam.")).map((mode) => ({ law, mode })));
    return routes.length ? [{ routes, script: examScriptFor(domain.capabilityDomain) }] : [];
  });
  const proofs = await mapWithConcurrency(routedDomains, EXAM_CONCURRENCY, async ({ routes, script }) =>
    await collectQualityCheck(`${script}:exam`, () =>
      executeProofCommand("exam", script, routes, context.runDirectory, context.candidate, context.issues),
    () => assertCleanCandidate(context.candidate, script), context.issues)
      ?? proofResults({ routes, observations: new Map(), executionPassed: false }));
  for (const proof of proofs) addProofs(resultsByLaw, proof);
};
const runDynamicProofs = async (
  context: QualityRunContext,
  resultsByLaw: Map<string, LawExecutionResult>,
): Promise<void> => {
  const routesByScript = new Map<string, ProofRoute[]>();
  for (const law of context.laws) for (const mode of law.evidenceModes.filter((current) => current.startsWith("dynamic."))) {
    const script = dynamicScriptFor(law.capabilityDomain, mode);
    routesByScript.set(script, [...(routesByScript.get(script) ?? []), { law, mode }]);
  }
  for (const [script, routes] of routesByScript) {
    const proofs = await collectQualityCheck(`${script}:dynamic`, () =>
      executeProofCommand("dynamic", script, routes, context.runDirectory, context.candidate, context.issues),
    () => assertCleanCandidate(context.candidate, script), context.issues);
    addProofs(resultsByLaw, proofs ?? proofResults({ routes, observations: new Map(), executionPassed: false }));
  }
};
export const runFullQuality = async (
  level: Level,
  preparedRegistry?: Registry,
  issues: QualityCheckIssue[] = [],
): Promise<{ reportPath: string; outcome: "PASS" | "FAIL" }> => {
  if (level === "CHANGE") fail("ENTRY_CONTRACT_MISMATCH", "full quality requires READY or RELEASE");
  const registry = preparedRegistry ?? buildRegistry();
  const laws = registry.laws;
  const commit = gitCommit();
  if (gitWorktreeStatus().length) fail(level === "READY" ? "READY_GIT_COMMIT_REQUIRED" : "RELEASE_GIT_COMMIT_REQUIRED", "dirty worktree");
  const candidate = commit;
  const runDirectory = createQualityOutputDirectory();
  const boundParticipants = level === "RELEASE" ? bindReleaseParticipants() : [];
  const projectChecksPassed = issues.length === 0;
  const context: QualityRunContext = { candidate, laws, registry, runDirectory, issues };
  const resultsByLaw = await staticResults(context);
  await runExamProofs(context, resultsByLaw);
  if (level === "RELEASE") {
    const staticExam = buildQualityReport({ level: "READY", gitCommit: commit, laws,
      results: laws.map((law) => resultsByLaw.get(law.lawId)!), projectChecksPassed });
    if (issues.length || staticExam.outcome !== "PASS") {
      issues.push({ label: "release:dynamic", status: "BLOCKED", message: "PREREQUISITE_QUALITY_FAILED" });
      for (const law of laws) for (const mode of law.evidenceModes.filter((current) => current.startsWith("dynamic."))) {
        resultsByLaw.get(law.lawId)!.findings.push(qualityFailureFinding(law, "RELEASE_EVIDENCE_MISSING", `${mode}:prerequisite-quality-failed`));
      }
    } else await runDynamicProofs(context, resultsByLaw);
  }
  const results = laws.map((law) => resultsByLaw.get(law.lawId) ?? fail("LAW_DENOMINATOR_MISSING", law.lawId));
  assertCleanCandidate(candidate, level);
  assertParticipantCommits(boundParticipants);
  const report = buildQualityReport({
    level, gitCommit: commit, laws, results,
    participants: boundParticipants.map((participant) => participant.report),
    projectChecksPassed: projectChecksPassed && issues.length === 0,
  });
  const reportPath = process.env.CI || process.env.GRASSEYE_QUALITY_OUTPUT_DIR ? resolve(runDirectory, "law-quality.report.json") : resolve(ROOT, REPORT);
  mkdirSync(dirname(reportPath), { recursive: true });
  const temporary = `${reportPath}.tmp-${process.pid}`;
  try {
    writeFileSync(temporary, canonicalBytes(report));
    assertCleanCandidate(candidate, level);
    assertParticipantCommits(boundParticipants);
    renameSync(temporary, reportPath);
  } catch (error) {
    if (existsSync(temporary)) unlinkSync(temporary);
    throw error;
  }
  writeQualityIssues(issues);
  process.stdout.write(`QUALITY_REPORT ${reportPath}\n${level}_${report.outcome}\n`);
  return { reportPath, outcome: report.outcome };
};
