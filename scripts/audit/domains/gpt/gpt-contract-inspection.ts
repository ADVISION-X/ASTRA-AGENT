import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import {
  inspectMissingTokens,
  sourceFor,
  sourceTextForPaths,
  type FindingFactory,
} from "./gpt-inspection-support.js";
const ROOT = "src/capabilities/gpt";
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const CHILD_TYPES_PATH = `${ROOT}/child-types.ts`;
const SCHEMA_PATH = `${ROOT}/schema.ts`;
const CHILDREN_PATH = `${ROOT}/children`;
const GROUP_PATH = `${ROOT}/ability-group.ts`;
const HANDLER_REGISTRY_PATH = `${ROOT}/handler-registry.ts`;
const childFilePath = (id: string, file: string): string => `${CHILDREN_PATH}/${id}/${file}`;
const MODEL_HANDLER_PATH = `${CHILDREN_PATH}/select_exact_gpt_model_v2/handler.ts`;
const MODEL_HANDLER_PATHS = [
  `${CHILDREN_PATH}/open_gpt_model_selector_v2/handler.ts`,
  childFilePath("open_gpt_model_selector_v2", "observation.ts"),
  childFilePath("open_gpt_model_selector_v2", "selectors.ts"),
  MODEL_HANDLER_PATH,
  childFilePath("select_exact_gpt_model_v2", "observation.ts"),
  childFilePath("select_exact_gpt_model_v2", "selectors.ts"),
] as const;
const MODEL_CONTRACT_PATH = childFilePath("select_exact_gpt_model_v2", "selectors.ts");
const PROFILE_HANDLER_PATH = `${CHILDREN_PATH}/ensure_gpt_reasoning_requirement/handler.ts`;
const PROFILE_HANDLER_PATHS = [
  `${CHILDREN_PATH}/open_gpt_execution_profile/handler.ts`,
  childFilePath("open_gpt_execution_profile", "observation.ts"),
  childFilePath("open_gpt_execution_profile", "selectors.ts"),
  PROFILE_HANDLER_PATH,
  childFilePath("ensure_gpt_reasoning_requirement", "observation.ts"),
  childFilePath("ensure_gpt_reasoning_requirement", "selectors.ts"),
  `${CHILDREN_PATH}/close_gpt_execution_profile/handler.ts`,
  childFilePath("close_gpt_execution_profile", "observation.ts"),
  childFilePath("close_gpt_execution_profile", "selectors.ts"),
  `${ROOT}/web/execution-profile-input.ts`,
] as const;
const PROFILE_CONTRACT_PATH = childFilePath("ensure_gpt_reasoning_requirement", "selectors.ts");
const childIdsFromContract = (contract: SourceFile): string[] => {
  const initializer = contract.getVariableDeclaration("GPT_CHILD_CONTRACTS")?.getInitializer();
  const object = initializer && Node.isObjectLiteralExpression(initializer)
    ? initializer
    : initializer?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression);
  return object ? object.getProperties().flatMap((property) =>
    Node.isPropertyAssignment(property) ? [property.getName().replace(/^['"]|['"]$/gu, "")] : []).sort() : [];
};

const childDirectoryIds = (context: InspectorContext): string[] => {
  const root = resolve(context.sealedRoot, CHILDREN_PATH);
  return existsSync(root) ? readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort() : [];
};

const handlerIds = (context: InspectorContext, directories: readonly string[]): string[] => directories
  .flatMap((directory) => {
    const source = sourceFor(context, `${CHILDREN_PATH}/${directory}/handler.ts`);
    return source?.getVariableDeclarations().flatMap((declaration) => {
      if (!declaration.isExported()) return [];
      const match = declaration.getTypeNode()?.getText().match(/GptChildHandler<\s*["']([^"']+)["']\s*>/u);
      return match?.[1] ? [match[1]] : [];
    }) ?? [];
  })
  .sort();

const mappedHandlerIds = (context: InspectorContext): string[] => {
  const initializer = sourceFor(context, HANDLER_REGISTRY_PATH)?.getVariableDeclaration("gptChildHandlers")?.getInitializer();
  const object = initializer && Node.isObjectLiteralExpression(initializer)
    ? initializer : initializer?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression);
  return object?.getProperties().flatMap((property) =>
    Node.isPropertyAssignment(property) ? [property.getName().replace(/^['"]|['"]$/gu, "")] : []).sort() ?? [];
};

const privateSupportConsumers = (
  context: InspectorContext,
  directory: string,
  support: SourceFile,
): Readonly<{ importers: number; names: ReadonlySet<string> }> => {
  const prefix = resolve(context.sealedRoot, CHILDREN_PATH, directory);
  const names = new Set<string>();
  let importers = 0;
  for (const source of context.project.getSourceFiles()) {
    if (source === support || !source.getFilePath().startsWith(`${prefix}/`)) continue;
    for (const declaration of source.getImportDeclarations()) {
      if (declaration.getModuleSpecifierSourceFile() !== support) continue;
      importers += 1;
      for (const named of declaration.getNamedImports()) names.add(named.getName());
      if (declaration.getNamespaceImport()) names.add("*");
    }
  }
  return Object.freeze({ importers, names });
};

const inspectPrivateSupportSource = (
  context: InspectorContext,
  directory: string,
  file: string,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const path = `${CHILDREN_PATH}/${directory}/${file}`;
  const source = sourceFor(context, path);
  if (!source) return;
  const consumers = privateSupportConsumers(context, directory, source);
  if (consumers.importers === 0) findings.push(finding(
    "gpt/child-private-support-consumer", path,
    `Child private support ${file} has no importer inside ${directory}.`,
  ));
  for (const [name, declarations] of source.getExportedDeclarations()) {
    if (consumers.names.has(name) || consumers.names.has("*")) continue;
    findings.push(finding(
      "gpt/child-private-export-consumer", path,
      `Child private export ${name} has no importer inside ${directory}.`,
      declarations[0]?.getStartLineNumber(),
    ));
  }
  for (const declaration of source.getVariableDeclarations()) {
    const statement = declaration.getVariableStatement();
    if (statement?.isExported()) continue;
    const name = declaration.getNameNode();
    if (!Node.isIdentifier(name) || name.findReferencesAsNodes().length > 0) continue;
    findings.push(finding(
      "gpt/child-private-dead-declaration", path,
      `Child private declaration ${declaration.getName()} has no runtime or type consumer.`,
      declaration.getStartLineNumber(),
    ));
  }
  for (const forbidden of [
    "GptAnyChildCapabilityIntent", "GptChildHandlerMap[keyof",
    "includeSend", "includeTurns", "includeAttachments",
  ]) if (source.getFullText().includes(forbidden)) findings.push(finding(
    "gpt/child-private-exact-intent", path,
    `Child private support retains generic sibling-semantic token ${forbidden}.`,
  ));
};

const inspectRequiredChildIds = (
  ids: readonly string[],
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  for (const required of [
    "open_gpt_model_selector_v2", "select_exact_gpt_model_v2", "ensure_gpt_reasoning_requirement",
  ]) if (!ids.includes(required)) findings.push(finding(
    "gpt/model-selection-v2-required", CONTRACT_PATH, `The public denominator is missing ${required}.`,
  ));
};

const profileDenominator = (contract: SourceFile): Readonly<Record<string, number>> => {
  const profileCounts = new Map<string, number>();
  const contracts = contract.getVariableDeclaration("GPT_CHILD_CONTRACTS")?.getInitializer();
  const contractObject = contracts && Node.isObjectLiteralExpression(contracts)
    ? contracts : contracts?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression);
  for (const property of contractObject?.getProperties() ?? []) {
    if (!Node.isPropertyAssignment(property)) continue;
    const profile = property.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression)?.getProperty("profile");
    const value = Node.isPropertyAssignment(profile)
      ? profile.getInitializerIfKind(SyntaxKind.StringLiteral)?.getLiteralValue() : undefined;
    if (value) profileCounts.set(value, (profileCounts.get(value) ?? 0) + 1);
  }
  return Object.fromEntries([...profileCounts].sort());
};

const inspectChildDirectories = (
  context: InspectorContext,
  directories: readonly string[],
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  for (const directory of directories) {
    const path = resolve(context.sealedRoot, CHILDREN_PATH, directory);
    const files = readdirSync(path).filter((name) => name !== ".DS_Store").sort();
    const handlers = files.filter((name) => name === "handler.ts");
    const invalid = files.filter((name) => !name.endsWith(".ts") || name === "index.ts"
      || /(?:^|[-_.])(common|shared|utils?|service|manager|facade|bridge|adapter)(?:[-_.]|$)/u.test(name));
    if (handlers.length !== 1 || invalid.length > 0) findings.push(finding(
      "gpt/one-private-slice-per-child", `${CHILDREN_PATH}/${directory}`,
      `Child directory ${directory} must contain one handler.ts and only explicit private TypeScript support; found ${files.join(",") || "none"}.`,
    ));
    for (const file of files.filter((name) => name.endsWith(".ts") && name !== "handler.ts")) {
      inspectPrivateSupportSource(context, directory, file, findings, finding);
    }
  }
};

const inspectHandlerRegistryProjection = (
  context: InspectorContext,
  ids: readonly string[],
  directories: readonly string[],
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const implemented = handlerIds(context, directories);
  const mapped = mappedHandlerIds(context);
  const registryImports = sourceFor(context, HANDLER_REGISTRY_PATH)?.getImportDeclarations()
    .map((declaration) => declaration.getModuleSpecifierValue())
    .filter((specifier) => specifier.startsWith("./children/")) ?? [];
  const reportMismatch = (checkId: string, path: string, actual: readonly string[], label: string): void => {
    if (JSON.stringify(ids) !== JSON.stringify(actual)) findings.push(finding(
      checkId, path, `${label} differs from contract: contract=${ids.join(",")}; actual=${actual.join(",")}.`,
    ));
  };
  reportMismatch("gpt/one-directory-per-child", CHILDREN_PATH, directories, "Child directory denominator");
  reportMismatch("gpt/one-handler-per-child", CONTRACT_PATH, implemented, "Handler denominator");
  reportMismatch("gpt/one-ability-group-mapping-per-child", HANDLER_REGISTRY_PATH, mapped, "Handler registry mapping");
  const directlyImported = registryImports.flatMap((specifier) =>
    specifier.match(/^\.\/children\/([^/]+)\/handler\.js$/u)?.[1] ?? []).sort();
  if (registryImports.length !== ids.length || JSON.stringify(directlyImported) !== JSON.stringify(ids)) {
    findings.push(finding("gpt/ability-group-direct-child-imports", HANDLER_REGISTRY_PATH,
      "The unique handler registry must import each Child directly with no forwarding sheet."));
  }
  const groupImports = sourceFor(context, GROUP_PATH)?.getImportDeclarations()
    .map((declaration) => declaration.getModuleSpecifierValue()) ?? [];
  if (!groupImports.includes("./handler-registry.js") || groupImports.some((specifier) => specifier.startsWith("./children/"))) {
    findings.push(finding("gpt/ability-group-direct-child-imports", GROUP_PATH,
      "Ability-group must consume the one complete handler registry and must not import Child handlers directly."));
  }
};

const inspectChildDenominator = (
  context: InspectorContext,
  contract: SourceFile,
  findings: InspectorFinding[],
  finding: FindingFactory,
): string[] => {
  const ids = childIdsFromContract(contract);
  if (ids.length !== 13 || new Set(ids).size !== 13) findings.push(finding(
    "gpt/exact-child-denominator", CONTRACT_PATH,
    `GPT_CHILD_CONTRACTS must define exactly 13 unique child ids; found ${ids.length}/${new Set(ids).size}.`,
  ));
  inspectRequiredChildIds(ids, findings, finding);
  if (ids.includes("ensure_exact_gpt_model")) findings.push(finding(
    "gpt/model-selection-v1-retired", CONTRACT_PATH,
    "V1 ensure_exact_gpt_model must not remain production-reachable.",
  ));
  if (ids.includes("ensure_exact_gpt_reasoning_tier")) findings.push(finding(
    "gpt/reasoning-requirement-v2-retired", CONTRACT_PATH,
    "The retired exact-only reasoning Child must not remain production-reachable.",
  ));
  const denominator = contract.getVariableDeclaration("GPT_CHILD_CAPABILITY_CONTRACTS")?.getInitializer()?.getText() ?? "";
  if (!denominator.includes("Object.freeze(GPT_CHILD_CONTRACTS)")) findings.push(finding(
    "gpt/denominator-derived-once", CONTRACT_PATH,
    "The public Child contract projection must derive only from the unique GPT_CHILD_CONTRACTS registry.",
  ));
  const directories = childDirectoryIds(context);
  inspectChildDirectories(context, directories, findings, finding);
  inspectHandlerRegistryProjection(context, ids, directories, findings, finding);
  const actualProfiles = profileDenominator(contract);
  const expectedProfiles = { DOM_OBSERVATION: 3, PROVIDER_EFFECT_ONCE: 1, TARGET_LOCAL_MUTATION: 9 };
  if (JSON.stringify(actualProfiles) !== JSON.stringify(expectedProfiles)) findings.push(finding(
    "gpt/exact-child-profile-denominator", CONTRACT_PATH,
    `GPT Child profiles must be exactly 3/1/9; found ${JSON.stringify(actualProfiles)}.`,
  ));
  return ids;
};

const inspectProfileContracts = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const modelContract = sourceFor(context, MODEL_CONTRACT_PATH)?.getFullText() ?? "";
  inspectMissingTokens({ source: modelContract, required: [
    "GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR", "[role='menuitemradio']",
  ], checkId: "gpt/model-selection-v2-visible-contract", filePath: MODEL_CONTRACT_PATH,
  findings, finding, message: (required) => `Model selection V2 contract is missing ${required}.` });
  const modelHandler = sourceTextForPaths(context, MODEL_HANDLER_PATHS);
  inspectMissingTokens({ source: modelHandler, required: [
    "openGptModelSelectorV2Handler", "selectExactGptModelV2Handler", "SELECTION_POSTCONDITION",
    "readModelChoiceState", "clickedCandidateAttribute", "selectedReadbackValid",
    "postClickObservation: OPEN_POSTCONDITION",
    "postClickObservation: SELECTION_POSTCONDITION", "mutationRecord.postconditionObservation",
    "expectedEligibleCount", "decodeCoherentObservationPacket", "modelChoiceQuery",
  ], checkId: "gpt/model-selection-v2-handler", filePath: MODEL_HANDLER_PATH,
  findings, finding, message: (required) => `Model selection V2 handler is missing ${required}.` });
  for (const retired of [
    "GPT_MODEL_SELECTION_V2_EXPANDED_ENTRY_SELECTOR", "expandedEntry",
    "GPT_MODEL_SELECTION_V2_RESTORED_STATE_SELECTOR", "postClickMatch: {",
    "GPT_PROFILE_POPUP_SELECTOR", "GPT_PROFILE_SIMPLE_PANEL_SELECTOR",
    "GPT_MODEL_SELECTION_V2_PANEL_SELECTOR", "modelSelectorTopology",
    "simplePanel", "advancedPanel",
  ]) {
    if (modelContract.includes(retired) || modelHandler.includes(retired)) findings.push(finding(
      "gpt/model-selection-v2-expanded-state-retired", MODEL_HANDLER_PATH,
      `The obsolete expanded-entry topology remains reachable through ${retired}.`,
    ));
  }
  const reasoningContract = sourceFor(context, PROFILE_CONTRACT_PATH)?.getFullText() ?? "";
  inspectMissingTokens({ source: reasoningContract, required: [
    "[role='menuitem'][aria-label='能力']", "[data-model-reasoning-effort-slider] [role='slider']",
    "fast: 0", "medium: 1", "high: 2", "extra_high: 3", "pro_standard: 4",
  ], checkId: "gpt/reasoning-approved-scale-contract", filePath: PROFILE_CONTRACT_PATH,
  findings, finding, message: (required) => `Reasoning contract is missing ${required}.` });
  const reasoningHandler = sourceTextForPaths(context, PROFILE_HANDLER_PATHS);
  inspectMissingTokens({ source: reasoningHandler, required: [
    "ensureGptReasoningRequirementHandler", "requireExactInputKeys", "profileFromIntent",
    "requireBrowser(context)", "ariaValueMin", "ariaValueMax", "ariaValueNow",
    "postKeypressMatch", "requireConfirmedBrowserFact", "PROFILE_HYDRATION_TIMEOUT_MS",
    "PROFILE_TOPOLOGY_QUERIES", "profileFullyAbsent", "profileOpenReady", "profileOpenable",
    "waitForProfileHydration", "GPT_EXECUTION_PROFILE_HYDRATION_TIMEOUT",
    "GPT_EXECUTION_PROFILE_HYDRATION_DOCUMENT_CHANGED",
    "postClickObservation: PROFILE_OPEN_POSTCONDITION", "mutationRecord.postconditionObservation",
    "decodeCoherentObservationPacket", "scopeRejections", "observationRevisionHash",
    'value.reasoningMaximum === "2"', 'value.reasoningMaximum === "4"',
    "resolveReasoningRequirement", 'code: "GPT_REASONING_TIER_UNAVAILABLE"',
    'selectionPolicy === "exact"', 'tier: "high", value: 2, degraded: true',
    'tier: "pro_standard", value: 4, degraded: false',
    "requestedTier", "requestedValue", "observedScale", "resolvedTier", "resolvedValue",
    "currentValue", "mutationOutcome", "browserOutcome", "gptPostcondition",
  ], checkId: "gpt/reasoning-requirement-resolution", filePath: PROFILE_HANDLER_PATH,
  findings, finding,
  message: (required) => `Reasoning Child must qualify and read back the Browser-owned numeric control; missing ${required}.` });
  if (reasoningHandler.includes("postClickMatch: { selector: GPT_PROFILE_REASONING_VALUE_SELECTOR")) {
    findings.push(finding(
      "gpt/profile-open-second-readback-retired", PROFILE_HANDLER_PATH,
      "Profile open must consume one coherent Browser postcondition packet instead of a match plus second DOM readback.",
    ));
  }
};

const PROFILE_CONSUMERS = new Set([
  "open_gpt_execution_profile", "open_gpt_model_selector_v2", "select_exact_gpt_model_v2",
  "ensure_gpt_reasoning_requirement", "close_gpt_execution_profile",
]);
const CONTRACT_V6_CHILDREN = new Set(["checkpoint_gpt_generated_image", "submit_exact_gpt_turn_once"]);
const CONTRACT_V5_CHILDREN = new Set(["checkpoint_gpt_text_response"]);
const CONTRACT_V4_CHILDREN = new Set([
  "prepare_clean_gpt_chat", "open_gpt_model_selector_v2", "select_exact_gpt_model_v2", "write_exact_gpt_prompt",
]);
const CONTRACT_V3_CHILDREN = new Set([
  ...PROFILE_CONSUMERS, "reconcile_gpt_attachment_set", "open_gpt_attachment_control",
]);

const expectedContractVersion = (id: string): string => {
  if (CONTRACT_V6_CHILDREN.has(id)) return "6";
  if (CONTRACT_V5_CHILDREN.has(id)) return "5";
  if (CONTRACT_V4_CHILDREN.has(id)) return "4";
  return CONTRACT_V3_CHILDREN.has(id) ? "3" : "2";
};

const INPUT_V2_CHILDREN = new Set([
  ...PROFILE_CONSUMERS, "submit_exact_gpt_turn_once",
]);
const INPUT_V3_CHILDREN = new Set(["checkpoint_gpt_text_response", "checkpoint_gpt_generated_image"]);

const inspectProfileSchema = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const schema = sourceFor(context, SCHEMA_PATH)?.getFullText() ?? "";
  inspectMissingTokens({ source: schema, required: [
    'z.literal("gpt-execution-profile.v2")', 'z.discriminatedUnion("selectionPolicy"',
    'selectionPolicy: z.literal("exact")',
    'selectionPolicy: z.literal("exact-or-observed-maximum")',
    'requestedTier: z.literal("pro_standard")', "reasoningRequirement: GptReasoningRequirementSchema",
  ], checkId: "gpt/profile-v2-required-policy", filePath: SCHEMA_PATH,
  findings, finding, message: (required) => `Execution Profile V2 is missing ${required}.` });
  for (const retired of ["gpt-execution-profile.v1", "reasoningTier", "pro_extended"]) {
    if (schema.includes(retired)) findings.push(finding(
      "gpt/profile-v1-reader-retired", SCHEMA_PATH,
      `Execution Profile schema retains retired token ${retired}.`,
    ));
  }
};

const inspectChildContractVersions = (
  contract: SourceFile,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const contractObject = contract.getVariableDeclaration("GPT_CHILD_CONTRACTS")?.getInitializer();
  const contracts = contractObject && Node.isObjectLiteralExpression(contractObject)
    ? contractObject : contractObject?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression);
  for (const property of contracts?.getProperties() ?? []) {
    if (!Node.isPropertyAssignment(property)) continue;
    const id = property.getName().replace(/^['"]|['"]$/gu, "");
    const value = property.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
    const version = value?.getProperty("contractVersion");
    const inputSchema = value?.getProperty("inputSchema");
    const versionText = Node.isPropertyAssignment(version) ? version.getInitializer()?.getText() : null;
    const inputText = Node.isPropertyAssignment(inputSchema) ? inputSchema.getInitializer()?.getText() : null;
    const expectedVersion = expectedContractVersion(id);
    const expectedInputVersion = INPUT_V3_CHILDREN.has(id) ? "v3" : INPUT_V2_CHILDREN.has(id) ? "v2" : "v1";
    const expectedInputSuffix = `.input.${expectedInputVersion}\"`;
    if (versionText !== expectedVersion || !inputText?.endsWith(expectedInputSuffix)) findings.push(finding(
      "gpt/profile-v2-contract-cutover", CONTRACT_PATH,
      `${id} must use contract/input ${expectedVersion}/${expectedInputVersion}; found ${versionText}/${inputText}.`,
      property.getStartLineNumber(),
    ));
  }
};

const inspectProfileVersionCutover = (
  context: InspectorContext,
  contract: SourceFile,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  inspectProfileSchema(context, findings, finding);
  inspectChildContractVersions(contract, findings, finding);
};

const inspectContractShape = (
  contract: SourceFile,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const actualFields = contract.getInterface("ChildCapabilityContract")?.getMembers().flatMap((member) =>
    Node.isPropertySignature(member) ? [member.getName()] : []).sort() ?? [];
  const requiredFields = [
    "actionQualification", "boundedWait", "childCapabilityId",
    "contractVersion", "decisions", "evidenceBoundary", "evidenceSchema", "failureClassification",
    "inputSchema", "mutationBudget", "negativePostcondition", "oneObservationOrMutation", "owner",
    "positivePostcondition", "precondition", "profile", "replayPolicy", "requiredTargetKind",
    "semanticIntent",
  ].sort();
  if (JSON.stringify(actualFields) !== JSON.stringify(requiredFields)) findings.push(finding(
    "gpt/child-contract-exact-shape", CONTRACT_PATH,
    `ChildCapabilityContract fields must remain exact; found ${actualFields.join(",")}.`,
  ));
  for (const proofField of [
    "schemaVersion", "childCapabilityId", "childContractVersion", "childStatus", "childReasonCode",
    "exactCallIdentityHash", "internalDecisionCode", "executionId", "jobId", "attemptId",
    "productStepId", "callId", "inputHash", "actionOrdinal", "authorityRefHashes", "factResultIds",
    "candidateCardinality", "observationRevisionHash", "committedMutation", "postconditionResult",
    "browserFact", "nativeFailureCode", "startedAt", "endedAt", "evidenceRef", "evidenceHash",
  ]) if (!contract.getInterface("GptChildCapabilityProof")?.getProperty(proofField)) findings.push(finding(
    "gpt/proof-field-required", CONTRACT_PATH, `GptChildCapabilityProof is missing ${proofField}.`,
  ));
  for (const retired of ["candidateCount", "observedSemantics"]) {
    if (contract.getInterface("GptChildCapabilityProof")?.getProperty(retired)) findings.push(finding(
      "gpt/proof-retired-field", CONTRACT_PATH, `GptChildCapabilityProof retains retired field ${retired}.`,
    ));
  }
  const childTypes = contract.getProject().getSourceFiles().find((source) =>
    source.getFilePath().split("\\").join("/").endsWith(`/${CHILD_TYPES_PATH}`));
  for (const mapName of ["GptChildInputMap", "GptChildOutputMap"]) {
    const count = childTypes?.getInterface(mapName)?.getProperties().length ?? 0;
    if (count !== 13) findings.push(finding(
      "gpt/exact-child-type-map", CHILD_TYPES_PATH, `${mapName} must define exactly 13 properties; found ${count}.`,
    ));
  }
};


export const inspectGptContractDenominator = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const contract = sourceFor(context, CONTRACT_PATH);
  if (!contract) {
    findings.push(finding("gpt/contract-present", CONTRACT_PATH, "The unique GPT public contract is missing."));
    return;
  }
  inspectChildDenominator(context, contract, findings, finding);
  inspectProfileContracts(context, findings, finding);
  inspectProfileVersionCutover(context, contract, findings, finding);
  inspectContractShape(contract, findings, finding);
};
