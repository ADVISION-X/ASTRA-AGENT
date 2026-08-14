import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { parseApexLaws } from "../audit/build/parse-apex-laws.js";

const root = await mkdtemp(path.join(tmpdir(), "grasseye-law-parser-"));
try {
  const validPath = path.join(root, "valid.instructions.md");
  const prosePath = path.join(root, "prose.instructions.md");
  const wrongFencePath = path.join(root, "wrong-fence.instructions.md");
  const unclosedPath = path.join(root, "unclosed.instructions.md");
  const metadata = JSON.stringify({
    lawId: "APEX-AUDIT-PARSER-FIXTURE-001-V1",
    status: "active",
    tier: "P0",
    capabilityDomain: "audit-system",
    enforcementMode: "meta",
    evidenceMode: "static",
    summary: "fixture",
    clauses: [{
      clauseId: "apex-audit-parser-fixture-001-requirement",
      statement: "fixture",
      evidenceMode: "static",
      ownerDomain: "audit-system",
    }],
  }, null, 2);
  await writeFile(validPath, `\`\`\`md\nwrapped example\n\`\`\`apex-law\n${metadata}\n\`\`\`\n`, "utf8");
  await writeFile(prosePath, "# Active prose law\nstatus: active\n## Law APEX-AUDIT-PROSE-001-V1\n", "utf8");
  await writeFile(wrongFencePath, `\`\`\`law\n${metadata}\n\`\`\`\n`, "utf8");
  await writeFile(unclosedPath, `\`\`\`apex-law\n${metadata}\n`, "utf8");

  const valid = parseApexLaws([validPath]);
  assert.equal(valid.conflicts.length, 0, "nested documentation fences must not hide a valid apex-law block");
  assert.equal(valid.laws[0]?.lawId, "APEX-AUDIT-PARSER-FIXTURE-001-V1");
  assert.equal(parseApexLaws([prosePath]).conflicts.length > 0, true,
    "prose-only active laws must fail closed");
  assert.equal(parseApexLaws([wrongFencePath]).conflicts.length > 0, true,
    "active law metadata in a legacy law fence must fail closed");
  assert.equal(parseApexLaws([unclosedPath]).conflicts.length > 0, true,
    "unclosed apex-law metadata must fail closed");
  const hardBoundMetadata = JSON.stringify({ ...JSON.parse(metadata), ownerInspectorPath: "scripts/audit/domains/audit-system/inspector.ts" }, null, 2);
  await writeFile(wrongFencePath, `\`\`\`apex-law\n${hardBoundMetadata}\n\`\`\`\n`, "utf8");
  assert.equal(parseApexLaws([wrongFencePath]).conflicts.length > 0, true,
    "law metadata that hard-binds an inspector must fail closed");
  const disguisedHardBoundMetadata = JSON.stringify({
    ...JSON.parse(metadata),
    implementation: { entryPath: "scripts/audit/domains/audit-system/inspector.ts" },
  }, null, 2);
  await writeFile(wrongFencePath, `\`\`\`apex-law\n${disguisedHardBoundMetadata}\n\`\`\`\n`, "utf8");
  assert.equal(parseApexLaws([wrongFencePath]).conflicts.length > 0, true,
    "law extension metadata must not disguise an inspector filename under a generic field");
  const canonicalHardBoundMetadata = JSON.parse(metadata) as {
    summary: string;
    clauses: Array<{ statement: string }>;
  };
  canonicalHardBoundMetadata.summary = "Bind scripts/audit/domains/audit-system/inspector.ts directly.";
  canonicalHardBoundMetadata.clauses[0]!.statement = "Use scripts/audit/domains/audit-system/inspector.ts.";
  await writeFile(wrongFencePath, `\`\`\`apex-law\n${JSON.stringify(canonicalHardBoundMetadata)}\n\`\`\`\n`, "utf8");
  assert.equal(parseApexLaws([wrongFencePath]).conflicts.length > 0, true,
    "canonical law summary and clause statements must not hide inspector filenames");
  const crossDomainMetadata = JSON.parse(metadata) as { clauses: Array<{ ownerDomain: string }> };
  crossDomainMetadata.clauses[0]!.ownerDomain = "other-domain";
  await writeFile(wrongFencePath, `\`\`\`apex-law\n${JSON.stringify(crossDomainMetadata)}\n\`\`\`\n`, "utf8");
  assert.equal(parseApexLaws([wrongFencePath]).conflicts.length > 0, true,
    "a law clause spanning a second capability domain must fail closed");
} finally {
  await rm(root, { recursive: true, force: true });
}

process.stdout.write("audit-law-parser-acceptance-ok\n");
