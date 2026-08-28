import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { createFinding } from "../../shared/finding-utils.js";
import type {
  InspectorContext,
  InspectorEvaluation,
  InspectorFinding,
  SessionInspectorOutput,
} from "../../shared/inspector-contracts.js";
import {
  producerModePassed,
  recordStaticCheck,
  staticClauses,
  staticForbiddenClauses,
  staticEvidenceRefs,
  validateStaticInspection,
} from "../../shared/static-inspection-contract.js";
import {
  observeStaticAst,
  observeStaticContract,
  observeStaticDependency,
  observeStaticFilesystem,
  observeStaticTypes,
} from "../../shared/static-target-object-inspector.js";
const LAW_ID = "LAW-AGENT-PRODUCTION-RUNTIME-001-V6";
const MODE_CLAUSES = {
  "static.filesystem": staticForbiddenClauses(1, 16, 17), "static.ast": staticClauses(2, 4, 5, 9, 10, 11, 13, 14, 15, 17, 18, 19, 20, 21, 23, 24, 25),
  "static.types": staticForbiddenClauses(3, 5, 8, 11, 12), "static.contract": staticForbiddenClauses(3, 5, 6, 7, 8, 12, 13, 15),
  "static.dependency": staticForbiddenClauses(0, 1, 2, 4, 6, 16),
} as const;
const MODE_CHECKS = {
  "static.filesystem": ["inspectAgentFilesystem"], "static.ast": ["inspectAgentProductionRuntime"],
  "static.types": ["inspectAgentTypes"], "static.contract": ["inspectAgentContracts"], "static.dependency": ["inspectAgentDependencies"],
} as const;
const PLUGIN_ROOT = "src/plugins";
const CATALOG_PATH = "src/lib/local-runtime/production/catalog.ts";
const CONTRACT_PATH = "src/lib/local-runtime/production/contracts.ts";
const TRANSPORT_PATH = "src/lib/local-runtime/production/transport-protocol.ts";
const RUNTIME_PATH = "src/lib/local-runtime/production/runtime.ts";
const PLUGIN_CONTRACT_PATH = "src/lib/local-runtime/production/plugin.ts";
const MEDIATOR_PATH = "src/mediator/agent-production-route.ts";
const PSC_PATH = "src/capabilities/gpt/session/gpt-session-controller.ts";
const LOCALIZATION_PLUGIN_PATH = "src/plugins/localization-production/index.ts";
const LOCALIZATION_SKILL_PATH = "src/plugins/localization-production/SKILL.md";
const REAL_PROOF_PATH = "scripts/acceptance/agent-production-runtime.real-proof.ts";
const EXECUTOR_PATH = "src/lib/local-runtime/production/executor.ts";
const CLOUD_CLIENT_PATH = "src/lib/local-runtime/production/cloud-client.ts";
const TYPED_FAILURE_PATH = "src/lib/typed-failure.ts";
const GPT_RESPONSE_PATH = "src/capabilities/gpt/web/children/response-children.ts";
const BROWSER_MUTATION_STORE_PATH = "src/lib/browser/exact-target/browser-mutation-store.ts";
const BROWSER_COMMAND_ACTOR_PATH = "src/lib/browser/exact-target/browser-command-actor.ts";
const PRODUCTION_BLUEPRINT_PATH = "docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md";
const forbiddenDeterministicProducts = [
  "bazi_basic_chart",
  "bazi_pdf_export",
  "qimen_basic_chart",
  "qimen_professional_chart",
  "hehun_case_preparation",
] as const;
const businessTokens = [
  "bazi_", "qimen_", "hehun_", "naming_", "localization_", "payment_screenshot_",
  "public_knowledge_", "八字", "奇门", "合婚", "起名", "本地化", "付款截图",
] as const;

const finding = (checkId: string, filePath: string, message: string, line?: number,
  evidenceMode = "static.ast"): InspectorFinding =>
  createFinding({
    evidenceMode,
    lawId: LAW_ID,
    clauseId: `${LAW_ID.toLowerCase()}-requirement`,
    checkId,
    filePath,
    message,
    ...(line === undefined ? {} : { line }),
  });

const sourceFor = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolve(context.sealedRoot, repoPath));

const read = (context: InspectorContext, repoPath: string): string =>
  readFileSync(resolve(context.sealedRoot, repoPath), "utf8");
const pluginDirectories = (context: InspectorContext): string[] => {
  const root = resolve(context.sealedRoot, PLUGIN_ROOT);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => entry.name)
    .sort();
};
const importsAnotherPlugin = (
  context: InspectorContext,
  pluginId: string,
  indexPath: string,
  specifier: string,
): boolean => {
  if (!specifier.startsWith(".")) return false;
  const pluginsRoot = resolve(context.sealedRoot, PLUGIN_ROOT);
  const importedPath = resolve(dirname(resolve(context.sealedRoot, indexPath)), specifier);
  const importedRelativePath = relative(pluginsRoot, importedPath);
  if (importedRelativePath.startsWith("..") || importedRelativePath === "") return false;
  const importedRoot = importedRelativePath.split("/")[0]!;
  const importedRootPath = resolve(pluginsRoot, importedRoot);
  return importedRoot !== pluginId && existsSync(importedRootPath) && statSync(importedRootPath).isDirectory();
};

const inspectPluginRoot = (
  context: InspectorContext,
  findings: InspectorFinding[],
  pluginId: string,
): void => {
  const root = resolve(context.sealedRoot, PLUGIN_ROOT, pluginId);
  const entries = readdirSync(root, { withFileTypes: true });
  const skills = entries.filter((entry) => entry.isFile() && entry.name.toLocaleLowerCase("en-US") === "skill.md");
  const indexPath = `${PLUGIN_ROOT}/${pluginId}/index.ts`;
  if (skills.length !== 1) findings.push(finding(
    "agent-production-runtime/one-skill-per-plugin", `${PLUGIN_ROOT}/${pluginId}`,
    `${pluginId} must own exactly one same-root SKILL.md; found ${skills.length}.`,
  ));
  if (!existsSync(resolve(context.sealedRoot, indexPath))) findings.push(finding(
    "agent-production-runtime/plugin-entry-present", indexPath, `${pluginId} is missing its Product Plugin entry.`,
  ));
  if (skills.length === 1) inspectProductSkill(findings, pluginId, root, skills[0]!.name);
  const pluginSource = sourceFor(context, indexPath);
  if (!pluginSource) return;
  for (const declaration of pluginSource.getImportDeclarations()) {
    const specifier = declaration.getModuleSpecifierValue();
    if (importsAnotherPlugin(context, pluginId, indexPath, specifier)) findings.push(finding(
      "agent-production-runtime/plugin-cross-import",
      indexPath,
      `${pluginId} imports another Product Plugin through ${specifier}.`,
      declaration.getStartLineNumber(),
    ));
  }
};

const inspectProductSkill = (
  findings: InspectorFinding[],
  pluginId: string,
  root: string,
  skillFileName: string,
): void => {
  const skillPath = join(root, skillFileName);
  const skillText = readFileSync(skillPath, "utf8");
  if (statSync(skillPath).size < 1_400 || !skillText.includes("## ") || !skillText.includes("复核")) {
    findings.push(finding("agent-production-runtime/skill-not-shell", relative(resolve(root, "../../.."), skillPath),
      `${pluginId} Product Skill is an empty or under-specified shell.`));
  }
  for (const token of ["Stage", "runTurn", "step_id", "checkpoint_schema_version", "same_conversation_as"]) {
    if (skillText.includes(token)) findings.push(finding(
      "agent-production-runtime/skill-execution-truth-forbidden",
      relative(resolve(root, "../../.."), skillPath),
      `${pluginId} Product Skill contains executable runtime token ${token}.`,
    ));
  }
};

const inspectPluginRoots = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const pluginIds = pluginDirectories(context);
  if (pluginIds.length !== 12) {
    findings.push(finding("agent-production-runtime/plugin-count", PLUGIN_ROOT,
      `Catalog surface must contain exactly twelve Product Plugin roots; found ${pluginIds.length}: ${pluginIds.join(",")}.`));
  }
  if (pluginIds.includes("xuanxue-ai-production")) {
    findings.push(finding("agent-production-runtime/giant-plugin-retired", `${PLUGIN_ROOT}/xuanxue-ai-production`,
      "The retired giant xuanxue-ai-production Plugin remains physically present."));
  }

  const catalog = sourceFor(context, CATALOG_PATH);
  if (!catalog) {
    findings.push(finding("agent-production-runtime/catalog-present", CATALOG_PATH, "The unique Product Plugin Catalog is missing."));
    return;
  }
  const catalogPluginImports = catalog.getImportDeclarations()
    .map((declaration) => declaration.getModuleSpecifierValue())
    .filter((specifier) => specifier.startsWith("../../../plugins/"))
    .map((specifier) => specifier.slice("../../../plugins/".length).split("/")[0])
    .filter((value): value is string => Boolean(value))
    .sort();
  if (new Set(catalogPluginImports).size !== 12
    || JSON.stringify(catalogPluginImports) !== JSON.stringify(pluginIds)) {
    findings.push(finding("agent-production-runtime/catalog-is-plugin-denominator", CATALOG_PATH,
      `Catalog imports must be the exact Plugin-root denominator; imports=${catalogPluginImports.join(",")}; roots=${pluginIds.join(",")}.`));
  }
  const catalogText = catalog.getFullText();
  for (const forbidden of forbiddenDeterministicProducts) {
    if (catalogText.includes(forbidden)) findings.push(finding(
      "agent-production-runtime/deterministic-product-forbidden",
      CATALOG_PATH,
      `Website-deterministic product ${forbidden} must not enter the AGENT Catalog.`,
    ));
  }

  for (const pluginId of pluginIds) inspectPluginRoot(context, findings, pluginId);
};

const inspectContractsAndMediator = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const pluginContract = sourceFor(context, PLUGIN_CONTRACT_PATH);
  const productPlugin = pluginContract?.getInterface("ProductPlugin");
  const actualKeys = productPlugin?.getMembers().map((member) => {
    if (Node.isPropertySignature(member) || Node.isMethodSignature(member)) return member.getName();
    return "";
  }).filter(Boolean).sort() ?? [];
  const expectedKeys = ["accepts", "checkpointSchemaVersion", "execute", "parseResult", "pluginId", "pluginVersion", "skillHash"].sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) findings.push(finding(
    "agent-production-runtime/product-plugin-exact-shape",
    PLUGIN_CONTRACT_PATH,
    `ProductPlugin must expose exactly seven fields; found ${actualKeys.join(",")}.`,
  ));

  const contracts = sourceFor(context, CONTRACT_PATH);
  const contractText = contracts?.getFullText() ?? "";
  for (const required of [
    "WebsiteAgentTaskSchema", "WebsiteAgentResultSchema", "AgentPluginCapabilityManifestSchema",
    "catalog_hash", "plugin_id", "plugin_version", "skill_hash", "checkpoint_schema_version", "request_hash",
    "material_id", "ordinal", "display_name", "owner_scope_hash", "trust_class", "may_issue_instruction",
    "review_policy", "accuracy_challenge", "quality_reflection",
  ]) {
    if (!contractText.includes(required)) findings.push(finding(
      "agent-production-runtime/contract-binding", CONTRACT_PATH, `Production contracts are missing ${required}.`,
    ));
  }
  for (const forbidden of ["stage_id", "graph", "join_topology", "provider_url", "retry_flow", "plugin_status"]) {
    if (contractText.includes(forbidden)) findings.push(finding(
      "agent-production-runtime/website-execution-field-forbidden", CONTRACT_PATH,
      `Website task contract surface contains forbidden execution field ${forbidden}.`,
    ));
  }

  const mediator = sourceFor(context, MEDIATOR_PATH);
  const mediatorText = mediator?.getFullText() ?? "";
  for (const required of ["WebsiteAgentTaskSchema.parse", "resolveProductionPlugin", ".execute("]) {
    if (!mediatorText.includes(required)) findings.push(finding(
      "agent-production-runtime/thin-mediator", MEDIATOR_PATH, `Mediator is missing required one-shot dispatch operation ${required}.`,
    ));
  }
  for (const forbidden of ["runTurn", "prompt", "selector", "modelFamily", "reasoningTier", "checkpoint", "retry", "Browser"]) {
    if (mediatorText.includes(forbidden)) findings.push(finding(
      "agent-production-runtime/mediator-authority-leak", MEDIATOR_PATH,
      `Mediator contains forbidden execution authority token ${forbidden}.`,
    ));
  }
  const mediatorFiles = readdirSync(resolve(context.sealedRoot, "src/mediator"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => entry.name);
  if (JSON.stringify(mediatorFiles.sort()) !== JSON.stringify(["agent-production-route.ts"])) findings.push(finding(
    "agent-production-runtime/one-mediator", "src/mediator",
    `Exactly one production Mediator is allowed; found ${mediatorFiles.sort().join(",")}.`,
  ));
};

const inspectSharedRuntimeAndPsc = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const runtimeRoot = resolve(context.sealedRoot, "src/lib/local-runtime/production");
  for (const entry of readdirSync(runtimeRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")
      || ["catalog.ts", "contracts.ts", "route-policy.ts"].includes(entry.name)) continue;
    const repoPath = `src/lib/local-runtime/production/${entry.name}`;
    const text = read(context, repoPath);
    for (const token of businessTokens) {
      if (text.includes(token)) findings.push(finding(
        "agent-production-runtime/shared-runtime-product-neutral", repoPath,
        `Shared production runtime contains product semantic token ${token}.`,
      ));
    }
  }
  const psc = sourceFor(context, PSC_PATH);
  const pscText = psc?.getFullText() ?? "";
  for (const required of [
    "continuation_ref", "plugin_id", "owner_ref", "subject_ref", "authorization_ref",
    "conversation_identity_hash", "lane_version", "lane_owner_job_id",
  ]) {
    if (!pscText.toLocaleLowerCase("en-US").includes(required.toLocaleLowerCase("en-US"))) findings.push(finding(
      "agent-production-runtime/psc-durable-binding", PSC_PATH, `Provider Session Controller is missing ${required}.`,
    ));
  }
  for (const token of businessTokens) {
    if (pscText.includes(token)) findings.push(finding(
      "agent-production-runtime/psc-product-neutral", PSC_PATH,
      `Provider Session Controller contains product semantic token ${token}.`,
    ));
  }
  const secondControllers = context.targetPaths.filter((path) =>
    path !== PSC_PATH && path.endsWith("session-controller.ts"));
  if (secondControllers.length) findings.push(finding(
    "agent-production-runtime/one-provider-session-controller", secondControllers[0]!,
    `A second Provider Session Controller exists: ${secondControllers.join(",")}.`,
  ));
};

const inspectRetirementAndDurability = (context: InspectorContext, findings: InspectorFinding[]): void => {
  for (const retired of [
    "src/plugins/xuanxue-ai-production",
    "src/mediator/xuanxue-ai-production-route.ts",
    "src/lib/local-runtime/workbench-xuanxue-ai-production-handle.ts",
    "src/app/app-shell/xuanxue-ai-production-workspace.ts",
    "src/capabilities/ai-input-gateway",
    "src/lib/online-ai",
  ]) {
    if (existsSync(resolve(context.sealedRoot, retired))) findings.push(finding(
      "agent-production-runtime/retired-path-zero", retired, `${retired} must be physically absent.`,
    ));
  }
  const storeText = read(context, "src/lib/local-runtime/production/store.ts");
  for (const required of [
    "journal_mode = WAL", "identity_json", "plugin_id", "plugin_version", "request_hash",
    "PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT",
    "PLUGIN_IDENTITY_CHANGED_BEFORE_RECOVERY", "review_required", "lane_owner_job_id",
  ]) {
    if (!storeText.includes(required)) findings.push(finding(
      "agent-production-runtime/durable-runtime", "src/lib/local-runtime/production/store.ts",
      `Production store is missing durable invariant ${required}.`,
    ));
  }
  if (storeText.includes("production_stages")) findings.push(finding(
    "agent-production-runtime/stage-ledger-retired", "src/lib/local-runtime/production/store.ts",
    "Production store still contains the retired website Stage mirror.",
  ));

  const transportText = read(context, TRANSPORT_PATH);
  for (const required of [
    "ClaimedProductionTaskSchema", "ExecutionGrantSchema", "ExecutionFenceSchema",
    "WebsiteAgentTaskSchema.safeParse", "V6_CLAIM_TASK_GRANT_MISMATCH",
    "WebsiteAgentTaskSchema.parse(projectWebsiteAgentTaskEnvelope(claim))",
  ]) {
    if (!transportText.includes(required)) findings.push(finding(
      "agent-production-runtime/v6-claim-projection", TRANSPORT_PATH,
      `V6 claim validation and strict WebsiteAgentTask projection are missing ${required}.`,
    ));
  }

  const runtimeText = read(context, RUNTIME_PATH);
  const durableAcceptAt = runtimeText.indexOf("state.executor.accept(task)");
  const acceptedAt = runtimeText.indexOf("accepted = true", durableAcceptAt);
  const remoteCheckpointAt = runtimeText.indexOf("checkpointWithLog(", acceptedAt);
  if (durableAcceptAt < 0 || acceptedAt <= durableAcceptAt || remoteCheckpointAt <= acceptedAt) findings.push(finding(
    "agent-production-runtime/durable-accept-before-remote-checkpoint", RUNTIME_PATH,
    "The runtime must mark durable local acceptance before attempting the remote acceptance checkpoint.",
  ));

  const localizationPluginText = read(context, LOCALIZATION_PLUGIN_PATH);
  const localizationSkillText = read(context, LOCALIZATION_SKILL_PATH);
  for (const required of ["source_content", "target_locale", "terminology", "locale_policy"]) {
    if (!localizationPluginText.includes(required)) findings.push(finding(
      "agent-production-runtime/localization-input-contract", LOCALIZATION_PLUGIN_PATH,
      `Localization production input is missing ${required}.`,
    ));
  }
  for (const required of ["目标 locale", "术语表", "locale policy", "FrozenSubject"]) {
    if (!localizationSkillText.includes(required)) findings.push(finding(
      "agent-production-runtime/localization-skill-boundary", LOCALIZATION_SKILL_PATH,
      `Localization Product Skill is missing its required ${required} boundary.`,
    ));
  }

};

const inspectDirectDynamicProof = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const realProofText = read(context, REAL_PROOF_PATH);
  for (const required of [
    "chromium.launchPersistentContext", "readProductionTaskStatus", "production-runtime.sqlite",
    "browser-mutations.sqlite", "GOVERNANCE_PROOF_RECEIPT_DIR", "GRASSEYE_PRODUCTION_PROOF_JOB_IDS",
    "agentPluginCapabilityManifest", "BROWSER_ACTION_COMPLETED", "recovery_pending", "target=claimed",
    "target=absent", "gpt-child-proof:", "sent provider terminal receipt",
  ]) {
    if (!realProofText.includes(required)) findings.push(finding(
      "agent-production-runtime/direct-dynamic-proof", REAL_PROOF_PATH,
      `The RELEASE producer is missing direct real-runtime observation ${required}.`,
    ));
  }
  for (const forbidden of [
    "GRASSEYE_GPT_DYNAMIC_PROOF_PATH", "agent-production-runtime-gpt-dynamic-proof.v1",
    "candidate_hash", "same_job_id", "zero_replayed_mutations",
  ]) {
    if (realProofText.includes(forbidden)) findings.push(finding(
      "agent-production-runtime/self-asserted-dynamic-proof-forbidden", REAL_PROOF_PATH,
      `The RELEASE producer still accepts self-asserted proof token ${forbidden}.`,
    ));
  }
};

const inspectV5Hardening = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const required: ReadonlyArray<Readonly<{ path: string; checkId: string; tokens: readonly string[] }>> = [
    { path: PLUGIN_CONTRACT_PATH, checkId: "strict-result-parser", tokens: ["readonly parseResult:"] },
    { path: EXECUTOR_PATH, checkId: "strict-result-parser", tokens: ["authorized.plugin.parseResult", "safeGptEvidenceProjection", "appendRecord", "readRecordRef", "EVIDENCE_READBACK_FAILED"] },
    { path: CLOUD_CLIENT_PATH, checkId: "result-receipt-binding", tokens: ["plugin.parseResult", "uploadGeneratedImage", "execution_receipt_hash", "evidence_refs"] },
    { path: GPT_RESPONSE_PATH, checkId: "generated-image-bytes", tokens: ["sharp(original", ".resize(1200, 630", ".webp(", "metadata.exif", "metadata.xmp", "GPT_GENERATED_IMAGE_READBACK_INVALID"] },
    { path: TYPED_FAILURE_PATH, checkId: "typed-failure-chain", tokens: ["typedExecutionFailure", "httpStatus", "cause"] },
    { path: RUNTIME_PATH, checkId: "typed-failure-chain", tokens: ["typedExecutionFailure(error)?.code", "causedByEventId"] },
    { path: TRANSPORT_PATH, checkId: "typed-failure-chain", tokens: ["executionFailure(", "httpStatus"] },
    { path: CONTRACT_PATH, checkId: "binary-terminal", tokens: ["z.enum([\"completed\", \"failed\"])", "SerializedExecutionFailureSchema"] },
    { path: RUNTIME_PATH, checkId: "bounded-attempt-decision", tokens: ["RETRY_FROM_CHECKPOINT", "RECONCILE_ONLY", "FINAL_FAILED", "attempt_mode", "max_provider_turns"] },
    { path: CLOUD_CLIENT_PATH, checkId: "attempt-failure-receipt", tokens: ["attempt_failure", "RETRY_FROM_CHECKPOINT", "RECONCILE_ONLY"] },
    { path: BROWSER_MUTATION_STORE_PATH, checkId: "logical-mutation-identity", tokens: ["logical_mutation_id", "browser_mutations_logical_identity"] },
    { path: BROWSER_COMMAND_ACTOR_PATH, checkId: "logical-mutation-identity", tokens: ["logicalMutationId", "permit.sequence", "hashValue(command)"] },
    { path: PRODUCTION_BLUEPRINT_PATH, checkId: "local-agent-process-owner", tokens: ["AGENT 始终运行在用户本地 Mac", "不授予网站 AGENT 进程"] },
  ];
  for (const entry of required) {
    const source = read(context, entry.path);
    for (const token of entry.tokens) if (!source.includes(token)) findings.push(finding(
      `agent-production-runtime/${entry.checkId}`, entry.path,
      `V5 hardening boundary is missing ${token}.`, undefined, "static.ast",
    ));
  }
  const executor = read(context, EXECUTOR_PATH);
  const projectionStart = executor.indexOf("const safeGptEvidenceProjection");
  const projectionEnd = executor.indexOf("export class ProductionExecutor", projectionStart);
  const projection = projectionStart >= 0 && projectionEnd > projectionStart
    ? executor.slice(projectionStart, projectionEnd) : "";
  for (const forbidden of ["raw_url", "selector", "prompt", "local_path", "html"]) {
    if (!projection || projection.toLocaleLowerCase("en-US").includes(forbidden)) findings.push(finding(
      "agent-production-runtime/forensics-safe-projection", EXECUTOR_PATH,
      `Forensics evidence projection is missing or contains forbidden field ${forbidden}.`, undefined, "static.ast",
    ));
  }
  if (read(context, TRANSPORT_PATH).includes("retryable")) findings.push(finding(
    "agent-production-runtime/typed-failure-chain", TRANSPORT_PATH,
    "The production transport reintroduced a retryable boolean beside the typed failure chain.", undefined, "static.ast",
  ));
};

const inspectAgentProductionRuntime = (context: InspectorContext, findings: InspectorFinding[]): void => {
  inspectPluginRoots(context, findings);
  inspectContractsAndMediator(context, findings);
  inspectSharedRuntimeAndPsc(context, findings);
  inspectRetirementAndDurability(context, findings);
  inspectDirectDynamicProof(context, findings);
  inspectV5Hardening(context, findings);
};
const inspectAgentFilesystem = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const plugins = pluginDirectories(context);
  if (plugins.length !== 12) findings.push(finding("agent-production-runtime/filesystem-plugin-count", PLUGIN_ROOT,
    `Expected twelve physical Product Plugin roots; found ${plugins.length}.`, undefined, "static.filesystem"));
  for (const pluginId of plugins) {
    const root = resolve(context.sealedRoot, PLUGIN_ROOT, pluginId);
    const files = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isFile());
    if (files.filter((entry) => entry.name.toLocaleLowerCase("en-US") === "skill.md").length !== 1
      || !files.some((entry) => entry.name === "index.ts")) findings.push(finding(
      "agent-production-runtime/filesystem-plugin-pair", `${PLUGIN_ROOT}/${pluginId}`,
      `${pluginId} must physically contain one SKILL.md and one index.ts.`, undefined, "static.filesystem"));
  }
  for (const retired of ["src/plugins/xuanxue-ai-production", "src/mediator/xuanxue-ai-production-route.ts",
    "src/lib/local-runtime/workbench-xuanxue-ai-production-handle.ts", "src/capabilities/ai-input-gateway",
    "src/lib/online-ai"]) if (existsSync(resolve(context.sealedRoot, retired))) findings.push(finding(
    "agent-production-runtime/filesystem-retired-path", retired, `${retired} must be absent.`, undefined,
    "static.filesystem"));
};
const inspectAgentTypes = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const source = sourceFor(context, PLUGIN_CONTRACT_PATH);
  const plugin = source?.getInterface("ProductPlugin");
  const expected = new Map([["pluginId", "string"], ["pluginVersion", "number"], ["checkpointSchemaVersion", "number"],
    ["execute", "Promise<WebsiteAgentResult>"]]);
  for (const [name, type] of expected) {
    const member = plugin?.getMembers().find((candidate) => "getName" in candidate && candidate.getName() === name);
    const actual = member && "getReturnType" in member ? member.getReturnType().getText(member)
      : member && "getType" in member ? member.getType().getText(member) : "missing";
    if (!actual.endsWith(type)) findings.push(finding("agent-production-runtime/typed-plugin-contract",
      PLUGIN_CONTRACT_PATH, `${name} must resolve to ${type}; found ${actual}.`, undefined, "static.types"));
  }
};
const inspectAgentContracts = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const contracts = read(context, CONTRACT_PATH);
  for (const token of ["WebsiteAgentTaskSchema", "WebsiteAgentResultSchema", "AgentPluginCapabilityManifestSchema",
    "catalog_hash", "plugin_id", "plugin_version", "skill_hash", "request_hash", "owner_scope_hash", "trust_class"])
    if (!contracts.includes(token)) findings.push(finding("agent-production-runtime/parsed-contract-field", CONTRACT_PATH,
      `Production contract is missing ${token}.`, undefined, "static.contract"));
  for (const token of ["stage_id", "graph", "provider_url", "retry_flow", "plugin_status"])
    if (contracts.includes(token)) findings.push(finding("agent-production-runtime/forbidden-contract-field", CONTRACT_PATH,
      `Production contract contains ${token}.`, undefined, "static.contract"));
};
const inspectAgentDependencies = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const plugins = pluginDirectories(context);
  const catalog = sourceFor(context, CATALOG_PATH);
  const imports = catalog?.getImportDeclarations().map((declaration) => declaration.getModuleSpecifierValue())
    .filter((specifier) => specifier.startsWith("../../../plugins/"))
    .map((specifier) => specifier.slice("../../../plugins/".length).split("/")[0]!).sort() ?? [];
  if (JSON.stringify(imports) !== JSON.stringify(plugins)) findings.push(finding(
    "agent-production-runtime/dependency-catalog-denominator", CATALOG_PATH,
    `Catalog imports ${imports.join(",")} but Plugin roots are ${plugins.join(",")}.`, undefined, "static.dependency"));
  for (const pluginId of plugins) {
    const indexPath = `${PLUGIN_ROOT}/${pluginId}/index.ts`;
    for (const declaration of sourceFor(context, indexPath)?.getImportDeclarations() ?? []) {
      const specifier = declaration.getModuleSpecifierValue();
      if (importsAnotherPlugin(context, pluginId, indexPath, specifier)) findings.push(finding(
        "agent-production-runtime/dependency-cross-plugin", indexPath,
        `${pluginId} imports another Product Plugin through ${specifier}.`, declaration.getStartLineNumber(),
        "static.dependency"));
    }
  }
};

const evaluate = (context: InspectorContext): InspectorEvaluation => {
  const findings: InspectorFinding[] = [];
  const staticCheckReceipts: InspectorEvaluation["staticCheckReceipts"] = [];
  recordStaticCheck({ check: "inspectAgentProductionRuntime", findings, lawIds: [LAW_ID], receipts: staticCheckReceipts,
    run: () => inspectAgentProductionRuntime(context, findings), });
  recordStaticCheck({ check: "inspectAgentFilesystem", findings, lawIds: [LAW_ID], receipts: staticCheckReceipts,
    run: () => inspectAgentFilesystem(context, findings) });
  recordStaticCheck({ check: "inspectAgentTypes", findings, lawIds: [LAW_ID], receipts: staticCheckReceipts,
    run: () => inspectAgentTypes(context, findings) });
  recordStaticCheck({ check: "inspectAgentContracts", findings, lawIds: [LAW_ID], receipts: staticCheckReceipts,
    run: () => inspectAgentContracts(context, findings) });
  recordStaticCheck({ check: "inspectAgentDependencies", findings, lawIds: [LAW_ID], receipts: staticCheckReceipts,
    run: () => inspectAgentDependencies(context, findings) });
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...context.targetPaths],
    staticCheckReceipts,
  };
};
const observationFor = (
  context: InspectorContext,
  evidenceMode: "static.filesystem" | "static.ast" | "static.types" | "static.contract" | "static.dependency",
  receipts: InspectorEvaluation["staticCheckReceipts"],
): string[] => {
  const checks = MODE_CHECKS[evidenceMode];
  const input = {
    context,
    lawId: LAW_ID,
    evidenceMode,
    clauses: MODE_CLAUSES[evidenceMode],
    checks,
    executionPassed: producerModePassed(receipts, LAW_ID, checks),
  };
  if (evidenceMode === "static.filesystem") return observeStaticFilesystem(input);
  if (evidenceMode === "static.ast") return observeStaticAst(input);
  if (evidenceMode === "static.types") return observeStaticTypes(input);
  if (evidenceMode === "static.contract") return observeStaticContract(input);
  return observeStaticDependency(input);
};
export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const evaluation = evaluate(context);
  const checks = (evidenceMode: keyof typeof MODE_CLAUSES): string[] => [...MODE_CHECKS[evidenceMode]];
  const assertions = ([
    "static.filesystem", "static.ast", "static.types", "static.contract", "static.dependency",
  ] as const).map((evidenceMode) => ({
    clauses: [...MODE_CLAUSES[evidenceMode]],
    evidenceMode,
    passed: producerModePassed(evaluation.staticCheckReceipts, LAW_ID, checks(evidenceMode)),
    refs: staticEvidenceRefs(context, LAW_ID, evidenceMode, MODE_CLAUSES[evidenceMode], evaluation.staticCheckReceipts,
      checks(evidenceMode), observationFor(context, evidenceMode, evaluation.staticCheckReceipts)),
  }));
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: evaluation.reportedLawIds,
    lawResults: [{ lawId: LAW_ID, assertions, findings: evaluation.findings }],
    inspectedFiles: evaluation.inspectedFiles,
  });
};
