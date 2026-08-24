import type { SourceFile } from "ts-morph";

import { inspectCiPhaseIntegrity } from "./ci-phase-integrity-inspector.js";

type Finding = { code: string; detail: string; path: string };

export const inspectCiPhaseIntegrityEntry = (source: SourceFile): Finding[] => {
  const findings = inspectCiPhaseIntegrity(source);
  const main = source.getFunction("main");
  const quality = source.getFunction("quality");
  if (!main || !quality) findings.push({ code: "AUDIT_CANONICAL_ENTRY_MISSING", detail: "main/quality", path: source.getFilePath() });
  return findings;
};
