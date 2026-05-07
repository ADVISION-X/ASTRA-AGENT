import { readJsonFile, readTextFile } from "../../core/filesystem.js";
import { Node } from "ts-morph";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { DomainInspector } from "../../core/schema.js";
import { hasIdentifier, hasLiteralTextFragment } from "../_shared/ast-literal-queries.js";
import { getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";
import { createRuntimeDebugTransparencyProject, getSource } from "./ast-utils.js";

const LAW_ID = "GRASSEYE-STRUCTURED-LOGGING-002-V2";
const WHY_PATH = "docs/why/runtime-debug-transparency.WHY.md";
const PACKAGE_JSON_PATH = "package.json";
const COPY_RUNTIME_ASSETS_PATH = "scripts/copy-runtime-assets.mjs";

const REQUIRED_RUNTIME_ASSET_SOURCES = [
  "src/capabilities/ai/prompt-contracts/builtins",
  "src/map-plugins/builtins",
  "src/map-plugins/authoring/capability-catalog",
] as const;

const hasRequiredWhySections = (whyText: string): boolean => [
  "Why this exists",
  "Why not console.log patch",
  "Why Screenshot prepare-ai-input must be upstream",
  "Why AI runtime must log input/output",
  "Why terminal + forensics double track",
  "Why enforcement is mandatory",
].every((section) => whyText.includes(section));

const hasRequiredTraceFields = (
  aiProofBuilder: ReturnType<typeof getSource>,
  aiExecutor: ReturnType<typeof getSource>,
  structuredLogPayload: ReturnType<typeof getSource>,
  localAiRuntimeSources: ReturnType<typeof getSource>[],
): boolean => {
  const proofBuilderShape = hasIdentifier(aiProofBuilder, "promptContractId")
    && hasIdentifier(aiProofBuilder, "promptContractHash");
  const executorCarriesPromptContract = hasIdentifier(aiExecutor, "promptContractId");
  const structuredLogShape = ["promptContractId", "outputSchemaRef", "systemPromptHash", "userPromptHash", "rawResponseRef"].every(
    (propertyName) => hasIdentifier(structuredLogPayload, propertyName),
  );
  const localAiTraceShape = ["promptContractId", "outputSchemaRef", "systemPromptHash", "userPromptHash"].every(
    (fragment) => localAiRuntimeSources.some((source) => hasIdentifier(source, fragment)),
  );

  return proofBuilderShape && executorCarriesPromptContract && structuredLogShape && localAiTraceShape;
};

const REQUIRED_SCREENSHOT_TERMINAL_FIELDS = [
  "screenshotEvidenceId",
  "artifactRef",
  "artifactStorageRef",
  "outputHash",
  "artifactHash",
  "byteSize",
  "width",
  "height",
  "coordinateSpace",
  "runtimeProofRef",
] as const;

const REQUIRED_PREPARE_AI_TERMINAL_FIELDS = [
  "promptInputRef",
  "aiInputArtifactRef",
  "aiInputStorageRef",
  "sourceScreenshotEvidenceId",
  "sourceStorageRef",
  "preparedImageHash",
  "preparedImageWidth",
  "preparedImageHeight",
] as const;

const REQUIRED_TERMINAL_PROOF_FIELDS = [
  ...REQUIRED_SCREENSHOT_TERMINAL_FIELDS,
  ...REQUIRED_PREPARE_AI_TERMINAL_FIELDS,
] as const;

const hasTerminalProofFieldShape = (
  structuredLogSchema: ReturnType<typeof getSource>,
  structuredLogPayload: ReturnType<typeof getSource>,
  orchestrationPayloads: ReturnType<typeof getSource>,
  orchestrationEvents: ReturnType<typeof getSource>,
): boolean => {
  const runtimeEventFields = getZodObjectPropertyNames(structuredLogSchema, "StructuredRuntimeEventSchema");
  return REQUIRED_TERMINAL_PROOF_FIELDS.every((field) => runtimeEventFields.has(field))
    && REQUIRED_TERMINAL_PROOF_FIELDS.every((field) => hasIdentifier(structuredLogPayload, field))
    && hasIdentifier(structuredLogPayload, "buildEventProofPayload")
    && hasIdentifier(orchestrationPayloads, "proofSummary")
    && hasIdentifier(orchestrationEvents, "branchFieldValues")
    && hasIdentifier(orchestrationEvents, "proofSummary");
};

const hasRuntimeAssetCopyShape = async (): Promise<boolean> => {
  const packageJson = await readJsonFile<{ scripts?: Record<string, string> }>(pathFromRepoRoot(PACKAGE_JSON_PATH));
  const buildScript = packageJson.scripts?.build ?? "";
  const copyScriptText = await readTextFile(pathFromRepoRoot(COPY_RUNTIME_ASSETS_PATH));

  return buildScript.includes("scripts/copy-runtime-assets.mjs")
    && REQUIRED_RUNTIME_ASSET_SOURCES.every((source) => copyScriptText.includes(source));
};

const hasAiDebugStructuredSchemaShape = (
  aiDebugSupport: ReturnType<typeof getSource>,
): boolean => {
  const hasPropertyInitializer = (propertyName: string, expectedFragment: string): boolean => {
    return aiDebugSupport.getDescendants().some((node) =>
      Node.isPropertyAssignment(node)
      && node.getName() === propertyName
      && node.getInitializer()?.getText().includes(expectedFragment) === true,
    );
  };

  return hasIdentifier(aiDebugSupport, "toAiEvidenceRefs")
    && hasIdentifier(aiDebugSupport, "toIntegerDurationMs")
    && hasPropertyInitializer("inputRefs", "toAiEvidenceRefs")
    && hasPropertyInitializer("outputRefs", "toAiEvidenceRef")
    && hasPropertyInitializer("artifactRefs", ".map")
    && hasPropertyInitializer("durationMs", "toIntegerDurationMs");
};

const inspector: DomainInspector = async () => {
  const findings = [];
  const project = createRuntimeDebugTransparencyProject();
  const aiProofBuilder = getSource(project, "src/capabilities/ai/runtime/ai-proof-builder.ts");
  const aiExecutor = getSource(project, "src/capabilities/ai/runtime/ai-executor.ts");
  const structuredLogPayload = getSource(project, "src/lib/local-runtime/structured-log-payload.ts");
  const structuredLogSchema = getSource(project, "src/types/structured-log.ts");
  const orchestrationPayloads = getSource(project, "src/capabilities/orchestration/runtime/orchestration-step-trace-payloads.ts");
  const orchestrationEvents = getSource(project, "src/capabilities/orchestration/runtime/orchestration-loop-iteration-events.ts");
  const aiDebugSupport = getSource(project, "src/lib/local-runtime/workbench-ai-debug-support.ts");
  const localAiRuntimeSources = [
    getSource(project, "src/lib/local-ai/local-ai-runtime-vision-task.ts"),
    getSource(project, "src/lib/local-ai/local-ai-runtime-ocr-task.ts"),
    getSource(project, "src/lib/local-ai/local-ai-runtime-comment-signal-task.ts"),
    getSource(project, "src/capabilities/ai/runtime-adapters/local-ai-runtime-debug-state.ts"),
  ];

  const whyText = await readTextFile(pathFromRepoRoot(WHY_PATH));
  if (!hasRequiredWhySections(whyText) || !hasRequiredTraceFields(aiProofBuilder, aiExecutor, structuredLogPayload, localAiRuntimeSources)) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: WHY_PATH,
      line: 1,
      severity: "error",
      message: "Runtime debug transparency is missing WHY coverage or prompt-trace structured logging fields across AI and local runtime surfaces.",
    }));
  }
  if (!hasTerminalProofFieldShape(structuredLogSchema, structuredLogPayload, orchestrationPayloads, orchestrationEvents)) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: "src/lib/local-runtime/structured-log-payload.ts",
      line: 1,
      severity: "error",
      message: "Runtime debug transparency must carry screenshot artifact refs and prepare-ai-input proof refs as first-class structured terminal payload fields, not only opaque outputRefs strings.",
    }));
  }
  if (!await hasRuntimeAssetCopyShape()) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: COPY_RUNTIME_ASSETS_PATH,
      line: 1,
      severity: "error",
      message: "Build/runtime transparency must copy prompt-contract JSON, builtin map-package JSON, and generated capability-catalog JSON into dist so startup cannot fail before AI debug events become observable.",
    }));
  }
  if (!hasAiDebugStructuredSchemaShape(aiDebugSupport)) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: "src/lib/local-runtime/workbench-ai-debug-support.ts",
      line: 1,
      severity: "error",
      message: "AI debug structured runtime events must map inputRefs/outputRefs/artifactRefs/durationMs into the StructuredRuntimeEventSchema shape before terminal or forensics emission.",
    }));
  }

  const phase = createPhase(
    "traceability-shape",
    findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
    findings.length === 0,
    findings.length === 0
      ? "Runtime debug transparency keeps WHY guidance, structured prompt traces, and screenshot-to-AI proof refs wired into terminal payloads."
      : "Runtime debug transparency lost required WHY guidance, prompt-trace fields, or screenshot-to-AI terminal proof refs.",
  );

  return finalizeInspectorResult({
    inspector: "GrassEye Runtime Debug Transparency Inspector",
    inspectorId: "runtime-debug-transparency",
    capabilityDomain: "runtime-debug-transparency",
    findings,
    phases: [phase],
    summary: phase.summary,
  });
};

export { inspector as runtimeDebugTransparencyInspector };
