import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { createLocalFinding, identifiers, requireIdentifiers, requireSource, sourcePaths } from "./inspector-support.js";

export const inspectOpaqueAuthorityBoundary = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const transport = requireSource(context, findings, lawId, sourcePaths[0]);
  const journal = requireSource(context, findings, lawId, sourcePaths[7]);
  const broker = requireSource(context, findings, lawId, sourcePaths[18]);
  const supervisor = requireSource(context, findings, lawId, sourcePaths[3]);
  if (!transport || !journal || !broker || !supervisor) return;
  requireIdentifiers(broker, ["authorityRefHash", "certificateHash", "channelSessionHash", "artifactRef", "contentHash"], findings, lawId,
    "Public Browser authority and artifact status must expose opaque references and hashes.");
  requireIdentifiers(journal, ["payloadHash", "resultHash", "artifactRefs", "targetRef", "documentRef"], findings, lawId,
    "Durable Browser proof must retain opaque references and content hashes instead of raw page or filesystem payloads.");
  requireIdentifiers(supervisor, ["authorityRefHash"], findings, lawId,
    "Runtime diagnostics must expose only the hashed Browser authority reference.");
  const forbiddenRawFields = new Set([
    "targetId", "documentId", "filePath", "filePaths", "resolvedPath", "sourcePath", "rawPath",
    "pageContent", "outerHTML", "innerHTML", "cookie", "cookies", "credential", "credentials", "password", "authorization",
  ]);
  for (const [repoPath, source] of [
    [sourcePaths[0], transport],
    [sourcePaths[7], journal],
    [sourcePaths[3], supervisor],
  ] as const) {
    const leaked = [...identifiers(source)].find((name) => forbiddenRawFields.has(name));
    if (leaked) findings.push(createLocalFinding({
      checkId: "browser-authority/opaque-proof-boundary",
      lawId,
      filePath: repoPath,
      message: `Browser wire, durable proof and diagnostics must not expose raw authority/page/path field ${leaked}.`,
    }));
  }
};
