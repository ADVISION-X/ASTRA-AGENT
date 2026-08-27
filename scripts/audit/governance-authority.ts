import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { blueprintMarkdownBodyValid, canonicalBytes, cleanString, concreteString, exactKeys, isStringArray, parseJson, pathPatternContains, pathPatternValid, rejectDuplicateJsonKeys, sortedUnique } from './governance-json.js';
import { validateLocalSpecContract } from './governance-local-spec-contract.js';
import { ROOT, fail, norm, repositoryPaths, text, validGitObjectId, walk } from './governance-runtime.js';
import { BASE, FUNCTIONAL, pathRole, REGISTRY, REPORT, SPEC } from './shared/governance-paths.js';
import { lawBodyStart } from './shared/law-document-front-matter.js';
import { verifyPathRoleEscalation } from './shared/governance-role-consumption.js';
export { BASE, FUNCTIONAL, pathRole, REGISTRY, REPORT, SPEC } from './shared/governance-paths.js';
export type Level = 'CHANGE' | 'READY' | 'RELEASE';
export type Law = {
  schemaVersion: 2;
  lawId: string;
  supersedesLawId: string | null;
  status: 'active';
  tier: 'P0' | 'P1' | 'P2';
  capabilityDomain: string;
  enforcementMode: 'static' | 'exam' | 'dynamic' | 'composite';
  evidenceModes: string[];
  summary: string;
  appliesTo: string[];
  excludes: string[];
  forbidden: string[];
  dependsOnLawIds: string[];
  source: { path: string; lineStart: number; lineEnd: number };
  contractRefs: string[];
};
export type Manifest = {
  schemaVersion: 5;
  capabilityDomain: string;
  status: 'active';
  lawIds: string[];
  ownedPaths: string[];
  observedPaths: string[];
  manifestPath: string;
};
export type Registry = {
  schemaVersion: 5;
  sourceSpec: { path: string };
  lawCorpus: { baseLawPath: string; functionalLawPath: string };
  laws: Law[];
  domains: Array<Pick<Manifest, 'capabilityDomain' | 'manifestPath' | 'lawIds' | 'ownedPaths' | 'observedPaths'>>;
};
const AGENTS_EXACT = `# Codex Governance Entry\n\n本仓库使用冻结的法案系统。\n\n1. READ_ONLY 直接读取并回答，不写入任何文件。\n2. CHANGE 开始修改前只读查看目标路径的 Git 状态，不得覆盖、删除、恢复或移动未获授权的用户改动。\n3. CHANGE 的实际差异必须与授权人的请求及完成该请求不可分割的直接关联对象一致。\n4. READY 不等于 RELEASE；静态检查、普通测试或部分证据不得被认定为已经完成生产发布。\n5. READY、RELEASE 使用原生 clean Git commit；RELEASE 执行全部 active law 声明的 Dynamic Proof。\n6. 只允许一份 active law corpus、一份 law registry；每个生产路径和合同只允许一个 primary Owner；只允许一个 quality verdict。\n7. 迁移桥、用于迁移的 feature flag、dual-read/write 或 shadow traffic 必须有 Owner、监控、期限、删除日期和删除验收。\n8. 本说明书与 active law 只在授权人分别明确批准对应修改后变更。\n9. 任一 finding、候选漂移、错误证据类型或无事实依据的 PASS 必须失败关闭。\n`;
const LAW_KEYS = ['appliesTo', 'capabilityDomain', 'dependsOnLawIds', 'enforcementMode', 'evidenceModes', 'excludes', 'forbidden', 'lawId', 'schemaVersion', 'status', 'summary', 'supersedesLawId', 'tier'];
const MANIFEST_KEYS = ['capabilityDomain', 'lawIds', 'observedPaths', 'ownedPaths', 'schemaVersion', 'status'];
const SPEC_KEYS = ['contract', 'lawIds', 'owner', 'schemaVersion', 'specId', 'specKind', 'status', 'version'];
const BLUEPRINT_KEYS = ['blueprintId', 'contractRefs', 'dependencyEdges', 'lawIds', 'owner', 'prohibitedDependencyEdges', 'schemaVersion', 'status'];
const EVIDENCE = ['static.filesystem', 'static.text', 'static.ast', 'static.types', 'static.contract', 'static.dependency', 'static.config', 'static.json', 'static.yaml', 'static.sql', 'static.migration', 'exam.golden', 'exam.property', 'exam.state-machine', 'dynamic.browser', 'dynamic.service', 'dynamic.database', 'dynamic.storage', 'dynamic.provider', 'dynamic.authorization', 'dynamic.recovery', 'dynamic.performance'];
const SPEC_KINDS = ['typed-contract', 'api', 'event', 'storage', 'state-machine', 'config', 'security', 'migration', 'cross-repo-contract', 'cross-repo-dependency'];
const LAW_ID_PATTERN = /^LAW-[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{3}-V[1-9][0-9]*$/u;
const DOMAIN_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const byteCompare = (left: string, right: string) => Buffer.compare(Buffer.from(left), Buffer.from(right));
const MOTHER_SPEC_IDENTITY_HEADER = '# 法案系统建设说明书\n\n> 文件版本：FINAL-V3.3｜轻结构强执法闭环版\n> 冻结目标版本：FROZEN-FINAL-V3.3\n';
const matchesPath = (pattern: string, path: string): boolean => pattern === '**/*'
  || pattern === path
  || (pattern.endsWith('/**') && (path === pattern.slice(0, -3) || path.startsWith(`${pattern.slice(0, -3)}/`)))
  || (pattern.includes('/**/*.') && path.startsWith(`${pattern.slice(0, pattern.indexOf('/**/*.'))}/`) && path.endsWith(pattern.slice(pattern.indexOf('/**/*.') + 5)));
const verifyRegistrySourceAuthority = (): void => {
  const spec = text(SPEC);
  if (!motherSpecIdentityValid(spec)) fail('SOURCE_PARSE_FAILED', SPEC);
  if (text('AGENTS.md') !== AGENTS_EXACT) fail('ENTRY_CONTRACT_MISMATCH', 'AGENTS.md');
};
export const motherSpecIdentityValid = (source: string): boolean => source.startsWith(MOTHER_SPEC_IDENTITY_HEADER);
const verifyQualityReportIsolation = (): void => {
  for (const probe of [REPORT, `${REPORT}.tmp-probe`, 'scripts/audit/reports/nested/probe.json']) {
    try {
      execFileSync('git', ['check-ignore', '-q', '--no-index', '--', probe], { cwd: ROOT, stdio: 'ignore' });
    } catch {
      fail('REPORT_GITIGNORE_ENFORCEMENT_MISSING', probe);
    }
  }
  const trackedReports = execFileSync('git', ['ls-files', '-z', '--', 'scripts/audit/reports'],
    { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  if (trackedReports.length) fail('REPORT_GITIGNORE_ENFORCEMENT_MISSING', trackedReports.join(','));
};
export function verifyEntry(): void {
  verifyRegistrySourceAuthority();
  verifyQualityReportIsolation();
  if (existsSync(resolve(ROOT, 'docs/governance/GOVERNANCE-FREEZE.json'))) fail('GENERATED_FILESET_INVALID', 'retired freeze record');
  const scripts = parseJson<{ scripts?: Record<string, string> }>('package.json').scripts ?? {};
  const publicGovernance = Object.keys(scripts).filter((name) => name === 'quality:check' || name.startsWith('audit:') || name.startsWith('governance:') || name === 'ci:full' || name.startsWith('exam:')).sort(byteCompare);
  if (JSON.stringify(publicGovernance) !== JSON.stringify(['audit:build', 'audit:projection:check', 'quality:check'])) fail('ENTRY_CONTRACT_MISMATCH', `public commands ${publicGovernance.join(',')}`);
  if (scripts['audit:build'] !== 'node --import tsx scripts/audit/governance.ts build'
    || scripts['audit:projection:check'] !== 'node --import tsx scripts/audit/governance.ts projection'
    || scripts['quality:check'] !== 'node --import tsx scripts/audit/governance.ts quality') fail('ENTRY_CONTRACT_MISMATCH', 'command identity');
}
type ParsedLaw = Omit<Law, 'source' | 'contractRefs'>;
type LawParserState = { domain: string; headingId: string; headingLine: number; priorDomain: string; priorLawOrder: string };
const FORBIDDEN_DOMAINS = new Set(['common', 'shared', 'utils', 'misc', 'core2', 'platform2', 'general', 'helpers', 'temporary', 'legacy', 'compat']);
const lawSchemaValid = (raw: ParsedLaw, headingId: string, domain: string): boolean =>
  exactKeys(raw, LAW_KEYS) && raw.schemaVersion === 2 && raw.status === 'active'
  && raw.lawId === headingId && raw.capabilityDomain === domain;
const lawEvidenceValid = (raw: ParsedLaw): boolean => {
  if (!isStringArray(raw.evidenceModes) || !raw.evidenceModes.length) return false;
  const ranked = raw.evidenceModes.map((mode) => `${String(EVIDENCE.indexOf(mode)).padStart(2, '0')}:${mode}`);
  if (!sortedUnique(ranked) || raw.evidenceModes.some((mode) => !EVIDENCE.includes(mode))) return false;
  const kinds = new Set(raw.evidenceModes.map((mode) => mode.split('.')[0]));
  return raw.enforcementMode === (kinds.size > 1 ? 'composite' : [...kinds][0]);
};
const lawTextValid = (raw: ParsedLaw): boolean => cleanString(raw.summary)
  && /^(必须|只能)/u.test(raw.summary)
  && !/(建议|尽量|可能|一般|视情况|原则上)/u.test(raw.summary);
const hasContainedRedundancy = (values: readonly string[]): boolean => values.some((value, index) =>
  values.some((other, otherIndex) => index !== otherIndex && pathPatternContains(other, value)));

const lawListsValid = (raw: ParsedLaw, documentType: 'base-law' | 'functional-law'): boolean => {
  for (const field of ['appliesTo', 'excludes', 'dependsOnLawIds'] as const) {
    if (!isStringArray(raw[field]) || !sortedUnique(raw[field]) || raw[field].some((value) => !cleanString(value))) return false;
  }
  return raw.appliesTo.length > 0
    && raw.appliesTo.every(pathPatternValid)
    && !hasContainedRedundancy(raw.appliesTo)
    && !hasContainedRedundancy(raw.excludes)
    && (documentType === 'base-law' || !raw.appliesTo.includes('**/*'))
    && raw.excludes.every((value) => pathPatternValid(value)
      && raw.appliesTo.some((parent) => pathPatternContains(parent, value)));
};
const normalizedForbidden = (value: string): string => value
  .replace(/^(不得|禁止)(发生|出现|存在)?[:：]?/u, '')
  .toLocaleLowerCase('en-US').replace(/[\p{P}\p{S}\s]+/gu, '');
const lawForbiddenValid = (raw: ParsedLaw): boolean => isStringArray(raw.forbidden)
  && raw.forbidden.length > 0
  && raw.forbidden.length === new Set(raw.forbidden).size
  && raw.forbidden.every((value) => cleanString(value) && /^(不得|禁止)/u.test(value))
  && raw.forbidden.map(normalizedForbidden).length === new Set(raw.forbidden.map(normalizedForbidden)).size;

function validateLaw(raw: ParsedLaw, headingId: string, domain: string, path: string, documentType: 'base-law' | 'functional-law'): void {
  if (!lawSchemaValid(raw, headingId, domain)) fail('SOURCE_PARSE_FAILED', `${path}:${headingId}:schema`);
  if (!LAW_ID_PATTERN.test(raw.lawId) || !DOMAIN_PATTERN.test(domain) || FORBIDDEN_DOMAINS.has(domain) || !['P0', 'P1', 'P2'].includes(raw.tier)) fail('SOURCE_PARSE_FAILED', `${path}:${headingId}:identity`);
  const version = raw.lawId.match(/^(LAW-[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{3})-V([1-9][0-9]*)$/u) ?? fail('SOURCE_PARSE_FAILED', `${raw.lawId}:version`);
  const major = Number(version[2]);
  if (raw.lawId !== `LAW-${domain.toUpperCase()}-${version[1]!.split('-').at(-1)}-V${major}`) fail('SOURCE_PARSE_FAILED', `${raw.lawId}:domain`);
  if (raw.supersedesLawId !== (major === 1 ? null : `${version[1]}-V${major - 1}`)) fail('SOURCE_PARSE_FAILED', `${raw.lawId}:supersedes`);
  if (!lawEvidenceValid(raw)) fail('SOURCE_PARSE_FAILED', `${raw.lawId}:evidence`);
  if (!lawTextValid(raw)) fail('SOURCE_PARSE_FAILED', `${raw.lawId}:summary`);
  if (!lawListsValid(raw, documentType)) fail('SOURCE_PARSE_FAILED', `${raw.lawId}:scope`);
  if (!lawForbiddenValid(raw)) fail('SOURCE_PARSE_FAILED', `${raw.lawId}:forbidden`);
}

const applyDomainHeading = (
  match: RegExpExecArray,
  state: LawParserState,
  documentType: 'base-law' | 'functional-law',
  path: string,
): void => {
  if (state.headingId) fail('SOURCE_PARSE_FAILED', `${path}:orphan heading`);
  state.domain = match[1]!;
  if (documentType === 'functional-law' && state.priorDomain && byteCompare(state.priorDomain, state.domain) >= 0) {
    fail('SOURCE_PARSE_FAILED', `${path}:domain order`);
  }
  state.priorDomain = state.domain;
  state.priorLawOrder = '';
};
const applyLawHeading = (match: RegExpExecArray, state: LawParserState, line: number, path: string): void => {
  if (!state.domain || state.headingId) fail('SOURCE_PARSE_FAILED', `${path}:heading`);
  const parts = /^(LAW-(?:[A-Z0-9]+-)+)([0-9]{3})-V([1-9][0-9]*)$/u.exec(match[1]!)
    ?? fail('SOURCE_PARSE_FAILED', `${path}:heading identity`);
  const order = `${parts[1]}${parts[2]}:${String(Number(parts[3])).padStart(12, '0')}`;
  if (state.priorLawOrder && byteCompare(state.priorLawOrder, order) >= 0) fail('SOURCE_PARSE_FAILED', `${path}:law order`);
  state.priorLawOrder = order;
  state.headingId = match[1]!;
  state.headingLine = line;
};

const parseLawBlock = (lines: string[], index: number, state: LawParserState, laws: Law[], path: string, documentType: 'base-law' | 'functional-law'): number => {
  if (!state.headingId) fail('SOURCE_PARSE_FAILED', `${path}:orphan law-record`);
  let end = index + 1;
  while (end < lines.length && lines[end] !== '```') end++;
  if (end >= lines.length) fail('SOURCE_PARSE_FAILED', `${path}:unclosed law-record`);
  const rawText = lines.slice(index + 1, end).join('\n');
  rejectDuplicateJsonKeys(rawText, `${path}:${index + 2}`);
  let raw: ParsedLaw;
  try { raw = JSON.parse(rawText) as ParsedLaw; } catch { return fail('SOURCE_PARSE_FAILED', `${path}:${index + 2}`); }
  validateLaw(raw, state.headingId, state.domain, path, documentType);
  laws.push({ ...raw, source: { path, lineStart: state.headingLine, lineEnd: end + 1 }, contractRefs: [] });
  state.headingId = '';
  state.headingLine = 0;
  return end;
};

const applyLawContentLine = (input: {
  documentType: 'base-law' | 'functional-law'; index: number; laws: Law[]; lines: string[]; path: string; state: LawParserState;
}): number => {
  const line = input.lines[input.index]!;
  if (line === '') return input.index;
  const domain = /^## capabilityDomain: ([a-z0-9]+(?:-[a-z0-9]+)*)$/u.exec(line);
  if (domain) { applyDomainHeading(domain, input.state, input.documentType, input.path); return input.index; }
  const heading = /^### \[(LAW-[A-Z0-9-]+-V[1-9][0-9]*)\] .+$/u.exec(line);
  if (heading) { applyLawHeading(heading, input.state, input.index + 1, input.path); return input.index; }
  if (line === '```law-record') return parseLawBlock(input.lines, input.index, input.state, input.laws, input.path, input.documentType);
  return fail('SOURCE_PARSE_FAILED', `${input.path}:unexpected content at line ${input.index + 1}`);
};

export function parseLawSource(source: string, path: string, documentType: 'base-law' | 'functional-law', authorityLevel: 100 | 90): Law[] {
  const lines = source.split('\n');
  const laws: Law[] = [];
  const state: LawParserState = { domain: '', headingId: '', headingLine: 0, priorDomain: '', priorLawOrder: '' };
  const documentHeading = documentType === 'base-law' ? '# 基础法案' : '# 功能法案';
  const start = lawBodyStart(source, path, documentType, authorityLevel);
  if (lines[start] !== documentHeading) fail('SOURCE_PARSE_FAILED', `${path}:document heading`);
  for (let index = start + 1; index < lines.length; index++) index = applyLawContentLine({ documentType, index, laws, lines, path, state });
  if (state.headingId || !laws.length) fail('SOURCE_PARSE_FAILED', `${path}:incomplete`);
  return laws;
}
function loadLawFile(path: string, documentType: 'base-law' | 'functional-law', authorityLevel: 100 | 90): Law[] {
  return parseLawSource(text(path), path, documentType, authorityLevel);
}

export function loadLaws(): Law[] {
  const laws = [...loadLawFile(BASE, 'base-law', 100), ...loadLawFile(FUNCTIONAL, 'functional-law', 90)].sort((left, right) => byteCompare(left.lawId, right.lawId));
  const ids = laws.map((law) => law.lawId);
  if (ids.length !== new Set(ids).size) fail('SOURCE_PARSE_FAILED', 'duplicate lawId');
  const active = new Set(ids);
  for (const law of laws) if (law.dependsOnLawIds.some((lawId) => !active.has(lawId))) fail('SOURCE_PARSE_FAILED', `${law.lawId}:dependency`);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(laws.map((law) => [law.lawId, law]));
  const visit = (lawId: string): void => {
    if (visiting.has(lawId)) fail('SOURCE_PARSE_FAILED', `${lawId}:dependency cycle`);
    if (visited.has(lawId)) return;
    visiting.add(lawId);
    for (const dependency of byId.get(lawId)?.dependsOnLawIds ?? []) visit(dependency);
    visiting.delete(lawId);
    visited.add(lawId);
  };
  for (const law of laws) visit(law.lawId);
  return laws;
}

function loadManifests(laws: Law[]): Manifest[] {
  const byDomain = new Map<string, string[]>();
  for (const law of laws) byDomain.set(law.capabilityDomain, [...(byDomain.get(law.capabilityDomain) ?? []), law.lawId]);
  const paths = walk('scripts/audit/domains').filter((path) => path.endsWith('/manifest.json'));
  const manifests = paths.map((manifestPath) => {
    const raw = parseJson<Omit<Manifest, 'manifestPath'>>(manifestPath);
    if (!exactKeys(raw, MANIFEST_KEYS) || raw.schemaVersion !== 5 || raw.status !== 'active' || !DOMAIN_PATTERN.test(raw.capabilityDomain)) fail('SOURCE_PARSE_FAILED', `${manifestPath}:schema`);
    for (const field of ['lawIds', 'ownedPaths', 'observedPaths'] as const) if (!isStringArray(raw[field]) || !sortedUnique(raw[field]) || raw[field].some((value) => field === 'lawIds' ? !LAW_ID_PATTERN.test(value) : !pathPatternValid(value))) fail('SOURCE_PARSE_FAILED', `${manifestPath}:${field}`);
    if (raw.ownedPaths.includes('**/*')) fail('SOURCE_PARSE_FAILED', `${manifestPath}:root owner`);
    if (JSON.stringify(raw.lawIds) !== JSON.stringify((byDomain.get(raw.capabilityDomain) ?? []).sort(byteCompare))) fail('ACTIVE_LAW_DENOMINATOR_MISMATCH', raw.capabilityDomain);
    return { ...raw, manifestPath };
  }).sort((left, right) => byteCompare(left.capabilityDomain, right.capabilityDomain));
  if (manifests.length !== byDomain.size || manifests.some((manifest, index) => index > 0 && manifests[index - 1]!.capabilityDomain === manifest.capabilityDomain)) fail('ACTIVE_LAW_DENOMINATOR_MISMATCH', 'manifest domains');
  const owned = manifests.flatMap((manifest) => manifest.ownedPaths.map((path) => ({ domain: manifest.capabilityDomain, path })));
  for (let index = 0; index < owned.length; index++) for (let other = index + 1; other < owned.length; other++) if (pathPatternContains(owned[index]!.path, owned[other]!.path) || pathPatternContains(owned[other]!.path, owned[index]!.path)) fail('MULTIPLE_PRIMARY_OWNERS', `${owned[index]!.domain}/${owned[other]!.domain}`);
  return manifests;
}

type GovernanceSpec = { schemaVersion: number; specId: string; status: string; version: number; owner: string; lawIds: string[]; specKind: string; contract: unknown };
const specEnvelopeValid = (raw: GovernanceSpec, domains: ReadonlySet<string>): boolean =>
  exactKeys(raw, SPEC_KEYS) && raw.schemaVersion === 1 && raw.status === 'active'
  && concreteString(raw.specId) && Number.isInteger(raw.version) && raw.version >= 1
  && domains.has(raw.owner) && isStringArray(raw.lawIds) && raw.lawIds.length > 0
  && sortedUnique(raw.lawIds) && raw.lawIds.every((lawId) => LAW_ID_PATTERN.test(lawId)) && SPEC_KINDS.includes(raw.specKind)
  && Boolean(raw.contract) && typeof raw.contract === 'object' && !Array.isArray(raw.contract);

const validateDependencyContract = (raw: GovernanceSpec, file: string): void => {
  const contract = raw.contract as Record<string, unknown>;
  if (!exactKeys(contract, ['contractId', 'providerRepo', 'version'])
    || !concreteString(contract.contractId) || !Number.isInteger(contract.version)
    || contract.version !== raw.version || typeof contract.providerRepo !== 'string'
    || !REPO_PATTERN.test(contract.providerRepo)) fail('SOURCE_PARSE_FAILED', `${file}:cross-repo-dependency`);
};

const validateProviderContract = (raw: GovernanceSpec, file: string): void => {
  const contract = raw.contract as Record<string, unknown>;
  if (!exactKeys(contract, ['authorityArtifact', 'contractId', 'providerDomain', 'providerRepo', 'version'])
    || !concreteString(contract.contractId) || !Number.isInteger(contract.version)
    || contract.version !== raw.version || contract.providerDomain !== raw.owner
    || typeof contract.providerRepo !== 'string' || !REPO_PATTERN.test(contract.providerRepo)) {
    fail('SOURCE_PARSE_FAILED', `${file}:cross-repo-contract`);
  }
  const artifact = contract.authorityArtifact as Record<string, unknown>;
  if (!artifact || !exactKeys(artifact, ['path', 'selector']) || typeof artifact.path !== 'string'
    || !pathPatternValid(artifact.path) || !concreteString(artifact.selector)) {
    fail('SOURCE_PARSE_FAILED', `${file}:authorityArtifact`);
  }
};

const validateSpecContract = (raw: GovernanceSpec, file: string): void => {
  if (raw.specKind === 'cross-repo-dependency') validateDependencyContract(raw, file);
  else if (raw.specKind === 'cross-repo-contract') validateProviderContract(raw, file);
  else validateLocalSpecContract(raw, file);
};

const bindSpecLaws = (
  raw: GovernanceSpec,
  file: string,
  lawById: ReadonlyMap<string, Law>,
  contractRefs: Map<string, string[]>,
): void => {
  for (const lawId of raw.lawIds) {
    const law = lawById.get(lawId);
    if (!law || law.capabilityDomain !== raw.owner) fail('SOURCE_PARSE_FAILED', `${file}:${lawId}`);
    contractRefs.set(lawId, [...(contractRefs.get(lawId) ?? []), file]);
  }
};

function loadSpecs(laws: Law[], manifests: Manifest[], contractRefs: Map<string, string[]>): void {
  const lawById = new Map(laws.map((law) => [law.lawId, law]));
  const domains = new Set(manifests.map((manifest) => manifest.capabilityDomain));
  const identities = new Set<string>();
  for (const file of walk('docs/specs').filter((path) => path.endsWith('.json'))) {
    const raw = parseJson<GovernanceSpec>(file);
    if (!specEnvelopeValid(raw, domains)) fail('SOURCE_PARSE_FAILED', `${file}:schema`);
    const identity = `${raw.specId}\0${raw.version}`;
    if (identities.has(identity)) fail('SOURCE_PARSE_FAILED', `${file}:identity`);
    identities.add(identity);
    bindSpecLaws(raw, file, lawById, contractRefs);
    validateSpecContract(raw, file);
  }
}

function machineBlock(path: string, label: string): Record<string, unknown> {
  const source = text(path);
  const marker = `\`\`\`${label}\n`;
  const start = source.indexOf(marker);
  if (start < 0 || source.indexOf(marker, start + marker.length) >= 0) fail('SOURCE_PARSE_FAILED', `${path}:${label}`);
  const end = source.indexOf('\n```', start + marker.length);
  if (end < 0) fail('SOURCE_PARSE_FAILED', `${path}:${label}:unclosed`);
  const raw = source.slice(start + marker.length, end);
  rejectDuplicateJsonKeys(raw, path);
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return fail('SOURCE_PARSE_FAILED', path); }
}

type BlueprintEndpoint = { repo: string; domain: string };
type BlueprintDependencyEdge = { from: BlueprintEndpoint; to: BlueprintEndpoint; contractRef: string | null };
type BlueprintProhibitedEdge = { from: BlueprintEndpoint; to: BlueprintEndpoint; lawId: string };
const endpointSignature = (endpoint: BlueprintEndpoint): string => `${endpoint.repo}\0${endpoint.domain}`;
const edgeSignature = (edge: BlueprintDependencyEdge | BlueprintProhibitedEdge): string =>
  `${endpointSignature(edge.from)}\0${endpointSignature(edge.to)}\0${'contractRef' in edge ? edge.contractRef ?? '' : edge.lawId}`;
const validEndpoint = (value: unknown, domains: ReadonlySet<string>, remoteRepos: ReadonlySet<string>): value is BlueprintEndpoint => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !exactKeys(value, ['domain', 'repo'])) return false;
  const endpoint = value as BlueprintEndpoint;
  return DOMAIN_PATTERN.test(endpoint.domain) && (endpoint.repo === 'local' ? domains.has(endpoint.domain) : remoteRepos.has(endpoint.repo));
};
const validEdges = (
  raw: Record<string, unknown>, active: ReadonlySet<string>, blueprintLawIds: ReadonlySet<string>,
  domains: ReadonlySet<string>, refs: ReadonlySet<string>,
  dependencyRepos: ReadonlyMap<string, string>,
): boolean => {
  if (!Array.isArray(raw.dependencyEdges) || !Array.isArray(raw.prohibitedDependencyEdges)) return false;
  const allowed = raw.dependencyEdges as BlueprintDependencyEdge[];
  const prohibited = raw.prohibitedDependencyEdges as BlueprintProhibitedEdge[];
  if (allowed.some((edge) => !edge || !exactKeys(edge, ['contractRef', 'from', 'to'])
    || !validEndpoint(edge.from, domains, new Set(dependencyRepos.values())) || !validEndpoint(edge.to, domains, new Set(dependencyRepos.values()))
    || endpointSignature(edge.from) === endpointSignature(edge.to)
    || !(edge.contractRef === null || (typeof edge.contractRef === 'string' && refs.has(edge.contractRef)))
    || (edge.from.repo !== edge.to.repo && (edge.contractRef === null
      || dependencyRepos.get(edge.contractRef) !== (edge.from.repo === 'local' ? edge.to.repo : edge.from.repo))))) return false;
  if (prohibited.some((edge) => !edge || !exactKeys(edge, ['from', 'lawId', 'to'])
    || !validEndpoint(edge.from, domains, new Set(dependencyRepos.values())) || !validEndpoint(edge.to, domains, new Set(dependencyRepos.values()))
    || endpointSignature(edge.from) === endpointSignature(edge.to)
    || !active.has(edge.lawId) || !blueprintLawIds.has(edge.lawId))) return false;
  const allowedKeys = allowed.map(edgeSignature); const prohibitedKeys = prohibited.map(edgeSignature);
  if (!sortedUnique(allowedKeys) || !sortedUnique(prohibitedKeys)) return false;
  const allowedDirections = new Set(allowed.map((edge) => `${endpointSignature(edge.from)}\0${endpointSignature(edge.to)}`));
  return prohibited.every((edge) => !allowedDirections.has(`${endpointSignature(edge.from)}\0${endpointSignature(edge.to)}`));
};

export const blueprintValid = (
  raw: Record<string, unknown>,
  active: ReadonlySet<string>,
  domains: ReadonlySet<string>,
  specPaths: ReadonlySet<string>,
  dependencyRepos: ReadonlyMap<string, string>,
  lawDomains: ReadonlyMap<string, string>,
): boolean => {
  const lawIds = raw.lawIds;
  const refs = raw.contractRefs;
  return exactKeys(raw, BLUEPRINT_KEYS) && raw.schemaVersion === 1 && raw.status === 'active'
    && concreteString(raw.blueprintId) && typeof raw.owner === 'string' && domains.has(raw.owner)
    && isStringArray(lawIds) && lawIds.length > 0 && sortedUnique(lawIds)
    && lawIds.every((lawId) => active.has(lawId) && lawDomains.get(lawId) === raw.owner)
    && isStringArray(refs) && sortedUnique(refs) && refs.every((path) => specPaths.has(path))
    && validEdges(raw, active, new Set(lawIds), domains, new Set(refs), dependencyRepos);
};

function loadBlueprints(laws: Law[], manifests: Manifest[], contractRefs: Map<string, string[]>): void {
  const active = new Set(laws.map((law) => law.lawId));
  const lawDomains = new Map(laws.map((law) => [law.lawId, law.capabilityDomain]));
  const domains = new Set(manifests.map((manifest) => manifest.capabilityDomain));
  const specPaths = new Set(walk('docs/specs').filter((path) => path.endsWith('.json')));
  const dependencyRepos = new Map<string, string>();
  for (const specPath of specPaths) {
    const spec = parseJson<GovernanceSpec>(specPath);
    if (spec.specKind !== 'cross-repo-dependency') continue;
    const contract = spec.contract as { providerRepo: string };
    dependencyRepos.set(specPath, contract.providerRepo);
  }
  for (const file of walk('docs/blueprints').filter((path) => path.endsWith('.md') || path.endsWith('.json'))) {
    if (file.endsWith('.md') && !blueprintMarkdownBodyValid(text(file))) fail('SOURCE_PARSE_FAILED', `${file}:body`);
    const raw = file.endsWith('.json') ? parseJson<Record<string, unknown>>(file) : machineBlock(file, 'blueprint-record');
    if (!blueprintValid(raw, active, domains, specPaths, dependencyRepos, lawDomains)) fail('SOURCE_PARSE_FAILED', `${file}:schema`);
    for (const lawId of raw.lawIds as string[]) contractRefs.set(lawId, [...(contractRefs.get(lawId) ?? []), file]);
  }
}

export function readRegistryProjection(): Registry {
  const registry = parseJson<Registry>(REGISTRY);
  if (registry.schemaVersion !== 5 || !Array.isArray(registry.laws) || !Array.isArray(registry.domains)) {
    fail('SOURCE_PARSE_FAILED', REGISTRY);
  }
  return registry;
}

export function providerDomainForDependencySpec(specPath: string): string {
  const domains: string[] = [];
  const files = walk('docs/blueprints').filter((path) => path.endsWith('.md') || path.endsWith('.json'));
  for (const file of files) for (const edge of ((file.endsWith('.json')
    ? parseJson<Record<string, unknown>>(file) : machineBlock(file, 'blueprint-record')).dependencyEdges ?? []) as BlueprintDependencyEdge[]) {
    if (edge.contractRef !== specPath) continue;
    const remote = edge.from.repo === 'local' ? edge.to : edge.to.repo === 'local' ? edge.from : null;
    domains.push((remote ?? fail('SOURCE_PARSE_FAILED', `${file}:${specPath}:remote endpoint`)).domain);
  }
  const unique = sortedUnique([...new Set(domains)].sort(byteCompare));
  if (!unique || domains.length !== 1) fail('EXTERNAL_SURFACE_AUTHORITY_MISSING', `${specPath}:providerDomain`);
  return domains[0]!;
}

export function buildRegistry(): Registry {
  verifyRegistrySourceAuthority();
  const laws = loadLaws();
  const manifests = loadManifests(laws);
  const contractRefs = new Map<string, string[]>();
  loadSpecs(laws, manifests, contractRefs);
  loadBlueprints(laws, manifests, contractRefs);
  const projectedLaws = laws.map((law) => ({ ...law, contractRefs: [...new Set(contractRefs.get(law.lawId) ?? [])].sort(byteCompare) }));
  return {
    schemaVersion: 5,
    sourceSpec: { path: SPEC },
    lawCorpus: { baseLawPath: BASE, functionalLawPath: FUNCTIONAL },
    laws: projectedLaws,
    domains: manifests.map(({ capabilityDomain, manifestPath, lawIds, ownedPaths, observedPaths }) => ({ capabilityDomain, manifestPath, lawIds, ownedPaths, observedPaths })),
  };
}

const ownersForPath = (path: string, registry: Registry): string[] => registry.domains
  .filter((domain) => domain.ownedPaths.some((pattern) => matchesPath(pattern, path)))
  .map((domain) => domain.capabilityDomain);

export function verifyProductionOwnership(registry = buildRegistry()): void {
  for (const path of repositoryPaths()) {
    if (pathRole(path) !== 'PRODUCTION') continue;
    const owners = ownersForPath(path, registry);
    if (!owners.length) fail('UNOWNED_PRODUCTION_FILE', path);
    if (owners.length > 1) fail('MULTIPLE_PRIMARY_OWNERS', `${path}:${owners.join(',')}`);
  }
  verifyPathRoleEscalation();
}

export function writeRegistry(): void {
  const output = canonicalBytes(buildRegistry());
  mkdirSync(dirname(resolve(ROOT, REGISTRY)), { recursive: true });
  const temporary = resolve(ROOT, `${REGISTRY}.tmp-${process.pid}`);
  writeFileSync(temporary, output);
  JSON.parse(readFileSync(temporary, 'utf8'));
  renameSync(temporary, resolve(ROOT, REGISTRY));
  process.stdout.write('REGISTRY_BUILT\n');
}

export function checkProjection(): void {
  const generated = existsSync(resolve(ROOT, 'scripts/audit/generated')) ? readdirSync(resolve(ROOT, 'scripts/audit/generated')).filter((name) => !name.startsWith('.')).sort(byteCompare) : [];
  if (JSON.stringify(generated) !== JSON.stringify(['law-registry.generated.json'])) fail('GENERATED_FILESET_INVALID', generated.join(','));
  const expected = Buffer.from(canonicalBytes(buildRegistry()));
  const actual = existsSync(resolve(ROOT, REGISTRY)) ? readFileSync(resolve(ROOT, REGISTRY)) : Buffer.alloc(0);
  assertProjectionEqual(expected, actual);
  process.stdout.write('PROJECTION_CURRENT\n');
}
export function assertProjectionEqual(expected: Buffer, actual: Buffer): void {
  if (!actual.equals(expected)) fail('GENERATED_PROJECTION_STALE', REGISTRY);
}

export function gitCommit(): string {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (!validGitObjectId(commit)) fail('SOURCE_PARSE_FAILED', 'git commit');
  return commit;
}

export function diffPaths(base = 'HEAD'): Array<{ status: string; path: string }> {
  const raw = execFileSync('git', ['diff', '--name-status', '-z', base, '--'], { cwd: ROOT }).toString().split('\0').filter(Boolean);
  const changes: Array<{ status: string; path: string }> = [];
  for (let index = 0; index < raw.length;) {
    const status = raw[index++]!;
    if (status.startsWith('R') || status.startsWith('C')) {
      const oldPath = norm(raw[index++]!);
      const newPath = norm(raw[index++]!);
      if (status.startsWith('R')) changes.push({ status: 'D', path: oldPath });
      changes.push({ status: 'A', path: newPath });
    } else changes.push({ status: status[0]!, path: norm(raw[index++]!) });
  }
  const tracked = new Set(changes.map((change) => change.path));
  for (const path of execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: ROOT }).toString().split('\0').filter(Boolean).map(norm)) if (!tracked.has(path)) changes.push({ status: 'A', path });
  return changes.sort((left, right) => byteCompare(left.path, right.path) || byteCompare(left.status, right.status));
}
