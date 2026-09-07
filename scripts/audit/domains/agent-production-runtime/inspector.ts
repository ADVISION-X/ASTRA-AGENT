import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorEvaluation, InspectorFinding, SessionInspectorOutput } from
  "../../shared/inspector-contracts.js";
import { recordStaticCheck } from "../../shared/static-inspection-contract.js";
import { observeStaticMode } from "../../shared/static-target-object-inspector.js";
import { producerClaimRoutesFor } from "../../shared/proof-observation.js";
import { inspectAgentAuthorityAst } from "./authority-inspection.js";
import { inspectAgentContracts } from "./contract-inspection.js";
import { buildAgentProductionSessionOutput } from "./session-output.js";

const LAWS = {
  core: "LAW-AGENT-PRODUCTION-RUNTIME-001-V43",
  credential: "LAW-AGENT-PRODUCTION-RUNTIME-002-V3",
  route: "LAW-AGENT-PRODUCTION-RUNTIME-003-V13",
  admission: "LAW-AGENT-PRODUCTION-RUNTIME-004-V13",
  database: "LAW-AGENT-PRODUCTION-RUNTIME-005-V11",
  storage: "LAW-AGENT-PRODUCTION-RUNTIME-006-V13",
  staticQuality: "LAW-AGENT-PRODUCTION-RUNTIME-007-V13",
  dynamicProof: "LAW-AGENT-PRODUCTION-RUNTIME-008-V14",
} as const;
const ALL_LAWS = Object.values(LAWS);
const ROOT = "src/lib/local-runtime/production";
const PATHS = {
  startup: `${ROOT}/runtime-startup.ts`,
  runtimeState: `${ROOT}/runtime-state.ts`,
  runtimeClaim: `${ROOT}/runtime-claim.ts`,
  credential: `${ROOT}/credential.ts`,
  contracts: `${ROOT}/contracts.ts`,
  routePolicy: `${ROOT}/route-policy.ts`,
  routeProjection: `${ROOT}/website-agent-route-policies.v1.json`,
  routeGenerator: "scripts/generate/sync-website-agent-route-policy-projection.ts",
  preflight: "scripts/startup/lib/production-contract-preflight.ts",
  admission: `${ROOT}/cloud-reconciliation-client.ts`,
  runtimeContract: `${ROOT}/runtime-contract.ts`,
  store: `${ROOT}/store-foundation.ts`,
  authority: `${ROOT}/store-authority-reader.ts`,
  inventory: `${ROOT}/runtime-storage-inventory.ts`,
  maintenance: "scripts/maintenance/production-runtime-storage-reconcile.ts",
  manifest: "scripts/audit/domains/agent-production-runtime/manifest.json",
  proof: "scripts/acceptance/agent-production-runtime.real-proof.ts",
} as const;

type StaticMode = "static.ast" | "static.contract" | "static.dependency"
  | "static.filesystem" | "static.sql" | "static.types";
const finding = (
  lawId: string,
  evidenceMode: StaticMode,
  checkId: string,
  filePath: string,
  message: string,
): InspectorFinding => createFinding({
  evidenceMode, lawId, clauseId: `${lawId.toLowerCase()}-requirement`,
  checkId, filePath, message,
});
const read = (context: InspectorContext, path: string): string =>
  readFileSync(resolve(context.sealedRoot, path), "utf8");
const sourceFor = (context: InspectorContext, path: string): SourceFile | undefined =>
  context.project.getSourceFile(resolve(context.sealedRoot, path));
const stringLiterals = (source: SourceFile | undefined): Set<string> => new Set(
  source?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralValue()) ?? [],
);
const calledStringArguments = (
  source: SourceFile | undefined,
  functionName: string,
  argumentIndex = 0,
): Set<string> => new Set(
  (source?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? []).flatMap((call) => {
    if (call.getExpression().getText() !== functionName) return [];
    const argument = call.getArguments()[argumentIndex];
    return argument && Node.isStringLiteral(argument) ? [argument.getLiteralValue()] : [];
  }),
);
const calledArgumentStringLiterals = (
  source: Node | undefined,
  functionName: string,
  argumentIndex = 0,
): Set<string> => new Set(
  (source?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? []).flatMap((call) => {
    if (call.getExpression().getText() !== functionName) return [];
    const argument = call.getArguments()[argumentIndex];
    if (!argument) return [];
    return [
      ...(Node.isStringLiteral(argument) ? [argument.getLiteralValue()] : []),
      ...argument.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralValue()),
    ];
  }),
);
const calledLiteralSources = (
  source: Node | undefined,
  methodName: string,
): string[] => (source?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? []).flatMap((call) => {
  const expression = call.getExpression();
  if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== methodName) return [];
  const argument = call.getArguments()[0];
  if (!argument) return [];
  if (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument)) {
    return [argument.getLiteralValue()];
  }
  if (Node.isTemplateExpression(argument)) return [argument.getText()];
  return [];
});
const variableDeclaration = (source: SourceFile | undefined, name: string) =>
  source?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === name);
const hasNumericInequality = (
  source: SourceFile | undefined,
  identifier: string,
  value: number,
): boolean => (source?.getDescendantsOfKind(SyntaxKind.BinaryExpression) ?? []).some((expression) => {
  if (expression.getOperatorToken().getText() !== "!==") return false;
  const left = expression.getLeft();
  const right = expression.getRight();
  return (Node.isIdentifier(left) && left.getText() === identifier
      && Node.isNumericLiteral(right) && Number(right.getLiteralValue()) === value)
    || (Node.isIdentifier(right) && right.getText() === identifier
      && Node.isNumericLiteral(left) && Number(left.getLiteralValue()) === value);
});

export function inspectAgentFilesystem(
  context: InspectorContext,
  findings: InspectorFinding[],
): void {
  const required = [
    [LAWS.credential, PATHS.credential],
    [LAWS.storage, PATHS.inventory], [LAWS.storage, PATHS.maintenance],
    [LAWS.staticQuality, PATHS.manifest], [LAWS.dynamicProof, PATHS.proof],
  ] as const;
  for (const [lawId, path] of required) if (!existsSync(resolve(context.sealedRoot, path))) {
    findings.push(finding(lawId, "static.filesystem", "agent-production-runtime/required-object", path,
      `Required Runtime object is absent: ${path}.`));
  }
  const manifest = JSON.parse(read(context, PATHS.manifest)) as { ownedPaths?: unknown };
  if (!Array.isArray(manifest.ownedPaths)) {
    findings.push(finding(LAWS.staticQuality, "static.filesystem",
      "agent-production-runtime/manifest-shape", PATHS.manifest, "Runtime Manifest ownedPaths is invalid."));
  }
}

const inspectCoreAst = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const startup = sourceFor(context, PATHS.startup);
  const state = sourceFor(context, PATHS.runtimeState);
  const claim = sourceFor(context, PATHS.runtimeClaim);
  const startupTokens = stringLiterals(startup);
  for (const token of ["GPT_CONTINUATION_CURRENT_CHECKPOINT_MISSING", "GPT_CONTINUATION_FRONTIER_INVALID"]) {
    if (startupTokens.has(token)) findings.push(finding(LAWS.core, "static.ast",
      "agent-production-runtime/product-startup-token", PATHS.startup,
      `Runtime startup retains Product-specific token ${token}.`));
  }
  if (startup?.getFunction("failClosedInvalidContinuationFrontiers")
    || startup?.getDescendantsOfKind(SyntaxKind.Identifier)
      .some((node) => node.getText() === "failClosedInvalidContinuationFrontiers")) {
    findings.push(finding(LAWS.core, "static.ast", "agent-production-runtime/product-startup-recovery",
      PATHS.startup, "Runtime startup retains Product frontier reconstruction."));
  }
  if (state?.getImportDeclarations().some((declaration) =>
    declaration.getModuleSpecifierValue().includes("/browser/exact-target/"))) {
    findings.push(finding(LAWS.core, "static.ast", "agent-production-runtime/no-browser-private-store",
      PATHS.runtimeState, "Runtime diagnosis imports Browser private authority state."));
  }
  if (claim?.getImportDeclarations().some((declaration) =>
    declaration.getNamedImports().some((entry) => entry.getName() === "rm"))) {
    findings.push(finding(LAWS.storage, "static.ast", "agent-production-runtime/no-automatic-storage-delete",
      PATHS.runtimeClaim, "Business admission still triggers automatic task storage deletion."));
  }
};

const inspectCredentialAst = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const credential = sourceFor(context, PATHS.credential);
  const failureCodes = new Set([
    ...calledStringArguments(credential, "credentialFailure"),
    ...stringLiterals(credential),
  ]);
  for (const code of [
    "PRODUCTION_CREDENTIAL_PARENT_MISSING", "PRODUCTION_CREDENTIAL_MISSING",
    "PRODUCTION_CREDENTIAL_PARENT_PERMISSIONS_INVALID", "PRODUCTION_CREDENTIAL_FILE_PERMISSIONS_INVALID",
    "PRODUCTION_CREDENTIAL_SYMLINK_INVALID", "PRODUCTION_CREDENTIAL_JSON_INVALID",
    "PRODUCTION_CREDENTIAL_SCHEMA_INVALID", "PRODUCTION_CREDENTIAL_CONTROL_MANIFEST_MISSING",
    "PRODUCTION_CREDENTIAL_ORIGIN_INVALID",
  ]) if (!failureCodes.has(code)) findings.push(finding(LAWS.credential, "static.ast",
    "agent-production-runtime/credential-failure-code", PATHS.credential,
    `Credential reader is missing typed failure ${code}.`));
};

const inspectContractAst = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const generator = sourceFor(context, PATHS.routeGenerator);
  if (generator?.getVariableDeclaration("resultContractRoutes")
    || !hasNumericInequality(generator, "resultContractCount", 31)
    || !hasNumericInequality(generator, "reusableBaseReservationRouteCount", 2)) {
    findings.push(finding(LAWS.route, "static.ast", "agent-production-runtime/provider-derived-route-contract",
      PATHS.routeGenerator, "Route generator retains a route allowlist or misses current provider denominators."));
  }
  const routePolicy = sourceFor(context, PATHS.routePolicy);
  const contracts = sourceFor(context, PATHS.contracts);
  const retiredRuntimeDecisions = ["parameterValidators", "primaryProducts", "routeProducesGeneratedImage"]
    .filter((name) => routePolicy?.getVariableDeclaration(name) || routePolicy?.getFunction(name));
  const projectedRoutes = JSON.parse(read(context, PATHS.routeProjection)) as {
    routes?: Array<{ product_id?: unknown; action_id?: unknown }>;
  };
  const productActionValues = new Set((projectedRoutes.routes ?? []).flatMap((route) =>
    [route.product_id, route.action_id].filter((value): value is string => typeof value === "string")));
  const hardcodedProductActions = [...stringLiterals(routePolicy)].filter((value) => productActionValues.has(value));
  const boundedStringSchema = (name: string): boolean => {
    const initializer = contracts?.getVariableDeclaration(name)?.getInitializer();
    const calls = [
      ...(Node.isCallExpression(initializer) ? [initializer] : []),
      ...(initializer?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? []),
    ];
    const callNamed = (name: string): boolean => calls.some((call) => {
      const expression = call.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === name;
    });
    return calls.some((call) => call.getExpression().getText() === "z.string")
      && callNamed("min") && callNamed("max");
  };
  const taskSchema = contracts?.getVariableDeclaration("WebsiteAgentTaskSchema")?.getInitializer();
  const actionDerivedRelation = taskSchema?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((access) => access.getName() === "action_id") ?? false;
  if (retiredRuntimeDecisions.length || hardcodedProductActions.length
    || !boundedStringSchema("ProductionProductIdSchema")
    || !boundedStringSchema("ProductionActionIdSchema") || actionDerivedRelation) {
    findings.push(finding(LAWS.route, "static.ast", "agent-production-runtime/no-business-route-adjudication",
      PATHS.routePolicy, "Runtime retains Product/Action tables, parameter-value adjudication or action-derived relation semantics."));
  }
  const admission = stringLiterals(sourceFor(context, PATHS.admission));
  for (const field of ["bazi_domain_admission_receipt_hash", "delivery_manifest_id",
    "delivery_manifest_hash", "review_receipt_hash"]) if (!admission.has(field)) {
    findings.push(finding(LAWS.admission, "static.ast", "agent-production-runtime/admission-receipt-field",
      PATHS.admission, `Admission parser is missing ${field}.`));
  }
};

const inspectDatabaseAst = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const store = sourceFor(context, PATHS.store);
  const sqlCalls = [...calledLiteralSources(store, "prepare"), ...calledLiteralSources(store, "pragma")];
  for (const token of ["select sql from sqlite_master", "pragma table_info", "pragma index_list",
    "pragma index_info", "pragma foreign_key_list", "integrity_check", "foreign_key_check"]) {
    if (!sqlCalls.some((call) => call.includes(token))) {
    findings.push(finding(LAWS.database, "static.ast", "agent-production-runtime/exact-schema-readback",
      PATHS.store, `Runtime schema validator is missing ${token}.`));
    }
  }
  const startup = sourceFor(context, PATHS.startup);
  const startupCalls = startup?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .map((call) => call.getExpression().getText()) ?? [];
  if (!startupCalls.includes("store.assertStartupDataIntegrity")) {
    findings.push(finding(LAWS.database, "static.ast", "agent-production-runtime/data-integrity-startup",
      PATHS.startup, "Runtime startup does not fail closed on generic persisted-data corruption."));
  }
  const authoritySource = sourceFor(context, PATHS.authority);
  const authorityFailures = calledArgumentStringLiterals(authoritySource, "executionFailure", 1);
  for (const code of ["PRODUCTION_AUTHORITY_STORE_MISSING", "PRODUCTION_AUTHORITY_STORE_UNREADABLE",
    "PRODUCTION_AUTHORITY_STORE_CORRUPT"]) if (!authorityFailures.has(code)) {
    findings.push(finding(LAWS.database, "static.ast", "agent-production-runtime/authority-failure",
      PATHS.authority, `Authority reader is missing ${code}.`));
  }
  const swallowsAsMissing = (authoritySource?.getDescendantsOfKind(SyntaxKind.CatchClause) ?? [])
    .some((clause) => clause.getBlock().getDescendantsOfKind(SyntaxKind.ReturnStatement)
      .some((statement) => {
        const expression = statement.getExpression();
        return Node.isStringLiteral(expression) && expression.getLiteralValue() === "missing";
      }));
  if (swallowsAsMissing) {
    findings.push(finding(LAWS.database, "static.ast", "agent-production-runtime/no-authority-swallow",
      PATHS.authority, "Authority reader still converts read failures to missing."));
  }
};

const inspectStorageAst = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const inventory = sourceFor(context, PATHS.inventory);
  const maintenance = sourceFor(context, PATHS.maintenance);
  const writeImports = new Set(["mkdir", "open", "rename", "rm", "unlink", "writeFile"]);
  const importsMutation = (source: SourceFile | undefined): boolean =>
    source?.getImportDeclarations().some((declaration) =>
      declaration.getNamedImports().some((entry) => writeImports.has(entry.getName()))) ?? false;
  if (importsMutation(inventory) || importsMutation(maintenance)) {
    findings.push(finding(LAWS.storage, "static.ast", "agent-production-runtime/storage-inventory-read-only",
      PATHS.inventory, "Storage inventory imports a filesystem mutation primitive."));
  }
  const startup = sourceFor(context, PATHS.startup);
  const startupCalls = new Set(startup?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .map((call) => call.getExpression().getText()) ?? []);
  const startupFailures = calledArgumentStringLiterals(startup, "executionFailure", 1);
  if (!startupCalls.has("readProductionRuntimeStorageInventory") || !startupCalls.has("store.storageResponsibilities")
    || !startupFailures.has("PRODUCTION_ORPHAN_STORAGE_RECONCILIATION_REQUIRED")) {
    findings.push(finding(LAWS.storage, "static.ast", "agent-production-runtime/storage-startup-gate",
      PATHS.startup, "Runtime startup does not bind DB responsibilities and fail closed on orphan storage."));
  }
  const taskPath = inventory?.getFunction("productionRuntimeTaskPath");
  const taskPathFailures = calledArgumentStringLiterals(taskPath, "executionFailure", 1);
  const claimUsesTaskPath = sourceFor(context, PATHS.runtimeClaim)?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => call.getExpression().getText() === "productionRuntimeTaskPath") ?? false;
  if (!taskPathFailures.has("PRODUCTION_STORAGE_JOB_ID_INVALID") || !claimUsesTaskPath) {
    findings.push(finding(LAWS.storage, "static.ast", "agent-production-runtime/storage-path-boundary",
      PATHS.inventory, "Runtime task storage is not bound to one validated root child."));
  }
  const maintenanceTokens = stringLiterals(maintenance);
  const readonlyDatabase = maintenance?.getDescendantsOfKind(SyntaxKind.NewExpression)
    .some((expression) => {
      if (expression.getExpression().getText() !== "Database") return false;
      const options = expression.getArguments()[1];
      if (!Node.isObjectLiteralExpression(options)) return false;
      return ["readonly", "fileMustExist"].every((name) => {
        const property = options.getProperty(name);
        return Node.isPropertyAssignment(property) && property.getInitializer()?.getText() === "true";
      });
    }) ?? false;
  if (!maintenanceTokens.has("--dry-run")
    || !maintenanceTokens.has("PRODUCTION_STORAGE_MAINTENANCE_DRY_RUN_ONLY")
    || !readonlyDatabase) {
    findings.push(finding(LAWS.storage, "static.ast", "agent-production-runtime/storage-maintenance-guard",
      PATHS.maintenance, "Storage maintenance is not an exact read-only dry-run command."));
  }
};

const inspectQualityAst = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const inspector = sourceFor(context, "scripts/audit/domains/agent-production-runtime/inspector.ts");
  if (inspector?.getImportDeclarations().some((declaration) => {
    const module = declaration.getModuleSpecifierValue();
    return module.includes("/plugins/") || module.includes("agent-product")
      || module.includes("/gpt/") || module.includes("/browser/");
  })) {
    findings.push(finding(LAWS.staticQuality, "static.ast", "agent-production-runtime/no-product-quality",
      "scripts/audit/domains/agent-production-runtime/inspector.ts",
      "Runtime inspector still enumerates Product implementation."));
  }
  const proof = stringLiterals(sourceFor(context, PATHS.proof));
  const retiredCoreLaw = LAWS.core.replace(/V([0-9]+)$/u, (_, version: string) =>
    `V${Number(version) - 1}`);
  if (proof.has(retiredCoreLaw)) {
    findings.push(finding(LAWS.dynamicProof, "static.ast", "agent-production-runtime/proof-law-current",
      PATHS.proof, "Runtime proof still asserts retired V31."));
  }
};

export function inspectAgentProductionRuntime(
  context: InspectorContext,
  findings: InspectorFinding[],
): void {
  inspectCoreAst(context, findings);
  inspectCredentialAst(context, findings);
  inspectContractAst(context, findings);
  inspectDatabaseAst(context, findings);
  inspectAgentAuthorityAst(context, findings);
  inspectStorageAst(context, findings);
  inspectQualityAst(context, findings);
}

export function inspectAgentTypes(
  context: InspectorContext,
  findings: InspectorFinding[],
): void {
  const admissionReceipt = sourceFor(context, PATHS.admission)
    ?.getTypeAlias("BusinessAdmissionReceipt");
  if (!admissionReceipt?.isExported() || admissionReceipt.getType().isAny()) {
    findings.push(finding(LAWS.admission, "static.types", "agent-production-runtime/admission-type",
      PATHS.admission, "BusinessAdmissionReceipt is not an exported, resolved type."));
  }
  const storageInventory = sourceFor(context, PATHS.inventory)
    ?.getTypeAlias("ProductionRuntimeStorageInventory");
  if (!storageInventory?.isExported() || storageInventory.getType().isAny()) {
    findings.push(finding(LAWS.storage, "static.types", "agent-production-runtime/storage-type",
      PATHS.inventory, "ProductionRuntimeStorageInventory is not an exported, resolved type."));
  }
}

export function inspectAgentDependencies(
  context: InspectorContext,
  findings: InspectorFinding[],
): void {
  const stateImports = sourceFor(context, PATHS.runtimeState)?.getImportDeclarations() ?? [];
  if (stateImports.some((declaration) => declaration.getModuleSpecifierValue().includes("/browser/"))) {
    findings.push(finding(LAWS.core, "static.dependency", "agent-production-runtime/no-browser-private-import",
      PATHS.runtimeState, "Runtime state depends on Browser implementation."));
  }
  const manifest = JSON.parse(read(context, PATHS.manifest)) as { ownedPaths: string[] };
  const forbiddenOwnership = runtimeManifestOwnershipDrift(manifest.ownedPaths);
  if (forbiddenOwnership.length > 0) findings.push(finding(LAWS.staticQuality, "static.dependency",
    "agent-production-runtime/manifest-owner-drift", PATHS.manifest,
    `Runtime Manifest still owns adjacent paths: ${forbiddenOwnership.join(", ")}.`));
  const dynamicRoutes = producerClaimRoutesFor("acceptance:agent-production-runtime:real-proof", PATHS.proof) ?? [];
  const adjacentRoutes = dynamicRoutes.filter((route) =>
    !route.startsWith("LAW-AGENT-PRODUCTION-RUNTIME-"));
  if (adjacentRoutes.length > 0) findings.push(finding(LAWS.dynamicProof, "static.dependency",
    "agent-production-runtime/shared-proof-owner-drift", PATHS.proof,
    `Runtime proof remains shared with ${adjacentRoutes.length} adjacent dynamic routes.`));
}

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

export function inspectAgentSql(
  context: InspectorContext,
  findings: InspectorFinding[],
): void {
  const store = sourceFor(context, PATHS.store);
  const schemaInitializer = variableDeclaration(store, "productionSchemaSql")?.getInitializer();
  const schemaSql = (Node.isNoSubstitutionTemplateLiteral(schemaInitializer)
    ? schemaInitializer.getLiteralValue() : "").toLowerCase().replace(/\s+/gu, " ");
  const tableShapesInitializer = store?.getVariableDeclaration("tableShapes")?.getInitializer();
  const tableShapes = Node.isObjectLiteralExpression(tableShapesInitializer)
    ? tableShapesInitializer
    : tableShapesInitializer?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression);
  for (const table of ["production_tasks", "production_attempt_failures", "production_continuations",
    "production_outbox", "production_checkpoints", "production_leases"]) {
    if (!schemaSql.includes(`create table ${table}(`) || !tableShapes?.getProperty(table)) {
      findings.push(finding(LAWS.database, "static.sql", "agent-production-runtime/schema-table",
      PATHS.store, `Exact schema declaration is missing ${table}.`));
    }
  }
  const schemaRequirements = [
    "check(status in ('failed','completed'))", "check((status='failed'", "reservation_identity_hash text not null unique",
    "reservation_kind text not null check(reservation_kind in", "frontier_ref text unique",
    "state text not null check(state in ('none','persisted','failed'))",
    "state text not null check(state in ('absent','active','stale','lost'))", "on delete restrict",
  ];
  if (!schemaRequirements.every((requirement) => schemaSql.includes(requirement))) {
    findings.push(finding(LAWS.database, "static.sql", "agent-production-runtime/schema-constraints",
      PATHS.store, "Runtime schema declaration does not contain the exact state, uniqueness and FK constraints."));
  }
  const exactShape = store?.getVariableDeclaration("exactTableShape")?.getInitializer();
  const shapeCalls = new Set(exactShape?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .map((call) => call.getExpression().getText()) ?? []);
  const initializer = store?.getVariableDeclaration("initializeOrAssertCurrentSchema")?.getInitializer();
  const initializerCalls = new Set(initializer?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .map((call) => call.getExpression().getText()) ?? []);
  if (!["canonicalSql", "database.prepare"].every((call) => shapeCalls.has(call))
    || !["invalidJsonCount", "stateInvariantFailureCount"].every((call) => initializerCalls.has(call))) {
    findings.push(finding(LAWS.database, "static.sql", "agent-production-runtime/schema-data-readback",
      PATHS.store, "Runtime schema or persisted-data readback is not wired into startup validation."));
  }
  const stateInvariant = store?.getVariableDeclaration("stateInvariantFailureCount")
    ?.getInitializer()?.getText().toLowerCase().replace(/\s+/gu, " ") ?? "";
  const authorityInvariants = [
    "t.current_attempt_id=c.attempt_id",
    "state='failed' and (checkpoint_id is null or checkpoint_id='' or checkpoint_hash is not null)",
    "t.current_attempt_id=l.attempt_id",
    "l.state!='active' and l.expires_at is not null",
  ];
  if (!authorityInvariants.every((token) => stateInvariant.includes(token))) {
    findings.push(finding(LAWS.database, "static.sql", "agent-production-runtime/data-authority-invariants",
      PATHS.store, "Startup SQL does not reject invalid checkpoint or lease shape and attempt ownership."));
  }
}

const evaluate = (context: InspectorContext): InspectorEvaluation => {
  const findings: InspectorFinding[] = [];
  const receipts: InspectorEvaluation["staticCheckReceipts"] = [];
  recordStaticCheck({ check: "inspectAgentFilesystem", findings, implementation: inspectAgentFilesystem,
    lawIds: [LAWS.credential, LAWS.storage, LAWS.staticQuality, LAWS.dynamicProof], receipts,
    run: () => inspectAgentFilesystem(context, findings) });
  recordStaticCheck({ check: "inspectAgentProductionRuntime", findings, implementation: inspectAgentProductionRuntime,
    lawIds: ALL_LAWS, receipts, run: () => inspectAgentProductionRuntime(context, findings) });
  recordStaticCheck({ check: "inspectAgentTypes", findings, implementation: inspectAgentTypes,
    lawIds: ALL_LAWS.filter((lawId) => lawId !== LAWS.dynamicProof), receipts,
    observe: () => observeStaticMode(context, "static.types"),
    run: () => inspectAgentTypes(context, findings) });
  recordStaticCheck({ check: "inspectAgentContracts", findings, implementation: inspectAgentContracts,
    lawIds: [LAWS.core, LAWS.credential, LAWS.route, LAWS.admission, LAWS.storage,
      LAWS.staticQuality, LAWS.dynamicProof], receipts,
    run: () => inspectAgentContracts(context, findings) });
  recordStaticCheck({ check: "inspectAgentDependencies", findings, implementation: inspectAgentDependencies,
    lawIds: [LAWS.core, LAWS.route, LAWS.staticQuality, LAWS.dynamicProof], receipts,
    run: () => inspectAgentDependencies(context, findings) });
  recordStaticCheck({ check: "inspectAgentSql", findings, implementation: inspectAgentSql,
    lawIds: [LAWS.database], receipts, run: () => inspectAgentSql(context, findings) });
  return { capabilityDomain: context.planEntry.capabilityDomain, reportedLawIds: context.planEntry.lawIds,
    findings, inspectedFiles: [...context.targetPaths], staticCheckReceipts: receipts };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> =>
  buildAgentProductionSessionOutput(context, evaluate(context));
