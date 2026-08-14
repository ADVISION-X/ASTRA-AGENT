import assert from "node:assert/strict";

import { Project } from "ts-morph";

import { inspectOwnerFilesystemWriters } from "../audit/domains/audit-system/owner-filesystem-mutation-inspector.js";
import { loadGeneratedAuditPlan } from "../audit/core/load-audit-plan.js";
import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
import type { InspectorContext, InspectorFinding } from "../audit/shared/inspector-contracts.js";
import { resolveFromRepo } from "../audit/shared/paths.js";

const project = new Project({ tsConfigFilePath: resolveFromRepo("tsconfig.json") });

const buildContext = (): InspectorContext => {
  const generatedPlan = loadGeneratedAuditPlan();
  const planEntry = generatedPlan.find((entry) => entry.capabilityDomain === "audit-system");
  if (!planEntry) throw new Error("audit-system plan entry is missing.");
  return {
    checks: createInspectorCheckSession(planEntry, "acceptance-run:audit-owner-filesystem").checks,
    completedReports: {}, generatedPlan, planEntry, project,
  };
};

const hasWriterFinding = (fixturePath?: string): boolean => {
  const findings: InspectorFinding[] = [];
  inspectOwnerFilesystemWriters(buildContext(), findings, new Set<string>(), "APEX-AUDIT-006-V1");
  return fixturePath === undefined ? findings.length > 0 : findings.some((finding) => finding.filePath === fixturePath);
};

const attacks = [
  'import { copyFile } from "node:fs"; copyFile("a", "b", () => {});',
  'import * as fs from "node:fs"; fs.cpSync("a", "b");',
  'import { createWriteStream } from "fs"; createWriteStream("a");',
  'import { truncate } from "node:fs/promises"; await truncate("a", 0);',
  'import * as fs from "node:fs"; const { link } = fs; link("a", "b", () => {});',
  'import * as fs from "node:fs"; const consume = (value: unknown) => value; consume(fs.symlink);',
  'import * as fs from "node:fs"; const persist = fs.copyFileSync.bind(fs); persist("a", "b");',
] as const;

export const runOwnerFilesystemMutationAttacks = (): void => {
  assert.equal(hasWriterFinding(), false, "canonical owner inspectors must remain read-only.");
  for (const [index, sourceText] of attacks.entries()) {
    const fixturePath = resolveFromRepo(`scripts/audit/domains/writer-escape/default-deny-${index}.fixture.ts`);
    const fixture = project.createSourceFile(fixturePath, sourceText, { overwrite: true });
    assert.equal(hasWriterFinding(fixturePath), true,
      `owner filesystem mutation attack ${index} must fail closed outside the proven read-only API set.`);
    fixture.forget();
  }
};
