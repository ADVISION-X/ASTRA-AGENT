import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { Node, type SourceFile } from "ts-morph";

type Finding = { code: string; detail: string; path: string };
type Registry = { domains?: Array<{ capabilityDomain?: unknown; lawIds?: unknown }> };

const routeNames = (source: SourceFile): Set<string> => {
  const declaration = source.getVariableDeclaration("DOMAIN_READY_SCRIPTS");
  const initializer = declaration?.getInitializer();
  const object = Node.isCallExpression(initializer) ? initializer.getArguments()[0] : initializer;
  if (!Node.isObjectLiteralExpression(object)) return new Set();
  return new Set(object.getProperties().flatMap((property) => Node.isPropertyAssignment(property) ? [property.getName().replaceAll('"', "").replaceAll("'", "")] : []));
};

export const inspectOwnerRegistrations = (root: string, source: SourceFile): Finding[] => {
  const registry = JSON.parse(readFileSync(resolve(root, "scripts/audit/generated/law-registry.generated.json"), "utf8")) as Registry;
  const routes = routeNames(source);
  const findings: Finding[] = [];
  for (const domain of registry.domains ?? []) {
    if (typeof domain.capabilityDomain !== "string") continue;
    const manifestPath = `scripts/audit/domains/${domain.capabilityDomain}/manifest.json`;
    if (!existsSync(resolve(root, manifestPath))) findings.push({ code: "AUDIT_MANIFEST_MISSING", detail: domain.capabilityDomain, path: manifestPath });
    if (!routes.has(domain.capabilityDomain)) findings.push({ code: "AUDIT_OWNER_ROUTE_MISSING", detail: domain.capabilityDomain, path: source.getFilePath() });
  }
  const manifestDomains = readdirSync(resolve(root, "scripts/audit/domains"), { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync(resolve(root, "scripts/audit/domains", entry.name, "manifest.json"))).map((entry) => entry.name);
  const registryDomains = new Set((registry.domains ?? []).flatMap((domain) => typeof domain.capabilityDomain === "string" ? [domain.capabilityDomain] : []));
  for (const domain of manifestDomains) if (!registryDomains.has(domain)) findings.push({ code: "AUDIT_ORPHAN_MANIFEST", detail: domain, path: `scripts/audit/domains/${domain}/manifest.json` });
  return findings;
};
