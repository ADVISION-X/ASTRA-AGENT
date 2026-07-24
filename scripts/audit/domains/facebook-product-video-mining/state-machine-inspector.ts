import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const requiredRoundStates = [
  "WAIT_VIDEO_STABLE",
  "SNAPSHOT_PAGE_FACTS",
  "LOAD_COMMENTS",
  "DOWNLOAD_VIDEO",
  "AI_JUDGE",
  "RECORD_RESULT",
  "ADVANCE_VIDEO",
  "VERIFY_NEW_VIDEO",
] as const;

const sourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const identifiers = (file: SourceFile | undefined): Set<string> =>
  new Set(file?.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText()) ?? []);

const literals = (file: SourceFile | undefined): Set<string> =>
  new Set(file?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralText()) ?? []);

const hasChangedSignalQuorum = (file: SourceFile | undefined): boolean =>
  file?.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((binary) => {
    if (binary.getOperatorToken().getKind() !== SyntaxKind.GreaterThanEqualsToken) {
      return false;
    }
    const left = binary.getLeft();
    const right = binary.getRight();
    return Node.isPropertyAccessExpression(left)
      && left.getName() === "length"
      && Node.isIdentifier(left.getExpression())
      && left.getExpression().getText() === "changedSignals"
      && Node.isNumericLiteral(right)
      && right.getLiteralValue() === 2;
  }) ?? false;

export const inspectStateMachineNavigationProof = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const runtimePath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-runtime.ts";
  const navigationPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation.ts";
  const proofPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation-proof.ts";
  const scriptPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation-scripts.ts";
  for (const repoPath of [runtimePath, navigationPath, proofPath, scriptPath]) {
    inspectedFiles.add(repoPath);
  }
  const runtime = sourceFile(context, runtimePath);
  const navigation = sourceFile(context, navigationPath);
  const proof = sourceFile(context, proofPath);
  const script = sourceFile(context, scriptPath);
  const runtimeLiterals = literals(runtime);
  for (const state of requiredRoundStates) {
    if (!runtimeLiterals.has(state)) {
      findings.push(createFinding({
        checkId: "facebook-mining/round-state-machine",
        lawId,
        filePath: runtimePath,
        message: `Facebook round state machine must declare ${state}.`,
      }));
    }
  }
  const navigationIdentifiers = identifiers(navigation);
  if (![
    "pressArrowDownForNextVideo",
    "wheelScrollForNextVideo",
    "safeZoneClickForNextVideo",
    "ensureFacebookFeedTab",
  ].every((name) => navigationIdentifiers.has(name))) {
    findings.push(createFinding({
      checkId: "facebook-mining/fixed-navigation-action-ladder",
      lawId,
      filePath: navigationPath,
      message: "Facebook next-video navigation must use the fixed ArrowDown, wheel scroll, safe-zone, recover action ladder.",
    }));
  }
  if (
    !navigationIdentifiers.has("collectChangedNavigationSignals")
    || !hasChangedSignalQuorum(proof)
    || !literals(navigation).has("next_video_not_confirmed")
  ) {
    findings.push(createFinding({
      checkId: "facebook-mining/navigation-proof-quorum",
      lawId,
      filePath: navigationPath,
      message: "Facebook next-video verification must require a two-signal proof quorum and record unconfirmed navigation as non-terminal.",
    }));
  }
  const forbiddenLiterals = new Set([...literals(navigation), ...literals(script)]);
  if (forbiddenLiterals.has("clicked_next") || forbiddenLiterals.has("next_video_did_not_change")) {
    findings.push(createFinding({
      checkId: "facebook-mining/no-dom-next-primary-controller",
      lawId,
      filePath: navigationPath,
      message: "Facebook navigation must not restore DOM next button candidate control or terminal next_video_did_not_change behavior.",
    }));
  }
};
