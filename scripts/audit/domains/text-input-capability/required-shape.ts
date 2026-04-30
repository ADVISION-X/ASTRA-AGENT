import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { hasInterfaceMethod } from "../_shared/ast-schema-queries.js";
import {
  ABILITY_GROUP_PATH,
  APPROVED_TEXT_GATE_PATH,
  CLIPBOARD_POLICY_GATE_PATH,
  CLEAR_INPUT_IMPL_PATH,
  CLIPBOARD_ADAPTER_PATH,
  COMMIT_INPUT_IMPL_PATH,
  COMMIT_POLICY_GATE_PATH,
  CONTRACT_PATH,
  DEBUG_EVENTS_PATH,
  EXECUTOR_PATH,
  FOCUS_GATE_PATH,
  INDEX_PATH,
  INPUT_GATE_PATH,
  KEY_POLICY_GATE_PATH,
  PASTE_TEXT_IMPL_PATH,
  SOURCE_GATE_PATH,
  SENSITIVE_GATE_PATH,
  TARGET_GATE_PATH,
  TEXT_POLICY_GATE_PATH,
  OUTPUT_BOUNDARY_GATE_PATH,
  PRESS_KEY_IMPL_PATH,
  PRIMITIVE_ADAPTER_PATH,
  PROOF_BUILDER_PATH,
  REGISTRY_PATH,
  REPLACE_INPUT_IMPL_PATH,
  RESULT_BUILDER_PATH,
  RUNNER_PATH,
  SCHEMA_PATH,
  TYPE_TEXT_IMPL_PATH,
  getSourceFile,
  makeProject,
  missingRequiredFiles,
} from "./ast-utils.js";

export async function runRequiredShapeAttack(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const missingFiles = await missingRequiredFiles();
  for (const filePath of missingFiles) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-007-V1", file: filePath, line: 1, severity: "fatal", message: "Text Input required production file is missing." }));
  }

  const project = makeProject();
  const abilityGroupSource = getSourceFile(project, ABILITY_GROUP_PATH);
  const contractSource = getSourceFile(project, CONTRACT_PATH);
  const schemaSource = getSourceFile(project, SCHEMA_PATH);
  const registrySource = getSourceFile(project, REGISTRY_PATH);
  const executorSource = getSourceFile(project, EXECUTOR_PATH);
  const resultBuilderSource = getSourceFile(project, RESULT_BUILDER_PATH);
  const proofBuilderSource = getSourceFile(project, PROOF_BUILDER_PATH);

  if (!contractSource || !hasInterfaceMethod(contractSource, "TextInputAbilityGroup", "execute")) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-001-V1", file: CONTRACT_PATH, line: 1, severity: "fatal", message: "Text Input must expose a stable public execute contract." }));
  }

  if (!abilityGroupSource || !hasCallExpression(abilityGroupSource, "parseTextInputAbilityInput") || !hasCallExpressionPath(abilityGroupSource, ["TextInputAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-004-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "Text Input ability-group must parse input and parse governed output." }));
  }

  if (abilityGroupSource) {
    const forbiddenRuntimeCreators = ["createSystemTextInputClock", "createBrowserControllerTextInputExecutionPort", "createSystemClipboardPort"];
    for (const forbidden of forbiddenRuntimeCreators) {
      if (hasCallExpression(abilityGroupSource, forbidden)) {
        findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-005-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: `Text Input ability-group must not construct ${forbidden}.` }));
      }
    }
  }

  if (!schemaSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-004-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Text Input schema file is missing." }));
  } else {
    const requiredSchemaDecls = [
      "TextInputAbilityInputSchema",
      "TextInputAbilityResultSchema",
      "TextInputRuntimeProofSchema",
      "TextInputSuccessOutputSchema",
    ];
    for (const declarationName of requiredSchemaDecls) {
      if (!schemaSource.getVariableDeclaration(declarationName)) {
        findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-004-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: `Text Input schema must declare ${declarationName}.` }));
      }
    }
  }

  if (!registrySource || !registrySource.getVariableDeclaration("CHILDREN")) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-004-V1", file: REGISTRY_PATH, line: 1, severity: "fatal", message: "Text Input registry must declare canonical children." }));
  }

  if (!executorSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-005-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Text Input executor file is missing." }));
  } else {
    const requiredCalls = [
      "validateInputTargetProof",
      "validateFocusProof",
      "validateTextSourceProof",
      "validateApprovedText",
      "validateTextPolicy",
      "validateSensitiveText",
      "validateKeyPolicy",
      "validateCommitPolicy",
      "validateClipboardPolicy",
      "runPrimitiveTextInput",
      "buildTextInputResult",
    ];
    for (const calleeName of requiredCalls) {
      if (!hasCallExpression(executorSource, calleeName)) {
        findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-005-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: `Text Input executor must call ${calleeName}.` }));
      }
    }
  }

  if (!resultBuilderSource || !hasCallExpression(resultBuilderSource, "buildTextInputRuntimeProof") || !hasCallExpression(resultBuilderSource, "buildTextInputDebugBundle") || !hasCallExpression(resultBuilderSource, "validateTextInputOutputBoundary") || !hasCallExpressionPath(resultBuilderSource, ["TextInputAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-006-V1", file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Text Input result builder must use proof builder and parse the governed result." }));
  }

  if (!proofBuilderSource || !hasCallExpressionPath(proofBuilderSource, ["TextInputRuntimeProofSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-006-V1", file: PROOF_BUILDER_PATH, line: 1, severity: "fatal", message: "Text Input proof builder must parse runtime proof output." }));
  }

  for (const childPath of [TYPE_TEXT_IMPL_PATH, PASTE_TEXT_IMPL_PATH, CLEAR_INPUT_IMPL_PATH, REPLACE_INPUT_IMPL_PATH, PRESS_KEY_IMPL_PATH, COMMIT_INPUT_IMPL_PATH]) {
    const childSource = getSourceFile(project, childPath);
    if (!childSource || !hasCallExpression(childSource, "executeTextInput")) {
      findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-004-V1", file: childPath, line: 1, severity: "fatal", message: "Text Input child implementation must delegate through executeTextInput." }));
    }
  }

  if (!getSourceFile(project, INPUT_GATE_PATH)
    || !getSourceFile(project, SOURCE_GATE_PATH)
    || !getSourceFile(project, APPROVED_TEXT_GATE_PATH)
    || !getSourceFile(project, TARGET_GATE_PATH)
    || !getSourceFile(project, FOCUS_GATE_PATH)
    || !getSourceFile(project, TEXT_POLICY_GATE_PATH)
    || !getSourceFile(project, SENSITIVE_GATE_PATH)
    || !getSourceFile(project, KEY_POLICY_GATE_PATH)
    || !getSourceFile(project, COMMIT_POLICY_GATE_PATH)
    || !getSourceFile(project, CLIPBOARD_POLICY_GATE_PATH)
    || !getSourceFile(project, OUTPUT_BOUNDARY_GATE_PATH)
    || !getSourceFile(project, DEBUG_EVENTS_PATH)
    || !getSourceFile(project, RUNNER_PATH)
    || !getSourceFile(project, PRIMITIVE_ADAPTER_PATH)
    || !getSourceFile(project, CLIPBOARD_ADAPTER_PATH)
    || !getSourceFile(project, INDEX_PATH)) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-007-V1", file: INDEX_PATH, line: 1, severity: "fatal", message: "Text Input package or adapter chain is incomplete." }));
  }

  const hasOutputNullGuard = schemaSource?.getFullText().includes("failed and review_required require output=null") ?? false;
  if (!hasOutputNullGuard) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-006-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Text Input result schema must force output=null for non-success states." }));
  }

  const hasDiagnosticGuard = schemaSource?.getFullText().includes("failed and review_required require diagnosticPayloadRef") ?? false;
  if (!hasDiagnosticGuard) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-006-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Text Input schema must force diagnosticPayloadRef for failed and review_required states." }));
  }

  const hasCommitKeySplit = schemaSource?.getFullText().includes("TextInputCommitKeySchema") ?? false;
  if (!hasCommitKeySplit) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-004-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Text Input schema must split commit keys from press-key input." }));
  }

  const inputGateSource = getSourceFile(project, INPUT_GATE_PATH);
  const inputGateText = inputGateSource?.getFullText() ?? "";
  if (inputGateText.includes('return "type-text"')
    || inputGateText.includes('return "textField"')
    || inputGateText.includes(': "type-text";')
    || inputGateText.includes(': "textField";')) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-005-V1", file: INPUT_GATE_PATH, line: 1, severity: "fatal", message: "Text Input input gate must not reintroduce child or target fallback defaults." }));
  }
  if (!inputGateText.includes("TextInputPolicySchema.safeParse")) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-005-V1", file: INPUT_GATE_PATH, line: 1, severity: "fatal", message: "Text Input input gate must safe-parse policy on invalid input paths." }));
  }

  const requiredFilesPresent = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "required-shape",
      requiredFilesPresent ? "PASS" : "CODE VIOLATION",
      requiredFilesPresent,
      requiredFilesPresent
        ? "Text Input required package, runtime chain, primitive adapter, and governed schema surfaces exist."
        : "Text Input required package or governed execution chain is incomplete.",
    ),
  };
}