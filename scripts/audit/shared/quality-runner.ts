import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { buildRegistry, diffPaths, gitCommit, REPORT, type Law, type Level, type Registry } from "../governance-authority.js";
import { canonicalBytes } from "../governance-json.js";
import { ROOT, fail, repositoryPaths, sha } from "../governance-runtime.js";
import { buildQualityReport, clausesForEvidenceMode, requiredModes, type LawExecutionResult, type QualityAssertion, type QualityFinding, type QualityParticipant } from "./quality-contract.js";
import { runInspectionWorker } from "./quality-inspector-worker.js";
import type { InspectorFinding, InspectorLawResult, SessionInspectorOutput } from "./inspector-contracts.js";
import { parseQualityProofObservations, type QualityProofObservation, type QualityProofRequest } from "./proof-observation.js";
import { dynamicScriptFor, examScriptFor, observationMatchesRoute } from "./quality-routes.js";

export { dynamicScriptFor } from "./quality-routes.js";

type TargetSet = { queryRef: string; count: number };
type ProofResult = { assertions: QualityAssertion[]; findings: QualityFinding[] };
type ProofRoute = { law: Law; mode: string };
type ProofResultInput = {
  kind: "exam" | "dynamic"; routes: ProofRoute[]; path: string; digest: string;
  observations: ReadonlyMap<string, QualityProofObservation>;
  executionPassed: boolean; executionStatus: number | null; script: string;
  proofRunId: string; candidate: string; stdoutSha256: string;
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

export const assertParticipantCommitIdentity = (expected: string, actual: string, repo: string): void => {
  if (actual !== expected) fail("RELEASE_PARTICIPANT_DRIFT", repo);
};

const assertParticipantCommits = (participants: readonly BoundParticipant[]): void => {
  for (const participant of participants) {
    assertParticipantCommitIdentity(participant.report.gitCommit, gitAt(participant.path, ["rev-parse", "HEAD"]), participant.report.repo);
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
  if (output.lawResults.length !== laws.length) {
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

export const assertCandidateStable = (expected: string, actual: string, label: string): void => {
  if (actual !== expected) fail("CANDIDATE_DRIFT", label);
};
const assertCleanCandidate = (expectedCommit: string, label: string): void => {
  assertCandidateStable(expectedCommit, gitCommit(), label);
  if (diffPaths().length) fail("CANDIDATE_DRIFT", `${label}:dirty-worktree`);
};
const proofResults = (input: ProofResultInput): Map<string, ProofResult> => {
  const results = new Map<string, ProofResult>();
  for (const { law, mode } of input.routes) {
    const observation = input.observations.get(`${law.lawId}\0${mode}`);
    const locator = input.kind === "exam" ? `command:npm run ${input.script}`
      : observation?.locator ?? "native-observation:missing";
    const observedValue = input.kind === "exam"
      ? `run=${input.proofRunId};candidate=${input.candidate};exitStatus=${input.executionStatus};stdoutSha256=${input.stdoutSha256}`
      : observation?.observedValue ?? "QUALITY_PROOF_OBSERVATION_MISSING";
    const passed = input.executionPassed && observation !== undefined;
    const selector = encodeURIComponent(`lawId=${law.lawId};mode=${mode};locator=${locator};observed=${observedValue}`);
    const ref = `${input.kind}:${input.path}#${selector}@${input.digest}`;
    const current = results.get(law.lawId) ?? { assertions: [], findings: [] };
    current.assertions.push({
      clauses: clausesForEvidenceMode(law, requiredModes(law, input.kind === "exam" ? "READY" : "RELEASE"), mode),
      evidenceMode: mode, passed, refs: [ref],
    });
    if (!passed) current.findings.push({ code: input.executionStatus === 0 ? "LAW_EVIDENCE_MISSING" : "CHECK_EXECUTION_FAILED", evidenceRefs: [ref] });
    results.set(law.lawId, current);
  }
  return results;
};

const proofRequestIndex = (
  routes: readonly ProofRoute[], requests: readonly QualityProofRequest[],
): Readonly<{ expected: ReadonlySet<string>; byRoute: ReadonlyMap<string, QualityProofRequest> }> => {
  const expected = new Set(routes.map(({ law, mode }) => `${law.lawId}\0${mode}`));
  const byRoute = new Map(requests.map((request) => [`${request.lawId}\0${request.evidenceMode}`, request]));
  if (expected.size !== routes.length || byRoute.size !== requests.length || requests.length !== routes.length
    || [...expected].some((key) => !byRoute.has(key))) fail("LAW_EVIDENCE_MISSING", "native proof route request");
  return { expected, byRoute };
};

const assertObservationRequest = (
  observation: QualityProofObservation, request: QualityProofRequest, key: string,
): void => {
  if (observation.proofRunId !== request.proofRunId || observation.candidate !== request.candidate
    || observation.proofKind !== request.proofKind) {
    fail("LAW_EVIDENCE_MISSING", `unauthenticated:${key.replace("\0", ":")}`);
  }
};

export const bindNativeProofObservations = (
  stdout: string,
  routes: readonly ProofRoute[],
  requests: readonly QualityProofRequest[],
  script: string,
  kind: "exam" | "dynamic",
): Map<string, QualityProofObservation> => {
  const index = proofRequestIndex(routes, requests);
  const bound = new Map<string, QualityProofObservation>();
  let observations: QualityProofObservation[];
  try { observations = parseQualityProofObservations(stdout); }
  catch { return fail("LAW_EVIDENCE_MISSING", "invalid native proof observation"); }
  for (const observation of observations) {
    const key = `${observation.lawId}\0${observation.evidenceMode}`;
    if (!index.expected.has(key)) fail("LAW_EVIDENCE_UNEXPECTED", key.replace("\0", ":"));
    if (bound.has(key)) fail("LAW_EVIDENCE_DUPLICATE", key.replace("\0", ":"));
    const request = index.byRoute.get(key)!;
    assertObservationRequest(observation, request, key);
    const route = routes.find(({ law, mode }) => `${law.lawId}\0${mode}` === key)!;
    if (!observationMatchesRoute({
      kind, script, domain: route.law.capabilityDomain, lawId: observation.lawId,
      mode: observation.evidenceMode, locator: observation.locator, observedValue: observation.observedValue,
    })) fail("LAW_EVIDENCE_MISSING", `native-object:${key.replace("\0", ":")}`);
    if ([...bound.values()].some((current) => current.locator === observation.locator)) {
      fail("LAW_EVIDENCE_DUPLICATE", `locator:${observation.locator}`);
    }
    bound.set(key, observation);
  }
  return bound;
};

const commandReceipt = (
  kind: "exam" | "dynamic", script: string, routes: ProofRoute[],
  runDirectory: string, candidate: string,
): Map<string, ProofResult> => {
  const startedAt = new Date().toISOString();
  const proofRunId = sha(`${candidate}\0${kind}\0${script}\0${startedAt}\0${process.pid}`);
  const requests: QualityProofRequest[] = routes.map(({ law, mode }) => ({
    lawId: law.lawId, evidenceMode: mode, proofRunId, candidate, proofKind: kind,
  }));
  assertCleanCandidate(candidate, `${script}:before`);
  const timeoutMs = kind === "exam" ? 300_000 : 900_000;
  const execution = spawnSync("npm", ["run", script], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: timeoutMs,
    env: {
      ...process.env,
      GOVERNANCE_PROOF_KIND: kind,
      GOVERNANCE_PROOF_RUN_ID: proofRunId,
      GOVERNANCE_PROOF_CANDIDATE: candidate,
      GOVERNANCE_PROOF_REQUESTS: JSON.stringify(requests),
    },
  });
  assertCleanCandidate(candidate, `${script}:after`);
  const token = sha(`${kind}:${script}`).slice(0, 12);
  const stdoutPath = resolve(runDirectory, `${kind}-${token}.stdout.txt`);
  const stderrPath = resolve(runDirectory, `${kind}-${token}.stderr.txt`);
  writeFileSync(stdoutPath, execution.stdout ?? "", { mode: 0o600 });
  writeFileSync(stderrPath, execution.stderr ?? "", { mode: 0o600 });
  const observations = bindNativeProofObservations(execution.stdout ?? "", routes, requests, script, kind);
  const executionPassed = execution.status === 0 && execution.signal === null;
  const path = resolve(runDirectory, `${kind}-${token}.receipt.json`);
  const receipt = {
    schemaVersion: 2, kind, candidate, proofRunId, command: `npm run ${script}`, timeoutMs, startedAt,
    finishedAt: new Date().toISOString(), exitStatus: execution.status, signal: execution.signal ?? null,
    stdoutPath, stdoutSha256: sha(readFileSync(stdoutPath)), stderrPath, stderrSha256: sha(readFileSync(stderrPath)),
    observations: routes.map(({ law, mode }) => {
      const observation = observations.get(`${law.lawId}\0${mode}`);
      return { lawId: law.lawId, evidenceMode: mode, locator: observation?.locator ?? "native-observation:missing",
        observedValue: observation?.observedValue ?? "QUALITY_PROOF_OBSERVATION_MISSING",
        passed: executionPassed && observation !== undefined };
    }),
    cleanup: { processExited: execution.signal === null, temporaryEvidenceExternal: path.startsWith(resolve(tmpdir())) },
  };
  writeFileSync(path, canonicalBytes(receipt), { mode: 0o600 });
  const digest = sha(readFileSync(path));
  if (!executionPassed || observations.size !== routes.length) process.stderr.write(execution.stderr || execution.stdout || `${script} failed\n`);
  return proofResults({
    kind, routes, path, digest, observations, executionPassed, executionStatus: execution.status,
    script, proofRunId, candidate, stdoutSha256: receipt.stdoutSha256,
  });
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
    assertCleanCandidate(context.candidate, domain.capabilityDomain);
  }
  return resultsByLaw;
};

const runExamProofs = (context: QualityRunContext, resultsByLaw: Map<string, LawExecutionResult>): void => {
  for (const domain of context.registry.domains) {
    const routes = context.laws.filter((law) => law.capabilityDomain === domain.capabilityDomain)
      .flatMap((law) => law.evidenceModes.filter((mode) => mode.startsWith("exam.")).map((mode) => ({ law, mode })));
    if (!routes.length) continue;
    const script = examScriptFor(domain.capabilityDomain);
    addProofs(resultsByLaw, commandReceipt("exam", script, routes, context.runDirectory, context.candidate));
  }
};

const runDynamicProofs = (context: QualityRunContext, resultsByLaw: Map<string, LawExecutionResult>): void => {
  const routesByScript = new Map<string, ProofRoute[]>();
  for (const law of context.laws) for (const mode of law.evidenceModes.filter((current) => current.startsWith("dynamic."))) {
    const script = dynamicScriptFor(law.capabilityDomain, mode);
    routesByScript.set(script, [...(routesByScript.get(script) ?? []), { law, mode }]);
  }
  for (const [script, routes] of routesByScript) addProofs(resultsByLaw,
    commandReceipt("dynamic", script, routes, context.runDirectory, context.candidate));
};

export const runFullQuality = async (level: Level): Promise<{ reportPath: string; outcome: "PASS" | "FAIL" }> => {
  if (level === "CHANGE") fail("ENTRY_CONTRACT_MISMATCH", "full quality requires READY or RELEASE");
  const registry = buildRegistry();
  const laws = registry.laws;
  const commit = gitCommit();
  if (diffPaths().length) fail(level === "READY" ? "READY_GIT_COMMIT_REQUIRED" : "RELEASE_GIT_COMMIT_REQUIRED", "dirty worktree");
  const candidate = commit;
  const runDirectory = outputDirectory();
  const boundParticipants = level === "RELEASE" ? bindReleaseParticipants() : [];
  const context: QualityRunContext = { candidate, laws, registry, runDirectory, reportLevel: level === "READY" ? "READY" : "RELEASE" };
  const resultsByLaw = staticResults(context);
  runExamProofs(context, resultsByLaw);
  if (level === "RELEASE") runDynamicProofs(context, resultsByLaw);
  const results = laws.map((law) => resultsByLaw.get(law.lawId) ?? fail("LAW_DENOMINATOR_MISSING", law.lawId));
  assertCleanCandidate(candidate, level);
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
