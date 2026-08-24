import { pathToFileURL } from 'node:url';

import { candidateSnapshot } from '../audit/governance-authority.js';
import { compileExamRegistry, type ExamBindingDeclaration } from './exam-registry.js';
import { runExamSchedule } from './exam-scheduler.js';

export async function runExamBinding(binding:ExamBindingDeclaration,root=process.cwd()){return runExamSchedule([binding],root,candidateSnapshot())}

export async function runAllExamBindings(root=process.cwd()){
  const identity=candidateSnapshot();const requested=process.env.GOVERNANCE_BINDING_ID?.trim();const allBindings=compileExamRegistry(root);const bindings=requested?allBindings.filter((binding)=>binding.bindingId===requested):allBindings;if(requested&&bindings.length!==1)throw new Error(`EXAM_BINDING_NOT_FOUND:${requested}`);const results=await runExamSchedule(bindings,root,identity);
  return{schemaVersion:1,candidateIdentity:identity,expected:bindings.length,executed:results.length,results,outcome:results.length===bindings.length&&results.every((result)=>result.verdict==='PASS')?'PASS' as const:'FAIL' as const};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const report=await runAllExamBindings();process.stdout.write(`${JSON.stringify(report)}\n`);if(report.outcome!=='PASS')process.exitCode=1}
