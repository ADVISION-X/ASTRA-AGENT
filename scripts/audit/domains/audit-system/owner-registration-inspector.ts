import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

type Finding = { code: string; detail: string; path: string };
type Registry = { domains?: Array<{ capabilityDomain?: unknown; lawIds?: unknown }>; laws?:Array<{capabilityDomain?:unknown;enforcement?:{staticBinding?:{inspectorRef?:unknown}|null}}> };

export const inspectOwnerRegistrations = (root: string): Finding[] => {
  const registry = JSON.parse(readFileSync(resolve(root, "scripts/audit/generated/law-registry.generated.json"), "utf8")) as Registry;
  const findings: Finding[] = [];
  for (const domain of registry.domains ?? []) {
    if (typeof domain.capabilityDomain !== "string") continue;
    const manifestPath = `scripts/audit/domains/${domain.capabilityDomain}/manifest.json`;
    if (!existsSync(resolve(root, manifestPath))) findings.push({ code: "AUDIT_MANIFEST_MISSING", detail: domain.capabilityDomain, path: manifestPath });
    const checkPath=`scripts/audit/domains/${domain.capabilityDomain}/check.ts`;
    if(!existsSync(resolve(root,checkPath)))findings.push({code:"AUDIT_OWNER_ROUTE_MISSING",detail:domain.capabilityDomain,path:checkPath});
    const staticLaws=(registry.laws??[]).filter((law)=>law.capabilityDomain===domain.capabilityDomain&&law.enforcement?.staticBinding);
    if(staticLaws.some((law)=>typeof law.enforcement?.staticBinding?.inspectorRef!=="string"))findings.push({code:"AUDIT_OWNER_ROUTE_MISSING",detail:`${domain.capabilityDomain}:registry inspectorRef`,path:"scripts/audit/generated/law-registry.generated.json"});
  }
  const manifestDomains = readdirSync(resolve(root, "scripts/audit/domains"), { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync(resolve(root, "scripts/audit/domains", entry.name, "manifest.json"))).map((entry) => entry.name);
  const registryDomains = new Set((registry.domains ?? []).flatMap((domain) => typeof domain.capabilityDomain === "string" ? [domain.capabilityDomain] : []));
  for (const domain of manifestDomains) if (!registryDomains.has(domain)) findings.push({ code: "AUDIT_ORPHAN_MANIFEST", detail: domain, path: `scripts/audit/domains/${domain}/manifest.json` });
  return findings;
};
