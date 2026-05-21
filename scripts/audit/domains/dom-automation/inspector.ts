import { existsSync, readFileSync } from "node:fs";
import { Node } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../shared/source-files.js";

const domRoot = "src/capabilities/dom-automation/";
const domPublicFacade = "src/capabilities/dom-automation/index.ts";
const plannerNames = new Set(["nextAction", "actionPlan"]);
const requiredChildAbilities = [
  "read-dom-snapshot-once",
  "locate-dom-element-once",
  "fill-dom-element-once",
  "click-dom-element-once",
  "upload-approved-file-once",
  "wait-for-dom-state-once",
  "verify-dom-state-once",
  "scroll-to-element-once",
  "select-option-once",
  "dismiss-overlay-once",
] as const;

const requiredRuntimeFiles = [
  "src/capabilities/dom-automation/runtime/dom-scroll.ts",
  "src/capabilities/dom-automation/runtime/dom-select.ts",
  "src/capabilities/dom-automation/runtime/dom-dismiss-overlay.ts",
] as const;

const readRepoFile = (repoPath: string): string => readFileSync(repoPath, "utf8");

const findPlannerToken = (sourceFile: Parameters<typeof getRepoSourcePath>[0]): string | undefined => {
  const plannerNode = sourceFile.getDescendants().find((node) => {
    if (Node.isIdentifier(node)) {
      return plannerNames.has(node.getText());
    }
    if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
      return plannerNames.has(node.getLiteralValue());
    }
    return false;
  });
  return plannerNode?.getText();
};

const pushMissingTextFinding = (
  findings: InspectorOutput["findings"],
  input: { lawId: string; filePath: string; checkId: string; text: string; message: string },
): void => {
  if (readRepoFile(input.filePath).includes(input.text)) return;
  findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.filePath,
    evidence: input.text,
    message: input.message,
  }));
};

const inspectDomStaticContracts = (findings: InspectorOutput["findings"], lawIds: readonly string[]): void => {
  const childListLawId = selectLawId(lawIds, "APEX-DOM-013-V1");
  const schemaPath = "src/capabilities/dom-automation/schema.ts";
  const facadePath = "src/capabilities/dom-automation/index.ts";
  for (const childAbility of requiredChildAbilities) {
    pushMissingTextFinding(findings, {
      lawId: childListLawId,
      filePath: schemaPath,
      checkId: "dom/schema-child-ability-list",
      text: childAbility,
      message: `DOM schema does not declare legal child ability ${childAbility}.`,
    });
  }
  for (const runtimeFile of requiredRuntimeFiles) {
    if (existsSync(runtimeFile)) continue;
    findings.push(createFinding({
      checkId: "dom/runtime-file-exists",
      lawId: childListLawId,
      filePath: runtimeFile,
      message: `Required DOM runtime file ${runtimeFile} is missing.`,
    }));
  }
  for (const exportName of ["scrollToElementOnce", "selectOptionOnce", "dismissOverlayOnce"]) {
    pushMissingTextFinding(findings, {
      lawId: childListLawId,
      filePath: facadePath,
      checkId: "dom/public-facade-child-export",
      text: exportName,
      message: `DOM public facade does not export ${exportName}.`,
    });
  }
};

const inspectRuntimeGuards = (findings: InspectorOutput["findings"], lawIds: readonly string[]): void => {
  pushMissingTextFinding(findings, {
    lawId: selectLawId(lawIds, "APEX-DOM-004-V1"),
    filePath: "src/capabilities/dom-automation/schema.ts",
    checkId: "dom/snapshot-production-fields",
    text: "dropdownTriggers",
    message: "DOM snapshot schema must include production dropdown trigger fields.",
  });
  pushMissingTextFinding(findings, {
    lawId: selectLawId(lawIds, "APEX-DOM-003-V1"),
    filePath: "src/capabilities/dom-automation/runtime/dom-locator.ts",
    checkId: "dom/structured-locate-result",
    text: "locateDomElementResultOnce",
    message: "DOM locator must expose structured locate result for normal uncertainty.",
  });
  pushMissingTextFinding(findings, {
    lawId: selectLawId(lawIds, "APEX-DOM-014-V1"),
    filePath: "src/capabilities/dom-automation/runtime/dom-scroll.ts",
    checkId: "dom/scroll-budget",
    text: "maxSteps",
    message: "DOM scroll must include a bounded scroll budget.",
  });
  pushMissingTextFinding(findings, {
    lawId: selectLawId(lawIds, "APEX-DOM-015-V1"),
    filePath: "src/capabilities/dom-automation/runtime/dom-select.ts",
    checkId: "dom/select-native-and-custom",
    text: "selection-not-reflected",
    message: "DOM select must verify reflected selected value.",
  });
  pushMissingTextFinding(findings, {
    lawId: selectLawId(lawIds, "APEX-DOM-016-V1"),
    filePath: "src/capabilities/dom-automation/runtime/dom-dismiss-overlay.ts",
    checkId: "dom/dismiss-safe-allowlist",
    text: "SAFE_OVERLAY_TYPES",
    message: "DOM overlay dismissal must use a safe type allowlist.",
  });
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawId = selectLawId(context.planEntry.lawIds, "APEX-DOM-001-V1");
  const findings: InspectorFinding[] = [];
  const inspectedFiles = new Set<string>();

  inspectDomStaticContracts(findings, context.planEntry.lawIds);
  inspectRuntimeGuards(findings, context.planEntry.lawIds);

  for (const sourceFile of listActiveSourceFiles(context.project)) {
    const repoPath = getRepoSourcePath(sourceFile);
    inspectedFiles.add(repoPath);

    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const target = importDeclaration.getModuleSpecifierSourceFile();
      if (!target) {
        continue;
      }
      const targetPath = getRepoSourcePath(target);
      if (!targetPath.startsWith(domRoot)) {
        continue;
      }

      if (!repoPath.startsWith(domRoot) && targetPath !== domPublicFacade) {
        findings.push(
          createFinding({
            checkId: "dom/public-facade-only",
            lawId,
            filePath: repoPath,
            evidence: targetPath,
            message: `${repoPath} imports private DOM automation file ${targetPath}.`,
          }),
        );
      }
    }

    if (!repoPath.startsWith(domRoot)) {
      continue;
    }

    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const target = importDeclaration.getModuleSpecifierSourceFile();
      if (!target) {
        continue;
      }
      const targetPath = getRepoSourcePath(target);
      if (!targetPath.startsWith("src/plugins/") && !targetPath.startsWith("src/capabilities/ai-input-gateway/")) {
        continue;
      }
      findings.push(
        createFinding({
          checkId: "dom/business-neutrality",
          lawId,
          filePath: repoPath,
          evidence: targetPath,
          message: `${repoPath} imports business or AI owner code ${targetPath}.`,
        }),
      );
    }

    const plannerToken = findPlannerToken(sourceFile);
    if (plannerToken) {
      findings.push(
        createFinding({
          checkId: "dom/planner-ban",
          lawId,
          filePath: repoPath,
          message: `${repoPath} contains planner token ${plannerToken}.`,
        }),
      );
    }
  }

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};
