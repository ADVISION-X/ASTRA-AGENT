import { existsSync } from "node:fs";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";
import {
  authorityPaths,
  cloudContractPath,
  removedSecondChainPaths,
} from "../inspector-paths.js";

const finding = (
  lawId: string,
  checkId: string,
  filePath: string,
  message: string,
): InspectorFinding => createFinding({ lawId, checkId, filePath, message });

const sourceContainsDetachedProviderPreflightMarker = (
  sourceFile: SourceFile,
): boolean => {
  const markers = [
    "provider-input-preflight",
    "provider_input_preflight",
    "preflightApprovedWebChatFiles",
    "bytes_base64",
  ];
  const values = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
      .map((node) => String(node.compilerNode.escapedText)),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral)
      .map((node) => node.getLiteralText()),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)
      .map((node) => node.getLiteralText()),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateHead)
      .map((node) => node.getLiteralText()),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateMiddle)
      .map((node) => node.getLiteralText()),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateTail)
      .map((node) => node.getLiteralText()),
  ];
  return markers.some((marker) => values.some((value) => value.indexOf(marker) >= 0));
};

const inspectAuthority = (
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const filePath of authorityPaths) {
    if (existsSync(resolveFromRepo(filePath))) continue;
    findings.push(finding(
      lawId,
      "xuanxue-ai-production/source-present",
      filePath,
      `${filePath} must exist.`,
    ));
  }
};

const inspectRemovedSecondChain = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const filePath of removedSecondChainPaths) {
    if (!existsSync(resolveFromRepo(filePath))) continue;
    findings.push(finding(
      lawId,
      "xuanxue-ai-production/no-detached-provider-preflight",
      filePath,
      `${filePath} must remain physically deleted.`,
    ));
  }
  for (const filePath of [
    "src/app/workbench-xuanxue-ai-production-routes.ts",
    "src/app/workbench-api-boundary.ts",
    "src/app/create-workbench-server.ts",
    "src/capabilities/ai-input-gateway/contract.ts",
    "src/capabilities/ai-input-gateway/ability-group.ts",
    cloudContractPath,
  ]) {
    const file = resolveFromRepo(filePath);
    if (!existsSync(file)) continue;
    const sourceFile = context.project.getSourceFile(file);
    if (!sourceFile || !sourceContainsDetachedProviderPreflightMarker(sourceFile)) continue;
    findings.push(finding(
      lawId,
      "xuanxue-ai-production/no-detached-provider-preflight",
      filePath,
      `${filePath} must not retain the detached provider preflight chain.`,
    ));
  }
};

export const inspectXuanxueBoundary = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  inspectAuthority(findings, lawId);
  inspectRemovedSecondChain(context, findings, lawId);
};
