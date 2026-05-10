import { SyntaxKind } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getAuditProject, getSourceFileOrThrow, toRelativeSourcePath } from "../../core/ts-morph.js";

const TARGET_PATH = "src/lib/local-app-shell/task-start-visual-mission-binding.ts";
const TASK_START_FLOW_PATH = "src/lib/local-app-shell/task-start-flow.ts";
const RUNTIME_ENVELOPE_PATH = "src/visual-mission/runtime-envelope.ts";

const createLocalShellFinding = (file: string, message: string): Finding => createFinding({
  lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1",
  file,
  line: 1,
  severity: "fatal",
  message,
});

const collectBindingAuthorityFindings = (input: {
  source: ReturnType<typeof getSourceFileOrThrow>;
  taskStartFlowSource: ReturnType<typeof getSourceFileOrThrow>;
  runtimeEnvelopeSource: ReturnType<typeof getSourceFileOrThrow>;
}): Finding[] => {
  const findings: Finding[] = [];
  const importSpecifiers = input.source.getImportDeclarations().map((declaration) => declaration.getModuleSpecifierValue());
  const runtimeEnvelopeImport = input.source.getImportDeclaration((declaration) => declaration.getModuleSpecifierValue() === "../../visual-mission/runtime-envelope.js");
  const importsCompatibilityEnvelopeBuilder = runtimeEnvelopeImport?.getNamedImports().some((specifier) => specifier.getName() === "buildVisualMissionRuntimeCompatibilityEnvelope") ?? false;
  const startBindingFunction = input.source.getFunction("resolveVisualMissionStartBinding");
  const usesCompatibilityEnvelopeBuilder = startBindingFunction?.getDescendantsOfKind(SyntaxKind.CallExpression).some((expression) => expression.getExpression().getText() === "buildVisualMissionRuntimeCompatibilityEnvelope") ?? false;
  const runtimeCompatibilityBuilder = input.runtimeEnvelopeSource.getVariableDeclaration("buildVisualMissionRuntimeCompatibilityEnvelope")
    ?? input.runtimeEnvelopeSource.getFunction("buildVisualMissionRuntimeCompatibilityEnvelope")
    ?? null;
  const runtimeCompatibilityText = runtimeCompatibilityBuilder?.getText() ?? "";

  if (importSpecifiers.includes("../../map-plugins/registry/local-app-shell-map-registry.js")) {
    findings.push(createLocalShellFinding(toRelativeSourcePath(input.source), "Visual mission start binding must not import the retired local app shell map registry authority."));
  }
  if (!importSpecifiers.includes("../../visual-mission/platform-target-registry.js") || !importSpecifiers.includes("../../visual-mission/runtime-envelope.js") || !importsCompatibilityEnvelopeBuilder) {
    findings.push(createLocalShellFinding(toRelativeSourcePath(input.source), "Visual mission start binding must resolve governed platform targets and synthetic runtime compatibility envelope fields from the visual-mission owner modules."));
  }
  if (!usesCompatibilityEnvelopeBuilder || !runtimeCompatibilityText.includes("selectedMapId: VISUAL_MISSION_RUNTIME_ENVELOPE_MAP_ID")) {
    findings.push(createLocalShellFinding(toRelativeSourcePath(input.source), "Visual mission start binding must freeze the synthetic runtime compatibility envelope map id through the visual-mission runtime-envelope builder instead of querying retired map authority."));
  }
  if (!input.taskStartFlowSource.getFullText().includes("selectedMapId: approval.binding.selectedMapId")) {
    findings.push(createLocalShellFinding(toRelativeSourcePath(input.taskStartFlowSource), "Visual mission start flow must forward the synthetic compatibility selectedMapId into the governed start-mission command instead of dropping it after binding."));
  }

  return findings;
};

export const inspectVisualMissionNoRetiredMapAuthority = (): Finding[] => {
  const project = getAuditProject();
  const source = getSourceFileOrThrow(project, TARGET_PATH);
  const taskStartFlowSource = getSourceFileOrThrow(project, TASK_START_FLOW_PATH);
  const runtimeEnvelopeSource = getSourceFileOrThrow(project, RUNTIME_ENVELOPE_PATH);
  return collectBindingAuthorityFindings({ source, taskStartFlowSource, runtimeEnvelopeSource });
};