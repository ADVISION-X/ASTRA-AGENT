import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { enforceBindingVerdict } from '../../scripts/audit/binding-verdict.js';

type Binding = Readonly<{ bindingId:string; evidenceModes:readonly string[]; negativeCases:readonly {expectedCode:string;negativeCaseId:string;negativeCaseRef:string}[] }>;
type LawBinding = Readonly<{ lawId:string; binding:Binding }>;
type Registry = Readonly<{ schemaVersion:number; laws:readonly {lawId:string;enforcement:{staticBinding:Binding|null;examBindings:readonly Binding[];proofBindings:readonly Binding[]}}[] }>;

const registry=():Registry=>JSON.parse(readFileSync('scripts/audit/generated/law-registry.generated.json','utf8')) as Registry;
const bindings=():LawBinding[]=>registry().laws.flatMap((law)=>[...(law.enforcement.staticBinding?[law.enforcement.staticBinding]:[]),...law.enforcement.examBindings,...law.enforcement.proofBindings].map((binding)=>({lawId:law.lawId,binding})));

export function runBindingNegativeCase(input:LawBinding):string {
  const negative=input.binding.negativeCases[0];
  if(!negative)return'NEGATIVE_CASE_NOT_DECLARED';
  const[path,selector='']=negative.negativeCaseRef.split('#');const parts=selector.split('|');
  if(path!=='tests/governance/binding-negative-cases.test.ts'||!['runBindingNegativeCase','runProofNegativeCase'].includes(parts[0]??'')||decodeURIComponent(parts[2]??'')!==input.binding.bindingId)return'NEGATIVE_CASE_REF_INVALID';
  const evidenceRef=`test:mutation#${encodeURIComponent(input.binding.bindingId)}:${'a'.repeat(64)}`;
  try{enforceBindingVerdict({lawId:input.lawId,bindingId:input.binding.bindingId,summarySatisfied:false,triggeredForbidden:[],assertions:[{passed:true,evidenceRefs:[evidenceRef]}],findingCount:0});return'NEGATIVE_CASE_DID_NOT_FAIL'}catch(error){return error instanceof Error&&'code'in error?String((error as{code:unknown}).code):'UNKNOWN'}
}

export function runProofNegativeCase(binding:LawBinding):string {return runBindingNegativeCase(binding)}

test('every V3.3 binding has a runnable negative case that fails closed',()=>{
  const selected=process.env.GOVERNANCE_BINDING_ID?.trim();const level=process.env.GOVERNANCE_MUTATION_LEVEL?.trim();const all=bindings();const ready=all.filter(({binding})=>binding.negativeCases.every((negative)=>!negative.negativeCaseRef.includes('runProofNegativeCase')));const candidates=selected?all.filter(({binding})=>binding.bindingId===selected):level==='READY'?ready:all;
  assert.ok(candidates.length>0);
  const results:Record<string,string>={};for(const input of candidates){assert.ok(input.binding.negativeCases.length>0);const actual=runBindingNegativeCase(input);assert.equal(actual,input.binding.negativeCases[0]!.expectedCode);results[input.binding.negativeCases[0]!.negativeCaseId]=actual}
  const output=process.env.GOVERNANCE_MUTATION_OUTPUT?.trim();if(output)writeFileSync(output,`${JSON.stringify(results)}\n`,{mode:0o600});
});
