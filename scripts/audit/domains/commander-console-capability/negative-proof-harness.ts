import { pathFromRepoRoot } from "../../core/paths.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";

type Mutation = {
  name: string;
  file: string;
  mode?: "replace" | "write";
  search?: string;
  replace?: string;
  content?: string;
};

const INSPECTOR_ENTRY = "scripts/audit/domains/commander-console-capability/inspector.ts";

const MUTATIONS: Mutation[] = [
  {
    name: "transport result runId schema removal mutation",
    file: "src/capabilities/commander-console/shared/commander-transport-schema.ts",
    search: "  runId: NonEmptyStringSchema,\n",
    replace: "",
  },
  {
    name: "transport outcome runId null mutation",
    file: "src/capabilities/commander-console/runtime/commander-command-outcomes.ts",
    search: "    runId: input.transport.runId ?? resolveCommandRunId(input.gated.command.commandId),",
    replace: "    runId: null,",
  },
  {
    name: "transport semantic failure runId null mutation",
    file: "src/capabilities/commander-console/runtime/commander-transport-semantic-gate.ts",
    search: "    runId: resolveCommandRunId(command),",
    replace: "    runId: null,",
  },
  {
    name: "transport semantic review runId null mutation",
    file: "src/capabilities/commander-console/runtime/commander-transport-semantic-gate.ts",
    search: "    runId: input.runId,",
    replace: "    runId: null,",
  },
  {
    name: "command runtime proof runId guard removal mutation",
    file: "src/capabilities/commander-console/shared/commander-runtime-proof-schema.ts",
    search: "  if (value.childKind === \"command\" && !value.runId) {\n    addProofIssue(ctx, \"command proof requires runId\");\n  }\n",
    replace: "",
  },
  {
    name: "mission preflight command contract removal mutation",
    file: "src/lib/local-runtime/workbench-status.ts",
    search: "    { name: \"commandTransportContract\", ok: commandContractOk, detail: commandContractOk ? `taskTemplateId=${input.taskTemplateId}; activationId=${input.activationId}; activationSnapshotRef=${input.activationSnapshotRef}; targetProfileRef=${input.targetProfileRef}; runId=generated-before-transport` : \"selected task binding is missing taskTemplateId, activationId, activationSnapshotRef, or targetProfileRef before command dispatch\", ownerResponsible: \"Commander Console / Nerve Bus / Orchestration\", actionableMessage: \"Repair the selected task binding so command envelope, transport result, and runtime proof can preserve explicit runId and activation refs before dispatch.\" },\n",
    replace: "",
  },
  {
    name: "mission command schema preflight removal mutation",
    file: "src/lib/local-runtime/workbench-mission-command-preflight.ts",
    search: "export const checkMissionCommandSchemaPreflight =",
    replace: "export const checkMissionCommandSchemaPreflightDisabled =",
  },
  {
    name: "task start dispatch refs removal mutation",
    file: "src/lib/local-app-shell/task-start-dispatch-result.ts",
    search: "const collectDispatchResultRefs = (result: StartCommandResult): string[] => {",
    replace: "const collectDispatchResultRefsDisabled = (result: StartCommandResult): string[] => {",
  },
  {
    name: "terminal command rejection owner field removal mutation",
    file: "scripts/startup/lib/terminal-structured-log.mjs",
    search: "      ownerResponsible: payload.ownerResponsible ?? null,\n",
    replace: "",
  },
  {
    name: "weak start-mission gate mutation",
    file: "src/capabilities/commander-console/shared/commander-transport-schema.ts",
    search: "if (!value.requestedPlatformId || !value.selectedMapId) {",
    replace: "if (!value.requestedPlatformId && !value.selectedMapId) {",
  },
  {
    name: "timeout gate bypass mutation",
    file: "src/capabilities/commander-console/runtime/commander-command-child-executor.ts",
    search: "const timeoutResult = await runCommanderTimeoutGate<CommanderExecutionOutcome<CommanderCommandReceiptView>>({",
    replace: "const timeoutResult = await (({ run }) => run())({",
  },
  {
    name: "start mission awaits terminal execution mutation",
    file: "src/lib/local-runtime/workbench-human-command.ts",
    search: "const missionStartPromise = runtime.orchestrationAbilityGroup.startMission({",
    replace: "const missionStartPromise = await runtime.orchestrationAbilityGroup.startMission({",
  },
  {
    name: "idempotency hard-path mutation",
    file: "src/capabilities/commander-console/runtime/commander-idempotency-gate.ts",
    search: "if (input.policy === \"hard-stop-non-dedupe\") {",
    replace: "if (false) {",
  },
  {
    name: "transport commandId mismatch bypass mutation",
    file: "src/capabilities/commander-console/runtime/commander-transport-semantic-gate.ts",
    search: "if (input.result.commandId !== input.command.commandId) {",
    replace: "if (false) {",
  },
  {
    name: "accepted-without-result-envelope mutation",
    file: "src/capabilities/commander-console/runtime/commander-transport-semantic-gate.ts",
    search: "if (result.status !== \"accepted\" || result.resultEnvelopeRef) {",
    replace: "if (result.status !== \"accepted\" || !result.resultEnvelopeRef) {",
  },
  {
    name: "read proof structured evidence bypass mutation",
    file: "src/capabilities/commander-console/runtime/commander-read-proof-gate.ts",
    search: "return input.contract.proofPolicy.requiresStructuredEvidenceRefs && input.evidenceRefs.length === 0\n    ? `${input.contract.childCapabilityId} requires structured evidenceRefs from governed read sources.`\n    : null;",
    replace: "return null;",
  },
  {
    name: "emergency-downgrade mutation",
    file: "src/capabilities/commander-console/children/emergency-stop/implementation.ts",
    search: 'commandType: "emergency-stop",',
    replace: 'commandType: "stop-mission",',
  },
  {
    name: "export star mutation",
    file: "src/capabilities/commander-console/index.ts",
    search: 'export type { CommanderRuntimeProof } from "./shared/commander-proof.js";',
    replace: 'export type { CommanderRuntimeProof } from "./shared/commander-proof.js";\nexport * from "./schema.js";',
  },
  {
    name: "UI transport bypass mutation",
    file: "src/lib/local-app-shell/commander-console-shell-client.ts",
    search: "window.commanderConsoleUi = handlers;",
    replace: 'import("../../capabilities/commander-console/ports/command-transport-port.js");\nwindow.commanderConsoleUi = handlers;',
  },
  {
    name: "as-any mutation",
    file: "src/capabilities/commander-console/runtime/commander-command-gate.ts",
    search: "const payload = buildTransportPayload(parsed);",
    replace: "const payload = buildTransportPayload(parsed);\n  const escapedPayload = payload as any;",
  },
  {
    name: "startup local-ai gate after service mutation",
    file: "scripts/startup/launch-grasseye.mjs",
    search: "  const localAiReadiness = await ensureLocalAiReadiness();\n  await preparePort();\n  const serviceHandle = await startService(root, localAiReadiness);",
    replace: "  await preparePort();\n  const serviceHandle = await startService(root, localAiReadiness);\n  const localAiReadiness = await ensureLocalAiReadiness();",
  },
  {
    name: "startup map-package gate removal mutation",
    file: "scripts/startup/launch-grasseye.mjs",
    search: "  await ensureStartupMapPackageReadiness();\n",
    replace: "",
  },
  {
    name: "startup map-package helper bypass mutation",
    file: "scripts/startup/lib/map-package-readiness.mjs",
    search: "const probeScriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), \"map-package-readiness-probe.ts\");",
    replace: "const probeScriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), \"map-package-readiness-inline.ts\");",
  },
  {
    name: "startup failure bundle removal mutation",
    file: "scripts/startup/launch-grasseye.mjs",
    search: "    await handleStartupBootstrapFailure({ rootDir, runId: startupRunId, baseUrl, failureReason: toFailureReason(error), logFail, shutdown });\n",
    replace: "    logFail(\"STARTUP\", \"startup_entrypoint\", \"bootstrap_failed\", \"failed\", \"startup bootstrap failed\", { failureReason: toFailureReason(error) });\n",
  },
  {
    name: "startup update preflight removal mutation",
    file: "scripts/startup/launch-grasseye.mjs",
    search: "  await runUpdatePreflight(root, flags);\n",
    replace: "",
  },
  {
    name: "startup local-ai fail-open mutation",
    file: "scripts/startup/launch-grasseye.mjs",
    search: "  if (!gatePassed) {\n    throw new Error(`${readiness.failureReason ?? \"LOCAL_AI_NOT_READY\"}: ${readiness.detail}`);\n  }\n",
    replace: "  if (!gatePassed) {\n    return readiness;\n  }\n",
  },
  {
    name: "startup helper bypasses governed probe mutation",
    file: "scripts/startup/lib/local-ai-runtime-readiness.mjs",
    search: "const probeScriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), \"local-ai-runtime-readiness-probe.ts\");",
    replace: "const probeScriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), \"local-ai-runtime-readiness-inline.ts\");",
  },
  {
    name: "startup platform hardcode mutation",
    file: "scripts/startup/launch-grasseye.mjs",
    search: "      GRASSEYE_STARTUP_LOCAL_AI_READINESS_JSON: JSON.stringify(localAiReadiness),\n",
    replace: "      GRASSEYE_STARTUP_LOCAL_AI_READINESS_JSON: JSON.stringify(localAiReadiness),\n      GRASSEYE_PLATFORM_TARGET: \"tiktok-web\",\n",
  },
  {
    name: "startup platform helper resurrection mutation",
    file: "scripts/startup/lib/platform-target.mjs",
    mode: "write",
    content: "export const shouldPromptForStartupPlatform = () => true;\n",
  },
  {
    name: "startup readiness bridge removal mutation",
    file: "scripts/startup/launch-grasseye.mjs",
    search: "      GRASSEYE_STARTUP_LOCAL_AI_READINESS_JSON: JSON.stringify(localAiReadiness),\n",
    replace: "",
  },
  {
    name: "package startup script hardcode mutation",
    file: "package.json",
    search: "    \"internal:app-server:dev\": \"tsx src/app/server.ts\",",
    replace: "    \"internal:app-server:dev\": \"GRASSEYE_PLATFORM_TARGET=tiktok-web tsx src/app/server.ts\",",
  },
  {
    name: "server single-platform guard mutation",
    file: "src/app/server.ts",
    search: "  return value === \"tiktok-web\" || value === \"facebook-web\" ? value : STARTUP_SHELL_PLATFORM;\n",
    replace: "  if (value === \"tiktok-web\" || value === \"facebook-web\") {\n    return value;\n  }\n  throw new Error(\"GrassEye startup requires explicit GRASSEYE_PLATFORM_TARGET=facebook-web|tiktok-web.\");\n",
  },
  {
    name: "page-state consumes startup shell platform mutation",
    file: "src/lib/local-runtime/workbench-page-state-dispatch-input.ts",
    search: "  const platformProfileId = await resolvePageStatePlatformProfile(runtime);\n",
    replace: "  const platformProfileId = runtime.options.platformTarget;\n",
  },
  {
    name: "server startup readiness handoff removal mutation",
    file: "src/app/server.ts",
    search: "  startupReadiness,\n",
    replace: "",
  },
  {
    name: "debug-loop local-ai bootstrap mutation",
    file: "scripts/debug-loop/task-publisher.mjs",
    search: "    \"const runtime = createWorkbenchRuntime(baseOptions);\",",
    replace: "    \"await ensureLocalAiRuntimeReady();\",\n    \"const runtime = createWorkbenchRuntime(baseOptions);\",",
  },
];

async function runInspector(): Promise<{ passed: boolean; violationCount: number }> {
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector(INSPECTOR_ENTRY);
  const result = await inspector(context);
  return { passed: result.passed, violationCount: result.violationCount };
}

async function mutateAndVerify(mutation: Mutation): Promise<void> {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  await applyAuditMutation(filePath, state.original, mutation);

  try {
    const result = await runInspector();
    if (result.passed || result.violationCount === 0) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
  } finally {
    await restoreAuditFileState(filePath, state);
  }

  const restored = await runInspector();
  if (!restored.passed) {
    throw new Error(`Rollback verification failed for ${mutation.name}`);
  }
}

async function main(): Promise<void> {
  const baseline = await runInspector();
  if (!baseline.passed) {
    throw new Error("Commander Console inspector baseline must pass before negative proof.");
  }

  for (const mutation of MUTATIONS) {
    await mutateAndVerify(mutation);
    process.stdout.write(`[NEGATIVE-PROOF] PASS ${mutation.name}\n`);
  }
}

void main();
