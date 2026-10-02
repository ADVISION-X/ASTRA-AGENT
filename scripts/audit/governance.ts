import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { GovernanceError, ROOT, fail } from './governance-runtime.js';
import { checkProjection, readRegistryProjection, verifyEntry, verifyProductionOwnership, writeRegistry } from './governance-authority.js';
import type { Level, Registry } from './governance-contract.js';
import { diffPaths, gitCommit, gitWorktreeStatus, worktreeCandidateFingerprint } from './governance-git-state.js';
import { pathRole, REGISTRY } from './shared/governance-paths.js';
import { validateChangedGovernanceSources, validateCommittedProviderContractVersionChanges } from './governance-change-authority.js';
import { runFullQuality } from './shared/quality-runner.js';
import { relevantExamScripts } from './shared/quality-routes.js';
import { detectHighImpactChanges } from './shared/high-impact-detector.js';
import { assertQualityCommandPassed, collectQualityCheck, writeQualityIssues, type QualityCheckIssue } from './shared/quality-process-execution.js';

function assertAuthorization(changes: Array<{ status: string; path: string }>): void {
  if (changes.some((change) => change.path === 'docs/governance/法案系统建设说明书-冻结定稿版.md') && process.env.GRASSEYE_SOURCE_SPEC_AMENDMENT_AUTHORIZED !== '1') fail('SOURCE_SPEC_AMENDMENT_REQUIRED', 'mother spec');
  if (changes.some((change) => change.path === '.github/instructions/agent-rules/基础法案.md' || change.path === '.github/instructions/agent-rules/功能法案.md') && process.env.GRASSEYE_LAW_AMENDMENT_AUTHORIZED !== '1') fail('LAW_AMENDMENT_REQUIRED', 'active law');
}

const currentDomains = (source: string): string[] => [...source.matchAll(/^## capabilityDomain: ([a-z0-9]+(?:-[a-z0-9]+)*)$/gmu)].map((match) => match[1]!);
const baselineLaw = (path: string): string => {
  const result = spawnSync('git', ['show', `HEAD:${path}`], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout : '';
};
function assertDomainAdmission(changes: Array<{ status: string; path: string }>): void {
  if (!changes.some((change) => change.path === '.github/instructions/agent-rules/基础法案.md' || change.path === '.github/instructions/agent-rules/功能法案.md')) return;
  const prior = new Set([
    ...currentDomains(baselineLaw('.github/instructions/agent-rules/基础法案.md')),
    ...currentDomains(baselineLaw('.github/instructions/agent-rules/功能法案.md')),
  ]);
  const next = [...currentDomains(readFileSync('.github/instructions/agent-rules/基础法案.md', 'utf8')),
    ...currentDomains(readFileSync('.github/instructions/agent-rules/功能法案.md', 'utf8'))];
  const added = next.filter((domain) => !prior.has(domain));
  if (added.length && process.env.GRASSEYE_NEW_DOMAIN_AUTHORIZED !== '1') fail('LAW_AMENDMENT_REQUIRED', `new capabilityDomain ${added.join(',')}`);
}

export function addedSourceAt(root: string, change: { status: string; path: string }): string {
  const absolute = resolve(root, change.path);
  if (!absolute.startsWith(`${resolve(root)}/`)) fail('TARGET_OUTSIDE_DOMAIN_AUTHORITY', change.path);
  const baseline = spawnSync('git', ['cat-file', '-e', `HEAD:${change.path}`], { cwd: root, encoding: 'utf8' });
  if (change.status === 'A' && baseline.status !== 0) return readFileSync(absolute, 'utf8');
  return execFileSync('git', ['diff', '--unified=0', 'HEAD', '--', change.path], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++')).map((line) => line.slice(1)).join('\n');
}

function assertHighImpactAuthorization(changes: Array<{ status: string; path: string }>): void {
  const findings = detectHighImpactChanges(changes, (change) => addedSourceAt(ROOT, change));
  if (findings.length && process.env.GRASSEYE_HIGH_IMPACT_AUTHORIZED !== '1') {
    fail('USER_REQUEST_CONFLICTS_WITH_ACTIVE_LAW', `high-impact change requires explicit authorization:${JSON.stringify(findings)}`);
  }
}

const ownedPatternMatches = (pattern: string, path: string): boolean => pattern === path
  || (pattern.endsWith('/**') && (path === pattern.slice(0, -3) || path.startsWith(`${pattern.slice(0, -3)}/`)));

export function assertProductionDeleteAuthorization(
  changes: readonly { status: string; path: string }[],
  baselineRegistry: Registry,
  authorized: boolean,
): void {
  for (const change of changes) {
    if (change.status !== 'D' || pathRole(change.path) !== 'PRODUCTION') continue;
    const owners = baselineRegistry.domains.filter((domain) => domain.ownedPaths
      .some((pattern) => ownedPatternMatches(pattern, change.path)));
    if (owners.length > 1 || !authorized) fail('UNAUTHORIZED_PRODUCTION_DELETE', change.path);
  }
}

const baselineRegistryProjection = (): Registry => {
  const result = spawnSync('git', ['show', `HEAD:${REGISTRY}`], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) return fail('SOURCE_PARSE_FAILED', `${REGISTRY}:baseline`);
  try { return JSON.parse(result.stdout) as Registry; } catch { return fail('SOURCE_PARSE_FAILED', `${REGISTRY}:baseline`); }
};

function assertBaselineProductionDeleteAuthorization(changes: Array<{ status: string; path: string }>): void {
  if (!changes.some((change) => change.status === 'D' && pathRole(change.path) === 'PRODUCTION')) return;
  assertProductionDeleteAuthorization(changes, baselineRegistryProjection(),
    process.env.GRASSEYE_PRODUCTION_DELETE_AUTHORIZED === '1');
}

async function run(command: string, args: string[], assertCandidate: () => void, issues: QualityCheckIssue[]): Promise<void> {
  await collectQualityCheck(`${command} ${args.join(' ')}`, () => {
    const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: process.env });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    assertQualityCommandPassed({ status: result.status, signal: result.signal, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }, command);
  }, assertCandidate, issues);
}

function projectionCheck(): void {
  const beforeCommit = gitCommit();
  const before = worktreeCandidateFingerprint();
  checkProjection();
  assertProjectionStable(beforeCommit, before, gitCommit(), worktreeCandidateFingerprint());
}

export function assertProjectionStable(
  beforeCommit: string,
  beforeDenominator: string,
  afterCommit: string,
  afterDenominator: string,
): void {
  if (beforeCommit !== afterCommit || beforeDenominator !== afterDenominator) {
    fail('CANDIDATE_DRIFT', 'audit:projection:check');
  }
}

async function projectChecks(assertCandidate: () => void, issues: QualityCheckIssue[]): Promise<void> {
  await run('npm', ['run', 'typecheck'], assertCandidate, issues);
  const tests = await collectQualityCheck('governance test discovery', () => existsSync('tests/governance')
    ? readdirSync('tests/governance').filter((name) => name.endsWith('.test.ts')).sort().map((name) => `tests/governance/${name}`)
    : [], assertCandidate, issues);
  if (!tests?.length) issues.push({ label: 'governance tests', status: 'BLOCKED', message: 'LAW_EVIDENCE_MISSING: governance tests unavailable' });
  else await run(process.execPath, ['--import', 'tsx', '--test', ...tests], assertCandidate, issues);
}

async function relevantChangeChecks(changes: Array<{ status: string; path: string }>, registry: Registry,
  assertCandidate: () => void, issues: QualityCheckIssue[]): Promise<void> {
  await run('npm', ['run', 'typecheck'], assertCandidate, issues);
  const changedGovernanceTests = changes
    .filter((change) => change.status !== 'D' && /^tests\/governance\/[^/]+\.test\.ts$/u.test(change.path))
    .map((change) => change.path)
    .sort();
  if (changedGovernanceTests.length) await run(process.execPath, ['--import', 'tsx', '--test', ...changedGovernanceTests], assertCandidate, issues);
  for (const script of relevantExamScripts(changes.map((change) => change.path), registry)) {
    await run('npm', ['run', script], assertCandidate, issues);
  }
}

async function quality(level: Level): Promise<void> {
  if (!['CHANGE', 'READY', 'RELEASE'].includes(level)) fail('ENTRY_CONTRACT_MISMATCH', `invalid level ${level}`);
  verifyEntry();
  const initial = worktreeCandidateFingerprint();
  const assertCandidate = (): void => {
    if (initial !== worktreeCandidateFingerprint()) fail('CANDIDATE_DRIFT', level);
  };
  const issues: QualityCheckIssue[] = [];
  const changes = diffPaths();
  assertAuthorization(changes);
  assertDomainAdmission(changes);
  assertBaselineProductionDeleteAuthorization(changes);
  assertHighImpactAuthorization(changes);
  if (level === 'CHANGE') {
    if (!changes.length) fail('ENTRY_CONTRACT_MISMATCH', 'CHANGE requires an actual diff');
    validateChangedGovernanceSources(changes);
    await relevantChangeChecks(changes, readRegistryProjection(), assertCandidate, issues);
    assertCandidate();
    writeQualityIssues(issues);
    process.stdout.write(`CHANGE_${issues.length ? 'FAIL' : 'PASS'}\n`);
    if (issues.length) fail('CHECK_EXECUTION_FAILED', `${issues.length} CHANGE checks failed or blocked`);
    return;
  }
  if (gitWorktreeStatus().length) fail(level === 'READY' ? 'READY_GIT_COMMIT_REQUIRED' : 'RELEASE_GIT_COMMIT_REQUIRED', 'dirty worktree');
  validateCommittedProviderContractVersionChanges();
  const registry = checkProjection();
  verifyProductionOwnership(registry);
  assertCandidate();
  await projectChecks(assertCandidate, issues);
  assertCandidate();
  const result = await runFullQuality(level, registry, issues);
  if (result.outcome !== 'PASS') fail('LAW_FAILED', result.reportPath);
}

export async function main(): Promise<void> {
  const [command, argument] = process.argv.slice(2);
  if (command === 'build') return writeRegistry();
  if (command === 'projection') return projectionCheck();
  if (command === 'quality') return quality((argument ?? 'CHANGE') as Level);
  fail('ENTRY_CONTRACT_MISMATCH', 'unknown command');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    if (error instanceof GovernanceError) {
      process.stderr.write(`${error.code} ${error.message}\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  });
}
