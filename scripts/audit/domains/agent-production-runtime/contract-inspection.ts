import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { producerClaimRoutesFor } from "../../shared/proof-observation.js";

export const LAWS = {
  core: "LAW-AGENT-PRODUCTION-RUNTIME-001-V74", credential: "LAW-AGENT-PRODUCTION-RUNTIME-002-V11",
  route: "LAW-AGENT-PRODUCTION-RUNTIME-003-V42", admission: "LAW-AGENT-PRODUCTION-RUNTIME-004-V42",
  database: "LAW-AGENT-PRODUCTION-RUNTIME-005-V41", storage: "LAW-AGENT-PRODUCTION-RUNTIME-006-V44",
  staticQuality: "LAW-AGENT-PRODUCTION-RUNTIME-007-V44",
  dynamicProof: "LAW-AGENT-PRODUCTION-RUNTIME-008-V45",
} as const;
export const ALL_LAWS = Object.values(LAWS);
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
export const read = (context: InspectorContext, path: string): string =>
  readFileSync(resolve(context.sealedRoot, path), "utf8");
export const sourceFor = (context: InspectorContext, path: string): SourceFile | undefined =>
  context.project.getSourceFile(resolve(context.sealedRoot, path));

const inspectMinimalDependencies = (context: InspectorContext, findings: InspectorFinding[]): void => {
  for (const [path, version, lawId, checkId] of [
    ["docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json", 44,
      LAWS.route, "agent-production-runtime/v44-dependency"],
    ["docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json", 15,
      LAWS.route, "agent-production-runtime/v15-result-dependency"],
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
    contract_version?: unknown; parameter_types?: Record<string, unknown>; routes?: Array<Record<string, unknown>>;
  };
  const routes = route.routes ?? [];
  const resultContracts = routes.filter((entry) => entry.result_contract !== undefined).length;
  const reservations = routes.filter((entry) => {
    const keys = entry.required_parameter_keys;
    return Array.isArray(keys) && keys.includes("reusable_base_reservation_ref")
      && keys.includes("reusable_base_reservation_hash");
  }).length;
  if (route.contract_version !== 15 || routes.length !== 40 || Object.keys(route.parameter_types ?? {}).length !== 48
    || resultContracts !== 33 || reservations !== 0) findings.push(finding(LAWS.route,
    "agent-production-runtime/route-denominator", PATHS.routeProjection,
    "Route projection is not contract v15 with the exact 40/48/33/0 denominator."));
};

const accessedProperties = (node: Node | undefined, receiver: string): string[] =>
  [...new Set(node?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .filter((property) => property.getExpression().getText() === receiver)
    .map((property) => property.getName()) ?? [])].sort();

const generatedImageUploadIsExact = (cloud: SourceFile | undefined): boolean => {
  const upload = cloud?.getFunction("uploadGeneratedImage");
  const calls = upload?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [];
  const firstArguments = (name: string): string[] => calls
    .filter((call) => call.getExpression().getText() === name)
    .map((call) => call.getArguments()[0]?.getText() ?? "");
  const expectedImageProperties = new Set([
    "artifact_id", "bytes", "height", "media_type", "sha256", "webp_bytes", "width",
  ]);
  const localIdentityComparisons = new Set(upload?.getDescendantsOfKind(SyntaxKind.BinaryExpression)
    .map((comparison) => comparison.getText()) ?? []);
  const identityChecks = ["bytes.byteLength !== image.bytes", "sha256(bytes) !== image.sha256",
    'image.media_type !== "image/webp"'];
  const identityGuard = upload?.getDescendantsOfKind(SyntaxKind.IfStatement).find((statement) => {
    const expression = statement.getExpression().getText();
    return identityChecks.every((check) => expression.includes(check));
  });
  const deliveredGuard = upload?.getDescendantsOfKind(SyntaxKind.IfStatement)
    .find((statement) => statement.getExpression().getText() === 'delivered?.state === "delivered"');
  const safeIntegers = firstArguments("Number.isSafeInteger");
  return firstArguments("Buffer.from").includes("image.webp_bytes")
    && safeIntegers.includes("image.width") && safeIntegers.includes("image.height")
    && identityChecks.every((check) => localIdentityComparisons.has(check))
    && identityGuard !== undefined && deliveredGuard !== undefined
    && identityGuard.getStart() < deliveredGuard.getStart()
    && accessedProperties(upload, "image").every((property) => expectedImageProperties.has(property))
    && !(upload?.getDescendantsOfKind(SyntaxKind.NumericLiteral)
      .some((literal) => literal.getLiteralValue() === 1200 || literal.getLiteralValue() === 630) ?? true);
};

const generatedImageReceiptIsV6 = (context: InspectorContext, cloud: SourceFile | undefined): boolean => {
  const transport = sourceFor(context, PATHS.transport);
  const receiptInitializer = transport?.getVariableDeclaration("UploadedResultReceiptSchema")?.getInitializer();
  const receiptObject = receiptInitializer?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression);
  const receiptFields = receiptObject?.getProperties().flatMap((property) =>
    Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)
      ? [property.getName()] : []).sort() ?? [];
  const exactReceiptFields = ["artifact_id", "byte_length", "media_type", "object_ref", "receipt_hash",
    "role", "schema_version", "sha256", "state"].sort();
  const receiptExpression = Node.isCallExpression(receiptInitializer) ? receiptInitializer.getExpression() : undefined;
  const receiptIsStrict = receiptExpression !== undefined
    && Node.isPropertyAccessExpression(receiptExpression)
    && receiptExpression.getName() === "strict";
  const exactReceipt = cloud?.getVariableDeclaration("exactGeneratedImageReceipt")?.getInitializer();
  return receiptIsStrict && JSON.stringify(receiptFields) === JSON.stringify(exactReceiptFields)
    && JSON.stringify(accessedProperties(exactReceipt, "receipt"))
      === JSON.stringify(["artifact_id", "byte_length", "media_type", "role", "sha256"])
    && JSON.stringify(accessedProperties(exactReceipt, "image"))
      === JSON.stringify(["bytes", "media_type", "sha256"]);
};

export const inspectGeneratedImageTransport = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const projection = JSON.parse(read(context, PATHS.routeProjection)) as {
    routes?: Array<{ product_id?: unknown; action_id?: unknown; result_contract?: {
      image?: { exact_fields?: unknown; field_types?: { integer?: unknown };
        integer_minimums?: unknown; mime_type?: unknown; width?: unknown; height?: unknown } } }>;
  };
  const image = projection.routes?.find((route) => route.product_id === "public_knowledge_article_pipeline"
    && route.action_id === "produce_article")?.result_contract?.image;
  const exactFields = ["schema_version", "artifact_id", "object_ref", "sha256", "receipt_hash",
    "bytes", "mime_type", "width", "height"];
  const validProjection = JSON.stringify(image?.exact_fields) === JSON.stringify(exactFields)
    && JSON.stringify(image?.field_types?.integer) === JSON.stringify(["bytes", "width", "height"])
    && JSON.stringify(image?.integer_minimums) === JSON.stringify({ bytes: 1 })
    && image?.mime_type === "image/webp"
    && image.width === undefined && image.height === undefined;
  if (!validProjection) findings.push(finding(LAWS.route,
    "agent-production-runtime/generated-image-v13-projection", PATHS.routeProjection,
    "Public knowledge image projection must require actual integer dimensions without fixed or range geometry gates."));

  const cloud = sourceFor(context, PATHS.cloudClient);
  if (!generatedImageUploadIsExact(cloud) || !generatedImageReceiptIsV6(context, cloud)) findings.push(finding(LAWS.route,
    "agent-production-runtime/generated-image-transport-boundary", PATHS.cloudClient,
    "Runtime must upload only the WebP identity and must not add Provider originals, fixed geometry, or dimensions to the V6 transport receipt."));
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
  const builder = sourceFor(context, PATHS.cloudClient)?.getFunction("buildProductionLeaseRelease")?.getText() ?? "";
  const release = sourceFor(context, PATHS.cloudClient)?.getFunction("releaseProductionLease")?.getText() ?? "";
  const builderOwnsIdentity = builder.includes("payload_hash: payloadHash")
    && builder.includes("const requestId = `aiprelease_${hashCanonical({")
    && builder.includes("body_payload_hash: request.payload_hash")
    && builder.includes("write_request_payload_hash: hashCanonical(request)");
  const releaseUsesBuiltRequest = release.includes("const { request } = built")
    && release.includes("body: JSON.stringify(request)")
    && release.includes("return request.request_id");
  if (!builderOwnsIdentity || !releaseUsesBuiltRequest
    || builder.includes("idempotency_key") || release.includes("idempotency_key")) findings.push(finding(LAWS.route,
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
  inspectCurrentReasonAuthority(context, findings);
};

const inspectCurrentReasonAuthority = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const controlPaths = [
    `${ROOT}/store-source-readback.ts`, PATHS.taskState, `${ROOT}/store-outbox.ts`,
    PATHS.runtimeLoops, `${ROOT}/runtime-claim-recovery.ts`,
    `${ROOT}/runtime-claim-operations.ts`, PATHS.admission,
  ];
  for (const path of controlPaths) {
    const source = sourceFor(context, path);
    if (!source) continue;
    const branches = [
      ...source.getDescendantsOfKind(SyntaxKind.IfStatement).map((node) => node.getExpression()),
      ...source.getDescendantsOfKind(SyntaxKind.ConditionalExpression).map((node) => node.getCondition()),
    ];
    const reasonBranch = branches.some((condition) => {
      const accesses = condition.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
        .filter((node) => node.getName() === "current_reason");
      const reasonAccess = accesses.length > 0;
      const reasonAlias = (Node.isIdentifier(condition) && condition.getText() === "currentReason")
        || condition.getDescendantsOfKind(SyntaxKind.Identifier)
          .some((node) => node.getText() === "currentReason");
      if (!reasonAccess && !reasonAlias) return false;
      if (path !== PATHS.admission) return true;
      const owner = condition.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
      if (owner?.getName() === "deviceStatusAuthorityFieldsValid" && !reasonAlias
        && accesses.every((access) => {
          const parent = access.getParent();
          return Node.isTypeOfExpression(parent)
            || Node.isBinaryExpression(parent) && parent.getOperatorToken().getKind() === SyntaxKind.EqualsEqualsEqualsToken
              && parent.getRight().getKind() === SyntaxKind.NullKeyword
            || Node.isCallExpression(parent) && parent.getExpression().getText() === "Array.isArray";
        })) return false;
      const projection = condition.getFirstAncestorByKind(SyntaxKind.PropertyAssignment);
      return projection?.getName() !== "current_reason";
    });
    const reasonSqlGate = [
      ...source.getDescendantsOfKind(SyntaxKind.TemplateExpression),
      ...source.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
    ].some((node) => /\bwhere\b[\s\S]*\bcurrent_reason\b/iu.test(node.getText()));
    if (reasonBranch || reasonSqlGate) findings.push(finding(LAWS.core,
      "agent-production-runtime/current-reason-diagnostic-only", path,
      "Diagnostic current_reason must not authorize source seal, stage, recovery, capacity or deletion."));
  }
  const taskState = sourceFor(context, PATHS.taskState)?.getClass("ProductionStoreTaskState");
  const hasProtectedStage = taskState?.getMethod("stageResultInTerminalTransaction")?.getScope() === "protected";
  if (!hasProtectedStage || taskState?.getMethod("stageResult")) findings.push(finding(LAWS.core,
    "agent-production-runtime/atomic-stage-owner", PATHS.taskState,
    "Stage must only be available inside the atomic terminal transaction."));
  const diagnosticResolverConsumers = new Set([
    `${ROOT}/store-ledger.ts`, `${ROOT}/store-authority-reader.ts`,
    `${ROOT}/operations-snapshot.ts`,
  ]);
  for (const source of context.project.getSourceFiles()) {
    const relative = source.getFilePath().slice(context.sealedRoot.length + 1);
    if (!relative.startsWith("src/") || diagnosticResolverConsumers.has(relative)) continue;
    const importedResolver = source.getImportDeclarations().some((declaration) =>
      declaration.getNamedImports().some((named) =>
        ["resolveProductionAuthority", "resolveStoredProductionAuthority"].includes(named.getName())));
    const referencedResolver = source.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .some((node) => node.getName() === "resolveAuthority");
    const consumesResolver = importedResolver || referencedResolver;
    if (consumesResolver) findings.push(finding(LAWS.staticQuality,
      "agent-production-runtime/diagnostic-authority-resolver-boundary", relative,
      "production-task authority hash resolver is diagnostic only; production control consumption is P0."));
  }
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
    && runtimeLoops.includes("businessInFlightJobIds(state).has(job.job_id)")
    && runtimeLoops.includes("agent_attested_in_flight: businessInFlightCount(state)")
    && executor.includes("return PRODUCTION_BUSINESS_CAPACITY_MAX")
    && cloudClient.includes("limit > PRODUCTION_BUSINESS_CAPACITY_MAX")
    && ![workerSession, runtimeLoops, executor, cloudClient]
      .some((source) => /(?:business_capacity_total:\s*10|Math\.min\(10\s*-|return\s+10|limit\s*>\s*10)/u.test(source));
  if (!oneCapacityOwner) findings.push(finding(LAWS.route,
    "agent-production-runtime/business-capacity-max", PATHS.controlDependency,
    "Runtime must expose only the protocol maximum and attest its local active plus admission-pending union without owning the Website device N."));
  const exactParentLocator = ["parent.status !== \"completed\"",
    "parent.result.result_payload_ref !== task.parent_result_ref",
    "parent.result.result_payload_hash !== task.parent_result_hash",
    "providerContinuationParent", "jobId: parent.task.job_id",
    "acceptedAttemptId: parent.current_attempt_id"].every((token) => executor.includes(token));
  if (!exactParentLocator) findings.push(finding(LAWS.core,
    "agent-production-runtime/completed-parent-locator", PATHS.executor,
    "Runtime must bind the accepted completed-parent attempt only after the exact Website result triple is validated."));
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
  inspectGeneratedImageTransport(context, findings);
  inspectAdmissionHash(context, findings);
  inspectCredentialAndDurableTypes(context, findings);
  inspectSessionClaimAtomicity(context, findings);
  inspectBusinessCapacity(context, findings);
  inspectStorageAndLawDenominator(context, findings);
  inspectDynamicRoutes(findings);
};

export const runtimeManifestOwnershipDrift = (ownedPaths: readonly string[]): string[] => {
  const runtimeOwnedPath = (path: string): boolean =>
    path === "docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md"
    || path === "docs/specs/agent-production-runtime/**"
    || path.startsWith("scripts/acceptance/agent-production-runtime")
    || path === "scripts/acceptance/agent-route-contract.acceptance.ts"
    || path === "scripts/audit/domains/agent-production-runtime/**"
    || path === "scripts/generate/sync-website-agent-route-policy-projection.ts"
    || path === "scripts/maintenance/production-runtime-storage-reconcile.ts"
    || path === "src/lib/execution-failure.ts"
    || path === "src/lib/local-runtime/production/**";
  return ownedPaths.filter((path) => !runtimeOwnedPath(path));
};
