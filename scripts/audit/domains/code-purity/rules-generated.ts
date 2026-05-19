import { execFileSync } from "node:child_process";

import type { PurityFinding } from "./types.js";

const GENERATED_PATHS = [
  "scripts/audit/generated",
  "src/muscle-memory/generated-catalog.json",
] as const;

const readGeneratedStatus = (): string[] => {
  try {
    const output = execFileSync("git", ["status", "--porcelain", ...GENERATED_PATHS], {
      encoding: "utf8",
    });
    return output.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
};

export const collectGeneratedEditFindings = (): PurityFinding[] =>
  readGeneratedStatus().map((line) => {
    const file = line.slice(3).trim();
    return {
      rule: "CP-AST-017",
      file,
      line: 1,
      message: "manual generated edit is forbidden; regenerate through governed generator path",
    };
  });
