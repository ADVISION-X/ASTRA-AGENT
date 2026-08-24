import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import type { CanonicalReadyPhase } from './domains/audit-system/canonical-quality-plan.js';
import {
  ROOT, fail, validGitObjectId, bytes, utf8, sha, norm, repositoryIdentity, walk,
} from './governance-runtime.js';
import {
  sortedUnique, exactKeys, canonicalBytes, parseJson, isStringArray, cleanString, type Json,
} from './governance-json.js';
import {
  FREEZE, BASE, FUNCTIONAL, REGISTRY, REPORT, EVIDENCE, type Law,
} from './governance-authority.js';

export type EvidenceClaim = { lawId: string; clauseId: string; evidenceModes: string[] };
export type CheckResult = {
  phaseId: CanonicalReadyPhase;
  checkId: string;
  domains: string[];
  lawIds: string[];
  evidenceModes: string[];
  claims: EvidenceClaim[];
  command: string;
  outcome: 'PASS' | 'FAIL';
  evidenceRef: string;
  finding: string | null;
};

const orderedModes = (modes: string[]) => EVIDENCE.filter((mode) => new Set(modes).has(mode));
const matchPath = (pattern: string, target: string): boolean => {
  if (pattern === '**/*') return true;
  if (!pattern.endsWith('/**')) return target === pattern;
  const base = pattern.slice(0, -3);
  return target === base || target.startsWith(`${base}/`);
};

function lawIntersects(law:Pick<Law,'appliesTo'|'excludes'|'contractRefs'>,diffs:string[]){const included=diffs.some((path)=>law.appliesTo.some((pattern)=>matchPath(pattern,path))&&!law.excludes.some((pattern)=>matchPath(pattern,path)));return included||law.contractRefs.some((ref)=>diffs.includes(ref.path))}
export function evidencePlan(law:Pick<Law,'appliesTo'|'excludes'|'contractRefs'|'evidenceModes'>,diffs:string[],level:'READY'|'RELEASE'){if(!lawIntersects(law,diffs))return{applicableEvidenceModes:[] as string[],deferredEvidenceModes:[] as string[]};const staticAndExam=orderedModes(law.evidenceModes.filter((mode)=>!mode.startsWith('dynamic.')));const dynamic=orderedModes(law.evidenceModes.filter((mode)=>mode.startsWith('dynamic.')));return{applicableEvidenceModes:level==='RELEASE'?[...staticAndExam,...dynamic]:staticAndExam,deferredEvidenceModes:level==='READY'?dynamic:[]}}
export type ReleaseBinding={candidateId:string;gitCommit:string;freezeSha256:string;baseLawSha256:string;functionalLawSha256:string;registrySha256:string};
export function releaseCandidateBinding():ReleaseBinding{const dirty=execFileSync('git',['status','--porcelain=v1','-z','--untracked-files=all'],{cwd:ROOT});if(dirty.length)fail('RELEASE_CANDIDATE_UNBOUND','RELEASE requires a clean committed tree');const gitCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT}).toString().trim();const baseLawSha256=sha(bytes(BASE));const functionalLawSha256=sha(bytes(FUNCTIONAL));const registrySha256=sha(bytes(REGISTRY));const candidateId=sha(canonicalBytes({gitCommit,baseLawSha256,functionalLawSha256,registrySha256}));return{candidateId,gitCommit,freezeSha256:sha(bytes(FREEZE)),baseLawSha256,functionalLawSha256,registrySha256}}
type ProofFileIdentity={dev:number;ino:number;size:number;mtimeMs:number};
type VerifiedDynamicProof={lawIds:string[];evidenceModes:string[];evidenceRefs:string[];dynamicProofEvidenceRefs:string[];hashes:string[]};
type ProofRunner=(script:string,args:string[],env:NodeJS.ProcessEnv)=>{status:number|null;stdout:string;stderr:string};
const realProofRunner:ProofRunner=(script,args,env)=>{const result=spawnSync(process.execPath,['--import','tsx',script,...args],{cwd:ROOT,encoding:'utf8',env,maxBuffer:16*1024*1024});return{status:result.status,stdout:result.stdout??'',stderr:result.stderr??''}};
type RuntimeReceipt={device_id:string;device_epoch:number;worker_session_id:string;worker_session_epoch:number;runtime_attestation_receipt_hash:string};
type ReleaseEvidenceInput={contractManifestHash:string;extensionId:string;runtimeReceipt:RuntimeReceipt};
type ProofBindingInput={run_id:string;candidate_hash:string;contract_manifest_hash:string;provider_record_hashes:Record<string,string>;cloud_terminal_job_ids:string[]};
type ReleaseEvidenceDocument=ReleaseEvidenceInput&{schemaVersion:string;releaseMode:string;workbenchUrl:string;realRunRoot:string;dynamicProofRunId:string;evidenceRefs:unknown[]};
type ProofBindingDocument=ProofBindingInput&{schema_version:string};
type ChromeProofOutput={marker:string;status:string;contractManifestHash:string;extensionId:string;workerSessionId:string;runtimeAttestationReceiptHash:string};
type ContinuationActor={extensionId?:string;deviceId:string;deviceEpoch:number;workerSessionId:string;workerSessionEpoch:number;runtimeAttestationReceiptHash:string};
type ContinuationProof={schemaVersion:string;runId:string;candidateHash:string;contractManifestHash:string;predecessor:ContinuationActor;successor:ContinuationActor;terminalReceiptHashes:Record<string,string>;capturedAt:string};
type ProviderProofOutput={marker:string;runRoot:string;runId:string;candidateHash:string;contractManifestHash:string;recordCount:number;continuationReceipt:ContinuationProof;cloudTerminalJobCount:number;status:string};
const validChromeProof=(chrome:ChromeProofOutput,evidence:ReleaseEvidenceInput):boolean=>exactKeys(chrome as Record<string,unknown>,['marker','status','contractManifestHash','extensionId','workerSessionId','runtimeAttestationReceiptHash'])&&chrome.marker==='[ACCEPTANCE][XUANXUE-AI-PRODUCTION][REAL-CHROME-V6]'&&chrome.status==='CHROME_VERIFIED'&&chrome.contractManifestHash===evidence.contractManifestHash&&chrome.extensionId===evidence.extensionId&&chrome.workerSessionId===evidence.runtimeReceipt.worker_session_id&&chrome.runtimeAttestationReceiptHash===evidence.runtimeReceipt.runtime_attestation_receipt_hash;
const validProviderProof=(provider:ProviderProofOutput,binding:ProofBindingInput,runRoot:string):boolean=>exactKeys(provider as Record<string,unknown>,['marker','runRoot','runId','candidateHash','contractManifestHash','recordCount','continuationReceipt','cloudTerminalJobCount','status'])&&provider.marker==='[ACCEPTANCE][XUANXUE-AI-PRODUCTION][REAL-PROVIDER]'&&provider.status==='PASS'&&resolve(provider.runRoot)===resolve(runRoot)&&provider.runId===binding.run_id&&provider.candidateHash===binding.candidate_hash&&provider.contractManifestHash===binding.contract_manifest_hash&&provider.recordCount===Object.keys(binding.provider_record_hashes).length&&provider.cloudTerminalJobCount===binding.cloud_terminal_job_ids.length;
const validPredecessor=(actor:ContinuationActor,evidence:ReleaseEvidenceInput):boolean=>exactKeys(actor as Record<string,unknown>,['extensionId','deviceId','deviceEpoch','workerSessionId','workerSessionEpoch','runtimeAttestationReceiptHash'])&&actor.extensionId===evidence.extensionId&&actor.deviceId===evidence.runtimeReceipt.device_id&&actor.deviceEpoch===evidence.runtimeReceipt.device_epoch&&actor.workerSessionId===evidence.runtimeReceipt.worker_session_id&&actor.workerSessionEpoch===evidence.runtimeReceipt.worker_session_epoch&&actor.runtimeAttestationReceiptHash===evidence.runtimeReceipt.runtime_attestation_receipt_hash;
const validSuccessor=(actor:ContinuationActor,predecessor:ContinuationActor):boolean=>exactKeys(actor as Record<string,unknown>,['deviceId','deviceEpoch','workerSessionId','workerSessionEpoch','runtimeAttestationReceiptHash'])&&actor.deviceId===predecessor.deviceId&&actor.deviceEpoch===predecessor.deviceEpoch&&cleanString(actor.workerSessionId)&&actor.workerSessionId!==predecessor.workerSessionId&&Number.isInteger(actor.workerSessionEpoch)&&actor.workerSessionEpoch>predecessor.workerSessionEpoch&&/^sha256:[a-f0-9]{64}$/u.test(actor.runtimeAttestationReceiptHash);
const validTerminalHashes=(hashes:Record<string,string>,ids:string[]):boolean=>Boolean(hashes)&&typeof hashes==='object'&&!Array.isArray(hashes)&&JSON.stringify(Object.keys(hashes))===JSON.stringify(ids)&&Object.values(hashes).every((hash)=>/^sha256:[a-f0-9]{64}$/u.test(hash));
const validContinuationProof=(continuation:ContinuationProof,evidence:ReleaseEvidenceInput,binding:ProofBindingInput):boolean=>exactKeys(continuation as Record<string,unknown>,['schemaVersion','runId','candidateHash','contractManifestHash','predecessor','successor','terminalReceiptHashes','capturedAt'])&&continuation.schemaVersion==='xuanxue-ai-provider-continuation-proof.v1'&&continuation.runId===binding.run_id&&continuation.candidateHash===binding.candidate_hash&&continuation.contractManifestHash===binding.contract_manifest_hash&&validPredecessor(continuation.predecessor,evidence)&&validSuccessor(continuation.successor,continuation.predecessor)&&validTerminalHashes(continuation.terminalReceiptHashes,binding.cloud_terminal_job_ids)&&Number.isFinite(Date.parse(continuation.capturedAt))&&Math.abs(Date.now()-Date.parse(continuation.capturedAt))<=30*60*1000;
export function validateRealProofExecutorOutputs(chromeRaw:string,providerRaw:string,evidence:ReleaseEvidenceInput,binding:ProofBindingInput,runRoot:string):ContinuationProof{
  let chrome:ChromeProofOutput;let provider:ProviderProofOutput;try{chrome=JSON.parse(chromeRaw) as ChromeProofOutput;provider=JSON.parse(providerRaw) as ProviderProofOutput}catch{return fail('RELEASE_EVIDENCE_MISSING','real proof executor output is not exact JSON')}
  if(!chrome||!validChromeProof(chrome,evidence))fail('RELEASE_EVIDENCE_MISSING','real Chrome executor output does not exactly match the bound artifacts');
  if(!provider||!validProviderProof(provider,binding,runRoot))fail('RELEASE_EVIDENCE_MISSING','real Provider executor output does not exactly match the bound artifacts');
  if(!provider.continuationReceipt||!validContinuationProof(provider.continuationReceipt,evidence,binding))fail('RELEASE_EVIDENCE_MISSING','real Provider continuation receipt does not exactly bind predecessor, successor and terminal receipts');
  return provider.continuationReceipt;
}
export function verifyXuanxueReleaseEvidence(evidencePath:string,runner:ProofRunner=realProofRunner):VerifiedDynamicProof{
  const absolute=resolve(evidencePath);
  const runRoot=resolve(ROOT,'.grasseye-local');
  const bindingPath=resolve(runRoot,'xuanxue-ai-production-dynamic-proof-binding.v2.json');
  let evidenceRaw:Buffer;let bindingRaw:Buffer;let evidence:ReleaseEvidenceDocument;let binding:ProofBindingDocument;let evidenceIdentity:ProofFileIdentity;let bindingIdentity:ProofFileIdentity;
  try{const evidenceStat=lstatSync(absolute);const bindingStat=lstatSync(bindingPath);evidenceIdentity={dev:evidenceStat.dev,ino:evidenceStat.ino,size:evidenceStat.size,mtimeMs:evidenceStat.mtimeMs};bindingIdentity={dev:bindingStat.dev,ino:bindingStat.ino,size:bindingStat.size,mtimeMs:bindingStat.mtimeMs};evidenceRaw=readFileSync(absolute);bindingRaw=readFileSync(bindingPath);evidence=JSON.parse(utf8.decode(evidenceRaw)) as ReleaseEvidenceDocument;binding=JSON.parse(utf8.decode(bindingRaw)) as ProofBindingDocument}catch(error){return fail('RELEASE_EVIDENCE_MISSING',`invalid real proof authority: ${error instanceof Error?error.message:String(error)}`)}
  if(!evidence||!exactKeys(evidence as Record<string,unknown>,['schemaVersion','contractManifestHash','extensionId','releaseMode','workbenchUrl','realRunRoot','dynamicProofRunId','runtimeReceipt','evidenceRefs'])||evidenceRaw!.toString('utf8')!==canonicalBytes(evidence))fail('RELEASE_EVIDENCE_MISSING','real Chrome evidence must be exact canonical V6 evidence');
  if(!binding||binding.schema_version!=='xuanxue-ai-production-dynamic-proof-binding.v2'||evidence.dynamicProofRunId!==binding.run_id)fail('RELEASE_EVIDENCE_MISSING','real Chrome evidence is not bound to the production proof run');
  const snapshotDirectory=mkdtempSync(resolve(tmpdir(),'grasseye-release-proof-'));const evidenceSnapshot=resolve(snapshotDirectory,'evidence.json');const bindingSnapshot=resolve(snapshotDirectory,'binding.json');
  let results:Array<{status:number|null;stdout:string;stderr:string}>;let continuation:ContinuationProof;
  try{writeFileSync(evidenceSnapshot,evidenceRaw!,{mode:0o600});writeFileSync(bindingSnapshot,bindingRaw!,{mode:0o600});const commands=[
    {script:'scripts/acceptance/xuanxue-ai-production.real-chrome.ts',args:['--evidence',evidenceSnapshot,'--binding',bindingSnapshot],env:{...process.env}},
    {script:'scripts/acceptance/xuanxue-ai-production.real-provider.ts',args:['--evidence',evidenceSnapshot,'--binding',bindingSnapshot],env:{...process.env,XUANXUE_AI_REAL_RUN_ROOT:runRoot}},
  ];results=commands.map((command)=>{const result=runner(command.script,command.args,command.env);if(result.status!==0)fail('RELEASE_EVIDENCE_MISSING',`real proof executor failed: ${command.script}: ${result.stderr||result.stdout}`);return result});continuation=validateRealProofExecutorOutputs(results[0]!.stdout,results[1]!.stdout,evidence,binding,runRoot)}finally{rmSync(snapshotDirectory,{recursive:true,force:true})}
  assertStableProofFile(absolute,evidenceRaw!,evidenceIdentity!);assertStableProofFile(bindingPath,bindingRaw!,bindingIdentity!);
  const bindingHash=sha(bindingRaw!);const evidenceHash=sha(evidenceRaw!);const continuationRaw=canonicalBytes(continuation);const continuationHash=sha(continuationRaw);const continuationDirectory=resolve(ROOT,'.governance/runtime/release-evidence');const continuationPath=resolve(continuationDirectory,`${continuationHash}.json`);mkdirSync(continuationDirectory,{recursive:true});if(existsSync(continuationPath)){if(!readFileSync(continuationPath).equals(Buffer.from(continuationRaw)))fail('CANDIDATE_DRIFT','provider continuation proof hash collision')}else{const temporary=`${continuationPath}.tmp-${process.pid}`;writeFileSync(temporary,continuationRaw,{mode:0o600});renameSync(temporary,continuationPath)}
  const artifacts=[{evidenceRef:`${absolute}#sha256=${evidenceHash}`,hash:evidenceHash},{evidenceRef:`${bindingPath}#sha256=${bindingHash}`,hash:bindingHash},{evidenceRef:`${continuationPath}#sha256=${continuationHash}`,hash:continuationHash}].sort((left,right)=>left.evidenceRef.localeCompare(right.evidenceRef));
  return{lawIds:['LAW-XUANXUE-AI-PRODUCTION-001-V7'],evidenceModes:['dynamic.browser','dynamic.service','dynamic.provider','dynamic.authorization'],evidenceRefs:artifacts.map((artifact)=>artifact.evidenceRef),dynamicProofEvidenceRefs:artifacts.map((artifact)=>artifact.evidenceRef),hashes:artifacts.map((artifact)=>artifact.hash)};
}
export function assertStableProofFile(path:string,before:Buffer,identity:ProofFileIdentity):void{let after:Buffer;let stat:ReturnType<typeof lstatSync>;try{stat=lstatSync(path);after=readFileSync(path)}catch{return fail('RELEASE_EVIDENCE_MISSING','real proof artifact disappeared during verification')}if(stat.dev!==identity.dev||stat.ino!==identity.ino||stat.size!==identity.size||stat.mtimeMs!==identity.mtimeMs||!after.equals(before))fail('CANDIDATE_DRIFT','real proof artifact changed during verification')}
export function releaseDynamicProofs(){const legacy=process.env.GRASSEYE_RELEASE_DYNAMIC_PROOF_PATHS;if(legacy!==undefined)fail('RELEASE_EVIDENCE_MISSING','caller-authored Dynamic Proof wrappers are retired');const evidencePath=process.env.GRASSEYE_RELEASE_XUANXUE_REAL_CHROME_EVIDENCE?.trim();return evidencePath?[verifyXuanxueReleaseEvidence(evidencePath)]:[]}
type ReleaseParticipant={contractId:string;contractVersion:number;repo:string;releaseSha256:string};
type ReleaseProofPackage={schemaVersion:number;candidateId:string;gitCommit:string;freezeSha256:string;baseLawSha256:string;functionalLawSha256:string;registrySha256:string;lawQualityReportSha256:string;dynamicProofHashes:string[];crossRepoParticipants:ReleaseParticipant[]};
const validReleaseParticipant=(participant:ReleaseParticipant):boolean=>{const repo=typeof participant?.repo==='string'?repositoryIdentity(participant.repo):'';return Boolean(participant)&&exactKeys(participant as Record<string,unknown>,['contractId','contractVersion','repo','releaseSha256'])&&cleanString(participant.contractId)&&Number.isInteger(participant.contractVersion)&&participant.contractVersion>=1&&repo.split('/').length===2&&/^[a-f0-9]{64}$/u.test(participant.releaseSha256)};
const validateReleaseParticipants=(participants:ReleaseParticipant[]):void=>{let prior='';for(const participant of participants){if(!validReleaseParticipant(participant))fail('RELEASE_EVIDENCE_MISSING','invalid RELEASE participant');const key=canonicalBytes([participant.contractId,participant.contractVersion,repositoryIdentity(participant.repo)]);if(key<=prior)fail('RELEASE_EVIDENCE_MISSING','unsorted RELEASE participants');prior=key}};
export function validateReleaseProofPackage(value:unknown):void{
  if(!value||typeof value!=='object'||Array.isArray(value))fail('RELEASE_EVIDENCE_MISSING','invalid RELEASE proof package');const proof=value as ReleaseProofPackage;
  if(!exactKeys(proof as Record<string,unknown>,['schemaVersion','candidateId','gitCommit','freezeSha256','baseLawSha256','functionalLawSha256','registrySha256','lawQualityReportSha256','dynamicProofHashes','crossRepoParticipants'])||proof.schemaVersion!==1||!/^[a-f0-9]{64}$/u.test(proof.candidateId)||!validGitObjectId(proof.gitCommit))fail('RELEASE_EVIDENCE_MISSING','invalid RELEASE proof package');
  for(const field of ['freezeSha256','baseLawSha256','functionalLawSha256','registrySha256','lawQualityReportSha256'] as const)if(!/^[a-f0-9]{64}$/u.test(proof[field]))fail('RELEASE_EVIDENCE_MISSING',`invalid RELEASE package ${field}`);
  if(!isStringArray(proof.dynamicProofHashes)||!sortedUnique(proof.dynamicProofHashes)||proof.dynamicProofHashes.some((hash)=>!/^[a-f0-9]{64}$/u.test(hash))||!Array.isArray(proof.crossRepoParticipants))fail('RELEASE_EVIDENCE_MISSING','invalid RELEASE package evidence');validateReleaseParticipants(proof.crossRepoParticipants);
}
const requiredReleaseParticipantIdentities = (): Array<Omit<ReleaseParticipant, 'releaseSha256'>> =>
  walk('docs/specs').filter((path) => path.endsWith('.spec.json')).flatMap((path) => {
    const spec = parseJson<{ specKind?: unknown; contract?: Record<string, unknown> }>(path);
    if (spec.specKind !== 'contract-pin' || !spec.contract) return [];
    const { contractId, version, providerRepo } = spec.contract;
    const validatedContractId = cleanString(contractId)
      ? contractId
      : fail('RELEASE_EVIDENCE_MISSING', `invalid direct participant pin ${path}`);
    const validatedVersion = Number.isInteger(version) && (version as number) >= 1
      ? version as number
      : fail('RELEASE_EVIDENCE_MISSING', `invalid direct participant pin ${path}`);
    const validatedProviderRepo = cleanString(providerRepo)
      ? providerRepo
      : fail('RELEASE_EVIDENCE_MISSING', `invalid direct participant pin ${path}`);
    return [{ contractId: validatedContractId, contractVersion: validatedVersion, repo: repositoryIdentity(validatedProviderRepo) }];
  }).sort((left, right) => canonicalBytes([left.contractId, left.contractVersion, left.repo])
    .localeCompare(canonicalBytes([right.contractId, right.contractVersion, right.repo])));

export function agentReleaseParticipants(
  requested = process.env.GRASSEYE_RELEASE_CROSS_REPO_PARTICIPANTS,
): ReleaseParticipant[] {
  const expected = requiredReleaseParticipantIdentities();
  if (requested === undefined) {
    if (expected.length > 0) fail('RELEASE_EVIDENCE_MISSING', 'direct provider RELEASE participants are required');
    return [];
  }
  let participants: ReleaseParticipant[];
  try {
    participants = JSON.parse(requested) as ReleaseParticipant[];
  } catch {
    return fail('RELEASE_EVIDENCE_MISSING', 'invalid RELEASE participant JSON');
  }
  if (!Array.isArray(participants)) fail('RELEASE_EVIDENCE_MISSING', 'RELEASE participants must be an array');
  validateReleaseParticipants(participants);
  const actual = participants.map(({ contractId, contractVersion, repo }) => ({
    contractId,
    contractVersion,
    repo: repositoryIdentity(repo),
  }));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail('RELEASE_EVIDENCE_MISSING', 'RELEASE participants do not match direct contract pins');
  }
  return participants;
}
type QualityLawItem={lawId:string;applicableEvidenceModes:string[];deferredEvidenceModes:string[];outcome:'PASS'|'FAIL';evidenceRefs:string[];findings:string[]};
type QualityReport={schemaVersion:number;level:'READY'|'RELEASE';baseSha:string;candidateId:string|null;registrySha256:string;laws:QualityLawItem[];outcome:'PASS'|'FAIL'};
const validOrderedModes=(modes:string[]):boolean=>JSON.stringify(modes)===JSON.stringify(orderedModes(modes));
const validQualityItemCollections=(item:QualityLawItem):boolean=>isStringArray(item.applicableEvidenceModes)&&validOrderedModes(item.applicableEvidenceModes)&&isStringArray(item.deferredEvidenceModes)&&validOrderedModes(item.deferredEvidenceModes)&&isStringArray(item.evidenceRefs)&&sortedUnique(item.evidenceRefs)&&item.evidenceRefs.every(cleanString)&&isStringArray(item.findings)&&sortedUnique(item.findings)&&item.findings.every((finding)=>/^[A-Z][A-Z0-9_]*$/u.test(finding));
const validateQualityItem=(item:QualityLawItem|undefined,lawId:string,level:'READY'|'RELEASE'):void=>{if(!item||!exactKeys(item as Record<string,unknown>,['lawId','applicableEvidenceModes','deferredEvidenceModes','outcome','evidenceRefs','findings'])||item.lawId!==lawId||!['PASS','FAIL'].includes(item.outcome)||!validQualityItemCollections(item))return fail('QUALITY_REPORT_INVALID',`law ${lawId}`);const evidenceRequired=Boolean(item.applicableEvidenceModes.length||item.deferredEvidenceModes.length);if(item.outcome==='PASS'&&((evidenceRequired&&!item.evidenceRefs.length)||item.findings.length))fail('QUALITY_REPORT_INVALID',`law ${lawId}`);if(item.outcome==='FAIL'&&!item.findings.length)fail('QUALITY_REPORT_INVALID',`law ${lawId}`);if(level==='RELEASE'&&item.deferredEvidenceModes.length)fail('QUALITY_REPORT_INVALID',`law ${lawId}`)};
const validateQualityReportHeader=(report:QualityReport,level:'READY'|'RELEASE'):void=>{if(!exactKeys(report as Record<string,unknown>,['schemaVersion','level','baseSha','candidateId','registrySha256','laws','outcome'])||report.schemaVersion!==1||report.level!==level||!validGitObjectId(report.baseSha)||!/^[a-f0-9]{64}$/u.test(report.registrySha256)||!['PASS','FAIL'].includes(report.outcome))fail('QUALITY_REPORT_INVALID','top-level')};
const validateQualityCandidate=(report:QualityReport,level:'READY'|'RELEASE'):void=>{if(level==='READY'&&report.candidateId!==null)fail('QUALITY_REPORT_INVALID','READY candidateId');if(level==='RELEASE'&&(typeof report.candidateId!=='string'||!/^[a-f0-9]{64}$/u.test(report.candidateId)))fail('QUALITY_REPORT_INVALID','RELEASE candidateId')};
export function validateQualityReport(value:unknown,laws:Pick<Law,'lawId'>[],level:'READY'|'RELEASE'){
  if(!value||typeof value!=='object'||Array.isArray(value))fail('QUALITY_REPORT_INVALID','top-level');const report=value as QualityReport;
  validateQualityReportHeader(report,level);validateQualityCandidate(report,level);
  if(!Array.isArray(report.laws)||report.laws.length!==laws.length)fail('QUALITY_REPORT_INVALID','law denominator');for(let index=0;index<laws.length;index++)validateQualityItem(report.laws[index],laws[index]!.lawId,level);
  const findings=report.laws.filter((item)=>item.outcome==='FAIL');const outcome=findings.length?'FAIL':'PASS';if(report.outcome!==outcome)fail('QUALITY_REPORT_INVALID','aggregate outcome');
}
const checkClaimForLaw = (check: CheckResult, lawId: string): EvidenceClaim | undefined =>
  check.claims.find((claim) => claim.lawId === lawId);

const uniqueSorted = (values: readonly string[]): string[] =>
  [...new Set(values)].sort();

const missingEvidenceFindings = (modes: readonly string[]): string[] =>
  modes.map((mode) => 'REQUIRED_EVIDENCE_MODE_UNPROVEN_' + mode.replace(/[^A-Za-z0-9]/gu, '_').toUpperCase());

export function writeReport(
  laws: Law[],
  baseSha: string,
  checks: CheckResult[],
  diffs: string[],
  runDirectory: string,
) {
  const registrySha = sha(bytes(REGISTRY));
  const items = laws.map((law) => {
    const { applicableEvidenceModes: applicable, deferredEvidenceModes: deferred } = evidencePlan(law, diffs, 'READY');
    const relevant = (applicable.length || deferred.length)
      ? checks.flatMap((check) => {
        const claim = checkClaimForLaw(check, law.lawId);
        return claim ? [{ check, claim }] : [];
      })
      : [];
    const covered = new Set(relevant
      .filter(({ check }) => check.outcome === 'PASS')
      .flatMap(({ claim }) => claim.evidenceModes));
    const missing = applicable.filter((mode) => !covered.has(mode));
    const failed = relevant.filter(({ check }) => check.outcome === 'FAIL');
    const findings = uniqueSorted([
      ...missingEvidenceFindings(missing),
      ...failed.flatMap(({ check }) => check.finding ?? []),
    ]);
    const evidenceRefs = uniqueSorted(relevant
      .filter(({ check }) => check.outcome === 'PASS')
      .map(({ check }) => check.evidenceRef));
    return {
      lawId: law.lawId,
      applicableEvidenceModes: applicable,
      deferredEvidenceModes: deferred,
      outcome: findings.length ? 'FAIL' as const : 'PASS' as const,
      evidenceRefs,
      findings,
    };
  });
  const report = {
    schemaVersion: 1,
    level: 'READY' as const,
    baseSha,
    candidateId: null,
    registrySha256: registrySha,
    laws: items,
    outcome: items.some((item) => item.outcome === 'FAIL') ? 'FAIL' as const : 'PASS' as const,
  };
  validateQualityReport(report, laws, 'READY');
  const reportPath = process.env.GRASSEYE_QUALITY_REPORT_MODE === 'external'
    ? resolve(runDirectory, 'law-quality.report.json')
    : resolve(ROOT, REPORT);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, canonicalBytes(report), { mode: 0o600 });
  return { outcome: report.outcome, path: reportPath, hash: sha(readFileSync(reportPath)) };
}

export function writeReleaseReport(
  laws: Law[],
  baseSha: string,
  binding: ReleaseBinding,
  checks: CheckResult[],
  diffs: string[],
  proofs: ReturnType<typeof releaseDynamicProofs>,
  runDirectory: string,
) {
  const referencedDynamicProofHashes = new Set<string>();
  const items = laws.map((law) => {
    const { applicableEvidenceModes: applicable } = evidencePlan(law, diffs, 'RELEASE');
    const staticChecks = checks.flatMap((check) => {
      const claim = checkClaimForLaw(check, law.lawId);
      return claim ? [{ check, claim }] : [];
    });
    const lawProofs = proofs.filter((proof) => proof.lawIds.includes(law.lawId));
    const covered = new Set([
      ...staticChecks.filter(({ check }) => check.outcome === 'PASS').flatMap(({ claim }) => claim.evidenceModes),
      ...lawProofs.flatMap((proof) => proof.evidenceModes),
    ]);
    const missing = applicable.filter((mode) => !covered.has(mode));
    const failed = staticChecks.filter(({ check }) => check.outcome === 'FAIL');
    const findings = uniqueSorted([
      ...missingEvidenceFindings(missing),
      ...failed.flatMap(({ check }) => check.finding ?? []),
    ]);
    const evidenceRefs = uniqueSorted([
      ...staticChecks.filter(({ check }) => check.outcome === 'PASS').map(({ check }) => check.evidenceRef),
      ...lawProofs.flatMap((proof) => proof.evidenceRefs),
    ]);
    for (const proof of lawProofs) {
      for (let index = 0; index < proof.dynamicProofEvidenceRefs.length; index++) {
        if (evidenceRefs.includes(proof.dynamicProofEvidenceRefs[index]!)) {
          referencedDynamicProofHashes.add(proof.hashes[index]!);
        }
      }
    }
    return {
      lawId: law.lawId,
      applicableEvidenceModes: applicable,
      deferredEvidenceModes: [] as string[],
      outcome: findings.length ? 'FAIL' as const : 'PASS' as const,
      evidenceRefs,
      findings,
    };
  });
  const report = {
    schemaVersion: 1,
    level: 'RELEASE' as const,
    baseSha,
    candidateId: binding.candidateId,
    registrySha256: binding.registrySha256,
    laws: items,
    outcome: items.some((item) => item.outcome === 'FAIL') ? 'FAIL' as const : 'PASS' as const,
  };
  validateQualityReport(report, laws, 'RELEASE');
  const reportPath = process.env.GRASSEYE_QUALITY_REPORT_MODE === 'external'
    ? resolve(runDirectory, 'law-quality.report.json')
    : resolve(ROOT, REPORT);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, canonicalBytes(report), { mode: 0o600 });
  return {
    outcome: report.outcome,
    path: reportPath,
    hash: sha(readFileSync(reportPath)),
    dynamicProofHashes: [...referencedDynamicProofHashes].sort(),
  };
}

export function writeReleasePackage(binding:ReleaseBinding,reportHash:string,dynamicProofHashes:string[]){const proofPackage={schemaVersion:1,candidateId:binding.candidateId,gitCommit:binding.gitCommit,freezeSha256:binding.freezeSha256,baseLawSha256:binding.baseLawSha256,functionalLawSha256:binding.functionalLawSha256,registrySha256:binding.registrySha256,lawQualityReportSha256:reportHash,dynamicProofHashes,crossRepoParticipants:agentReleaseParticipants()};validateReleaseProofPackage(proofPackage);const directory=resolve(ROOT,'.governance/runtime/releases',binding.candidateId);mkdirSync(directory,{recursive:true});const destination=resolve(directory,'proof-package.json');const temporary=`${destination}.tmp-${process.pid}`;writeFileSync(temporary,canonicalBytes(proofPackage),{mode:0o600});renameSync(temporary,destination);return destination}
