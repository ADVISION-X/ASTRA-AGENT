import { spawnSync } from 'node:child_process';
import { concreteString, exactKeys, isStringArray, parseJson, pathPatternValid, rejectDuplicateJsonKeys, sortedUnique } from './governance-json.js';
import { validateLocalSpecContract } from './governance-local-spec-contract.js';
import { fail, text } from './governance-runtime.js';
import { parseLawSource, type Law } from './governance-authority.js';
import { BASE, FUNCTIONAL } from './shared/governance-paths.js';

const LAW = /^LAW-[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{3}-V[1-9][0-9]*$/u;
const DOMAIN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const MANIFEST_KEYS = ['capabilityDomain', 'lawIds', 'observedPaths', 'ownedPaths', 'schemaVersion', 'status'];
const SPEC_KEYS = ['contract', 'lawIds', 'owner', 'schemaVersion', 'specId', 'specKind', 'status', 'version'];
const BLUEPRINT_KEYS = ['blueprintId', 'contractRefs', 'dependencyEdges', 'lawIds', 'owner', 'prohibitedDependencyEdges', 'schemaVersion', 'status'];
const SPEC_KINDS = ['typed-contract', 'api', 'event', 'storage', 'state-machine', 'config', 'security', 'migration', 'cross-repo-contract', 'cross-repo-dependency'];
type Endpoint = { repo: string; domain: string };
type AllowedEdge = { from: Endpoint; to: Endpoint; contractRef: string | null };
type ProhibitedEdge = { from: Endpoint; to: Endpoint; lawId: string };
type Spec = { schemaVersion: number; specId: string; status: string; version: number; owner: string; lawIds: string[]; specKind: string; contract: unknown };

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
    const currentLaw = currentByStem.get(lawStem(priorLaw.lawId))
      ?? fail('LAW_MAJOR_CHANGE_UNENFORCED', `${priorLaw.lawId}:removed-without-successor`);
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

const validateChangedLawSource = (
  path: string,
  documentType: 'base-law' | 'functional-law',
  authorityLevel: 100 | 90,
): void => {
  const current = parseLawSource(text(path), path, documentType, authorityLevel);
  const baseline = baselineLawSource(path);
  if (baseline) assertLawMajorVersionChanges(parseLawSource(baseline, path, documentType, authorityLevel), current);
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

const endpointValid = (value: unknown): value is Endpoint => Boolean(value) && typeof value === 'object'
  && !Array.isArray(value) && exactKeys(value as object, ['domain', 'repo'])
  && DOMAIN.test((value as Endpoint).domain)
  && ((value as Endpoint).repo === 'local' || REPO.test((value as Endpoint).repo));
const endpointKey = (value: Endpoint): string => `${value.repo}\0${value.domain}`;
const edgeKey = (edge: AllowedEdge | ProhibitedEdge): string =>
  `${endpointKey(edge.from)}\0${endpointKey(edge.to)}\0${'contractRef' in edge ? edge.contractRef ?? '' : edge.lawId}`;

const blueprintEnvelopeValid = (raw: Record<string, unknown>): boolean =>
  exactKeys(raw, BLUEPRINT_KEYS) && raw.schemaVersion === 1 && raw.status === 'active'
  && concreteString(raw.blueprintId) && typeof raw.owner === 'string' && DOMAIN.test(raw.owner)
  && isStringArray(raw.lawIds) && raw.lawIds.length > 0 && sortedUnique(raw.lawIds)
  && raw.lawIds.every((id) => LAW.test(id)) && isStringArray(raw.contractRefs)
  && sortedUnique(raw.contractRefs) && raw.contractRefs.every(pathPatternValid)
  && Array.isArray(raw.dependencyEdges) && Array.isArray(raw.prohibitedDependencyEdges);

const allowedEdgeValid = (edge: AllowedEdge, refs: ReadonlySet<string>): boolean => Boolean(edge)
  && exactKeys(edge, ['contractRef', 'from', 'to']) && endpointValid(edge.from) && endpointValid(edge.to)
  && endpointKey(edge.from) !== endpointKey(edge.to)
  && (edge.contractRef === null || (concreteString(edge.contractRef) && refs.has(edge.contractRef)));
const prohibitedEdgeValid = (edge: ProhibitedEdge, lawIds: ReadonlySet<string>): boolean => Boolean(edge)
  && exactKeys(edge, ['from', 'lawId', 'to']) && endpointValid(edge.from) && endpointValid(edge.to)
  && endpointKey(edge.from) !== endpointKey(edge.to) && lawIds.has(edge.lawId);

const blueprintValid = (raw: Record<string, unknown>): boolean => {
  if (!blueprintEnvelopeValid(raw)) return false;
  const refs = new Set(raw.contractRefs as string[]); const lawIds = new Set(raw.lawIds as string[]);
  const allowed = raw.dependencyEdges as AllowedEdge[]; const prohibited = raw.prohibitedDependencyEdges as ProhibitedEdge[];
  if (!allowed.every((edge) => allowedEdgeValid(edge, refs))
    || !prohibited.every((edge) => prohibitedEdgeValid(edge, lawIds))) return false;
  const allowedKeys = allowed.map(edgeKey); const prohibitedKeys = prohibited.map(edgeKey);
  const directions = new Set(allowed.map((edge) => `${endpointKey(edge.from)}\0${endpointKey(edge.to)}`));
  return sortedUnique(allowedKeys) && sortedUnique(prohibitedKeys)
    && prohibited.every((edge) => !directions.has(`${endpointKey(edge.from)}\0${endpointKey(edge.to)}`));
};

const validateManifest = (path: string): void => {
  const raw = parseJson<Record<string, unknown>>(path);
  if (!exactKeys(raw, MANIFEST_KEYS) || raw.schemaVersion !== 5 || raw.status !== 'active'
    || typeof raw.capabilityDomain !== 'string' || !DOMAIN.test(raw.capabilityDomain)) fail('SOURCE_PARSE_FAILED', `${path}:schema`);
  for (const field of ['lawIds', 'ownedPaths', 'observedPaths']) {
    const values = raw[field];
    if (!isStringArray(values) || !sortedUnique(values)
      || values.some((value) => field === 'lawIds' ? !LAW.test(value) : !pathPatternValid(value))) fail('SOURCE_PARSE_FAILED', `${path}:${field}`);
  }
  if (!(raw.lawIds as string[]).length || (raw.ownedPaths as string[]).includes('**/*')) fail('SOURCE_PARSE_FAILED', `${path}:scope`);
};

const validateSpec = (path: string): void => {
  const raw = parseJson<Spec>(path);
  if (!specEnvelopeValid(raw)) fail('SOURCE_PARSE_FAILED', `${path}:schema`);
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

const validateChangedSource = (change: { status: string; path: string }): void => {
  if (change.status === 'D') return;
  if (change.path === BASE) return validateChangedLawSource(BASE, 'base-law', 100);
  if (change.path === FUNCTIONAL) return validateChangedLawSource(FUNCTIONAL, 'functional-law', 90);
  if (/^scripts\/audit\/domains\/[^/]+\/manifest\.json$/u.test(change.path)) return validateManifest(change.path);
  if (change.path.startsWith('docs/specs/') && change.path.endsWith('.json')) return validateSpec(change.path);
  if (change.path.startsWith('docs/blueprints/') && (change.path.endsWith('.md') || change.path.endsWith('.json'))) {
    const raw = change.path.endsWith('.json') ? parseJson<Record<string, unknown>>(change.path) : machineBlock(change.path);
    if (!blueprintValid(raw)) fail('SOURCE_PARSE_FAILED', `${change.path}:schema`);
  }
};

export const validateChangedGovernanceSources = (changes: Array<{ status: string; path: string }>): void =>
  changes.forEach(validateChangedSource);
