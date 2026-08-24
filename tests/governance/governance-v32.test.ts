import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

import { evidencePlan, validateDynamicProofArtifact, validateQualityReport, validateReleaseProofPackage } from '../../scripts/audit/governance-v32.js';

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
const governanceFixture = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'governance-v32-'));
  symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'dir');
  for (const source of [
    '.gitignore', 'AGENTS.md', 'package.json', 'tsconfig.json',
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

const initializeGitFixture = (root: string): string => {
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'governance@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Governance Fixture'], { cwd: root });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: root });
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim();
};

const writeChangeRecord = (root: string, baseSha: string, allowedWritePaths: string[], allowedDeletePaths: string[]) => {
  const changePath = join(root, '.governance/runtime/change.json');
  mkdirSync(dirname(changePath), { recursive: true });
  writeFileSync(changePath, `${JSON.stringify({ baseSha, allowedWritePaths, allowedDeletePaths }, null, 2)}\n`);
};

const expectGovernanceFailure = (root: string, args: string[], code: string, env: NodeJS.ProcessEnv = process.env): void => {
  assert.throws(
    () => execFileSync(process.execPath, ['--import', 'tsx', 'scripts/audit/governance-v32.ts', ...args], { cwd: root, stdio: 'pipe', env }),
    (error: unknown) => String((error as { stderr?: Buffer }).stderr).includes(code),
  );
};

test('V3.2 exposes only the five public governance commands', () => {
  const scripts = readJson('package.json').scripts as Record<string, string>;
  const names = Object.keys(scripts).filter((name) => name.startsWith('governance:') || ['audit:build','audit:projection:check','quality:check'].includes(name));
  assert.deepEqual(names.sort(), ['audit:build','audit:projection:check','governance:entry','governance:scope:check','quality:check'].sort());
  assert.equal(scripts['ci:full'], 'GRASSEYE_QUALITY_REPORT_MODE=external npm run quality:check -- READY');
});

test('V3.2 READ_ONLY entry is read-only and accepts the frozen authority', () => {
  const before = execFileSync('git', ['status','--porcelain=v1','-z']).toString('hex');
  execFileSync(process.execPath, ['--import','tsx','scripts/audit/governance-v32.ts','entry','READ_ONLY'], {
    stdio: 'pipe',
  });
  const after = execFileSync('git', ['status','--porcelain=v1','-z']).toString('hex');
  assert.equal(after, before);
});

test('CHANGE entry rejects a dirty target even when an environment variable claims authorization', () => {
  const root = governanceFixture();
  try {
    const baseSha = initializeGitFixture(root);
    writeChangeRecord(root, baseSha, ['package.json'], []);
    const packagePath = join(root, 'package.json');
    writeFileSync(packagePath, `${readFileSync(packagePath, 'utf8')}\n`);
    assert.throws(
      () => execFileSync(process.execPath, ['--import','tsx','scripts/audit/governance-v32.ts','entry','CHANGE'], { cwd: root, stdio: 'pipe', env: { ...process.env, GRASSEYE_DIRTY_TARGET_AUTHORIZED: '1' } }),
      (error: unknown) => String((error as { stderr?: Buffer }).stderr).includes('DIRTY_TARGET_NOT_AUTHORIZED'),
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
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

test('entry rejects a wrapped full-CI command and a second verdict command', async (t) => {
  await t.test('wrapped full-CI command', () => {
    const root = governanceFixture();
    try {
      const pkg = readJson(join(root, 'package.json'));
      (pkg.scripts as Record<string, string>)['ci:full'] = 'npm run quality:check -- READY && echo PASS';
      writeFileSync(join(root, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
      expectGovernanceFailure(root, ['entry', 'READ_ONLY'], 'ENTRY_CONTRACT_MISMATCH');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  await t.test('second verdict command', () => {
    const root = governanceFixture();
    try {
      const pkg = readJson(join(root, 'package.json'));
      (pkg.scripts as Record<string, string>)['quality:legacy'] = 'echo PASS';
      writeFileSync(join(root, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
      expectGovernanceFailure(root, ['entry', 'READ_ONLY'], 'ENTRY_CONTRACT_MISMATCH');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

test('projection rejects a second generated artifact', () => {
  const root = governanceFixture();
  try {
    initializeGitFixture(root);
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

test('law parser rejects BOM, invalid UTF-8, second metadata, orphan fences, bad globs and dependency cycles', async (t) => {
  const cases: Array<[string, (root: string) => void]> = [
    ['BOM', (root) => {
      const file = join(root, '.github/instructions/agent-rules/功能法案.md');
      writeFileSync(file, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), readFileSync(file)]));
    }],
    ['invalid UTF-8', (root) => {
      const file = join(root, '.github/instructions/agent-rules/功能法案.md');
      writeFileSync(file, Buffer.concat([readFileSync(file), Buffer.from([0xc3, 0x28])]));
    }],
    ['second metadata', (root) => {
      const file = join(root, '.github/instructions/agent-rules/功能法案.md');
      writeFileSync(file, `${readFileSync(file, 'utf8')}\n---\n`);
    }],
    ['orphan fence', (root) => {
      const file = join(root, '.github/instructions/agent-rules/功能法案.md');
      writeFileSync(file, `${readFileSync(file, 'utf8')}\n\`\`\`\n`);
    }],
    ['bad glob', (root) => {
      const file = join(root, '.github/instructions/agent-rules/基础法案.md');
      writeFileSync(file, readFileSync(file, 'utf8').replace('"**/*"', '"../**"'));
    }],
    ['dependency cycle', (root) => {
      const file = join(root, '.github/instructions/agent-rules/基础法案.md');
      let source = readFileSync(file, 'utf8');
      source = source.replace('"dependsOnLawIds": []', '"dependsOnLawIds": ["LAW-PROJECT-GOVERNANCE-002-V1"]');
      const second = source.indexOf('"dependsOnLawIds": []');
      source = `${source.slice(0, second)}"dependsOnLawIds": ["LAW-PROJECT-GOVERNANCE-001-V1"]${source.slice(second + '"dependsOnLawIds": []'.length)}`;
      writeFileSync(file, source);
    }],
  ];
  for (const [name, mutate] of cases) await t.test(name, () => {
    const root = governanceFixture();
    try { mutate(root); expectGovernanceFailure(root, ['build'], 'SOURCE_PARSE_FAILED'); }
    finally { rmSync(root, { recursive: true, force: true }); }
  });
});

test('law parser rejects duplicate JSON keys, domain mismatches, and non-canonical patterns', async (t) => {
  const cases: Array<[string, (root: string) => void]> = [
    ['duplicate law key', (root) => {
      const file = join(root, '.github/instructions/agent-rules/功能法案.md');
      writeFileSync(file, readFileSync(file, 'utf8').replace('"lawId": "LAW-AI-INPUT-GATEWAY-001-V1",', '"lawId": "LAW-AI-INPUT-GATEWAY-001-V1",\n  "lawId": "LAW-AI-INPUT-GATEWAY-001-V1",'));
    }],
    ['domain mismatch', (root) => {
      const file = join(root, '.github/instructions/agent-rules/功能法案.md');
      writeFileSync(file, readFileSync(file, 'utf8').replace('"capabilityDomain": "ai-input-gateway"', '"capabilityDomain": "local-app-shell"'));
    }],
    ['non-canonical pattern', (root) => {
      const file = join(root, '.github/instructions/agent-rules/功能法案.md');
      writeFileSync(file, readFileSync(file, 'utf8').replace('"src/capabilities/ai-input-gateway/**"', '"src/**/ai-input-gateway/**"'));
    }],
  ];
  for (const [name, mutate] of cases) await t.test(name, () => {
    const root = governanceFixture();
    try { mutate(root); expectGovernanceFailure(root, ['build'], 'SOURCE_PARSE_FAILED'); }
    finally { rmSync(root, { recursive: true, force: true }); }
  });
});

test('blueprint and contract pin mutants fail exact schema validation', async (t) => {
  await t.test('dependency edge lawId cannot replace contractRef', () => {
    const root = governanceFixture();
    try {
      const file = join(root, 'docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md');
      writeFileSync(file, readFileSync(file, 'utf8').replace('"contractRef": null', '"lawId": "LAW-APP-SHELL-UI-001-V2"'));
      expectGovernanceFailure(root, ['build'], 'SOURCE_PARSE_FAILED');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  await t.test('pin inner version must equal outer positive integer', () => {
    const root = governanceFixture();
    try {
      const file = join(root, 'docs/specs/xuanxue-ai-production/xuanxue-ai-production-v6.pin.spec.json');
      const pin = readJson(file);
      (pin.contract as Record<string, unknown>).version = 5;
      writeFileSync(file, `${JSON.stringify(pin, null, 2)}\n`);
      expectGovernanceFailure(root, ['build'], 'SOURCE_PARSE_FAILED');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  await t.test('duplicate contract key fails closed', () => {
    const root = governanceFixture();
    try {
      const spec = join(root, 'docs/specs/xuanxue-ai-production/xuanxue-ai-production-v6.pin.spec.json');
      writeFileSync(spec, readFileSync(spec, 'utf8').replace('"version": 6,', '"version": 6,\n  "version": 6,'));
      expectGovernanceFailure(root, ['build'], 'SOURCE_PARSE_FAILED');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  await t.test('blueprint Owner mismatch fails closed', () => {
    const root = governanceFixture();
    try {
      const blueprint = join(root, 'docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md');
      writeFileSync(blueprint, readFileSync(blueprint, 'utf8').replace('"owner": "xuanxue-ai-production"', '"owner": "local-app-shell"'));
      expectGovernanceFailure(root, ['build'], 'SOURCE_PARSE_FAILED');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

test('provider descriptor verification rejects a forged provider remote identity', () => {
  const root = governanceFixture();
  const providerRoot = resolve(root, '..', 'xuanxue-web');
  try {
    execFileSync('git', ['clone', '--no-checkout', resolve('..', 'xuanxue-web'), providerRoot], { stdio: 'pipe' });
    execFileSync('git', ['config', 'remote.origin.url', 'git@github.com:ADVISION-X/forged-provider.git'], { cwd: providerRoot });
    const baseSha = initializeGitFixture(root);
    writeChangeRecord(root, baseSha, [], []);
    expectGovernanceFailure(root, ['scope'], 'CROSS_REPO_PROVIDER_DESCRIPTOR_UNVERIFIED');
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(providerRoot, { recursive: true, force: true });
  }
});

test('active consumers cannot retain a retired law reference', () => {
  const root = governanceFixture();
  try {
    initializeGitFixture(root);
    const blueprint = join(root, 'docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md');
    writeFileSync(blueprint, `${readFileSync(blueprint, 'utf8')}\nretired: LAW-LOCAL-BROWSER-SESSION-003-V5\n`);
    expectGovernanceFailure(root, ['build'], 'RETIRED_LAW_REFERENCE');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('scope treats rename as DELETE plus PRESENT and rejects missing delete authority', () => {
  const root = governanceFixture();
  try {
    const oldPath = join(root, 'src/plugins/xuanxue-ai-production/old.ts');
    mkdirSync(dirname(oldPath), { recursive: true });
    writeFileSync(oldPath, 'export const old = true;\n');
    const baseSha = initializeGitFixture(root);
    writeChangeRecord(root, baseSha, ['src/plugins/xuanxue-ai-production/new.ts'], []);
    renameSync(oldPath, join(dirname(oldPath), 'new.ts'));
    expectGovernanceFailure(root, ['scope'], 'SCOPE_DIFF_OUTSIDE_ALLOWED_PATHS');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('scope rejects a newly added production file without a primary Owner', () => {
  const root = governanceFixture();
  try {
    const baseSha = initializeGitFixture(root);
    writeChangeRecord(root, baseSha, ['src/unowned.ts'], []);
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/unowned.ts'), 'export const unowned = true;\n');
    expectGovernanceFailure(root, ['scope'], 'UNOWNED_PRODUCTION_FILE');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('quality fails closed when a project check mutates the candidate', () => {
  const root = governanceFixture();
  try {
    const pkg = readJson(join(root, 'package.json'));
    (pkg.scripts as Record<string, string>)['audit:integrity:test'] = "node -e \"require('node:fs').appendFileSync('package.json',' ')\"";
    writeFileSync(join(root, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
    const baseSha = initializeGitFixture(root);
    writeChangeRecord(root, baseSha, [], []);
    expectGovernanceFailure(root, ['quality', 'CHANGE'], 'CANDIDATE_DRIFT');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('projection fails closed when the candidate drifts during construction', () => {
  const root = governanceFixture();
  try {
    initializeGitFixture(root);
    const bin = join(root, 'governance-test-bin');
    mkdirSync(bin);
    const realGit = execFileSync('which', ['git']).toString().trim();
    writeFileSync(join(bin, 'git'), `#!/bin/sh\ncount_file=.git/governance-git-count\ncount=0\n[ -f \"$count_file\" ] && count=$(cat \"$count_file\")\ncount=$((count + 1))\nprintf '%s' \"$count\" > \"$count_file\"\n[ \"$count\" -eq 4 ] && printf '\\n# projection drift\\n' >> .gitignore\nexec \"${realGit}\" \"$@\"\n`, { mode: 0o755 });
    expectGovernanceFailure(root, ['projection'], 'CANDIDATE_DRIFT', { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('quality report schema covers every active law and rejects fake outcomes', () => {
  const laws = (readJson('scripts/audit/generated/law-registry.generated.json').laws as Array<{ lawId: string }>);
  const items = laws.map((law) => ({
    lawId: law.lawId, applicableEvidenceModes: [], deferredEvidenceModes: [], outcome: 'PASS', evidenceRefs: [`/tmp/${law.lawId}.receipt.json#sha256=${'c'.repeat(64)}`], findings: [],
  }));
  const report = {
    schemaVersion: 1, level: 'READY', baseSha: 'a'.repeat(40), candidateId: null,
    registrySha256: 'b'.repeat(64), laws: items, outcome: 'PASS',
  };
  assert.doesNotThrow(() => validateQualityReport(report, laws, 'READY'));
  assert.throws(() => validateQualityReport({ ...report, schemaVersion: 2 }, laws, 'READY'), /top-level/u);
  assert.throws(() => validateQualityReport({ ...report, laws: items.slice(1) }, laws, 'READY'), /law denominator/u);
  const emptyEvidence = structuredClone(report);
  emptyEvidence.laws[0]!.applicableEvidenceModes = ['static.ast'];
  emptyEvidence.laws[0]!.evidenceRefs = [];
  assert.throws(() => validateQualityReport(emptyEvidence, laws, 'READY'), /law /u);
  const fake = structuredClone(report);
  fake.laws[0]!.outcome = 'NOT_APPLICABLE';
  assert.throws(() => validateQualityReport(fake, laws, 'READY'), /law /u);
});

test('READY evidence applicability follows the actual diff and rejects a missing applicable receipt', () => {
  const law = {
    appliesTo: ['src/owned/**'], excludes: ['src/owned/ignored.ts'], contractRefs: [{ path: 'docs/specs/owned.contract.spec.json', sha256: 'a'.repeat(64) }],
    evidenceModes: ['static.ast', 'exam.golden', 'dynamic.provider'],
  };
  assert.deepEqual(evidencePlan(law, ['src/other.ts'], 'READY'), { applicableEvidenceModes: [], deferredEvidenceModes: [] });
  assert.deepEqual(evidencePlan(law, ['src/owned/live.ts'], 'READY'), { applicableEvidenceModes: ['static.ast', 'exam.golden'], deferredEvidenceModes: ['dynamic.provider'] });
  assert.deepEqual(evidencePlan(law, ['docs/specs/owned.contract.spec.json'], 'RELEASE'), { applicableEvidenceModes: ['static.ast', 'exam.golden', 'dynamic.provider'], deferredEvidenceModes: [] });
  const laws = [{ lawId: 'LAW-OWNED-001-V1' }];
  const inactive = { schemaVersion: 1, level: 'READY', baseSha: 'a'.repeat(40), candidateId: null, registrySha256: 'b'.repeat(64), laws: [{ lawId: laws[0]!.lawId, applicableEvidenceModes: [], deferredEvidenceModes: [], outcome: 'PASS', evidenceRefs: [], findings: [] }], outcome: 'PASS' };
  assert.doesNotThrow(() => validateQualityReport(inactive, laws, 'READY'));
  const mutant = structuredClone(inactive);
  mutant.laws[0]!.applicableEvidenceModes = ['static.ast'];
  assert.throws(() => validateQualityReport(mutant, laws, 'READY'), /law /u);
});

test('RELEASE verifier binds fresh Dynamic Proof and the unique B.9 package schema', () => {
  const now = Date.parse('2026-08-24T00:00:00.000Z');
  const binding = { candidateId: 'a'.repeat(64), gitCommit: 'b'.repeat(40) };
  const proof = {
    schemaVersion: 1, ...binding,
    lawIds: ['LAW-TEST-001-V1'], evidenceModes: ['dynamic.browser'], outcome: 'PASS',
    recordedAt: '2026-08-23T23:59:00.000Z', expiresAt: '2026-08-24T00:01:00.000Z',
    locators: ['browser-session:current'],
  };
  assert.doesNotThrow(() => validateDynamicProofArtifact(proof, binding, now));
  assert.throws(() => validateDynamicProofArtifact({ ...proof, expiresAt: '2026-08-23T23:59:30.000Z' }, binding, now), /stale Dynamic Proof/u);
  assert.throws(() => validateDynamicProofArtifact({ ...proof, candidateId: 'c'.repeat(64) }, binding, now), /invalid Dynamic Proof/u);
  const proofPackage = {
    schemaVersion: 1, ...binding,
    freezeSha256: 'c'.repeat(64), baseLawSha256: 'd'.repeat(64),
    functionalLawSha256: 'e'.repeat(64), registrySha256: 'f'.repeat(64),
    lawQualityReportSha256: '1'.repeat(64), dynamicProofHashes: ['2'.repeat(64)],
    crossRepoParticipants: [],
  };
  assert.doesNotThrow(() => validateReleaseProofPackage(proofPackage));
  assert.throws(() => validateReleaseProofPackage({ ...proofPackage, releaseReceipt: true }), /invalid RELEASE proof package/u);
  const source = readFileSync('scripts/audit/governance-v32.ts', 'utf8');
  assert.doesNotMatch(source, /trusted dynamic proof verifier is not implemented/u);
  assert.match(source, /RELEASE_PACKAGE/u);
});
