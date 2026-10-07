import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import type { InspectorContext, InspectorEvaluation, InspectorFinding } from "../../shared/inspector-contracts.js";
import { recordStaticCheck } from "../../shared/static-inspection-contract.js";
import { observeStaticMode } from "../../shared/static-target-object-inspector.js";
import { collectDynamicImportProblems, collectResolvedModuleTargets } from "../../shared/source-module-targets.js";
import { inspectAgentAuthorityAst, inspectAgentSql } from "./authority-inspection.js";
import { ALL_LAWS, LAWS, RUNTIME_ROOT, bodyFor, calls, inspectAgentContracts, objectFor,
  read, reject, runtimeManifestOwnershipDrift, runtimePath, scopedPath, sourceFor } from "./contract-inspection.js";
import { buildAgentProductionSessionOutput } from "./session-output.js";

export function inspectAgentFilesystem(context: InspectorContext, findings: InspectorFinding[]): void {
  for (const path of context.targetPaths) {
    const exists = existsSync(scopedPath(context, path));
    for (const law of context.lawRequirements.filter((requirement) => requirement.targetPaths.includes(path))) {
      reject(findings, law.lawId, "static.filesystem", path, "native-scope-file-discovery", exists,
        "Every file in the native current-candidate denominator must remain discoverable.");
    }
  }
  const manifestPath = "scripts/audit/domains/agent-production-runtime/manifest.json";
  const manifest = JSON.parse(read(context, manifestPath)) as { ownedPaths: string[]; observedPaths: string[]; schemaVersion: number };
  reject(findings, LAWS.staticQuality, "static.filesystem", manifestPath, "single-runtime-primary-owner",
    manifest.schemaVersion === 5 && Array.isArray(manifest.observedPaths)
    && runtimeManifestOwnershipDrift(manifest.ownedPaths).length === 0
    && new Set(manifest.ownedPaths).size === manifest.ownedPaths.length,
    "The actual Manifest must have one Runtime ownership declaration without adjacent primary paths.");
}

export function inspectAgentProductionRuntime(context: InspectorContext, findings: InspectorFinding[]): void {
  inspectAgentAuthorityAst(context, findings);
  const contracts = sourceFor(context, runtimePath("contracts"));
  for (const name of ["ProductionProductIdSchema", "ProductionActionIdSchema"]) {
    const schema = bodyFor(contracts, name);
    const members = calls(schema).map((call) => call.getExpression().getText());
    reject(findings, LAWS.route, "static.ast", runtimePath("contracts"), "opaque-product-action",
      members.includes("z.string") && members.some((member) => member.endsWith(".min"))
      && members.some((member) => member.endsWith(".max"))
      && members.length === 3 && members.every((member) =>
        member === "z.string" || member.endsWith(".min") || member.endsWith(".max")),
      "Product and action must be bounded opaque strings; Runtime cannot re-adjudicate their business values.");
  }
  const route = sourceFor(context, runtimePath("route-policy"));
  reject(findings, LAWS.route, "static.ast", runtimePath("route-policy"), "no-second-business-route-table",
    ["parameterValidators", "primaryProducts", "routeProducesGeneratedImage"].every((name) =>
      route.getVariableDeclaration(name) === undefined && route.getFunction(name) === undefined),
    "Runtime may resolve only the unique provider-derived projection, without a second business support table.");
  const task = bodyFor(contracts, "WebsiteAgentTaskSchema");
  reject(findings, LAWS.route, "static.ast", runtimePath("contracts"), "no-action-derived-relation",
    !(task?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression) ?? []).some((access) => access.getName() === "action_id"),
    "Task relation authority is transported from Website, not inferred from action or locale.");
  const proofPath = "scripts/acceptance/agent-production-runtime.real-proof.ts";
  const proof = sourceFor(context, proofPath);
  reject(findings, LAWS.dynamicProof, "static.ast", proofPath, "runtime-proof-no-adjacent-execution",
    proof.getImportDeclarations().length === 0 && calls(proof, "emitQualityProofObservation").length === 0
    && proof.getStatements().some(Node.isThrowStatement),
    "An unadmitted Runtime-only proof must fail closed and never run neighboring Product/GPT/Browser business.");
  const sessionPath = "scripts/audit/domains/agent-production-runtime/session-output.ts";
  const session = sourceFor(context, sessionPath);
  reject(findings, LAWS.staticQuality, "static.ast", sessionPath, "native-fact-derived-assertions",
    calls(session, "validateStaticInspection").length === 1 && calls(session, "producerModePassed").length === 1
    && !session.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) =>
      property.getName() === "passed" && property.getInitializer()?.getKind() === SyntaxKind.TrueKeyword),
    "Each law assertion must derive from one actual native producer receipt and validation, never a fixed PASS.");
}

const importedTypeBinding = (source: SourceFile, reference: Node | undefined, modulePath: string, name: string): boolean => {
  if (!Node.isIdentifier(reference)) return false;
  const bindings = source.getImportDeclarations().filter((entry) => entry.getModuleSpecifierValue() === modulePath)
    .flatMap((entry) => entry.getNamedImports()).filter((entry) => entry.getName() === name);
  const symbol = reference.getSymbol();
  return bindings.length === 1 && symbol !== undefined && symbol.getDeclarations().length === 1
    && symbol.getDeclarations()[0] === bindings[0]
    && symbol === (bindings[0]?.getAliasNode() ?? bindings[0]?.getNameNode())?.getSymbol();
};
const inferredSchemaBinding = (source: SourceFile, name: string, schemaName: string): boolean => {
  const alias = source.getTypeAlias(name);
  const type = alias?.getTypeNode();
  const schema = source.getVariableDeclaration(schemaName);
  if (!alias?.isExported() || !schema?.isExported() || schema.getTypeNode() !== undefined
    || !Node.isCallExpression(schema.getInitializer()) || !Node.isTypeReference(type)) return false;
  const reference = type.getTypeName();
  const arguments_ = type.getTypeArguments();
  const query = arguments_[0];
  return Node.isQualifiedName(reference) && reference.getRight().getText() === "infer"
    && importedTypeBinding(source, reference.getLeft(), "zod", "z")
    && arguments_.length === 1 && Node.isTypeQuery(query)
    && query.getExprName().getSymbol() === schema.getNameNode().getSymbol()
    && schema.getNameNode().getSymbol()?.getDeclarations().length === 1;
};
const strictSchemaTypeProperties = (source: SourceFile, name: "DeviceCredentialSchema" | "WebsiteAgentTaskBaseSchema"): string[] | undefined => {
  const schema = source.getVariableDeclaration(name);
  if (!schema || schema.getTypeNode() !== undefined || schema.getNameNode().getSymbol()?.getDeclarations().length !== 1) return undefined;
  const initializer = schema.getInitializer();
  if (!Node.isCallExpression(initializer) || initializer.getArguments().length !== 0) return undefined;
  const strict = initializer.getExpression();
  if (!Node.isPropertyAccessExpression(strict) || strict.getName() !== "strict") return undefined;
  const objectCall = strict.getExpression();
  if (!Node.isCallExpression(objectCall) || objectCall.getArguments().length !== 1) return undefined;
  const factory = objectCall.getExpression();
  const object = objectCall.getArguments()[0];
  if (!Node.isPropertyAccessExpression(factory) || factory.getName() !== "object"
    || !importedTypeBinding(source, factory.getExpression(), "zod", "z")
    || !Node.isObjectLiteralExpression(object) || !object.getProperties().every(Node.isPropertyAssignment)) return undefined;
  const properties = object.getType().getProperties();
  return properties.length === object.getProperties().length ? properties.map((property) => property.getName()).sort() : undefined;
};
const taskSchemaTypeBinding = (source: SourceFile): boolean => {
  const initializer = source.getVariableDeclaration("WebsiteAgentTaskSchema")?.getInitializer();
  if (!Node.isCallExpression(initializer) || initializer.getArguments().length !== 1
    || !Node.isArrowFunction(initializer.getArguments()[0])) return false;
  const refine = initializer.getExpression();
  if (!Node.isPropertyAccessExpression(refine) || refine.getName() !== "superRefine") return false;
  const base = source.getVariableDeclaration("WebsiteAgentTaskBaseSchema");
  return base !== undefined && refine.getExpression().getSymbol() === base.getNameNode().getSymbol()
    && strictSchemaTypeProperties(source, "WebsiteAgentTaskBaseSchema") !== undefined;
};
const nativeInspectorTypeBindings = (source: SourceFile): boolean => {
  const parameters = source.getFunction("inspectAgentProductionRuntime")?.getParameters();
  if (!parameters || parameters.length !== 2) return false;
  const context = parameters[0]?.getTypeNode();
  const findings = parameters[1]?.getTypeNode();
  const element = Node.isArrayTypeNode(findings) ? findings.getElementTypeNode() : undefined;
  return Node.isTypeReference(context) && context.getTypeArguments().length === 0
    && importedTypeBinding(source, context.getTypeName(), "../../shared/inspector-contracts.js", "InspectorContext")
    && Node.isTypeReference(element) && element.getTypeArguments().length === 0
    && importedTypeBinding(source, element.getTypeName(), "../../shared/inspector-contracts.js", "InspectorFinding");
};

export function inspectAgentTypes(context: InspectorContext, findings: InspectorFinding[]): void {
  const aliases = [
    [LAWS.core, "store-foundation", "ProductionTaskStatus"],
    [LAWS.credential, "transport-protocol", "DeviceCredential"],
    [LAWS.route, "contracts", "WebsiteAgentTask"],
    [LAWS.admission, "cloud-reconciliation-client", "BusinessAdmissionReceipt"],
    [LAWS.database, "store-foundation", "ProductionAuthorityReader"],
    [LAWS.storage, "runtime-storage-inventory", "ProductionRuntimeStorageInventory"],
  ] as const;
  for (const [lawId, file, name] of aliases) {
    const source = sourceFor(context, runtimePath(file));
    const type = source.getTypeAlias(name);
    const valid = name === "DeviceCredential" ? inferredSchemaBinding(source, name, "DeviceCredentialSchema")
      : name === "WebsiteAgentTask" ? inferredSchemaBinding(source, name, "WebsiteAgentTaskSchema") && taskSchemaTypeBinding(source)
        : type?.isExported() === true && !type.getType().isAny() && !type.getType().isUnknown();
    reject(findings, lawId, "static.types", runtimePath(file), "resolved-owner-type",
      valid, `The original ${name} must retain its actual exported Owner type and schema symbol binding.`);
  }
  const taskStatus = sourceFor(context, runtimePath("store-foundation")).getTypeAliasOrThrow("ProductionTaskStatus").getType();
  reject(findings, LAWS.core, "static.types", runtimePath("store-foundation"), "two-public-task-states",
    taskStatus.isUnion() && JSON.stringify(taskStatus.getUnionTypes().map((type) => type.getLiteralValue()).sort())
      === JSON.stringify(["completed", "failed"]), "Only failed/completed may be exposed as persisted task states.");
  const credential = strictSchemaTypeProperties(sourceFor(context, runtimePath("transport-protocol")), "DeviceCredentialSchema");
  reject(findings, LAWS.credential, "static.types", runtimePath("transport-protocol"), "credential-type-exact-identity",
    JSON.stringify(credential) === JSON.stringify([
      "credential", "device_epoch", "device_id", "enrolled_at", "environment_id", "origin", "protocol_version", "server_base_url"]),
    "Device credential type must retain only its own eight long-lived fields.");
  const admissionType = sourceFor(context, runtimePath("cloud-reconciliation-client")).getTypeAliasOrThrow("BusinessAdmissionReceipt").getType();
  const admissionBase = ["schema_version", "job_id", "result_payload_hash", "consumer_ref", "outcome", "consumption_hash", "consumed_at"];
  const expectedVariants = [admissionBase, [...admissionBase, "bazi_domain_admission_receipt_hash", "delivery_manifest_id", "delivery_manifest_hash"],
    [...admissionBase, "review_receipt_hash"]].map((fields) => [...fields].sort().join(",")).sort();
  reject(findings, LAWS.admission, "static.types", runtimePath("cloud-reconciliation-client"), "three-exclusive-admission-types",
    admissionType.isUnion() && JSON.stringify(admissionType.getUnionTypes().map((type) =>
      type.getProperties().map((property) => property.getName()).sort().join(",")).sort()) === JSON.stringify(expectedVariants),
    "The actual admission type must expose exactly base, complete Bazi or review variants.");
  const taskShape = sourceFor(context, runtimePath("store-foundation")).getInterfaceOrThrow("StoredProductionTask").getType();
  reject(findings, LAWS.database, "static.types", runtimePath("store-foundation"), "no-persisted-implementation-or-fence-identity",
    ["identity", "identity_json", "plugin_id", "plugin_version", "catalog_hash", "lease_version", "execution_fence_hash"]
      .every((field) => taskShape.getProperty(field) === undefined),
    "Persistent task shape must not reintroduce implementation or Website execution identity.");
  const path = "scripts/audit/domains/agent-production-runtime/inspector.ts";
  const own = sourceFor(context, path);
  reject(findings, LAWS.staticQuality, "static.types", path, "typed-native-inspector",
    nativeInspectorTypeBindings(own),
    "The sole Runtime inspector must use the original native context and finding contracts.");
}

const inspectQualityOwnerImports = (source: SourceFile, path: string, findings: InspectorFinding[]): void => {
  if (!path.startsWith("scripts/audit/domains/agent-production-runtime/")) return;
  for (const edge of collectResolvedModuleTargets(source)) reject(findings, LAWS.staticQuality, "static.dependency", path,
    "native-quality-owner-isolation", !edge.targetPath.startsWith("src/plugins/")
      && !edge.targetPath.startsWith("src/capabilities/gpt/") && !edge.targetPath.startsWith("src/lib/browser/"),
    "Runtime quality must examine source facts without executing neighboring Product/GPT/Browser business implementations.");
};
const inspectRuntimeResolvedEdges = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const root = resolve(context.sealedRoot);
  const sources = context.targetPaths.filter((path) => path.endsWith(".ts")).map((path) => sourceFor(context, path));
  for (const source of sources) {
    const path = relative(root, source.getFilePath()).replaceAll("\\", "/");
    inspectQualityOwnerImports(source, path, findings);
    if (path.startsWith(`${RUNTIME_ROOT}/`)) reject(findings, LAWS.core, "static.dependency", path,
      "no-unresolved-runtime-import", collectDynamicImportProblems(source).length === 0,
      "Runtime dynamic module edges must resolve a literal target through the original Native module resolver.");
    if (path.startsWith(`${RUNTIME_ROOT}/`)) for (const edge of collectResolvedModuleTargets(source)) {
      const catalog = edge.targetPath === "src/mediator/product-plugin-catalog.ts";
      const pureCatalog = !catalog || edge.edgeKind === "import" && !edge.namespaceImport && edge.namedBindings.length > 0
        && edge.namedBindings.every((name) => ["productPluginCatalogSnapshot", "productionCatalogHash"].includes(name));
      reject(findings, LAWS.core, "static.dependency", path, "resolved-runtime-owner-boundary",
        pureCatalog && !edge.targetPath.startsWith("src/plugins/")
        && !(edge.targetPath.startsWith("src/lib/browser/") && edge.targetPath !== "src/lib/browser/browser-authority-api.ts"),
        "Native resolved import edges must remain on public typed ports; Catalog is data-only without a Product-object exemption.");
    }
  }
};
export function inspectAgentDependencies(context: InspectorContext, findings: InspectorFinding[]): void {
  inspectRuntimeResolvedEdges(context, findings);
  const catalog = sourceFor(context, runtimePath("catalog"));
  const route = bodyFor(catalog, "manifestRoutes");
  const manifest = bodyFor(catalog, "agentRouteCapabilityManifest");
  reject(findings, LAWS.route, "static.dependency", runtimePath("catalog"), "one-pure-route-manifest-publisher",
    calls(route, "productPluginCatalogSnapshot.map").length === 1
    && calls(manifest, "AgentRouteCapabilityManifestSchema.parse").length === 1
    && catalog.getImportDeclarations().every((declaration) =>
      !declaration.getModuleSpecifierValue().split("/").includes("plugins")),
    "The only Runtime publisher must mechanically consume the architecture-owned pure route snapshot.");
  const protocol = sourceFor(context, runtimePath("transport-protocol"));
  const fields = objectFor(bodyFor(protocol, "ExecutionGrantSchema"));
  reject(findings, LAWS.core, "static.dependency", runtimePath("transport-protocol"), "no-plugin-transport-identity",
    fields !== undefined && ["plugin_id", "plugin_version", "expected_plugin_id", "expected_plugin_version"]
      .every((name) => fields.getProperty(name) === undefined),
    "Transport identity must remain product-opaque rather than couple to Product implementation names.");
  const proofPath = "scripts/acceptance/agent-production-runtime.real-proof.ts";
  const proof = sourceFor(context, proofPath);
  reject(findings, LAWS.dynamicProof, "static.dependency", proofPath, "independent-runtime-proof",
    proof.getImportDeclarations().length === 0 && calls(proof, "emitQualityProofObservation").length === 0,
    "The currently unadmitted proof must not execute adjacent business or manufacture an independent verdict.");
}

const evaluate = (context: InspectorContext): InspectorEvaluation => {
  const findings: InspectorFinding[] = [], receipts: InspectorEvaluation["staticCheckReceipts"] = [];
  recordStaticCheck({ check: "inspectAgentFilesystem", implementation: inspectAgentFilesystem,
    lawIds: [LAWS.credential, LAWS.storage, LAWS.staticQuality, LAWS.dynamicProof], findings, receipts,
    run: () => inspectAgentFilesystem(context, findings) });
  recordStaticCheck({ check: "inspectAgentProductionRuntime", implementation: inspectAgentProductionRuntime,
    lawIds: ALL_LAWS, findings, receipts, run: () => inspectAgentProductionRuntime(context, findings) });
  recordStaticCheck({ check: "inspectAgentTypes", implementation: inspectAgentTypes,
    lawIds: ALL_LAWS.filter((lawId) => lawId !== LAWS.dynamicProof), findings, receipts,
    observe: () => observeStaticMode(context, "static.types"), run: () => inspectAgentTypes(context, findings) });
  recordStaticCheck({ check: "inspectAgentContracts", implementation: inspectAgentContracts,
    lawIds: [LAWS.core, LAWS.credential, LAWS.route, LAWS.admission, LAWS.storage, LAWS.staticQuality, LAWS.dynamicProof],
    findings, receipts, run: () => inspectAgentContracts(context, findings) });
  recordStaticCheck({ check: "inspectAgentDependencies", implementation: inspectAgentDependencies,
    lawIds: [LAWS.core, LAWS.route, LAWS.staticQuality, LAWS.dynamicProof], findings, receipts,
    run: () => inspectAgentDependencies(context, findings) });
  recordStaticCheck({ check: "inspectAgentSql", implementation: inspectAgentSql, lawIds: [LAWS.database], findings, receipts,
    run: () => inspectAgentSql(context, findings) });
  return { capabilityDomain: context.planEntry.capabilityDomain, reportedLawIds: [...context.planEntry.lawIds],
    findings, inspectedFiles: [...context.targetPaths], staticCheckReceipts: receipts };
};
export const inspectDomain = async (context: InspectorContext) => buildAgentProductionSessionOutput(context, evaluate(context));
