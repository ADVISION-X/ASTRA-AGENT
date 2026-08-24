import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { TextDecoder } from 'node:util';
import { pathToFileURL } from 'node:url';
import { CANONICAL_ACCEPTANCE_BINDINGS, UNCLAIMED_MUTATION_SCRIPTS, type AcceptanceClaim, type CanonicalReadyPhase, validatePhaseReceipts } from './domains/audit-system/canonical-quality-plan.js';
import {
  ROOT, GovernanceError, fail, validGitObjectId, bytes, text, sha, norm, repositoryPaths,
} from './governance-runtime.js';
import {
  sortedUnique, exactKeys, canonicalValue, canonicalBytes, parseJson, isStringArray, cleanString,
  pathPatternValid, pathPatternContains, type Json,
} from './governance-json.js';
import {
  SPEC, FREEZE, BASE, FUNCTIONAL, REGISTRY, CHANGE, REPORT, EVIDENCE, verifyEntry, loadLaws, buildRegistry,
  writeRegistry, checkProjection, verifyPinnedProviderDescriptors, candidateSnapshot,
  type Level, type Law, type Manifest,
} from './governance-authority.js';
import {
  releaseCandidateBinding, releaseDynamicProofs, writeReport, writeReleaseReport, writeReleasePackage,
  type CheckResult, type EvidenceClaim, type ReleaseBinding,
} from './governance-quality.js';
export { rejectDuplicateJsonKeys } from './governance-json.js';
export {
  agentReleaseParticipants, assertStableProofFile, evidencePlan, validateQualityReport,
  validateRealProofExecutorOutputs, validateReleaseProofPackage, verifyXuanxueReleaseEvidence,
} from './governance-quality.js';

function matchPath(pattern:string,target:string){if(pattern==='**/*')return true;if(!pattern.endsWith('/**'))return target===pattern;const base=pattern.slice(0,-3);return target===base||target.startsWith(`${base}/`)}
type ChangeRecord={baseSha:string;allowedWritePaths:string[];allowedDeletePaths:string[]};
function changeRecord(){if(!existsSync(resolve(ROOT,CHANGE)))fail('CHANGE_RECORD_MISSING',CHANGE);const raw=parseJson<ChangeRecord>(CHANGE);if(!exactKeys(raw as Record<string,unknown>,['baseSha','allowedWritePaths','allowedDeletePaths'])||!validGitObjectId(raw.baseSha))fail('CHANGE_RECORD_INVALID',CHANGE);for(const key of ['allowedWritePaths','allowedDeletePaths'] as const){if(!isStringArray(raw[key])||!sortedUnique(raw[key])||raw[key].some((pattern)=>!pathPatternValid(pattern)))fail('CHANGE_RECORD_INVALID',key);for(let index=0;index<raw[key].length;index++)for(let prior=0;prior<index;prior++)if(pathPatternContains(raw[key][prior]!,raw[key][index]!)||pathPatternContains(raw[key][index]!,raw[key][prior]!))fail('CHANGE_RECORD_INVALID',`${key} overlap`)}try{execFileSync('git',['cat-file','-e',`${raw.baseSha}^{commit}`],{cwd:ROOT,stdio:'ignore'})}catch{fail('BASE_SHA_MISMATCH',raw.baseSha)}return raw}
function diffPaths(baseSha:string){const raw=execFileSync('git',['diff','--find-renames','--find-copies','--name-status','-z',baseSha,'--'],{cwd:ROOT});const parts=raw.toString().split('\0').filter(Boolean);const out:{status:string;path:string}[]=[];for(let i=0;i<parts.length;){const status=parts[i++]!;if(status.startsWith('R')||status.startsWith('C')){const oldPath=norm(parts[i++]!);const newPath=norm(parts[i++]!);if(status.startsWith('R'))out.push({status:'D',path:oldPath});out.push({status:'A',path:newPath})}else out.push({status:status[0]!,path:norm(parts[i++]!)})}const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{cwd:ROOT}).toString().split('\0').filter(Boolean).map(norm);for(const path of untracked)out.push({status:'A',path});return out.sort((left,right)=>left.path.localeCompare(right.path)||left.status.localeCompare(right.status))}
type PathRole='GOVERNANCE_AUTHORITY'|'GENERATED_REGISTRY'|'QUALITY_REPORT'|'RUNTIME_IGNORED'|'TEST_ONLY'|'HISTORY_ONLY'|'PRODUCTION';
const runtimeIgnoredPath=(path:string):boolean=>path==='node_modules'||['node_modules/','.governance/runtime/','.grasseye-local/','.playwright-cli/','output/'].some((prefix)=>path.startsWith(prefix));
const governanceAuthorityPath=(path:string):boolean=>["AGENTS.md",SPEC,FREEZE,BASE,FUNCTIONAL].includes(path)||path.startsWith('docs/blueprints/')||path.startsWith('docs/specs/')||/^scripts\/audit\/domains\/[^/]+\/manifest\.json$/u.test(path);
const testOnlyPath=(path:string):boolean=>['tests/','fixtures/','examples/','artifacts/','coverage/','scripts/acceptance/'].some((prefix)=>path.startsWith(prefix))||path.includes('/acceptance/')||path.endsWith('.acceptance.ts');
function pathRole(path:string):PathRole{if(path===REGISTRY)return'GENERATED_REGISTRY';if(path===REPORT||path.startsWith('scripts/audit/reports/'))return'QUALITY_REPORT';if(runtimeIgnoredPath(path))return'RUNTIME_IGNORED';if(governanceAuthorityPath(path))return'GOVERNANCE_AUTHORITY';if(testOnlyPath(path))return'TEST_ONLY';return path.startsWith('docs/history/')?'HISTORY_ONLY':'PRODUCTION'}
function ownerDomains(path:string,manifests:Manifest[]){return manifests.filter((manifest)=>manifest.ownedPaths.some((pattern)=>matchPath(pattern,path))).map((manifest)=>manifest.capabilityDomain)}
type HistoricalOwnerManifest={capabilityDomain:string;ownedPaths:string[]};
function baseOwnerManifests(baseSha:string):HistoricalOwnerManifest[]{
  const manifestPaths=execFileSync('git',['ls-tree','-r','--name-only',baseSha,'--','scripts/audit/domains'],{cwd:ROOT}).toString().split('\n').filter((path)=>path.endsWith('/manifest.json'));
  return manifestPaths.map((manifestPath)=>{
    let raw:HistoricalOwnerManifest;
    try{raw=JSON.parse(execFileSync('git',['show',`${baseSha}:${manifestPath}`],{cwd:ROOT}).toString('utf8')) as HistoricalOwnerManifest}catch{return fail('SOURCE_PARSE_FAILED',`historical manifest ${manifestPath}`)}
    if(typeof raw.capabilityDomain!=='string'||!isStringArray(raw.ownedPaths))fail('SOURCE_PARSE_FAILED',`historical manifest ${manifestPath}`);
    return{capabilityDomain:raw.capabilityDomain,ownedPaths:raw.ownedPaths};
  });
}
function originalOwnerDomains(path:string,manifests:HistoricalOwnerManifest[]){return manifests.filter((manifest)=>manifest.ownedPaths.some((pattern)=>matchPath(pattern,path))).map((manifest)=>manifest.capabilityDomain)}
const verifyRepositoryIndex=():void=>{if(execFileSync('git',['ls-files','-u'],{cwd:ROOT}).length)fail('SOURCE_PARSE_FAILED','unmerged index');const stages=execFileSync('git',['ls-files','--stage','-z'],{cwd:ROOT}).toString().split('\0').filter(Boolean);if(stages.some((entry)=>entry.startsWith('160000 ')))fail('SOURCE_PARSE_FAILED','submodule')};
const verifyRepositoryPath=(path:string,manifests:Manifest[],caseFolded:Map<string,string>):void=>{if(path!==path.normalize('NFC'))fail('SOURCE_PARSE_FAILED',`non-NFC repository path ${path}`);const folded=path.toLocaleLowerCase('en-US');const prior=caseFolded.get(folded);if(prior&&prior!==path)fail('SOURCE_PARSE_FAILED',`case-collision ${prior}/${path}`);caseFolded.set(folded,path);const role=pathRole(path);if(role==='RUNTIME_IGNORED')return;const absolute=resolve(ROOT,path);if(!existsSync(absolute))return;const metadata=lstatSync(absolute);if(metadata.isSymbolicLink()){const target=realpathSync(absolute);if(target!==ROOT&&!target.startsWith(`${ROOT}${sep}`))fail('SOURCE_PARSE_FAILED',`symlink escapes repository ${path}`)}else if(!metadata.isFile())fail('SOURCE_PARSE_FAILED',`special file ${path}`);if(role==='PRODUCTION'){const owners=ownerDomains(path,manifests);if(!owners.length)fail('UNOWNED_PRODUCTION_FILE',path);if(owners.length>1)fail('MULTIPLE_PRIMARY_OWNERS',`${path}:${owners.join(',')}`)}};
const verifyOriginalDeletes=(diffs:{status:string;path:string}[],baseSha:string):void=>{const manifests=baseOwnerManifests(baseSha);for(const diff of diffs.filter((item)=>item.status==='D'&&pathRole(item.path)==='PRODUCTION')){try{execFileSync('git',['cat-file','-e',`${baseSha}:${diff.path}`],{cwd:ROOT,stdio:'ignore'})}catch{fail('UNAUTHORIZED_PRODUCTION_DELETE',diff.path)}const owners=originalOwnerDomains(diff.path,manifests);if(owners.length!==1)fail(owners.length?'MULTIPLE_PRIMARY_OWNERS':'UNOWNED_PRODUCTION_FILE',diff.path)}};
const verifyProductionImports=(paths:string[]):void=>{const sources=paths.filter((path)=>pathRole(path)==='PRODUCTION'&&['.ts','.tsx','.js','.mjs','.cjs'].includes(extname(path)));for(const sourcePath of sources)for(const match of text(sourcePath).matchAll(/(?:from\s*|import\s*\(|require\s*\()\s*['"](\.\.?\/[^'"]+)['"]/gu)){const target=norm(relative(ROOT,resolve(dirname(resolve(ROOT,sourcePath)),match[1]!)));if(['TEST_ONLY','HISTORY_ONLY','QUALITY_REPORT'].includes(pathRole(target)))fail('ROLE_ESCALATION_REQUIRED',`${sourcePath}->${target}`)}};
function verifyRepositoryIntegrity(manifests:Manifest[],diffs:{status:string;path:string}[],baseSha:string){verifyRepositoryIndex();const paths=repositoryPaths();const caseFolded=new Map<string,string>();for(const path of paths)verifyRepositoryPath(path,manifests,caseFolded);verifyOriginalDeletes(diffs,baseSha);verifyProductionImports(paths)}
function dirtyTargetCheck(record:{allowedWritePaths:string[];allowedDeletePaths:string[]}){const dirty=execFileSync('git',['status','--porcelain=v1','-z','--untracked-files=all'],{cwd:ROOT}).toString().split('\0').filter(Boolean).map((entry)=>norm(entry.slice(3))).filter((path)=>[...record.allowedWritePaths,...record.allowedDeletePaths].some((pattern)=>matchPath(pattern,path)));if(dirty.length)fail('DIRTY_TARGET_NOT_AUTHORIZED',dirty.join(','))}
function scopeCheck(level:'CHANGE'|'FULL'='FULL'){const record=changeRecord();const diffs=diffPaths(record.baseSha);for(const item of diffs){const allowed=item.status==='D'?record.allowedDeletePaths:record.allowedWritePaths;if(!allowed.some((pattern)=>matchPath(pattern,item.path)))fail('SCOPE_DIFF_OUTSIDE_ALLOWED_PATHS',`${item.status} ${item.path}`)}if(diffs.some((item)=>item.path===SPEC)&&process.env.GRASSEYE_SOURCE_SPEC_AMENDMENT_AUTHORIZED!=='1')fail('SOURCE_SPEC_AMENDMENT_NOT_AUTHORIZED',SPEC);if(diffs.some((item)=>item.path===BASE||item.path===FUNCTIONAL)&&process.env.GRASSEYE_LAW_AMENDMENT_AUTHORIZED!=='1')fail('LAW_AMENDMENT_NOT_AUTHORIZED','active law');if(level==='FULL'){const registry=buildRegistry();verifyRepositoryIntegrity(registry.domains.map((domain)=>({...domain,schemaVersion:3,status:'active',manifestPath:domain.manifestPath} as Manifest)),diffs,record.baseSha);verifyPinnedProviderDescriptors();checkProjection();}console.log(`SCOPE_OK ${diffs.length}`);return diffs}
const DOMAIN_READY_SCRIPTS: Record<string, string[]> = Object.freeze({
  'ai-input-gateway': ['audit:ai-input-gateway:enforce'],
  'app-shell-ui': ['audit:app-shell-ui:enforce'],
  'architecture-boundary': ['audit:architecture-boundary:enforce'],
  'audit-system': ['audit:system:enforce'],
  'audit-truth': ['audit:truth:enforce'],
  'capability-governance': ['audit:capability-governance:enforce'],
  'code-purity': ['audit:code-purity:enforce'],
  'forensics-persistence-capability': ['audit:forensics-persistence-capability:enforce'],
  'local-app-shell': ['audit:local-app-shell:enforce'],
  'local-browser-session': ['audit:local-browser-session:enforce'],
  'project-governance': ['audit:integrity:test'],
  'runtime-log-spine': ['audit:runtime-log-spine:enforce'],
  'startup-entrypoint': ['audit:startup-entrypoint:enforce'],
  'system-security': ['audit:system-security:enforce'],
  'workbench-api-boundary': ['audit:workbench-api-boundary:enforce'],
  'xuanxue-ai-production-localization-contract': ['audit:xuanxue-ai-production-localization-contract:enforce'],
  'xuanxue-ai-production': ['audit:xuanxue-ai-production:enforce'],
});

const qualityRunDirectory = () => {
  const requested = process.env.GRASSEYE_QUALITY_OUTPUT_DIR?.trim();
  if (requested) {
    const absolute = resolve(requested);
    mkdirSync(absolute, { recursive: true });
    return absolute;
  }
  return mkdtempSync(resolve(tmpdir(), 'grasseye-quality-'));
};

const orderedModes = (modes: string[]) => EVIDENCE.filter((mode) => new Set(modes).has(mode));

function writeEvidence(path: string, value: Json) {
  writeFileSync(path, canonicalBytes(value), { mode: 0o600 });
  return sha(bytes(path));
}

function registeredLaws(): Law[] {
  const raw = parseJson<{ laws: Law[] }>(REGISTRY);
  if (!raw || !Array.isArray(raw.laws) || raw.laws.some((law) =>
    !law || typeof law.lawId !== 'string' || typeof law.capabilityDomain !== 'string' || !Array.isArray(law.evidenceModes))) {
    fail('GENERATED_PROJECTION_STALE', REGISTRY);
  }
  return raw.laws;
}

const normalizeClaims = (claims: readonly EvidenceClaim[]): EvidenceClaim[] => claims
  .map((current) => ({
    lawId: current.lawId,
    clauseId: current.clauseId,
    evidenceModes: orderedModes(current.evidenceModes),
  }))
  .sort((left, right) => left.lawId.localeCompare(right.lawId) || left.clauseId.localeCompare(right.clauseId));

const validateClaims = (claims: readonly EvidenceClaim[], laws: readonly Law[]): void => {
  const lawById = new Map(laws.map((law) => [law.lawId, law]));
  const seen = new Set<string>();
  for (const current of claims) {
    const law = lawById.get(current.lawId) ?? fail('CI_EVIDENCE_CLAIM_INVALID', current.lawId);
    const key = current.lawId + '|' + current.clauseId;
    if (current.clauseId !== current.lawId.toLowerCase() + '-requirement' || seen.has(key)) {
      fail('CI_EVIDENCE_CLAIM_INVALID', key);
    }
    seen.add(key);
    if (!current.evidenceModes.length || current.evidenceModes.some((mode) => !law.evidenceModes.includes(mode))) {
      fail('CI_EVIDENCE_CLAIM_INVALID', current.lawId + ':' + current.evidenceModes.join(','));
    }
  }
};

const claimDomains = (claims: readonly EvidenceClaim[], laws: readonly Law[]): string[] => {
  const lawById = new Map(laws.map((law) => [law.lawId, law.capabilityDomain]));
  return [...new Set(claims.flatMap((current) => lawById.get(current.lawId) ?? []))].sort();
};

function runCheck(
  pm: string,
  script: string,
  phaseId: CanonicalReadyPhase,
  requestedClaims: readonly EvidenceClaim[],
  laws: Law[],
  runDirectory: string,
): CheckResult {
  const claims = normalizeClaims(requestedClaims);
  validateClaims(claims, laws);
  const domains = claimDomains(claims, laws);
  const command = pm + ' run ' + script;
  const startedAt = new Date().toISOString();
  const before = candidateSnapshot();
  const result = spawnSync(pm, ['run', script], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
  });
  const after = candidateSnapshot();
  if (before !== after) fail('CANDIDATE_DRIFT', script);
  const outcome = result.status === 0 ? 'PASS' : 'FAIL';
  const finding = outcome === 'PASS' ? null : 'PROJECT_CHECK_FAILED';
  const lawIds = claims.map((current) => current.lawId).sort();
  const evidenceModes = orderedModes(claims.flatMap((current) => current.evidenceModes));
  const receiptPath = resolve(runDirectory, script.replace(/[^a-zA-Z0-9_.-]/gu, '_') + '.result.json');
  const receipt = {
    schemaVersion: 2,
    phaseId,
    testId: 'script:' + script,
    lawIds,
    evidenceModes,
    claims,
    command,
    startedAt,
    finishedAt: new Date().toISOString(),
    candidateSnapshot: after,
    exitStatus: result.status,
    signal: result.signal ?? null,
    outcome,
    finding,
    stdoutSha256: sha(result.stdout ?? ''),
    stderrSha256: sha(result.stderr ?? ''),
  };
  const receiptHash = writeEvidence(receiptPath, receipt);
  if (outcome === 'FAIL') process.stderr.write(String(result.stderr || result.stdout || command + ' failed\n'));
  return {
    phaseId,
    checkId: 'script:' + script,
    domains,
    lawIds,
    evidenceModes,
    claims,
    command,
    outcome,
    evidenceRef: receiptPath + '#sha256=' + receiptHash,
    finding,
  };
}

function runInternalGate(
  phaseId: CanonicalReadyPhase,
  checkId: string,
  runDirectory: string,
  verify: () => void,
  evidencePath?: string,
): CheckResult {
  const startedAt = new Date().toISOString();
  const before = candidateSnapshot();
  let outcome: 'PASS' | 'FAIL' = 'PASS';
  let finding: string | null = null;
  let detail = '';
  try {
    verify();
  } catch (error) {
    outcome = 'FAIL';
    finding = error instanceof GovernanceError ? error.code : 'GOVERNANCE_INTERNAL_ERROR';
    detail = error instanceof Error ? error.message : String(error);
  }
  const after = candidateSnapshot();
  if (before !== after) fail('CANDIDATE_DRIFT', checkId);
  const receiptPath = resolve(runDirectory, checkId + '.result.json');
  const receipt = {
    schemaVersion: 2,
    phaseId,
    testId: checkId,
    lawIds: [],
    evidenceModes: [],
    claims: [],
    command: 'internal:' + checkId,
    startedAt,
    finishedAt: new Date().toISOString(),
    candidateSnapshot: after,
    exitStatus: outcome === 'PASS' ? 0 : 1,
    signal: null,
    outcome,
    finding,
    detail,
    evidencePath: evidencePath ?? null,
    evidenceSha256: evidencePath ? sha(bytes(evidencePath)) : null,
  };
  const receiptHash = writeEvidence(receiptPath, receipt);
  return {
    phaseId,
    checkId,
    domains: [],
    lawIds: [],
    evidenceModes: [],
    claims: [],
    command: 'internal:' + checkId,
    outcome,
    evidenceRef: receiptPath + '#sha256=' + receiptHash,
    finding,
  };
}

function missingScriptCheck(
  pm: string,
  script: string,
  phaseId: CanonicalReadyPhase,
  requestedClaims: readonly EvidenceClaim[],
  laws: Law[],
  runDirectory: string,
): CheckResult {
  const claims = normalizeClaims(requestedClaims);
  validateClaims(claims, laws);
  const domains = claimDomains(claims, laws);
  const lawIds = claims.map((current) => current.lawId).sort();
  const evidenceModes = orderedModes(claims.flatMap((current) => current.evidenceModes));
  const receiptPath = resolve(runDirectory, script.replace(/[^a-zA-Z0-9_.-]/gu, '_') + '.result.json');
  const receipt = {
    schemaVersion: 2,
    phaseId,
    testId: 'script:' + script,
    lawIds,
    evidenceModes,
    claims,
    command: pm + ' run ' + script,
    outcome: 'FAIL',
    finding: 'PROJECT_CHECK_MISSING',
  };
  const receiptHash = writeEvidence(receiptPath, receipt);
  return {
    phaseId,
    checkId: 'script:' + script,
    domains,
    lawIds,
    evidenceModes,
    claims,
    command: pm + ' run ' + script,
    outcome: 'FAIL',
    evidenceRef: receiptPath + '#sha256=' + receiptHash,
    finding: 'PROJECT_CHECK_MISSING',
  };
}

type ExecuteCheck = (
  script: string,
  phaseId: CanonicalReadyPhase,
  claims: readonly EvidenceClaim[],
) => boolean;

const staticClaimsForDomains = (laws: readonly Law[], domains: readonly string[]): EvidenceClaim[] =>
  laws.filter((law) => domains.includes(law.capabilityDomain)).flatMap((law) => {
    const evidenceModes = law.evidenceModes.filter((mode) => mode.startsWith('static.'));
    return evidenceModes.length ? [{
      lawId: law.lawId,
      clauseId: law.lawId.toLowerCase() + '-requirement',
      evidenceModes,
    }] : [];
  });

const runOwnerChecks = (
  scriptsByDomain: Record<string, string[]>,
  execute: ExecuteCheck,
  laws: readonly Law[],
): boolean => {
  const scripts = new Map<string, Set<string>>();
  for (const [domain, domainScripts] of Object.entries(scriptsByDomain)) {
    for (const script of domainScripts) {
      if (script === 'audit:system:enforce' || script === 'audit:integrity:test') continue;
      const domains = scripts.get(script) ?? new Set<string>();
      domains.add(domain);
      scripts.set(script, domains);
    }
  }
  for (const [script, domains] of [...scripts.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (!execute(script, 'generated-plan-runner', staticClaimsForDomains(laws, [...domains]))) return false;
  }
  return true;
};

function runAcceptanceChecks(execute: ExecuteCheck): boolean {
  for (const binding of CANONICAL_ACCEPTANCE_BINDINGS) {
    const claimsByClause = new Map<string, EvidenceClaim>();
    for (const current of binding.claims as readonly AcceptanceClaim[]) {
      const key = `${current.lawId}|${current.clauseId}`;
      const existing = claimsByClause.get(key);
      claimsByClause.set(key, {
        lawId: current.lawId,
        clauseId: current.clauseId,
        evidenceModes: [...(existing?.evidenceModes ?? []), current.evidenceFacet],
      });
    }
    const claims = [...claimsByClause.values()];
    if (!execute(binding.script, 'acceptance-runner', claims)) return false;
  }
  return true;
}

const sameLawDenominator = (left: readonly Law[], right: readonly Law[]): boolean =>
  JSON.stringify(left.map((law) => law.lawId).sort()) === JSON.stringify(right.map((law) => law.lawId).sort());

const runReadyFoundation = (
  laws: Law[],
  runDirectory: string,
  execute: ExecuteCheck,
  results: CheckResult[],
): boolean => {
  const entry = runInternalGate('codex-entry-gate', 'phase:codex-entry-gate', runDirectory, verifyEntry, 'AGENTS.md');
  results.push(entry);
  if (entry.outcome === 'FAIL') return false;
  if (!execute('typecheck', 'typecheck', [])) return false;
  if (!execute('audit:integrity:test', 'audit-self-test', staticClaimsForDomains(laws, ['project-governance']))) return false;
  if (!execute('audit:system:enforce', 'audit-system-mutants', staticClaimsForDomains(laws, ['audit-system']))) return false;
  for (const script of UNCLAIMED_MUTATION_SCRIPTS) {
    if (!execute(script, 'audit-system-mutants', [])) return false;
  }
  const artifacts = runInternalGate(
    'build-audit-artifacts', 'phase:build-audit-artifacts', runDirectory, checkProjection, REGISTRY,
  );
  results.push(artifacts);
  if (artifacts.outcome === 'FAIL') return false;
  const corpus = runInternalGate(
    'active-law-full-coverage',
    'phase:active-law-full-coverage',
    runDirectory,
    () => {
      if (!sameLawDenominator(loadLaws(), laws)) fail('LAW_DENOMINATOR_MISMATCH', 'active law corpus');
    },
    BASE,
  );
  results.push(corpus);
  return corpus.outcome === 'PASS';
};

const runReadyCompletion = (
  execute: ExecuteCheck,
  results: CheckResult[],
  runDirectory: string,
): boolean => {
  const projection = runInternalGate(
    'generated-artifact-truth', 'phase:generated-artifact-truth', runDirectory, checkProjection, REGISTRY,
  );
  results.push(projection);
  if (projection.outcome === 'FAIL') return false;
  if (!runAcceptanceChecks(execute)) return false;
  const phaseFindings = validatePhaseReceipts(results);
  if (phaseFindings.length) fail('CI_GATE_SET_REGRESSION', phaseFindings.join(','));
  return true;
};

function projectChecks(level: Level, laws: Law[], runDirectory: string): CheckResult[] {
  const pkg = parseJson<{ scripts?: Record<string, string> }>('package.json');
  const scripts = pkg.scripts ?? {};
  const pm = existsSync(resolve(ROOT, 'pnpm-lock.yaml')) ? 'pnpm' : 'npm';
  const results: CheckResult[] = [];
  const execute: ExecuteCheck = (script, phaseId, claims) => {
    const receipt = typeof scripts[script] === 'string'
      ? runCheck(pm, script, phaseId, claims, laws, runDirectory)
      : missingScriptCheck(pm, script, phaseId, claims, laws, runDirectory);
    results.push(receipt);
    return receipt.outcome === 'PASS';
  };

  if (level === 'CHANGE') {
    execute('audit:integrity:test', 'codex-entry-gate', staticClaimsForDomains(laws, ['project-governance']));
    return results;
  }
  if (!runReadyFoundation(laws, runDirectory, execute, results)) return results;
  if (!runOwnerChecks(DOMAIN_READY_SCRIPTS, execute, laws)) return results;
  runReadyCompletion(execute, results, runDirectory);
  return results;
}

const assertCandidateSnapshot=(initial:string,message:string):void=>{if(candidateSnapshot()!==initial)fail('CANDIDATE_DRIFT',message)};
const assertReleaseBinding=(initial:string,binding:ReleaseBinding,message:string):void=>{assertCandidateSnapshot(initial,message);if(releaseCandidateBinding().candidateId!==binding.candidateId)fail('CANDIDATE_DRIFT',message)};
function quality(level:Level){if(!['CHANGE','READY','RELEASE'].includes(level))fail('ENTRY_CONTRACT_MISMATCH',`invalid level ${level}`);verifyEntry();const initialCandidate=candidateSnapshot();const diffs=scopeCheck(level==='CHANGE'?'CHANGE':'FULL');const laws=level==='CHANGE'?registeredLaws():buildRegistry().laws;const releaseBinding=level==='RELEASE'?releaseCandidateBinding():null;const runDirectory=qualityRunDirectory();const checks=projectChecks(level,laws,runDirectory);assertCandidateSnapshot(initialCandidate,'candidate changed while checks ran');if(level==='READY'){const record=changeRecord();const report=writeReport(laws,record.baseSha,checks,diffs.map((item)=>item.path),runDirectory);assertCandidateSnapshot(initialCandidate,'candidate changed before READY verdict');if(report.outcome!=='PASS')fail('QUALITY_FINDINGS_PRESENT',report.path);console.log(`READY_REPORT ${report.path}`)}else if(level==='RELEASE'){const binding=releaseBinding!;const proofs=releaseDynamicProofs();const record=changeRecord();const report=writeReleaseReport(laws,record.baseSha,binding,checks,diffs.map((item)=>item.path),proofs,runDirectory);assertReleaseBinding(initialCandidate,binding,'candidate changed before RELEASE package');if(report.outcome!=='PASS')fail('RELEASE_EVIDENCE_MISSING',report.path);const packagePath=writeReleasePackage(binding,report.hash,report.dynamicProofHashes);assertReleaseBinding(initialCandidate,binding,'candidate changed after RELEASE package');console.log(`RELEASE_PACKAGE ${packagePath}`)}else{const failed=checks.find((check)=>check.outcome==='FAIL');if(failed)fail('PROJECT_CHECK_FAILED',failed.finding??failed.command)}console.log(`${level}_PASS`)}
function main(){const [command,arg]=process.argv.slice(2);if(command==='entry'){verifyEntry();if(arg!=='READ_ONLY'){const record=changeRecord();dirtyTargetCheck(record)}console.log('ENTRY_OK');return}if(command==='scope'){scopeCheck();return}if(command==='build'){writeRegistry();return}if(command==='projection'){checkProjection();return}if(command==='quality'){quality((arg??'CHANGE') as Level);return}fail('ENTRY_CONTRACT_MISMATCH','unknown command')}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{main()}catch(error){const e=error as Error;console.error(`${e instanceof GovernanceError?e.code:'GOVERNANCE_INTERNAL_ERROR'} ${e.message}`);process.exitCode=1}}
