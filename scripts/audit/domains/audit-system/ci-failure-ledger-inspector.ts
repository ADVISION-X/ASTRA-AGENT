import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { resolvesTo } from "./ci-integrity-ast.js";

const phaseSealerDeclaration = (ciFull: SourceFile | undefined) => ciFull?.getImportDeclarations()
  .find((item) => item.getModuleSpecifierValue() === "./ci-phase-sealer.js")
  ?.getModuleSpecifierSourceFile()?.getVariableDeclaration("sealCiPhasePlanOrFail");

const sealedPlanAssignment = (
  body: import("ts-morph").Block,
  currentPlan: import("ts-morph").VariableDeclaration,
  phasePlanResult: import("ts-morph").VariableDeclaration,
) => body.getDescendantsOfKind(SyntaxKind.BinaryExpression).find((item) => {
  const right = item.getRight();
  return resolvesTo(item.getLeft(), currentPlan)
    && Node.isPropertyAccessExpression(right) && right.getName() === "plannedSteps"
    && resolvesTo(right.getExpression(), phasePlanResult);
});

const skeletonCallsAreBound = (input: {
  acceptanceSkeletons: import("ts-morph").VariableDeclaration;
  failFast: import("ts-morph").VariableDeclaration;
  initialPlanCall: import("ts-morph").CallExpression;
  phaseSealer: import("ts-morph").VariableDeclaration;
  sealedPlanCall: import("ts-morph").CallExpression;
  skeletonBuilder: import("ts-morph").VariableDeclaration;
}): boolean => resolvesTo(input.initialPlanCall.getExpression(), input.skeletonBuilder)
  && resolvesTo(input.initialPlanCall.getArguments()[0], input.acceptanceSkeletons)
  && resolvesTo(input.sealedPlanCall.getExpression(), input.phaseSealer)
  && resolvesTo(input.sealedPlanCall.getArguments()[0], input.acceptanceSkeletons)
  && resolvesTo(input.sealedPlanCall.getArguments()[1], input.failFast);

const readFailureLedgerState = (
  ciFull: SourceFile | undefined,
  phasePlan: SourceFile | undefined,
  failFastFile: SourceFile | undefined,
) => {
  const main = ciFull?.getVariableDeclaration("main")?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const body = main?.getBody();
  const skeletonBuilder = phasePlan?.getVariableDeclaration("buildCiPlanSkeleton");
  const phaseSealer = phaseSealerDeclaration(ciFull);
  if (!main || !Node.isBlock(body) || !skeletonBuilder || !phaseSealer || !failFastFile) return null;
  const acceptanceSkeletons = body.getVariableDeclaration("acceptanceSkeletons");
  const currentPlan = body.getVariableDeclaration("currentPlannedSteps");
  const failFast = body.getVariableDeclaration("failFast");
  const phasePlanResult = body.getVariableDeclaration("phasePlan");
  const initialPlanCall = body.getDescendantsOfKind(SyntaxKind.BinaryExpression).flatMap((assignment) => {
    if (!currentPlan || !resolvesTo(assignment.getLeft(), currentPlan)) return [];
    const call = assignment.getRight().asKind(SyntaxKind.CallExpression);
    return call ? [call] : [];
  }).find((call) => resolvesTo(call.getExpression(), skeletonBuilder));
  const sealedPlanCall = phasePlanResult?.getInitializerIfKind(SyntaxKind.CallExpression);
  if (!acceptanceSkeletons || !currentPlan || !failFast || !phasePlanResult || !initialPlanCall || !sealedPlanCall) return null;
  return { acceptanceSkeletons, body, currentPlan, failFast, failFastFile, initialPlanCall,
    phasePlanResult, phaseSealer, sealedPlanCall, skeletonBuilder };
};

export const failureLedgerUsesOneSkeleton = (
  ciFull: SourceFile | undefined,
  phasePlan: SourceFile | undefined,
  failFastFile: SourceFile | undefined,
): boolean => {
  const state = readFailureLedgerState(ciFull, phasePlan, failFastFile);
  if (!state) return false;
  const { acceptanceSkeletons, body, currentPlan, failFast, initialPlanCall,
    phasePlanResult, phaseSealer, sealedPlanCall, skeletonBuilder } = state;
  const assignment = sealedPlanAssignment(body, currentPlan, phasePlanResult);
  const authorityProperty = state.failFastFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .find((property) => property.getName() === "authorityStatus");
  return skeletonCallsAreBound({ acceptanceSkeletons, failFast, initialPlanCall, phaseSealer, sealedPlanCall, skeletonBuilder })
    && assignment !== undefined && sealedPlanCall.getStart() < assignment.getStart()
    && authorityProperty !== undefined && Node.isConditionalExpression(authorityProperty.getInitializer());
};
