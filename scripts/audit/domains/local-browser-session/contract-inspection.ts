import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";

const sourceAt = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFiles().find((source) => getRepoSourcePath(source) === repoPath);
const ordered = (values: readonly string[]): string[] => [...new Set(values)].sort();
const typeFields = (source: SourceFile, typeName: string): string[] => ordered(source.getTypeAlias(typeName)
  ?.getDescendantsOfKind(SyntaxKind.PropertySignature).map((property) => property.getName()) ?? []);
const finding = (lawId: string, filePath: string, message: string): InspectorFinding => createFinding({
  evidenceMode: "static.contract", checkId: "local-browser/contract-shape", lawId,
  clauseId: `${lawId.toLowerCase()}-contract`, filePath, message,
});
const requireExactType = (input: {
  context: InspectorContext;
  expected: readonly string[];
  filePath: string;
  findings: InspectorFinding[];
  lawId: string;
  typeName: string;
}): void => {
  const source = sourceAt(input.context, input.filePath);
  if (!source) {
    input.findings.push(finding(input.lawId, input.filePath, `${input.typeName} contract source is missing.`));
    return;
  }
  const actual = typeFields(source, input.typeName);
  if (JSON.stringify(actual) !== JSON.stringify(ordered(input.expected))) input.findings.push(finding(
    input.lawId, input.filePath, `${input.typeName} must expose exactly ${ordered(input.expected).join(", ")}.`,
  ));
};

export const inspectSessionCoreContract = (
  context: InspectorContext, findings: InspectorFinding[], lawId: string,
): void => {
  requireExactType({ context, findings, lawId,
    filePath: "src/lib/browser/transport/browser-authority-frame-codec.ts", typeName: "BrowserAuthorityFrame",
    expected: ["body", "deadline", "epoch", "kind", "protocolVersion", "sequence"] });
  requireExactType({ context, findings, lawId,
    filePath: "src/lib/browser/transport/browser-authority-websocket.ts", typeName: "BrowserAuthorityReady",
    expected: ["authorityEpoch", "authorityRef", "certificateHash", "channelSessionHash", "commandPermitKey"] });
};

export const inspectAuthenticatedChannelContract = (
  context: InspectorContext, findings: InspectorFinding[], lawId: string,
): void => {
  requireExactType({ context, findings, lawId,
    filePath: "src/lib/browser/chrome-extension/pairing-auto-bootstrap.ts", typeName: "WorkbenchPairingState",
    expected: ["authority", "pairingSecret", "releaseBuildId"] });
  requireExactType({ context, findings, lawId,
    filePath: "src/lib/browser/transport/browser-authority-session-crypto.ts", typeName: "BrowserAuthorityPairingHello",
    expected: ["clientEcdhPublicKey", "clientSigningPublicJwk", "deadline", "extensionId", "extensionVersion", "releaseBuildId"] });
};

export const inspectTargetClaimContract = (
  context: InspectorContext, findings: InspectorFinding[], lawId: string,
): void => {
  requireExactType({ context, findings, lawId,
    filePath: "src/lib/browser/transport/browser-authority-websocket.ts", typeName: "BrowserAuthorityTargetClaim",
    expected: ["documentRef", "navigationEpoch", "targetRef", "url"] });
  requireExactType({ context, findings, lawId,
    filePath: "src/lib/browser/exact-target/browser-session-workspace.ts", typeName: "SessionWorkspaceBindingV6",
    expected: ["authorityEpoch", "authorityRef", "connectionGeneration", "directoryHash", "establishedAt",
      "extensionId", "profileHash", "releaseBuildId", "schemaVersion", "sitePolicyHash", "workspaceRef"] });
};

export const inspectReleaseIdentityContract = (
  context: InspectorContext, findings: InspectorFinding[], lawId: string,
): void => {
  requireExactType({ context, findings, lawId,
    filePath: "src/lib/browser/release/unpacked-extension-release-identity.ts", typeName: "UnpackedExtensionReleaseIdentity",
    expected: ["createdAt", "extensionDirectoryHashV1", "extensionId", "manifestHash", "protocolHash",
      "releaseBuildId", "schemaVersion", "sitePolicyHash", "version"] });
};

export const inspectOpaqueAuthorityContract = (
  context: InspectorContext, findings: InspectorFinding[], lawId: string,
): void => {
  const filePath = "src/lib/browser/infrastructure/browser-authority-certificate.ts";
  const source = sourceAt(context, filePath);
  if (!source) {
    findings.push(finding(lawId, filePath, "BrowserAuthorityCertificateV1 contract source is missing."));
    return;
  }
  const fields = typeFields(source, "BrowserAuthorityCertificateV1");
  const forbidden = new Set(["cookie", "cookies", "token", "password", "pairingSecret", "html", "pageContent",
    "filePath", "profilePath", "targetId", "tabId"]);
  const leaked = fields.find((field) => forbidden.has(field));
  if (leaked) findings.push(finding(lawId, filePath,
    `BrowserAuthorityCertificateV1 leaks non-opaque field ${leaked}.`));
  for (const required of ["authorityRef", "channelSessionHash", "profileEnrollmentHash", "originPolicyHash",
    "permissionPolicyHash", "issuerMac"]) if (!fields.includes(required)) findings.push(finding(
      lawId, filePath, `BrowserAuthorityCertificateV1 is missing opaque binding ${required}.`,
    ));
};
