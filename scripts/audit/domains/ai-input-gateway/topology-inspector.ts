import type { SourceFile } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import {
  type AiInputGatewayFinding as Finding,
  identifiers,
  pushAiInputGatewayFinding as pushFinding,
  requireAiInputGatewaySource as requireSourceFile,
} from "./inspector-helpers.js";
import * as P from "./paths.js";

const requiredTopologyIdentifiers = [
  "providerForkRef",
  "conversationMode",
  "freshConversationProof",
  "sameConversationProof",
  "forkedFromCheckpointProof",
  "openGovernedForkFromCheckpoint",
  "parentCheckpointResponseHash",
  "forkActionEvidenceHash",
  "childInitialHistoryFingerprint",
  "parentConversationUrl",
  "childConversationUrl",
  "assertUnsupportedForkFailsClosed",
] as const;

const inspectRequiredTopology = (
  sources: readonly SourceFile[],
  findings: Finding[],
  lawId: string,
): void => {
  const all = new Set(sources.flatMap((source) => [...identifiers(source)]));
  for (const required of requiredTopologyIdentifiers) {
    if (!all.has(required)) {
      pushFinding(
        findings,
        lawId,
        P.runtime.forkPath,
        "ai-input-gateway/provider-conversation-topology",
        `Provider conversation topology must contain ${required}.`,
      );
    }
  }
};

const inspectForkBoundary = (
  fork: SourceFile,
  open: SourceFile,
  findings: Finding[],
  lawId: string,
): void => {
  if (!identifiers(open).has("openGovernedForkFromCheckpoint")) {
    pushFinding(
      findings,
      lawId,
      P.runtime.openPath,
      "ai-input-gateway/provider-conversation-topology",
      "The existing provider-open chain must own checkpoint fork dispatch.",
    );
  }
  const forbiddenOwners = ["plugins", "xuanxue", "bazi", "naming", "hehun"];
  const forbiddenImports = fork.getImportDeclarations()
    .map((declaration) => declaration.getModuleSpecifierValue())
    .filter((specifier) => forbiddenOwners.some((owner) => specifier.toLowerCase().includes(owner)));
  for (const specifier of forbiddenImports) {
    pushFinding(
      findings,
      lawId,
      P.runtime.forkPath,
      "ai-input-gateway/provider-conversation-topology",
      `Generic provider fork must not import business owner ${specifier}.`,
    );
  }
};

export const inspectConversationTopology = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const schema = requireSourceFile(context, findings, lawId, P.attachment.schemaPath);
  const fork = requireSourceFile(context, findings, lawId, P.runtime.forkPath);
  const open = requireSourceFile(context, findings, lawId, P.runtime.openPath);
  const proof = requireSourceFile(context, findings, lawId, P.runtime.providerProofPath);
  const real = requireSourceFile(context, findings, lawId, P.acceptance.realChromeForkAcceptancePath);
  if (!schema || !fork || !open || !proof || !real) return;
  inspectRequiredTopology([schema, fork, open, proof, real], findings, lawId);
  inspectForkBoundary(fork, open, findings, lawId);
};
