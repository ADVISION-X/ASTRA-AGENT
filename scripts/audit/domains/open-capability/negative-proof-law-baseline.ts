import { readFile } from "node:fs/promises";

import { pathFromRepoRoot } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";

import { openInspectionConstants as config } from "./inspection-constants.js";

const LAW_HEADER_PATTERN = /^## Law (GRASSEYE-[A-Z0-9-]+)$/gm;

const extractField = (block: string, fieldName: string): string | undefined => {
  const match = block.match(new RegExp(`^${fieldName}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim();
};

export async function collectOpenLawBaselineFindings(): Promise<Finding[]> {
  const content = await readFile(pathFromRepoRoot(config.FINAL_LAW_PATH), "utf8");
  const findings: Finding[] = [];
  const matches = Array.from(content.matchAll(LAW_HEADER_PATTERN));

  for (const [index, match] of matches.entries()) {
    const lawId = match[1];
    if (!lawId) {
      continue;
    }

    const blockStart = match.index ?? 0;
    const blockEnd = matches[index + 1]?.index ?? content.length;
    const block = content.slice(blockStart, blockEnd);
    if (extractField(block, "status") !== "active") {
      continue;
    }

    const tier = extractField(block, "tier");
    const enforcementMode = extractField(block, "enforcementMode");
    const evidenceMode = extractField(block, "evidenceMode");

    if (enforcementMode !== "machine-blocking") {
      findings.push({
        lawId,
        file: config.FINAL_LAW_PATH,
        line: 1,
        severity: "fatal",
        message: "Open active law must remain machine-blocking.",
      });
    }
    if (tier !== "P0") {
      findings.push({
        lawId,
        file: config.FINAL_LAW_PATH,
        line: 1,
        severity: "fatal",
        message: "Open active law must remain P0.",
      });
    }
    if (evidenceMode !== "law+inspector+negative-proof") {
      findings.push({
        lawId,
        file: config.FINAL_LAW_PATH,
        line: 1,
        severity: "fatal",
        message: "Open active law must require law+inspector+negative-proof evidence.",
      });
    }
  }

  return findings;
}