import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { producerClaimRoutesFor } from "../../shared/proof-observation.js";

export const LAWS = {
  core: "LAW-AGENT-PRODUCTION-RUNTIME-001-V80",
  credential: "LAW-AGENT-PRODUCTION-RUNTIME-002-V12",
  route: "LAW-AGENT-PRODUCTION-RUNTIME-003-V50",
  admission: "LAW-AGENT-PRODUCTION-RUNTIME-004-V47",
  database: "LAW-AGENT-PRODUCTION-RUNTIME-005-V44",
  storage: "LAW-AGENT-PRODUCTION-RUNTIME-006-V48",
  staticQuality: "LAW-AGENT-PRODUCTION-RUNTIME-007-V48",
  dynamicProof: "LAW-AGENT-PRODUCTION-RUNTIME-008-V49",
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

const generatedImageReceiptIsExact = (context: InspectorContext, cloud: SourceFile): boolean => {
  const receipt = bodyFor(cloud, "exactGeneratedImageReceipt");
  const guard = receipt?.getDescendantsOfKind(SyntaxKind.IfStatement).find((statement) =>
    hasError(statement.getThenStatement(), "GENERATED_IMAGE_WEBSITE_RECEIPT_MISMATCH"));
  const schema = bodyFor(sourceFor(context, runtimePath("transport-protocol")), "UploadedResultReceiptSchema");
  return exactProperties(schema, ["schema_version", "artifact_id", "role", "object_ref", "sha256",
    "byte_length", "media_type", "state", "receipt_hash"])
    && calls(receipt, "UploadedResultReceiptSchema.parse").length === 1
    && [["receipt.artifact_id", "uploadArtifactId"], ["receipt.sha256", "image.sha256"],
      ["receipt.byte_length", "image.bytes"], ["receipt.media_type", "image.media_type"],
      ["receipt.role", '"generated_image"']].every(([left, right]) =>
      rejectingComparison(guard?.getExpression(), left!, right!));
};

const imageBytesAreValidated = (upload: Node | undefined, guard: Node | undefined): boolean => {
  const byteDeclaration = upload?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "bytes");
  const byteSource = byteDeclaration?.getInitializer();
  const expression = Node.isIfStatement(guard) ? guard.getExpression() : undefined;
  return Node.isCallExpression(byteSource) && byteSource.getExpression().getText() === "Buffer.from"
    && byteSource.getArguments()[0]?.getText() === "image.webp_bytes"
    && rejectingComparison(expression, "bytes.byteLength", "image.bytes")
    && rejectingComparison(expression, "sha256(bytes)", "image.sha256")
    && rejectingComparison(expression, "image.media_type", '"image/webp"');
};
const imageDimensionsAreIdentityOnly = (upload: Node | undefined, guard: Node | undefined): boolean => {
  const imageUses = upload?.getDescendantsOfKind(SyntaxKind.Identifier).filter((node) => node.getText() === "image") ?? [];
  return imageUses.length > 0 && imageUses.every((identifier) => {
    const parent = identifier.getParent();
    if (Node.isParameterDeclaration(parent)) return parent.getNameNode() === identifier;
    if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === identifier) {
      if (!["width", "height"].includes(parent.getName())) return true;
      const use = parent.getParent();
      return Node.isCallExpression(use) && use.getExpression().getText() === "Number.isSafeInteger"
        && use.getArguments().length === 1 && guard !== undefined
        && use.getStart() > guard.getStart() && use.getEnd() < guard.getEnd();
    }
    return Node.isCallExpression(parent) && parent.getExpression().getText() === "exactGeneratedImageReceipt"
      && parent.getArguments()[1] === identifier;
  });
};
export const inspectGeneratedImageTransport = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const path = runtimePath("cloud-client");
  const cloud = sourceFor(context, path);
  const upload = bodyFor(cloud, "uploadGeneratedImage");
  const guard = upload?.getDescendantsOfKind(SyntaxKind.IfStatement).find((statement) =>
    hasError(statement.getThenStatement(), "GENERATED_IMAGE_LOCAL_IDENTITY_MISMATCH"));
  const forbiddenTransport = new Set(["originalSha256", "originalBytes", "originalWidth", "originalHeight",
    "original_sha256", "original_bytes", "provider_original", "targetWidth", "targetHeight"]);
  const accessNames = upload?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).map((node) => node.getName()) ?? [];
  const delivered = calls(upload, "store.readOutboxAuthority")[0];
  const enqueue = calls(upload, "store.enqueue")[0];
  const integerGuards = ["width", "height"].every((field) => calls(guard?.getExpression(), "Number.isSafeInteger")
    .some((call) => call.getArguments()[0]?.getText() === `image.${field}`));
  const transportValid = upload !== undefined && guard !== undefined && delivered !== undefined && enqueue !== undefined
    && guard.getEnd() < delivered.getStart() && guard.getEnd() < enqueue.getStart()
    && imageBytesAreValidated(upload, guard) && integerGuards && imageDimensionsAreIdentityOnly(upload, guard)
    && !accessNames.some((name) => forbiddenTransport.has(name))
    && ["resize", "crop"].every((name) => !calls(upload).some((call) =>
      Node.isPropertyAccessExpression(call.getExpression()) && call.getExpression().getText().endsWith(`.${name}`)))
    && generatedImageReceiptIsExact(context, cloud);
  reject(findings, LAWS.route, "static.contract", path, "generated-image-transport-boundary", transportValid,
    "WebP identity must reject before delivered replay or upload; V6 receipt must be strict and bind the same artifact bytes.");
  inspectGeneratedImageProjection(context, findings);
};
const inspectGeneratedImageProjection = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const projectionPath = `${RUNTIME_ROOT}/website-agent-route-policies.v1.json`;
  const projection = JSON.parse(read(context, projectionPath)) as { routes: { product_id: string; action_id: string;
    result_contract?: { image?: Record<string, unknown> } }[] };
  const image = projection.routes.find((route) => route.product_id === "public_knowledge_article_pipeline"
    && route.action_id === "produce_article")?.result_contract?.image;
  reject(findings, LAWS.route, "static.contract", projectionPath, "generated-image-projection",
    image !== undefined && same(image.exact_fields, ["schema_version", "artifact_id", "object_ref", "sha256",
      "receipt_hash", "bytes", "mime_type", "width", "height"])
    && same((image.field_types as Record<string, unknown>)?.integer, ["bytes", "width", "height"])
    && same(image.integer_minimums, { bytes: 1 }) && image.mime_type === "image/webp"
    && !["width", "height", "aspect_ratio", "max_pixels"].some((key) => Object.hasOwn(image, key)),
    "Provider projection must transport decoded dimensions without geometry restrictions.");
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
  for (const [name, id, version] of [
    ["website-agent-task-result", "ai-acceptance.website-agent-task-result", 22],
    ["xuanxue-ai-production-v6", "ai-acceptance.xuanxue-ai-production-v6", 47],
  ] as const) {
    const path = `docs/specs/agent-production-runtime/${name}.dependency.spec.json`;
    const dependency = JSON.parse(read(context, path)) as { contract: Record<string, unknown>; lawIds: string[] };
    reject(findings, LAWS.route, "static.contract", path, "minimal-current-dependency",
      same(Object.keys(dependency.contract).sort(), ["contractId", "providerRepo", "version"])
      && dependency.contract.contractId === id && dependency.contract.version === version
      && dependency.contract.providerRepo === "ADVISION-X/xuanxue-web"
      && dependency.lawIds.every((lawId) => ALL_LAWS.includes(lawId as typeof ALL_LAWS[number])),
      "Consumer dependency must bind the current provider version using only its three-field identity.");
  }
  const projectionPath = `${RUNTIME_ROOT}/website-agent-route-policies.v1.json`;
  const projection = JSON.parse(read(context, projectionPath)) as { contract_version: number;
    parameter_types: Record<string, unknown>; routes: { product_id: string; action_id: string; relation_kind: string;
      result_contract?: unknown; material_roles: { role: string }[]; required_parameter_keys: string[] }[] };
  const identities = projection.routes.map((route) => `${route.product_id}\0${route.action_id}`);
  const currentRoutes = projection.contract_version === 22 && projection.routes.length === 43
    && Object.keys(projection.parameter_types).length === 43
    && projection.routes.filter((route) => route.result_contract !== undefined).length === 43
    && new Set(identities).size === 43
    && projection.routes.every((route) => route.relation_kind !== "reservation"
      && !route.material_roles.some((role) => role.role === "bazi_private_base_input"))
    && projection.routes.every((route) => new Set(route.required_parameter_keys).size === route.required_parameter_keys.length);
  reject(findings, LAWS.route, "static.contract", projectionPath, "current-route-projection", currentRoutes,
    "Projection must carry task-result v22 and the exact 43/43/43/0 provider denominators without a private base.");
  inspectProviderGenerator(context, findings);
};
const providerProjectionDecodesOriginalBytes = (generator: SourceFile): boolean => {
  const source = bodyFor(generator, "source");
  const decodeExpression = Node.isCallExpression(source) ? source.getExpression() : undefined;
  const decoder = Node.isPropertyAccessExpression(decodeExpression) ? decodeExpression.getExpression() : undefined;
  const options = Node.isNewExpression(decoder) ? decoder.getArguments()?.[1] : undefined;
  return Node.isCallExpression(source) && source.getArguments()[0]?.getText() === "bytes"
    && Node.isNewExpression(decoder) && decoder.getExpression().getText() === "TextDecoder"
    && Node.isObjectLiteralExpression(options) && options.getProperty("fatal")?.getText() === "fatal: true"
    && calls(bodyFor(generator, "projection"), "JSON.parse")[0]?.getArguments()[0]?.getText() === "source"
    && calls(bodyFor(generator, "artifact"), "object")[0]?.getArguments()[0]?.getText() === "projection";
};
const providerBytesComeFromWebsite = (generator: SourceFile): boolean => {
  const bytes = bodyFor(generator, "bytes");
  const readCall = Node.isAwaitExpression(bytes) ? bytes.getExpression() : undefined;
  const path = Node.isCallExpression(readCall) ? readCall.getArguments()[0] : undefined;
  return Node.isCallExpression(readCall) && readCall.getExpression().getText() === "readFile"
    && Node.isCallExpression(path) && path.getExpression().getText() === "resolve"
    && path.getArguments()[0]?.getText() === "provider"
    && literal(path.getArguments()[1]) === "packages/ai-contracts/src/agent-task/website-agent-route-policies.v1.json"
    && providerProjectionDecodesOriginalBytes(generator);
};
const inspectProviderGenerator = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const generatorPath = "scripts/generate/sync-website-agent-route-policy-projection.ts";
  const generator = sourceFor(context, generatorPath);
  reject(findings, LAWS.route, "static.contract", generatorPath, "provider-generator",
    providerBytesComeFromWebsite(generator) && generator.getVariableDeclaration("resultContractRoutes") === undefined
    && compare(generator, "contracts", SyntaxKind.ExclamationEqualsEqualsToken, "43")
    && compare(generator, "identities.size", SyntaxKind.ExclamationEqualsEqualsToken, "43")
    && compare(generator, "used.size", SyntaxKind.ExclamationEqualsEqualsToken, "43")
    && calls(generator, "writeFile").some((call) => call.getArguments()[0]?.getText() === "pending"
      && call.getArguments()[1]?.getText() === "bytes")
    && calls(generator, "rename").some((call) => call.getArguments()[0]?.getText() === "pending"
      && call.getArguments()[1]?.getText() === "destination")
    && calls(generator, "readFile").length === 1,
    "The original generator must derive current routes from the provider rather than a handwritten support table.");
};

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
  inspectGeneratedImageTransport(context, findings);
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
