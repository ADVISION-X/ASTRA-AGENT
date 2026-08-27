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

const LAW_ID = "LAW-GPT-001-V1";
const ALL_CLAUSES = staticClauses(...Array.from({ length: 15 }, (_, index) => index));
const ROOT = "src/capabilities/gpt";
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const FACADE_PATH = `${ROOT}/index.ts`;
const GROUP_PATH = `${ROOT}/ability-group.ts`;
const SESSION_PATH = `${ROOT}/session/gpt-session-controller.ts`;
const CHILD_ID_SOURCES = ["DOM_OBSERVATIONS", "DOM_MUTATIONS", "SESSION_MUTATIONS", "SESSION_OBSERVATIONS"] as const;

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
  if (ids.length !== 43 || new Set(ids).size !== 43) findings.push(finding(
    "gpt/exact-child-denominator", CONTRACT_PATH,
    `GPT_CHILD_CAPABILITY_IDS must derive exactly 43 unique child ids; found ${ids.length}/${new Set(ids).size}.`,
  ));
  const denominator = contract.getVariableDeclaration("GPT_CHILD_CAPABILITY_IDS")?.getInitializer()?.getText() ?? "";
  for (const sourceName of CHILD_ID_SOURCES) if (!denominator.includes(`...${sourceName}`)) findings.push(finding(
    "gpt/denominator-derived-once", CONTRACT_PATH,
    `GPT_CHILD_CAPABILITY_IDS must derive from ${sourceName}.`,
  ));
  const implemented = handlerIds(context);
  if (JSON.stringify(ids) !== JSON.stringify(implemented)) findings.push(finding(
    "gpt/one-handler-per-child", ROOT,
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
    "childCapabilityId", "executionId", "targetRefHash", "beforeDocumentRefHash",
    "afterDocumentRefHash", "beforeUrl", "afterUrl", "candidateCount", "observedSemantics",
    "committedMutation", "postconditionResult", "startedAt", "endedAt", "evidenceRef", "evidenceHash",
  ]) if (!contract.getInterface("GptChildCapabilityProof")?.getProperty(proofField)) findings.push(finding(
    "gpt/proof-field-required", CONTRACT_PATH, `GptChildCapabilityProof is missing ${proofField}.`,
  ));
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

const inspectAtomicSafety = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const sources = context.project.getSourceFiles().filter((source) => repoPath(context, source).startsWith(`${ROOT}/`));
  const allText = sources.map((source) => source.getFullText()).join("\n");
  for (const forbidden of [
    "feed-provider-once", "gpt-web-chat", "gemini", "claude", "document.cookie",
    "localStorage", "sessionStorage", "location.reload", "Promise.all(",
  ]) if (allText.toLocaleLowerCase("en-US").includes(forbidden.toLocaleLowerCase("en-US"))) findings.push(finding(
    "gpt/forbidden-secondary-or-unsafe-path", ROOT, `GPT implementation retains forbidden token ${forbidden}.`,
  ));
  for (const source of sources) {
    const path = repoPath(context, source);
    const siblingImports = source.getImportDeclarations().filter((declaration) =>
      path.includes("/children/") && declaration.getModuleSpecifierValue().includes("/children/"));
    for (const declaration of siblingImports) findings.push(finding(
      "gpt/child-cannot-call-child", path,
      `Child implementation imports sibling child module ${declaration.getModuleSpecifierValue()}.`,
      declaration.getStartLineNumber(),
    ));
    for (const loop of [
      ...source.getDescendantsOfKind(SyntaxKind.ForStatement),
      ...source.getDescendantsOfKind(SyntaxKind.ForOfStatement),
      ...source.getDescendantsOfKind(SyntaxKind.WhileStatement),
      ...source.getDescendantsOfKind(SyntaxKind.DoStatement),
    ]) {
      const text = loop.getText();
      if (/executeDomIntent\s*\(|\.navigate\s*\(|\.attachFile\s*\(/u.test(text)) findings.push(finding(
        "gpt/no-looped-page-mutation", path,
        "GPT page mutation must not be dispatched from a loop.", loop.getStartLineNumber(),
      ));
    }
  }
};

const inspectUniqueRuntimeChain = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const controllerDir = resolve(context.sealedRoot, ROOT, "session");
  const controllers = existsSync(controllerDir)
    ? readdirSync(controllerDir).filter((name) => name.endsWith("session-controller.ts"))
    : [];
  if (controllers.length !== 1 || controllers[0] !== "gpt-session-controller.ts") findings.push(finding(
    "gpt/one-session-controller", `${ROOT}/session`,
    `Exactly one GPT Session Controller is allowed; found ${controllers.join(",")}.`,
  ));
  const sessionText = sourceFor(context, SESSION_PATH)?.getFullText() ?? "";
  for (const required of [
    "continuation_ref", "pluginId", "ownerRef", "subjectRef", "authorizationRef",
    "gptContinuationIdentityHash", "lane_version", "prior_turn_marker",
  ]) if (!sessionText.includes(required)) findings.push(finding(
    "gpt/session-binding", SESSION_PATH, `GPT Session Controller is missing ${required}.`,
  ));
};

const inspectGpt = (context: InspectorContext, findings: InspectorFinding[]): void => {
  inspectDenominatorAndContracts(context, findings);
  inspectFacadeAndOwnership(context, findings);
  inspectAtomicSafety(context, findings);
  inspectUniqueRuntimeChain(context, findings);
};

const evaluate = (context: InspectorContext): InspectorEvaluation => {
  const findings: InspectorFinding[] = [];
  const staticCheckReceipts: InspectorEvaluation["staticCheckReceipts"] = [];
  recordStaticCheck({
    check: "inspectGpt",
    findings,
    lawIds: [LAW_ID],
    receipts: staticCheckReceipts,
    run: () => inspectGpt(context, findings),
  });
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
  const checks = ["inspectGpt"];
  const input = {
    context,
    lawId: LAW_ID,
    evidenceMode,
    clauses: ALL_CLAUSES,
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
  const checks = ["inspectGpt"];
  const assertions = ([
    "static.filesystem", "static.ast", "static.types", "static.contract", "static.dependency",
  ] as const).map((evidenceMode) => ({
    clauses: ALL_CLAUSES,
    evidenceMode,
    passed: producerModePassed(evaluation.staticCheckReceipts, LAW_ID, checks),
    refs: staticEvidenceRefs(
      context,
      LAW_ID,
      evidenceMode,
      ALL_CLAUSES,
      evaluation.staticCheckReceipts,
      checks,
      observationFor(context, evidenceMode, evaluation.staticCheckReceipts),
    ),
  }));
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: evaluation.reportedLawIds,
    lawResults: [{ lawId: LAW_ID, assertions, findings: evaluation.findings }],
    inspectedFiles: evaluation.inspectedFiles,
  });
};
