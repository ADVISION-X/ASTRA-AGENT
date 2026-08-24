import { existsSync } from "node:fs";
import { SyntaxKind } from "ts-morph";

import { selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorFinding, type InspectorOutput, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { createFinding } from "../../shared/finding-utils.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { inspectForbiddenAppShellActions } from "./inspector-forbidden-actions.js";
import { inspectAppShellLayout } from "./inspector-layout.js";
import { inspectAppShellLocalization } from "./inspector-localization.js";
import { inspectLegacyAppUserDemandPhysicalAbsence } from "./inspector-retired-authority-absence.js";
import { inspectSkillRegistry } from "./inspector-skill-registry.js";

const lawPath = ".github/instructions/agent-rules/功能法案.md";
const realChromeProofPaths = [
  "scripts/acceptance/capture-app-shell-ui.real-chrome.ts",
  "scripts/acceptance/app-shell-real-chrome-proof-support.ts",
  "scripts/acceptance/app-shell-ui.real-chrome.ts",
] as const;

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
  if (!context.project.getSourceFile(resolveFromRepo("scripts/audit/domains/app-shell-ui/inspector.ts"))) {
    findings.push(createFinding({
      checkId: "app-shell-ui/inspector-project-access",
      lawId,
      filePath: "scripts/audit/domains/app-shell-ui/inspector.ts",
      message: "App Shell UI inspector must be visible to the ts-morph audit project.",
    }));
  }
};

const inspectRealChromePhysicalCleanup = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const sources = realChromeProofPaths.map((filePath) => {
    inspectedFiles.add(filePath);
    return context.project.getSourceFile(resolveFromRepo(filePath));
  });
  if (sources.some((source) => !source)) {
    findings.push(createFinding({
      checkId: "app-shell-ui/real-chrome-proof-route", lawId,
      filePath: realChromeProofPaths.find((_, index) => !sources[index]) ?? realChromeProofPaths[0],
      message: "The App Shell real-Chrome producer, byte validator and verifier must all exist.",
    }));
    return;
  }
  const identifiers = new Set(sources.flatMap((source) => source!
    .getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText())));
  const strings = new Set(sources.flatMap((source) => source!
    .getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText())));
  for (const required of [
    "chromium", "launch", "goto", "screenshot", "hashFile",
    "buildStartupSourceFingerprint", "currentAppShellProofContractHash",
    "validateAppShellRealChromeProofAt", "healthResponse", "sourceFingerprint",
  ]) if (!identifiers.has(required)) findings.push(createFinding({
    checkId: "app-shell-ui/real-chrome-proof-route", lawId, filePath: realChromeProofPaths[0],
    message: `The real-Chrome producer/verifier route is missing ${required}.`,
  }));
  for (const selector of [
    "[data-app-shell]", "[data-app-shell-sidebar]", "main[data-app-shell-workspace]",
    "[data-app-shell-inspector]", "[data-runtime-console]",
    "[data-user-demand-startup], [data-legacy-app]", "用户需求启动",
  ]) if (!strings.has(selector)) findings.push(createFinding({
    checkId: "app-shell-ui/real-chrome-proof-route", lawId, filePath: realChromeProofPaths[0],
    message: `The real-Chrome producer must observe exact exclusive selector ${selector}.`,
  }));
};



const inspectDomainEvaluation = async (context: InspectorContext): Promise<Omit<InspectorOutput, "executedChecks">> => {
  const lawId = selectLawId(context.planEntry.lawIds, "LAW-APP-SHELL-UI-001-V2");
  const findings: InspectorFinding[] = [];
  const inspectedFiles = new Set<string>([
    lawPath,
    "scripts/audit/domains/app-shell-ui/inspector.ts",
    "scripts/audit/domains/app-shell-ui/inspector-layout.ts",
    "scripts/audit/domains/app-shell-ui/inspector-localization.ts",
    "scripts/audit/domains/app-shell-ui/inspector-retired-authority-absence.ts",
    "scripts/audit/domains/app-shell-ui/inspector-skill-registry.ts",
    "scripts/audit/domains/app-shell-ui/inspector-forbidden-actions.ts",
  ]);

  inspectAuthorityFiles(context, findings, lawId);
  inspectAppShellLocalization(context, findings, inspectedFiles, selectLawId(context.planEntry.lawIds, "LAW-APP-SHELL-UI-002-V1"));
  inspectSkillRegistry(context, findings, inspectedFiles, lawId);
  inspectAppShellLayout(context, findings, inspectedFiles, lawId);
  inspectForbiddenAppShellActions(context, findings, inspectedFiles, lawId);
  inspectLegacyAppUserDemandPhysicalAbsence(context, findings, inspectedFiles);
  inspectRealChromePhysicalCleanup(
    context,
    findings,
    inspectedFiles,
    selectLawId(context.planEntry.lawIds, "LAW-APP-SHELL-UI-003-V1"),
  );

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,

    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("app-shell-ui requires a runner-owned check session.");
  let reportJson: unknown;
  let reportMarkdown: string | undefined;
  await context.checks.runAll(async () => {
    const evaluation = await inspectDomainEvaluation(context);
    reportJson = evaluation.reportJson;
    reportMarkdown = evaluation.reportMarkdown;
    return {
      findings: evaluation.findings,
      evidenceRefs: [context.planEntry.ownerInspectorPath, ...evaluation.inspectedFiles],
    };
  });
  return context.checks.output({
    ...(reportJson === undefined ? {} : { reportJson }),
    ...(reportMarkdown === undefined ? {} : { reportMarkdown }),
  });
};
