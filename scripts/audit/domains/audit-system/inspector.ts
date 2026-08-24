import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { Node, Project, type ArrayLiteralExpression, type ObjectLiteralExpression } from "ts-morph";

import { inspectAcceptanceDeliveryIsolation } from "./acceptance-delivery-isolation-inspector.js";
import { inspectBinaryVerdict } from "./binary-verdict-inspector.js";
import { inspectCiControlIntegrity } from "./ci-control-integrity-inspector.js";
import { inspectCiEntryOrder } from "./ci-entry-order-inspector.js";
import { inspectCiFailureLedger } from "./ci-failure-ledger-inspector.js";
import { inspectCiPhaseIntegrityEntry } from "./ci-phase-integrity-entry-inspector.js";
import { inspectGeneratedArtifactTruth } from "./generated-artifact-truth-inspector.js";
import { inspectManualMatrixConsumption } from "./manual-matrix-consumption-inspector.js";
import { inspectNodeHttpServer } from "./node-http-server-inspector.js";
import { inspectOwnerEvaluationIntegrity } from "./owner-evaluation-integrity-inspector.js";
import { inspectOwnerFilesystemMutation } from "./owner-filesystem-mutation-inspector.js";
import { inspectOwnerRegistrations } from "./owner-registration-inspector.js";
import { inspectPhysicalCheckReceipt } from "./physical-check-receipt-inspector.js";
import { inspectPrimaryEvidence } from "./primary-evidence-inspector.js";
import { inspectStaleCodePurityReport } from "./stale-code-purity-text-report.js";
import { inspectTaskPersistenceIsolation } from "./task-persistence-isolation-inspector.js";
import { validateAcceptanceBindings } from "./canonical-quality-plan.js";

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
type RecoveryItem = { legacySource?: unknown; targetPath?: unknown; targetPaths?: unknown; targetLawFile?: unknown; targetLawId?: unknown; currentSha256?: unknown; donorGitBlob?: unknown; semanticStatus?: unknown; enforcementStatus?: unknown; behaviorStatus?: unknown; testStatus?: unknown; ciStatus?: unknown; evidenceStatus?: unknown; comparisonStatus?: unknown; retirementDecision?: unknown };
type RecoveryLedger = {
  donorCommit?: unknown;
  canonicalCaller?: unknown;
  activeLawSources?: unknown;
  counts?: Record<string, unknown>;
  sourceModules?: RecoveryItem[];
  lawRecords?: RecoveryItem[];
  auditSystemFiles?: RecoveryItem[];
  codePurityFiles?: RecoveryItem[];
  ciDonors?: RecoveryItem[];
  acceptanceBindings?: RecoveryItem[];
  forbiddenRestorations?: unknown;
};

const REQUIRED_SCRIPTS = Object.freeze({
  "audit:code-purity:enforce": "node --import tsx scripts/audit/domains/code-purity/check.ts",
  "audit:system:enforce": "node --import tsx scripts/audit/domains/audit-system/check.ts",
  "audit:truth:enforce": "node --import tsx scripts/audit/domains/audit-truth/check.ts",
  "ci:full": "GRASSEYE_QUALITY_REPORT_MODE=external npm run quality:check -- READY",
  "quality:check": "node --import tsx scripts/audit/governance-v32.ts quality",
});

const REQUIRED_ROUTES = Object.freeze({
  "architecture-boundary": ["audit:architecture-boundary:enforce"],
  "audit-system": ["audit:system:enforce"],
  "audit-truth": ["audit:truth:enforce"],
  "capability-governance": ["audit:capability-governance:enforce"],
  "code-purity": ["audit:code-purity:enforce"],
  "runtime-log-spine": ["audit:runtime-log-spine:enforce"],
  "system-security": ["audit:system-security:enforce"],
});

const REQUIRED_RESTORED_LAWS = Object.freeze([
  "LAW-ARCHITECTURE-BOUNDARY-001-V1",
  "LAW-AUDIT-SYSTEM-001-V1",
  "LAW-AUDIT-TRUTH-001-V1",
  "LAW-CAPABILITY-GOVERNANCE-001-V1",
  "LAW-CODE-PURITY-001-V1",
  "LAW-SYSTEM-SECURITY-001-V1",
]);

const finding = (code: string, path: string, detail: string): AuditSystemFinding => ({ code, detail, path });
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const stringArray = (value: unknown): string[] => Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
const sha256File = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

const RECOVERY_DONOR = "8e6f8c3773b3332617f725a9df85377870040522";
const RECOVERY_LEDGER_PATH = "docs/governance/AGENT-foundation-recovery-ledger.json";

const readRecoveryLedger = (root: string): RecoveryLedger | AuditSystemFinding => {
  const absolute = resolve(root, RECOVERY_LEDGER_PATH);
  if (!existsSync(absolute)) return finding("AUDIT_RECOVERY_LEDGER_MISSING", RECOVERY_LEDGER_PATH, RECOVERY_LEDGER_PATH);
  try { return readJson<RecoveryLedger>(absolute); } catch {
    return finding("AUDIT_RECOVERY_LEDGER_INVALID", RECOVERY_LEDGER_PATH, "invalid JSON");
  }
};

const recoveryLedgerIdentityFindings = (ledger: RecoveryLedger): AuditSystemFinding[] => {
  const findings: AuditSystemFinding[] = [];
  const expectedCounts = { sourceModules: 14, lawRecords: 70, auditSystemFiles: 21, codePurityFiles: 36, ciDonors: 4, acceptanceBindings: 12 };
  const sources = [".github/instructions/agent-rules/基础法案.md", ".github/instructions/agent-rules/功能法案.md"];
  if (ledger.donorCommit !== RECOVERY_DONOR || ledger.canonicalCaller !== "quality:check") {
    findings.push(finding("AUDIT_RECOVERY_DONOR_INVALID", RECOVERY_LEDGER_PATH, String(ledger.donorCommit)));
  }
  if (JSON.stringify(ledger.activeLawSources) !== JSON.stringify(sources)) {
    findings.push(finding("AUDIT_RECOVERY_ACTIVE_SOURCE_INVALID", RECOVERY_LEDGER_PATH, JSON.stringify(ledger.activeLawSources)));
  }
  if (JSON.stringify(ledger.counts) !== JSON.stringify(expectedCounts)) {
    findings.push(finding("AUDIT_RECOVERY_DENOMINATOR_INVALID", RECOVERY_LEDGER_PATH, JSON.stringify(ledger.counts)));
  }
  return findings;
};

const recoveryItems = (ledger: RecoveryLedger): RecoveryItem[] | null => {
  const groups = [ledger.lawRecords, ledger.auditSystemFiles, ledger.codePurityFiles, ledger.ciDonors, ledger.acceptanceBindings];
  return groups.every(Array.isArray) ? groups.flat() as RecoveryItem[] : null;
};

const recoveryItemStatusFindings = (items: RecoveryItem[]): AuditSystemFinding[] => {
  const findings: AuditSystemFinding[] = [];
  const sources = items.map((item) => item.legacySource).filter((value): value is string => typeof value === "string");
  if (sources.length !== items.length || new Set(sources).size !== sources.length || sources.some((source) => !source.startsWith(`${RECOVERY_DONOR}:`))) {
    findings.push(finding("AUDIT_RECOVERY_SOURCE_IDENTITY_INVALID", RECOVERY_LEDGER_PATH, "legacySource"));
  }
  if (items.some((item) => [item.semanticStatus, item.enforcementStatus, item.behaviorStatus, item.testStatus].includes("MISSING")
    || item.ciStatus !== "CALLED" || item.evidenceStatus !== "BOUND")) {
    findings.push(finding("AUDIT_RECOVERY_STATUS_INCOMPLETE", RECOVERY_LEDGER_PATH, "MISSING/NOT_CALLED/UNBOUND"));
  }
  return findings;
};

const recoveryLawFindings = (ledger: RecoveryLedger, registry: Registry): AuditSystemFinding[] => {
  const findings: AuditSystemFinding[] = [];
  const lawIds = new Set((registry.laws ?? []).flatMap((law) => typeof law.lawId === "string" ? [law.lawId] : []));
  const lawFiles = [".github/instructions/agent-rules/基础法案.md", ".github/instructions/agent-rules/功能法案.md"];
  for (const item of ledger.lawRecords ?? []) {
    if (typeof item.targetLawId !== "string" || !lawIds.has(item.targetLawId)) {
      findings.push(finding("AUDIT_RECOVERY_TARGET_LAW_MISSING", RECOVERY_LEDGER_PATH, String(item.targetLawId)));
    }
    if (typeof item.targetLawFile !== "string" || !lawFiles.includes(item.targetLawFile)) {
      findings.push(finding("AUDIT_RECOVERY_TARGET_SOURCE_INVALID", RECOVERY_LEDGER_PATH, String(item.targetLawFile)));
    }
  }
  return findings;
};

const donorBlobMatches = (root: string, item: RecoveryItem): boolean => {
  if (typeof item.donorGitBlob !== "string" || typeof item.legacySource !== "string") return true;
  const donorPath = item.legacySource.slice(RECOVERY_DONOR.length + 1);
  if (!donorPath) return false;
  try {
    return execFileSync("git", ["rev-parse", `${RECOVERY_DONOR}:${donorPath}`], {
      cwd: root, encoding: "utf8",
    }).trim() === item.donorGitBlob;
  } catch { return false; }
};

const recoverySourceModuleFindings = (root: string, ledger: RecoveryLedger): AuditSystemFinding[] => {
  const findings: AuditSystemFinding[] = [];
  const modules = ledger.sourceModules ?? [];
  const sources = modules.map((item) => item.legacySource).filter((value): value is string => typeof value === "string");
  if (modules.length !== 14 || sources.length !== 14 || new Set(sources).size !== 14) {
    findings.push(finding("AUDIT_RECOVERY_SOURCE_MODULE_DENOMINATOR_INVALID", RECOVERY_LEDGER_PATH, String(modules.length)));
  }
  for (const item of modules) {
    if (item.comparisonStatus !== "INVENTORIED" || item.retirementDecision !== "HISTORY_ONLY") {
      findings.push(finding("AUDIT_RECOVERY_SOURCE_MODULE_STATUS_INVALID", RECOVERY_LEDGER_PATH, String(item.legacySource)));
    }
    if (!donorBlobMatches(root, item)) {
      findings.push(finding("AUDIT_RECOVERY_DONOR_BLOB_DRIFT", RECOVERY_LEDGER_PATH, String(item.legacySource)));
    }
  }
  return findings;
};

const recoveryFileFindings = (root: string, ledger: RecoveryLedger): AuditSystemFinding[] => {
  const findings: AuditSystemFinding[] = [];
  const groups = [...(ledger.auditSystemFiles ?? []), ...(ledger.codePurityFiles ?? []), ...(ledger.ciDonors ?? [])];
  for (const item of groups) {
    const targets = typeof item.targetPath === "string" ? [item.targetPath] : stringArray(item.targetPaths);
    if (targets.length === 0 || targets.some((target) => !existsSync(resolve(root, target)))) {
      findings.push(finding("AUDIT_RECOVERY_TARGET_FILE_MISSING", RECOVERY_LEDGER_PATH, String(item.legacySource)));
    }
    if (typeof item.currentSha256 === "string" && targets.length === 1 && sha256File(resolve(root, targets[0]!)) !== item.currentSha256) {
      findings.push(finding("AUDIT_RECOVERY_TARGET_BYTES_DRIFT", targets[0]!, String(item.legacySource)));
    }
    if (!donorBlobMatches(root, item)) {
      findings.push(finding("AUDIT_RECOVERY_DONOR_BLOB_DRIFT", RECOVERY_LEDGER_PATH, String(item.legacySource)));
    }
  }
  return findings;
};

const recoveryLedgerFindings = (root: string, registry: Registry): AuditSystemFinding[] => {
  const ledger = readRecoveryLedger(root);
  if ("code" in ledger) return [ledger];
  const items = recoveryItems(ledger);
  if (!items) return [...recoveryLedgerIdentityFindings(ledger), finding(
    "AUDIT_RECOVERY_LEDGER_INVALID", RECOVERY_LEDGER_PATH, "record group missing",
  )];
  return [
    ...recoveryLedgerIdentityFindings(ledger),
    ...recoveryItemStatusFindings(items),
    ...recoverySourceModuleFindings(root, ledger),
    ...recoveryLawFindings(ledger, registry),
    ...recoveryFileFindings(root, ledger),
  ];
};

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
    const name = property.getNameNode();
    if (Node.isStringLiteral(name)) routes[name.getLiteralValue()] = stringValues(initializer);
    else if (Node.isIdentifier(name)) routes[name.getText()] = stringValues(initializer);
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
  const packagePath = resolve(root, "package.json");
  const registryPath = resolve(root, "scripts/audit/generated/law-registry.generated.json");
  const governancePath = resolve(root, "scripts/audit/governance-v32.ts");
  const pkg = readJson<PackageJson>(packagePath);
  const registry = readJson<Registry>(registryPath);
  const project = new Project({ tsConfigFilePath: resolve(root, "tsconfig.json"), skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths(resolve(root, "scripts/audit/**/*.ts"));
  const governance = project.getSourceFileOrThrow(governancePath);
  const findings: AuditSystemFinding[] = [
    ...validatePackageScripts(pkg.scripts ?? {}),
    ...validateAcceptanceBindings(pkg.scripts ?? {}, registry.laws ?? []).map((detail) => finding("AUDIT_ACCEPTANCE_BINDING_INVALID", "package.json", detail)),
    ...validateDomainRoutes(readDomainRoutes(governancePath)),
    ...inspectAcceptanceDeliveryIsolation(project),
    ...inspectBinaryVerdict(governance),
    ...inspectCiControlIntegrity(governance, pkg),
    ...inspectCiEntryOrder(governance),
    ...inspectCiFailureLedger(governance),
    ...inspectCiPhaseIntegrityEntry(governance),
    ...inspectGeneratedArtifactTruth(root, governance),
    ...inspectManualMatrixConsumption(project),
    ...inspectNodeHttpServer(project),
    ...inspectOwnerEvaluationIntegrity(governance),
    ...inspectOwnerFilesystemMutation(project),
    ...inspectOwnerRegistrations(root, governance),
    ...inspectPhysicalCheckReceipt(governance),
    ...inspectPrimaryEvidence(governance),
    ...inspectStaleCodePurityReport(root),
    ...inspectTaskPersistenceIsolation(governance),
    ...recoveryLedgerFindings(root, registry),
  ];

  const generated = readdirSync(resolve(root, "scripts/audit/generated")).filter((name) => !name.startsWith(".")).sort();
  if (JSON.stringify(generated) !== JSON.stringify(["law-registry.generated.json"])) findings.push(finding("AUDIT_GENERATED_TRUTH_MULTIPLIED", "scripts/audit/generated", generated.join(",")));
  if (registry.lawCorpus?.baseLawPath !== ".github/instructions/agent-rules/基础法案.md" || registry.lawCorpus?.functionalLawPath !== ".github/instructions/agent-rules/功能法案.md") {
    findings.push(finding("AUDIT_ACTIVE_LAW_SOURCE_INVALID", "scripts/audit/generated/law-registry.generated.json", "registry must bind the two frozen law containers"));
  }
  const lawIds = new Set((registry.laws ?? []).flatMap((law) => typeof law.lawId === "string" ? [law.lawId] : []));
  for (const lawId of REQUIRED_RESTORED_LAWS) if (!lawIds.has(lawId)) findings.push(finding("AUDIT_RESTORED_LAW_MISSING", "scripts/audit/generated/law-registry.generated.json", lawId));
  findings.push(...manifestFindings(root, registry));
  return findings.sort((left, right) => left.code.localeCompare(right.code) || left.path.localeCompare(right.path) || left.detail.localeCompare(right.detail));
}
