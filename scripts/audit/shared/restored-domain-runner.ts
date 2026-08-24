import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createAuditProject } from "./project.js";
import type {
  InspectorCheckBodyResult,
  InspectorContext,
  InspectorFinding,
  SessionInspectorOutput,
} from "./inspector-contracts.js";

type DomainInspector = (context: InspectorContext) => Promise<SessionInspectorOutput>;
type RegistryStaticBinding = {
  bindingId: string;
  checkId: string;
  inspectorRef: string;
  evidenceModes: string[];
};
type RegistryLaw = {
  capabilityDomain: string;
  lawId: string;
  enforcement: { staticBinding: RegistryStaticBinding | null };
};
type Registry = { laws: RegistryLaw[] };

const selectedPlan = (root: string, domain: string): { planEntry: InspectorContext["planEntry"]; plans:InspectorContext["generatedPlan"]; selectedLawId: string } => {
  const registry = JSON.parse(readFileSync(resolve(root, "scripts/audit/generated/law-registry.generated.json"), "utf8")) as Registry;
  const requestedBindingId = process.env.GOVERNANCE_BINDING_ID?.trim();
  if (!requestedBindingId) throw new Error(`GOVERNANCE_BINDING_ID_MISSING:${domain}`);
  const law = registry.laws.find((candidate) => candidate.capabilityDomain === domain
    && candidate.enforcement.staticBinding?.bindingId === requestedBindingId);
  const binding = law?.enforcement.staticBinding;
  if (!law || !binding) throw new Error(`GOVERNANCE_BINDING_ID_INVALID:${requestedBindingId}`);
  const domains=[...new Set(registry.laws.map((candidate)=>candidate.capabilityDomain))].sort();
  const plans=domains.map((currentDomain)=>{const domainLaws=registry.laws.filter((candidate)=>candidate.capabilityDomain===currentDomain);const ownerRef=domainLaws.find((candidate)=>candidate.enforcement.staticBinding)?.enforcement.staticBinding?.inspectorRef;const [ownerInspectorPath="",ownerSelector=""]=ownerRef?.split("#")??[];if(!ownerInspectorPath||!ownerSelector)throw new Error(`GOVERNANCE_INSPECTOR_REF_INVALID:${currentDomain}`);return{capabilityDomain:currentDomain,manifestPath:`scripts/audit/domains/${currentDomain}/manifest.json`,ownerInspectorPath,executionGroup:currentDomain==="audit-system"||currentDomain==="audit-truth"?"meta" as const:"foundation" as const,lawIds:domainLaws.map((candidate)=>candidate.lawId),bindings:domainLaws.flatMap((candidate)=>{const current=candidate.enforcement.staticBinding;if(!current)return[];const [currentFile,currentSelector=""]=current.inspectorRef.split("#");return[{lawId:candidate.lawId,clauseId:`${candidate.lawId.toLowerCase()}-requirement`,checkIds:[current.checkId],evidenceMode:"static" as const,sourceEvidence:[{filePath:currentFile!,symbolName:currentSelector.split("|")[0]??""}]}]}),blueprintRefs:[]}});
  const planEntry=plans.find((plan)=>plan.capabilityDomain===domain);if(!planEntry)throw new Error(`GOVERNANCE_DOMAIN_PLAN_MISSING:${domain}`);
  return { selectedLawId: law.lawId, planEntry, plans };
};

export async function runRestoredDomain(domain: string, inspector: DomainInspector, root = process.cwd()): Promise<InspectorFinding[]> {
  const {planEntry,plans,selectedLawId} = selectedPlan(root, domain);
  let findings: readonly InspectorFinding[] = [];
  const checks: InspectorContext["checks"] = {
    run: async (_checkId: string, body: () => InspectorCheckBodyResult | Promise<InspectorCheckBodyResult>) => body(),
    runAll: async (body: () => InspectorCheckBodyResult | Promise<InspectorCheckBodyResult>) => {
      const result = await body(); findings = result.findings; return result;
    },
    output: (meta: Record<string, unknown> = {}) => ({
      capabilityDomain: domain, reportedLawIds: planEntry.lawIds, checkRuns: [], executedChecks: [], findings,
      inspectedFiles: [], ...meta,
    }),
  };
  const context: InspectorContext = {
    project: createAuditProject(root), planEntry, generatedPlan: plans, completedReports: {}, checks,
  };
  const output = await inspector(context);
  return output.findings.filter((finding)=>finding.lawId===selectedLawId);
}
