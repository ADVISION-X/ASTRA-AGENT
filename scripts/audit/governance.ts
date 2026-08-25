import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { GovernanceError, ROOT, fail } from './governance-runtime.js';
import { checkProjection, diffPaths, gitCommit, REGISTRY, verifyChangeOwnership, verifyEntry, verifyProductionOwnership, writeRegistry, type Level, type Registry } from './governance-authority.js';
import { runFullQuality } from './shared/quality-runner.js';
import { relevantExamScripts } from './shared/quality-routes.js';

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
  return execFileSync('git', ['diff', '--unified=0', 'HEAD', '--', change.path], { cwd: root, encoding: 'utf8' })
    .split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++')).map((line) => line.slice(1)).join('\n');
}

function assertHighImpactAuthorization(changes: Array<{ status: string; path: string }>): void {
  const productChanges = changes.filter((change) => change.path.startsWith('src/') || change.path === 'package.json'
    || (change.status === 'A' && change.path.startsWith('docs/specs/')));
  if (!productChanges.length) return;
  const highImpact = productChanges.flatMap((change) => addedSourceAt(ROOT, change).split('\n')).some((line) =>
    /(?:process\.env|\.listen\(|"dependencies"|"devDependencies"|specKind.*cross-repo|CREATE\s+(?:TABLE|TYPE)|router\.|addEventListener\()/u.test(line));
  if (highImpact && process.env.GRASSEYE_HIGH_IMPACT_AUTHORIZED !== '1') fail('USER_REQUEST_CONFLICTS_WITH_ACTIVE_LAW', 'high-impact change requires explicit authorization');
}

const changeDenominator = (): string => JSON.stringify(diffPaths().map((change) => [
  change.status,
  change.path,
  change.status === 'D' ? null : readFileSync(resolve(ROOT, change.path)).toString('base64'),
]));

function run(command: string, args: string[]): void {
  const before = changeDenominator();
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: process.env });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (before !== changeDenominator()) fail('CANDIDATE_DRIFT', `${command} ${args.join(' ')}`);
  if (result.status !== 0) fail('CHECK_EXECUTION_FAILED', `${command} ${args.join(' ')}`);
}

function projectionCheck(): void {
  const before = changeDenominator();
  checkProjection();
  if (before !== changeDenominator()) fail('CANDIDATE_DRIFT', 'audit:projection:check');
}

function projectChecks(): void {
  run('npm', ['run', 'typecheck']);
  const tests = readdirSync('tests/governance').filter((name) => name.endsWith('.test.ts')).sort().map((name) => `tests/governance/${name}`);
  if (!tests.length) fail('LAW_EVIDENCE_MISSING', 'governance tests');
  run(process.execPath, ['--import', 'tsx', '--test', ...tests]);
  run('npm', ['run', 'acceptance:architecture-active-plugin-mediators']);
  run('npm', ['run', 'acceptance:code-purity-zombie-deep']);
}

const projectedRegistry = (): Registry => JSON.parse(readFileSync(REGISTRY, 'utf8')) as Registry;

function relevantChangeChecks(changes: Array<{ status: string; path: string }>, registry: Registry): void {
  run('npm', ['run', 'typecheck']);
  for (const script of relevantExamScripts(changes.map((change) => change.path), registry)) run('npm', ['run', script]);
}

async function quality(level: Level): Promise<void> {
  if (!['CHANGE', 'READY', 'RELEASE'].includes(level)) fail('ENTRY_CONTRACT_MISMATCH', `invalid level ${level}`);
  verifyEntry();
  const initial = level === 'CHANGE' ? changeDenominator() : gitCommit();
  const changes = diffPaths();
  assertAuthorization(changes);
  assertDomainAdmission(changes);
  assertHighImpactAuthorization(changes);
  if (level === 'CHANGE') {
    if (!changes.length) fail('ENTRY_CONTRACT_MISMATCH', 'CHANGE requires an actual diff');
    const registry = projectedRegistry();
    verifyChangeOwnership(changes, registry);
    relevantChangeChecks(changes, registry);
    if (initial !== changeDenominator()) fail('CANDIDATE_DRIFT', 'CHANGE candidate changed');
    process.stdout.write('CHANGE_PASS\n');
    return;
  }
  if (changes.length) fail(level === 'READY' ? 'READY_GIT_COMMIT_REQUIRED' : 'RELEASE_GIT_COMMIT_REQUIRED', 'dirty worktree');
  checkProjection();
  verifyProductionOwnership();
  projectChecks();
  if (initial !== gitCommit() || diffPaths().length) fail('CANDIDATE_DRIFT', level);
  const result = await runFullQuality(level);
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
