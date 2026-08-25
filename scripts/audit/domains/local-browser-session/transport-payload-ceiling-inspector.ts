import { readFileSync } from "node:fs";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";

const checkId = "browser-authority/terminal-authority";
const clauseId = "apex-local-browser-001-v4-single-unpacked-websocket";
const sourcePaths = [
  "src/lib/browser/transport/browser-authority-frame-codec.ts",
  "src/lib/browser/protocol/generated/browser-protocol.generated.ts",
] as const;
const forbiddenCeilingSymbols = [
  "MAX_SOCKET_FRAME_BYTES",
  "BROWSER_AUTHORITY_MAX_FRAME_BYTES",
  "BROWSER_CONTROL_FRAME_MAX_BYTES",
] as const;

const identifiers = (source: SourceFile): ReadonlySet<string> =>
  new Set(source.getDescendantsOfKind(SyntaxKind.Identifier)
    .map(astIdentifierName)
    .filter((name): name is string => name !== undefined));

export const collectTransportPayloadCeilingFindings = (
  context: InspectorContext,
  lawId: string,
): InspectorFinding[] => {
  const findings: InspectorFinding[] = [];
  for (const path of sourcePaths) {
    const source = context.project.getSourceFile(resolveFromRepo(path));
    if (!source) {
      findings.push(createFinding({ checkId, lawId, clauseId, filePath: path, message: "Browser transport ceiling inspection source is missing." }));
      continue;
    }
    const present = identifiers(source);
    const forbidden = forbiddenCeilingSymbols.filter((name) => present.has(name));
    if (forbidden.length > 0) {
      findings.push(createFinding({
        checkId,
        lawId,
        clauseId,
        filePath: toRepoPath(source.getFilePath()),
        message: `Browser transport must not restore prompt/control-message byte ceilings: ${forbidden.join(", ")}.`,
      }));
    }
  }
  const protocolPath = "src/lib/browser/protocol/browser-protocol.schema.json";
  const protocol = JSON.parse(readFileSync(resolveFromRepo(protocolPath), "utf8")) as {
    transport?: Readonly<Record<string, unknown>>;
  };
  if (protocol.transport && Object.hasOwn(protocol.transport, "controlFrameMaxBytes")) {
    findings.push(createFinding({
      checkId,
      lawId,
      clauseId,
      filePath: protocolPath,
      message: "Browser protocol source must not declare a prompt/control-message byte ceiling.",
    }));
  }
  return findings;
};
