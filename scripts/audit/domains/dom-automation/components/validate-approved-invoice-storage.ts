import { Node, SyntaxKind, type CallExpression, type FunctionDeclaration, type Node as MorphNode, type PropertyAccessExpression, type SourceFile } from "ts-morph";

const propertyAccessPath = (expression: PropertyAccessExpression): readonly string[] => {
  const left = expression.getExpression();
  if (Node.isIdentifier(left)) return [left.getText(), expression.getName()];
  if (Node.isPropertyAccessExpression(left)) return [...propertyAccessPath(left), expression.getName()];
  return [expression.getName()];
};

const callPath = (call: CallExpression): readonly string[] => {
  const expression = call.getExpression();
  if (Node.isIdentifier(expression)) return [expression.getText()];
  return Node.isPropertyAccessExpression(expression) ? [...propertyAccessPath(expression)] : [];
};

const pathMatches = (actual: readonly string[], expected: readonly string[]): boolean =>
  actual.length === expected.length && actual.every((segment, index) => segment === expected[index]);

const isCallPath = (call: CallExpression, expected: readonly string[]): boolean =>
  pathMatches(callPath(call), expected);

const propertyAccessMatches = (expression: PropertyAccessExpression, expected: readonly string[]): boolean =>
  pathMatches(propertyAccessPath(expression), expected);

const literalArg = (args: readonly MorphNode[], index: number, expected: string): boolean => {
  const arg = args[index];
  return Boolean(arg && Node.isStringLiteral(arg) && arg.getLiteralText() === expected);
};

const initializerForVariable = (functionDeclaration: FunctionDeclaration, variableName: string): MorphNode | undefined =>
  functionDeclaration.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === variableName)
    ?.getInitializer();

const hasDownloadsInvoiceDir = (functionDeclaration: FunctionDeclaration): boolean =>
  functionDeclaration.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    if (!isCallPath(call, ["path", "join"])) return false;
    const args = call.getArguments();
    const firstArg = args[0];
    return Boolean(firstArg && Node.isCallExpression(firstArg) && isCallPath(firstArg, ["os", "homedir"]))
      && literalArg(args, 1, "Downloads")
      && literalArg(args, 2, "invoice");
  });

const isAmazonOrderIdSafeSegment = (node: MorphNode | undefined): boolean => {
  if (!node || !Node.isCallExpression(node) || !isCallPath(node, ["safeSegment"])) return false;
  const safeArg = node.getArguments()[0];
  return Boolean(safeArg && Node.isPropertyAccessExpression(safeArg) && propertyAccessMatches(safeArg, ["input", "amazonOrderId"]));
};

const hasAmazonOrderIdPdfPath = (functionDeclaration: FunctionDeclaration): boolean => {
  const initializer = initializerForVariable(functionDeclaration, "approvedPath");
  if (!initializer || !Node.isCallExpression(initializer) || !isCallPath(initializer, ["path", "join"])) return false;
  const args = initializer.getArguments();
  const filename = args[1];
  if (!Node.isIdentifier(args[0]) || args[0].getText() !== "invoiceDir" || !Node.isTemplateExpression(filename)) return false;
  const spans = filename.getTemplateSpans();
  return spans.length === 1
    && spans[0]?.getLiteral().getLiteralText() === ".pdf"
    && isAmazonOrderIdSafeSegment(spans[0]?.getExpression());
};

const hasApprovedInvoiceWrite = (functionDeclaration: FunctionDeclaration): boolean => {
  const calls = functionDeclaration.getDescendantsOfKind(SyntaxKind.CallExpression);
  const mkdir = calls.some((call) => isCallPath(call, ["mkdirSync"]) && Node.isIdentifier(call.getArguments()[0]) && call.getArguments()[0]?.getText() === "invoiceDir");
  const write = calls.some((call) => isCallPath(call, ["writeFileSync"]) && Node.isIdentifier(call.getArguments()[0]) && call.getArguments()[0]?.getText() === "approvedPath");
  return mkdir && write;
};

const usesTaskScopedPath = (functionDeclaration: FunctionDeclaration): boolean =>
  functionDeclaration.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((expression) => propertyAccessMatches(expression, ["input", "taskId"]))
  || functionDeclaration.getDescendants()
    .some((node) => (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) && node.getLiteralText() === "approved-task-files");

export const collectApprovedInvoiceStorageIssues = (storageFile: SourceFile | null): string[] => {
  const functionDeclaration = storageFile?.getFunction("saveApprovedInvoicePdf");
  if (!functionDeclaration) return ["saveApprovedInvoicePdf is missing from plugin storage"];
  const issues: string[] = [];
  if (!hasDownloadsInvoiceDir(functionDeclaration)) {
    issues.push("approved invoice PDF persistence must target path.join(os.homedir(), \"Downloads\", \"invoice\")");
  }
  if (!hasAmazonOrderIdPdfPath(functionDeclaration)) {
    issues.push("approved invoice PDF filename must be path.join(invoiceDir, `${safeSegment(input.amazonOrderId)}.pdf`)");
  }
  if (!hasApprovedInvoiceWrite(functionDeclaration)) {
    issues.push("approved invoice PDF persistence must create invoiceDir and write approvedPath");
  }
  if (usesTaskScopedPath(functionDeclaration)) {
    issues.push("approved invoice PDF path must not include taskId or approved-task-files");
  }
  return issues;
};

export const collectVerificationResultStatuses = (file: SourceFile | null): Set<string> => {
  const statuses = new Set<string>();
  if (!file) return statuses;
  for (const callExpression of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = callExpression.getExpression();
    const firstArgument = callExpression.getArguments()[0];
    if (Node.isIdentifier(expression) && expression.getText() === "buildDomVerificationResult" && Node.isStringLiteral(firstArgument)) {
      statuses.add(firstArgument.getLiteralText());
      continue;
    }
    if (!Node.isPropertyAccessExpression(expression) || expression.getExpression().getText() !== "DomVerificationResultSchema" || expression.getName() !== "parse") {
      continue;
    }
    if (!Node.isObjectLiteralExpression(firstArgument)) continue;
    const statusProperty = firstArgument.getProperty("status");
    if (!Node.isPropertyAssignment(statusProperty)) continue;
    const initializer = statusProperty.getInitializer();
    if (Node.isStringLiteral(initializer)) statuses.add(initializer.getLiteralText());
  }
  return statuses;
};

const functionBodyText = (file: SourceFile | null, functionName: string): string | null => {
  const declaration = file?.getFunction(functionName);
  if (declaration) return declaration.getBodyText() ?? "";
  const variable = file?.getVariableDeclaration(functionName);
  const initializer = variable?.getInitializer();
  return initializer?.getText() ?? null;
};

const callsFunction = (file: SourceFile | null, functionName: string): boolean =>
  Boolean(file?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === functionName;
  }));

const callsMethod = (file: SourceFile | null, methodName: string): boolean =>
  Boolean(file?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression) && expression.getName() === methodName;
  }));

const hasCloseFailureGate = (file: SourceFile | null, functionName: string): boolean => {
  const declaration = file?.getFunction(functionName);
  return Boolean(declaration?.getDescendantsOfKind(SyntaxKind.IfStatement).some((statement) =>
    statement.getExpression().getText().includes("!closeResult.ok")));
};

export const collectAmazonOrderReadinessIssues = (file: SourceFile | null): string[] => {
  const issues: string[] = [];
  const containsBody = functionBodyText(file, "snapshotContainsApprovedOrder");
  const invoiceActionBody = functionBodyText(file, "snapshotHasInvoiceActionState");
  const waitBody = functionBodyText(file, "waitForApprovedOrderDetail");

  if (!containsBody) {
    issues.push("Amazon order detail readiness is missing visible-order proof helper");
  } else if (containsBody.includes("snapshot.url")) {
    issues.push("Amazon order detail readiness must not treat URL order id as visible page proof");
  }
  if (!invoiceActionBody || !invoiceActionBody.includes("上传发票") || !invoiceActionBody.includes("upload invoice")) {
    issues.push("Amazon order detail readiness must wait for the upload invoice entry signal");
  }
  if (!invoiceActionBody || !invoiceActionBody.includes("管理发票") || !invoiceActionBody.includes("invoice uploaded successfully")) {
    issues.push("Amazon order detail readiness must preserve already-uploaded invoice state detection");
  }
  if (!waitBody || !waitBody.includes("snapshotHasInvoiceActionState") || !callsFunction(file, "snapshotHasInvoiceActionState")) {
    issues.push("Amazon order detail wait loop must require invoice action readiness before continuing");
  }
  return issues;
};

export const collectAmazonUploadClosureIssues = (
  verifyFile: SourceFile | null,
  existingFile: SourceFile | null,
  snapshotFile: SourceFile | null,
  completeSmokeFile: SourceFile | null,
): string[] => {
  const issues: string[] = [];
  if (!callsMethod(verifyFile, "closeActiveTab")) {
    issues.push("Amazon upload success verification must close the active order tab");
  }
  if (!hasCloseFailureGate(verifyFile, "verifyUploadSuccess")) {
    issues.push("Amazon upload success must not report upload_success when active tab close fails");
  }
  if (!hasCloseFailureGate(existingFile, "closeAlreadyUploadedTab")) {
    issues.push("Already-uploaded Amazon flow must not report upload_success when active tab close fails");
  }
  const snapshotResultBody = functionBodyText(snapshotFile, "buildSnapshotScriptResultSection");
  if (!snapshotResultBody?.includes("test(rawPageText)) detectedStates.push(\"upload_success\")")) {
    issues.push("DOM snapshot state detection must use uncropped internal page text without returning full text");
  }
  if (!completeSmokeFile?.getText().includes("getClosedActiveTabCount()")) {
    issues.push("Amazon complete smoke must assert the upload-success tab close side effect");
  }
  return issues;
};
