import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { hasInterfaceMethod } from "../_shared/ast-schema-queries.js";
import {
  FORBIDDEN_CHILD_TOKENS,
  LAW_IDS,
  PATHS,
} from "./config.js";
import { getSourceFile, makeProject, missingRequiredFiles } from "./project-access.js";
import { collectSchemaAndRegistryFindings } from "./required-shape-schema-findings.js";
import {
  collectBuilderFindings,
  collectGateFindings,
  collectInputAndProofChainFindings,
} from "./required-shape-runtime-findings.js";

async function collectMissingFileFindings(findings: Finding[]): Promise<void> {
  for (const filePath of await missingRequiredFiles()) {
    findings.push(createFinding({ lawId: LAW_IDS.PACKAGE, file: filePath, line: 1, severity: "fatal", message: "Text Input required production or enforcement file is missing." }));
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
  return findings;
}

function hasRequiredSourceFiles(project: ReturnType<typeof makeProject>, paths: readonly string[]): boolean {
  return paths.every((path) => Boolean(getSourceFile(project, path)));
}

function hasCorePackageChain(project: ReturnType<typeof makeProject>): boolean {
  return hasRequiredSourceFiles(project, [
    PATHS.INPUT_GATE,
    PATHS.SOURCE_GATE,
    PATHS.APPROVED_TEXT_GATE,
    PATHS.TARGET_GATE,
    PATHS.FOCUS_GATE,
    PATHS.TEXT_POLICY_GATE,
    PATHS.SENSITIVE_GATE,
    PATHS.KEY_POLICY_GATE,
  ]);
}

function hasAdapterPackageChain(project: ReturnType<typeof makeProject>): boolean {
  return hasRequiredSourceFiles(project, [
    PATHS.COMMIT_POLICY_GATE,
    PATHS.CLIPBOARD_POLICY_GATE,
    PATHS.OUTPUT_BOUNDARY_GATE,
    PATHS.DEBUG_EVENTS,
    PATHS.RUNNER,
    PATHS.RESULT_SUPPORT,
    PATHS.EXECUTOR_CLIPBOARD,
    PATHS.PRIMITIVE_ADAPTER,
    PATHS.CLIPBOARD_ADAPTER,
    PATHS.INDEX,
  ]);
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