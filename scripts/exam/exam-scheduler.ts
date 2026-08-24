import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { sha } from '../audit/governance-runtime.js';
import { canonicalBytes } from '../audit/governance-json.js';
import { assertExamCandidateUnchanged } from './exam-candidate-sentinel.js';
import { classifyExamOutcome, type ExamExecutionResult } from './exam-execution-result.js';
import type { ExamBindingDeclaration } from './exam-registry.js';
import { verifyExamBehavior } from './exam-binding-predicate.js';

const TIMEOUT_MS = 20 * 60 * 1000;
const TERMINATE_GRACE_MS = 5_000;
const rawExamEvidenceRefs=(bindingId:string,stdout:Buffer,stderr:Buffer):string[]=>{
  const directory=process.env.GRASSEYE_QUALITY_RUN_DIRECTORY?.trim();
  if(!directory)return[];
  const evidenceDirectory=resolve(directory,'exam-raw');
  mkdirSync(evidenceDirectory,{recursive:true});
  const base=bindingId.replace(/[^a-zA-Z0-9_.-]/gu,'_');
  return [['stdout',stdout],['stderr',stderr] as const].map(([stream,content])=>{const path=resolve(evidenceDirectory,`${base}.${stream}.log`);writeFileSync(path,content,{mode:0o600});return`exam:${encodeURIComponent(path)}#${encodeURIComponent(`${bindingId}|${stream}`)}:${sha(content)}`}).sort();
};

const commandFromRef = (binding:ExamBindingDeclaration):string => {
  const parts = binding.examRef.split('#')[1]?.split('|') ?? [];
  if (parts.length !== 4 || parts[0] !== 'runExamBinding') throw new Error(`EXAM_REF_INVALID:${binding.bindingId}`);
  return decodeURIComponent(parts[1]!);
};

const terminateTree = (child:ChildProcess):void => {
  if (!child.pid) return;
  try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
  const timer = setTimeout(() => {
    if (!child.pid) return;
    try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
  }, TERMINATE_GRACE_MS);
  timer.unref();
};

export async function executeExamBinding(binding:ExamBindingDeclaration, root:string, candidateIdentity:string):Promise<ExamExecutionResult> {
  assertExamCandidateUnchanged(root, candidateIdentity);
  const command = commandFromRef(binding);
  const seed=sha(canonicalBytes({candidateIdentity,bindingId:binding.bindingId}));
  const inputHash=sha(canonicalBytes({candidateIdentity,bindingId:binding.bindingId,examId:binding.examId,lawId:binding.lawId,evidenceModes:binding.evidenceModes,command,seed,timeoutMs:TIMEOUT_MS}));
  const startedAt = new Date().toISOString();
  const child = spawn('npm', ['run', command], {
    cwd: root,
    detached: process.platform !== 'win32',
    env: { ...process.env, GOVERNANCE_BINDING_ID: binding.bindingId, GOVERNANCE_EXAM_ID:binding.examId, GOVERNANCE_LAW_ID:binding.lawId, GOVERNANCE_EXAM_SEED:seed, GOVERNANCE_EXAM_INPUT_HASH:inputHash },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout:Buffer[]=[];const stderr:Buffer[]=[];let timedOut=false;let spawnError=false;
  child.stdout?.on('data',(chunk:Buffer)=>stdout.push(chunk));child.stderr?.on('data',(chunk:Buffer)=>stderr.push(chunk));
  child.once('error',()=>{spawnError=true});
  const outcome = await new Promise<{exitStatus:number|null;signal:string|null}>((resolve) => {
    const timer=setTimeout(()=>{timedOut=true;terminateTree(child)},TIMEOUT_MS);timer.unref();
    child.once('close',(exitStatus,signal)=>{clearTimeout(timer);resolve({exitStatus,signal})});
  });
  assertExamCandidateUnchanged(root, candidateIdentity);
  let classified=classifyExamOutcome({...outcome,timedOut,spawnError});
  const stdoutRaw=Buffer.concat(stdout);const stderrRaw=Buffer.concat(stderr);const stdoutSha256=sha(stdoutRaw);const stderrSha256=sha(stderrRaw);
  let behaviorPassed=false;if(classified.verdict==='PASS'){try{verifyExamBehavior(command,stdoutRaw.toString('utf8'),binding.bindingId);behaviorPassed=true}catch{classified={verdict:'FAIL',reasonCode:'COMPONENT_FAILED'}}}
  const proofHash=sha(canonicalBytes({candidateIdentity,bindingId:binding.bindingId,examId:binding.examId,command,seed,timeoutMs:TIMEOUT_MS,...outcome,timedOut,stdoutSha256,stderrSha256}));
  const evidenceRef=`exam:${encodeURIComponent(command)}#${encodeURIComponent(binding.bindingId)}:${proofHash}`;const inputRef=`exam:${encodeURIComponent(command)}#${encodeURIComponent(`${binding.bindingId}|input`)}:${inputHash}`;const evidenceRefs=[evidenceRef,...rawExamEvidenceRefs(binding.bindingId,stdoutRaw,stderrRaw)].sort();
  const passed=classified.verdict==='PASS';
  return { bindingId:binding.bindingId,examId:binding.examId,lawId:binding.lawId,evidenceModes:binding.evidenceModes,command,candidateIdentity,inputHash,startedAt,finishedAt:new Date().toISOString(),...outcome,timedOut,stdoutSha256,stderrSha256,seed,timeoutMs:TIMEOUT_MS,assertions:[{assertionId:`${binding.examId}.input-bound`,passed,evidenceRefs:[inputRef]},{assertionId:`${binding.examId}.behavior-observed`,passed:behaviorPassed,evidenceRefs}],findings:passed?[]:[{code:classified.reasonCode,evidenceRefs}],...classified };
}

export async function runExamSchedule(bindings:readonly ExamBindingDeclaration[],root:string,candidateIdentity:string):Promise<ExamExecutionResult[]> {
  const results:ExamExecutionResult[]=[];
  for(const binding of [...bindings].sort((left,right)=>left.bindingId.localeCompare(right.bindingId))){
    const result=await executeExamBinding(binding,root,candidateIdentity);
    results.push(result);
    if(result.verdict!=='PASS')break;
  }
  return results;
}
