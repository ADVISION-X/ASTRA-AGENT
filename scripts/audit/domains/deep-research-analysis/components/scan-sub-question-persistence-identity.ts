import {
  Node,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
} from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

type InspectInput = {
  context: InspectorContext;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
};

const recordOpsPath = "src/plugins/deep-research-analysis/deep-research-analysis.record-interaction-ops.ts";
const recordContractsPath = "src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts";
const recordDbMapperPath = "src/plugins/deep-research-analysis/deep-research-analysis.record-db-mappers.ts";

const getSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const hasNamedImport = (sourceFile: SourceFile, symbolName: string, moduleSuffix: string): boolean =>
  sourceFile.getImportDeclarations().some((declaration) =>
    declaration.getModuleSpecifierValue().endsWith(moduleSuffix)
    && declaration.getNamedImports().some((namedImport) => namedImport.getName() === symbolName),
  );

const isCreateSubQuestionIdCall = (call: CallExpression): boolean => {
  const expression = call.getExpression();
  if (!Node.isIdentifier(expression) || expression.getText() !== "createId") return false;
  const firstArg = call.getArguments()[0];
  return Node.isStringLiteral(firstArg) && firstArg.getLiteralValue() === "deep_research_sub_question";
};

const findInsertRunCall = (sourceFile: SourceFile): CallExpression | null =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getName() === "run"
      && Node.isIdentifier(expression.getExpression())
      && expression.getExpression().getText() === "insert";
  }) ?? null;

const hasForbiddenModelIdAsFirstRunArg = (runCall: CallExpression): boolean => {
  const firstArg = runCall.getArguments()[0];
  if (!firstArg) return true;
  if (Node.isPropertyAccessExpression(firstArg)) {
    const owner = firstArg.getExpression();
    return Node.isIdentifier(owner)
      && (owner.getText() === "parsed" || owner.getText() === "subQuestion")
      && firstArg.getName() === "id";
  }
  return !Node.isIdentifier(firstArg) || firstArg.getText() !== "id";
};

const hasModelQuestionIdSchemaField = (sourceFile: SourceFile): boolean => {
  const declaration = sourceFile.getVariableDeclaration("ResearchSubQuestionSchema");
  const initializer = declaration?.getInitializer();
  if (!initializer) return false;
  return initializer.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)
    .some((objectLiteral) => Boolean(objectLiteral.getProperty("modelQuestionId")));
};

const hasModelQuestionColumnMapping = (sourceFile: SourceFile): boolean => {
  const mapper = sourceFile.getVariableDeclaration("mapSubQuestionRow")?.getInitializer();
  if (!mapper) return false;
  const hasModelQuestionIdField = mapper.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .some((assignment) => assignment.getName() === "modelQuestionId"
      && assignment.getInitializer()?.getText() === "row.model_question_id");
  const hasQuestionDisplayIdField = mapper.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .some((assignment) => assignment.getName() === "id"
      && assignment.getInitializer()?.getText() === "row.model_question_id");
  return hasModelQuestionIdField && hasQuestionDisplayIdField;
};

export const inspectSubQuestionPersistenceIdentity = (input: InspectInput): void => {
  const recordOpsFile = getSourceFile(input.context, recordOpsPath);
  const recordContractsFile = getSourceFile(input.context, recordContractsPath);
  const recordDbMapperFile = getSourceFile(input.context, recordDbMapperPath);
  for (const sourceFile of [recordOpsFile, recordContractsFile, recordDbMapperFile]) {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }

  if (!recordOpsFile) {
    input.findings.push(createFinding({
      checkId: "deep-research/sub-question-persistence-identity",
      lawId: input.lawId,
      filePath: recordOpsPath,
      message: "Sub-question persistence owner file is missing.",
    }));
    return;
  }

  const saveSubQuestions = recordOpsFile.getVariableDeclaration("saveSubQuestions");
  const saveSubQuestionsInitializer = saveSubQuestions?.getInitializer();
  const idVariable = saveSubQuestionsInitializer?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "id");
  const idInitializer = idVariable?.getInitializer();
  const runCall = findInsertRunCall(recordOpsFile);
  if (!hasNamedImport(recordOpsFile, "createId", "../../lib/local-runtime/ids.js")
    || !idInitializer
    || !Node.isCallExpression(idInitializer)
    || !isCreateSubQuestionIdCall(idInitializer)
    || !runCall
    || hasForbiddenModelIdAsFirstRunArg(runCall)) {
    input.findings.push(createFinding({
      checkId: "deep-research/sub-question-system-primary-key",
      lawId: input.lawId,
      filePath: recordOpsPath,
      message: "saveSubQuestions must insert a system createId(\"deep_research_sub_question\") value as research_sub_questions.id, never parsed.id or subQuestion.id.",
    }));
  }

  if (!recordContractsFile || !hasModelQuestionIdSchemaField(recordContractsFile)) {
    input.findings.push(createFinding({
      checkId: "deep-research/sub-question-model-id-contract",
      lawId: input.lawId,
      filePath: recordContractsPath,
      message: "ResearchSubQuestionSchema must expose modelQuestionId separately from the database id.",
    }));
  }

  if (!recordDbMapperFile || !hasModelQuestionColumnMapping(recordDbMapperFile)) {
    input.findings.push(createFinding({
      checkId: "deep-research/sub-question-model-id-mapping",
      lawId: input.lawId,
      filePath: recordDbMapperPath,
      message: "mapSubQuestionRow must map model_question_id to modelQuestionId and question.id.",
    }));
  }
};
