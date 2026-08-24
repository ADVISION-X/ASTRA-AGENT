import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createAuditProject } from "./project.js";
import type { InspectorCheckBodyResult, InspectorContext, InspectorFinding, SessionInspectorOutput } from "./inspector-contracts.js";

type DomainInspector = (context: InspectorContext) => Promise<SessionInspectorOutput>;
type RegistryStaticBinding = { bindingId:string; checkId:string; inspectorRef:string; targetSelectorId:string; evidenceModes:string[] };
type RegistryLaw = { capabilityDomain:string; lawId:string; enforcement:{ staticBinding:RegistryStaticBinding|null } };
type Registry = { laws:RegistryLaw[] };
type TargetSet = { queryRef:string; count:number; sha256:string };
type BindingContract = { domain:string; lawId:string; binding:RegistryStaticBinding; targetSet:TargetSet; targetPaths:string[]; registry:Registry };
type SelectedPlan = { planEntry:InspectorContext["planEntry"]; plans:InspectorContext["generatedPlan"]; selectedLawId:string; selectedBinding:RegistryStaticBinding; targetSet:TargetSet; targetPaths:string[] };

export type DomainPredicateResult = Readonly<{
  schemaVersion:2; lawId:string; bindingId:string; checkId:string; targetSelectorId:string;
  evidenceModes:readonly string[]; targetSet:TargetSet; summarySatisfied:boolean; triggeredForbidden:readonly string[];
  assertions:readonly Readonly<{assertionId:string;passed:boolean;evidenceRefs:readonly string[]}>[];
  findings:readonly InspectorFinding[];
}>;

const sha=(value:string|Buffer):string=>createHash("sha256").update(value).digest("hex");
const ordered=(values:readonly string[]):string[]=>[...new Set(values)].sort((left,right)=>Buffer.compare(Buffer.from(left),Buffer.from(right)));

const parseContract=(domain:string):BindingContract=>{
  const raw=process.env.GOVERNANCE_BINDING_CONTRACT?.trim();if(!raw)throw new Error(`GOVERNANCE_BINDING_CONTRACT_MISSING:${domain}`);
  const value=JSON.parse(raw) as BindingContract;
  if(value.domain!==domain||!value.lawId||!value.binding||!value.targetSet||!Array.isArray(value.targetPaths)||!value.registry?.laws)throw new Error(`GOVERNANCE_BINDING_CONTRACT_INVALID:${domain}`);
  const paths=ordered(value.targetPaths);const pathHash=sha(paths.map((path)=>`${path}\n`).join(""));
  if(paths.length!==value.targetSet.count||pathHash!==value.targetSet.sha256||!value.targetSet.queryRef.includes(encodeURIComponent(value.binding.targetSelectorId)))throw new Error(`GOVERNANCE_TARGET_SET_INVALID:${value.binding.bindingId}`);
  return{...value,targetPaths:paths};
};

const selectedPlan=(domain:string):SelectedPlan=>{
  const contract=parseContract(domain);const{registry,binding:selectedBinding,lawId:selectedLawId}=contract;
  const law=registry.laws.find((candidate)=>candidate.capabilityDomain===domain&&candidate.lawId===selectedLawId&&candidate.enforcement.staticBinding?.bindingId===selectedBinding.bindingId);
  if(!law)throw new Error(`GOVERNANCE_BINDING_ID_INVALID:${selectedBinding.bindingId}`);
  const domains=ordered(registry.laws.map((candidate)=>candidate.capabilityDomain));
  const plans=domains.map((currentDomain)=>{const domainLaws=registry.laws.filter((candidate)=>candidate.capabilityDomain===currentDomain);const ownerRef=domainLaws.find((candidate)=>candidate.enforcement.staticBinding)?.enforcement.staticBinding?.inspectorRef;const[ownerInspectorPath="",ownerSelector=""]=ownerRef?.split("#")??[];if(!ownerInspectorPath||!ownerSelector)throw new Error(`GOVERNANCE_INSPECTOR_REF_INVALID:${currentDomain}`);return{capabilityDomain:currentDomain,manifestPath:`scripts/audit/domains/${currentDomain}/manifest.json`,ownerInspectorPath,executionGroup:currentDomain==="audit-system"||currentDomain==="audit-truth"?"meta" as const:"foundation" as const,lawIds:domainLaws.map((candidate)=>candidate.lawId),bindings:domainLaws.flatMap((candidate)=>{const current=candidate.enforcement.staticBinding;if(!current)return[];const[currentFile,currentSelector=""]=current.inspectorRef.split("#");return[{lawId:candidate.lawId,clauseId:`${candidate.lawId.toLowerCase()}-requirement`,checkIds:[current.checkId],evidenceMode:"static" as const,sourceEvidence:[{filePath:currentFile!,symbolName:currentSelector}]}]}),blueprintRefs:[]}});
  const planEntry=plans.find((plan)=>plan.capabilityDomain===domain);if(!planEntry)throw new Error(`GOVERNANCE_DOMAIN_PLAN_MISSING:${domain}`);
  return{selectedLawId,selectedBinding,planEntry,plans,targetSet:contract.targetSet,targetPaths:contract.targetPaths};
};

const evidenceKind=(mode:string):string=>({"static.filesystem":"file","static.text":"text","static.ast":"ast","static.types":"ast","static.contract":"config","static.dependency":"dependency","static.config":"config","static.json":"json","static.yaml":"yaml","static.sql":"sql","static.migration":"file"} as Record<string,string>)[mode]??"file";
const targetEvidenceRefs=(root:string,binding:RegistryStaticBinding,targetPaths:readonly string[]):string[]=>{const observed=targetPaths.map((path)=>({path,sha256:sha(readFileSync(resolve(root,path)))}));return binding.evidenceModes.map((mode)=>{const digest=sha(JSON.stringify({bindingId:binding.bindingId,mode,observed}));return`${evidenceKind(mode)}:sealed-target-set#${encodeURIComponent(`${binding.bindingId}|${mode}`)}:${digest}`}).sort()};

export async function runRestoredDomain(domain:string,inspector:DomainInspector,root=process.cwd()):Promise<InspectorFinding[]>{
  const{planEntry,plans,selectedLawId,selectedBinding,targetSet,targetPaths}=selectedPlan(domain);const sealedRoot=resolve(root);
  if(process.env.GOVERNANCE_SEALED_ROOT!==sealedRoot)throw new Error(`GOVERNANCE_SEALED_ROOT_INVALID:${sealedRoot}`);
  let findings:readonly InspectorFinding[]=[];
  const checks:InspectorContext["checks"]={run:async(_checkId:string,body:()=>InspectorCheckBodyResult|Promise<InspectorCheckBodyResult>)=>body(),runAll:async(body:()=>InspectorCheckBodyResult|Promise<InspectorCheckBodyResult>)=>{const result=await body();findings=result.findings;return result},output:(meta:Record<string,unknown>={})=>({capabilityDomain:domain,reportedLawIds:planEntry.lawIds,checkRuns:[],executedChecks:[{lawId:selectedLawId,clauseId:`${selectedLawId.toLowerCase()}-requirement`,checkId:selectedBinding.checkId}],findings,inspectedFiles:targetPaths,...meta})};
  const context:InspectorContext={project:createAuditProject(sealedRoot,targetPaths),selectedLawId,sealedRoot,targetSet,targetPaths,planEntry,generatedPlan:plans,completedReports:{},checks};
  const output=await inspector(context);const targetPathSet=new Set(targetPaths);const exactFindings=output.findings.filter((finding)=>!finding.filePath||targetPathSet.has(finding.filePath));const refs=targetEvidenceRefs(sealedRoot,selectedBinding,targetPaths);const passed=exactFindings.length===0;
  const result:DomainPredicateResult={schemaVersion:2,lawId:selectedLawId,bindingId:selectedBinding.bindingId,checkId:selectedBinding.checkId,targetSelectorId:selectedBinding.targetSelectorId,evidenceModes:selectedBinding.evidenceModes,targetSet,summarySatisfied:passed,triggeredForbidden:exactFindings.map((finding)=>finding.checkId).sort(),assertions:[{assertionId:`${selectedBinding.checkId}.predicate`,passed,evidenceRefs:refs}],findings:exactFindings};
  process.stdout.write(`GOVERNANCE_COMPONENT_RESULT ${JSON.stringify(result)}\n`);return exactFindings;
}
