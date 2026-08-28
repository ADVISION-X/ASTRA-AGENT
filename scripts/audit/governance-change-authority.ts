import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertBlueprintMarkdownContractAuthority, blueprintMarkdownBodyValid, canonicalBytes, concreteString, exactKeys, isStringArray, parseJson, pathPatternValid, rejectDuplicateJsonKeys, sortedUnique } from './governance-json.js';
import { validateLocalSpecContract } from './governance-local-spec-contract.js';
import { fail, text, walk } from './governance-runtime.js';
import { assertActiveSpecVersionWindows, blueprintValid, parseLawSource } from './governance-authority.js';
import type { Law } from './governance-contract.js';
import { BASE, FUNCTIONAL } from './shared/governance-paths.js';

const LAW = /^LAW-[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{3}-V[1-9][0-9]*$/u;
const DOMAIN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const MANIFEST_KEYS = ['capabilityDomain', 'lawIds', 'observedPaths', 'ownedPaths', 'schemaVersion', 'status'];
const SPEC_KEYS = ['contract', 'lawIds', 'owner', 'schemaVersion', 'specId', 'specKind', 'status', 'version'];
const SPEC_KINDS = ['typed-contract', 'api', 'event', 'storage', 'state-machine', 'config', 'security', 'migration', 'cross-repo-contract', 'cross-repo-dependency'];
type Spec = { schemaVersion: number; specId: string; status: string; version: number; owner: string; lawIds: string[]; specKind: string; contract: unknown };
type CurrentAuthority = {
  activeLawIds: ReadonlySet<string>;
  domains: ReadonlySet<string>;
  lawDependencies: ReadonlyMap<string, readonly string[]>;
  lawDomains: ReadonlyMap<string, string>;
  lawIdsByDomain: ReadonlyMap<string, string[]>;
};

const lawStem = (lawId: string): string => lawId.replace(/-V[1-9][0-9]*$/u, '');
const normativeLawRecord = (law: Law): unknown => ({
  appliesTo: law.appliesTo,
  capabilityDomain: law.capabilityDomain,
  dependsOnLawIds: law.dependsOnLawIds,
  enforcementMode: law.enforcementMode,
  evidenceModes: law.evidenceModes,
  excludes: law.excludes,
  forbidden: law.forbidden,
  schemaVersion: law.schemaVersion,
  status: law.status,
  summary: law.summary,
  tier: law.tier,
});

export const assertLawMajorVersionChanges = (prior: readonly Law[], current: readonly Law[]): void => {
  const currentByStem = new Map(current.map((law) => [lawStem(law.lawId), law]));
  for (const priorLaw of prior) {
    const currentLaw = currentByStem.get(lawStem(priorLaw.lawId));
    if (!currentLaw) continue;
    const changed = JSON.stringify(normativeLawRecord(priorLaw)) !== JSON.stringify(normativeLawRecord(currentLaw));
    if (changed && (currentLaw.lawId === priorLaw.lawId || currentLaw.supersedesLawId !== priorLaw.lawId)) {
      fail('LAW_MAJOR_CHANGE_UNENFORCED', `${priorLaw.lawId}:normative-semantics`);
    }
  }
};

const baselineLawSource = (path: string): string => {
  const result = spawnSync('git', ['show', `HEAD:${path}`], { cwd: process.cwd(), encoding: 'utf8' });
  return result.status === 0 ? result.stdout : '';
};

const parseCorpus = (base: string, functional: string): Law[] => [
  ...parseLawSource(base, BASE, 'base-law', 100),
  ...parseLawSource(functional, FUNCTIONAL, 'functional-law', 90),
];

const loadCurrentAuthority = (): CurrentAuthority => {
  const laws = parseCorpus(text(BASE), text(FUNCTIONAL));
  const lawIdsByDomain = new Map<string, string[]>();
  for (const law of laws) lawIdsByDomain.set(law.capabilityDomain,
    [...(lawIdsByDomain.get(law.capabilityDomain) ?? []), law.lawId].sort());
  return {
    activeLawIds: new Set(laws.map((law) => law.lawId)),
    domains: new Set(laws.map((law) => law.capabilityDomain)),
    lawDependencies: new Map(laws.map((law) => [law.lawId, law.dependsOnLawIds])),
    lawDomains: new Map(laws.map((law) => [law.lawId, law.capabilityDomain])),
    lawIdsByDomain,
  };
};

const validateLawCorpusChange = (): void => {
  const current = parseCorpus(text(BASE), text(FUNCTIONAL));
  const priorBase = baselineLawSource(BASE);
  const priorFunctional = baselineLawSource(FUNCTIONAL);
  if (priorBase && priorFunctional) assertLawMajorVersionChanges(parseCorpus(priorBase, priorFunctional), current);
};

const machineBlock = (path: string): Record<string, unknown> => {
  const source = text(path);
  const marker = '```blueprint-record\n';
  const start = source.indexOf(marker);
  if (start < 0 || source.indexOf(marker, start + marker.length) >= 0) fail('SOURCE_PARSE_FAILED', `${path}:blueprint-record`);
  const end = source.indexOf('\n```', start + marker.length);
  if (end < 0) fail('SOURCE_PARSE_FAILED', `${path}:blueprint-record:unclosed`);
  const block = source.slice(start + marker.length, end);
  rejectDuplicateJsonKeys(block, path);
  try { return JSON.parse(block) as Record<string, unknown>; } catch { return fail('SOURCE_PARSE_FAILED', path); }
};

const validateManifest = (path: string, authority: CurrentAuthority): void => {
  const raw = parseJson<Record<string, unknown>>(path);
  if (!exactKeys(raw, MANIFEST_KEYS) || raw.schemaVersion !== 5 || raw.status !== 'active'
    || typeof raw.capabilityDomain !== 'string' || !DOMAIN.test(raw.capabilityDomain)) fail('SOURCE_PARSE_FAILED', `${path}:schema`);
  for (const field of ['lawIds', 'ownedPaths', 'observedPaths']) {
    const values = raw[field];
    if (!isStringArray(values) || !sortedUnique(values)
      || values.some((value) => field === 'lawIds' ? !LAW.test(value) : !pathPatternValid(value))) fail('SOURCE_PARSE_FAILED', `${path}:${field}`);
  }
  if (!(raw.lawIds as string[]).length || (raw.ownedPaths as string[]).includes('**/*')) fail('SOURCE_PARSE_FAILED', `${path}:scope`);
  const pathDomain = path.split('/').at(-2);
  if (pathDomain !== raw.capabilityDomain
    || JSON.stringify(raw.lawIds) !== JSON.stringify(authority.lawIdsByDomain.get(String(raw.capabilityDomain)) ?? [])) {
    fail('SOURCE_PARSE_FAILED', `${path}:authority`);
  }
};

const validateSpec = (path: string, authority: CurrentAuthority): void => {
  const raw = parseJson<Spec>(path);
  if (!specEnvelopeValid(raw)) fail('SOURCE_PARSE_FAILED', `${path}:schema`);
  if (!authority.domains.has(raw.owner)
    || raw.lawIds.some((lawId) => authority.lawDomains.get(lawId) !== raw.owner)) {
    fail('SOURCE_PARSE_FAILED', `${path}:authority`);
  }
  if (raw.specKind === 'cross-repo-dependency' && !dependencySpecValid(raw)) {
    fail('SOURCE_PARSE_FAILED', `${path}:cross-repo-dependency`);
  }
  if (raw.specKind === 'cross-repo-contract' && !providerSpecValid(raw)) {
    fail('SOURCE_PARSE_FAILED', `${path}:cross-repo-contract`);
  }
  if (!raw.specKind.startsWith('cross-repo-')) validateLocalSpecContract(raw, path);
};

const specEnvelopeValid = (raw: Spec): boolean => exactKeys(raw, SPEC_KEYS)
  && raw.schemaVersion === 1 && raw.status === 'active' && concreteString(raw.specId)
  && Number.isInteger(raw.version) && raw.version >= 1 && DOMAIN.test(raw.owner) && isStringArray(raw.lawIds)
  && raw.lawIds.length > 0 && sortedUnique(raw.lawIds) && raw.lawIds.every((id) => LAW.test(id))
  && SPEC_KINDS.includes(raw.specKind) && Boolean(raw.contract) && typeof raw.contract === 'object' && !Array.isArray(raw.contract);

const dependencySpecValid = (raw: Spec): boolean => {
  const contract = raw.contract as Record<string, unknown>;
  return exactKeys(contract, ['contractId', 'providerRepo', 'version']) && concreteString(contract.contractId)
    && REPO.test(String(contract.providerRepo)) && contract.version === raw.version;
};

const providerSpecValid = (raw: Spec): boolean => {
  const contract = raw.contract as Record<string, unknown>;
  const artifact = contract.authorityArtifact as Record<string, unknown>;
  return exactKeys(contract, ['authorityArtifact', 'contractId', 'providerDomain', 'providerRepo', 'version'])
    && concreteString(contract.contractId) && contract.providerDomain === raw.owner && REPO.test(String(contract.providerRepo))
    && contract.version === raw.version && Boolean(artifact) && exactKeys(artifact, ['path', 'selector'])
    && typeof artifact.path === 'string' && pathPatternValid(artifact.path) && concreteString(artifact.selector);
};

export const assertProviderContractVersionChanges = (prior: Spec, current: Spec, path: string): void => {
  if (prior.specKind !== 'cross-repo-contract' || current.specKind !== 'cross-repo-contract') return;
  if (prior.specId !== current.specId || prior.owner !== current.owner) {
    fail('PROVIDER_CONTRACT_VERSION_UNENFORCED', `${path}:identity`);
  }
  if (canonicalBytes(prior.contract) !== canonicalBytes(current.contract) && current.version <= prior.version) {
    fail('PROVIDER_CONTRACT_VERSION_UNENFORCED', `${path}:normative-contract`);
  }
};

const specAtRevision = (revision: string, path: string): Spec | null => {
  const result = spawnSync('git', ['show', `${revision}:${path}`], { cwd: process.cwd(), encoding: 'utf8' });
  if (result.status !== 0) return null;
  rejectDuplicateJsonKeys(result.stdout, `${revision}:${path}`);
  try { return JSON.parse(result.stdout) as Spec; } catch { return fail('SOURCE_PARSE_FAILED', `${revision}:${path}`); }
};

export const validateCommittedProviderContractVersionChanges = (): void => {
  if (spawnSync('git', ['rev-parse', '--verify', 'HEAD^'], { cwd: process.cwd(), stdio: 'ignore' }).status !== 0) return;
  const paths = spawnSync('git', ['diff', '--name-only', 'HEAD^', 'HEAD', '--', 'docs/specs'], {
    cwd: process.cwd(), encoding: 'utf8',
  }).stdout.split('\n').filter((path) => path.endsWith('.json'));
  for (const path of paths) {
    if (!existsSync(resolve(process.cwd(), path))) continue;
    const current = parseJson<Spec>(path);
    const prior = specAtRevision('HEAD^', path);
    if (prior) assertProviderContractVersionChanges(prior, current, path);
  }
};

const validateBlueprint = (path: string, authority: CurrentAuthority): void => {
  if (path.endsWith('.md') && !blueprintMarkdownBodyValid(text(path))) fail('SOURCE_PARSE_FAILED', `${path}:body`);
  const raw = path.endsWith('.json') ? parseJson<Record<string, unknown>>(path) : machineBlock(path);
  const refs = isStringArray(raw.contractRefs) ? raw.contractRefs : [];
  const specPaths = new Set<string>();
  const contractAuthorities: Array<{ contractId: string; version: number }> = [];
  const dependencyRepos = new Map<string, string>();
  for (const ref of refs) {
    if (!existsSync(resolve(process.cwd(), ref))) continue;
    validateSpec(ref, authority);
    specPaths.add(ref);
    const spec = parseJson<Spec>(ref);
    const contract = spec.contract as Record<string, unknown>;
    contractAuthorities.push({ contractId: typeof contract.contractId === 'string' ? contract.contractId : spec.specId, version: spec.version });
    if (spec.specKind === 'cross-repo-dependency') {
      dependencyRepos.set(ref, String(contract.providerRepo));
    }
  }
  if (!blueprintValid(raw, authority.activeLawIds, authority.domains, specPaths,
    dependencyRepos, authority.lawDomains, authority.lawDependencies)) fail('SOURCE_PARSE_FAILED', `${path}:schema`);
  if (path.endsWith('.md')) assertBlueprintMarkdownContractAuthority(text(path), contractAuthorities);
};

const validateChangedSource = (change: { status: string; path: string }, authority: CurrentAuthority): void => {
  if (change.status === 'D') return;
  if (change.path === BASE || change.path === FUNCTIONAL) return;
  if (/^scripts\/audit\/domains\/[^/]+\/manifest\.json$/u.test(change.path)) return validateManifest(change.path, authority);
  if (change.path.startsWith('docs/specs/') && change.path.endsWith('.json')) {
    validateSpec(change.path, authority);
    const current = parseJson<Spec>(change.path);
    const prior = specAtRevision('HEAD', change.path);
    if (prior) assertProviderContractVersionChanges(prior, current, change.path);
    return;
  }
  if (change.path.startsWith('docs/blueprints/') && (change.path.endsWith('.md') || change.path.endsWith('.json'))) {
    validateBlueprint(change.path, authority);
  }
};

export const validateChangedGovernanceSources = (changes: Array<{ status: string; path: string }>): void => {
  if (changes.some((change) => change.path === BASE || change.path === FUNCTIONAL)) validateLawCorpusChange();
  const authority = loadCurrentAuthority();
  changes.forEach((change) => validateChangedSource(change, authority));
  if (changes.some((change) => change.path.startsWith('docs/specs/') && change.path.endsWith('.json'))) {
    assertActiveSpecVersionWindows(walk('docs/specs').filter((path) => path.endsWith('.json'))
      .map((file) => ({ file, raw: parseJson<Spec>(file) })));
  }
};
