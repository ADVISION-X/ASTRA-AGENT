import { compileExamRegistry } from "../../../exam/exam-registry.js";
import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

export async function inspectDomain(context:InspectorContext):Promise<SessionInspectorOutput>{
  let findings:InspectorFinding[]=[];
  await context.checks.runAll(async()=>{
    try{const runner=context.project.getSourceFile(resolveFromRepo("scripts/exam/run-exam.ts"));const scheduler=context.project.getSourceFile(resolveFromRepo("scripts/exam/exam-scheduler.ts"));if(!runner?.getFunction("runAllExamBindings")||!scheduler?.getFunction("runExamSchedule"))throw new Error("unique exam runner or scheduler is missing");const bindings=compileExamRegistry();if(!bindings.length||new Set(bindings.map((binding)=>binding.bindingId)).size!==bindings.length)throw new Error("compiled exam binding denominator is empty or duplicated");}
    catch(error){findings.push(createFinding({lawId:selectLawId(context.planEntry.lawIds,"LAW-EXAM-SYSTEM-001-V1"),checkId:"exam-system/compiled-bindings",filePath:"scripts/exam/exam-registry.ts",message:error instanceof Error?error.message:String(error)}))}
    return{findings,evidenceRefs:["scripts/exam/exam-registry.ts","scripts/exam/exam-scheduler.ts","scripts/exam/exam-candidate-sentinel.ts","scripts/audit/generated/law-registry.generated.json"]};
  });
  return context.checks.output();
}
