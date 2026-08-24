import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

type Manifest={capabilityDomain:string;lawIds:string[];ownedPaths:string[]};
export async function inspectDomain(context:InspectorContext):Promise<SessionInspectorOutput>{
  let findings:InspectorFinding[]=[];
  await context.checks.runAll(async()=>{
    const root=process.cwd();const lawId=selectLawId(context.planEntry.lawIds,"LAW-DOMAIN-REGISTRY-001-V1");
    const manifests=readdirSync(resolve(root,"scripts/audit/domains"),{withFileTypes:true}).filter((entry)=>entry.isDirectory()).flatMap((entry)=>{try{return[JSON.parse(readFileSync(resolve(root,"scripts/audit/domains",entry.name,"manifest.json"),"utf8")) as Manifest]}catch{return[]}});
    const domains=manifests.map((manifest)=>manifest.capabilityDomain);
    if(new Set(domains).size!==domains.length||domains.some((domain)=>!domain))findings.push(createFinding({lawId,checkId:"domain-registry/unique-domain",filePath:"scripts/audit/domains",message:"Each active capabilityDomain must have exactly one valid manifest identity."}));
    const owners:{pattern:string;domain:string}[]=[];
    for(const manifest of manifests)for(const pattern of manifest.ownedPaths){const collision=owners.find((owner)=>owner.pattern===pattern&&owner.domain!==manifest.capabilityDomain);if(collision)findings.push(createFinding({lawId,checkId:"domain-registry/unique-owner",filePath:"scripts/audit/domains",message:`${pattern} is claimed by ${collision.domain} and ${manifest.capabilityDomain}.`}));else owners.push({pattern,domain:manifest.capabilityDomain})}
    for(const manifest of manifests)if(!context.project.getSourceFile(resolveFromRepo(`scripts/audit/domains/${manifest.capabilityDomain}/inspector.ts`)))findings.push(createFinding({lawId,checkId:"domain-registry/inspector-owner",filePath:`scripts/audit/domains/${manifest.capabilityDomain}/manifest.json`,message:`${manifest.capabilityDomain} must resolve to one owner inspector source.`}));
    return{findings,evidenceRefs:manifests.map((manifest)=>`scripts/audit/domains/${manifest.capabilityDomain}/manifest.json`).sort()};
  });
  return context.checks.output();
}
