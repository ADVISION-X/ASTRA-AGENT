import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { hasInterfaceMethod } from "../_shared/ast-schema-queries.js";
import { LAW_IDS, PATHS } from "./config.js";
import { getSourceFile, makeProject, missingRequiredFiles } from "./project-access.js";

async function collectMissingFileFindings(findings: Finding[]): Promise<void> {
  for (const filePath of await missingRequiredFiles()) {
    findings.push(createFinding({ lawId: LAW_IDS.PACKAGE, file: filePath, line: 1, severity: "fatal", message: "Text Input required production file is missing." }));
  }
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
    findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.ABILITY_GROUP, line: 1, severity: "fatal", message: "Text Input ability-group must parse input and parse governed output." }));
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
  } else {
    for (const declarationName of ["TextInputAbilityInputSchema", "TextInputAbilityResultSchema", "TextInputRuntimeProofSchema", "TextInputSuccessOutputSchema"]) {
      if (!schemaSource.getVariableDeclaration(declarationName)) {
        findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: `Text Input schema must declare ${declarationName}.` }));
      }
    }
  }
  const registrySource = getSourceFile(project, PATHS.REGISTRY);
  return !registrySource || !registrySource.getVariableDeclaration("CHILDREN")
    ? findings.concat(createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.REGISTRY, line: 1, severity: "fatal", message: "Text Input registry must declare canonical children." }))
    : findings;
}

function collectExecutorFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const executorSource = getSourceFile(project, PATHS.EXECUTOR);
  if (!executorSource) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Text Input executor file is missing." }));
  } else {
    for (const calleeName of ["validateInputTargetProof", "validateFocusProof", "validateTextSourceProof", "validateApprovedText", "validateTextPolicy", "validateSensitiveText", "validateKeyPolicy", "validateCommitPolicy", "validateClipboardPolicy", "runPrimitiveTextInput", "buildTextInputResult"]) {
      if (!hasCallExpression(executorSource, calleeName)) {
        findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: `Text Input executor must call ${calleeName}.` }));
      }
    }
  }
  return findings;
}

function collectBuilderFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const resultBuilderSource = getSourceFile(project, PATHS.RESULT_BUILDER);
  if (!resultBuilderSource || !hasCallExpression(resultBuilderSource, "buildTextInputRuntimeProof") || !hasCallExpression(resultBuilderSource, "buildTextInputDebugBundle") || !hasCallExpression(resultBuilderSource, "validateTextInputOutputBoundary") || !hasCallExpressionPath(resultBuilderSource, ["TextInputAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Text Input result builder must use proof builder and parse the governed result." }));
  }
  const proofBuilderSource = getSourceFile(project, PATHS.PROOF_BUILDER);
  return !proofBuilderSource || !hasCallExpressionPath(proofBuilderSource, ["TextInputRuntimeProofSchema", "parse"])
    ? findings.concat(createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Text Input proof builder must parse runtime proof output." }))
    : findings;
}

function collectChildFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  for (const childPath of [PATHS.TYPE_TEXT_IMPL, PATHS.PASTE_TEXT_IMPL, PATHS.CLEAR_INPUT_IMPL, PATHS.REPLACE_INPUT_IMPL, PATHS.PRESS_KEY_IMPL, PATHS.COMMIT_INPUT_IMPL]) {
    const childSource = getSourceFile(project, childPath);
    if (!childSource || !hasCallExpression(childSource, "executeTextInput")) {
      findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: childPath, line: 1, severity: "fatal", message: "Text Input child implementation must delegate through executeTextInput." }));
    }
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
    && getSourceFile(project, PATHS.PRIMITIVE_ADAPTER)
    && getSourceFile(project, PATHS.CLIPBOARD_ADAPTER)
    && getSourceFile(project, PATHS.INDEX));
}

function collectPackageChainFindings(project: ReturnType<typeof makeProject>): Finding[] {
  return !hasCorePackageChain(project) || !hasAdapterPackageChain(project)
    ? [createFinding({ lawId: LAW_IDS.PACKAGE, file: PATHS.INDEX, line: 1, severity: "fatal", message: "Text Input package or adapter chain is incomplete." })]
    : [];
}

function collectSchemaGuardFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const schemaText = getSourceFile(project, PATHS.SCHEMA)?.getFullText() ?? "";
  if (!schemaText.includes("failed and review_required require output=null")) {
    findings.push(createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Text Input result schema must force output=null for non-success states." }));
  }
  if (!schemaText.includes("failed and review_required require diagnosticPayloadRef")) {
    findings.push(createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Text Input schema must force diagnosticPayloadRef for failed and review_required states." }));
  }
  return !schemaText.includes("TextInputCommitKeySchema")
    ? findings.concat(createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Text Input schema must split commit keys from press-key input." }))
    : findings;
}

function collectInputGateFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const inputGateText = getSourceFile(project, PATHS.INPUT_GATE)?.getFullText() ?? "";
  const findings: Finding[] = [];
  if (inputGateText.includes('return "type-text"') || inputGateText.includes('return "textField"') || inputGateText.includes(': "type-text";') || inputGateText.includes(': "textField";')) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.INPUT_GATE, line: 1, severity: "fatal", message: "Text Input input gate must not reintroduce child or target fallback defaults." }));
  }
  return !inputGateText.includes("TextInputPolicySchema.safeParse")
    ? findings.concat(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.INPUT_GATE, line: 1, severity: "fatal", message: "Text Input input gate must safe-parse policy on invalid input paths." }))
    : findings;
}

export async function runRequiredShapeAttack(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const project = makeProject();
  const findings: Finding[] = [];
  await collectMissingFileFindings(findings);
  findings.push(...collectContractFindings(project));
  findings.push(...collectAbilityGroupFindings(project));
  findings.push(...collectSchemaAndRegistryFindings(project));
  findings.push(...collectExecutorFindings(project));
  findings.push(...collectBuilderFindings(project));
  findings.push(...collectChildFindings(project));
  findings.push(...collectPackageChainFindings(project));
  findings.push(...collectSchemaGuardFindings(project));
  findings.push(...collectInputGateFindings(project));

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