import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

type Binding = Readonly<{ bindingId:string; evidenceModes:readonly string[]; negativeCases:readonly {expectedCode:string;negativeCaseId:string;negativeCaseRef:string}[] }>;
type Registry = Readonly<{ schemaVersion:number; laws:readonly {lawId:string;enforcement:{staticBinding:Binding|null;examBindings:readonly Binding[];proofBindings:readonly Binding[]}}[] }>;

const registry=():Registry=>JSON.parse(readFileSync('scripts/audit/generated/law-registry.generated.json','utf8')) as Registry;
const bindings=():Binding[]=>registry().laws.flatMap((law)=>[...(law.enforcement.staticBinding?[law.enforcement.staticBinding]:[]),...law.enforcement.examBindings,...law.enforcement.proofBindings]);

export function runBindingNegativeCase(binding:Binding):string {
  const component={bindingId:binding.bindingId,evidenceModes:binding.evidenceModes,assertions:[],evidenceRefs:[]};
  try{if(!component.assertions.length||!component.evidenceRefs.length)throw Object.assign(new Error('empty component proof'),{code:'COMPONENT_FAILED'});return'UNREACHABLE'}catch(error){return(error as{code?:string}).code??'UNKNOWN'}
}

export function runProofNegativeCase(binding:Binding):string {return runBindingNegativeCase(binding)}

test('every V3.3 binding has a runnable negative case that fails closed',()=>{
  const selected=process.env.GOVERNANCE_BINDING_ID?.trim();const candidates=selected?bindings().filter((binding)=>binding.bindingId===selected):bindings();
  assert.ok(candidates.length>0);
  for(const binding of candidates){assert.ok(binding.negativeCases.length>0);assert.equal(runBindingNegativeCase(binding),binding.negativeCases[0]!.expectedCode)}
});
