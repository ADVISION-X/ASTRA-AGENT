import { existsSync } from "node:fs";

import { selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorFinding, type InspectorOutput, executedChecksForPlan } from "../../shared/inspector-contracts.js";
import { createFinding } from "../../shared/finding-utils.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { inspectForbiddenAppShellActions } from "./inspector-forbidden-actions.js";
import { inspectAppShellLayout } from "./inspector-layout.js";
import { inspectAppShellLocalization } from "./inspector-localization.js";
import { inspectLegacyAppUserDemandPhysicalAbsence } from "./inspector-retired-authority-absence.js";
import { inspectSkillRegistry } from "./inspector-skill-registry.js";

const lawPath = ".github/instructions/agent-rules/modules/module-app-shell-ui.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye App Shell UI 施工图.md";

const inspectAuthorityFiles = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  if (!existsSync(resolveFromRepo(lawPath))) {
    findings.push(createFinding({
      checkId: "app-shell-ui/law-file",
      lawId,
      filePath: lawPath,
      message: "App Shell UI law file must exist.",
    }));
  }
  if (!existsSync(resolveFromRepo(blueprintPath))) {
    findings.push(createFinding({
      checkId: "app-shell-ui/blueprint-file",
      lawId,
      filePath: blueprintPath,
      message: "App Shell UI blueprint file must exist.",
    }));
  }
  if (!context.project.getSourceFile(resolveFromRepo("scripts/audit/domains/app-shell-ui/inspector.ts"))) {
    findings.push(createFinding({
      checkId: "app-shell-ui/inspector-project-access",
      lawId,
      filePath: "scripts/audit/domains/app-shell-ui/inspector.ts",
      message: "App Shell UI inspector must be visible to the ts-morph audit project.",
    }));
  }
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-APP-SHELL-UI-001-V1");
  const findings: InspectorFinding[] = [];
  const inspectedFiles = new Set<string>([
    lawPath,
    blueprintPath,
    "scripts/audit/domains/app-shell-ui/inspector.ts",
    "scripts/audit/domains/app-shell-ui/inspector-layout.ts",
    "scripts/audit/domains/app-shell-ui/inspector-localization.ts",
    "scripts/audit/domains/app-shell-ui/inspector-retired-authority-absence.ts",
    "scripts/audit/domains/app-shell-ui/inspector-skill-registry.ts",
    "scripts/audit/domains/app-shell-ui/inspector-forbidden-actions.ts",
  ]);

  inspectAuthorityFiles(context, findings, lawId);
  inspectAppShellLocalization(context, findings, inspectedFiles, selectLawId(context.planEntry.lawIds, "GRASSEYE-APP-SHELL-UI-002-V1"));
  inspectSkillRegistry(context, findings, inspectedFiles, lawId);
  inspectAppShellLayout(context, findings, inspectedFiles, lawId);
  inspectForbiddenAppShellActions(context, findings, inspectedFiles, lawId);
  inspectLegacyAppUserDemandPhysicalAbsence(context, findings, inspectedFiles);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
      executedChecks: executedChecksForPlan(context),
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};
