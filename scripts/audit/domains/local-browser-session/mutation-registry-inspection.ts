import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { createLocalFinding, extensionFileInputPath, identifiers, requireSource,
  sourcePaths, stringLiterals, targetAuthorityPath } from "./inspector-support.js";

type RegistryMutationSources = Readonly<Record<
  "actor" | "broker" | "commandActor" | "domRuntime" | "fileInput" | "manager" | "mutationStore" | "registry" | "runtimeExecutor" | "targetAuthority",
  SourceFile
>>;

const requireRegistryMutationSources = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): RegistryMutationSources | null => {
  const paths = [sourcePaths[1], targetAuthorityPath, extensionFileInputPath, sourcePaths[8],
    sourcePaths[6], sourcePaths[7], sourcePaths[5], sourcePaths[18], sourcePaths[19],
    "src/lib/local-runtime/production/executor.ts"];
  const sources = paths.map((path) => requireSource(context, findings, lawId, path));
  if (sources.some((source) => source === null)) return null;
  const [actor, targetAuthority, fileInput, registry, commandActor, mutationStore, manager, broker,
    domRuntime, runtimeExecutor] = sources.map((source) => source!) as [
      SourceFile, SourceFile, SourceFile, SourceFile, SourceFile,
      SourceFile, SourceFile, SourceFile, SourceFile, SourceFile,
    ];
  return { actor, targetAuthority, fileInput, registry, commandActor, mutationStore, manager,
    broker, domRuntime, runtimeExecutor };
};

const inspectExtensionExecutionBoundary = (
  sources: RegistryMutationSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const actorStrings = new Set([
    ...stringLiterals(sources.actor), ...stringLiterals(sources.targetAuthority),
    ...stringLiterals(sources.fileInput),
  ]);
  if (!actorStrings.has("DOM.setFileInputFiles") || !actorStrings.has("#upload-files")) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority",
      lawId,
      filePath: extensionFileInputPath,
      message: "The extension file-input command must use one observed #upload-files target and DOM.setFileInputFiles.",
    }));
  }
  if (identifiers(sources.domRuntime).has("DOMParser")) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority",
      lawId,
      filePath: sourcePaths[19],
      message: "The DOM intent executor must use the deterministic CDP node tree and cannot retain DOMParser.",
    }));
  }
  const forbiddenExecutors = new Set(["eval", "Function", "executeScript"]);
  const forbidden = sources.actor.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
    const expression = call.getExpression();
    const name = Node.isIdentifier(expression) ? astIdentifierName(expression) : undefined;
    return name !== undefined && forbiddenExecutors.has(name);
  });
  if (forbidden) findings.push(createLocalFinding({
    checkId: "browser-authority/terminal-authority",
    lawId,
    filePath: sourcePaths[1],
    line: forbidden.getStartLineNumber(),
    message: "The fixed extension command actor must not execute arbitrary code.",
  }));
};

const registryMutationIdentifiers = (sources: RegistryMutationSources): Set<string> => new Set([
  ...identifiers(sources.actor),
  ...identifiers(sources.targetAuthority),
  ...identifiers(sources.registry),
  ...identifiers(sources.commandActor),
  ...identifiers(sources.mutationStore),
  ...identifiers(sources.manager),
  ...identifiers(sources.broker),
  ...identifiers(sources.runtimeExecutor),
]);

const inspectRegistryRequirements = (
  allIdentifiers: ReadonlySet<string>,
  mutationLiterals: readonly string[],
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const required of [
    "admitExtensionCommand", "executeRegisteredCommand", "BrowserMutationStore", "requestHash",
    "payloadHash", "proofHash", "exactCallIdentityHash", "pluginVersion", "terminalAt",
    "readExactCallMutationFact", "logicalMutationId", "productStepId", "callId", "childCapabilityId",
    "inputHash", "effectScope", "actionOrdinal", "positivePostconditionHash",
    "negativePostconditionHash", "PREPARED", "DISPATCHED", "REJECTED",
    "BrowserExecutionArtifactBinding", "bindExecutionArtifacts", "resolveBoundArtifact",
    "hashBrowserAuthorityCertificate", "authorityRefHash", "certificateHash",
    "issueFileArtifactGrant", "resolveGrantPaths", "resolvedFilePaths",
  ]) {
    if (!allIdentifiers.has(required) && !mutationLiterals.includes(required)) {
      findings.push(createLocalFinding({
        checkId: "browser-authority/terminal-authority",
        lawId,
        filePath: sourcePaths[7],
        message: `The registry/mutation chain must contain ${required}.`,
      }));
    }
  }
};

const inspectArtifactBindingBoundary = (
  sources: RegistryMutationSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const runtimeBindingConsumer = sources.runtimeExecutor.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => call.getExpression().getText() === "this.browserAuthority.bindExecutionArtifacts"
      && call.getText().includes("localPath: material.local_path"));
  if (!runtimeBindingConsumer) findings.push(createLocalFinding({
    checkId: "browser-authority/execution-artifact-binding",
    lawId,
    filePath: "src/lib/local-runtime/production/executor.ts",
    message: "Runtime production execution must bind each task-local material through the Browser public execution-scoped facade.",
  }));
  const brokerIdentifiers = identifiers(sources.broker);
  for (const forbidden of ["BrowserArtifactRegistry", "copyFile", "rename"]) {
    if (!brokerIdentifiers.has(forbidden)) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/execution-artifact-binding",
      lawId,
      filePath: sourcePaths[18],
      message: `Browser must not retain private artifact persistence/copy primitive ${forbidden}.`,
    }));
  }
};

const inspectRetiredRegistryTokens = (
  allIdentifiers: ReadonlySet<string>,
  mutationLiterals: readonly string[],
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const retiredIdentifiers = ["markSent", "markUnknown", "unknownForBinding", "readUnknown"];
  const retiredLiterals = ["SENT", "UNKNOWN", "BROWSER_OUTCOME_UNKNOWN"];
  for (const retired of [...retiredIdentifiers.filter((name) => allIdentifiers.has(name)),
    ...retiredLiterals.filter((value) => mutationLiterals.includes(value))]) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/retired-mutation-chain",
      lawId,
      filePath: sourcePaths[7],
      message: `The retired Browser mutation token ${retired} must be physically absent.`,
    }));
  }
};

export const inspectRegistryAndMutationBoundary = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const sources = requireRegistryMutationSources(context, findings, lawId);
  if (!sources) return;
  const allIdentifiers = registryMutationIdentifiers(sources);
  const mutationLiterals = stringLiterals(sources.mutationStore);
  inspectRegistryRequirements(allIdentifiers, mutationLiterals, findings, lawId);
  inspectArtifactBindingBoundary(sources, findings, lawId);
  inspectRetiredRegistryTokens(allIdentifiers, mutationLiterals, findings, lawId);
  inspectExtensionExecutionBoundary(sources, findings, lawId);
};
