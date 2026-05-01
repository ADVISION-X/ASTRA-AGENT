import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import { getNodeLine } from "../../../core/ts-morph.js";

const JSON_CONTRACT_FIELD_NAMES = new Set([
  "script",
  "scripts",
  "command",
  "commands",
  "shell",
  "exec",
  "execute",
  "runtime",
  "runtimeadapter",
  "promptscript",
  "taskscript",
]);

const isJsonContractFile = (relativePath: string): boolean =>
  (relativePath.endsWith(".json") || relativePath.endsWith(".jsonc"))
  && !relativePath.startsWith("scripts/audit/generated/")
  && !relativePath.endsWith(".generated.json")
  && !relativePath.endsWith(".generated.jsonc")
  && (relativePath.startsWith("src/map-plugins/") || relativePath.includes("/prompt-contracts/"));

export const inspectJsonContractPurity = (sourceFile: SourceFile, relativePath: string, findings: Finding[]): void => {
  if (!isJsonContractFile(relativePath)) {
    return;
  }

  for (const property of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
    const name = property.getName().replace(/^["']|["']$/g, "").toLowerCase();
    if (!JSON_CONTRACT_FIELD_NAMES.has(name)) {
      continue;
    }

    findings.push(
      createFinding({
        lawId: "GRASSEYE-CODE-PURITY-007-V1",
        file: relativePath,
        line: getNodeLine(property),
        severity: "error",
        message: `JSON contract must not contain runtime-like field ${name}.`,
      }),
    );
  }
};