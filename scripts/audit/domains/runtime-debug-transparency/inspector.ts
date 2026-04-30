import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { DomainInspector } from "../../core/schema.js";
import { hasIdentifier, hasLiteralTextFragment } from "../_shared/ast-literal-queries.js";
import { createRuntimeDebugTransparencyProject, getSource } from "./ast-utils.js";

const LAW_ID = "GRASSEYE-STRUCTURED-LOGGING-002-V2";
const WHY_PATH = "docs/why/runtime-debug-transparency.WHY.md";

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
  localAiRuntimeExecution: ReturnType<typeof getSource>,
): boolean => {
  const proofBuilderShape = hasIdentifier(aiProofBuilder, "promptContractId")
    && hasIdentifier(aiProofBuilder, "promptContractHash");
  const executorCarriesPromptContract = hasIdentifier(aiExecutor, "promptContractId");
  const structuredLogShape = ["promptContractId", "outputSchemaRef", "systemPromptHash", "userPromptHash", "rawResponseRef"].every(
    (propertyName) => hasIdentifier(structuredLogPayload, propertyName),
  );
  const localAiTraceShape = ["promptContractId", "outputSchemaRef", "systemPromptHash", "userPromptHash"].every(
    (fragment) => hasIdentifier(localAiRuntimeExecution, fragment),
  );

  return proofBuilderShape && executorCarriesPromptContract && structuredLogShape && localAiTraceShape;
};

const inspector: DomainInspector = async () => {
  const findings = [];
  const project = createRuntimeDebugTransparencyProject();
  const aiProofBuilder = getSource(project, "src/capabilities/ai/runtime/ai-proof-builder.ts");
  const aiExecutor = getSource(project, "src/capabilities/ai/runtime/ai-executor.ts");
  const structuredLogPayload = getSource(project, "src/lib/local-runtime/structured-log-payload.ts");
  const localAiRuntimeExecution = getSource(project, "src/lib/local-ai/local-ai-runtime-execution.ts");

  const whyText = await readTextFile(pathFromRepoRoot(WHY_PATH));
  if (!hasRequiredWhySections(whyText) || !hasRequiredTraceFields(aiProofBuilder, aiExecutor, structuredLogPayload, localAiRuntimeExecution)) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: WHY_PATH,
      line: 1,
      severity: "error",
      message: "Runtime debug transparency is missing WHY coverage or prompt-trace structured logging fields across AI and local runtime surfaces.",
    }));
  }

  const phase = createPhase(
    "traceability-shape",
    findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
    findings.length === 0,
    findings.length === 0
      ? "Runtime debug transparency keeps WHY guidance and structured prompt-trace fields wired across AI proof and runtime logs."
      : "Runtime debug transparency lost required WHY guidance or structured prompt-trace fields.",
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