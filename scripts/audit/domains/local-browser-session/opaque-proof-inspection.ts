import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { createLocalFinding, identifiers, requireIdentifiers, requireSource, sourcePaths, targetAuthorityPath } from "./inspector-support.js";

export const inspectOpaqueAuthorityBoundary = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const transport = requireSource(context, findings, lawId, sourcePaths[0]);
  const journal = requireSource(context, findings, lawId, sourcePaths[7]);
  const broker = requireSource(context, findings, lawId, sourcePaths[18]);
  const supervisor = requireSource(context, findings, lawId, sourcePaths[3]);
  const targetAuthority = requireSource(context, findings, lawId, targetAuthorityPath);
  const leaseManager = requireSource(context, findings, lawId, sourcePaths[5]);
  if (!transport || !journal || !broker || !supervisor || !targetAuthority || !leaseManager) return;
  requireIdentifiers(broker, ["authorityRefHash", "certificateHash", "channelSessionHash", "artifactRef", "contentHash"], findings, lawId,
    "Public Browser authority and artifact status must expose opaque references and hashes.");
  requireIdentifiers(journal, ["payloadHash", "proofHash", "targetRef", "documentRef"], findings, lawId,
    "Durable Browser proof must retain opaque references and content hashes instead of raw page or filesystem payloads.");
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
  const targetMethod = targetAuthority.getClass("ExtensionTargetAuthority")
    ?.getMethod("executeAuthenticatedMedia")?.getText() ?? "";
  const leaseMethod = leaseManager.getClass("BrowserTargetLeaseManager")
    ?.getMethod("downloadAuthenticatedMedia")?.getText() ?? "";
  for (const required of [
    "Runtime.evaluate", "credentials: \"include\"", "crypto.subtle.digest", "bytesBase64",
    "gpt-generated-image-main", "assistantTurnId",
  ]) if (!targetMethod.includes(required)) findings.push(createLocalFinding({
    checkId: "browser-authority/authenticated-media-boundary",
    lawId,
    filePath: targetAuthorityPath,
    message: `The fixed authenticated media observation is missing ${required}.`,
  }));
  for (const required of [
    "browser.authenticated-media.v1", "assistantTurnId", "semanticMediaId", "createHash",
  ]) if (!leaseMethod.includes(required)) findings.push(createLocalFinding({
    checkId: "browser-authority/authenticated-media-boundary",
    lawId,
    filePath: sourcePaths[5],
    message: `The task-owned authenticated media receiver is missing ${required}.`,
  }));
  for (const forbidden of ["resourceUrl", "sourceUrl", "cookie", "token", "selector:"]) {
    if (targetMethod.includes(forbidden) || leaseMethod.includes(forbidden)) findings.push(createLocalFinding({
      checkId: "browser-authority/authenticated-media-boundary",
      lawId,
      filePath: targetAuthorityPath,
      message: `Authenticated media retrieval exposes forbidden caller control ${forbidden}.`,
    }));
  }
};
