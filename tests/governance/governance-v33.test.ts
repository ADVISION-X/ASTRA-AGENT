import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { buildRegistry, checkProjection, loadLaws, pathRole, verifyEntry, verifyProductionOwnership } from '../../scripts/audit/governance-authority.js';
import { assertLawMajorVersionChanges } from '../../scripts/audit/governance-change-authority.js';
import { GovernanceError } from '../../scripts/audit/governance-runtime.js';
import { assertRoleConsumptionEdges } from '../../scripts/audit/shared/governance-role-consumption.js';
import { detectHighImpactChanges, type HighImpactFinding } from '../../scripts/audit/shared/high-impact-detector.js';

const retiredDomains = ['audit-system', 'audit-truth', 'domain-registry', 'exam-system', 'law-system', 'project-governance'];

test('typed high-impact detector covers all twelve machine-owned categories', () => {
  const cases: Array<{ category: HighImpactFinding['category']; path: string; source: string }> = [
    { category: 'api', path: 'src/app/server.ts', source: 'router.post("/api/jobs", handler);' },
    { category: 'cli', path: 'package.json', source: '"scripts": { "serve": "node server.js" }' },
    { category: 'event', path: 'src/app/events.ts', source: 'target.addEventListener("change", handler);' },
    { category: 'queue', path: 'src/jobs/producer.ts', source: 'enqueue(payload);' },
    { category: 'table', path: 'scripts/migrations/001.sql', source: 'CREATE TABLE jobs (id TEXT);' },
    { category: 'column', path: 'scripts/migrations/002.sql', source: 'ALTER TABLE jobs ADD COLUMN state TEXT;' },
    { category: 'environment-variable', path: 'src/config.ts', source: 'process.env.NEW_RUNTIME_HOST' },
    { category: 'dependency', path: 'package.json', source: '"new-package": "^1.0.0"' },
    { category: 'listener', path: 'src/server.ts', source: 'server.listen(8080);' },
    { category: 'external-host', path: 'src/client.ts', source: 'fetch("https://api.example.com/v1");' },
    { category: 'browser-permission', path: 'src/lib/browser/chrome-extension/manifest.json', source: '"host_permissions": ["https://example.com/*"]' },
    { category: 'cross-repo-contract', path: 'docs/specs/provider.json', source: '"specKind": "cross-repo-contract"' },
  ];
  for (const fixture of cases) {
    const findings = detectHighImpactChanges([{ status: 'M', path: fixture.path }], () => fixture.source);
    assert.equal(findings.some((finding) => finding.category === fixture.category), true, fixture.category);
    assert.equal(findings.every((finding) => finding.path === fixture.path && finding.selector.length > 0), true);
  }
});

test('normative law edits require a successor major', () => {
  const prior = loadLaws().find((law) => law.lawId === 'LAW-AI-INPUT-GATEWAY-001-V1');
  assert.ok(prior);
  const sameMajorMutation = { ...prior, summary: `${prior.summary} changed` };
  assert.throws(
    () => assertLawMajorVersionChanges([prior], [sameMajorMutation]),
    (error: unknown) => error instanceof GovernanceError && error.code === 'LAW_MAJOR_CHANGE_UNENFORCED',
  );
  const successor = { ...sameMajorMutation, lawId: 'LAW-AI-INPUT-GATEWAY-001-V2', supersedesLawId: prior.lawId };
  assert.doesNotThrow(() => assertLawMajorVersionChanges([prior], [successor]));
});

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

test('real discovery rejects module, package-config, and filesystem consumption of TEST_ONLY paths', () => {
  const fixturePath = 'tests/governance/quality-contract.test.ts';
  const mutations: Array<(repository: string) => void> = [
    (repository) => writeFileSync(resolve(repository, 'scripts/audit/governance.ts'),
      `${readFileSync(resolve(repository, 'scripts/audit/governance.ts'), 'utf8')}\nimport "../../tests/governance/quality-contract.test.js";\n`),
    (repository) => {
      const packagePath = resolve(repository, 'package.json');
      const value = JSON.parse(readFileSync(packagePath, 'utf8')) as { scripts: Record<string, string> };
      value.scripts['internal:role-consumption-mutant'] = `node --import tsx ${fixturePath}`;
      writeFileSync(packagePath, `${JSON.stringify(value, null, 2)}\n`);
    },
    (repository) => writeFileSync(resolve(repository, 'scripts/audit/governance.ts'),
      `${readFileSync(resolve(repository, 'scripts/audit/governance.ts'), 'utf8')}\nimport { readFileSync as readRoleFixture } from "node:fs";\nvoid readRoleFixture("${fixturePath}");\n`),
  ];
  for (const [mutationIndex, mutate] of mutations.entries()) {
    const temporary = mkdtempSync(resolve(tmpdir(), 'governance-role-consumption-'));
    const repository = resolve(temporary, 'repo');
    try {
      execFileSync('git', ['clone', '-q', '--local', '--no-hardlinks', process.cwd(), repository]);
      writeFileSync(resolve(repository, '.git/info/exclude'), 'node_modules\n');
      symlinkSync(resolve(process.cwd(), 'node_modules'), resolve(repository, 'node_modules'), 'dir');
      copyFileSync(resolve(process.cwd(), 'scripts/audit/shared/governance-role-consumption.ts'),
        resolve(repository, 'scripts/audit/shared/governance-role-consumption.ts'));
      mutate(repository);
      const execution = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
        'import { verifyPathRoleEscalation } from "./scripts/audit/shared/governance-role-consumption.ts"; verifyPathRoleEscalation();'], {
        cwd: repository, encoding: 'utf8',
      });
      assert.notEqual(execution.status, 0,
        `role consumption mutation ${mutationIndex} unexpectedly passed: ${execution.stdout}${execution.stderr}`);
      assert.match(`${execution.stdout}${execution.stderr}`, /ROLE_ESCALATION_REQUIRED/u);
    } finally {
      rmSync(temporary, { force: true, recursive: true });
    }
  }
});

test('quality CHANGE rejects malformed touched law, Manifest, blueprint, and spec authority', () => {
  const mutations: Array<{ path: string; mutate: (source: string) => string }> = [
    { path: '.github/instructions/agent-rules/功能法案.md', mutate: (source) => `${source}\n---\n` },
    { path: 'scripts/audit/domains/code-purity/manifest.json', mutate: (source) => {
      const value = JSON.parse(source) as Record<string, unknown>;
      return `${JSON.stringify({ ...value, unexpected: true }, null, 2)}\n`;
    } },
    { path: 'scripts/audit/domains/code-purity/manifest.json', mutate: (source) =>
      source.replace('    ".gitignore",', '    "<domain>/**",') },
    { path: 'docs/blueprints/local-browser-session/LOCAL-BROWSER-SESSION-V6-OWNER-JOURNAL-BLUEPRINT.md',
      mutate: (source) => source.replace('  "schemaVersion": 1,', '  "schemaVersion": 1,\n  "unexpected": true,') },
    { path: 'docs/blueprints/local-browser-session/LOCAL-BROWSER-SESSION-V6-OWNER-JOURNAL-BLUEPRINT.md',
      mutate: (source) => source.replace('"blueprintId": "local-browser-session-v6-owner-journal"', '"blueprintId": "<stable-id>"') },
    { path: 'docs/specs/xuanxue-ai-production/product-execution-contract.dependency.spec.json', mutate: (source) => {
      const value = JSON.parse(source) as Record<string, unknown>;
      return `${JSON.stringify({ ...value, unexpected: true }, null, 2)}\n`;
    } },
    { path: 'docs/specs/xuanxue-ai-production/product-execution-contract.dependency.spec.json',
      mutate: (source) => source.replace('"contractId": "ai-acceptance.product-execution-contract"', '"contractId": "<contract-id>"') },
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

test('quality CHANGE ignores malformed untouched authority while validating the actual diff', () => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'governance-change-focused-'));
  const repository = resolve(temporary, 'repo');
  try {
    execFileSync('git', ['clone', '-q', '--local', '--no-hardlinks', process.cwd(), repository]);
    writeFileSync(resolve(repository, '.git/info/exclude'), 'node_modules\n');
    symlinkSync(resolve(process.cwd(), 'node_modules'), resolve(repository, 'node_modules'), 'dir');
    copyFileSync(resolve(process.cwd(), 'src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-enrollment.ts'),
      resolve(repository, 'src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-enrollment.ts'));
    copyFileSync(resolve(process.cwd(), 'scripts/audit/shared/inspector-context-acceptance-support.ts'),
      resolve(repository, 'scripts/audit/shared/inspector-context-acceptance-support.ts'));
    const fixtureSupportPath = resolve(repository, 'scripts/audit/shared/inspector-context-acceptance-support.ts');
    const clonedInspectorContract = readFileSync(
      resolve(repository, 'scripts/audit/shared/inspector-contracts.ts'), 'utf8',
    );
    if (!clonedInspectorContract.includes('requiredStaticModes: string[]')) {
      writeFileSync(fixtureSupportPath, readFileSync(fixtureSupportPath, 'utf8')
        .replace('requiredStaticModes: ["static.ast"],', 'clausesByMode: { "static.ast": ["summary"] },'));
    }
    const manifestPath = resolve(repository, 'scripts/audit/domains/code-purity/manifest.json');
    writeFileSync(manifestPath, readFileSync(manifestPath, 'utf8').replace('    ".gitignore",', '    "<domain>/**",'));
    execFileSync('git', ['config', 'user.email', 'governance@example.invalid'], { cwd: repository });
    execFileSync('git', ['config', 'user.name', 'Governance Fixture'], { cwd: repository });
    execFileSync('git', ['add', 'scripts/audit/domains/code-purity/manifest.json'], { cwd: repository });
    execFileSync('git', ['commit', '-q', '-m', 'fixture malformed untouched authority'], { cwd: repository });
    const changedPath = resolve(repository, 'tests/focused-change-fixture.test.ts');
    writeFileSync(changedPath, 'import test from "node:test";\nimport assert from "node:assert/strict";\ntest("focused", () => assert.ok(true));\n');
    const execution = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/audit/governance.ts', 'quality', 'CHANGE'], {
      cwd: repository, encoding: 'utf8', env: process.env,
    });
    assert.equal(execution.status, 0, `${execution.stdout}${execution.stderr}`);
    assert.match(execution.stdout, /CHANGE_PASS/u);
  } finally {
    rmSync(temporary, { force: true, recursive: true });
  }
});

test('quality CHANGE executes a changed governance test and rejects its failing mutant', () => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'governance-change-test-mutant-'));
  const repository = resolve(temporary, 'repo');
  try {
    execFileSync('git', ['clone', '-q', '--local', '--no-hardlinks', process.cwd(), repository]);
    writeFileSync(resolve(repository, '.git/info/exclude'), 'node_modules\n');
    symlinkSync(resolve(process.cwd(), 'node_modules'), resolve(repository, 'node_modules'), 'dir');
    copyFileSync(resolve(process.cwd(), 'scripts/audit/governance.ts'), resolve(repository, 'scripts/audit/governance.ts'));
    copyFileSync(resolve(process.cwd(), 'scripts/audit/shared/high-impact-detector.ts'),
      resolve(repository, 'scripts/audit/shared/high-impact-detector.ts'));
    copyFileSync(resolve(process.cwd(), 'src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-enrollment.ts'),
      resolve(repository, 'src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-enrollment.ts'));
    const changedPath = resolve(repository, 'tests/governance/quality-contract.test.ts');
    writeFileSync(changedPath, `${readFileSync(changedPath, 'utf8')}\ntest("focused failing mutant", () => assert.fail("mutant executed"));\n`);
    const execution = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/audit/governance.ts', 'quality', 'CHANGE'], {
      cwd: repository,
      encoding: 'utf8',
      env: {
        ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT')),
        GRASSEYE_HIGH_IMPACT_AUTHORIZED: '1',
      },
    });
    assert.notEqual(execution.status, 0, `${execution.stdout}${execution.stderr}`);
    assert.match(`${execution.stdout}${execution.stderr}`, /CHECK_EXECUTION_FAILED/u);
    assert.match(`${execution.stdout}${execution.stderr}`, /mutant executed/u);
  } finally {
    rmSync(temporary, { force: true, recursive: true });
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
