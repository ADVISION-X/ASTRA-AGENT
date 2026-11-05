import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { producerClaimRoutesFor } from "../../shared/proof-observation.js";

export const LAWS = {
  core: "LAW-AGENT-PRODUCTION-RUNTIME-001-V1",
  credential: "LAW-AGENT-PRODUCTION-RUNTIME-002-V1",
  route: "LAW-AGENT-PRODUCTION-RUNTIME-003-V2",
  admission: "LAW-AGENT-PRODUCTION-RUNTIME-004-V1",
  database: "LAW-AGENT-PRODUCTION-RUNTIME-005-V1",
  storage: "LAW-AGENT-PRODUCTION-RUNTIME-006-V1",
  staticQuality: "LAW-AGENT-PRODUCTION-RUNTIME-007-V1",
  dynamicProof: "LAW-AGENT-PRODUCTION-RUNTIME-008-V1",
} as const;
export const ALL_LAWS = Object.values(LAWS);
export const RUNTIME_ROOT = "src/lib/local-runtime/production";
export const runtimePath = (name: string): string => `${RUNTIME_ROOT}/${name}.ts`;
export const scopedPath = (context: InspectorContext, path: string): string => {
  const absolute = resolve(context.sealedRoot, path);
  const canonical = relative(context.sealedRoot, absolute).replaceAll("\\", "/");
  if (canonical !== path || !context.targetPaths.includes(path)) {
    throw new Error(`AGENT_RUNTIME_INSPECTION_OUTSIDE_SCOPE:${path}`);
  }
  return absolute;
};
export const sourceFor = (context: InspectorContext, path: string): SourceFile => {
  const source = context.project.getSourceFile(scopedPath(context, path));
  if (!source || context.project.getProgram().compilerObject.getSyntacticDiagnostics(source.compilerNode).length > 0) {
    throw new Error(`AGENT_RUNTIME_SOURCE_UNREADABLE:${path}`);
  }
  return source;
};
export const read = (context: InspectorContext, path: string): string =>
  readFileSync(scopedPath(context, path), "utf8");
export const bodyFor = (source: SourceFile, name: string): Node | undefined =>
  source.getFunction(name) ?? source.getVariableDeclaration(name)?.getInitializer();
export const calls = (node: Node | undefined, expression?: string) =>
  [...(Node.isCallExpression(node) ? [node] : []), ...(node?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [])].filter((call) =>
    expression === undefined || call.getExpression().getText() === expression);
export const literal = (node: Node | undefined): string | undefined =>
  node && (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node))
    ? node.getLiteralValue() : undefined;
export const objectFor = (node: Node | undefined) => {
  const object = calls(node, "z.object")[0]?.getArguments()[0];
  return Node.isObjectLiteralExpression(object) ? object : undefined;
};
export const compare = (node: Node | undefined, left: string, operator: SyntaxKind, right: string): boolean =>
  [...(Node.isBinaryExpression(node) ? [node] : []), ...(node?.getDescendantsOfKind(SyntaxKind.BinaryExpression) ?? [])].some((binary) =>
    binary.getOperatorToken().getKind() === operator
    && binary.getLeft().getText() === left && binary.getRight().getText() === right);
export const callNames = (node: Node | undefined): Set<string> =>
  new Set(calls(node).map((call) => call.getExpression().getText()));
export const reject = (findings: InspectorFinding[], lawId: string, mode: string,
  path: string, checkId: string, valid: boolean, message: string): void => {
  if (!valid) findings.push(createFinding({ lawId, evidenceMode: mode, filePath: path,
    checkId: `agent-production-runtime/${checkId}`, message }));
};
const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const unwrap = (node: Node): Node => Node.isParenthesizedExpression(node) ? unwrap(node.getExpression()) : node;
export const booleanTerms = (node: Node | undefined, operator: SyntaxKind): Node[] => {
  if (!node) return [];
  const expression = unwrap(node);
  return Node.isBinaryExpression(expression) && expression.getOperatorToken().getKind() === operator
    ? [...booleanTerms(expression.getLeft(), operator), ...booleanTerms(expression.getRight(), operator)] : [expression];
};
export const rejectingComparison = (node: Node | undefined, left: string, right: string): boolean =>
  booleanTerms(node, SyntaxKind.BarBarToken).some((term) => Node.isBinaryExpression(term)
    && term.getOperatorToken().getKind() === SyntaxKind.ExclamationEqualsEqualsToken
    && term.getLeft().getText() === left && term.getRight().getText() === right);
const hasError = (node: Node | undefined, code: string): boolean => calls(node, "executionFailure")
  .some(call => literal(call.getArguments()[1]) === code);
const exactProperties = (node: Node | undefined, expected: readonly string[]): boolean => {
  const object = objectFor(node);
  return object !== undefined && same(object.getProperties().map((property) =>
    Node.isPropertyAssignment(property) ? property.getName() : "INVALID").sort(), [...expected].sort())
    && calls(node).some((call) => Node.isPropertyAccessExpression(call.getExpression())
      && call.getExpression().getText().endsWith(".strict"));
};

const inspectWorkAccessTransport = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const path = runtimePath("work-access"), source = sourceFor(context, path);
  const port = bodyFor(source, "createWorkAccessPort");
  const names = callNames(port);
  const responseGuard = bodyFor(source, "parseWorkAccessResponse");
  const objectMismatch = port?.getDescendantsOfKind(SyntaxKind.IfStatement).find(statement =>
    hasError(statement.getThenStatement(), "WORK_ACCESS_OBJECT_MISMATCH"));
  const valid = names.has("signal.throwIfAborted") && names.has("session.authorizationHeaders")
    && names.has("productionCloudFetch") && names.has("parseJsonEnvelope")
    && port?.getDescendantsOfKind(SyntaxKind.StringLiteral).some(node => node.getLiteralValue() === "x-ai-execution-fence-hash") === true
    && compare(objectMismatch?.getExpression(), "value.asset_id", SyntaxKind.ExclamationEqualsEqualsToken, "assetId")
    && compare(objectMismatch?.getExpression(), "new URL(value.get_url).protocol", SyntaxKind.ExclamationEqualsEqualsToken, '"https:"')
    && names.has("parseWorkAccessResponse") && names.has('url.searchParams.set')
    && hasError(port, "WORK_ACCESS_MATERIAL_UNAUTHORIZED") && hasError(responseGuard, "WORK_ACCESS_RESPONSE_INVALID")
    && compare(responseGuard, "Date.parse(value.expires_at)", SyntaxKind.LessThanEqualsToken, "Date.now()");
  reject(findings, LAWS.route, "static.contract", path, "work-access-transport-boundary", valid,
    "Work access must bind the current task material/asset, execution fence, exact original bytes, expiry and cancellation.");
  const cloud = sourceFor(context, runtimePath("cloud-client"));
  reject(findings, LAWS.route, "static.contract", runtimePath("cloud-client"), "no-product-image-relay",
    bodyFor(cloud, "uploadGeneratedImage") === undefined && bodyFor(cloud, "uploadProductionGeneratedImage") === undefined,
    "Retired Product image relay must not replace Work direct storage or the retained GPT original-image evidence capability.");
};

const inspectAdmission = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const path = runtimePath("contracts"), source = sourceFor(context, path);
  const parser = bodyFor(source, "parseTerminalReceipt");
  const guard = parser?.getDescendantsOfKind(SyntaxKind.IfStatement).find(statement =>
    rejectingComparison(statement.getExpression(), "receipt.job_id", "expected.job_id"));
  const fields = ["job_id", "terminal_status", "payload_hash", "worker_session_id", "worker_session_epoch"];
  const schemaUse = calls(parser, "TerminalReceiptSchema.safeParse")[0]?.getExpression();
  const valid = calls(parser, "TerminalReceiptSchema.safeParse").length === 1
    && Node.isPropertyAccessExpression(schemaUse)
    && schemaUse.getExpression().getSymbol() === source.getVariableDeclaration("TerminalReceiptSchema")?.getNameNode().getSymbol()
    && fields.every(field => rejectingComparison(guard?.getExpression(), `receipt.${field}`, `expected.${field}`))
    && calls(guard, "executionFailure").some(call => literal(call.getArguments()[1]) === "V6_TERMINAL_RECEIPT_MISMATCH")
    && source.getVariableDeclaration("TerminalReceiptSchema")?.getText().includes("failure: z.null()") === true;
  reject(findings, LAWS.admission, "static.contract", path, "receiving-receipt-contract", valid,
    "The original terminal parser must bind successful receiving to the original request's job, result and session.");
};

const inspectDependencies = (context: InspectorContext, findings: InspectorFinding[]): void => {
  for (const [name, id, version, provider] of [
    ["website-agent-task-result", "astra.website-agent-task-result", 5, "ADVISION-X/AI-Paper-Factory"],
    ["xuanxue-ai-production-v6", "astra.production-control-v6", 1, "ADVISION-X/AI-Paper-Factory"],
  ] as const) {
    const path = `docs/specs/agent-production-runtime/${name}.dependency.spec.json`;
    const dependency = JSON.parse(read(context, path)) as { contract: Record<string, unknown>; lawIds: string[] };
    reject(findings, LAWS.route, "static.contract", path, "minimal-current-dependency",
      same(Object.keys(dependency.contract).sort(), ["contractId", "providerRepo", "version"])
      && dependency.contract.contractId === id && dependency.contract.version === version
      && dependency.contract.providerRepo === provider
      && dependency.lawIds.every((lawId) => ALL_LAWS.includes(lawId as typeof ALL_LAWS[number])),
      "Consumer dependency must bind the current provider version using only its three-field identity.");
  }
  const projectionPath = `${RUNTIME_ROOT}/website-agent-route-policies.v1.json`;
  const projection = JSON.parse(read(context, projectionPath)) as { contract_id: string; contract_version: number;
    parameter_types: Record<string, unknown>; routes: { product_id: string; action_id: string; relation_kind: string;
      result_contract?: unknown; required_parameter_keys: string[] }[] };
  const identities = projection.routes.map(route => `${route.product_id}\0${route.action_id}`);
  const used = new Set(projection.routes.flatMap(route => route.required_parameter_keys));
  const currentRoutes = projection.contract_id === "astra.website-agent-task-result" && projection.contract_version === 5
    && projection.routes.length > 0 && new Set(identities).size === projection.routes.length
    && used.size === Object.keys(projection.parameter_types).length
    && [...used].every(key => Object.hasOwn(projection.parameter_types, key))
    && projection.routes.every(route => route.relation_kind === (route.action_id === "prepare_brief" ? "provider_continuation" : "primary")
      && route.result_contract !== undefined
      && new Set(route.required_parameter_keys).size === route.required_parameter_keys.length);
  reject(findings, LAWS.route, "static.contract", projectionPath, "current-route-projection", currentRoutes,
    "Projection must consume the current ASTRA provider with unique routes, complete parameter bindings and result contracts.");
  inspectProviderGenerator(context, findings);
};
const providerDecodesUtf8Bytes = (generator: SourceFile): boolean => {
  const decode = calls(bodyFor(generator, "raw"), "JSON.parse")[0]?.getArguments()[0];
  const expression = Node.isCallExpression(decode) ? decode.getExpression() : undefined;
  const decoder = Node.isPropertyAccessExpression(expression) ? expression.getExpression() : undefined;
  const options = Node.isNewExpression(decoder) ? decoder.getArguments()?.[1] : undefined;
  return Node.isCallExpression(decode) && decode.getArguments()[0]?.getText() === "bytes"
    && Node.isNewExpression(decoder) && decoder.getExpression().getText() === "TextDecoder"
    && Node.isObjectLiteralExpression(options) && options.getProperty("fatal")?.getText() === "fatal: true";
};
const providerBytesComeFromWebsite = (generator: SourceFile): boolean => {
  const bytes = bodyFor(generator, "bytes");
  const readCall = Node.isAwaitExpression(bytes) ? bytes.getExpression() : undefined;
  const path = Node.isCallExpression(readCall) ? readCall.getArguments()[0] : undefined;
  return Node.isCallExpression(readCall) && readCall.getExpression().getText() === "readFile"
    && Node.isCallExpression(path) && path.getExpression().getText() === "resolve"
    && path.getArguments()[0]?.getText() === "configured"
    && literal(path.getArguments()[1]) === "packages/ai-contracts/src/agent-task/website-agent-route-policies.v1.json"
    && providerDecodesUtf8Bytes(generator);
};
const inspectProviderGenerator = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const path = "scripts/generate/sync-website-agent-route-policy-projection.ts";
  const generator = sourceFor(context, path);
  const validate = bodyFor(generator, "validateRoutes");
  reject(findings, LAWS.route, "static.contract", path, "provider-generator",
    providerBytesComeFromWebsite(generator)
    && calls(bodyFor(generator, "configured"), "Reflect.get")[0]?.getArguments()[1]?.getText() === "dependency.contract.providerRepo"
    && calls(bodyFor(generator, "keys"), "validateRoutes")[0]?.getArguments()[0]?.getText() === "source.routes"
    && callNames(validate).has("keys.has") && callNames(validate).has("Object.hasOwn")
    && compare(validate, "used.size", SyntaxKind.ExclamationEqualsEqualsToken, "Object.keys(parameters).length")
    && projectionWritesOriginalBytes(generator),
    "The unique generator must read the bound provider, validate its published route bindings and preserve original bytes.");
};
const projectionWritesOriginalBytes = (generator: SourceFile): boolean =>
  calls(generator, "writeFile").some(call => call.getArguments()[0]?.getText() === "pending"
    && call.getArguments()[1]?.getText() === "bytes")
  && calls(generator, "rename").some(call => call.getArguments()[0]?.getText() === "pending"
    && call.getArguments()[1]?.getText() === "target");

export const runtimeManifestOwnershipDrift = (paths: readonly string[]): string[] => paths.filter((path) =>
  !(path === "docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md"
    || path.startsWith("docs/specs/agent-production-runtime/")
    || path === "docs/项目方案/旧交付记录账本误阻断-完整实现方案.md"
    || path === "docs/项目方案/长材料下载租约边界-完整实现方案.md"
    || path.startsWith("scripts/audit/domains/agent-production-runtime/")
    || path.startsWith("scripts/acceptance/agent-production-runtime")
    || path === "scripts/acceptance/agent-route-contract.acceptance.ts"
    || path === "scripts/generate/sync-website-agent-route-policy-projection.ts"
    || path === "scripts/maintenance/production-runtime-storage-reconcile.ts"
    || path === "src/lib/execution-failure.ts" || path.startsWith(`${RUNTIME_ROOT}/`)));

const inspectProofAndManifest = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const path = "scripts/audit/domains/agent-production-runtime/manifest.json";
  const manifest = JSON.parse(read(context, path)) as { lawIds: string[]; ownedPaths: string[]; capabilityDomain: string };
  reject(findings, LAWS.staticQuality, "static.contract", path, "manifest-current-laws",
    manifest.capabilityDomain === "agent-production-runtime" && same(manifest.lawIds, ALL_LAWS)
    && runtimeManifestOwnershipDrift(manifest.ownedPaths).length === 0,
    "Runtime's unique Manifest must bind the eight active laws and only its own primary ownership.");
  const proof = "scripts/acceptance/agent-production-runtime.real-proof.ts";
  const proofSource = sourceFor(context, proof);
  const modes: Record<string, string[]> = {
    [LAWS.core]: ["database", "service", "storage"], [LAWS.credential]: ["authorization", "service"],
    [LAWS.admission]: ["service"], [LAWS.database]: ["database"], [LAWS.storage]: ["storage"],
    [LAWS.dynamicProof]: ["authorization", "database", "service", "storage"],
  };
  const expected = Object.entries(modes).flatMap(([lawId, names]) => names.map((name) => `${lawId}:dynamic.${name}`)).sort();
  const routes = producerClaimRoutesFor("acceptance:agent-production-runtime:real-proof", proof)?.sort();
  const hold = proofSource.getStatements().some((statement) => {
    if (!Node.isThrowStatement(statement)) return false;
    const expression = statement.getExpression();
    return Node.isNewExpression(expression)
      && literal(expression.getArguments()[0]) === "AGENT_RUNTIME_OWNER_ISOLATED_RELEASE_PROOF_NOT_ADMITTED";
  });
  reject(findings, LAWS.dynamicProof, "static.contract", proof, "proof-current-owner-denominator",
    same(routes, expected) && hold && proofSource.getImportDeclarations().length === 0,
    "Runtime's sole proof must preserve twelve owner-only routes and remain HOLD until its independent dynamic implementation is admitted.");
};

export const inspectAgentContracts = (context: InspectorContext, findings: InspectorFinding[]): void => {
  inspectDependencies(context, findings);
  inspectWorkAccessTransport(context, findings);
  inspectAdmission(context, findings);
  inspectProofAndManifest(context, findings);
  const transport = sourceFor(context, runtimePath("transport-protocol"));
  reject(findings, LAWS.credential, "static.contract", runtimePath("transport-protocol"), "long-term-credential",
    exactProperties(bodyFor(transport, "DeviceCredentialSchema"), ["protocol_version", "server_base_url", "environment_id",
      "origin", "device_id", "device_epoch", "credential", "enrolled_at"])
    && !objectFor(bodyFor(transport, "WorkerSessionCredentialSchema"))?.getProperty("control_manifest_hash"),
    "Long-lived credentials must exclude control manifests and implementation identity.");
  const grant = objectFor(bodyFor(transport, "ExecutionGrantSchema"));
  reject(findings, LAWS.route, "static.contract", runtimePath("transport-protocol"), "grant-pure-transport",
    grant?.getProperty("capability_manifest_hash") !== undefined
    && ["plugin_id", "plugin_version", "expected_catalog_hash", "expected_plugin_id", "expected_plugin_version"]
      .every((name) => grant?.getProperty(name) === undefined),
    "Runtime grant must bind capability authority without Product implementation identity.");
  const foundation = sourceFor(context, runtimePath("store-foundation"));
  const taskShape = foundation.getInterface("StoredProductionTask");
  reject(findings, LAWS.core, "static.contract", runtimePath("store-foundation"), "durable-business-identity",
    taskShape !== undefined && !taskShape.getProperty("identity")
    && !taskShape.getProperty("lease_version") && !taskShape.getProperty("execution_fence_hash")
    && taskShape.getProperty("current_attempt_id") !== undefined,
    "Durable identity must remain the Website business task, with current execution authority transported separately.");
  const inventory = sourceFor(context, runtimePath("runtime-storage-inventory"));
  const shape = inventory.getTypeAlias("ProductionRuntimeStorageInventory")?.getType();
  reject(findings, LAWS.storage, "static.contract", runtimePath("runtime-storage-inventory"), "readonly-inventory-contract",
    shape !== undefined && ["directory_count", "owned_directory_count", "orphan_directory_count", "orphan_bytes",
      "orphan_job_ids", "root", "database_task_count", "outbox_responsibility_count", "pending_outbox_count"]
      .every((name) => shape.getProperty(name) !== undefined),
    "Inventory must expose the actual directory and byte denominators without a second persistence mechanism.");
};
