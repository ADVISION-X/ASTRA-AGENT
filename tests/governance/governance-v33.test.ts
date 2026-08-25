import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

import { buildRegistry, checkProjection, loadLaws, pathRole, verifyEntry, verifyProductionOwnership } from '../../scripts/audit/governance-authority.js';

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
