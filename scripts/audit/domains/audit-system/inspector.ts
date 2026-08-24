import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { Node, Project, SyntaxKind, type ArrayLiteralExpression, type ObjectLiteralExpression } from "ts-morph";

export type AuditSystemFinding = {
  code: string;
  detail: string;
  path: string;
};

type PackageJson = { scripts?: Record<string, string> };
type RegistryLaw = { capabilityDomain?: unknown; lawId?: unknown };
type Registry = {
  lawCorpus?: { baseLawPath?: unknown; functionalLawPath?: unknown };
  laws?: RegistryLaw[];
};
type Manifest = {
  capabilityDomain?: unknown;
  lawIds?: unknown;
  schemaVersion?: unknown;
  status?: unknown;
};

const REQUIRED_SCRIPTS = Object.freeze({
  "audit:code-purity:enforce": "node --import tsx scripts/audit/domains/code-purity/check.ts",
  "audit:system:enforce": "node --import tsx scripts/audit/domains/audit-system/check.ts",
  "ci:full": "GRASSEYE_QUALITY_REPORT_MODE=external npm run quality:check -- READY",
  "quality:check": "node --import tsx scripts/audit/governance-v32.ts quality",
});

const REQUIRED_ROUTES = Object.freeze({
  "architecture-boundary": ["audit:architecture-boundary:enforce"],
  "audit-system": ["audit:system:enforce"],
  "capability-governance": ["audit:capability-governance:enforce"],
  "code-purity": ["audit:code-purity:enforce"],
  "runtime-log-spine": ["audit:runtime-log-spine:enforce"],
  "system-security": ["audit:system-security:enforce"],
});

const finding = (code: string, path: string, detail: string): AuditSystemFinding => ({ code, detail, path });
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const stringArray = (value: unknown): string[] => Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];

export function validatePackageScripts(scripts: Record<string, string>): AuditSystemFinding[] {
  const findings: AuditSystemFinding[] = [];
  for (const [name, command] of Object.entries(REQUIRED_SCRIPTS)) {
    if (scripts[name] !== command) findings.push(finding("AUDIT_COMMAND_SURFACE_INVALID", "package.json", `${name} must equal ${command}`));
  }
  const qualityNames = Object.keys(scripts).filter((name) => name.includes("quality") || name.includes("verdict"));
  const unexpected = qualityNames.filter((name) => name !== "quality:check");
  if (unexpected.length > 0) findings.push(finding("AUDIT_SECOND_QUALITY_SURFACE", "package.json", unexpected.sort().join(",")));
  return findings;
}

const unwrapObject = (initializer: Node | undefined): ObjectLiteralExpression | undefined => {
  if (!initializer) return undefined;
  if (Node.isObjectLiteralExpression(initializer)) return initializer;
  if (!Node.isCallExpression(initializer)) return undefined;
  const first = initializer.getArguments()[0];
  return first && Node.isObjectLiteralExpression(first) ? first : undefined;
};

const stringValues = (array: ArrayLiteralExpression): string[] => array.getElements().flatMap((element) => Node.isStringLiteral(element) ? [element.getLiteralValue()] : []);

export function readDomainRoutes(sourcePath: string): Record<string, string[]> {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const source = project.addSourceFileAtPath(sourcePath);
  const declaration = source.getVariableDeclarationOrThrow("DOMAIN_READY_SCRIPTS");
  const object = unwrapObject(declaration.getInitializer());
  if (!object) return {};
  const routes: Record<string, string[]> = {};
  for (const property of object.getProperties()) {
    if (!Node.isPropertyAssignment(property)) continue;
    const initializer = property.getInitializer();
    if (!initializer || !Node.isArrayLiteralExpression(initializer)) continue;
    routes[property.getName().replaceAll("'", "").replaceAll('"', "")] = stringValues(initializer);
  }
  return routes;
}

export function validateDomainRoutes(routes: Record<string, string[]>): AuditSystemFinding[] {
  const findings: AuditSystemFinding[] = [];
  for (const [domain, expected] of Object.entries(REQUIRED_ROUTES)) {
    if (JSON.stringify(routes[domain]) !== JSON.stringify(expected)) {
      findings.push(finding("AUDIT_OWNER_ROUTE_MISSING", "scripts/audit/governance-v32.ts", `${domain}:${JSON.stringify(routes[domain] ?? [])}`));
    }
  }
  return findings;
}

const validateGovernanceAst = (sourcePath: string): AuditSystemFinding[] => {
  const findings: AuditSystemFinding[] = [];
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const source = project.addSourceFileAtPath(sourcePath);
  const requiredFunctions = ["checkProjection", "projectChecks", "quality", "validateQualityReport", "verifyCommands", "writeReport"];
  for (const name of requiredFunctions) if (!source.getFunction(name)) findings.push(finding("AUDIT_REQUIRED_FUNCTION_MISSING", sourcePath, name));
  const quality = source.getFunction("quality");
  const called = new Set(quality?.getDescendantsOfKind(SyntaxKind.CallExpression).map((call) => call.getExpression().getText()) ?? []);
  for (const name of ["projectChecks", "writeReport"]) if (!called.has(name)) findings.push(finding("AUDIT_VERDICT_CHAIN_BROKEN", sourcePath, `quality does not call ${name}`));
  const projectChecks = source.getFunction("projectChecks");
  const identifiers = new Set(projectChecks?.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText()) ?? []);
  if (!identifiers.has("DOMAIN_READY_SCRIPTS")) findings.push(finding("AUDIT_OWNER_ROUTING_BYPASSED", sourcePath, "projectChecks does not consume DOMAIN_READY_SCRIPTS"));
  return findings;
};

const manifestFindings = (root: string, registry: Registry): AuditSystemFinding[] => {
  const findings: AuditSystemFinding[] = [];
  const laws = Array.isArray(registry.laws) ? registry.laws : [];
  const expected = new Map<string, string[]>();
  for (const law of laws) {
    if (typeof law.capabilityDomain !== "string" || typeof law.lawId !== "string") continue;
    const current = expected.get(law.capabilityDomain) ?? [];
    current.push(law.lawId);
    expected.set(law.capabilityDomain, current);
  }
  for (const [domain, lawIds] of expected) {
    const relative = `scripts/audit/domains/${domain}/manifest.json`;
    const absolute = resolve(root, relative);
    if (!existsSync(absolute)) {
      findings.push(finding("AUDIT_MANIFEST_MISSING", relative, domain));
      continue;
    }
    const manifest = readJson<Manifest>(absolute);
    const actual = stringArray(manifest.lawIds);
    if (manifest.schemaVersion !== 3 || manifest.status !== "active" || manifest.capabilityDomain !== domain || JSON.stringify(actual) !== JSON.stringify(lawIds.sort())) {
      findings.push(finding("AUDIT_MANIFEST_LAW_DENOMINATOR_INVALID", relative, domain));
    }
  }
  return findings;
};

export function inspectAuditSystem(root = process.cwd()): AuditSystemFinding[] {
  const findings: AuditSystemFinding[] = [];
  const packagePath = resolve(root, "package.json");
  const registryPath = resolve(root, "scripts/audit/generated/law-registry.generated.json");
  const governancePath = resolve(root, "scripts/audit/governance-v32.ts");
  const pkg = readJson<PackageJson>(packagePath);
  findings.push(...validatePackageScripts(pkg.scripts ?? {}));
  findings.push(...validateDomainRoutes(readDomainRoutes(governancePath)));
  findings.push(...validateGovernanceAst(governancePath));

  const generated = readdirSync(resolve(root, "scripts/audit/generated")).filter((name) => !name.startsWith(".")).sort();
  if (JSON.stringify(generated) !== JSON.stringify(["law-registry.generated.json"])) findings.push(finding("AUDIT_GENERATED_TRUTH_MULTIPLIED", "scripts/audit/generated", generated.join(",")));
  const registry = readJson<Registry>(registryPath);
  if (registry.lawCorpus?.baseLawPath !== ".github/instructions/agent-rules/基础法案.md" || registry.lawCorpus?.functionalLawPath !== ".github/instructions/agent-rules/功能法案.md") {
    findings.push(finding("AUDIT_ACTIVE_LAW_SOURCE_INVALID", "scripts/audit/generated/law-registry.generated.json", "registry must bind the two frozen law containers"));
  }
  const lawIds = new Set((registry.laws ?? []).flatMap((law) => typeof law.lawId === "string" ? [law.lawId] : []));
  for (const lawId of ["LAW-ARCHITECTURE-BOUNDARY-001-V1", "LAW-AUDIT-SYSTEM-001-V1", "LAW-CAPABILITY-GOVERNANCE-001-V1", "LAW-CODE-PURITY-001-V1", "LAW-SYSTEM-SECURITY-001-V1"]) if (!lawIds.has(lawId)) findings.push(finding("AUDIT_RESTORED_LAW_MISSING", registryPath, lawId));
  findings.push(...manifestFindings(root, registry));
  return findings.sort((left, right) => left.code.localeCompare(right.code) || left.path.localeCompare(right.path) || left.detail.localeCompare(right.detail));
}
