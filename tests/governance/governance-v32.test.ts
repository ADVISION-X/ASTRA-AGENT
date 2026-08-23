import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
const governanceFixture = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'governance-v32-'));
  symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'dir');
  for (const source of [
    'AGENTS.md', 'package.json',
    '.github/instructions/agent-rules/基础法案.md', '.github/instructions/agent-rules/功能法案.md',
    'docs/governance', 'docs/blueprints', 'docs/specs',
    'scripts/audit/domains', 'scripts/audit/generated', 'scripts/audit/governance-v32.ts',
  ]) {
    const target = join(root, source);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true });
  }
  return root;
};

test('V3.2 exposes only the five public governance commands', () => {
  const scripts = readJson('package.json').scripts as Record<string, string>;
  const names = Object.keys(scripts).filter((name) => name.startsWith('governance:') || ['audit:build','audit:projection:check','quality:check'].includes(name));
  assert.deepEqual(names.sort(), ['audit:build','audit:projection:check','governance:entry','governance:scope:check','quality:check'].sort());
  assert.match(scripts['ci:full']!, /quality:check/);
});

test('V3.2 entry is read-only and accepts the frozen authority', () => {
  const before = execFileSync('git', ['status','--porcelain=v1','-z']).toString('hex');
  execFileSync(process.execPath, ['--import','tsx','scripts/audit/governance-v32.ts','entry','CHANGE'], { stdio: 'pipe' });
  const after = execFileSync('git', ['status','--porcelain=v1','-z']).toString('hex');
  assert.equal(after, before);
});

test('active corpus is exactly two files and base law has eight roots', () => {
  const base = readFileSync('.github/instructions/agent-rules/基础法案.md','utf8');
  const functional = readFileSync('.github/instructions/agent-rules/功能法案.md','utf8');
  assert.equal((base.match(/^```law-record$/gm) ?? []).length, 8);
  assert.ok((functional.match(/^```law-record$/gm) ?? []).length > 0);
  assert.deepEqual(readdirSync('.github/instructions/agent-rules').filter((name) => name.endsWith('.md')).sort(), ['功能法案.md','基础法案.md']);
});

test('generated directory contains only the registry projection', () => {
  assert.deepEqual(readdirSync('scripts/audit/generated').filter((name) => !name.startsWith('.')).sort(), ['law-registry.generated.json']);
  assert.equal(readJson('scripts/audit/generated/law-registry.generated.json').schemaVersion, 3);
});

test('entry fails closed when AGENTS drifts', () => {
  const root = governanceFixture();
  try {
    writeFileSync(join(root, 'AGENTS.md'), '# drift\n');
    assert.throws(
      () => execFileSync(process.execPath, ['--import','tsx','scripts/audit/governance-v32.ts','entry','READ_ONLY'], { cwd: root, stdio: 'pipe' }),
      (error: unknown) => String((error as { stderr?: Buffer }).stderr).includes('ENTRY_CONTRACT_MISMATCH'),
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('projection rejects a second generated artifact', () => {
  const root = governanceFixture();
  try {
    writeFileSync(join(root, 'scripts/audit/generated/second.generated.json'), '{}\n');
    assert.throws(
      () => execFileSync(process.execPath, ['--import','tsx','scripts/audit/governance-v32.ts','projection'], { cwd: root, stdio: 'pipe' }),
      (error: unknown) => String((error as { stderr?: Buffer }).stderr).includes('GENERATED_FILESET_INVALID'),
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('law parser rejects an invalid supersedes relationship', () => {
  const root = governanceFixture();
  try {
    const lawPath = join(root, '.github/instructions/agent-rules/功能法案.md');
    const source = readFileSync(lawPath, 'utf8');
    writeFileSync(lawPath, source.replace('"supersedesLawId": null', '"supersedesLawId": "LAW-AI-INPUT-GATEWAY-001-V0"'));
    assert.throws(
      () => execFileSync(process.execPath, ['--import','tsx','scripts/audit/governance-v32.ts','build'], { cwd: root, stdio: 'pipe' }),
      (error: unknown) => String((error as { stderr?: Buffer }).stderr).includes('SOURCE_PARSE_FAILED LAW-AI-INPUT-GATEWAY-001-V1 supersedes'),
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('quality report is evidence-derived and cannot stamp every law PASS', () => {
  const source = readFileSync('scripts/audit/governance-v32.ts', 'utf8');
  assert.match(source, /REQUIRED_EVIDENCE_MODE_UNPROVEN/u);
  assert.match(source, /PROJECT_CHECK_MISSING/u);
  assert.match(source, /outcome:'NOT_APPLICABLE'/u);
  assert.match(source, /outcome:findings\.length\?'FAIL':'PASS'/u);
  assert.match(source, /QUALITY_FINDINGS_PRESENT/u);
  assert.doesNotMatch(source, /outcome:'PASS',evidenceRefs,findings:\[\]/u);
});
