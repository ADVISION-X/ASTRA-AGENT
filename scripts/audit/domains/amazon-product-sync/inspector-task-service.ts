import { Node, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";

import { requiredDiagnosticRefs, taskServicePath } from "./inspector-constants.js";

const hasIdentifier = (sourceFile: SourceFile | undefined, name: string): boolean =>
  Boolean(sourceFile?.getDescendants().some((node) => Node.isIdentifier(node) && node.getText() === name));

const hasStringToken = (sourceFile: SourceFile | undefined, value: string): boolean =>
  Boolean(sourceFile?.getDescendants().some((node) =>
    ((Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) && node.getLiteralText().includes(value))
    || (Node.isTemplateExpression(node) && (
      node.getHead().getLiteralText().includes(value)
      || node.getTemplateSpans().some((span) => span.getLiteral().getLiteralText().includes(value))
    )),
  ));

const addFinding = (findings: InspectorFinding[], lawId: string, message: string): void => {
  findings.push(createFinding({ checkId: "amazon-product-sync/contract", filePath: taskServicePath, lawId, message }));
};

const inspectTimeout = (taskService: SourceFile | undefined, taskConfig: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  for (const required of ["flowTimeoutMs", "resolveFlowTimeoutMs", "amazon_product_sync_flow_timeout_after_"]) {
    if (!hasIdentifier(taskService, required) && !hasStringToken(taskService, required) && !hasStringToken(taskConfig, required)) addFinding(findings, lawId, `task service missing bounded terminal timeout token: ${required}`);
  }
};

const inspectProgress = (taskService: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  for (const required of ["AmazonProductSyncFlowProgress", "persistProgress", "latestProgress"]) {
    if (!hasIdentifier(taskService, required)) addFinding(findings, lawId, `task service must persist observable running progress: ${required}`);
  }
};

const inspectStaleProgress = (taskService: SourceFile | undefined, taskConfig: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  for (const required of ["startupProgressStaleMs", "activeProgressStaleMs", "resolveRunningProgressStaleMs", "runningProgressStaleReason", "flow_progress_stale"]) {
    if (!hasIdentifier(taskService, required) && !hasStringToken(taskService, required) && !hasIdentifier(taskConfig, required) && !hasStringToken(taskConfig, required)) addFinding(findings, lawId, `task service must fail stale running progress: ${required}`);
  }
};

const inspectStartup = (taskService: SourceFile | undefined, taskConfig: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  for (const required of ["startupProgressWaitMs", "waitForStartupProgress", "firstProgressReady"]) {
    if (!hasIdentifier(taskService, required) && !hasStringToken(taskService, required) && !hasIdentifier(taskConfig, required)) addFinding(findings, lawId, `task service must return only after observable startup progress or bounded startup wait: ${required}`);
  }
};

const inspectDiagnostics = (taskService: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  for (const required of ["diagnosticValue", "itemAuthGate", "resolveFailureClass", "ACCOUNT_SECURITY_BLOCKER", ...requiredDiagnosticRefs]) {
    if (!hasIdentifier(taskService, required) && !hasStringToken(taskService, required)) addFinding(findings, lawId, `task service missing auth/page diagnostic log token: ${required}`);
  }
};

export const inspectTaskService = (taskService: SourceFile | undefined, taskConfig: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  inspectTimeout(taskService, taskConfig, findings, lawId);
  inspectProgress(taskService, findings, lawId);
  inspectStaleProgress(taskService, taskConfig, findings, lawId);
  inspectStartup(taskService, taskConfig, findings, lawId);
  inspectDiagnostics(taskService, findings, lawId);
};
