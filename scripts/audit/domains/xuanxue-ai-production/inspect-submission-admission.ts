import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type Node as MorphNode,
  type ObjectLiteralExpression,
  type SourceFile,
  type VariableDeclaration,
} from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const stagePath =
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-stage-execution.ts";

const resolvesTo = (node: MorphNode | undefined, declaration: MorphNode | undefined): boolean => {
  if (!node || !declaration) return false;
  const symbol = node.getSymbol();
  return (symbol?.getDeclarations().includes(declaration) ?? false)
    || (symbol?.getAliasedSymbol()?.getDeclarations().includes(declaration) ?? false)
    || (Node.isIdentifier(node)
      && node.getDefinitions().some((definition) => definition.getDeclarationNode() === declaration));
};

const propertyInitializer = (
  object: ObjectLiteralExpression | undefined,
  name: string,
): MorphNode | undefined => {
  const property = object?.getProperty(name);
  if (Node.isPropertyAssignment(property)) return property.getInitializer();
  if (Node.isShorthandPropertyAssignment(property)) return property.getNameNode();
  return undefined;
};

const propertyPathFrom = (
  node: MorphNode | undefined,
  root: MorphNode | undefined,
  path: readonly string[],
): boolean => {
  let current = node;
  for (let index = path.length - 1; index >= 0; index -= 1) {
    if (!Node.isPropertyAccessExpression(current) || current.getName() !== path[index]) return false;
    current = current.getExpression();
  }
  return resolvesTo(current, root);
};

const returnedObject = (arrow: ArrowFunction | undefined): ObjectLiteralExpression | undefined => {
  const body = arrow?.getBody();
  if (Node.isObjectLiteralExpression(body)) return body;
  const returnStatement = Node.isBlock(body)
    ? body.getStatements().find(Node.isReturnStatement)
    : undefined;
  return returnStatement?.getExpressionIfKind(SyntaxKind.ObjectLiteralExpression);
};

const exactHashPayload = (
  source: SourceFile,
  builder: ArrowFunction,
  priorityDeclaration: VariableDeclaration,
): boolean => {
  const result = returnedObject(builder);
  const admissionHash = propertyInitializer(result, "admissionRef");
  if (!Node.isCallExpression(admissionHash)) return false;
  const browserHash = source.getVariableDeclaration("browserHash");
  if (!resolvesTo(admissionHash.getExpression(), browserHash)) return false;
  const stringify = admissionHash.getArguments()[0];
  if (!Node.isCallExpression(stringify)) return false;
  const stringifyCallee = stringify.getExpression();
  if (!Node.isPropertyAccessExpression(stringifyCallee)
    || stringifyCallee.getName() !== "stringify") return false;
  const payload = stringify.getArguments()[0];
  if (!Node.isObjectLiteralExpression(payload)) return false;
  const inputParameter = builder.getParameters()[0];
  const identityFields = [
    ["jobId", "jobId"],
    ["attemptId", "attemptId"],
    ["requiredDeviceId", "requiredDeviceId"],
    ["leaseVersion", "leaseVersion"],
    ["executionFenceHash", "executionFenceHash"],
    ["contractManifestHash", "contractManifestHash"],
  ] as const;
  const identityBound = identityFields.every(([property, field]) =>
    propertyPathFrom(propertyInitializer(payload, property), inputParameter, ["identity", field]));
  return identityBound
    && propertyPathFrom(propertyInitializer(payload, "executionId"), inputParameter, ["stageExecutionId"])
    && resolvesTo(propertyInitializer(payload, "priorityKey"), priorityDeclaration)
    && resolvesTo(propertyInitializer(result, "priorityKey"), priorityDeclaration);
};

const exactBuilder = (source: SourceFile): boolean => {
  const builder = source.getVariableDeclaration("buildXuanxueAiSubmissionAdmission")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const priority = builder?.getBody().getFirstDescendant((node) =>
    Node.isVariableDeclaration(node) && node.getName() === "priorityKey");
  return Node.isVariableDeclaration(priority) && builder !== undefined
    && exactHashPayload(source, builder, priority);
};

const exactAcquireBinding = (source: SourceFile): VariableDeclaration | undefined => {
  const acquire = source.getVariableDeclaration("acquireStageBrowser")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const input = acquire?.getParameters()[0];
  const record = acquire?.getBody().getFirstDescendant((node) =>
    Node.isVariableDeclaration(node) && node.getName() === "record");
  const identity = acquire?.getBody().getFirstDescendant((node) =>
    Node.isVariableDeclaration(node) && node.getName() === "identity");
  const admission = acquire?.getBody().getFirstDescendant((node) =>
    Node.isVariableDeclaration(node) && node.getName() === "submissionAdmission");
  if (!Node.isVariableDeclaration(record)
    || !Node.isVariableDeclaration(identity)
    || !Node.isVariableDeclaration(admission)) return undefined;
  const currentIdentity = identity.getInitializer();
  const admissionCall = admission.getInitializer();
  if (!Node.isCallExpression(record.getInitializer())
    || !Node.isCallExpression(admissionCall)
    || !propertyPathFrom(currentIdentity, record, ["order", "cloudExecutionIdentity"])) return undefined;
  const builder = source.getVariableDeclaration("buildXuanxueAiSubmissionAdmission");
  const options = admissionCall.getArguments()[0];
  if (!resolvesTo(admissionCall.getExpression(), builder)
    || !Node.isObjectLiteralExpression(options)) return undefined;
  const exactOptions = resolvesTo(propertyInitializer(options, "identity"), identity)
    && propertyPathFrom(propertyInitializer(options, "orderCreatedAt"), record, ["order", "createdAt"])
    && propertyPathFrom(propertyInitializer(options, "orderId"), record, ["order", "orderId"])
    && propertyPathFrom(propertyInitializer(options, "stageExecutionId"), input, ["stage", "executionId"])
    && propertyPathFrom(propertyInitializer(options, "stageOrdinal"), input, ["stage", "ordinal"]);
  const returned = returnedObject(acquire);
  return exactOptions && resolvesTo(propertyInitializer(returned, "submissionAdmission"), admission)
    ? admission
    : undefined;
};

const exactGatewayBinding = (source: SourceFile): boolean => {
  const execute = source.getVariableDeclaration("executeGatewayStage")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const binding = execute?.getBody().getFirstDescendant((node) =>
    Node.isBindingElement(node) && node.getName() === "submissionAdmission");
  if (!binding) return false;
  const declaration = binding.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  const acquireCall = declaration?.getInitializerIfKind(SyntaxKind.AwaitExpression)
    ?.getExpressionIfKind(SyntaxKind.CallExpression);
  const acquire = source.getVariableDeclaration("acquireStageBrowser");
  if (!acquireCall || !resolvesTo(acquireCall.getExpression(), acquire)) return false;
  const gatewayCalls = execute?.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
    const callee = call.getExpression();
    if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== "execute") return false;
    const gateway = callee.getExpression();
    return Node.isPropertyAccessExpression(gateway) && gateway.getName() === "aiInputGateway";
  }) ?? [];
  if (gatewayCalls.length !== 1) return false;
  const gatewayCall = gatewayCalls[0];
  return gatewayCall?.getArguments()[1]?.getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment)
    .some((property) => property.getName() === "submissionAdmission"
      && resolvesTo(property.getNameNode(), binding)) === true;
};

export const submissionAdmissionBindingIsExact = (source: SourceFile): boolean =>
  exactBuilder(source) && exactAcquireBinding(source) !== undefined && exactGatewayBinding(source);

export const inspectSubmissionAdmissionBinding = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const source = context.project.getSourceFile(resolveFromRepo(stagePath));
  if (source && submissionAdmissionBindingIsExact(source)) return;
  findings.push(createFinding({
    lawId,
    clauseId: "apex-xuanxue-001-v6-session-bound-cloud-pull",
    checkId: "xuanxue-ai-production/current-grant-submission-admission",
    filePath: stagePath,
    message: "Owning Plugin must hash the exact current grant identity and immutable business priority, return that admission from acquireStageBrowser, and pass the same symbol to Gateway execute options.",
  }));
};
