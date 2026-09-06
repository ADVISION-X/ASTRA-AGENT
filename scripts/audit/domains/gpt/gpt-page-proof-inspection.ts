import { resolve } from "node:path";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const LAW_ID = "LAW-GPT-001-V31";
const ROOT = "src/capabilities/gpt";
const OBSERVATION_PATH = `${ROOT}/web/gpt-dom-observation.ts`;
const LEGACY_FACT_READERS = new Set([
  "findCount", "readExactAttribute", "readExactCanonicalPromptText", "readExactObservedResponse",
  "readExactSemanticText", "readExactText",
]);

const sourceFor = (context: InspectorContext, path: string): SourceFile | undefined =>
  context.project.getSourceFile(resolve(context.sealedRoot, path));

const repoPath = (context: InspectorContext, source: SourceFile): string =>
  source.getFilePath().slice(resolve(context.sealedRoot).length + 1).split("\\").join("/");

const addFinding = (
  findings: InspectorFinding[],
  checkId: string,
  filePath: string,
  message: string,
  line?: number,
): void => {
  findings.push(createFinding({
    evidenceMode: "static.ast",
    lawId: LAW_ID,
    clauseId: `${LAW_ID.toLowerCase()}-requirement`,
    checkId,
    filePath,
    message,
    ...(line === undefined ? {} : { line }),
  }));
};

export const inspectGptCurrentPageProofs = (
  context: InspectorContext,
  findings: InspectorFinding[],
): void => {
  const pageHandlers = context.project.getSourceFiles().filter((source) => {
    const path = repoPath(context, source);
    return path.startsWith(`${ROOT}/web/children/`)
      && source.getVariableDeclarations().some((declaration) => declaration.getName().endsWith("ChildHandlers"));
  });
  for (const source of pageHandlers) {
    const path = repoPath(context, source);
    const nullRevision = source.getDescendantsOfKind(SyntaxKind.PropertyAssignment).find((property) =>
      property.getName() === "observationRevisionHash" && property.getInitializer()?.getText() === "null");
    if (nullRevision) addFinding(findings, "gpt/page-proof-current-revision", path,
      "Production-reachable page Child success still permits a null Browser observation revision.",
      nullRevision.getStartLineNumber());
    const legacyCall = source.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) =>
      LEGACY_FACT_READERS.has(call.getExpression().getText()));
    if (legacyCall) addFinding(findings, "gpt/page-proof-coherent-packet", path,
      `Page Child still constructs qualification or success from legacy reader ${legacyCall.getExpression().getText()}.`,
      legacyCall.getStartLineNumber());
  }
  const observationSource = sourceFor(context, OBSERVATION_PATH);
  const observationText = observationSource?.getFullText() ?? "";
  const observationPacket = observationSource?.getTypeAlias("GptCoherentObservation")?.getFullText() ?? "";
  const packetFields = ["exactCallIdentityHash", "targetRefHash", "documentRefHash", "currentUrl", "observationRevisionHash"];
  const decoderProofs = ['packet.schemaVersion !== "grasseye.browser.dom-observation.v2"',
    "typeof packet.currentUrl", "packet.observationRevisionHash", "currentUrl: packet.currentUrl"];
  if (!packetFields.every((field) => observationPacket.includes(field))
    || !decoderProofs.every((proof) => observationText.includes(proof))
    || ["claimOrigin", "rawDomHtml", "semanticText"].some((field) => observationPacket.includes(field))) {
    addFinding(findings, "gpt/browser-coherent-document-url-handoff", OBSERVATION_PATH,
      "GPT coherent observation must consume the revision-bound current URL without claim or raw reply content.");
  }
  for (const required of ["GptExactAssistantTurnObservation", "readExactAssistantTurn",
    'kind: "readExactAssistantTurn"', "rawDomHtml", "rawDomHash", "semanticText", "semanticTextHash"]) {
    if (!observationText.includes(required)) addFinding(findings,
      "gpt/browser-exact-assistant-reply-channel", OBSERVATION_PATH,
      `GPT must consume the exact assistant reply-only channel; missing ${required}.`);
  }
};
