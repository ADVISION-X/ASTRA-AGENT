import { createFinding, createPhase, pathFromRepoRoot, readTextFile, type Finding } from "./inspection-core.js";

const AI_DISPATCH_REQUIREMENTS_PATH = "src/capabilities/orchestration/runtime/step-dispatch-ai-requirements.ts";
const NERVE_BUS_ENVELOPE_BUILDERS_PATH = "src/capabilities/orchestration/runtime/orchestration-nerve-bus-envelope-builders.ts";
const AI_REQUEST_BUILDER_PATH = "src/lib/local-runtime/workbench-nerve-bus-ai-request-builder.ts";

function createTaskTypeFinding(input: { file: string; message: string }): Finding {
  return createFinding({
    lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1",
    file: input.file,
    line: 1,
    severity: "fatal",
    message: input.message,
  });
}

function createTaskTypePhase(findings: Finding[]) {
  return createPhase(
    "ai-prompt-contract-tasktype-dispatch",
    findings.length === 0 ? "PASS" : "CODE VIOLATION",
    findings.length === 0,
    findings.length === 0
      ? "Orchestration resolves AI taskType from Prompt Contract Registry and transports it separately from promptContractId."
      : "Orchestration can still send promptContractId as the AI taskType discriminant.",
  );
}

function hasUnifiedVisionImageCollectionRoute(aiRequestText: string): boolean {
  return aiRequestText.includes("buildVisionImageCollectionInputPayload")
    && aiRequestText.includes("const PRODUCT_PRESENCE_TASK_TYPE = \"product_presence_judgment\";")
    && aiRequestText.includes("const VISUAL_TARGET_CANDIDATE_TASK_TYPE = \"visual_target_candidate_analysis\";")
    && aiRequestText.includes("envelope.taskType === PAGE_PREPARATION_TASK_TYPE")
    && aiRequestText.includes("envelope.taskType === PRODUCT_PRESENCE_TASK_TYPE")
    && aiRequestText.includes("envelope.taskType === VISUAL_TARGET_CANDIDATE_TASK_TYPE")
    && aiRequestText.includes("buildWorkbenchAiInputPayload({ ...envelope, taskType }, inputPayload)");
}

function hasImageCollectionModalityForWorkbenchVisionTasks(aiRequestText: string): boolean {
  return aiRequestText.includes('taskType === "schema_validation_only" ? "structured_record" as const : "image_collection" as const');
}

export async function inspectAiPromptContractTaskTypeDispatch() {
  const [requirementsText, envelopeText, aiRequestText] = await Promise.all([
    readTextFile(pathFromRepoRoot(AI_DISPATCH_REQUIREMENTS_PATH)),
    readTextFile(pathFromRepoRoot(NERVE_BUS_ENVELOPE_BUILDERS_PATH)),
    readTextFile(pathFromRepoRoot(AI_REQUEST_BUILDER_PATH)),
  ]);
  const findings: Finding[] = [];

  if (!requirementsText.includes("findAiPromptContractCatalogEntry") || !requirementsText.includes("taskType: contractBinding.promptContract.taskType")) {
    findings.push(createTaskTypeFinding({ file: AI_DISPATCH_REQUIREMENTS_PATH, message: "Orchestration AI dispatch requirements must resolve taskType from the AI Prompt Contract Registry before Nerve Bus transport." }));
  }
  if (envelopeText.includes("taskType: input.promptContractId") || !envelopeText.includes("taskType: input.taskType")) {
    findings.push(createTaskTypeFinding({ file: NERVE_BUS_ENVELOPE_BUILDERS_PATH, message: "Orchestration-to-AI envelope must transport prompt-contract taskType, not promptContractId, as the AI schema discriminant." }));
  }

  const hasResolvedTransportedTaskType = aiRequestText.includes("resolveAiTaskType(envelope)");
  const hasProductPresenceImageCollectionRoute = hasUnifiedVisionImageCollectionRoute(aiRequestText);
  const hasImageCollectionModality = hasImageCollectionModalityForWorkbenchVisionTasks(aiRequestText);
  if (!hasResolvedTransportedTaskType || !hasProductPresenceImageCollectionRoute || !hasImageCollectionModality) {
    findings.push(createTaskTypeFinding({ file: AI_REQUEST_BUILDER_PATH, message: "Workbench AI request builder must resolve transported taskType and build the governed image_collection payload for page_preparation_judgment, product_presence_judgment, and visual_target_candidate_analysis." }));
  }

  return { findings, phase: createTaskTypePhase(findings) };
}
