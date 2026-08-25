import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { assertRoleConsumptionEdges, buildRegistry, checkProjection, loadLaws, pathRole, verifyEntry, verifyProductionOwnership } from '../../scripts/audit/governance-authority.js';
import { GovernanceError } from '../../scripts/audit/governance-runtime.js';

const retiredDomains = ['audit-system', 'audit-truth', 'domain-registry', 'exam-system', 'law-system', 'project-governance'];

test('V3.3 entry has one public command surface and no freeze sidecar', () => {
  verifyEntry();
  assert.equal(existsSync('docs/governance/GOVERNANCE-FREEZE.json'), false);
  const scripts = (JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }).scripts;
  const publicGovernance = Object.keys(scripts).filter((name) => name === 'quality:check' || name.startsWith('audit:') || name.startsWith('governance:') || name === 'ci:full' || name.startsWith('exam:')).sort();
  assert.deepEqual(publicGovernance, ['audit:build', 'audit:projection:check', 'quality:check']);
});

test('active corpus and manifests exclude retired meta-law owners', () => {
  const laws = loadLaws();
  assert.ok(laws.length > 0);
  assert.deepEqual([...new Set(laws.map((law) => law.capabilityDomain))].filter((domain) => retiredDomains.includes(domain)), []);
  assert.equal(laws.some((law) => law.dependsOnLawIds.some((dependency) => retiredDomains.some((domain) => dependency.startsWith(`LAW-${domain.toUpperCase()}-`)))), false);
  for (const domain of retiredDomains) assert.equal(existsSync(`scripts/audit/domains/${domain}`), false);
  for (const manifestPath of readdirSync('scripts/audit/domains').map((domain) => `scripts/audit/domains/${domain}/manifest.json`).filter(existsSync)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    assert.equal(manifest.schemaVersion, 5);
    assert.equal('lawBindings' in manifest, false);
  }
});

test('registry is schema 5 projection without hashes, bindings, or verdicts', () => {
  const registry = buildRegistry();
  const laws = loadLaws();
  const activeDomains = [...new Set(laws.map((law) => law.capabilityDomain))].sort();
  assert.equal(registry.schemaVersion, 5);
  assert.deepEqual(Object.keys(registry.sourceSpec), ['path']);
  assert.deepEqual(registry.laws.map((law) => law.lawId), laws.map((law) => law.lawId));
  assert.deepEqual(registry.domains.map((domain) => domain.capabilityDomain), activeDomains);
  for (const law of registry.laws) {
    assert.equal('enforcement' in law, false);
    assert.equal('sectionSha256' in law.source, false);
    assert.equal(law.contractRefs.some((reference) => reference.includes('#')), false);
  }
  checkProjection();
  verifyProductionOwnership(registry);
});

test('candidate roles preserve the exact mother-spec vocabulary and keep the PDF non-authoritative', () => {
  const roles = new Set([
    pathRole('AGENTS.md'),
    pathRole('scripts/audit/generated/law-registry.generated.json'),
    pathRole('scripts/audit/reports/law-quality.report.json'),
    pathRole('tests/governance/fixture.ts'),
    pathRole('docs/history/fixture.md'),
    pathRole('src/app/server.ts'),
  ]);
  assert.deepEqual([...roles].sort(), [
    'GENERATED_REGISTRY', 'GOVERNANCE_AUTHORITY', 'HISTORY_ONLY', 'PRODUCTION', 'QUALITY_REPORT', 'TEST_ONLY',
  ].sort());
  assert.equal(pathRole('docs/governance/法案系统建设说明书-冻结定稿版.pdf'), 'PRODUCTION');
  assert.equal(pathRole('scripts/acceptance/app-shell-ui.acceptance.ts'), 'PRODUCTION');
  assert.equal(pathRole('src/capabilities/example/acceptance/runtime.acceptance.ts'), 'PRODUCTION');
  assert.equal(pathRole('scripts/acceptance/fixtures/input.json'), 'TEST_ONLY');
});

test('production consumption of a TEST_ONLY module requires role escalation', () => {
  assert.throws(
    () => assertRoleConsumptionEdges([{ consumer: 'src/app/server.ts', consumed: 'tests/fixture.ts' }]),
    (error: unknown) => error instanceof GovernanceError && error.code === 'ROLE_ESCALATION_REQUIRED',
  );
  assert.doesNotThrow(() => assertRoleConsumptionEdges([
    { consumer: 'scripts/acceptance/app-shell-ui.acceptance.ts', consumed: 'src/app/server.ts' },
  ]));
});

test('quality CHANGE rejects malformed touched law, Manifest, blueprint, and spec authority', () => {
  const mutations: Array<{ path: string; mutate: (source: string) => string }> = [
    { path: '.github/instructions/agent-rules/功能法案.md', mutate: (source) => `${source}\n---\n` },
    { path: 'scripts/audit/domains/code-purity/manifest.json', mutate: (source) => {
      const value = JSON.parse(source) as Record<string, unknown>;
      return `${JSON.stringify({ ...value, unexpected: true }, null, 2)}\n`;
    } },
    { path: 'docs/blueprints/local-browser-session/LOCAL-BROWSER-SESSION-V6-OWNER-JOURNAL-BLUEPRINT.md',
      mutate: (source) => source.replace('  "schemaVersion": 1,', '  "schemaVersion": 1,\n  "unexpected": true,') },
    { path: 'docs/specs/xuanxue-ai-production/product-execution-contract.dependency.spec.json', mutate: (source) => {
      const value = JSON.parse(source) as Record<string, unknown>;
      return `${JSON.stringify({ ...value, unexpected: true }, null, 2)}\n`;
    } },
  ];
  for (const mutation of mutations) {
    const temporary = mkdtempSync(resolve(tmpdir(), 'governance-change-authority-'));
    const repository = resolve(temporary, 'repo');
    try {
      execFileSync('git', ['clone', '-q', '--local', '--no-hardlinks', process.cwd(), repository]);
      writeFileSync(resolve(repository, '.git/info/exclude'), 'node_modules\n');
      symlinkSync(resolve(process.cwd(), 'node_modules'), resolve(repository, 'node_modules'), 'dir');
      const target = resolve(repository, mutation.path);
      writeFileSync(target, mutation.mutate(readFileSync(target, 'utf8')));
      const execution = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/audit/governance.ts', 'quality', 'CHANGE'], {
        cwd: repository,
        encoding: 'utf8',
        env: { ...process.env, GRASSEYE_LAW_AMENDMENT_AUTHORIZED: '1', GRASSEYE_HIGH_IMPACT_AUTHORIZED: '1' },
      });
      assert.notEqual(execution.status, 0, mutation.path);
      assert.match(`${execution.stdout}${execution.stderr}`, /SOURCE_PARSE_FAILED/u, mutation.path);
    } finally {
      rmSync(temporary, { force: true, recursive: true });
    }
  }
});

test('consumer cross-repo specs declare only dependency identity', () => {
  for (const path of [
    'docs/specs/xuanxue-ai-production/product-execution-contract.dependency.spec.json',
    'docs/specs/xuanxue-ai-production/xuanxue-ai-production-v6.dependency.spec.json',
  ]) {
    const spec = JSON.parse(readFileSync(path, 'utf8')) as { specKind: string; contract: Record<string, unknown> };
    assert.equal(spec.specKind, 'cross-repo-dependency');
    assert.deepEqual(Object.keys(spec.contract).sort(), ['contractId', 'providerRepo', 'version']);
  }
});

test('retired verdict and binding vocabulary has no current governance authority', () => {
  const paths = [
    'AGENTS.md',
    '.github/instructions/agent-rules/基础法案.md',
    '.github/instructions/agent-rules/功能法案.md',
    'scripts/audit/generated/law-registry.generated.json',
  ];
  const current = paths.map((path) => readFileSync(path, 'utf8')).join('\n');
  for (const token of ['GOVERNANCE-FREEZE', 'lawBindings', 'candidateId', 'proof package', 'proof-package']) assert.equal(current.includes(token), false, token);
});
