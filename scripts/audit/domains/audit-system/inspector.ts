import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { Project } from "ts-morph";

import { inspectAcceptanceDeliveryIsolation } from "./acceptance-delivery-isolation-inspector.js";
import { inspectBinaryVerdict } from "./binary-verdict-inspector.js";
import { inspectCiControlIntegrity } from "./ci-control-integrity-inspector.js";
import { inspectCiEntryOrder } from "./ci-entry-order-inspector.js";
import { inspectCiFailureLedger } from "./ci-failure-ledger-inspector.js";
import { inspectCiPhaseIntegrity } from "./ci-phase-integrity-inspector.js";
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
import type { InspectorContext, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { createFinding, selectLawId } from "../../shared/finding-utils.js";

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
  "audit:truth:enforce": "node --import tsx scripts/audit/domains/audit-truth/check.ts",
  "ci:full": "GRASSEYE_QUALITY_REPORT_MODE=external npm run quality:check -- READY",
  "quality:check": "node --import tsx scripts/audit/governance.ts quality",
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
    if (manifest.schemaVersion !== 4 || manifest.status !== "active" || manifest.capabilityDomain !== domain || JSON.stringify(actual) !== JSON.stringify(lawIds.sort())) {
      findings.push(finding("AUDIT_MANIFEST_LAW_DENOMINATOR_INVALID", relative, domain));
    }
  }
  return findings;
};

export function inspectAuditSystem(root = process.cwd(), sealedTargetPaths?: readonly string[], sealedProject?: Project): AuditSystemFinding[] {
  const packagePath = resolve(root, "package.json");
  const registryPath = resolve(root, "scripts/audit/generated/law-registry.generated.json");
  const governancePath = resolve(root, "scripts/audit/governance.ts");
  const authorityPath = resolve(root, "scripts/audit/governance-authority.ts");
  const qualityPath = resolve(root, "scripts/audit/governance-quality.ts");
  const pkg = readJson<PackageJson>(packagePath);
  const registry = readJson<Registry>(registryPath);
  const project = sealedProject ?? new Project({ tsConfigFilePath: resolve(root, "tsconfig.json"), skipAddingFilesFromTsConfig: true });
  if(!sealedProject)project.addSourceFilesAtPaths(resolve(root, "scripts/audit/**/*.ts"));
  const governance = project.getSourceFileOrThrow(governancePath);
  const authority = project.getSourceFileOrThrow(authorityPath);
  const quality = project.getSourceFileOrThrow(qualityPath);
  const findings: AuditSystemFinding[] = [
    ...validatePackageScripts(pkg.scripts ?? {}),
    ...validateAcceptanceBindings(pkg.scripts ?? {}, registry.laws ?? []).map((detail) => finding("AUDIT_ACCEPTANCE_BINDING_INVALID", "package.json", detail)),
    ...inspectAcceptanceDeliveryIsolation(project),
    ...inspectBinaryVerdict(quality),
    ...inspectCiControlIntegrity(governance, quality, pkg),
    ...inspectCiEntryOrder(governance),
    ...inspectCiFailureLedger(quality),
    ...inspectCiPhaseIntegrity(governance),
    ...inspectGeneratedArtifactTruth(root, authority),
    ...inspectManualMatrixConsumption(project),
    ...inspectNodeHttpServer(project),
    ...inspectOwnerEvaluationIntegrity(governance),
    ...inspectOwnerFilesystemMutation(project),
    ...inspectOwnerRegistrations(root),
    ...inspectPhysicalCheckReceipt(governance),
    ...inspectPrimaryEvidence(quality),
    ...inspectStaleCodePurityReport(root, sealedTargetPaths),
    ...inspectTaskPersistenceIsolation(governance, quality),
  ];

  const generated = readdirSync(resolve(root, "scripts/audit/generated")).filter((name) => !name.startsWith(".")).sort();
  if (JSON.stringify(generated) !== JSON.stringify(["law-registry.generated.json"])) findings.push(finding("AUDIT_GENERATED_TRUTH_MULTIPLIED", "scripts/audit/generated", generated.join(",")));
  if (registry.lawCorpus?.baseLawPath !== ".github/instructions/agent-rules/基础法案.md" || registry.lawCorpus?.functionalLawPath !== ".github/instructions/agent-rules/功能法案.md") {
    findings.push(finding("AUDIT_ACTIVE_LAW_SOURCE_INVALID", "scripts/audit/generated/law-registry.generated.json", "registry must bind the two frozen law containers"));
  }
  findings.push(...manifestFindings(root, registry));
  return findings.sort((left, right) => left.code.localeCompare(right.code) || left.path.localeCompare(right.path) || left.detail.localeCompare(right.detail));
}

export async function inspectDomain(context: InspectorContext): Promise<SessionInspectorOutput> {
  let outputFindings = [] as ReturnType<typeof createFinding>[];
  await context.checks.runAll(async () => {
    const lawId = context.selectedLawId;
    outputFindings = inspectAuditSystem(context.sealedRoot, context.targetPaths, context.project).map((item) => createFinding({
      lawId,
      checkId: item.code,
      filePath: item.path,
      message: item.detail,
    }));
    return { findings: outputFindings, evidenceRefs: [context.planEntry.ownerInspectorPath] };
  });
  return context.checks.output();
}
