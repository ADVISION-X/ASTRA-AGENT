import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

import { WORKBENCH_HUMAN_COMMAND_PATH } from "./run-commander-runtime-sources.js";

const createAcceptanceFinding = (message: string): Finding =>
  createFinding({
    lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2",
    file: WORKBENCH_HUMAN_COMMAND_PATH,
    line: 1,
    severity: "fatal",
    message,
  });

const getHandleStartMission = (sourceFile: SourceFile) =>
  sourceFile.getFunction("handleStartMission")
  ?? sourceFile.getVariableDeclaration("handleStartMission")?.getInitializerIfKind(SyntaxKind.ArrowFunction)
  ?? sourceFile.getVariableDeclaration("handleStartMission")?.getInitializerIfKind(SyntaxKind.FunctionExpression);

const awaitsMissionLoop = (handleStartMission: NonNullable<ReturnType<typeof getHandleStartMission>>): boolean =>
  handleStartMission.getDescendantsOfKind(SyntaxKind.AwaitExpression).some((awaitExpression) => {
    const expression = awaitExpression.getExpression();
    return expression.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((propertyAccess) =>
      propertyAccess.getText() === "runtime.orchestrationAbilityGroup.startMission",
    ) || expression.getText() === "missionStartPromise";
  });

const startsMissionInBackground = (handleStartMission: NonNullable<ReturnType<typeof getHandleStartMission>>): boolean =>
  handleStartMission.getDescendantsOfKind(SyntaxKind.VoidExpression).some((voidExpression) =>
    voidExpression.getExpression().getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((propertyAccess) =>
      propertyAccess.getText() === "missionStartPromise.catch",
    ),
  );

const recordsAcceptanceBeforeMissionStart = (
  handleStartMission: NonNullable<ReturnType<typeof getHandleStartMission>>,
): boolean => {
  const callExpressions = handleStartMission.getDescendantsOfKind(SyntaxKind.CallExpression);
  const acceptedCall = callExpressions.find((callExpression) => callExpression.getExpression().getText() === "recordCommandAccepted");
  const missionStartCall = callExpressions.find((callExpression) => callExpression.getExpression().getText() === "runtime.orchestrationAbilityGroup.startMission");
  return Boolean(acceptedCall && missionStartCall && acceptedCall.getStart() < missionStartCall.getStart());
};

export function collectStartMissionAcceptanceBoundaryFindings(sourceFile: SourceFile): Finding[] {
  const handleStartMission = getHandleStartMission(sourceFile);
  if (!handleStartMission) {
    return [createAcceptanceFinding("Workbench human-command runtime must expose handleStartMission for governed command acceptance.")];
  }

  return !awaitsMissionLoop(handleStartMission)
    && startsMissionInBackground(handleStartMission)
    && recordsAcceptanceBeforeMissionStart(handleStartMission)
    ? []
    : [createAcceptanceFinding("start-mission command acceptance must return a governed receipt without awaiting terminal mission execution.")];
}
