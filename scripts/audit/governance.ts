import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { GovernanceError, ROOT, fail } from './governance-runtime.js';
import { buildRegistry, candidateSnapshot, checkProjection, diffPaths, verifyEntry, verifyProductionOwnership, writeRegistry, type Level } from './governance-authority.js';

const governanceSource = (path: string): boolean => path === 'AGENTS.md'
  || path === '.github/instructions/agent-rules/基础法案.md'
  || path === '.github/instructions/agent-rules/功能法案.md'
  || path === 'docs/governance/法案系统建设说明书-冻结定稿版.md'
  || path.startsWith('docs/blueprints/')
  || path.startsWith('docs/specs/')
  || path.startsWith('scripts/audit/')
  || path.startsWith('tests/governance/')
  || path === 'package.json';

function assertAuthorization(changes: Array<{ status: string; path: string }>): void {
  if (changes.some((change) => change.path === 'docs/governance/法案系统建设说明书-冻结定稿版.md') && process.env.GRASSEYE_SOURCE_SPEC_AMENDMENT_AUTHORIZED !== '1') fail('SOURCE_SPEC_AMENDMENT_REQUIRED', 'mother spec');
  if (changes.some((change) => change.path === '.github/instructions/agent-rules/基础法案.md' || change.path === '.github/instructions/agent-rules/功能法案.md') && process.env.GRASSEYE_LAW_AMENDMENT_AUTHORIZED !== '1') fail('LAW_AMENDMENT_REQUIRED', 'active law');
}

function run(command: string, args: string[]): void {
  const before = candidateSnapshot();
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: process.env });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (before !== candidateSnapshot()) fail('CANDIDATE_DRIFT', `${command} ${args.join(' ')}`);
  if (result.status !== 0) fail('PROJECT_CHECK_FAILED', `${command} ${args.join(' ')}`);
}

function projectChecks(): void {
  run('npm', ['run', 'typecheck']);
  const tests = readdirSync('tests/governance').filter((name) => name.endsWith('.test.ts')).sort().map((name) => `tests/governance/${name}`);
  if (!tests.length) fail('PROJECT_CHECK_MISSING', 'governance tests');
  run(process.execPath, ['--import', 'tsx', '--test', ...tests]);
  run('npm', ['run', 'acceptance:architecture-active-plugin-mediators']);
  run('npm', ['run', 'acceptance:code-purity-zombie-deep']);
}

function quality(level: Level): void {
  if (!['CHANGE', 'READY', 'RELEASE'].includes(level)) fail('ENTRY_CONTRACT_MISMATCH', `invalid level ${level}`);
  verifyEntry();
  const initial = candidateSnapshot();
  const changes = diffPaths();
  assertAuthorization(changes);
  if (level === 'CHANGE') {
    if (!changes.length) fail('ENTRY_CONTRACT_MISMATCH', 'CHANGE requires an actual diff');
    if (changes.some((change) => governanceSource(change.path))) {
      buildRegistry();
      checkProjection();
      projectChecks();
    } else run('npm', ['run', 'typecheck']);
    if (initial !== candidateSnapshot()) fail('CANDIDATE_DRIFT', 'CHANGE candidate changed');
    process.stdout.write('CHANGE_PASS\n');
    return;
  }
  if (changes.length) fail(level === 'READY' ? 'READY_GIT_COMMIT_REQUIRED' : 'RELEASE_GIT_COMMIT_REQUIRED', 'dirty worktree');
  checkProjection();
  verifyProductionOwnership();
  projectChecks();
  if (initial !== candidateSnapshot()) fail('CANDIDATE_DRIFT', level);
  fail('CHECK_EXECUTION_FAILED', `${level} static/exam/dynamic runners require a separately verified migration before a law report can be written`);
}

export async function main(): Promise<void> {
  const [command, argument] = process.argv.slice(2);
  if (command === 'build') return writeRegistry();
  if (command === 'projection') return checkProjection();
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
