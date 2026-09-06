import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { buildRegistry, parseLawSource, providerDomainForDependencySpec } from "../governance-authority.js";
import type { Law, Level, Registry } from "../governance-contract.js";
import { diffPaths, gitCommit } from "../governance-git-state.js";
import { BASE, FUNCTIONAL, REPORT } from "./governance-paths.js";
import { canonicalBytes, rejectDuplicateJsonKeys } from "../governance-json.js";
import { ROOT, fail, repositoryPaths, sha } from "../governance-runtime.js";
import { buildQualityReport, type LawExecutionResult, type QualityAssertion, type QualityFinding, type QualityParticipant } from "./quality-contract.js";
import { runInspectionWorker } from "./quality-inspector-worker.js";
import type { InspectorFinding, InspectorLawResult, SessionInspectorOutput } from "./inspector-contracts.js";
import { dynamicReceiptFileValid, examReceiptFileValid, parseQualityProofObservations, producerClaimRoutesMatch, type QualityProofObservation, type QualityProofRequest } from "./proof-observation.js";
import { dynamicScriptFor, examScriptFor } from "./quality-routes.js";
import { validateProviderContractSpec, type ProviderContract } from "./provider-contract-authority.js";
import { executeCaptured, mapWithConcurrency } from "./quality-process-execution.js";
import { copyTargets, sealedSnapshotDigest } from "./sealed-target-snapshot.js";
export { dynamicScriptFor } from "./quality-routes.js";
type TargetSet = { queryRef: string; count: number };
type ProofRoute = { law: Law; mode: string };
type ProofResult = { assertions: QualityAssertion[]; findings: QualityFinding[] };
type ProofResultInput = {
  routes: ProofRoute[];
  observations: ReadonlyMap<string, QualityProofObservation>;
  executionPassed: boolean;
};
type Dependency = { contractId: string; providerRepo: string; providerDomain: string; version: number };
type BoundParticipant = { path: string; report: QualityParticipant };
type QualityRunContext = {
  candidate: string;
  laws: Law[];
  registry: Registry;
  runDirectory: string;
  reportLevel: "READY" | "RELEASE";
};
const STATIC_CONCURRENCY = Math.min(3, availableParallelism());
const EXAM_CONCURRENCY = Math.min(4, availableParallelism());
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
export const assertExactProviderContract = (
  repo: string, dependency: Dependency, available: readonly Dependency[],
): void => {
  const matches = available.filter((contract) => contract.providerRepo === repo
    && contract.providerDomain === dependency.providerDomain
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
export const assertParticipantCommitIdentity = (expected: string, actual: string, repo: string): void => {
  if (actual !== expected) fail("RELEASE_PARTICIPANT_DRIFT", repo);
};
const assertParticipantCommits = (participants: readonly BoundParticipant[]): void => {
  for (const participant of participants) {
    assertParticipantCommitIdentity(participant.report.gitCommit, gitAt(participant.path, ["rev-parse", "HEAD"]), participant.report.repo);
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
    ownerInspectorPath: inspectorPath(domain), sealedRoot, targetPaths: paths,
  };
  writeFileSync(requestPath, canonicalBytes(request), { mode: 0o600 });
  const worker = resolve(ROOT, "scripts/audit/shared/quality-inspector-worker.ts");
  if (runInspectionWorker.name !== "runInspectionWorker") fail("INSPECTOR_WORKER_INVALID", worker);
  const loader = resolve(ROOT, "node_modules/tsx/dist/loader.mjs");
  const execution = await executeCaptured(process.execPath, ["--import", loader, worker], {
    cwd: sealedRoot,
    env: { ...process.env, GOVERNANCE_INSPECTION_REQUEST: requestPath, GOVERNANCE_SEALED_ROOT: sealedRoot,
      GOVERNANCE_BINDING_CONTRACT: JSON.stringify({ targetPaths: paths }) },
  });
  if (sealedSnapshotDigest(sealedRoot, paths) !== sealedBefore) {
    fail("INSPECTOR_WORKER_INVALID", `${domain}:sealed-target-drift`);
  }
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
    const observation = input.observations.get(`${law.lawId}\0${mode}`)
      ?? fail("LAW_EVIDENCE_MISSING", `${law.lawId}:${mode}:native-observation`);
    const current = results.get(law.lawId) ?? { assertions: [], findings: [] };
    current.assertions.push({
      clauses: [...observation.clauses], evidenceMode: mode,
      passed: observation.passed && input.executionPassed, refs: ordered(observation.refs),
    });
    current.findings.push(...observation.findings);
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
const nativeReceiptMatches = (locator: string, receipt: string, nativeReceiptDirectory: string): boolean => {
  const filePath = resolve(locator);
  const receiptRoot = resolve(nativeReceiptDirectory);
  if (filePath !== locator || dirname(filePath) !== receiptRoot || !existsSync(filePath) || !existsSync(receiptRoot)) return false;
  const rootStat = lstatSync(receiptRoot);
  const fileStat = lstatSync(filePath);
  return rootStat.isDirectory() && !rootStat.isSymbolicLink()
    && fileStat.isFile() && !fileStat.isSymbolicLink() && fileStat.size <= 16 * 1024 * 1024
    && sha(readFileSync(filePath)) === receipt;
};
const observationAuthenticatesRequest = (
  observation: QualityProofObservation, request: QualityProofRequest, kind: "exam" | "dynamic",
  nativeReceiptDirectory: string | null, script: string,
): boolean => {
  if (observation.proofRunId !== request.proofRunId || observation.candidate !== request.candidate
    || observation.proofKind !== request.proofKind || observation.proofKind !== kind) return false;
  if (nativeReceiptDirectory === null || observation.refs.length !== 1) return false;
  return observation.refs.every((reference) => {
    const match = new RegExp(`^${kind}:([^#@]+)#([^#@]+)@([a-f0-9]{64})$`, "u").exec(reference);
    if (!match) return false;
    let locator: string;
    let selector: string;
    try { locator = decodeURIComponent(match[1]!); selector = decodeURIComponent(match[2]!); } catch { return false; }
    const identity = `lawId=${request.lawId};mode=${request.evidenceMode};command=npm run ${script};`;
    const execution = `;run=${request.proofRunId};candidate=${request.candidate};`;
    const caseMarker = "case=";
    const runMarker = ";run=";
    const caseIndex = selector.indexOf(caseMarker);
    const runIndex = selector.indexOf(runMarker);
    const caseLocator = caseIndex >= 0 && runIndex > caseIndex
      ? selector.slice(caseIndex + caseMarker.length, runIndex) : "";
    const observedValueMarker = ";observedValue=";
    const observedValueIndex = selector.indexOf(observedValueMarker);
    const observedValue = observedValueIndex >= 0
      ? selector.slice(observedValueIndex + observedValueMarker.length) : "";
    return selector.startsWith(identity) && selector.includes(execution)
      && caseLocator.length > 0 && observedValue.length > 0
      && nativeReceiptMatches(locator, match[3]!, nativeReceiptDirectory)
      && (kind === "dynamic"
        ? dynamicReceiptFileValid(locator, {
          lawId: observation.lawId, evidenceMode: observation.evidenceMode, clauses: observation.clauses,
          observedValue, proofRunId: observation.proofRunId, candidate: observation.candidate,
          producerScript: script,
        })
        : examReceiptFileValid(locator, {
          lawId: observation.lawId, evidenceMode: observation.evidenceMode, clauses: observation.clauses,
          observedValue, caseLocator, proofRunId: observation.proofRunId, candidate: observation.candidate,
          producerScript: script,
        }));
  });
};
export const bindNativeProofObservations = (
  stdout: string,
  routes: readonly ProofRoute[],
  requests: readonly QualityProofRequest[],
  script: string,
  kind: "exam" | "dynamic",
  nativeReceiptDirectory: string | null = null,
): Map<string, QualityProofObservation> => {
  const index = proofRequestIndex(routes, requests);
  const bound = new Map<string, QualityProofObservation>();
  let observations: QualityProofObservation[];
  try { observations = parseQualityProofObservations(stdout); }
  catch { return fail("LAW_EVIDENCE_MISSING", "invalid native proof observation"); }
  const nativeLocators = new Set<string>();
  for (const observation of observations) {
    const key = `${observation.lawId}\0${observation.evidenceMode}`;
    if (!index.expected.has(key)) fail("LAW_EVIDENCE_UNEXPECTED", key.replace("\0", ":"));
    if (bound.has(key)) fail("LAW_EVIDENCE_DUPLICATE", key.replace("\0", ":"));
    const request = index.byRoute.get(key)!;
    if (!observationAuthenticatesRequest(observation, request, kind, nativeReceiptDirectory, script)) {
      fail("LAW_EVIDENCE_MISSING", `native-receipt-binding:${key.replace("\0", ":")}`);
    }
    {
      const locator = /^(?:dynamic|exam):([^#@]+)#/u.exec(observation.refs[0]!)?.[1];
      if (!locator) return fail("LAW_EVIDENCE_MISSING", `native-receipt-locator:${key.replace("\0", ":")}`);
      let decoded: string;
      try { decoded = decodeURIComponent(locator); } catch { return fail("LAW_EVIDENCE_MISSING", "native-receipt-locator"); }
      if (nativeLocators.has(decoded)) fail("LAW_EVIDENCE_DUPLICATE", `native-receipt-locator:${decoded}`);
      nativeLocators.add(decoded);
    }
    bound.set(key, observation);
  }
  return bound;
};
const executeProofCommand = async (
  kind: "exam" | "dynamic", script: string, routes: ProofRoute[],
  runDirectory: string, candidate: string,
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
  const timeoutMs = kind === "exam" ? 300_000 : 7_200_000;
  const token = sha(`${kind}:${script}`).slice(0, 12);
  const nativeReceiptDirectory = resolve(runDirectory, `${kind}-${token}-native-receipts`);
  mkdirSync(nativeReceiptDirectory, { recursive: false, mode: 0o700 });
  const execution = await executeCaptured("npm", ["run", script], {
    cwd: ROOT,
    timeout: timeoutMs,
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
  const observations = bindNativeProofObservations(
    execution.stdout ?? "", routes, requests, script, kind,
    nativeReceiptDirectory,
  );
  const executionPassed = execution.status === 0 && execution.signal === null;
  if (!executionPassed || observations.size !== routes.length) process.stderr.write(execution.stderr || execution.stdout || `${script} failed\n`);
  if (!executionPassed) fail("CHECK_EXECUTION_FAILED", script);
  if (observations.size !== routes.length) fail("LAW_EVIDENCE_MISSING", `${script}:native-observation-denominator`);
  return proofResults({
    routes, observations, executionPassed,
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
const staticResults = async (context: QualityRunContext): Promise<Map<string, LawExecutionResult>> => {
  const repositoryPathSnapshot = repositoryPaths();
  const targets = new Map(context.laws.map((law) => [
    law.lawId, computeTargetPaths(law, context.registry, repositoryPathSnapshot),
  ]));
  const resultsByLaw = new Map<string, LawExecutionResult>();
  const domainResults = await mapWithConcurrency(context.registry.domains, STATIC_CONCURRENCY, async (domain) => {
    const domainLaws = context.laws.filter((law) => law.capabilityDomain === domain.capabilityDomain);
    const results = await runStaticDomain(domain.capabilityDomain, domainLaws, targets, context.runDirectory);
    assertCleanCandidate(context.candidate, domain.capabilityDomain);
    return results;
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
  const proofs = await mapWithConcurrency(routedDomains, EXAM_CONCURRENCY, ({ routes, script }) =>
    executeProofCommand("exam", script, routes, context.runDirectory, context.candidate));
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
  for (const [script, routes] of routesByScript) addProofs(resultsByLaw,
    await executeProofCommand("dynamic", script, routes, context.runDirectory, context.candidate));
};
export const runFullQuality = async (
  level: Level,
  preparedRegistry?: Registry,
): Promise<{ reportPath: string; outcome: "PASS" | "FAIL" }> => {
  if (level === "CHANGE") fail("ENTRY_CONTRACT_MISMATCH", "full quality requires READY or RELEASE");
  const registry = preparedRegistry ?? buildRegistry();
  const laws = registry.laws;
  const commit = gitCommit();
  if (diffPaths().length) fail(level === "READY" ? "READY_GIT_COMMIT_REQUIRED" : "RELEASE_GIT_COMMIT_REQUIRED", "dirty worktree");
  const candidate = commit;
  const runDirectory = outputDirectory();
  const boundParticipants = level === "RELEASE" ? bindReleaseParticipants() : [];
  const context: QualityRunContext = { candidate, laws, registry, runDirectory, reportLevel: level === "READY" ? "READY" : "RELEASE" };
  const resultsByLaw = await staticResults(context);
  await runExamProofs(context, resultsByLaw);
  if (level === "RELEASE") await runDynamicProofs(context, resultsByLaw);
  const results = laws.map((law) => resultsByLaw.get(law.lawId) ?? fail("LAW_DENOMINATOR_MISSING", law.lawId));
  assertCleanCandidate(candidate, level);
  assertParticipantCommits(boundParticipants);
  const report = buildQualityReport({
    level, gitCommit: commit, laws, results,
    participants: boundParticipants.map((participant) => participant.report),
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
  process.stdout.write(`QUALITY_REPORT ${reportPath}\n${level}_${report.outcome}\n`);
  return { reportPath, outcome: report.outcome };
};
