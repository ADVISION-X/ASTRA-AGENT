import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

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
import { observeTypeCheckerRelations } from "../../shared/typechecker-observation.js";

const LAW_ID = "LAW-GPT-001-V4";
const MODE_CLAUSES = {
  "static.filesystem": staticForbiddenClauses(1, 11, 14),
  "static.ast": staticClauses(0, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13),
  "static.types": staticForbiddenClauses(3, 4, 13),
  "static.contract": staticForbiddenClauses(2, 3, 4, 8, 9, 10, 11, 13),
  "static.dependency": staticForbiddenClauses(0, 1, 2, 5, 14),
} as const;
const MODE_CHECKS = {
  "static.filesystem": ["inspectGptFilesystem"], "static.ast": ["inspectGptAst"],
  "static.types": ["inspectGptTypes"], "static.contract": ["inspectGptContracts"],
  "static.dependency": ["inspectGptDependencies"],
} as const;
const ROOT = "src/capabilities/gpt";
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const FACADE_PATH = `${ROOT}/index.ts`;
const GROUP_PATH = `${ROOT}/ability-group.ts`;
const SESSION_PATH = `${ROOT}/session/gpt-session-controller.ts`;
const TURN_EXECUTOR_PATH = `${ROOT}/gpt-turn-executor.ts`;
const CHILD_ID_SOURCES = ["PAGE_OBSERVATIONS", "PAGE_MUTATIONS", "SESSION_MUTATIONS"] as const;

const finding = (checkId: string, filePath: string, message: string, line?: number): InspectorFinding =>
  createFinding({
    evidenceMode: "static.ast",
    lawId: LAW_ID,
    clauseId: `${LAW_ID.toLowerCase()}-requirement`,
    checkId,
    filePath,
    message,
    ...(line === undefined ? {} : { line }),
  });

const sourceFor = (context: InspectorContext, path: string): SourceFile | undefined =>
  context.project.getSourceFile(resolve(context.sealedRoot, path));

const repoPath = (context: InspectorContext, source: SourceFile): string =>
  source.getFilePath().slice(resolve(context.sealedRoot).length + 1).split("\\").join("/");

const childIdsFromContract = (contract: SourceFile): string[] => CHILD_ID_SOURCES.flatMap((name) => {
  const initializer = contract.getVariableDeclaration(name)?.getInitializer();
  const array = initializer && Node.isArrayLiteralExpression(initializer)
    ? initializer
    : initializer?.getFirstDescendantByKind(SyntaxKind.ArrayLiteralExpression);
  if (!array) return [];
  return array.getElements().flatMap((element) =>
    Node.isStringLiteral(element) || Node.isNoSubstitutionTemplateLiteral(element)
      ? [element.getLiteralValue()]
      : []);
}).sort();

const handlerIds = (context: InspectorContext): string[] => context.project.getSourceFiles()
  .filter((source) => {
    const path = repoPath(context, source);
    return path.startsWith(`${ROOT}/web/children/`) || path === `${ROOT}/session/session-children.ts`;
  })
  .flatMap((source) => source.getVariableDeclarations())
  .filter((declaration) => declaration.getName().endsWith("ChildHandlers"))
  .flatMap((declaration) => {
    const initializer = declaration.getInitializer();
    const object = initializer && Node.isObjectLiteralExpression(initializer)
      ? initializer
      : initializer?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression);
    return object
      ? object.getProperties().flatMap((property) => {
        if (Node.isMethodDeclaration(property) || Node.isPropertyAssignment(property)) return [property.getName()];
        return [];
      })
      : [];
  })
  .sort();

const inspectDenominatorAndContracts = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const contract = sourceFor(context, CONTRACT_PATH);
  if (!contract) {
    findings.push(finding("gpt/contract-present", CONTRACT_PATH, "The unique GPT public contract is missing."));
    return;
  }
  const ids = childIdsFromContract(contract);
  if (ids.length !== 22 || new Set(ids).size !== 22) findings.push(finding(
    "gpt/exact-child-denominator", CONTRACT_PATH,
    `GPT_CHILD_CAPABILITY_IDS must derive exactly 22 unique child ids; found ${ids.length}/${new Set(ids).size}.`,
  ));
  const denominator = contract.getVariableDeclaration("GPT_CHILD_CAPABILITY_IDS")?.getInitializer()?.getText() ?? "";
  for (const sourceName of CHILD_ID_SOURCES) if (!denominator.includes(`...${sourceName}`)) findings.push(finding(
    "gpt/denominator-derived-once", CONTRACT_PATH,
    `GPT_CHILD_CAPABILITY_IDS must derive from ${sourceName}.`,
  ));
  const implemented = handlerIds(context);
  if (JSON.stringify(ids) !== JSON.stringify(implemented)) findings.push(finding(
    "gpt/one-handler-per-child", CONTRACT_PATH,
    `Handler denominator differs from contract: contract=${ids.join(",")}; handlers=${implemented.join(",")}.`,
  ));
  const childContract = contract.getInterface("ChildCapabilityContract");
  const actualFields = childContract?.getMembers().flatMap((member) =>
    Node.isPropertySignature(member) ? [member.getName()] : []).sort() ?? [];
  const requiredFields = [
    "allowedDocumentTransition", "childCapabilityId", "contractVersion", "evidenceSchema",
    "failureClassification", "inputSchema", "oneObservationOrMutation", "postcondition",
    "precondition", "replayPolicy", "requiredTargetKind",
  ].sort();
  if (JSON.stringify(actualFields) !== JSON.stringify(requiredFields)) findings.push(finding(
    "gpt/child-contract-exact-shape", CONTRACT_PATH,
    `ChildCapabilityContract fields must remain exact; found ${actualFields.join(",")}.`,
  ));
  for (const proofField of [
    "childCapabilityId", "executionId", "flowVersion", "stepIndex", "inputHash", "pluginStepId",
    "actionOrdinal", "targetRefHash", "beforeDocumentRefHash", "afterDocumentRefHash",
    "candidateCount", "observedSemantics",
    "committedMutation", "postconditionResult", "startedAt", "endedAt", "evidenceRef", "evidenceHash",
  ]) if (!contract.getInterface("GptChildCapabilityProof")?.getProperty(proofField)) findings.push(finding(
    "gpt/proof-field-required", CONTRACT_PATH, `GptChildCapabilityProof is missing ${proofField}.`,
  ));
};

const inspectImportOwnership = (context: InspectorContext, findings: InspectorFinding[]): void => {
  for (const source of context.project.getSourceFiles()) {
    const path = repoPath(context, source);
    for (const declaration of source.getImportDeclarations()) {
      const target = declaration.getModuleSpecifierValue();
      if (path.startsWith(`${ROOT}/`) && (target.includes("/plugins/") || target.includes("local-runtime/production"))) {
        findings.push(finding("gpt/no-product-authority-import", path,
          `GPT owner imports forbidden product/runtime authority ${target}.`, declaration.getStartLineNumber()));
      }
      if (!path.startsWith(`${ROOT}/`) && target.includes("capabilities/gpt/") && !target.endsWith("/index.js")) {
        findings.push(finding("gpt/private-boundary", path,
          `External consumer imports GPT private implementation ${target}.`, declaration.getStartLineNumber()));
      }
    }
  }
};

const inspectFacadeAndOwnership = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const contract = sourceFor(context, CONTRACT_PATH);
  const group = sourceFor(context, GROUP_PATH);
  const facade = sourceFor(context, FACADE_PATH);
  const ability = contract?.getInterface("GptAbilityGroup");
  const fields = ability?.getMembers().flatMap((member) => {
    if (Node.isMethodSignature(member) || Node.isPropertySignature(member)) return [member.getName()];
    return [];
  }).sort() ?? [];
  if (JSON.stringify(fields) !== JSON.stringify(["abilityGroupId", "execute", "listChildCapabilityIds", "transport"].sort())) {
    findings.push(finding("gpt/public-facade-shape", CONTRACT_PATH,
      `GptAbilityGroup may expose only abilityGroupId, transport, listChildCapabilityIds and execute; found ${fields.join(",")}.`));
  }
  const publicText = `${contract?.getFullText() ?? ""}\n${facade?.getFullText() ?? ""}`;
  for (const token of ["selector:", "coordinate", "tabId", "nativePicker", "fallbackPolicy", "providerKind"]) {
    if (publicText.includes(token)) findings.push(finding(
      "gpt/public-page-control-forbidden", FACADE_PATH, `GPT public facade exposes forbidden page control ${token}.`,
    ));
  }
  const groupText = group?.getFullText() ?? "";
  for (const required of [
    "GPT_CHILD_CAPABILITY_CONTRACTS", "pendingMutationCount", "documentTransitionAllowed",
    "GptChildCapabilityProof", "evidenceHash", "onProof",
  ]) if (!groupText.includes(required)) findings.push(finding(
    "gpt/group-proof-boundary", GROUP_PATH, `GPT ability group is missing ${required}.`,
  ));

};

const inspectAtomicSafety = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const sources = context.project.getSourceFiles().filter((source) => repoPath(context, source).startsWith(`${ROOT}/`));
  for (const forbidden of [
    "feed-provider-once", "gpt-web-chat", "gemini", "claude", "document.cookie",
    "localStorage", "sessionStorage", "location.reload",
  ]) for (const source of sources) {
    if (!source.getFullText().toLocaleLowerCase("en-US").includes(forbidden.toLocaleLowerCase("en-US"))) continue;
    findings.push(finding("gpt/forbidden-secondary-or-unsafe-path", repoPath(context, source),
      `GPT implementation retains forbidden token ${forbidden}.`));
  }
  for (const source of sources) {
    const path = repoPath(context, source);
    const siblingImports = source.getImportDeclarations().filter((declaration) =>
      path.includes("/children/") && declaration.getModuleSpecifierValue().includes("/children/"));
    for (const declaration of siblingImports) findings.push(finding(
      "gpt/child-cannot-call-child", path,
      `Child implementation imports sibling child module ${declaration.getModuleSpecifierValue()}.`,
      declaration.getStartLineNumber(),
    ));
    for (const concurrent of source.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((call) => call.getExpression().getText() === "Promise.all")) {
      if (!containsPageMutation(concurrent)) continue;
      findings.push(finding(
        "gpt/no-concurrent-page-mutation", path,
        "GPT page mutation must not be dispatched concurrently.", concurrent.getStartLineNumber(),
      ));
    }
    for (const loop of [
      ...source.getDescendantsOfKind(SyntaxKind.ForStatement),
      ...source.getDescendantsOfKind(SyntaxKind.ForOfStatement),
      ...source.getDescendantsOfKind(SyntaxKind.WhileStatement),
      ...source.getDescendantsOfKind(SyntaxKind.DoStatement),
    ]) {
      if (containsPageMutation(loop)) findings.push(finding(
        "gpt/no-looped-page-mutation", path,
        "GPT page mutation must not be dispatched from a loop.", loop.getStartLineNumber(),
      ));
    }
  }
};

const READ_ONLY_DOM_INTENTS = new Set(["document", "find", "inspect", "readAttribute", "readText"]);

const isPageMutationCall = (call: import("ts-morph").CallExpression): boolean => {
  const expression = call.getExpression().getText();
  if (expression.endsWith(".navigate") || expression.endsWith(".attachFile")) return true;
  if (!expression.endsWith(".executeDomIntent")) return false;
  const argument = call.getArguments()[0];
  if (!Node.isObjectLiteralExpression(argument)) return true;
  const kind = argument.getProperty("kind");
  if (!Node.isPropertyAssignment(kind)) return true;
  const value = kind.getInitializer();
  return !(Node.isStringLiteral(value) || Node.isNoSubstitutionTemplateLiteral(value))
    || !READ_ONLY_DOM_INTENTS.has(value.getLiteralValue());
};

export const containsPageMutation = (node: Node): boolean =>
  node.getDescendantsOfKind(SyntaxKind.CallExpression).some(isPageMutationCall);

const inspectUniqueRuntimeChain = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const controllerDir = resolve(context.sealedRoot, ROOT, "session");
  const controllers = existsSync(controllerDir)
    ? readdirSync(controllerDir).filter((name) => name.endsWith("session-controller.ts"))
    : [];
  if (controllers.length !== 1 || controllers[0] !== "gpt-session-controller.ts") findings.push(finding(
    "gpt/one-session-controller", SESSION_PATH,
    `Exactly one GPT Session Controller is allowed; found ${controllers.join(",")}.`,
  ));
  const sessionText = sourceFor(context, SESSION_PATH)?.getFullText() ?? "";
  for (const required of [
    "continuation_ref", "pluginId", "ownerRef", "subjectRef", "authorizationRef",
    "gptContinuationIdentityHash", "lane_version", "prior_turn_marker",
  ]) if (!sessionText.includes(required)) findings.push(finding(
    "gpt/session-binding", SESSION_PATH, `GPT Session Controller is missing ${required}.`,
  ));
  const turnExecutor = sourceFor(context, TURN_EXECUTOR_PATH)?.getFullText() ?? "";
  for (const required of ["GPT_TURN_FLOW", "GptTurnExecutor", "reconcileOnly", "inputHash", "stepIndex"]) {
    if (!turnExecutor.includes(required)) findings.push(finding(
      "gpt/one-shared-turn-executor", TURN_EXECUTOR_PATH,
      `The shared GPT turn executor is missing ${required}.`,
    ));
  }
  const pluginRoot = resolve(context.sealedRoot, "src/plugins");
  for (const pluginId of existsSync(pluginRoot) ? readdirSync(pluginRoot) : []) {
    const flowPath = resolve(pluginRoot, pluginId, "gpt-flow.ts");
    if (existsSync(flowPath)) findings.push(finding(
      "gpt/product-flow-retired", `src/plugins/${pluginId}/gpt-flow.ts`,
      "Product Plugins must not own provider-page step arrays.",
    ));
  }
};

const inspectGptContracts = (context: InspectorContext, findings: InspectorFinding[]): void => {
  inspectDenominatorAndContracts(context, findings);
  inspectFacadeAndOwnership(context, findings);
  inspectUniqueRuntimeChain(context, findings);
};

const inspectGptFilesystem = (context: InspectorContext, findings: InspectorFinding[]): void => {
  for (const path of [CONTRACT_PATH, FACADE_PATH, GROUP_PATH, SESSION_PATH, TURN_EXECUTOR_PATH])
    if (!existsSync(resolve(context.sealedRoot, path))) findings.push(finding(
      "gpt/filesystem-required-owner-file", path, `${path} is missing.`));
  const controllers = readdirSync(resolve(context.sealedRoot, ROOT, "session"))
    .filter((name) => name.endsWith("session-controller.ts"));
  if (JSON.stringify(controllers) !== JSON.stringify(["gpt-session-controller.ts"])) findings.push(finding(
    "gpt/filesystem-single-session-controller", SESSION_PATH,
    `Expected one GPT Session Controller; found ${controllers.join(",")}.`));
  const forbidden = context.targetPaths.find((path) => /(?:gemini|claude|gateway|adapter|fallback)/iu.test(path));
  if (forbidden) findings.push(finding("gpt/filesystem-secondary-provider", forbidden,
    `Secondary provider or compatibility path is forbidden: ${forbidden}.`));
};

const inspectGptTypes = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const contract = sourceFor(context, CONTRACT_PATH);
  const group = contract?.getInterface("GptAbilityGroup");
  const proof = contract?.getInterface("GptChildCapabilityProof");
  const checks = [[group, "execute", (value: string) => value.startsWith("Promise<")
    && value.includes("GptFailureClassification") && value.includes("GptChildCapabilityProof")],
    [group, "listChildCapabilityIds", (value: string) => value.startsWith("readonly (")
      && value.includes('"prepare_clean_gpt_chat"') && value.includes('"release_gpt_continuation_lane"')
      && !value.includes('"recover_gpt_response_checkpoint"')],
    [proof, "evidenceHash", (value: string) => value === "`sha256:${string}`"]] as const;
  for (const [owner, name, valid] of checks) {
    const member = owner?.getMembers().find((candidate) => "getName" in candidate && candidate.getName() === name);
    const actual = member && "getReturnType" in member ? member.getReturnType().getText(member)
      : member && "getType" in member ? member.getType().getText(member) : "missing";
    if (!valid(actual)) findings.push(finding("gpt/typed-public-contract", CONTRACT_PATH,
      `${name} has an invalid resolved TypeChecker relation: ${actual}.`));
  }
};

const inspectGptAst = (context: InspectorContext, findings: InspectorFinding[]): void =>
  inspectAtomicSafety(context, findings);
const inspectGptDependencies = (context: InspectorContext, findings: InspectorFinding[]): void =>
  inspectImportOwnership(context, findings);

const evaluate = (context: InspectorContext): InspectorEvaluation => {
  const findings: InspectorFinding[] = [];
  const staticCheckReceipts: InspectorEvaluation["staticCheckReceipts"] = [];
  recordStaticCheck({ check: "inspectGptFilesystem", findings, implementation: inspectGptFilesystem,
    lawIds: [LAW_ID], receipts: staticCheckReceipts,
    run: () => inspectGptFilesystem(context, findings) });
  recordStaticCheck({ check: "inspectGptAst", findings, implementation: inspectGptAst,
    lawIds: [LAW_ID], receipts: staticCheckReceipts,
    run: () => inspectGptAst(context, findings) });
  recordStaticCheck({ check: "inspectGptTypes", findings, implementation: inspectGptTypes,
    lawIds: [LAW_ID], observe: () => observeTypeCheckerRelations(context.project, context.targetPaths),
    receipts: staticCheckReceipts,
    run: () => inspectGptTypes(context, findings) });
  recordStaticCheck({ check: "inspectGptContracts", findings, implementation: inspectGptContracts,
    lawIds: [LAW_ID], receipts: staticCheckReceipts,
    run: () => inspectGptContracts(context, findings) });
  recordStaticCheck({ check: "inspectGptDependencies", findings, implementation: inspectGptDependencies,
    lawIds: [LAW_ID], receipts: staticCheckReceipts,
    run: () => inspectGptDependencies(context, findings) });
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...context.targetPaths],
    staticCheckReceipts,
  };
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
    refs: staticEvidenceRefs(
      context,
      LAW_ID,
      evidenceMode,
      MODE_CLAUSES[evidenceMode],
      evaluation.staticCheckReceipts,
      checks(evidenceMode),
    ),
  }));
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: evaluation.reportedLawIds,
    lawResults: [{ lawId: LAW_ID, assertions, findings: evaluation.findings }],
    inspectedFiles: evaluation.inspectedFiles,
  });
};
