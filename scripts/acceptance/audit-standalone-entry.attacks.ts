import assert from "node:assert/strict";

import type { Project } from "ts-morph";

import { inspectRetiredEnforcementSurfaces } from "../audit/domains/audit-system/physical-check-receipt-inspector.js";
import type { InspectorContext } from "../audit/shared/inspector-contracts.js";
import { resolveFromRepo } from "../audit/shared/paths.js";

export const assertStandaloneAuditEntrypointRejected = (
  project: Project,
  buildContext: (project: Project) => InspectorContext,
): void => {
  const fixturePath = resolveFromRepo("scripts/audit/build/standalone-entry-attack.fixture.ts");
  project.getSourceFile(fixturePath)?.forget();
  project.createSourceFile(
    fixturePath,
    "const isEntrypoint = () => true; if (isEntrypoint()) process.stdout.write('PASS');",
    { overwrite: true },
  );
  const result = inspectRetiredEnforcementSurfaces(buildContext(project), "APEX-AUDIT-009-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/runner-order-truth"
    && finding.filePath?.endsWith("standalone-entry-attack.fixture.ts")), true,
  "audit governance must reject standalone self-executing entries under scripts/audit.");

  const inlineFixturePath = resolveFromRepo(
    "scripts/audit/build/standalone-inline-entry-attack.fixture.ts",
  );
  project.getSourceFile(inlineFixturePath)?.forget();
  project.createSourceFile(
    inlineFixturePath,
    "if (import.meta.url === `file://${process.argv[1]}`) process.stdout.write('PASS');",
    { overwrite: true },
  );
  const inlineResult = inspectRetiredEnforcementSurfaces(
    buildContext(project),
    "APEX-AUDIT-009-V1",
  );
  assert.equal(inlineResult.findings.some((finding) =>
    finding.checkId === "audit-system/runner-order-truth"
    && finding.filePath?.endsWith("standalone-inline-entry-attack.fixture.ts")), true,
  "audit governance must reject inline import.meta/process.argv entrypoints.");
};
