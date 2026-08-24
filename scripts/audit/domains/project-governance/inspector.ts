import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createHash } from "node:crypto";
import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const hash = (path:string):string => createHash("sha256").update(readFileSync(path)).digest("hex");

export async function inspectDomain(context:InspectorContext):Promise<SessionInspectorOutput>{
  let findings:InspectorFinding[]=[];
  await context.checks.runAll(async()=>{
    const lawId=selectLawId(context.planEntry.lawIds,"LAW-PROJECT-GOVERNANCE-002-V2");
    const root=process.cwd();
    const freezePath=resolve(root,"docs/governance/GOVERNANCE-FREEZE.json");
    const freeze=JSON.parse(readFileSync(freezePath,"utf8")) as {freezeVersion?:unknown;specPath?:unknown;specSha256?:unknown};
    const expectedPath="docs/governance/法案系统建设说明书-冻结定稿版.md";
    if(freeze.freezeVersion!=="FROZEN-FINAL-V3.3"||freeze.specPath!==expectedPath||freeze.specSha256!==hash(resolve(root,expectedPath))){
      findings.push(createFinding({lawId,checkId:"project-governance/frozen-source-binding",filePath:"docs/governance/GOVERNANCE-FREEZE.json",message:"V3.3 frozen source identity must match the current specification bytes."}));
    }
    const authority=context.project.getSourceFile(resolveFromRepo("scripts/audit/governance-authority.ts"));
    if(!authority?.getFunction("verifyEntry")||!authority.getFunction("buildRegistry")||!authority.getFunction("checkProjection")){
      findings.push(createFinding({lawId:selectLawId(context.planEntry.lawIds,"LAW-PROJECT-GOVERNANCE-001-V2"),checkId:"project-governance/entry-contract",filePath:"scripts/audit/governance-authority.ts",message:"Governance authority must expose structural entry, registry build and projection checks."}));
    }
    return{findings,evidenceRefs:["scripts/audit/governance-authority.ts","docs/governance/GOVERNANCE-FREEZE.json",expectedPath]};
  });
  return context.checks.output();
}
