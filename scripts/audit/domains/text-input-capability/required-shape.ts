import { SyntaxKind, type ObjectLiteralExpression } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { hasInterfaceMethod } from "../_shared/ast-schema-queries.js";
import {
  FORBIDDEN_CHILD_TOKENS,
  LAW_IDS,
  PATHS,
  REQUIRED_INPUT_CHAIN_FIELDS,
  REQUIRED_INPUT_TARGET_FIELDS,
  REQUIRED_PROOF_CHAIN_FIELDS,
  REQUIRED_RESULT_CHAIN_FIELDS,
  REQUIRED_WRITE_FIELDS,
} from "./config.js";
import { getSourceFile, makeProject, missingRequiredFiles } from "./project-access.js";

type SchemaFieldExpectation = {
  name: string;
  initializerSnippet?: string;
};

const REQUIRED_INPUT_FIELD_EXPECTATIONS: readonly SchemaFieldExpectation[] = [
  ...REQUIRED_INPUT_CHAIN_FIELDS.map((name) => ({ name, initializerSnippet: "z.string().min(1)" })),
  { name: "sourceOwner", initializerSnippet: "TextInputSourceOwnerSchema" },
  { name: "targetProofOwner", initializerSnippet: "TextInputTargetProofOwnerSchema" },
  { name: "targetKind", initializerSnippet: "TextInputTargetKindSchema" },
  { name: "focusProofOwner", initializerSnippet: "TextInputFocusProofOwnerSchema" },
  ...REQUIRED_INPUT_TARGET_FIELDS
    .filter((name) => !["targetProofOwner", "targetKind", "focusProofOwner"].includes(name))
    .map((name) => ({
      name,
      initializerSnippet: name === "focusVerifiedAt" ? "z.string().datetime()" : "z.string().min(1)",
    })),
] as const;

const REQUIRED_WRITE_FIELD_EXPECTATIONS: readonly SchemaFieldExpectation[] = REQUIRED_WRITE_FIELDS.map((name) => ({
  name,
  initializerSnippet: name.endsWith("Hash")
    ? "hashString"
    : "z.string().min(1)",
}));

const REQUIRED_PROOF_FIELD_EXPECTATIONS: readonly SchemaFieldExpectation[] = REQUIRED_PROOF_CHAIN_FIELDS.map((name) => ({ name }));
const REQUIRED_RESULT_FIELD_EXPECTATIONS: readonly SchemaFieldExpectation[] = REQUIRED_RESULT_CHAIN_FIELDS.map((name) => ({ name }));

async function collectMissingFileFindings(findings: Finding[]): Promise<void> {
  for (const filePath of await missingRequiredFiles()) {
    findings.push(createFinding({ lawId: LAW_IDS.PACKAGE, file: filePath, line: 1, severity: "fatal", message: "Text Input required production or enforcement file is missing." }));
  }
}

function getSchemaObjectLiteral(
  sourceFile: ReturnType<typeof getSourceFile>,
  declarationName: string,
): ObjectLiteralExpression | null {
  return sourceFile?.getVariableDeclaration(declarationName)?.getInitializer()?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression) ?? null;
}

function collectSchemaFieldExpectationFindings(input: {
  objectLiteral: ObjectLiteralExpression | null;
  expectations: readonly SchemaFieldExpectation[];
  lawId: string;
  file: string;
  scopeLabel: string;
}): Finding[] {
  if (!input.objectLiteral) {
    return [createFinding({ lawId: input.lawId, file: input.file, line: 1, severity: "fatal", message: `${input.scopeLabel} is missing its governed schema object literal.` })];
  }

  const findings: Finding[] = [];
  for (const expectation of input.expectations) {
    const property = input.objectLiteral.getProperty(expectation.name);
    if (!property) {
      findings.push(createFinding({ lawId: input.lawId, file: input.file, line: 1, severity: "fatal", message: `${input.scopeLabel} must declare ${expectation.name}.` }));
      continue;
    }
    if (expectation.initializerSnippet && !property.getText().includes(expectation.initializerSnippet)) {
      findings.push(createFinding({ lawId: input.lawId, file: input.file, line: 1, severity: "fatal", message: `${input.scopeLabel} must keep ${expectation.name} machine-required.` }));
    }
  }
  return findings;
}

function collectTextSnippetFindings(input: {
  file: string;
  lawId: string;
  sourceText: string;
  snippets: readonly string[];
  message: () => string;
}): Finding[] {
  const findings: Finding[] = [];
  for (const snippet of input.snippets) {
    if (!input.sourceText.includes(snippet)) {
      findings.push(createFinding({ lawId: input.lawId, file: input.file, line: 1, severity: "fatal", message: input.message() }));
      break;
    }
  }
  return findings;
}

function collectContractFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const contractSource = getSourceFile(project, PATHS.CONTRACT);
  return !contractSource || !hasInterfaceMethod(contractSource, "TextInputAbilityGroup", "execute")
    ? [createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.CONTRACT, line: 1, severity: "fatal", message: "Text Input must expose a stable public execute contract." })]
    : [];
}

function collectAbilityGroupFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const abilityGroupSource = getSourceFile(project, PATHS.ABILITY_GROUP);
  if (!abilityGroupSource || !hasCallExpression(abilityGroupSource, "parseTextInputAbilityInput") || !hasCallExpressionPath(abilityGroupSource, ["TextInputAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.ABILITY_GROUP, line: 1, severity: "fatal", message: "Text Input ability-group must parse input and governed output." }));
  }
  if (abilityGroupSource) {
    for (const forbidden of ["createSystemTextInputClock", "createBrowserControllerTextInputExecutionPort", "createSystemClipboardPort"]) {
      if (hasCallExpression(abilityGroupSource, forbidden)) {
        findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.ABILITY_GROUP, line: 1, severity: "fatal", message: `Text Input ability-group must not construct ${forbidden}.` }));
      }
    }
  }
  return findings;
}

function collectSchemaAndRegistryFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const schemaSource = getSourceFile(project, PATHS.SCHEMA);
  if (!schemaSource) {
    findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Text Input schema file is missing." }));
    return findings;
  }

  for (const declarationName of ["TextInputAbilityInputSchema", "TextInputAbilityResultSchema", "TextInputRuntimeProofSchema", "TextInputSuccessOutputSchema"]) {
    if (!schemaSource.getVariableDeclaration(declarationName)) {
      findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: `Text Input schema must declare ${declarationName}.` }));
    }
  }

  findings.push(...collectSchemaFieldExpectationFindings({
    objectLiteral: getSchemaObjectLiteral(schemaSource, "TextInputBaseSchema"),
    expectations: REQUIRED_INPUT_FIELD_EXPECTATIONS,
    lawId: LAW_IDS.SHAPE,
    file: PATHS.SCHEMA,
    scopeLabel: "TextInputBaseSchema",
  }));
  findings.push(...collectSchemaFieldExpectationFindings({
    objectLiteral: getSchemaObjectLiteral(schemaSource, "GovernedWriteFieldsSchema"),
    expectations: REQUIRED_WRITE_FIELD_EXPECTATIONS,
    lawId: LAW_IDS.SHAPE,
    file: PATHS.SCHEMA,
    scopeLabel: "GovernedWriteFieldsSchema",
  }));
  findings.push(...collectSchemaFieldExpectationFindings({
    objectLiteral: getSchemaObjectLiteral(schemaSource, "TextInputRuntimeProofSchema"),
    expectations: REQUIRED_PROOF_FIELD_EXPECTATIONS,
    lawId: LAW_IDS.PROOF,
    file: PATHS.SCHEMA,
    scopeLabel: "TextInputRuntimeProofSchema",
  }));
  findings.push(...collectSchemaFieldExpectationFindings({
    objectLiteral: getSchemaObjectLiteral(schemaSource, "TextInputAbilityResultSchema"),
    expectations: REQUIRED_RESULT_FIELD_EXPECTATIONS,
    lawId: LAW_IDS.RESULT,
    file: PATHS.SCHEMA,
    scopeLabel: "TextInputAbilityResultSchema",
  }));
  findings.push(...collectSchemaFieldExpectationFindings({
    objectLiteral: getSchemaObjectLiteral(schemaSource, "PressKeyAbilityInputSchema"),
    expectations: [{ name: "key", initializerSnippet: "TextInputKeySchema" }],
    lawId: LAW_IDS.SHAPE,
    file: PATHS.SCHEMA,
    scopeLabel: "PressKeyAbilityInputSchema",
  }));
  findings.push(...collectSchemaFieldExpectationFindings({
    objectLiteral: getSchemaObjectLiteral(schemaSource, "CommitInputAbilityInputSchema"),
    expectations: [
      { name: "approvedCommitRef", initializerSnippet: "z.string().min(1)" },
      { name: "key", initializerSnippet: "TextInputCommitKeySchema" },
    ],
    lawId: LAW_IDS.RESULT,
    file: PATHS.SCHEMA,
    scopeLabel: "CommitInputAbilityInputSchema",
  }));

  const schemaText = schemaSource.getFullText();
  findings.push(...collectTextSnippetFindings({
    file: PATHS.SCHEMA,
    lawId: LAW_IDS.PROOF,
    sourceText: schemaText,
    snippets: [
      "runtime proof runId must come from input, not attemptRef",
      "success proof requires approvedTextSourceRef for write children",
      "success proof requires approvedTextApprovalRef for write children",
    ],
    message: () => "Text Input runtime proof schema must enforce full-chain proof invariants.",
  }));
  findings.push(...collectTextSnippetFindings({
    file: PATHS.SCHEMA,
    lawId: LAW_IDS.RESULT,
    sourceText: schemaText,
    snippets: [
      "RESULT_PROOF_PARITY_FIELDS",
      "addResultRuntimeProofParityIssue(value, context, field)",
      "failed and review_required require output=null",
      "failed and review_required require diagnosticPayloadRef",
      "TextInputCommitKeySchema",
    ],
    message: () => "Text Input result schema must enforce output-null and result/proof parity invariants.",
  }));

  const registrySource = getSourceFile(project, PATHS.REGISTRY);
  if (!registrySource || !registrySource.getVariableDeclaration("CHILDREN")) {
    findings.push(createFinding({ lawId: LAW_IDS.CHILDREN, file: PATHS.REGISTRY, line: 1, severity: "fatal", message: "Text Input registry must declare canonical children." }));
  }
  return findings;
}

function collectExecutorFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const executorSource = getSourceFile(project, PATHS.EXECUTOR);
  if (!executorSource) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Text Input executor file is missing." }));
    return findings;
  }

  const routeSources = [
    executorSource,
    getSourceFile(project, PATHS.EXECUTION_GATES),
    getSourceFile(project, PATHS.EXECUTOR_FLOW),
    getSourceFile(project, PATHS.EXECUTOR_PLAN),
    getSourceFile(project, PATHS.EXECUTOR_SINGLE),
    getSourceFile(project, PATHS.EXECUTOR_REPLACE),
    getSourceFile(project, PATHS.EXECUTOR_CLIPBOARD),
    getSourceFile(project, PATHS.EXECUTION_SUPPORT),
  ].filter((sourceFile): sourceFile is NonNullable<typeof sourceFile> => sourceFile !== null);
  for (const calleeName of ["validateInputTargetProof", "validateFocusProof", "validateTextSourceProof", "validateApprovedText", "validateTextPolicy", "validateSensitiveText", "validateKeyPolicy", "validateCommitPolicy", "validateClipboardPolicy", "runPrimitiveTextInput", "buildTextInputResult"]) {
    if (!routeSources.some((sourceFile) => hasCallExpression(sourceFile, calleeName))) {
      findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: `Text Input executor must call ${calleeName}.` }));
    }
  }
  return findings;
}

function collectBuilderFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const resultBuilderSource = getSourceFile(project, PATHS.RESULT_BUILDER);
  if (!resultBuilderSource || !hasCallExpression(resultBuilderSource, "buildTextInputRuntimeProof") || !hasCallExpression(resultBuilderSource, "buildTextInputDebugBundle") || !hasCallExpression(resultBuilderSource, "validateTextInputOutputBoundary") || !hasCallExpression(resultBuilderSource, "buildPostActionVerificationHandoffRef") || !hasCallExpressionPath(resultBuilderSource, ["TextInputAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Text Input result builder must preserve output boundary, debug bundle, proof, and PAV handoff checkpoints." }));
  }

  const resultSupportSource = getSourceFile(project, PATHS.RESULT_SUPPORT);
  if (!resultSupportSource || !hasCallExpression(resultSupportSource, "buildTextInputRuntimeProofIdentityFields") || !hasCallExpression(resultSupportSource, "buildTextInputResultChainFields")) {
    findings.push(createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.RESULT_SUPPORT, line: 1, severity: "fatal", message: "Text Input result support must bind result/proof chain fields through the shared builder path." }));
  }

  const proofBuilderSource = getSourceFile(project, PATHS.PROOF_BUILDER);
  if (!proofBuilderSource || !hasCallExpressionPath(proofBuilderSource, ["TextInputRuntimeProofSchema", "parse"])) {
    findings.push(createFinding({ lawId: LAW_IDS.PROOF, file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Text Input proof builder must parse runtime proof output." }));
  }
  return findings;
}

function collectGateFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const approvedGateText = getSourceFile(project, PATHS.APPROVED_TEXT_GATE)?.getFullText() ?? "";
  const sourceGateText = getSourceFile(project, PATHS.SOURCE_GATE)?.getFullText() ?? "";
  const targetGateText = getSourceFile(project, PATHS.TARGET_GATE)?.getFullText() ?? "";
  const focusGateText = getSourceFile(project, PATHS.FOCUS_GATE)?.getFullText() ?? "";
  const commitGateText = getSourceFile(project, PATHS.COMMIT_POLICY_GATE)?.getFullText() ?? "";

  findings.push(...collectTextSnippetFindings({
    file: PATHS.APPROVED_TEXT_GATE,
    lawId: LAW_IDS.SHAPE,
    sourceText: approvedGateText,
    snippets: [
      "if (!input.request.approvedTextRef || input.request.approvedTextRef.length === 0)",
      "if (!input.request.approvedTextSourceRef || input.request.approvedTextSourceRef.length === 0)",
      "if (!input.request.approvedTextApprovalRef || input.request.approvedTextApprovalRef.length === 0)",
      "if (input.request.inputTextHash !== input.request.approvedTextHash || (input.request.inputText ?? \"\") !== (input.request.approvedText ?? \"\"))",
    ],
    message: () => "Approved-text gate must enforce approved refs and hash parity.",
  }));
  findings.push(...collectTextSnippetFindings({
    file: PATHS.SOURCE_GATE,
    lawId: LAW_IDS.SHAPE,
    sourceText: sourceGateText,
    snippets: ["sourceRef"],
    message: () => "Text source proof gate must require sourceRef.",
  }));
  findings.push(...collectTextSnippetFindings({
    file: PATHS.TARGET_GATE,
    lawId: LAW_IDS.SHAPE,
    sourceText: targetGateText,
    snippets: ["inputTargetRef", "geometryGuardProofRef"],
    message: () => "Input target proof gate must require inputTargetRef and geometry proof when needed.",
  }));
  findings.push(...collectTextSnippetFindings({
    file: PATHS.FOCUS_GATE,
    lawId: LAW_IDS.SHAPE,
    sourceText: focusGateText,
    snippets: ["mouseClickProofRef"],
    message: () => "Focus proof gate must require mouseClickProofRef when focus came from mouse-click.",
  }));
  findings.push(...collectTextSnippetFindings({
    file: PATHS.COMMIT_POLICY_GATE,
    lawId: LAW_IDS.SENSITIVE,
    sourceText: commitGateText,
    snippets: [
      "if (!input.request.policy.commitPolicy.requireApprovedCommitRef || (input.request.approvedCommitRef?.length ?? 0) > 0)",
      "requireApprovedCommitRef",
    ],
    message: () => "Commit policy gate must enforce approvedCommitRef and governed approval policy.",
  }));
  return findings;
}

function collectInputAndProofChainFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const inputGateText = getSourceFile(project, PATHS.INPUT_GATE)?.getFullText() ?? "";
  const proofBuilderText = getSourceFile(project, PATHS.PROOF_BUILDER)?.getFullText() ?? "";

  findings.push(...collectTextSnippetFindings({
    file: PATHS.INPUT_GATE,
    lawId: LAW_IDS.SHAPE,
    sourceText: inputGateText,
    snippets: ["input.inputRef", "input.idempotencyKey", "input.capabilityCallId", "sourceRef: input.sourceRef", "inputTargetRef: input.inputTargetRef"],
    message: () => "Text Input execution seed must preserve upstream chain refs instead of fabricating local surrogates.",
  }));
  findings.push(...collectTextSnippetFindings({
    file: PATHS.PROOF_BUILDER,
    lawId: LAW_IDS.PROOF,
    sourceText: proofBuilderText,
    snippets: [
      "missionId: input.missionId",
      "runId: input.runId",
      "activationSnapshotRef: input.activationSnapshotRef",
      "capabilityCallId: input.capabilityCallId",
      "nerveBusEnvelopeId: input.nerveBusEnvelopeId",
      "sourceRef: input.sourceRef",
      "idempotencyKey: input.idempotencyKey",
      "approvedTextSourceRef: input.approvedTextSourceRef",
      "approvedTextApprovalRef: input.approvedTextApprovalRef",
      "inputTargetRef: input.inputTargetRef",
    ],
    message: () => "Text Input proof builder must preserve full upstream chain and approved text refs.",
  }));
  if (proofBuilderText.includes('buildStableTextInputRef("text-input-run"')) {
    findings.push(createFinding({ lawId: LAW_IDS.PROOF, file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Text Input proof builder must not fabricate runId from attemptRef." }));
  }
  return findings;
}

function collectChildFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  for (const childPath of [PATHS.TYPE_TEXT_IMPL, PATHS.PASTE_TEXT_IMPL, PATHS.CLEAR_INPUT_IMPL, PATHS.REPLACE_INPUT_IMPL, PATHS.PRESS_KEY_IMPL, PATHS.COMMIT_INPUT_IMPL]) {
    const childSource = getSourceFile(project, childPath);
    if (!childSource || !hasCallExpression(childSource, "executeTextInput")) {
      findings.push(createFinding({ lawId: LAW_IDS.CHILDREN, file: childPath, line: 1, severity: "fatal", message: "Text Input child implementation must delegate through executeTextInput." }));
    }
  }

  const registryText = getSourceFile(project, PATHS.REGISTRY)?.getFullText() ?? "";
  for (const token of FORBIDDEN_CHILD_TOKENS) {
    if (registryText.includes(token)) {
      findings.push(createFinding({ lawId: LAW_IDS.CHILDREN, file: PATHS.REGISTRY, line: 1, severity: "fatal", message: `Text Input registry must not expose forbidden child ${token}.` }));
    }
  }
  return findings;
}

function collectAntiFallbackFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const inputGateText = getSourceFile(project, PATHS.INPUT_GATE)?.getFullText() ?? "";
  if (inputGateText.includes('return "type-text"') || inputGateText.includes('return "textField"') || inputGateText.includes(': "type-text";') || inputGateText.includes(': "textField";')) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.INPUT_GATE, line: 1, severity: "fatal", message: "Text Input input gate must not reintroduce child or target fallback defaults." }));
  }
  if (!inputGateText.includes("TextInputPolicySchema.safeParse")) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.INPUT_GATE, line: 1, severity: "fatal", message: "Text Input input gate must safe-parse policy on invalid input paths." }));
  }

  const inspectorSource = getSourceFile(project, PATHS.INSPECTOR);
  if (!inspectorSource || !hasCallExpression(inspectorSource, "runNegativeProofHarness")) {
    findings.push(createFinding({ lawId: LAW_IDS.PACKAGE, file: PATHS.INSPECTOR, line: 1, severity: "fatal", message: "Text Input inspector must invoke the negative-proof harness." }));
  }
  return findings;
}

function hasCorePackageChain(project: ReturnType<typeof makeProject>): boolean {
  return Boolean(getSourceFile(project, PATHS.INPUT_GATE)
    && getSourceFile(project, PATHS.SOURCE_GATE)
    && getSourceFile(project, PATHS.APPROVED_TEXT_GATE)
    && getSourceFile(project, PATHS.TARGET_GATE)
    && getSourceFile(project, PATHS.FOCUS_GATE)
    && getSourceFile(project, PATHS.TEXT_POLICY_GATE)
    && getSourceFile(project, PATHS.SENSITIVE_GATE)
    && getSourceFile(project, PATHS.KEY_POLICY_GATE));
}

function hasAdapterPackageChain(project: ReturnType<typeof makeProject>): boolean {
  return Boolean(getSourceFile(project, PATHS.COMMIT_POLICY_GATE)
    && getSourceFile(project, PATHS.CLIPBOARD_POLICY_GATE)
    && getSourceFile(project, PATHS.OUTPUT_BOUNDARY_GATE)
    && getSourceFile(project, PATHS.DEBUG_EVENTS)
    && getSourceFile(project, PATHS.RUNNER)
    && getSourceFile(project, PATHS.RESULT_SUPPORT)
    && getSourceFile(project, PATHS.EXECUTOR_CLIPBOARD)
    && getSourceFile(project, PATHS.PRIMITIVE_ADAPTER)
    && getSourceFile(project, PATHS.CLIPBOARD_ADAPTER)
    && getSourceFile(project, PATHS.INDEX));
}

function collectPackageChainFindings(project: ReturnType<typeof makeProject>): Finding[] {
  return !hasCorePackageChain(project) || !hasAdapterPackageChain(project)
    ? [createFinding({ lawId: LAW_IDS.PACKAGE, file: PATHS.INDEX, line: 1, severity: "fatal", message: "Text Input package, runtime support chain, or enforcement surface is incomplete." })]
    : [];
}

export async function runRequiredShapeAttack(project: ReturnType<typeof makeProject> = makeProject()): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  await collectMissingFileFindings(findings);
  findings.push(...collectContractFindings(project));
  findings.push(...collectAbilityGroupFindings(project));
  findings.push(...collectSchemaAndRegistryFindings(project));
  findings.push(...collectExecutorFindings(project));
  findings.push(...collectBuilderFindings(project));
  findings.push(...collectGateFindings(project));
  findings.push(...collectInputAndProofChainFindings(project));
  findings.push(...collectChildFindings(project));
  findings.push(...collectAntiFallbackFindings(project));
  findings.push(...collectPackageChainFindings(project));

  const requiredFilesPresent = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "required-shape",
      requiredFilesPresent ? "PASS" : "CODE VIOLATION",
      requiredFilesPresent,
      requiredFilesPresent
        ? "Text Input required package, chain fields, gates, proof/result parity, and enforcement surfaces exist."
        : "Text Input required package or governed execution chain is incomplete.",
    ),
  };
}