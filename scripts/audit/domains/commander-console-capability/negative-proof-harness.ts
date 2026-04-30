import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
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
    name: "command gate mutation",
    file: "src/capabilities/commander-console/runtime/commander-command-gate.ts",
    search: "return CommandTransportResultSchema.parse(result);",
    replace: "return result;",
  },
  {
    name: "read gate mutation",
    file: "src/capabilities/commander-console/runtime/commander-read-gate.ts",
    search: "const parsed = input.inputSchema.safeParse(input.readInput);",
    replace: "const parsed = input.inputSchema.passthrough().safeParse(input.readInput);",
  },
  {
    name: "proof builder mutation",
    file: "src/capabilities/commander-console/runtime/commander-proof-builder.ts",
    search: "return RuntimeProofSchema.parse({",
    replace: "return ({",
  },
  {
    name: "child-schema-shell mutation",
    file: "src/capabilities/commander-console/children/approve-candidate/schema.ts",
    search: "export const ApproveCandidateInputSchema = ReviewDecisionInputSchema.extend({});",
    replace: 'export { ReviewDecisionInputSchema as ApproveCandidateInputSchema } from "../../schema.js";',
  },
  {
    name: "duplicate-schema mutation",
    file: "src/capabilities/commander-console/shared/commander-schema-base.ts",
    search: `export const CommanderMissionDashboardViewSchema = z.object({
  mission: CommanderMissionViewSchema,
  runtime: CommanderRuntimeSummaryViewSchema,
  browser: CommanderBrowserSummaryViewSchema,
  health: z.array(CommanderCapabilityHealthEntrySchema),
  capabilityRoster: z.array(CommanderCapabilityRosterEntrySchema),
  candidates: z.array(CommanderCandidateViewSchema),
  reviewQueue: z.array(CommanderRecordSummaryViewSchema),
  evidencePackets: z.array(CommanderRecordSummaryViewSchema),
  browseLedger: z.array(CommanderRecordSummaryViewSchema),
  failedRecords: z.array(CommanderRecordSummaryViewSchema),
  runtimeProof: z.array(CommanderRuntimeProofTimelineEntrySchema),
  auditSummary: CommanderAuditSummarySchema,
}).strict();`,
    replace: `export const CommanderMissionDashboardViewSchema = z.object({
  mission: CommanderMissionViewSchema,
  runtime: CommanderRuntimeSummaryViewSchema,
  browser: CommanderBrowserSummaryViewSchema,
  health: z.array(CommanderCapabilityHealthEntrySchema),
  capabilityRoster: z.array(CommanderCapabilityRosterEntrySchema),
  candidates: z.array(CommanderCandidateViewSchema),
  reviewQueue: z.array(CommanderRecordSummaryViewSchema),
  evidencePackets: z.array(CommanderRecordSummaryViewSchema),
  browseLedger: z.array(CommanderRecordSummaryViewSchema),
  failedRecords: z.array(CommanderRecordSummaryViewSchema),
  runtimeProof: z.array(CommanderRuntimeProofTimelineEntrySchema),
  auditSummary: CommanderAuditSummarySchema,
}).strict();

export const CommanderMissionDashboardViewSchema = z.object({
  mission: CommanderMissionViewSchema,
  runtime: CommanderRuntimeSummaryViewSchema,
  browser: CommanderBrowserSummaryViewSchema,
  health: z.array(CommanderCapabilityHealthEntrySchema),
  capabilityRoster: z.array(CommanderCapabilityRosterEntrySchema),
  candidates: z.array(CommanderCandidateViewSchema),
  reviewQueue: z.array(CommanderRecordSummaryViewSchema),
  evidencePackets: z.array(CommanderRecordSummaryViewSchema),
  browseLedger: z.array(CommanderRecordSummaryViewSchema),
  failedRecords: z.array(CommanderRecordSummaryViewSchema),
  runtimeProof: z.array(CommanderRuntimeProofTimelineEntrySchema),
  auditSummary: CommanderAuditSummarySchema,
}).strict();`,
  },
  {
    name: "passthrough mutation",
    file: "src/capabilities/commander-console/runtime/commander-read-gate.ts",
    search: "const parsed = input.inputSchema.safeParse(input.readInput);",
    replace: "const parsed = input.inputSchema.passthrough().safeParse(input.readInput);",
  },
  {
    name: "emergency-downgrade mutation",
    file: "src/capabilities/commander-console/children/emergency-stop/implementation.ts",
    search: 'commandType: "emergency-stop",',
    replace: 'commandType: "stop-mission",',
  },
  {
    name: "failed-receipt mutation",
    file: "src/capabilities/commander-console/runtime/commander-child-executors.ts",
    search: "output: receipt,",
    replace: "output: null,",
  },
  {
    name: "export star mutation",
    file: "src/capabilities/commander-console/index.ts",
    search: 'export type { CommanderRuntimeProof } from "./shared/commander-proof.js";',
    replace: 'export type { CommanderRuntimeProof } from "./shared/commander-proof.js";\nexport * from "./schema.js";',
  },
  {
    name: "UI transport bypass mutation",
    file: "src/lib/local-app-shell/commander-console-page-client.ts",
    search: "window.commanderConsoleShell = commanderConsoleShell;",
    replace: 'import("../../capabilities/commander-console/ports/command-transport-port.js");\nwindow.commanderConsoleShell = commanderConsoleShell;',
  },
  {
    name: "as-any mutation",
    file: "src/capabilities/commander-console/runtime/commander-command-gate.ts",
    search: "const payload = buildTransportPayload(parsed.data);",
    replace: "const payload = buildTransportPayload(parsed.data);\n  const escapedPayload = payload as any;",
  },
];

async function runInspector(): Promise<{ passed: boolean; violationCount: number }> {
  await buildAuditArtifacts();
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