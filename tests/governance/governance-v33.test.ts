import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import test from 'node:test';

import { assertActiveSpecVersionWindows, assertOneActiveMajorPerLawKey, buildRegistry, checkProjection, loadLaws, motherSpecIdentityValid, parseLawSource, verifyEntry, verifyGovernanceCommandSurface, verifyProductionOwnership } from '../../scripts/audit/governance-authority.js';
import { assertLawMajorVersionChanges, assertProviderContractVersionChanges } from '../../scripts/audit/governance-change-authority.js';
import { assertProductionDeleteAuthorization } from '../../scripts/audit/governance.js';
import { assertNoCaseCollision, GovernanceError } from '../../scripts/audit/governance-runtime.js';
import { assertRoleConsumptionEdges } from '../../scripts/audit/shared/governance-role-consumption.js';
import { pathRole } from '../../scripts/audit/shared/governance-paths.js';
import { detectHighImpactChanges, type HighImpactFinding } from '../../scripts/audit/shared/high-impact-detector.js';

const retiredDomains = ['audit-system', 'audit-truth', 'domain-registry', 'exam-system', 'law-system', 'project-governance'];

test('builder source walk rejects case-fold path collisions', () => {
  assert.throws(() => assertNoCaseCollision(['docs/blueprints/Case.md', 'docs/blueprints/case.md']),
    (error: unknown) => error instanceof GovernanceError && error.code === 'SOURCE_PARSE_FAILED');
  assert.doesNotThrow(() => assertNoCaseCollision(['docs/blueprints/alpha.md', 'docs/blueprints/beta.md']));
});

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
  const prior = loadLaws().find((law) => law.capabilityDomain === 'gpt');
  assert.ok(prior);
  const sameMajorMutation = { ...prior, summary: `${prior.summary} changed` };
  assert.throws(
    () => assertLawMajorVersionChanges([prior], [sameMajorMutation]),
    (error: unknown) => error instanceof GovernanceError && error.code === 'LAW_MAJOR_CHANGE_UNENFORCED',
  );
  const successorVersion = Number(prior.lawId.match(/-V([1-9][0-9]*)$/u)?.[1]) + 1;
  const successor = { ...sameMajorMutation,
    lawId: prior.lawId.replace(/-V[1-9][0-9]*$/u, `-V${successorVersion}`), supersedesLawId: prior.lawId };
  assert.doesNotThrow(() => assertLawMajorVersionChanges([prior], [successor]));
  assert.doesNotThrow(() => assertLawMajorVersionChanges([prior], []));
});

test('law corpus permits an empty source but rejects two active majors for one lawKey', () => {
  const baseSource = readFileSync('.github/instructions/agent-rules/基础法案.md', 'utf8');
  const headingAt = baseSource.indexOf('# 基础法案');
  assert(headingAt >= 0);
  assert.deepEqual(parseLawSource(`${baseSource.slice(0, headingAt)}# 基础法案\n`, 'empty-base.md', 'base-law', 100), []);
  const active = loadLaws().find((law) => law.capabilityDomain === 'gpt');
  assert.ok(active);
  const successorVersion = Number(active.lawId.match(/-V([1-9][0-9]*)$/u)?.[1]) + 1;
  assert.throws(
    () => assertOneActiveMajorPerLawKey([active, {
      ...active, lawId: active.lawId.replace(/-V[1-9][0-9]*$/u, `-V${successorVersion}`), supersedesLawId: active.lawId,
    }]),
    (error: unknown) => error instanceof GovernanceError && error.code === 'SOURCE_PARSE_FAILED',
  );
});

test('dual active spec versions require one exact migration window', () => {
  const oldSpec = {
    file: 'old.json', raw: { schemaVersion: 1, specId: 'gpt.contract', status: 'active', version: 1,
      owner: 'gpt', lawIds: ['LAW-GPT-001-V2'], specKind: 'typed-contract', contract: { fields: {}, typeName: 'Old' } },
  };
  const newSpec = { file: 'new.json', raw: { ...oldSpec.raw, version: 2, contract: { fields: {}, typeName: 'New' } } };
  assert.throws(() => assertActiveSpecVersionWindows([oldSpec, newSpec]),
    (error: unknown) => error instanceof GovernanceError && error.code === 'SOURCE_PARSE_FAILED');
  const migration = {
    file: 'migration.json', raw: { ...oldSpec.raw, specId: 'gpt.contract-migration', specKind: 'migration', contract: {
      currentAuthority: 'gpt.contract@1', targetAuthority: 'gpt.contract@2',
      compatibilityMechanisms: ['dual-read'], startDate: '2026-08-27', monitoring: ['old reads'],
      rollbackCondition: 'restore old', maximumDurationDays: 1, removalDate: '2026-08-28',
      removalAcceptance: ['old version removed'],
    } },
  };
  assert.doesNotThrow(() => assertActiveSpecVersionWindows([oldSpec, newSpec, migration]));
});

test('provider contract semantic changes require a higher native version', () => {
  const prior = { schemaVersion: 1, specId: 'gpt.provider', status: 'active', version: 1, owner: 'gpt',
    lawIds: ['LAW-GPT-001-V2'], specKind: 'cross-repo-contract', contract: {
      authorityArtifact: { path: 'src/provider.ts', selector: 'ProviderV1' }, contractId: 'gpt.provider',
      providerDomain: 'gpt', providerRepo: 'ADVISION-X/AGENT', version: 1,
    } };
  const sameVersionMutation = { ...prior, contract: { ...prior.contract,
    authorityArtifact: { ...prior.contract.authorityArtifact, selector: 'ProviderChanged' } } };
  assert.throws(() => assertProviderContractVersionChanges(prior, sameVersionMutation, 'provider.json'),
    (error: unknown) => error instanceof GovernanceError && error.code === 'PROVIDER_CONTRACT_VERSION_UNENFORCED');
  const successor = { ...sameVersionMutation, version: 2, contract: { ...sameVersionMutation.contract, version: 2 } };
  assert.doesNotThrow(() => assertProviderContractVersionChanges(prior, successor, 'provider.json'));
});

test('mother specification version identity is fixed to the actual header', () => {
  const source = readFileSync('docs/governance/法案系统建设说明书-冻结定稿版.md', 'utf8');
  assert.equal(motherSpecIdentityValid(source), true);
  assert.equal(motherSpecIdentityValid(source.replace('FINAL-V3.3｜', 'FINAL-V3.4｜')
    + '\n文件版本：FINAL-V3.3｜轻结构强执法闭环版\n冻结目标版本：FROZEN-FINAL-V3.3\n'), false);
  assert.equal(motherSpecIdentityValid(`moved\n${source}`), false);
});

test('production deletion requires one baseline Owner and current-task authorization', () => {
  const registry = buildRegistry();
  const deletion = [{ status: 'D', path: 'scripts/audit/governance.ts' }];
  assert.throws(() => assertProductionDeleteAuthorization(deletion, registry, false),
    (error: unknown) => error instanceof GovernanceError && error.code === 'UNAUTHORIZED_PRODUCTION_DELETE');
  assert.doesNotThrow(() => assertProductionDeleteAuthorization(deletion, registry, true));
  assert.throws(() => assertProductionDeleteAuthorization([{ status: 'D', path: 'unowned-production.ts' }], registry, true),
    (error: unknown) => error instanceof GovernanceError && error.code === 'UNAUTHORIZED_PRODUCTION_DELETE');
  assert.doesNotThrow(() => assertProductionDeleteAuthorization([{ status: 'D', path: 'tests/deleted.test.ts' }], registry, false));
});

test('V3.3 entry has one public command surface and no freeze sidecar', () => {
  verifyEntry();
  assert.equal(existsSync('docs/governance/GOVERNANCE-FREEZE.json'), false);
  const scripts = (JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }).scripts;
  assert.doesNotThrow(() => verifyGovernanceCommandSurface(scripts));
  for (const [name, command] of [
    ['verify:ready', 'npm run quality:check -- READY'],
    ['verify:indirect', 'npm run verify:ready'],
    ['verify:direct', 'node --import tsx scripts/audit/governance.ts quality READY'],
    ['verify:yarn', 'yarn quality:check -- READY'],
  ]) assert.throws(() => verifyGovernanceCommandSurface({ ...scripts, 'verify:ready': 'npm run quality:check -- READY', [name]: command }),
    (error: unknown) => error instanceof GovernanceError && error.code === 'ENTRY_CONTRACT_MISMATCH');
});

test('quality report isolation rejects removed, narrowed, and tracked report mutants', () => {
  const mutations: Array<(repository: string) => void> = [
    (repository) => {
      const path = resolve(repository, '.gitignore');
      writeFileSync(path, readFileSync(path, 'utf8').replace('scripts/audit/reports/\n', ''));
    },
    (repository) => {
      const path = resolve(repository, '.gitignore');
      writeFileSync(path, readFileSync(path, 'utf8')
        .replace('scripts/audit/reports/', 'scripts/audit/reports/*.tmp-*'));
    },
    (repository) => {
      const report = resolve(repository, 'scripts/audit/reports/law-quality.report.json');
      mkdirSync(dirname(report), { recursive: true });
      writeFileSync(report, '{}\n');
      execFileSync('git', ['add', '-f', 'scripts/audit/reports/law-quality.report.json'], { cwd: repository });
    },
  ];
  for (const [mutationIndex, mutate] of mutations.entries()) {
    const temporary = mkdtempSync(resolve(tmpdir(), 'governance-report-isolation-'));
    const repository = resolve(temporary, 'repo');
    try {
      execFileSync('git', ['clone', '-q', '--local', '--no-hardlinks', process.cwd(), repository]);
      writeFileSync(resolve(repository, '.git/info/exclude'), 'node_modules\n');
      symlinkSync(resolve(process.cwd(), 'node_modules'), resolve(repository, 'node_modules'), 'dir');
      copyFileSync(resolve(process.cwd(), 'scripts/audit/governance-authority.ts'),
        resolve(repository, 'scripts/audit/governance-authority.ts'));
      copyFileSync(resolve(process.cwd(), 'AGENTS.md'), resolve(repository, 'AGENTS.md'));
      mutate(repository);
      const execution = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
        'import { verifyEntry } from "./scripts/audit/governance-authority.ts"; verifyEntry();'], {
        cwd: repository,
        encoding: 'utf8',
      });
      assert.notEqual(execution.status, 0,
        `report isolation mutation ${mutationIndex} unexpectedly passed: ${execution.stdout}${execution.stderr}`);
      assert.match(`${execution.stdout}${execution.stderr}`, /REPORT_GITIGNORE_ENFORCEMENT_MISSING/u);
    } finally {
      rmSync(temporary, { force: true, recursive: true });
    }
  }
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
    { path: 'scripts/audit/domains/code-purity/manifest.json', mutate: (source) => {
      const value = JSON.parse(source) as { capabilityDomain: string; lawIds: string[] };
      value.capabilityDomain = 'gpt';
      value.lawIds = ['LAW-GPT-001-V2'];
      return `${JSON.stringify(value, null, 2)}\n`;
    } },
    { path: 'docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md',
      mutate: (source) => source.replace('  "schemaVersion": 1,', '  "schemaVersion": 1,\n  "unexpected": true,') },
    { path: 'docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md',
      mutate: (source) => source.replace(/"blueprintId": "[^"]+"/u, '"blueprintId": "<stable-id>"') },
    { path: 'docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md',
      mutate: (source) => source.replace(/"LAW-LOCAL-BROWSER-SESSION-[^"]+"/u, '"LAW-LOCAL-BROWSER-SESSION-999-V1"') },
    { path: 'docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json', mutate: (source) => {
      const value = JSON.parse(source) as Record<string, unknown>;
      return `${JSON.stringify({ ...value, unexpected: true }, null, 2)}\n`;
    } },
    { path: 'docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json',
      mutate: (source) => source.replace('"contractId": "ai-acceptance.website-agent-task-result"', '"contractId": "<contract-id>"') },
    { path: 'docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json', mutate: (source) => {
      const value = JSON.parse(source) as { lawIds: string[] };
      value.lawIds = ['LAW-NONEXISTENT-999-V1'];
      return `${JSON.stringify(value, null, 2)}\n`;
    } },
    { path: 'docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json', mutate: (source) => {
      const value = JSON.parse(source) as { contract: { providerRepo: string }; lawIds: string[]; owner: string };
      value.owner = 'gpt';
      value.lawIds = ['LAW-AGENT-PRODUCTION-RUNTIME-001-V5'];
      return `${JSON.stringify(value, null, 2)}\n`;
    } },
  ];
  for (const [mutationIndex, mutation] of mutations.entries()) {
    const temporary = mkdtempSync(resolve(tmpdir(), 'governance-change-authority-'));
    const repository = resolve(temporary, 'repo');
    try {
      execFileSync('git', ['clone', '-q', '--local', '--no-hardlinks', process.cwd(), repository]);
      writeFileSync(resolve(repository, '.git/info/exclude'), 'node_modules\n');
      symlinkSync(resolve(process.cwd(), 'node_modules'), resolve(repository, 'node_modules'), 'dir');
      copyFileSync(resolve(process.cwd(), 'scripts/audit/governance-authority.ts'),
        resolve(repository, 'scripts/audit/governance-authority.ts'));
      copyFileSync(resolve(process.cwd(), 'scripts/audit/governance-change-authority.ts'),
        resolve(repository, 'scripts/audit/governance-change-authority.ts'));
      copyFileSync(resolve(process.cwd(), 'AGENTS.md'), resolve(repository, 'AGENTS.md'));
      const target = resolve(repository, mutation.path);
      if (!existsSync(target)) {
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(resolve(process.cwd(), mutation.path), target);
      }
      writeFileSync(target, mutation.mutate(readFileSync(target, 'utf8')));
      const execution = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/audit/governance.ts', 'quality', 'CHANGE'], {
        cwd: repository,
        encoding: 'utf8',
        env: { ...process.env, GRASSEYE_LAW_AMENDMENT_AUTHORIZED: '1', GRASSEYE_HIGH_IMPACT_AUTHORIZED: '1' },
      });
      assert.notEqual(execution.status, 0, `${mutationIndex}:${mutation.path}`);
      assert.match(`${execution.stdout}${execution.stderr}`, /SOURCE_PARSE_FAILED/u, `${mutationIndex}:${mutation.path}`);
    } finally {
      rmSync(temporary, { force: true, recursive: true });
    }
  }
});

test('quality CHANGE ignores malformed untouched authority while validating the actual diff', () => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'governance-change-focused-'));
  const repository = resolve(temporary, 'repo');
  try {
    const sourceRoot = resolve(process.cwd());
    const ignoredRoots = new Set(['.git', '.grasseye-local', 'artifacts', 'node_modules', 'tmp']);
    cpSync(sourceRoot, repository, { recursive: true, filter: (source) => {
      const path = relative(sourceRoot, source).split('\\').join('/');
      const first = path.split('/')[0] ?? '';
      return path === '' || (!ignoredRoots.has(first) && !path.endsWith('/.DS_Store') && path !== '.DS_Store');
    } });
    execFileSync('git', ['init', '-q'], { cwd: repository });
    execFileSync('git', ['config', 'user.email', 'governance@example.invalid'], { cwd: repository });
    execFileSync('git', ['config', 'user.name', 'Governance Fixture'], { cwd: repository });
    execFileSync('git', ['add', '.'], { cwd: repository });
    execFileSync('git', ['commit', '-q', '-m', 'current candidate baseline'], { cwd: repository });
    writeFileSync(resolve(repository, '.git/info/exclude'), 'node_modules\n');
    symlinkSync(resolve(process.cwd(), 'node_modules'), resolve(repository, 'node_modules'), 'dir');
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
    const sourceRoot = resolve(process.cwd());
    const ignoredRoots = new Set(['.git', '.grasseye-local', 'artifacts', 'node_modules', 'tmp']);
    cpSync(sourceRoot, repository, { recursive: true, filter: (source) => {
      const path = relative(sourceRoot, source).split('\\').join('/');
      const first = path.split('/')[0] ?? '';
      return path === '' || (!ignoredRoots.has(first) && !path.endsWith('/.DS_Store') && path !== '.DS_Store');
    } });
    execFileSync('git', ['init', '-q'], { cwd: repository });
    execFileSync('git', ['config', 'user.email', 'governance@example.invalid'], { cwd: repository });
    execFileSync('git', ['config', 'user.name', 'Governance Fixture'], { cwd: repository });
    execFileSync('git', ['add', '.'], { cwd: repository });
    execFileSync('git', ['commit', '-q', '-m', 'current candidate baseline'], { cwd: repository });
    writeFileSync(resolve(repository, '.git/info/exclude'), 'node_modules\n');
    symlinkSync(resolve(process.cwd(), 'node_modules'), resolve(repository, 'node_modules'), 'dir');
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

test('consumer cross-repo specs bind dependency identity and authorized projection metadata', () => {
  const expectedContractKeys = new Map([
    ['docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json',
      ['contractId', 'providerRepo', 'version']],
    ['docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json',
      ['contractId', 'providerRepo', 'version']],
  ]);
  for (const [path, contractKeys] of expectedContractKeys) {
    const spec = JSON.parse(readFileSync(path, 'utf8')) as { specKind: string; contract: Record<string, unknown> };
    assert.equal(spec.specKind, 'cross-repo-dependency');
    assert.deepEqual(Object.keys(spec.contract).sort(), contractKeys);
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
