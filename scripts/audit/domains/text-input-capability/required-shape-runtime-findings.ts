import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { LAW_IDS, PATHS } from "./config.js";
import { getSourceFile, makeProject } from "./project-access.js";

function collectTextSnippetFindings(input: {
  file: string;
  lawId: string;
  sourceText: string;
  snippets: readonly string[];
  message: () => string;
}): Finding[] {
  const findings: Finding[] = [];
  for (const snippet of input.snippets) {
    if (!input.sourceText.includes(snippet)) {
      findings.push(createFinding({ lawId: input.lawId, file: input.file, line: 1, severity: "fatal", message: input.message() }));
      break;
    }
  }
  return findings;
}

function sourceIncludesAny(sourceText: string, snippets: readonly string[]): boolean {
  return snippets.some((snippet) => sourceText.includes(snippet));
}

function collectResultBuilderFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const resultBuilderSource = getSourceFile(project, PATHS.RESULT_BUILDER);
  return !resultBuilderSource
    || !hasCallExpression(resultBuilderSource, "buildTextInputRuntimeProof")
    || !hasCallExpression(resultBuilderSource, "buildTextInputDebugBundle")
    || !hasCallExpression(resultBuilderSource, "validateTextInputOutputBoundary")
    || !hasCallExpression(resultBuilderSource, "buildPostActionVerificationHandoffRef")
    || !hasCallExpressionPath(resultBuilderSource, ["TextInputAbilityResultSchema", "parse"])
    ? [createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Text Input result builder must preserve output boundary, debug bundle, proof, and PAV handoff checkpoints." })]
    : [];
}

function collectResultSupportFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const resultSupportSource = getSourceFile(project, PATHS.RESULT_SUPPORT);
  return !resultSupportSource
    || !hasCallExpression(resultSupportSource, "buildTextInputRuntimeProofIdentityFields")
    || !hasCallExpression(resultSupportSource, "buildTextInputResultChainFields")
    ? [createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.RESULT_SUPPORT, line: 1, severity: "fatal", message: "Text Input result support must bind result/proof chain fields through the shared builder path." })]
    : [];
}

function collectProofBuilderFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const proofBuilderSource = getSourceFile(project, PATHS.PROOF_BUILDER);
  return !proofBuilderSource || !hasCallExpressionPath(proofBuilderSource, ["TextInputRuntimeProofSchema", "parse"])
    ? [createFinding({ lawId: LAW_IDS.PROOF, file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Text Input proof builder must parse runtime proof output." })]
    : [];
}

function isStringLiteralWithValue(node: Node | undefined, expected: string): boolean {
  return Boolean(
    node
    && (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node))
    && node.getLiteralText() === expected,
  );
}

function isIdentifierWithName(node: Node | undefined, expected: string): boolean {
  return Boolean(node && Node.isIdentifier(node) && node.getText() === expected);
}

function isDigestHexCall(node: Node | undefined): boolean {
  if (!node || !Node.isCallExpression(node)) {
    return false;
  }

  const expression = node.getExpression();
  return Node.isPropertyAccessExpression(expression)
    && expression.getName() === "digest"
    && isStringLiteralWithValue(node.getArguments()[0], "hex");
}

function isUpdateTextCall(node: Node | undefined): boolean {
  if (!node || !Node.isCallExpression(node)) {
    return false;
  }

  const expression = node.getExpression();
  return Node.isPropertyAccessExpression(expression)
    && expression.getName() === "update"
    && isIdentifierWithName(node.getArguments()[0], "text");
}

function isCreateHashSha256Call(node: Node | undefined): boolean {
  return Boolean(node && Node.isCallExpression(node) && isIdentifierWithName(node.getExpression(), "createHash") && isStringLiteralWithValue(node.getArguments()[0], "sha256"));
}

function isUpdateCreateHashSha256Call(node: Node | undefined): boolean {
  if (!node || !Node.isCallExpression(node) || !isUpdateTextCall(node)) {
    return false;
  }

  const updateExpression = node.getExpression();
  return Node.isPropertyAccessExpression(updateExpression)
    && isCreateHashSha256Call(updateExpression.getExpression());
}

function isCanonicalSha256DigestCall(node: Node | undefined): boolean {
  if (!node || !Node.isCallExpression(node) || !isDigestHexCall(node)) {
    return false;
  }

  const expression = node.getExpression();
  return Node.isPropertyAccessExpression(expression)
    && isUpdateCreateHashSha256Call(expression.getExpression());
}

function isCanonicalHashTextReturn(node: Node | undefined): boolean {
  if (!node || !Node.isTemplateExpression(node)) {
    return false;
  }

  const spans = node.getTemplateSpans();
  return node.getHead().getLiteralText() === "sha256:"
    && spans.length === 1
    && isCanonicalSha256DigestCall(spans[0]?.getExpression());
}

function isStringOfValueKeyCall(node: Node | undefined): boolean {
  if (!node || !Node.isCallExpression(node) || !isIdentifierWithName(node.getExpression(), "String")) {
    return false;
  }
  const argument = node.getArguments()[0];
  return isValueKeyPropertyAccess(argument);
}

function isHashTextOfValueKey(node: Node | undefined): boolean {
  if (!node || !Node.isCallExpression(node) || !isIdentifierWithName(node.getExpression(), "hashText")) {
    return false;
  }
  return isStringOfValueKeyCall(node.getArguments()[0]);
}

function isNullLiteral(node: Node | undefined): boolean {
  return Boolean(node && node.getKind() === SyntaxKind.NullKeyword);
}

function isValueKeyPropertyAccess(node: Node | undefined): boolean {
  return Boolean(
    node
    && Node.isPropertyAccessExpression(node)
    && node.getName() === "key"
    && isIdentifierWithName(node.getExpression(), "value"),
  );
}

function isValueKeyNullCheck(node: Node | undefined): boolean {
  if (!node || !Node.isBinaryExpression(node)) {
    return false;
  }
  return node.getOperatorToken().getKind() === SyntaxKind.EqualsEqualsEqualsToken
    && isValueKeyPropertyAccess(node.getLeft())
    && isNullLiteral(node.getRight());
}

function isGovernedKeySequenceHashInitializer(node: Node | undefined): boolean {
  if (!node || !Node.isConditionalExpression(node)) {
    return false;
  }

  return isValueKeyNullCheck(node.getCondition())
    && isNullLiteral(node.getWhenTrue())
    && isHashTextOfValueKey(node.getWhenFalse());
}

function collectPrimitiveAdapterHashFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const primitiveAdapterSource = getSourceFile(project, PATHS.PRIMITIVE_ADAPTER);
  if (!primitiveAdapterSource) {
    return [createFinding({ lawId: LAW_IDS.PROOF, file: PATHS.PRIMITIVE_ADAPTER, line: 1, severity: "fatal", message: "Text Input primitive adapter file is missing." })];
  }

  const hashTextReturn = primitiveAdapterSource.getFunction("hashText")?.getDescendantsOfKind(SyntaxKind.ReturnStatement)[0]?.getExpression();
  const findings: Finding[] = [];
  if (!isCanonicalHashTextReturn(hashTextReturn)) {
    findings.push(createFinding({ lawId: LAW_IDS.PROOF, file: PATHS.PRIMITIVE_ADAPTER, line: 1, severity: "fatal", message: "Text Input primitive adapter hashText must return schema-canonical sha256-prefixed hashes, not bare hex." }));
  }

  const keySequenceHashAssignments = primitiveAdapterSource.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .filter((property) => property.getName() === "keySequenceHash");
  const invalidKeySequenceHash = keySequenceHashAssignments.some((property) => {
    const initializer = property.getInitializer();
    return initializer !== undefined
      && !isNullLiteral(initializer)
      && !isGovernedKeySequenceHashInitializer(initializer);
  });
  if (keySequenceHashAssignments.length === 0 || invalidKeySequenceHash) {
    findings.push(createFinding({ lawId: LAW_IDS.PROOF, file: PATHS.PRIMITIVE_ADAPTER, line: 1, severity: "fatal", message: "Text Input primitive adapter keySequenceHash must be null or hashText(String(value.key)) so result/proof hashes satisfy schema." }));
  }

  return findings;
}

export function collectBuilderFindings(project: ReturnType<typeof makeProject>): Finding[] {
  return [
    ...collectResultBuilderFindings(project),
    ...collectResultSupportFindings(project),
    ...collectProofBuilderFindings(project),
    ...collectPrimitiveAdapterHashFindings(project),
  ];
}

function collectApprovedGateFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const approvedGateText = getSourceFile(project, PATHS.APPROVED_TEXT_GATE)?.getFullText() ?? "";
  return collectTextSnippetFindings({
    file: PATHS.APPROVED_TEXT_GATE,
    lawId: LAW_IDS.SHAPE,
    sourceText: approvedGateText,
    snippets: [
      "if (!input.request.approvedTextRef || input.request.approvedTextRef.length === 0)",
      "if (!input.request.approvedTextSourceRef || input.request.approvedTextSourceRef.length === 0)",
      "if (!input.request.approvedTextApprovalRef || input.request.approvedTextApprovalRef.length === 0)",
      "if (input.request.inputTextHash !== input.request.approvedTextHash || (input.request.inputText ?? \"\") !== (input.request.approvedText ?? \"\"))",
    ],
    message: () => "Approved-text gate must enforce approved refs and hash parity.",
  });
}

function collectSourceGateFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const sourceGateText = getSourceFile(project, PATHS.SOURCE_GATE)?.getFullText() ?? "";
  return collectTextSnippetFindings({
    file: PATHS.SOURCE_GATE,
    lawId: LAW_IDS.SHAPE,
    sourceText: sourceGateText,
    snippets: ["sourceRef"],
    message: () => "Text source proof gate must require sourceRef.",
  });
}

function collectTargetGateFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const targetGateText = getSourceFile(project, PATHS.TARGET_GATE)?.getFullText() ?? "";
  return collectTextSnippetFindings({
    file: PATHS.TARGET_GATE,
    lawId: LAW_IDS.SHAPE,
    sourceText: targetGateText,
    snippets: ["inputTargetRef", "geometryGuardProofRef"],
    message: () => "Input target proof gate must require inputTargetRef and geometry proof when needed.",
  });
}

function collectFocusGateFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const focusGateText = getSourceFile(project, PATHS.FOCUS_GATE)?.getFullText() ?? "";
  return collectTextSnippetFindings({
    file: PATHS.FOCUS_GATE,
    lawId: LAW_IDS.SHAPE,
    sourceText: focusGateText,
    snippets: ["mouseClickProofRef"],
    message: () => "Focus proof gate must require mouseClickProofRef when focus came from mouse-click.",
  });
}

function collectCommitGateFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const commitGateText = getSourceFile(project, PATHS.COMMIT_POLICY_GATE)?.getFullText() ?? "";
  return collectTextSnippetFindings({
    file: PATHS.COMMIT_POLICY_GATE,
    lawId: LAW_IDS.SENSITIVE,
    sourceText: commitGateText,
    snippets: [
      "if (!input.request.policy.commitPolicy.requireApprovedCommitRef || (input.request.approvedCommitRef?.length ?? 0) > 0)",
      "requireApprovedCommitRef",
    ],
    message: () => "Commit policy gate must enforce approvedCommitRef and governed approval policy.",
  });
}

export function collectGateFindings(project: ReturnType<typeof makeProject>): Finding[] {
  return [
    ...collectApprovedGateFindings(project),
    ...collectSourceGateFindings(project),
    ...collectTargetGateFindings(project),
    ...collectFocusGateFindings(project),
    ...collectCommitGateFindings(project),
  ];
}

function collectInputSeedFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const inputGateText = getSourceFile(project, PATHS.INPUT_GATE)?.getFullText() ?? "";
  const requiredSnippetGroups = [
    ["input.inputRef", "readNonEmptyString(raw.inputRef)"],
    ["input.idempotencyKey", "readNonEmptyString(raw.idempotencyKey)"],
    ["input.capabilityCallId", "readNonEmptyString(raw.capabilityCallId)"],
    ["sourceRef: input.sourceRef", "sourceRef: readNonEmptyString(raw.sourceRef)"],
    ["inputTargetRef: input.inputTargetRef", "inputTargetRef: readNonEmptyString(raw.inputTargetRef)"],
  ] as const;

  return requiredSnippetGroups.every((group) => sourceIncludesAny(inputGateText, group))
    ? []
    : [createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.INPUT_GATE, line: 1, severity: "fatal", message: "Text Input execution seed must preserve upstream chain refs instead of fabricating local surrogates." })];
}

function collectProofChainFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const proofBuilderText = getSourceFile(project, PATHS.PROOF_BUILDER)?.getFullText() ?? "";
  const findings = collectTextSnippetFindings({
    file: PATHS.PROOF_BUILDER,
    lawId: LAW_IDS.PROOF,
    sourceText: proofBuilderText,
    snippets: [
      "missionId: input.missionId",
      "runId: input.runId",
      "activationSnapshotRef: input.activationSnapshotRef",
      "capabilityCallId: input.capabilityCallId",
      "nerveBusEnvelopeId: input.nerveBusEnvelopeId",
      "sourceRef: input.sourceRef",
      "idempotencyKey: input.idempotencyKey",
      "approvedTextSourceRef: input.approvedTextSourceRef",
      "approvedTextApprovalRef: input.approvedTextApprovalRef",
      "inputTargetRef: input.inputTargetRef",
    ],
    message: () => "Text Input proof builder must preserve full upstream chain and approved text refs.",
  });

  return proofBuilderText.includes('buildStableTextInputRef("text-input-run"')
    ? [
        ...findings,
        createFinding({ lawId: LAW_IDS.PROOF, file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Text Input proof builder must not fabricate runId from attemptRef." }),
      ]
    : findings;
}

export function collectInputAndProofChainFindings(project: ReturnType<typeof makeProject>): Finding[] {
  return [
    ...collectInputSeedFindings(project),
    ...collectProofChainFindings(project),
  ];
}
