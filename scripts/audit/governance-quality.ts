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
  FREEZE, BASE, FUNCTIONAL, REGISTRY, REPORT, EVIDENCE, buildRegistry, candidateSnapshot, type Law,
} from './governance-authority.js';
import { readBrowserProofJournal } from '../../src/lib/browser/exact-target/browser-proof-journal.js';
import { enforceBindingVerdict } from './binding-verdict.js';
import {
  requireAuthorizedProductionDelete, requireCandidateStable, requireExactProjection, requireProductionImportRole,
  requireReleaseCandidateBound, requireReleaseEvidence, requireSinglePrimaryOwner,
} from './governance-invariants.js';

export type EvidenceClaim = { lawId: string; clauseId: string; evidenceModes: string[] };
export type EvidenceAssertion = { assertionId: string; passed: boolean; evidenceRefs: string[] };
export type EvidenceFinding = { code: string; evidenceRefs: string[] };
export type EvidenceTargetSet = { queryRef: string; count: number; sha256: string };
export type QualityComponent = {
  bindingId: string;
  component: 'static' | 'exam' | 'proof';
  executorId: string;
  evidenceModes: string[];
  outcome: 'PASS' | 'FAIL';
  targetSet: EvidenceTargetSet | null;
  assertions: EvidenceAssertion[];
  findings: EvidenceFinding[];
};
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
  lawId: string | null;
  component: QualityComponent | null;
};

const orderedModes = (modes: string[]) => EVIDENCE.filter((mode) => new Set(modes).has(mode));

export function evidencePlan(law:Pick<Law,'evidenceModes'>,_diffs:string[],level:'READY'|'RELEASE'){const staticAndExam=orderedModes(law.evidenceModes.filter((mode)=>!mode.startsWith('dynamic.')));const dynamic=orderedModes(law.evidenceModes.filter((mode)=>mode.startsWith('dynamic.')));return{applicableEvidenceModes:level==='RELEASE'?[...staticAndExam,...dynamic]:staticAndExam,deferredEvidenceModes:level==='READY'?dynamic:[]}}
export type ReleaseBinding={candidateId:string;gitCommit:string;freezeSha256:string;baseLawSha256:string;functionalLawSha256:string;registrySha256:string};
export function releaseCandidateBinding():ReleaseBinding{const dirty=execFileSync('git',['status','--porcelain=v1','-z','--untracked-files=all'],{cwd:ROOT});requireReleaseCandidateBound(dirty.length===0);const gitCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT}).toString().trim();const baseLawSha256=sha(bytes(BASE));const functionalLawSha256=sha(bytes(FUNCTIONAL));const registrySha256=sha(bytes(REGISTRY));const candidateId=sha(canonicalBytes({gitCommit,baseLawSha256,functionalLawSha256,registrySha256}));requireReleaseCandidateBound(true,candidateId);return{candidateId,gitCommit,freezeSha256:sha(bytes(FREEZE)),baseLawSha256,functionalLawSha256,registrySha256}}
type ProofFileIdentity={dev:number;ino:number;size:number;mtimeMs:number};
type VerifiedDynamicProof={bindingId:string;proofId:string;lawId:string;evidenceModes:string[];candidateId:string;assertions:EvidenceAssertion[];findings:EvidenceFinding[];outcome:'PASS'|'FAIL';hashes:string[]};
type VerifiedXuanxueProof={lawIds:string[];evidenceModes:string[];evidenceRefs:string[];dynamicProofEvidenceRefs:string[];hashes:string[];continuation:ContinuationProof};
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
export function verifyXuanxueReleaseEvidence(evidencePath:string,runner:ProofRunner=realProofRunner):VerifiedXuanxueProof{
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
  return{lawIds:['LAW-XUANXUE-AI-PRODUCTION-001-V7'],evidenceModes:['dynamic.browser','dynamic.service','dynamic.provider','dynamic.authorization','dynamic.recovery','dynamic.performance'],evidenceRefs:artifacts.map((artifact)=>artifact.evidenceRef),dynamicProofEvidenceRefs:artifacts.map((artifact)=>artifact.evidenceRef),hashes:artifacts.map((artifact)=>artifact.hash),continuation};
}
export function assertStableProofFile(path:string,before:Buffer,identity:ProofFileIdentity):void{let after:Buffer;let stat:ReturnType<typeof lstatSync>;try{stat=lstatSync(path);after=readFileSync(path)}catch{return fail('RELEASE_EVIDENCE_MISSING','real proof artifact disappeared during verification')}if(stat.dev!==identity.dev||stat.ino!==identity.ino||stat.size!==identity.size||stat.mtimeMs!==identity.mtimeMs||!after.equals(before))fail('CANDIDATE_DRIFT','real proof artifact changed during verification')}
const dynamicFailure=(binding:{bindingId:string;proofId:string;evidenceModes:string[]},lawId:string,candidateId:string,detail:string):VerifiedDynamicProof=>{const hash=sha(canonicalBytes({bindingId:binding.bindingId,candidateId,detail}));const ref=`dynamic:proof-executor#${encodeURIComponent(binding.bindingId)}:${hash}`;return{bindingId:binding.bindingId,proofId:binding.proofId,lawId,evidenceModes:binding.evidenceModes,candidateId,assertions:[{assertionId:`${binding.proofId}.observed`,passed:false,evidenceRefs:[ref]}],findings:[{code:'RELEASE_EVIDENCE_MISSING',evidenceRefs:[ref]}],outcome:'FAIL',hashes:[hash]}};
type ProofRequest=Readonly<{bindingId:string;proofId:string;lawId:string;mode:string;candidateId:string}>;
type DynamicProofResult=Omit<VerifiedDynamicProof,'hashes'> & {schemaVersion:1};
type ProofObservation=Readonly<{assertionId:string;locator:string;value:unknown}>;
type ProofObserver=(request:ProofRequest)=>Promise<ProofObservation>;
const dynamicEvidenceRef=(locator:string,selector:string,value:unknown):string=>`dynamic:${encodeURIComponent(locator)}#${encodeURIComponent(selector)}:${sha(canonicalBytes(value))}`;
const processObservation=(script:string):Readonly<{locator:string;value:Record<string,unknown>}>=>{const result=realProofRunner(script,[],{...process.env});if(result.status!==0)throw new Error(`${script}:${result.stderr||result.stdout}`);let value:unknown;try{value=JSON.parse(result.stdout.trim())}catch{throw new Error(`${script}:output is not exact JSON`)}if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${script}:output is not an object`);return{locator:script,value:value as Record<string,unknown>}};
const workbenchUrl=():string=>{const value=process.env.GRASSEYE_RELEASE_WORKBENCH_URL?.trim();if(!value)throw new Error('GRASSEYE_RELEASE_WORKBENCH_URL is required');const url=new URL(value);if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||url.username||url.password||url.search||url.hash)throw new Error('workbench URL must be exact loopback HTTP');return url.origin};
const readJson=async(url:string,init?:RequestInit):Promise<{status:number;body:unknown}>=>{const response=await fetch(url,init);let body:unknown=null;try{body=await response.json()}catch{body=null}return{status:response.status,body}};
const serviceObservation=async():Promise<Readonly<{base:string;health:{status:number;body:unknown};mode:{status:number;body:unknown};pairing:{status:number;body:unknown};observedAt:string}>>=>{
  const base=workbenchUrl();
  const health=await readJson(`${base}/api/health`);
  const mode=await readJson(`${base}/api/mode`);
  const pairing=await readJson(`${base}/api/browser-authority/pairing`);
  if(health.status!==200||mode.status!==200||pairing.status!==200)throw new Error('Shell diagnostic routes are not reachable');
  return{base,health,mode,pairing,observedAt:new Date().toISOString()};
};
const recentRecoveryObservation=():unknown=>{
  const journal=resolve('.grasseye-local/browser/proof-events.ndjson');
  const envelopes=readBrowserProofJournal(journal);
  const cutoff=Date.now()-30*60*1000;
  const revoked=envelopes.findIndex(({event})=>event.eventType==='LIFECYCLE'&&event.phase==='AUTHORITY_REVOKED'&&Date.parse(event.recordedAt)>=cutoff);
  const recovered=revoked<0?undefined:envelopes.slice(revoked+1).find(({event})=>event.eventType==='LIFECYCLE'&&event.phase==='AUTHENTICATED');
  if(!recovered)throw new Error('no recent durable revoke-to-authenticate recovery chain');
  return{journal,revokedSequence:envelopes[revoked]!.sequence,recoveredSequence:recovered.sequence,observedAt:new Date().toISOString()};
};
const xuanxueObservation=(request:ProofRequest):VerifiedXuanxueProof=>{
  const path=process.env.GRASSEYE_RELEASE_XUANXUE_REAL_CHROME_EVIDENCE?.trim();
  if(!path)throw new Error('GRASSEYE_RELEASE_XUANXUE_REAL_CHROME_EVIDENCE is required');
  const proof=verifyXuanxueReleaseEvidence(path);
  if(!proof.evidenceModes.includes(request.mode))throw new Error(`xuanxue executor did not observe ${request.mode}`);
  return proof;
};
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const shellObserver=(assertionId:string,predicate:(snapshot:Awaited<ReturnType<typeof serviceObservation>>)=>boolean):ProofObserver=>async()=>{const snapshot=await serviceObservation();if(!predicate(snapshot))throw new Error(`${assertionId}:service predicate failed`);return{assertionId,locator:`${snapshot.base}/api/health|mode|pairing`,value:snapshot}};
const localBrowserObserver=(assertionId:string,predicate:(value:Record<string,unknown>)=>boolean):ProofObserver=>async()=>{const observation=processObservation('scripts/acceptance/local-browser.real-chrome.ts');if(observation.value.status!=='CHROME_VERIFIED'||!predicate(observation.value))throw new Error(`${assertionId}:browser predicate failed`);return{assertionId,locator:observation.locator,value:observation.value}};
const xuanxueObserver=(assertionId:string,predicate:(proof:VerifiedXuanxueProof)=>boolean):ProofObserver=>async(request)=>{const proof=xuanxueObservation(request);if(!predicate(proof))throw new Error(`${assertionId}:xuanxue predicate failed`);return{assertionId,locator:'xuanxue-ai-production-real-proof',value:proof}};
const PROOF_OBSERVERS:Readonly<Record<string,ProofObserver>>=Object.freeze({
  'local.app.shell.001.v4.dynamic-browser.proof':async()=>{const observation=processObservation('scripts/acceptance/app-shell-ui.real-chrome.ts');if(observation.value.marker!=='[ACCEPTANCE][APP-SHELL-UI][REAL-CHROME-PHYSICAL-CLEANUP]'||observation.value.status!=='CHROME_VERIFIED'||typeof observation.value.observationPath!=='string'||typeof observation.value.screenshotPath!=='string')throw new Error('app shell physical cleanup proof invalid');return{assertionId:'local.app.shell.001.v4.chrome-layout',locator:observation.locator,value:observation.value}},
  'local.app.shell.001.v4.dynamic-service.proof':shellObserver('local.app.shell.001.v4.shell-contract',(snapshot)=>typeof object(snapshot.health.body).status==='string'&&typeof object(snapshot.mode.body).mode==='object'),
  'local.app.shell.003.v1.dynamic-service.proof':shellObserver('local.app.shell.003.v1.diagnostic-shell',(snapshot)=>Array.isArray(object(snapshot.health.body).components)&&object(snapshot.pairing.body).pairingSecret!==undefined),
  'local.browser.session.001.v4.dynamic-browser.proof':localBrowserObserver('local.browser.session.001.v4.authenticated',(value)=>typeof value.extensionId==='string'&&Number.isInteger(value.authenticatedSequence)),
  'local.browser.session.002.v4.dynamic-browser.proof':localBrowserObserver('local.browser.session.002.v4.release-bound',(value)=>typeof value.candidateHash==='string'&&Number.isInteger(value.claimedSequence)),
  'local.browser.session.003.v6.dynamic-browser.proof':localBrowserObserver('local.browser.session.003.v6.exact-target',(value)=>Number(value.claimedSequence)>Number(value.authenticatedSequence)),
  'local.browser.session.004.v5.dynamic-recovery.proof':async()=>({assertionId:'local.browser.session.004.v5.recovery-chain',locator:'.grasseye-local/browser/proof-events.ndjson',value:recentRecoveryObservation()}),
  'local.browser.session.005.v4.dynamic-browser.proof':localBrowserObserver('local.browser.session.005.v4.command-complete',(value)=>Number(value.commandSequence)>Number(value.claimedSequence)),
  'local.browser.session.006.v2.dynamic-browser.proof':localBrowserObserver('local.browser.session.006.v2.revoked',(value)=>Number(value.revokedSequence)>Number(value.commandSequence)),
  'startup.entrypoint.001.v4.dynamic-service.proof':shellObserver('startup.entrypoint.001.v4.initialized',(snapshot)=>typeof object(snapshot.health.body).checkedAt==='string'&&Array.isArray(object(snapshot.health.body).components)),
  'startup.entrypoint.002.v1.dynamic-service.proof':shellObserver('startup.entrypoint.002.v1.fixed-port',(snapshot)=>new URL(snapshot.base).port==='4173'&&typeof object(snapshot.health.body).sourceFingerprint==='string'),
  'workbench.api.boundary.001.v4.dynamic-browser.proof':async()=>{const base=workbenchUrl();const rejected=await readJson(`${base}/api/xuanxue-ai-production/pause`,{method:'POST',headers:{Origin:'https://example.invalid','content-type':'application/json'},body:JSON.stringify({orderId:'release-proof'})});if(rejected.status!==403)throw new Error('external xuanxue ingress was not rejected');return{assertionId:'workbench.api.boundary.001.v4.external-rejected',locator:`${base}/api/xuanxue-ai-production/pause`,value:rejected}},
  'xuanxue.ai.production.001.v7.dynamic-authorization.proof':xuanxueObserver('xuanxue.ai.production.001.v7.authorization',(proof)=>Boolean(proof.continuation.predecessor.extensionId)&&/^sha256:/u.test(proof.continuation.predecessor.runtimeAttestationReceiptHash)),
  'xuanxue.ai.production.001.v7.dynamic-browser.proof':xuanxueObserver('xuanxue.ai.production.001.v7.browser',(proof)=>proof.dynamicProofEvidenceRefs.length>=3),
  'xuanxue.ai.production.001.v7.dynamic-performance.proof':xuanxueObserver('xuanxue.ai.production.001.v7.performance',(proof)=>Object.keys(proof.continuation.terminalReceiptHashes).length>0&&Number.isFinite(Date.parse(proof.continuation.capturedAt))),
  'xuanxue.ai.production.001.v7.dynamic-provider.proof':xuanxueObserver('xuanxue.ai.production.001.v7.provider',(proof)=>proof.hashes.length===3&&Object.keys(proof.continuation.terminalReceiptHashes).length>0),
  'xuanxue.ai.production.001.v7.dynamic-recovery.proof':xuanxueObserver('xuanxue.ai.production.001.v7.recovery',(proof)=>proof.continuation.successor.workerSessionId!==proof.continuation.predecessor.workerSessionId&&proof.continuation.successor.workerSessionEpoch>proof.continuation.predecessor.workerSessionEpoch),
  'xuanxue.ai.production.001.v7.dynamic-service.proof':xuanxueObserver('xuanxue.ai.production.001.v7.service',(proof)=>JSON.stringify(proof.lawIds)===JSON.stringify(['LAW-XUANXUE-AI-PRODUCTION-001-V7'])&&proof.evidenceRefs.length===3),
});
const proofResult=(request:ProofRequest,observation:ProofObservation):DynamicProofResult=>{const ref=dynamicEvidenceRef(observation.locator,`${request.bindingId}|${request.candidateId}`,observation.value);return{schemaVersion:1,bindingId:request.bindingId,proofId:request.proofId,lawId:request.lawId,evidenceModes:[request.mode],candidateId:request.candidateId,assertions:[{assertionId:observation.assertionId,passed:true,evidenceRefs:[ref]}],findings:[],outcome:'PASS'}};
const failedProofResult=(request:ProofRequest,error:unknown):DynamicProofResult=>{const detail=error instanceof Error?error.message:String(error);const ref=dynamicEvidenceRef(request.lawId,`${request.bindingId}|failure`,{candidateId:request.candidateId,detail});return{schemaVersion:1,bindingId:request.bindingId,proofId:request.proofId,lawId:request.lawId,evidenceModes:[request.mode],candidateId:request.candidateId,assertions:[{assertionId:`${request.proofId}.observed`,passed:false,evidenceRefs:[ref]}],findings:[{code:'RELEASE_EVIDENCE_MISSING',evidenceRefs:[ref]}],outcome:'FAIL'}};
export async function runReleaseDynamicProof(request:ProofRequest):Promise<DynamicProofResult>{
  if(!/^[a-f0-9]{64}$/u.test(request.candidateId)||!request.bindingId||!request.proofId||!request.lawId||!request.mode.startsWith('dynamic.'))throw new Error('invalid release proof binding');
  const observer=PROOF_OBSERVERS[request.bindingId];if(!observer)return failedProofResult(request,new Error(`proof observer missing: ${request.bindingId}`));
  try{return proofResult(request,await observer(request))}catch(error){return failedProofResult(request,error)}
}
const exactProofRef=(proofRef:string,law:Law,binding:{evidenceModes:string[]}):boolean=>{const [script,selector='']=proofRef.split('#');const parts=selector.split('|');return script==='scripts/audit/governance-quality.ts'&&parts[0]==='runReleaseDynamicProof'&&parts[1]===law.lawId&&parts[2]===binding.evidenceModes[0]&&binding.evidenceModes.length===1};
const verifiedDynamicProof=(parsed:DynamicProofResult,binding:{bindingId:string;proofId:string;evidenceModes:string[]},lawId:string,candidateId:string):VerifiedDynamicProof|null=>{
  const identityValid=parsed.schemaVersion===1&&parsed.bindingId===binding.bindingId&&parsed.proofId===binding.proofId&&parsed.lawId===lawId&&parsed.candidateId===candidateId&&JSON.stringify(parsed.evidenceModes)===JSON.stringify(binding.evidenceModes);
  if(!identityValid||!parsed.assertions.length||!parsed.assertions.every(validAssertion)||!parsed.findings.every(validFinding))return null;
  let verdictValid=true;try{enforceBindingVerdict({lawId,bindingId:binding.bindingId,summarySatisfied:parsed.outcome==='PASS',triggeredForbidden:parsed.findings.map((finding)=>finding.code),assertions:parsed.assertions,findingCount:parsed.findings.length})}catch{verdictValid=false}
  const failed=!verdictValid||parsed.assertions.some((assertion)=>!assertion.passed)||parsed.findings.length>0||parsed.outcome!=='PASS';
  const refs=[...parsed.assertions.flatMap((assertion)=>assertion.evidenceRefs),...parsed.findings.flatMap((finding)=>finding.evidenceRefs)];
  return{...parsed,outcome:failed?'FAIL':'PASS',hashes:[...new Set(refs.map((ref)=>ref.slice(-64)))].sort()};
};
const executeDynamicBinding=async(law:Law,binding:NonNullable<Law['enforcement']>['proofBindings'][number],candidateId:string):Promise<VerifiedDynamicProof>=>{
  try{requireReleaseEvidence(exactProofRef(binding.proofRef,law,binding),'proofRef identity mismatch')}catch{return dynamicFailure(binding,law.lawId,candidateId,'proofRef identity mismatch')}
  const parsed=await runReleaseDynamicProof({bindingId:binding.bindingId,proofId:binding.proofId,lawId:law.lawId,mode:binding.evidenceModes[0]!,candidateId});
  return verifiedDynamicProof(parsed,binding,law.lawId,candidateId)??dynamicFailure(binding,law.lawId,candidateId,'invalid proof executor output');
};
export async function releaseDynamicProofs(laws:Law[],release:ReleaseBinding):Promise<VerifiedDynamicProof[]>{
  if(process.env.GRASSEYE_RELEASE_DYNAMIC_PROOF_PATHS!==undefined)fail('RELEASE_EVIDENCE_MISSING','caller-authored Dynamic Proof wrappers are retired');
  const results:VerifiedDynamicProof[]=[];
  for(const law of [...laws].sort((left,right)=>left.lawId.localeCompare(right.lawId))){
    const bindings=[...(law.enforcement?.proofBindings??[])].sort((left,right)=>left.bindingId.localeCompare(right.bindingId));
    for(const binding of bindings)results.push(await executeDynamicBinding(law,binding,release.candidateId));
  }
  return results;
}
type DynamicProofs=Awaited<ReturnType<typeof releaseDynamicProofs>>;
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
type QualityMutant={mutantId:string;bindingId:string|null;expectedCode:string;actualCode:string;evidenceRefs:string[];outcome:'PASS'|'FAIL'};
type QualityLawItem={lawId:string;declaredEvidenceModes:string[];requiredEvidenceModes:string[];deferredEvidenceModes:string[];scopeEvidenceRefs:string[];components:QualityComponent[];outcome:'PASS'|'FAIL';findings:EvidenceFinding[]};
type QualityReport={schemaVersion:number;level:'READY'|'RELEASE';baseSha:string;candidateFingerprint:string;candidateId:string|null;registrySha256:string;laws:QualityLawItem[];mutants:QualityMutant[];outcome:'PASS'|'FAIL'};
type MutationBinding={bindingId:string;evidenceModes:string[];negativeCases:Array<{negativeCaseId:string;negativeCaseRef:string;expectedCode:string}>;checkId?:string;examId?:string;proofId?:string;targetSelectorId?:string};
const validOrderedModes=(modes:string[]):boolean=>JSON.stringify(modes)===JSON.stringify(orderedModes(modes));
const validEvidenceRef=(value:string):boolean=>/^(?:file|text|ast|json|yaml|sql|dependency|config|test|exam|dynamic|scope):[^#]+#[^:]+:[a-f0-9]{64}$/u.test(value);
const validAssertion=(value:EvidenceAssertion):boolean=>exactKeys(value as Record<string,unknown>,['assertionId','passed','evidenceRefs'])&&cleanString(value.assertionId)&&typeof value.passed==='boolean'&&isStringArray(value.evidenceRefs)&&Boolean(value.evidenceRefs.length)&&sortedUnique(value.evidenceRefs)&&value.evidenceRefs.every(validEvidenceRef);
const validFinding=(value:EvidenceFinding):boolean=>exactKeys(value as Record<string,unknown>,['code','evidenceRefs'])&&/^[A-Z][A-Z0-9_]*$/u.test(value.code)&&isStringArray(value.evidenceRefs)&&Boolean(value.evidenceRefs.length)&&sortedUnique(value.evidenceRefs)&&value.evidenceRefs.every(validEvidenceRef);
const validTargetSet=(target:EvidenceTargetSet|null):boolean=>Boolean(target)
  && exactKeys(target as Record<string,unknown>,['queryRef','count','sha256'])
  && validEvidenceRef(target!.queryRef)
  && Number.isInteger(target!.count)
  && target!.count>=0
  && /^[a-f0-9]{64}$/u.test(target!.sha256);
const validateComponentShape=(component:QualityComponent):void=>{
  const keys=['bindingId','component','executorId','evidenceModes','outcome','targetSet','assertions','findings'];
  const identityValid=cleanString(component.bindingId)&&['static','exam','proof'].includes(component.component)&&cleanString(component.executorId);
  const modesValid=isStringArray(component.evidenceModes)&&Boolean(component.evidenceModes.length)&&validOrderedModes(component.evidenceModes);
  const assertionsValid=Array.isArray(component.assertions)&&Boolean(component.assertions.length)&&component.assertions.every(validAssertion);
  const findingsValid=Array.isArray(component.findings)&&component.findings.every(validFinding);
  if(!exactKeys(component as Record<string,unknown>,keys)||!identityValid||!modesValid||!['PASS','FAIL'].includes(component.outcome)||!assertionsValid||!findingsValid)fail('QUALITY_REPORT_INVALID',`component ${component.bindingId}`);
};
const validateComponent=(component:QualityComponent):void=>{
  validateComponentShape(component);
  if(component.component==='static'?!validTargetSet(component.targetSet):component.targetSet!==null)fail('QUALITY_REPORT_INVALID',`target set ${component.bindingId}`);
  const failed=component.assertions.some((assertion)=>!assertion.passed)||component.findings.length>0;
  if(component.outcome!==(failed?'FAIL':'PASS'))fail('QUALITY_REPORT_INVALID',`component outcome ${component.bindingId}`);
};
const mutationComponent=(binding:MutationBinding):QualityComponent=>{
  const component=binding.checkId?'static':binding.examId?'exam':'proof';const executorId=binding.checkId??binding.examId??binding.proofId??'';const hash='a'.repeat(64);const evidenceRef=`${component==='static'?'ast':component}:mutation#${encodeURIComponent(binding.bindingId)}:${hash}`;
  return{bindingId:binding.bindingId,component,executorId,evidenceModes:[...binding.evidenceModes],outcome:'PASS',targetSet:component==='static'?{queryRef:`scope:mutation#${encodeURIComponent(binding.targetSelectorId??'missing')}:${hash}`,count:0,sha256:hash}:null,assertions:[{assertionId:`${executorId}.result`,passed:true,evidenceRefs:[evidenceRef]}],findings:[]};
};
const validateComponentBinding=(component:QualityComponent,binding:MutationBinding):void=>{
  try{validateComponent(component)}catch{return fail('COMPONENT_FAILED',binding.bindingId)}
  const executor=binding.checkId??binding.examId??binding.proofId;
  const selectorValid=!binding.targetSelectorId||component.targetSet?.queryRef.includes(encodeURIComponent(binding.targetSelectorId));
  if(component.bindingId!==binding.bindingId||component.executorId!==executor||JSON.stringify(component.evidenceModes)!==JSON.stringify(binding.evidenceModes)||!selectorValid)fail('COMPONENT_FAILED',binding.bindingId);
};
const validLawCollections=(item:QualityLawItem,law:Law):boolean=>isStringArray(item.declaredEvidenceModes)
  &&validOrderedModes(item.declaredEvidenceModes)
  &&JSON.stringify(item.declaredEvidenceModes)===JSON.stringify(law.evidenceModes)
  &&isStringArray(item.requiredEvidenceModes)&&validOrderedModes(item.requiredEvidenceModes)
  &&isStringArray(item.deferredEvidenceModes)&&validOrderedModes(item.deferredEvidenceModes)
  &&isStringArray(item.scopeEvidenceRefs)&&Boolean(item.scopeEvidenceRefs.length)
  &&sortedUnique(item.scopeEvidenceRefs)&&item.scopeEvidenceRefs.every(validEvidenceRef)
  &&Array.isArray(item.components)&&Array.isArray(item.findings)&&item.findings.every(validFinding);
const validateLawModes=(item:QualityLawItem,law:Law,level:'READY'|'RELEASE'):void=>{
  const union=orderedModes([...item.requiredEvidenceModes,...item.deferredEvidenceModes]);
  const overlap=item.requiredEvidenceModes.some((mode)=>item.deferredEvidenceModes.includes(mode));
  if(JSON.stringify(union)!==JSON.stringify(item.declaredEvidenceModes)||overlap||(level==='RELEASE'&&item.deferredEvidenceModes.length))fail('QUALITY_REPORT_INVALID',`law modes ${law.lawId}`);
};
const expectedBindings=(law:Law,level:'READY'|'RELEASE')=>{const enforcement=law.enforcement??fail('ACTIVE_LAW_DENOMINATOR_MISMATCH',law.lawId);return[...(enforcement.staticBinding?[{bindingId:enforcement.staticBinding.bindingId,modes:enforcement.staticBinding.evidenceModes,component:'static' as const,executorId:enforcement.staticBinding.checkId,targetSelectorId:enforcement.staticBinding.targetSelectorId}]:[]),...enforcement.examBindings.map((binding)=>({bindingId:binding.bindingId,modes:binding.evidenceModes,component:'exam' as const,executorId:binding.examId,targetSelectorId:null})),...(level==='RELEASE'?enforcement.proofBindings.map((binding)=>({bindingId:binding.bindingId,modes:binding.evidenceModes,component:'proof' as const,executorId:binding.proofId,targetSelectorId:null})):[])].sort((left,right)=>left.bindingId.localeCompare(right.bindingId))};
type ExpectedBinding=ReturnType<typeof expectedBindings>[number];
const validateQualityItemShape=(current:QualityLawItem,law:Law):void=>{
  const keys=['lawId','declaredEvidenceModes','requiredEvidenceModes','deferredEvidenceModes','scopeEvidenceRefs','components','outcome','findings'];
  const valid=exactKeys(current as Record<string,unknown>,keys)&&current.lawId===law.lawId&&['PASS','FAIL'].includes(current.outcome)&&validLawCollections(current,law);
  if(!valid)fail('QUALITY_REPORT_INVALID',`law ${law.lawId}`);
};
const validateRequiredPlan=(current:QualityLawItem,law:Law,level:'READY'|'RELEASE'):void=>{
  validateLawModes(current,law,level);
  const plan=evidencePlan(law,[],level);
  const modesMatch=JSON.stringify(current.requiredEvidenceModes)===JSON.stringify(plan.applicableEvidenceModes)&&JSON.stringify(current.deferredEvidenceModes)===JSON.stringify(plan.deferredEvidenceModes);
  if(!modesMatch)fail('QUALITY_REPORT_INVALID',`required modes ${law.lawId}`);
  if(JSON.stringify(current.scopeEvidenceRefs)!==JSON.stringify([scopeEvidenceRef(law)]))fail('QUALITY_REPORT_INVALID',`scope ${law.lawId}`);
};
const validateBindingIdentity=(component:QualityComponent,binding:ExpectedBinding,lawId:string):void=>{
  const valid=component.bindingId===binding.bindingId&&component.component===binding.component&&component.executorId===binding.executorId&&JSON.stringify(component.evidenceModes)===JSON.stringify(binding.modes);
  if(!valid)fail('QUALITY_REPORT_INVALID',`component binding ${lawId}:${binding.bindingId}`);
  if(binding.targetSelectorId&&!component.targetSet?.queryRef.includes(encodeURIComponent(binding.targetSelectorId)))fail('QUALITY_REPORT_INVALID',`target selector ${binding.bindingId}`);
};
const validateBindingDenominator=(current:QualityLawItem,law:Law,level:'READY'|'RELEASE'):void=>{
  const expected=expectedBindings(law,level);
  requireExactDenominator(current.components.map((component)=>component.bindingId),expected.map((binding)=>binding.bindingId),`component denominator ${law.lawId}`);
  expected.forEach((binding,index)=>validateBindingIdentity(current.components[index]!,binding,law.lawId));
};
const validateQualityItem=(item:QualityLawItem|undefined,law:Law,level:'READY'|'RELEASE'):void=>{
  const current=item??fail('QUALITY_REPORT_INVALID',`law ${law.lawId}`);
  validateQualityItemShape(current,law);
  current.components.forEach(validateComponent);
  validateRequiredPlan(current,law,level);
  validateBindingDenominator(current,law,level);
  const failed=current.components.some((component)=>component.outcome==='FAIL')||current.findings.length>0;
  if(current.outcome!==(failed?'FAIL':'PASS'))fail('QUALITY_REPORT_INVALID',`law outcome ${law.lawId}`);
};
const validateQualityReportHeader=(report:QualityReport,level:'READY'|'RELEASE'):void=>{if(!exactKeys(report as Record<string,unknown>,['schemaVersion','level','baseSha','candidateFingerprint','candidateId','registrySha256','laws','mutants','outcome'])||report.schemaVersion!==2||report.level!==level||!validGitObjectId(report.baseSha)||!/^[a-f0-9]{64}$/u.test(report.candidateFingerprint)||!/^[a-f0-9]{64}$/u.test(report.registrySha256)||!['PASS','FAIL'].includes(report.outcome))fail('QUALITY_REPORT_INVALID','top-level')};
const validateQualityCandidate=(report:QualityReport,level:'READY'|'RELEASE'):void=>{if(level==='READY'&&report.candidateId!==null)fail('QUALITY_REPORT_INVALID','READY candidateId');if(level==='RELEASE'&&(typeof report.candidateId!=='string'||!/^[a-f0-9]{64}$/u.test(report.candidateId)))fail('QUALITY_REPORT_INVALID','RELEASE candidateId')};
const validateMutant=(mutant:QualityMutant):void=>{if(!exactKeys(mutant as Record<string,unknown>,['mutantId','bindingId','expectedCode','actualCode','evidenceRefs','outcome'])||!cleanString(mutant.mutantId)||(mutant.bindingId!==null&&!cleanString(mutant.bindingId))||!cleanString(mutant.expectedCode)||!cleanString(mutant.actualCode)||!isStringArray(mutant.evidenceRefs)||!mutant.evidenceRefs.length||!sortedUnique(mutant.evidenceRefs)||!mutant.evidenceRefs.every(validEvidenceRef)||!['PASS','FAIL'].includes(mutant.outcome)||mutant.outcome!==(mutant.expectedCode===mutant.actualCode?'PASS':'FAIL'))fail('QUALITY_REPORT_INVALID',`mutant ${mutant.mutantId}`)};
const validateLawDenominator=(report:QualityReport,laws:Law[],level:'READY'|'RELEASE'):Law[]=>{
  const ordered=[...laws].sort((left,right)=>left.lawId.localeCompare(right.lawId));
  if(!Array.isArray(report.laws)||report.laws.length!==ordered.length)fail('QUALITY_REPORT_INVALID','law denominator');
  ordered.forEach((law,index)=>validateQualityItem(report.laws[index],law,level));
  return ordered;
};
const validateMutantDenominator=(report:QualityReport,laws:Law[],level:'READY'|'RELEASE'):void=>{
  if(!Array.isArray(report.mutants)||!report.mutants.length)fail('QUALITY_REPORT_INVALID','mutant denominator');
  report.mutants.forEach(validateMutant);
  if(!sortedUnique(report.mutants.map((mutant)=>mutant.mutantId)))fail('QUALITY_REPORT_INVALID','mutant order');
  const expected=expectedMutantDeclarations(laws,level);
  requireExactDenominator(report.mutants.map((mutant)=>mutant.mutantId),expected.map((mutant)=>mutant.mutantId),'mutant denominator');
  expected.forEach((item,index)=>{const actual=report.mutants[index]!;if(actual.mutantId!==item.mutantId||actual.bindingId!==item.bindingId||actual.expectedCode!==item.expectedCode)fail('QUALITY_REPORT_INVALID',`mutant binding ${item.mutantId}`)});
};
export function validateQualityReport(value:unknown,laws:Law[],level:'READY'|'RELEASE'){
  if(!value||typeof value!=='object'||Array.isArray(value))fail('QUALITY_REPORT_INVALID','top-level');
  const report=value as QualityReport;
  validateQualityReportHeader(report,level);
  validateQualityCandidate(report,level);
  const orderedLaws=validateLawDenominator(report,laws,level);
  if(report.registrySha256!==sha(bytes(REGISTRY))||report.candidateFingerprint!==candidateSnapshot(report.baseSha))fail('QUALITY_REPORT_INVALID','candidate binding');
  validateMutantDenominator(report,orderedLaws,level);
  const failed=report.laws.some((item)=>item.outcome==='FAIL')||report.mutants.some((item)=>item.outcome==='FAIL');const outcome=failed?'FAIL':'PASS';if(report.outcome!==outcome)fail('QUALITY_REPORT_INVALID','aggregate outcome');
}
const registryEvidenceRef=(selector:string):string=>`json:${REGISTRY}#${encodeURIComponent(selector)}:${sha(bytes(REGISTRY))}`;
export const scopeEvidenceRef=(law:Law):string=>{const domain=buildRegistry().domains.find((item)=>item.capabilityDomain===law.capabilityDomain)??fail('ACTIVE_LAW_DENOMINATOR_MISMATCH',law.lawId);const scopeHash=sha(canonicalBytes({lawId:law.lawId,appliesTo:law.appliesTo,excludes:law.excludes,ownedPaths:domain.ownedPaths,observedPaths:domain.observedPaths,contractRefs:law.contractRefs}));return`scope:${encodeURIComponent(law.lawId)}#law-scope:${scopeHash}`};
const CORE_MUTANTS=Object.freeze([
  ['core.candidate.drift','CANDIDATE_DRIFT'],['core.owner.multiple','MULTIPLE_PRIMARY_OWNERS'],['core.owner.role-escalation','ROLE_ESCALATION_REQUIRED'],['core.owner.unauthorized-delete','UNAUTHORIZED_PRODUCTION_DELETE'],['core.owner.unowned','UNOWNED_PRODUCTION_FILE'],['core.projection.fileset','GENERATED_FILESET_INVALID'],['core.projection.stale','GENERATED_PROJECTION_STALE'],['core.quality.denominator-duplicate','QUALITY_REPORT_INVALID'],['core.quality.denominator-extra','QUALITY_REPORT_INVALID'],['core.quality.denominator-missing','QUALITY_REPORT_INVALID'],['core.quality.empty-assertions','QUALITY_REPORT_INVALID'],['core.quality.empty-evidence-refs','QUALITY_REPORT_INVALID'],['core.quality.finding-ignored','QUALITY_REPORT_INVALID'],['core.quality.fixed-pass','QUALITY_REPORT_INVALID'],['core.quality.wrong-evidence-mode','COMPONENT_FAILED'],['core.release.candidate-unbound','RELEASE_CANDIDATE_UNBOUND'],['core.release.evidence-missing','RELEASE_EVIDENCE_MISSING'],
] as const);
const caughtCode=(run:()=>void):string=>{try{run();return'MUTANT_NOT_DETECTED'}catch(error){return error instanceof Error&&'code'in error?String((error as{code:unknown}).code):'UNKNOWN'}};
const requireExactDenominator=(actual:readonly string[],expected:readonly string[],detail:string):void=>{if(new Set(actual).size!==actual.length||JSON.stringify(actual)!==JSON.stringify(expected))fail('QUALITY_REPORT_INVALID',detail)};
const mutateQualityComponent=(mutantId:string,component:QualityComponent):boolean=>{
  if(mutantId==='core.quality.empty-assertions')component.assertions=[];
  else if(mutantId==='core.quality.empty-evidence-refs')component.assertions[0]!.evidenceRefs=[];
  else if(mutantId==='core.quality.finding-ignored')component.findings=[{code:'COMPONENT_FAILED',evidenceRefs:component.assertions[0]!.evidenceRefs}],component.outcome='PASS';
  else if(mutantId==='core.quality.fixed-pass')component.assertions[0]!.passed=false,component.outcome='PASS';
  else if(mutantId==='core.quality.wrong-evidence-mode')component.evidenceModes=['static.text'];
  else return false;
  return true;
};
const CORE_INVARIANTS:Readonly<Record<string,()=>void>>=Object.freeze({
  'core.owner.unowned':()=>requireSinglePrimaryOwner([],'mutant'),
  'core.owner.multiple':()=>requireSinglePrimaryOwner(['a','b'],'mutant'),
  'core.owner.role-escalation':()=>requireProductionImportRole('production.ts','test.ts','TEST_ONLY'),
  'core.owner.unauthorized-delete':()=>requireAuthorizedProductionDelete('mutant',false,['owner']),
  'core.projection.fileset':()=>requireExactProjection(['extra.json'],['law-registry.generated.json'],Buffer.from('same'),Buffer.from('same')),
  'core.projection.stale':()=>requireExactProjection(['law-registry.generated.json'],['law-registry.generated.json'],Buffer.from('stale'),Buffer.from('current')),
  'core.candidate.drift':()=>requireCandidateStable('before','after','mutant'),
  'core.release.candidate-unbound':()=>requireReleaseCandidateBound(false),
  'core.release.evidence-missing':()=>requireReleaseEvidence(false,'mutant'),
  'core.quality.denominator-missing':()=>requireExactDenominator([],['binding'],'mutant'),
  'core.quality.denominator-extra':()=>requireExactDenominator(['binding','extra'],['binding'],'mutant'),
  'core.quality.denominator-duplicate':()=>requireExactDenominator(['binding','binding'],['binding'],'mutant'),
});
const coreInvariant=(mutantId:string):void=>{
  const invariant=CORE_INVARIANTS[mutantId];
  if(invariant){invariant();return}
  const binding:MutationBinding={bindingId:'core.binding',checkId:'core.check',targetSelectorId:'core.target',evidenceModes:['static.ast'],negativeCases:[]};const component=mutationComponent(binding);
  if(!mutateQualityComponent(mutantId,component))return fail('QUALITY_REPORT_INVALID','unknown mutant');
  if(mutantId==='core.quality.wrong-evidence-mode')validateComponentBinding(component,binding);else validateComponent(component);
};
export const evaluateCoreMutation=(mutantId:string):string=>caughtCode(()=>coreInvariant(mutantId));
const expectedMutantDeclarations=(laws:Law[],level:'READY'|'RELEASE')=>{
  const bindings=laws.flatMap((law)=>{const enforcement=law.enforcement??fail('ACTIVE_LAW_DENOMINATOR_MISMATCH',law.lawId);return[...(enforcement.staticBinding?[enforcement.staticBinding]:[]),...enforcement.examBindings,...(level==='RELEASE'?enforcement.proofBindings:[])]});
  return[...bindings.flatMap((binding)=>binding.negativeCases.map((negative)=>({mutantId:negative.negativeCaseId,bindingId:binding.bindingId,expectedCode:negative.expectedCode,binding,negativeCaseRef:negative.negativeCaseRef}))),...CORE_MUTANTS.map(([mutantId,expectedCode])=>({mutantId,bindingId:null,expectedCode,binding:null,negativeCaseRef:'tests/governance/governance.test.ts'}))].sort((left,right)=>left.mutantId.localeCompare(right.mutantId));
};
const executeBindingMutationSuite=(level:'READY'|'RELEASE'):Record<string,string>=>{const directory=mkdtempSync(resolve(tmpdir(),'grasseye-binding-mutants-'));const output=resolve(directory,'result.json');try{const env:NodeJS.ProcessEnv={...process.env,GOVERNANCE_MUTATION_LEVEL:level,GOVERNANCE_MUTATION_OUTPUT:output};delete env.NODE_TEST_CONTEXT;const result=spawnSync(process.execPath,['--import','tsx','--test','tests/governance/binding-negative-cases.test.ts'],{cwd:ROOT,encoding:'utf8',env,maxBuffer:16*1024*1024});if(result.status!==0)fail('COMPONENT_FAILED',result.stderr||result.stdout||'binding negative suite');if(!existsSync(output))fail('COMPONENT_FAILED','binding mutation result missing');return JSON.parse(readFileSync(output,'utf8')) as Record<string,string>}catch(error){if(error instanceof Error&&'code'in error)throw error;return fail('COMPONENT_FAILED','binding mutation result invalid')}finally{rmSync(directory,{recursive:true,force:true})}};
export const mutantCatalog=(laws:Law[],level:'READY'|'RELEASE'):QualityMutant[]=>{const declarations=expectedMutantDeclarations(laws,level);const bindingResults=executeBindingMutationSuite(level);const expectedBindingIds=declarations.filter((item)=>item.binding).map((item)=>item.mutantId).sort();if(JSON.stringify(Object.keys(bindingResults).sort())!==JSON.stringify(expectedBindingIds))fail('COMPONENT_FAILED','binding mutation denominator');const actualById=new Map<string,string>();for(const declaration of declarations)actualById.set(declaration.mutantId,declaration.binding?bindingResults[declaration.mutantId]??'MUTANT_NOT_EXECUTED':evaluateCoreMutation(declaration.mutantId));const receipt={schemaVersion:1,level,results:Object.fromEntries([...actualById.entries()].sort())};const directory=process.env.GRASSEYE_QUALITY_RUN_DIRECTORY?.trim()??mkdtempSync(resolve(tmpdir(),'grasseye-mutants-'));mkdirSync(directory,{recursive:true});const receiptPath=resolve(directory,`mutation-results-${level.toLowerCase()}.json`);writeFileSync(receiptPath,canonicalBytes(receipt),{mode:0o600});const receiptHash=sha(bytes(receiptPath));return declarations.map((declaration)=>{const actualCode=actualById.get(declaration.mutantId)!;const evidenceRef=`test:${encodeURIComponent(receiptPath)}#${encodeURIComponent(declaration.mutantId)}:${receiptHash}`;return{mutantId:declaration.mutantId,bindingId:declaration.bindingId,expectedCode:declaration.expectedCode,actualCode,evidenceRefs:[evidenceRef],outcome:declaration.expectedCode===actualCode?'PASS':'FAIL'}})};
const proofComponents=(law:Law,proofs:DynamicProofs):QualityComponent[]=>{const enforcement=law.enforcement??fail('ACTIVE_LAW_DENOMINATOR_MISMATCH',law.lawId);return enforcement.proofBindings.map((binding)=>{const proof=proofs.find((candidate)=>candidate.lawId===law.lawId&&candidate.bindingId===binding.bindingId&&candidate.proofId===binding.proofId&&JSON.stringify(candidate.evidenceModes)===JSON.stringify(binding.evidenceModes));if(!proof){const ref=registryEvidenceRef(binding.bindingId);return{bindingId:binding.bindingId,component:'proof' as const,executorId:binding.proofId,evidenceModes:binding.evidenceModes,outcome:'FAIL' as const,targetSet:null,assertions:[{assertionId:`${binding.proofId}.observed`,passed:false,evidenceRefs:[ref]}],findings:[{code:'REQUIRED_DYNAMIC_PROOF_MISSING',evidenceRefs:[ref]}]}}return{bindingId:binding.bindingId,component:'proof' as const,executorId:binding.proofId,evidenceModes:binding.evidenceModes,outcome:proof.outcome,targetSet:null,assertions:proof.assertions,findings:proof.findings}})};
const lawItem=(law:Law,level:'READY'|'RELEASE',checks:CheckResult[],proofs:DynamicProofs):QualityLawItem=>{const plan=evidencePlan(law,[],level);const components=[...checks.filter((check)=>check.lawId===law.lawId&&check.component).map((check)=>check.component!),...(level==='RELEASE'?proofComponents(law,proofs):[])].sort((left,right)=>left.bindingId.localeCompare(right.bindingId));const expected=expectedBindings(law,level);const actualIds=components.map((component)=>component.bindingId);const expectedIds=expected.map((binding)=>binding.bindingId).sort();const coverage=orderedModes(components.filter((component)=>component.outcome==='PASS').flatMap((component)=>component.evidenceModes));const denominatorOk=JSON.stringify(actualIds)===JSON.stringify(expectedIds)&&JSON.stringify(coverage)===JSON.stringify(plan.applicableEvidenceModes);const denominatorEvidence=registryEvidenceRef(law.lawId);const findings:EvidenceFinding[]=[...components.flatMap((component)=>component.findings),...(denominatorOk?[]:[{code:'REQUIRED_BINDING_DENOMINATOR_MISMATCH',evidenceRefs:[denominatorEvidence]}])];return{lawId:law.lawId,declaredEvidenceModes:law.evidenceModes,requiredEvidenceModes:plan.applicableEvidenceModes,deferredEvidenceModes:plan.deferredEvidenceModes,scopeEvidenceRefs:[scopeEvidenceRef(law)],components,outcome:findings.length?'FAIL':'PASS',findings}};

export function writeReport(
  laws: Law[],
  baseSha: string,
  checks: CheckResult[],
  runDirectory: string,
) {
  const orderedLaws=[...laws].sort((left,right)=>left.lawId.localeCompare(right.lawId));const registrySha = sha(bytes(REGISTRY));const items=orderedLaws.map((law)=>lawItem(law,'READY',checks,[]));const mutants=mutantCatalog(orderedLaws,'READY');
  const report = {
    schemaVersion: 2,
    level: 'READY' as const,
    baseSha,
    candidateFingerprint:candidateSnapshot(),
    candidateId: null,
    registrySha256: registrySha,
    laws: items,
    mutants,
    outcome: items.some((item) => item.outcome === 'FAIL')||mutants.some((item)=>item.outcome==='FAIL') ? 'FAIL' as const : 'PASS' as const,
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
  proofs: DynamicProofs,
  runDirectory: string,
) {
  const orderedLaws=[...laws].sort((left,right)=>left.lawId.localeCompare(right.lawId));const referencedDynamicProofHashes=new Set(proofs.flatMap((proof)=>proof.hashes));const items=orderedLaws.map((law)=>lawItem(law,'RELEASE',checks,proofs));const mutants=mutantCatalog(orderedLaws,'RELEASE');
  const report = {
    schemaVersion: 2,
    level: 'RELEASE' as const,
    baseSha,
    candidateFingerprint:candidateSnapshot(),
    candidateId: binding.candidateId,
    registrySha256: binding.registrySha256,
    laws: items,
    mutants,
    outcome: items.some((item) => item.outcome === 'FAIL')||mutants.some((item)=>item.outcome==='FAIL') ? 'FAIL' as const : 'PASS' as const,
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
