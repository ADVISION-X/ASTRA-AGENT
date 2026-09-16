import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { producerClaimRoutesFor } from "../../shared/proof-observation.js";

const LAWS = {
  core: "LAW-AGENT-PRODUCTION-RUNTIME-001-V63", credential: "LAW-AGENT-PRODUCTION-RUNTIME-002-V8",
  route: "LAW-AGENT-PRODUCTION-RUNTIME-003-V34", admission: "LAW-AGENT-PRODUCTION-RUNTIME-004-V34",
  database: "LAW-AGENT-PRODUCTION-RUNTIME-005-V33", storage: "LAW-AGENT-PRODUCTION-RUNTIME-006-V36",
  staticQuality: "LAW-AGENT-PRODUCTION-RUNTIME-007-V36",
  dynamicProof: "LAW-AGENT-PRODUCTION-RUNTIME-008-V37",
} as const;
const ALL_LAWS = Object.values(LAWS);
const ROOT = "src/lib/local-runtime/production";
const PATHS = {
  admission: `${ROOT}/cloud-reconciliation-client.ts`, inventory: `${ROOT}/runtime-storage-inventory.ts`,
  cloudClient: `${ROOT}/cloud-client.ts`, workerSession: `${ROOT}/worker-session.ts`,
  controlDependency: `${ROOT}/control-contract-dependency.ts`, executor: `${ROOT}/executor.ts`,
  runtimeLoops: `${ROOT}/runtime-loops.ts`,
  manifest: "scripts/audit/domains/agent-production-runtime/manifest.json",
  proof: "scripts/acceptance/agent-production-runtime.real-proof.ts",
  routeProjection: `${ROOT}/website-agent-route-policies.v1.json`, store: `${ROOT}/store-foundation.ts`,
  contracts: `${ROOT}/contracts.ts`, transport: `${ROOT}/transport-protocol.ts`,
  taskState: `${ROOT}/store-task-state.ts`,
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
    ["docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json", 34,
      LAWS.route, "agent-production-runtime/v34-dependency"],
    ["docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json", 12,
      LAWS.route, "agent-production-runtime/v12-result-dependency"],
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
  if (routes.length !== 40 || Object.keys(route.parameter_types ?? {}).length !== 46
    || resultContracts !== 33 || reservations !== 0) findings.push(finding(LAWS.route,
    "agent-production-runtime/route-denominator", PATHS.routeProjection, "Route projection is not 40/46/33/0."));
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

const inspectCredentialSchema = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const credentialPath = `${ROOT}/transport-protocol.ts`;
  const schema = sourceFor(context, credentialPath)
    ?.getVariableDeclaration("DeviceCredentialSchema")?.getInitializer();
  const manifestProperty = schema?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression)
    ?.getProperty("control_manifest_hash");
  if (manifestProperty) findings.push(finding(LAWS.credential,
    "agent-production-runtime/credential-contract", credentialPath,
    "DeviceCredentialSchema still persists the Website manifest hash."));
};

const inspectLeaseReleaseIdentity = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const release = sourceFor(context, PATHS.cloudClient)?.getFunction("releaseProductionLease")?.getText() ?? "";
  const missingPayload = !release.includes("payload_hash: payloadHash");
  const missingRequest = !release.includes("const requestId = `aiprelease_${hashCanonical({");
  if (missingPayload || missingRequest || release.includes("idempotency_key")) findings.push(finding(LAWS.route,
    "agent-production-runtime/lease-release-identity", PATHS.cloudClient,
    "Lease release must use one deterministic request_id without a duplicate idempotency_key."));
};

const inspectGrantSchema = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const schema = sourceFor(context, PATHS.transport)
    ?.getVariableDeclaration("ExecutionGrantSchema")?.getInitializer();
  const object = schema?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression);
  if (!object?.getProperty("capability_manifest_hash") || object.getProperty("expected_catalog_hash")) {
    findings.push(finding(LAWS.route, "agent-production-runtime/grant-catalog-boundary", PATHS.transport,
      "Execution grant must attest the current capability manifest without freezing its catalog hash into the task."));
  }
};

const inspectDurableState = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const taskState = read(context, PATHS.taskState);
  const attemptRotationCurrent = taskState.includes("existing.current_attempt_id === attemptId")
    && taskState.includes("current_attempt_id=?,current_reason='LEASE_GRANTED'");
  if (!attemptRotationCurrent || taskState.includes("identity_json") || taskState.includes("identity.catalog_hash")) {
    findings.push(finding(LAWS.core, "agent-production-runtime/attempt-identity-rotation", PATHS.taskState,
      "Task state does not strictly resume one attempt and atomically rebind a failed task on a new attempt."));
  }
  const store = sourceFor(context, PATHS.store);
  const taskFields = store?.getInterface("StoredProductionTask")?.getProperties().map((item) => item.getName()) ?? [];
  const outboxFields = store?.getInterface("ProductionOutboxWrite")?.getProperties().map((item) => item.getName()) ?? [];
  const taskShape = ["task", "status", "result", "staged_result", "attempt_failure", "current_attempt_id",
    "current_reason", "updated_at"].every((key) => taskFields.includes(key));
  const outboxShape = ["idempotency_key", "kind", "path", "method", "headers", "body"]
    .every((key) => outboxFields.includes(key));
  if (!taskShape || taskFields.includes("identity") || !outboxShape) findings.push(finding(LAWS.core,
    "agent-production-runtime/durable-contract", PATHS.store,
    "Runtime durable task and Outbox contracts are incomplete."));
};

const inspectCredentialAndDurableTypes = (context: InspectorContext, findings: InspectorFinding[]): void => {
  inspectCredentialSchema(context, findings);
  inspectLeaseReleaseIdentity(context, findings);
  inspectGrantSchema(context, findings);
  inspectDurableState(context, findings);
};

const inspectSessionClaimAtomicity = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const sessionClass = sourceFor(context, PATHS.workerSession)?.getClass("ProductionWorkerSession");
  const serializedClosure = (methodName: string): Node | undefined => sessionClass?.getMethod(methodName)
    ?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => call.getExpression().getText() === "this.runSessionAuthorityTurn")
    ?.getArguments()[0];
  const called = (node: Node | undefined): Set<string> => new Set(
    node?.getDescendantsOfKind(SyntaxKind.CallExpression).map((call) => call.getExpression().getText()) ?? [],
  );
  const heartbeatCalls = called(serializedClosure("heartbeat"));
  const claimCalls = called(serializedClosure("requestClaim"));
  const cloudClaim = sourceFor(context, PATHS.cloudClient)?.getFunction("claimProductionTasks");
  const cloudCalls = called(cloudClaim);
  const sessionOwnsAtomicClaim = heartbeatCalls.has("this.performHeartbeat")
    && claimCalls.has("this.freshAttestationInTurn")
    && claimCalls.has("this.request")
    && cloudCalls.has("session.requestClaim")
    && !cloudCalls.has("session.ensureFreshAttestation")
    && !cloudCalls.has("session.request");
  if (!sessionOwnsAtomicClaim) findings.push(finding(LAWS.core,
    "agent-production-runtime/session-claim-atomicity", PATHS.workerSession,
    "Heartbeat rotation and claim are not closed by the one ProductionWorkerSession authority turn."));
};

const inspectBusinessCapacity = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const dependency = read(context, PATHS.controlDependency);
  const workerSession = read(context, PATHS.workerSession);
  const runtimeLoops = read(context, PATHS.runtimeLoops);
  const executor = read(context, PATHS.executor);
  const cloudClient = read(context, PATHS.cloudClient);
  const oneCapacityOwner = dependency.includes("PRODUCTION_BUSINESS_CAPACITY_MAX = 4 as const")
    && workerSession.includes("agent_attested_in_flight: state.agent_attested_in_flight")
    && !workerSession.includes("business_capacity_total")
    && runtimeLoops.includes("PRODUCTION_BUSINESS_CAPACITY_MAX - businessInFlightCount(state)")
    && runtimeLoops.includes("state.store.pendingBusinessAdmissions()")
    && runtimeLoops.includes("inFlightJobIds.has(job.job_id)")
    && runtimeLoops.includes("agent_attested_in_flight: businessInFlightCount(state)")
    && executor.includes("return PRODUCTION_BUSINESS_CAPACITY_MAX")
    && cloudClient.includes("limit > PRODUCTION_BUSINESS_CAPACITY_MAX")
    && ![workerSession, runtimeLoops, executor, cloudClient]
      .some((source) => /(?:business_capacity_total:\s*10|Math\.min\(10\s*-|return\s+10|limit\s*>\s*10)/u.test(source));
  if (!oneCapacityOwner) findings.push(finding(LAWS.route,
    "agent-production-runtime/business-capacity-max", PATHS.controlDependency,
    "Runtime must expose only the protocol maximum and attest its local active plus admission-pending union without owning the Website device N."));
};

const inspectStorageAndLawDenominator = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const storageType = sourceFor(context, PATHS.inventory)?.getTypeAlias("ProductionRuntimeStorageInventory");
  const fields = new Set(storageType?.getDescendantsOfKind(SyntaxKind.PropertySignature)
    .map((property) => property.getName()) ?? []);
  if (!["database_task_count", "outbox_responsibility_count", "pending_outbox_count",
    "directory_count", "owned_directory_count", "orphan_directory_count",
    "orphan_bytes", "orphan_job_ids"]
    .every((field) => fields.has(field))) {
    findings.push(finding(LAWS.storage, "agent-production-runtime/storage-contract", PATHS.inventory,
      "Runtime storage inventory fields are incomplete."));
  }
  const manifest = JSON.parse(read(context, PATHS.manifest)) as { lawIds?: unknown };
  if (JSON.stringify(manifest.lawIds) !== JSON.stringify(ALL_LAWS)) findings.push(finding(LAWS.staticQuality,
    "agent-production-runtime/law-denominator", PATHS.manifest,
    "Runtime Manifest does not name the exact eight active laws."));
};

const inspectDynamicRoutes = (findings: InspectorFinding[]): void => {
  const expected = [
    `${LAWS.core}:dynamic.database`, `${LAWS.core}:dynamic.service`,
    `${LAWS.core}:dynamic.storage`, `${LAWS.credential}:dynamic.authorization`,
    `${LAWS.credential}:dynamic.service`, `${LAWS.admission}:dynamic.service`,
    `${LAWS.database}:dynamic.database`,
    `${LAWS.storage}:dynamic.storage`, `${LAWS.dynamicProof}:dynamic.authorization`,
    `${LAWS.dynamicProof}:dynamic.database`,
    `${LAWS.dynamicProof}:dynamic.service`, `${LAWS.dynamicProof}:dynamic.storage`,
  ].sort();
  const actual = (producerClaimRoutesFor("acceptance:agent-production-runtime:real-proof", PATHS.proof) ?? [])
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
  inspectSessionClaimAtomicity(context, findings);
  inspectBusinessCapacity(context, findings);
  inspectStorageAndLawDenominator(context, findings);
  inspectDynamicRoutes(findings);
};
