import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";

const checkId = "runtime-log-spine/terminal-authority";
const laws = {
  terminal: { lawId: "APEX-RUNTIME-LOG-SPINE-001-V2", clauseId: "apex-runtime-log-001-v2-terminal-observability" },
  singleSpine: { lawId: "GRASSEYE-STRUCTURED-LOGGING-001-V1", clauseId: "grasseye-structured-logging-001-requirement" },
  redaction: { lawId: "GRASSEYE-SECURITY-PRIVACY-LOG-001-V1", clauseId: "grasseye-security-privacy-log-001-requirement" },
} as const;

const sourceAt = (context: InspectorContext, path: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(path));

const identifiers = (file: SourceFile): ReadonlySet<string> =>
  new Set(file.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()));

const finding = (
  law: (typeof laws)[keyof typeof laws],
  path: string,
  message: string,
): InspectorFinding => createFinding({ checkId, lawId: law.lawId, clauseId: law.clauseId, filePath: path, message });

const inspectAuthenticatedCommandDiagnostics = (
  context: InspectorContext,
  findings: InspectorFinding[],
): readonly string[] => {
  const paths = [
    "src/lib/browser/chrome-extension/websocket-actor.ts",
    "src/lib/browser/transport/browser-authority-websocket.ts",
  ] as const;
  const sources = paths.map((path) => sourceAt(context, path));
  for (const [path, file] of paths.map((path, index) => [path, sources[index]] as const)) {
    if (!file) findings.push(finding(laws.terminal, path, "authenticated command diagnostic source is missing"));
  }
  const required = ["commandStage", "commandKind", "commandIntentKind", "capabilityId"];
  for (const [index, file] of sources.entries()) {
    if (!file) continue;
    const present = identifiers(file);
    const names = index === 0 ? ["extensionCommandDiagnostic", ...required] : required;
    for (const name of names) {
      if (!present.has(name)) findings.push(finding(laws.terminal, paths[index]!, `authenticated command failure diagnostic is missing: ${name}`));
    }
  }
  return paths;
};

const inspectDomainEvaluation = async (context: InspectorContext): Promise<Omit<InspectorOutput, "executedChecks">> => {
  const findings: InspectorFinding[] = [];
  const eventPath = "src/lib/runtime-logs/event-types.ts";
  const eventFile = sourceAt(context, eventPath);
  const browserLifecycleEvents = [
    "BROWSER_INFRASTRUCTURE_READY", "BROWSER_AUTH_WAITING_FOR_PAIRING",
    "BROWSER_AUTH_PAIRING_STARTED", "BROWSER_AUTH_PAIRING_COMPLETED", "BROWSER_AUTH_PAIRING_FAILED",
    "BROWSER_SOCKET_AUTHENTICATED", "BROWSER_LIVENESS_HEARTBEAT", "BROWSER_AUTH_REVOKED", "BROWSER_EXTENSION_FAILURE",
    "BROWSER_TARGET_CLAIMED", "BROWSER_TARGET_LEASE_INVALIDATED",
  ];
  const requiredEvents = [
    ...browserLifecycleEvents,
    "BROWSER_COMMAND_ADMISSION", "BROWSER_COMMAND_COMPLETED", "BROWSER_ARTIFACT_COMPLETED",
    "BROWSER_MUTATION_PREPARED", "BROWSER_OUTCOME_UNKNOWN", "SITE_INGRESS_AUTHENTICATED",
    "SITE_INGRESS_REPLAY_REJECTED", "SITE_CREDENTIAL_ROTATED", "SITE_CREDENTIAL_REVOKED",
  ];
  if (!eventFile) {
    findings.push(finding(laws.terminal, eventPath, "terminal event registry source is missing"));
  } else {
    const present = identifiers(eventFile);
    for (const name of requiredEvents) {
      if (!present.has(name)) findings.push(finding(laws.terminal, toRepoPath(eventFile.getFilePath()), `terminal Runtime Log event is absent: ${name}`));
    }
    if (!present.has("RuntimeLogEventType")) findings.push(finding(laws.singleSpine, eventPath, "the sole structured event registry is missing"));
  }

  const browserRuntimePath = "src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts";
  const browserRuntime = sourceAt(context, browserRuntimePath);
  if (!browserRuntime) {
    findings.push(finding(laws.terminal, browserRuntimePath, "Browser Authority runtime log producer is missing"));
  } else {
    const emitted = identifiers(browserRuntime);
    for (const name of browserLifecycleEvents) {
      if (!emitted.has(name)) findings.push(finding(laws.terminal, browserRuntimePath, `Browser Authority does not emit required Runtime Log event: ${name}`));
    }
  }

  const authenticatedCommandPaths = inspectAuthenticatedCommandDiagnostics(
    context,
    findings,
  );

  const runtimeRoot = "src/lib/runtime-logs";
  for (const file of context.project.getSourceFiles().filter((candidate) =>
    toRepoPath(candidate.getFilePath()).startsWith(`${runtimeRoot}/`))) {
    for (const symbol of ["console", "localStorage"]) {
      if (identifiers(file).has(symbol)) {
        findings.push(finding(laws.singleSpine, toRepoPath(file.getFilePath()), `Runtime Log Spine cannot own alternate output/truth symbol ${symbol}`));
      }
    }
  }

  const redactionPath = "src/lib/runtime-logs/redaction.ts";
  const redaction = sourceAt(context, redactionPath);
  if (!redaction) {
    findings.push(finding(laws.redaction, redactionPath, "redaction implementation is missing"));
  } else {
    const present = identifiers(redaction);
    for (const name of ["redactRuntimeLogRecord", "redactRuntimeLogEvent", "redactUrlForLog"]) {
      if (!present.has(name)) findings.push(finding(laws.redaction, toRepoPath(redaction.getFilePath()), `required redaction boundary is absent: ${name}`));
    }
  }

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [eventPath, browserRuntimePath, ...authenticatedCommandPaths, redactionPath, runtimeRoot],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("runtime-log-spine requires a runner-owned check session.");
  await context.checks.runAll(async () => {
    const evaluation = await inspectDomainEvaluation(context);
    return { findings: evaluation.findings, evidenceRefs: [context.planEntry.ownerInspectorPath, ...evaluation.inspectedFiles] };
  });
  return context.checks.output({ reportMarkdown: "# Runtime Log Spine terminal ownership\n\nOne runner-signed evaluation covers the event registry, sole logging boundary, and redaction entrypoints." });
};
