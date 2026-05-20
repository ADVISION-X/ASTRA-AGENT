import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { writeGeneratedJson } from "./generated-artifact.js";
import { generatedHome, repoRoot } from "./path-roots.js";

const PROVENANCE_FILE = "audit-artifact-provenance.generated.json";

const sha256 = (data: string): string =>
  createHash("sha256").update(data, "utf8").digest("hex");

const collectGeneratedArtifactHashes = () =>
  readdirSync(generatedHome)
    .filter((fileName) => fileName.endsWith(".generated.json"))
    .filter((fileName) => fileName !== PROVENANCE_FILE)
    .sort()
    .map((fileName) => {
      const absolutePath = join(generatedHome, fileName);
      return {
        file: relative(repoRoot, absolutePath),
        sha256: sha256(readFileSync(absolutePath, "utf8")),
      };
    });

export const writeAuditArtifactProvenance = (): void => {
  writeGeneratedJson(PROVENANCE_FILE, {
    generatedBy: "scripts/audit/build-audit-artifacts.ts",
    artifacts: collectGeneratedArtifactHashes(),
  });
};
