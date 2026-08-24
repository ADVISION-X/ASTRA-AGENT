import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { rejectDuplicateJsonKeys } from "../audit/governance.js";

assert.doesNotThrow(() => rejectDuplicateJsonKeys('{"lawId":"LAW-DEMO-001-V1","forbidden":["不得放行"]}', "valid"));
assert.throws(() => rejectDuplicateJsonKeys('{"lawId":"LAW-DEMO-001-V1","lawId":"LAW-DEMO-002-V1"}', "duplicate"), /duplicate JSON key lawId/u);
assert.throws(() => rejectDuplicateJsonKeys('{"lawId":"LAW-DEMO-001-V1"} trailing', "trailing"), /JSON trailing/u);

const fixture = (): string => {
  const root = mkdtempSync(join(tmpdir(), "audit-law-parser-"));
  symlinkSync(resolve("node_modules"), join(root, "node_modules"), "dir");
  for (const source of [
    "AGENTS.md", "package.json", "tsconfig.json",
    ".github/instructions/agent-rules/基础法案.md",
    ".github/instructions/agent-rules/功能法案.md",
    "docs/governance", "docs/blueprints", "docs/specs",
    "scripts/audit/domains", "scripts/audit/generated",
    "scripts/exam", "tests/governance/binding-negative-cases.test.ts",
    "scripts/audit/governance-authority.ts", "scripts/audit/governance-json.ts",
    "scripts/audit/governance-quality.ts", "scripts/audit/governance-runtime.ts", "scripts/audit/governance.ts",
  ]) {
    const target = join(root, source);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true });
  }
  return root;
};
const mustReject = (mutate: (root: string) => void, code: string): void => {
  const root = fixture();
  try {
    mutate(root);
    assert.throws(
      () => execFileSync(process.execPath, ["--import", "tsx", "scripts/audit/governance.ts", "build"], { cwd: root, stdio: "pipe" }),
      (error: unknown) => String((error as { stderr?: Buffer }).stderr).includes(code),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

mustReject((root) => {
  const path = join(root, ".github/instructions/agent-rules/基础法案.md");
  const source = readFileSync(path, "utf8");
  const last = source.match(/### \[LAW-PROJECT-GOVERNANCE-008-V2\][\s\S]+?```law-record\n[\s\S]+?\n```/u)?.[0];
  assert.ok(last);
  writeFileSync(path, `${source.trimEnd()}\n\n${last.replaceAll("008", "009")}\n`);
}, "SOURCE_PARSE_FAILED base root laws");

mustReject((root) => {
  const path = join(root, ".github/instructions/agent-rules/功能法案.md");
  writeFileSync(path, readFileSync(path, "utf8").replace('  "tier": "P0"', '  "unknownField": true,\n  "tier": "P0"'));
}, "SOURCE_PARSE_FAILED LAW-AI-INPUT-GATEWAY-001-V1 schema");

mustReject((root) => {
  const path = join(root, "docs/specs/project-governance/deadline-mutant.spec.json");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({
    schemaVersion: 1,
    specId: "project-governance.deadline-mutant",
    status: "active",
    version: 1,
    owner: "project-governance",
    lawIds: ["LAW-PROJECT-GOVERNANCE-001-V2"],
    specKind: "migration",
    contract: {
      currentAuthority: "legacy-owner",
      targetAuthority: "project-governance",
      compatibilityMechanisms: ["temporary-route"],
      startDate: "2026-01-01",
      monitoring: ["route-traffic"],
      rollbackCondition: "integrity failure",
      maximumDurationDays: 7,
      removalDate: "2026-01-09",
      removalAcceptance: ["route absent"],
    },
  }, null, 2)}\n`);
}, "SOURCE_PARSE_FAILED docs/specs/project-governance/deadline-mutant.spec.json migration deadline");

console.log("audit-law-parser-acceptance-ok");
