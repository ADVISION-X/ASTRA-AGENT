import { SyntaxKind, type SourceFile } from "ts-morph";

import { callPrecedes } from "./control-flow-reachability.js";

type Finding = { code: string; detail: string; path: string };

export const inspectCiPhaseIntegrity = (source: SourceFile): Finding[] => {
  const quality = source.getFunction("quality");
  const levels = new Set(quality?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue()) ?? []);
  const findings: Finding[] = [];
  for (const level of ["CHANGE", "READY", "RELEASE"]) {
    if (!levels.has(level)) {
      findings.push({ code: "AUDIT_DELIVERY_LEVEL_MISSING", detail: level, path: source.getFilePath() });
    }
  }
  if (!callPrecedes(quality, "releaseCandidateBinding", "releaseDynamicProofs")) {
    findings.push({ code: "AUDIT_RELEASE_BINDING_ORDER_INVALID", detail: "candidate binding must precede Dynamic Proof", path: source.getFilePath() });
  }
  if (!callPrecedes(quality, "writeReleaseReport", "writeReleasePackage")) {
    findings.push({ code: "AUDIT_RELEASE_PACKAGE_ORDER_INVALID", detail: "report must precede proof package", path: source.getFilePath() });
  }
  return findings;
};
