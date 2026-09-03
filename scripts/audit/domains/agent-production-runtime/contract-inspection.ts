import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { producerClaimRoutesFor } from "../../shared/proof-observation.js";

const LAWS = {
  core: "LAW-AGENT-PRODUCTION-RUNTIME-001-V32", credential: "LAW-AGENT-PRODUCTION-RUNTIME-002-V1",
  route: "LAW-AGENT-PRODUCTION-RUNTIME-003-V1", admission: "LAW-AGENT-PRODUCTION-RUNTIME-004-V1",
  database: "LAW-AGENT-PRODUCTION-RUNTIME-005-V1", storage: "LAW-AGENT-PRODUCTION-RUNTIME-006-V1",
  staticQuality: "LAW-AGENT-PRODUCTION-RUNTIME-007-V1",
  dynamicProof: "LAW-AGENT-PRODUCTION-RUNTIME-008-V2",
} as const;
const ALL_LAWS = Object.values(LAWS);
const ROOT = "src/lib/local-runtime/production";
const PATHS = {
  admission: `${ROOT}/cloud-reconciliation-client.ts`, inventory: `${ROOT}/runtime-storage-inventory.ts`,
  manifest: "scripts/audit/domains/agent-production-runtime/manifest.json",
  proof: "scripts/acceptance/agent-production-runtime.real-proof.ts",
  routeProjection: `${ROOT}/website-agent-route-policies.v1.json`, store: `${ROOT}/store-foundation.ts`,
  preflight: "scripts/startup/lib/production-contract-preflight.ts",
} as const;
const finding = (lawId: string, checkId: string, filePath: string, message: string): InspectorFinding => createFinding({
  evidenceMode: "static.contract", lawId, clauseId: `${lawId.toLowerCase()}-requirement`,
  checkId, filePath, message,
});
const read = (context: InspectorContext, path: string): string =>
  readFileSync(resolve(context.sealedRoot, path), "utf8");
const sourceFor = (context: InspectorContext, path: string): SourceFile | undefined =>
  context.project.getSourceFile(resolve(context.sealedRoot, path));

const inspectMinimalDependencies = (context: InspectorContext, findings: InspectorFinding[]): void => {
  for (const [path, version, lawId, checkId] of [
    ["docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json", 15,
      LAWS.route, "agent-production-runtime/v15-dependency"],
    ["docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json", 5,
      LAWS.route, "agent-production-runtime/v5-result-dependency"],
  ] as const) {
    const dependency = JSON.parse(read(context, path)) as { version?: unknown; contract?: Record<string, unknown> };
    if (dependency.version !== version || dependency.contract?.version !== version
      || JSON.stringify(Object.keys(dependency.contract ?? {}).sort())
        !== JSON.stringify(["contractId", "providerRepo", "version"])) {
      findings.push(finding(lawId, checkId, path,
        `Runtime dependency is not the canonical three-field version ${version} contract.`));
    }
  }
};

const inspectRouteProjection = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const route = JSON.parse(read(context, PATHS.routeProjection)) as {
    parameter_types?: Record<string, unknown>; routes?: Array<Record<string, unknown>>;
  };
  const routes = route.routes ?? [];
  const resultContracts = routes.filter((entry) => entry.result_contract !== undefined).length;
  const reservations = routes.filter((entry) => {
    const keys = entry.required_parameter_keys;
    return Array.isArray(keys) && keys.includes("reusable_base_reservation_ref")
      && keys.includes("reusable_base_reservation_hash");
  }).length;
  if (routes.length !== 39 || Object.keys(route.parameter_types ?? {}).length !== 57
    || resultContracts !== 30 || reservations !== 2) findings.push(finding(LAWS.route,
    "agent-production-runtime/route-denominator", PATHS.routeProjection, "Route projection is not 39/57/30/2."));
};

const inspectAdmissionHash = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const source = sourceFor(context, PATHS.admission);
  const kind = source?.getVariableDeclaration("admissionKind")?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const hash = source?.getVariableDeclaration("admissionHash")?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const hashCall = hash?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => call.getExpression().getText() === "hashCanonical");
  const fields = new Set(hashCall?.getArguments()[0]?.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .map((property) => property.getName()) ?? []);
  const required = ["job_id", "result_payload_hash", "bazi_domain_admission_receipt_hash",
    "delivery_manifest_id", "delivery_manifest_hash", "review_receipt_hash", "consumer_ref", "outcome"];
  if (!kind || !hashCall || !required.every((field) => fields.has(field))) findings.push(finding(LAWS.admission,
    "agent-production-runtime/admission-hash", PATHS.admission,
    "Admission receipt union is not bound to its complete canonical hash."));
};

const inspectCredentialAndDurableTypes = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const credentialPath = `${ROOT}/transport-protocol.ts`;
  const credentialSchema = sourceFor(context, credentialPath)
    ?.getVariableDeclaration("DeviceCredentialSchema")?.getInitializer();
  const credentialObject = credentialSchema?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression);
  const manifestProperty = credentialObject?.getProperty("control_manifest_hash");
  if (!Node.isPropertyAssignment(manifestProperty) || manifestProperty.getInitializer()?.getText() !== "hash") {
    findings.push(finding(LAWS.credential, "agent-production-runtime/credential-contract", credentialPath,
      "DeviceCredentialSchema does not require the Website manifest hash."));
  }
  const store = sourceFor(context, PATHS.store);
  const taskFields = store?.getInterface("StoredProductionTask")?.getProperties().map((item) => item.getName()) ?? [];
  const outboxFields = store?.getInterface("ProductionOutboxWrite")?.getProperties().map((item) => item.getName()) ?? [];
  if (!["task", "identity", "status", "current_attempt_id", "current_reason"].every((key) => taskFields.includes(key))
    || !["idempotency_key", "kind", "path", "body"].every((key) => outboxFields.includes(key))) {
    findings.push(finding(LAWS.core, "agent-production-runtime/durable-contract", PATHS.store,
      "Runtime durable task and Outbox contracts are incomplete."));
  }
};

const inspectStorageAndLawDenominator = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const storageType = sourceFor(context, PATHS.inventory)?.getTypeAlias("ProductionRuntimeStorageInventory");
  const fields = new Set(storageType?.getDescendantsOfKind(SyntaxKind.PropertySignature)
    .map((property) => property.getName()) ?? []);
  const packageJson = JSON.parse(read(context, "package.json")) as { scripts?: Record<string, unknown> };
  if (!["database_task_count", "outbox_responsibility_count", "pending_outbox_count", "continuation_count",
    "active_lease_count", "directory_count", "owned_directory_count", "orphan_directory_count",
    "orphan_bytes", "orphan_job_ids"]
    .every((field) => fields.has(field)) || packageJson.scripts?.["production-runtime:storage:inventory"]
      !== "node --import tsx scripts/maintenance/production-runtime-storage-reconcile.ts --dry-run") {
    findings.push(finding(LAWS.storage, "agent-production-runtime/storage-contract", PATHS.inventory,
      "Runtime storage inventory fields or its dry-run entrypoint are incomplete."));
  }
  const manifest = JSON.parse(read(context, PATHS.manifest)) as { lawIds?: unknown };
  if (JSON.stringify(manifest.lawIds) !== JSON.stringify(ALL_LAWS)) findings.push(finding(LAWS.staticQuality,
    "agent-production-runtime/law-denominator", PATHS.manifest,
    "Runtime Manifest does not name the exact eight active laws."));
};

const inspectDynamicRoutes = (findings: InspectorFinding[]): void => {
  const expected = [
    `${LAWS.core}:dynamic.database`, `${LAWS.core}:dynamic.recovery`, `${LAWS.core}:dynamic.service`,
    `${LAWS.core}:dynamic.storage`, `${LAWS.credential}:dynamic.authorization`,
    `${LAWS.credential}:dynamic.service`, `${LAWS.admission}:dynamic.service`,
    `${LAWS.database}:dynamic.database`, `${LAWS.database}:dynamic.recovery`, `${LAWS.storage}:dynamic.recovery`,
    `${LAWS.storage}:dynamic.storage`, `${LAWS.dynamicProof}:dynamic.authorization`,
    `${LAWS.dynamicProof}:dynamic.database`, `${LAWS.dynamicProof}:dynamic.recovery`,
    `${LAWS.dynamicProof}:dynamic.service`, `${LAWS.dynamicProof}:dynamic.storage`,
  ].sort();
  const actual = (producerClaimRoutesFor("acceptance:agent-production-runtime:real-proof") ?? [])
    .filter((route) => route.startsWith("LAW-AGENT-PRODUCTION-RUNTIME-"));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) findings.push(finding(LAWS.dynamicProof,
    "agent-production-runtime/dynamic-routes", PATHS.proof,
    "Runtime dynamic claim routes do not match the exact active-law evidence denominator."));
};

export const inspectAgentContracts = (context: InspectorContext, findings: InspectorFinding[]): void => {
  inspectMinimalDependencies(context, findings);
  inspectRouteProjection(context, findings);
  inspectAdmissionHash(context, findings);
  inspectCredentialAndDurableTypes(context, findings);
  inspectStorageAndLawDenominator(context, findings);
  inspectDynamicRoutes(findings);
};
