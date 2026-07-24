import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { inspectDomain } from "../audit/domains/constitutional-boundary/inspector.js";
import { createAuditProject } from "../audit/shared/project.js";
import { resolveFromRepo } from "../audit/shared/paths.js";

const fixtureMarker = "__constitutional_boundary_acceptance__";
const fixtureRoots = [
  `src/plugins/${fixtureMarker}`,
  `src/capabilities/${fixtureMarker}-video-download`,
] as const;
const capabilityVideoRoot = `src/capabilities/${fixtureMarker}-video-download`;
const pluginRoot = `src/plugins/${fixtureMarker}`;

const LAW_IDS = [
  "APEX-CONSTITUTIONAL-BOUNDARY-001-V1",
  "APEX-CAPABILITY-FACADE-SYMBOL-001-V1",
  "APEX-PLUGIN-NO-CAPABILITY-PROTOCOL-001-V1",
  "APEX-DOM-AUTOMATION-BRIDGE-001-V1",
] as const;

const writeFixtureFile = (repoPath: string, content: string): void => {
  const absolutePath = resolveFromRepo(repoPath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
};

const createFixtureTree = (): void => {
  writeFixtureFile(`${capabilityVideoRoot}/index.ts`, `export type { HiddenProtocol } from "./runtime/private-protocol.js";\nexport { createVideoDownloadThing } from "./ability-group.js";\n`);
  writeFixtureFile(`${capabilityVideoRoot}/runtime/private-protocol.ts`, `export type HiddenProtocol = { childCapabilityId: string };\n`);
  writeFixtureFile(`${capabilityVideoRoot}/ability-group.ts`, `export const createVideoDownloadThing = () => "ok";\n`);
  writeFixtureFile(`${capabilityVideoRoot}/children/private-child.ts`, `export const privateChild = () => "private";\n`);
  writeFixtureFile(`${pluginRoot}/direct-private-import.ts`, `import { privateChild } from "../../capabilities/${fixtureMarker}-video-download/children/private-child.js";\nexport const usePrivateChild = () => privateChild();\n`);
  writeFixtureFile(`${pluginRoot}/facade-type-escape.ts`, `import type { HiddenProtocol } from "../../capabilities/${fixtureMarker}-video-download/index.js";\nexport const useHidden = (input: HiddenProtocol): string => input.childCapabilityId;\n`);
  writeFixtureFile(`${pluginRoot}/dom-alias-import.ts`, `import { clickDomElementOnce as safeClick } from "../../capabilities/dom-automation/index.js";\nexport const useSafeClick = () => safeClick();\n`);
  writeFixtureFile(`${pluginRoot}/protocol-leak.ts`, `export const buildRequest = () => ({\n  abilityGroupId: "video-download",\n  childCapabilityId: "download-facebook-video-once",\n  capabilityCallId: "fixture-call",\n  sourcePageUrl: "https://example.com/video",\n  missionId: "mission",\n  runId: "run"\n});\n`);
  writeFixtureFile(`${pluginRoot}/clean-consumer.ts`, `import { createVideoDownloadThing } from "../../capabilities/${fixtureMarker}-video-download/index.js";\nexport const useFacade = () => createVideoDownloadThing();\n`);
};

const removeFixtureTree = (): void => {
  for (const fixtureRoot of fixtureRoots) {
    rmSync(resolveFromRepo(fixtureRoot), { force: true, recursive: true });
  }
};

const getFixtureFindings = async () => {
  const project = createAuditProject();
  const result = await inspectDomain({
    completedReports: {},
    generatedPlan: [],
    planEntry: {
      capabilityDomain: "constitutional-boundary",
      manifestPath: "scripts/audit/domains/constitutional-boundary/manifest.json",
      ownerInspectorPath: "scripts/audit/domains/constitutional-boundary/inspector.ts",
      executionGroup: "foundation",
      bindings: LAW_IDS.map((lawId) => ({
        lawId,
        clauseId: `${lawId.toLowerCase()}-fixture-requirement`,
        evidenceMode: "static",
        checkIds: ["fixture/check"],
        sourceEvidence: [{
          filePath: "scripts/audit/domains/constitutional-boundary/inspector.ts",
          symbolName: "inspectDomain",
        }],
      })),
      lawIds: [...LAW_IDS],
      blueprintRefs: [],
    },
    project,
  });
  return result.findings.filter((finding) => finding.filePath?.includes(fixtureMarker));
};

const hasFinding = (input: {
  findings: Awaited<ReturnType<typeof getFixtureFindings>>;
  checkId: string;
  filePathIncludes: string;
}): boolean => input.findings.some((finding) => finding.checkId === input.checkId && Boolean(finding.filePath?.includes(input.filePathIncludes)));

createFixtureTree();

try {
  const findings = await getFixtureFindings();

  assert.equal(hasFinding({
    findings,
    checkId: "constitutional-boundary/external-private-import",
    filePathIncludes: "/direct-private-import.ts",
  }), true, "direct private import fixture should fail");

  assert.equal(hasFinding({
    findings,
    checkId: "constitutional-boundary/facade-private-symbol-export",
    filePathIncludes: `${fixtureMarker}-video-download/index.ts`,
  }), true, "facade private symbol export fixture should fail");

  assert.equal(hasFinding({
    findings,
    checkId: "constitutional-boundary/facade-private-symbol-import",
    filePathIncludes: "/facade-type-escape.ts",
  }), true, "type-only private symbol import fixture should fail");

  assert.equal(hasFinding({
    findings,
    checkId: "constitutional-boundary/dom-primitive-import",
    filePathIncludes: "/dom-alias-import.ts",
  }), true, "aliased DOM primitive import fixture should fail");

  assert.equal(hasFinding({
    findings,
    checkId: "constitutional-boundary/private-capability-protocol",
    filePathIncludes: "/protocol-leak.ts",
  }), true, "protocol leak fixture should fail");

  assert.equal(findings.some((finding) => Boolean(finding.filePath?.includes("/clean-consumer.ts"))), false, "clean consumer fixture should pass");

  process.stdout.write("constitutional-boundary-anti-escape-acceptance-ok\n");
} finally {
  removeFixtureTree();
}
