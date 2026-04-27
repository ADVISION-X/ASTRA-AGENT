import { Node, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import { getAuditProject, getExpressionPath, getNodeLine, getSourceFileOrThrow, toRelativeSourcePath } from "../../core/ts-morph.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { defaultLocale, dictionaries, supportedLocales } from "../../../../src/lib/localization/dictionaries.js";
import { createTranslator } from "../../../../src/lib/localization/render-text.js";

const hasNamedImport = (sourceFile: import("ts-morph").SourceFile, moduleSpecifier: string, importedName: string): boolean =>
  sourceFile.getImportDeclarations().some(
    (declaration) =>
      declaration.getModuleSpecifierValue() === moduleSpecifier &&
      declaration.getNamedImports().some((specifier) => specifier.getName() === importedName),
  );

const getIdentifierCall = (sourceFile: import("ts-morph").SourceFile, identifierName: string) =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === identifierName;
  });

export default createPendingDomainInspector({
  inspector: "GrassEye Localization Owner Inspector",
  inspectorId: "localization-owner",
  capabilityDomain: "localization",
  inspectorEntry: "scripts/audit/domains/localization/inspector.ts",
  ownedPaths: ["src/lib/localization", "src/features/operator-control/console-view.ts", "src/app/server.ts"],
  pendingSummary: "localization implementation pending; localization laws are present but UI dictionary enforcement is not implemented yet",
  implementedSummary: "localization implementation is enforced through governed dictionaries, locale parsing, and operator-console language switching",
  extraChecks: async () => {
    const findings = [];
    const auditProject = getAuditProject();
    const dictionariesSource = getSourceFileOrThrow(auditProject, "src/lib/localization/dictionaries.ts");
    const localeSource = getSourceFileOrThrow(auditProject, "src/lib/localization/locale.ts");
    const renderTextSource = getSourceFileOrThrow(auditProject, "src/lib/localization/render-text.ts");
    const serverSource = getSourceFileOrThrow(auditProject, "src/app/server.ts");
    const consoleViewSource = getSourceFileOrThrow(auditProject, "src/features/operator-control/console-view.ts");

    const relativeDictionariesPath = toRelativeSourcePath(dictionariesSource);
    const relativeRenderTextPath = toRelativeSourcePath(renderTextSource);
    const relativeServerPath = toRelativeSourcePath(serverSource);
    const relativeConsolePath = toRelativeSourcePath(consoleViewSource);

    if (supportedLocales.length !== 2 || !supportedLocales.includes("en") || !supportedLocales.includes("zh")) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCALIZATION-001-V1",
          file: relativeDictionariesPath,
          line: 1,
          severity: "error",
          message: "Localization must support exactly the governed en and zh locales.",
        }),
      );
    }

    if (defaultLocale !== "en") {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCALIZATION-001-V1",
          file: relativeDictionariesPath,
          line: 1,
          severity: "error",
          message: "Localization default locale must remain English.",
        }),
      );
    }

    const englishKeys = Object.keys(dictionaries.en).sort();
    const chineseKeys = Object.keys(dictionaries.zh).sort();
    if (englishKeys.length !== chineseKeys.length || englishKeys.some((key, index) => key !== chineseKeys[index])) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCALIZATION-002-V1",
          file: relativeDictionariesPath,
          line: 1,
          severity: "error",
          message: "English and Chinese dictionary key sets must match exactly.",
        }),
      );
    }

    for (const [localeName, dictionary] of Object.entries(dictionaries)) {
      for (const [key, value] of Object.entries(dictionary)) {
        if (value.length === 0) {
          findings.push(
            createFinding({
              lawId: "GRASSEYE-LOCALIZATION-002-V1",
              file: relativeDictionariesPath,
              line: 1,
              severity: "error",
              message: `Localization value must not be empty for ${localeName}.${key}.`,
            }),
          );
        }
      }
    }

    if (createTranslator("en")("missing.localization.key") !== "[MISSING:missing.localization.key]") {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCALIZATION-002-V1",
          file: relativeRenderTextPath,
          line: 1,
          severity: "error",
          message: "Localization helper must expose a visible [MISSING:key] fallback.",
        }),
      );
    }

    if (!hasNamedImport(serverSource, "../lib/localization/locale.js", "getLocaleFromRequestUrl")) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCALIZATION-001-V1",
          file: relativeServerPath,
          line: 1,
          severity: "error",
          message: "Server must import getLocaleFromRequestUrl from the localization boundary.",
        }),
      );
    }

    const localeDeclaration = serverSource.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find(
      (declaration) => declaration.getName() === "locale",
    );
    const localeCall = localeDeclaration?.getInitializerIfKind(SyntaxKind.CallExpression);
    const localeCallExpression = localeCall?.getExpression();
    const localeCallUsesRequestUrl =
      localeCall &&
      Node.isIdentifier(localeCallExpression) &&
      localeCallExpression.getText() === "getLocaleFromRequestUrl" &&
      localeCall.getArguments().some((argument) => Node.isIdentifier(argument) && argument.getText() === "url");
    if (!localeCallUsesRequestUrl) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCALIZATION-001-V1",
          file: relativeServerPath,
          line: getNodeLine(localeDeclaration ?? serverSource),
          severity: "error",
          message: "Server root route must derive locale from the request URL.",
        }),
      );
    }

    const renderCall = getIdentifierCall(serverSource, "renderOperatorConsole");
    const renderOptionsArgument = renderCall?.getArguments()[1];
    const renderOptionsObject = renderOptionsArgument && Node.isObjectLiteralExpression(renderOptionsArgument)
      ? renderOptionsArgument
      : undefined;
    const localeProperty = renderOptionsObject?.getProperty("locale");
    const requestUrlProperty = renderOptionsObject?.getProperty("requestUrl");
    const localePath = localeProperty
      ? Node.isPropertyAssignment(localeProperty)
        ? getExpressionPath(localeProperty.getInitializer())
        : Node.isShorthandPropertyAssignment(localeProperty)
          ? [localeProperty.getName()]
          : []
      : [];
    const requestUrlPath = requestUrlProperty && Node.isPropertyAssignment(requestUrlProperty)
      ? getExpressionPath(requestUrlProperty.getInitializer())
      : [];
    if (!renderOptionsObject || localePath[0] !== "locale" || requestUrlPath[0] !== "url") {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCALIZATION-001-V1",
          file: relativeServerPath,
          line: getNodeLine(renderCall ?? serverSource),
          severity: "error",
          message: "Server must pass locale and requestUrl into renderOperatorConsole.",
        }),
      );
    }

    if (!hasNamedImport(consoleViewSource, "../../lib/localization/render-text.js", "createTranslator")) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCALIZATION-002-V1",
          file: relativeConsolePath,
          line: 1,
          severity: "error",
          message: "Operator console must import the governed localization translator helper.",
        }),
      );
    }

    const translatorCall = getIdentifierCall(consoleViewSource, "createTranslator");
    if (!translatorCall) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCALIZATION-002-V1",
          file: relativeConsolePath,
          line: 1,
          severity: "error",
          message: "Operator console must create a translator from the active locale.",
        }),
      );
    }

    const localeHrefFunction = consoleViewSource.getFunction("buildLocaleHref");
    const localeHrefCalls = consoleViewSource.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
      const expression = callExpression.getExpression();
      return Node.isIdentifier(expression) && expression.getText() === "buildLocaleHref";
    });
    const hasEnglishSwitch = localeHrefCalls.some((callExpression) => {
      const argument = callExpression.getArguments()[1];
      return argument && Node.isStringLiteral(argument) && argument.getLiteralText() === "en";
    });
    const hasChineseSwitch = localeHrefCalls.some((callExpression) => {
      const argument = callExpression.getArguments()[1];
      return argument && Node.isStringLiteral(argument) && argument.getLiteralText() === "zh";
    });
    if (!localeHrefFunction || !hasEnglishSwitch || !hasChineseSwitch) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCALIZATION-001-V1",
          file: relativeConsolePath,
          line: 1,
          severity: "error",
          message: "Operator console must expose visible English and Chinese switch links.",
        }),
      );
    }

    const forbiddenKeywords = ["google translate", "deepl", "openai translation", "cloud translation"];
    for (const sourceFile of [dictionariesSource, localeSource, renderTextSource, serverSource, consoleViewSource]) {
      const literalValues = [
        ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralText()),
        ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((literal) => literal.getLiteralText()),
      ].map((value) => value.toLowerCase());

      for (const keyword of forbiddenKeywords) {
        if (literalValues.some((value) => value.includes(keyword))) {
          findings.push(
            createFinding({
              lawId: "GRASSEYE-LOCALIZATION-001-V1",
              file: toRelativeSourcePath(sourceFile),
              line: 1,
              severity: "error",
              message: `Localization code must not introduce cloud translation dependency: ${keyword}`,
            }),
          );
        }
      }
    }

    return {
      findings,
      phases: [
        createPhase(
          "dictionary-completeness",
          findings.some((finding) => finding.lawId === "GRASSEYE-LOCALIZATION-002-V1") ? "CODE VIOLATION" : "PASS",
          !findings.some((finding) => finding.lawId === "GRASSEYE-LOCALIZATION-002-V1"),
          findings.some((finding) => finding.lawId === "GRASSEYE-LOCALIZATION-002-V1")
            ? "Localization dictionary or translator contract drift was found."
            : "Localization dictionaries stay complete, non-empty, and visibly fail on missing keys.",
        ),
        createPhase(
          "language-switch-boundary",
          findings.some((finding) => finding.lawId === "GRASSEYE-LOCALIZATION-001-V1") ? "CODE VIOLATION" : "PASS",
          !findings.some((finding) => finding.lawId === "GRASSEYE-LOCALIZATION-001-V1"),
          findings.some((finding) => finding.lawId === "GRASSEYE-LOCALIZATION-001-V1")
            ? "Localization request parsing, server wiring, or manual language switching drifted."
            : "Server and operator console keep the governed manual English / Chinese localization path.",
        ),
      ],
    };
  },
});