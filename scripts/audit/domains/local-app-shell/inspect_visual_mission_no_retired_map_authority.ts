import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getAuditProject, getSourceFileOrThrow, toRelativeSourcePath } from "../../core/ts-morph.js";

const TARGET_PATH = "src/lib/local-app-shell/task-start-visual-mission-binding.ts";

export const inspectVisualMissionNoRetiredMapAuthority = (): Finding[] => {
  const project = getAuditProject();
  const source = getSourceFileOrThrow(project, TARGET_PATH);
  const text = source.getFullText();
  const findings: Finding[] = [];
  const importSpecifiers = source.getImportDeclarations().map((declaration) => declaration.getModuleSpecifierValue());

  if (importSpecifiers.includes("../../map-plugins/registry/local-app-shell-map-registry.js")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1",
      file: toRelativeSourcePath(source),
      line: 1,
      severity: "fatal",
      message: "Visual mission start binding must not import the retired local app shell map registry authority.",
    }));
  }
  if (!importSpecifiers.includes("../../visual-mission/platform-target-registry.js") || !importSpecifiers.includes("../../visual-mission/runtime-envelope.js")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1",
      file: toRelativeSourcePath(source),
      line: 1,
      severity: "fatal",
      message: "Visual mission start binding must resolve governed platform targets and runtime envelope fields from the visual-mission owner modules.",
    }));
  }
  if (!text.includes("selectedMapId: VISUAL_MISSION_RUNTIME_ENVELOPE_MAP_ID")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1",
      file: toRelativeSourcePath(source),
      line: 1,
      severity: "fatal",
      message: "Visual mission start binding must freeze the synthetic runtime envelope map id instead of querying retired map authority at binding time.",
    }));
  }

  return findings;
};