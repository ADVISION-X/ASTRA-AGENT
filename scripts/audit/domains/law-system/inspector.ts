import { buildRegistry, loadLaws } from "../../governance-authority.js";
import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

export async function inspectDomain(context:InspectorContext):Promise<SessionInspectorOutput>{
  let findings:InspectorFinding[]=[];
  await context.checks.runAll(async()=>{
    try{
      const authority=context.project.getSourceFile(resolveFromRepo("scripts/audit/governance-authority.ts"));
      if(!authority?.getFunction("loadLaws")||!authority.getFunction("buildRegistry"))throw new Error("unique law parser or registry compiler is missing");
      const laws=loadLaws();const registry=buildRegistry();
      if(registry.schemaVersion!==4||registry.laws.length!==laws.length||registry.laws.some((law)=>law.enforcement===null))throw new Error("registry denominator or enforcement binding is incomplete");
    }catch(error){findings.push(createFinding({lawId:selectLawId(context.planEntry.lawIds,"LAW-LAW-SYSTEM-004-V1"),checkId:"law-system/registry-derivation",filePath:"scripts/audit/generated/law-registry.generated.json",message:error instanceof Error?error.message:String(error)}))}
    return{findings,evidenceRefs:[".github/instructions/agent-rules/基础法案.md",".github/instructions/agent-rules/功能法案.md","scripts/audit/domains","scripts/audit/generated/law-registry.generated.json"]};
  });
  return context.checks.output();
}
