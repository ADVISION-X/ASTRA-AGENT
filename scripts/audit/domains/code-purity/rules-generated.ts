import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "../../core/path-roots.js";
import type { PurityFinding } from "./types.js";

const PROVENANCE_PATH = "scripts/audit/generated/audit-artifact-provenance.generated.json";
const MUSCLE_MEMORY_GENERATED_PATH = "src/muscle-memory/generated-catalog.json";

type GeneratedArtifactProvenance = {
  artifacts?: Array<{ file?: string; sha256?: string }>;
};

const sha256 = (data: string): string =>
  createHash("sha256").update(data, "utf8").digest("hex");

const finding = (file: string, message: string): PurityFinding => ({
  rule: "CP-AST-017",
  file,
  line: 1,
  message,
});

const readGeneratedStatus = (): string[] => {
  try {
    const output = execFileSync("git", ["status", "--porcelain", MUSCLE_MEMORY_GENERATED_PATH], {
      encoding: "utf8",
    });
    return output.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
};

const readProvenance = (): GeneratedArtifactProvenance | null => {
  const absolutePath = join(repoRoot, PROVENANCE_PATH);
  if (!existsSync(absolutePath)) return null;
  return JSON.parse(readFileSync(absolutePath, "utf8")) as GeneratedArtifactProvenance;
};

const validateAuditGeneratedProvenance = (): PurityFinding[] => {
  const provenance = readProvenance();
  if (!provenance) {
    return [finding(PROVENANCE_PATH, "generated artifact provenance is missing; run audit:build through CI-FULL.")];
  }

  return (provenance.artifacts ?? []).flatMap((artifact) => {
    if (!artifact.file || !artifact.sha256) {
      return [finding(PROVENANCE_PATH, "generated artifact provenance entry is incomplete.")];
    }
    const absolutePath = join(repoRoot, artifact.file);
    if (!artifact.file.startsWith("scripts/audit/generated/") || !existsSync(absolutePath)) {
      return [finding(artifact.file, "generated artifact provenance references an invalid artifact.")];
    }
    const actualHash = sha256(readFileSync(absolutePath, "utf8"));
    return actualHash === artifact.sha256
      ? []
      : [finding(artifact.file, "generated artifact content does not match audit-build provenance.")];
  });
};

export const collectGeneratedEditFindings = (): PurityFinding[] =>
  [
    ...validateAuditGeneratedProvenance(),
    ...readGeneratedStatus().map((line) => {
      const file = line.slice(3).trim();
      return finding(file, "manual generated edit is forbidden; regenerate through governed generator path");
    }),
  ];
