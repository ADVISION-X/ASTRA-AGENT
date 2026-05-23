import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const hasIdentifier = (node: Node, identifierName: string): boolean =>
  node.getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => identifier.getText() === identifierName);

const hasOverviewPropertySignature = (sourceFile: SourceFile): boolean => {
  const timelineType = sourceFile.getTypeAlias("DeepResearchTimelineSnapshot");
  const typeNode = timelineType?.getTypeNode();
  if (!typeNode || !Node.isTypeLiteral(typeNode)) return false;
  return typeNode.getMembers().some((member) =>
    Node.isPropertySignature(member)
    && member.getName() === "overview",
  );
};

const hasTimelineSnapshotBuilder = (sourceFile: SourceFile): boolean => {
  const declaration = sourceFile.getVariableDeclaration("buildTimelineSnapshot");
  const initializer = declaration?.getInitializer();
  if (!initializer || !Node.isArrowFunction(initializer)) return false;
  const hasSnapshotCall = initializer.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => call.getExpression().getText() === "buildJobSnapshot");
  const requiredIdentifiers = ["timeline", "subQuestions", "answers", "exports"] as const;
  return hasSnapshotCall && requiredIdentifiers.every((identifier) => hasIdentifier(initializer, identifier));
};

export const inspectPublicTimelineDelivery = (input: {
  publicFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  if (!input.publicFile) return;
  const repoPath = getRepoSourcePath(input.publicFile);
  input.inspectedFiles.add(repoPath);
  if (!hasOverviewPropertySignature(input.publicFile)) {
    input.findings.push(createFinding({
      checkId: "deep-research/public-timeline-overview-type",
      lawId: input.lawId,
      filePath: repoPath,
      message: "DeepResearchTimelineSnapshot must expose overview for completed delivery counts.",
    }));
  }
  if (!hasTimelineSnapshotBuilder(input.publicFile)) {
    input.findings.push(createFinding({
      checkId: "deep-research/public-timeline-overview-builder",
      lawId: input.lawId,
      filePath: repoPath,
      message: "buildTimelineSnapshot must derive overview from persisted timeline records, answers, and exports.",
    }));
  }
};
