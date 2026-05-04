import { SyntaxKind, type ObjectLiteralExpression } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import {
  LAW_IDS,
  PATHS,
  REQUIRED_INPUT_CHAIN_FIELDS,
  REQUIRED_INPUT_TARGET_FIELDS,
  REQUIRED_PROOF_CHAIN_FIELDS,
  REQUIRED_RESULT_CHAIN_FIELDS,
  REQUIRED_WRITE_FIELDS,
} from "./config.js";
import { getSourceFile, makeProject } from "./project-access.js";

const SCHEMA_REFINEMENTS_PATH = "src/capabilities/text-input/text-input-schema-refinements.ts";

type SchemaFieldExpectation = {
  name: string;
  initializerSnippet?: string;
};

const REQUIRED_INPUT_FIELD_EXPECTATIONS: readonly SchemaFieldExpectation[] = [
  ...REQUIRED_INPUT_CHAIN_FIELDS.map((name) => ({ name, initializerSnippet: "z.string().min(1)" })),
  { name: "sourceOwner", initializerSnippet: "TextInputSourceOwnerSchema" },
  { name: "targetProofOwner", initializerSnippet: "TextInputTargetProofOwnerSchema" },
  { name: "targetKind", initializerSnippet: "TextInputTargetKindSchema" },
  { name: "focusProofOwner", initializerSnippet: "TextInputFocusProofOwnerSchema" },
  ...REQUIRED_INPUT_TARGET_FIELDS
    .filter((name) => !["targetProofOwner", "targetKind", "focusProofOwner"].includes(name))
    .map((name) => ({
      name,
      initializerSnippet: name === "focusVerifiedAt" ? "z.string().datetime()" : "z.string().min(1)",
    })),
] as const;

const REQUIRED_WRITE_FIELD_EXPECTATIONS: readonly SchemaFieldExpectation[] = REQUIRED_WRITE_FIELDS.map((name) => ({
  name,
  initializerSnippet: name.endsWith("Hash") ? "hashString" : "z.string().min(1)",
}));

const REQUIRED_PROOF_FIELD_EXPECTATIONS: readonly SchemaFieldExpectation[] = REQUIRED_PROOF_CHAIN_FIELDS.map((name) => ({ name }));
const REQUIRED_RESULT_FIELD_EXPECTATIONS: readonly SchemaFieldExpectation[] = REQUIRED_RESULT_CHAIN_FIELDS.map((name) => ({ name }));

function getSchemaObjectLiteral(sourceFile: ReturnType<typeof getSourceFile>, declarationName: string): ObjectLiteralExpression | null {
  return sourceFile?.getVariableDeclaration(declarationName)?.getInitializer()?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression) ?? null;
}

function collectSchemaFieldExpectationFindings(input: {
  objectLiteral: ObjectLiteralExpression | null;
  expectations: readonly SchemaFieldExpectation[];
  lawId: string;
  file: string;
  scopeLabel: string;
}): Finding[] {
  if (!input.objectLiteral) {
    return [createFinding({ lawId: input.lawId, file: input.file, line: 1, severity: "fatal", message: `${input.scopeLabel} is missing its governed schema object literal.` })];
  }

  const findings: Finding[] = [];
  for (const expectation of input.expectations) {
    const property = input.objectLiteral.getProperty(expectation.name);
    if (!property) {
      findings.push(createFinding({ lawId: input.lawId, file: input.file, line: 1, severity: "fatal", message: `${input.scopeLabel} must declare ${expectation.name}.` }));
      continue;
    }
    if (expectation.initializerSnippet && !property.getText().includes(expectation.initializerSnippet)) {
      findings.push(createFinding({ lawId: input.lawId, file: input.file, line: 1, severity: "fatal", message: `${input.scopeLabel} must keep ${expectation.name} machine-required.` }));
    }
  }
  return findings;
}

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

function collectSchemaDeclarationFindings(schemaSource: NonNullable<ReturnType<typeof getSourceFile>>): Finding[] {
  return ["TextInputAbilityInputSchema", "TextInputAbilityResultSchema", "TextInputRuntimeProofSchema", "TextInputSuccessOutputSchema"]
    .filter((declarationName) => !schemaSource.getVariableDeclaration(declarationName))
    .map((declarationName) => createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: `Text Input schema must declare ${declarationName}.` }));
}

function collectPrimarySchemaObjectFindings(schemaSource: NonNullable<ReturnType<typeof getSourceFile>>): Finding[] {
  return [
    ...collectSchemaFieldExpectationFindings({
      objectLiteral: getSchemaObjectLiteral(schemaSource, "TextInputBaseSchema"),
      expectations: REQUIRED_INPUT_FIELD_EXPECTATIONS,
      lawId: LAW_IDS.SHAPE,
      file: PATHS.SCHEMA,
      scopeLabel: "TextInputBaseSchema",
    }),
    ...collectSchemaFieldExpectationFindings({
      objectLiteral: getSchemaObjectLiteral(schemaSource, "GovernedWriteFieldsSchema"),
      expectations: REQUIRED_WRITE_FIELD_EXPECTATIONS,
      lawId: LAW_IDS.SHAPE,
      file: PATHS.SCHEMA,
      scopeLabel: "GovernedWriteFieldsSchema",
    }),
    ...collectSchemaFieldExpectationFindings({
      objectLiteral: getSchemaObjectLiteral(schemaSource, "TextInputRuntimeProofSchema"),
      expectations: REQUIRED_PROOF_FIELD_EXPECTATIONS,
      lawId: LAW_IDS.PROOF,
      file: PATHS.SCHEMA,
      scopeLabel: "TextInputRuntimeProofSchema",
    }),
  ];
}

function collectActionSchemaObjectFindings(schemaSource: NonNullable<ReturnType<typeof getSourceFile>>): Finding[] {
  return [
    ...collectSchemaFieldExpectationFindings({
      objectLiteral: getSchemaObjectLiteral(schemaSource, "TextInputAbilityResultSchema"),
      expectations: REQUIRED_RESULT_FIELD_EXPECTATIONS,
      lawId: LAW_IDS.RESULT,
      file: PATHS.SCHEMA,
      scopeLabel: "TextInputAbilityResultSchema",
    }),
    ...collectSchemaFieldExpectationFindings({
      objectLiteral: getSchemaObjectLiteral(schemaSource, "PressKeyAbilityInputSchema"),
      expectations: [{ name: "key", initializerSnippet: "TextInputKeySchema" }],
      lawId: LAW_IDS.SHAPE,
      file: PATHS.SCHEMA,
      scopeLabel: "PressKeyAbilityInputSchema",
    }),
    ...collectSchemaFieldExpectationFindings({
      objectLiteral: getSchemaObjectLiteral(schemaSource, "CommitInputAbilityInputSchema"),
      expectations: [
        { name: "approvedCommitRef", initializerSnippet: "z.string().min(1)" },
        { name: "key", initializerSnippet: "TextInputCommitKeySchema" },
      ],
      lawId: LAW_IDS.RESULT,
      file: PATHS.SCHEMA,
      scopeLabel: "CommitInputAbilityInputSchema",
    }),
  ];
}

function collectSchemaObjectFindings(schemaSource: NonNullable<ReturnType<typeof getSourceFile>>): Finding[] {
  return [
    ...collectPrimarySchemaObjectFindings(schemaSource),
    ...collectActionSchemaObjectFindings(schemaSource),
  ];
}

function collectSchemaInvariantFindings(schemaSource: NonNullable<ReturnType<typeof getSourceFile>>): Finding[] {
  const project = schemaSource.getProject();
  const schemaText = [
    schemaSource.getFullText(),
    getSourceFile(project, SCHEMA_REFINEMENTS_PATH)?.getFullText() ?? "",
  ].join("\n");
  return [
    ...collectTextSnippetFindings({
      file: PATHS.SCHEMA,
      lawId: LAW_IDS.PROOF,
      sourceText: schemaText,
      snippets: [
        "runtime proof runId must come from input, not attemptRef",
        "success proof requires approvedTextSourceRef for write children",
        "success proof requires approvedTextApprovalRef for write children",
      ],
      message: () => "Text Input runtime proof schema must enforce full-chain proof invariants.",
    }),
    ...collectTextSnippetFindings({
      file: PATHS.SCHEMA,
      lawId: LAW_IDS.RESULT,
      sourceText: schemaText,
      snippets: [
        "RESULT_PROOF_PARITY_FIELDS",
        "addResultRuntimeProofParityIssue(value, context, field)",
        "failed and review_required require output=null",
        "failed and review_required require diagnosticPayloadRef",
        "TextInputCommitKeySchema",
      ],
      message: () => "Text Input result schema must enforce output-null and result/proof parity invariants.",
    }),
  ];
}

function collectRegistryFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const registrySource = getSourceFile(project, PATHS.REGISTRY);
  return !registrySource || !registrySource.getVariableDeclaration("CHILDREN")
    ? [createFinding({ lawId: LAW_IDS.CHILDREN, file: PATHS.REGISTRY, line: 1, severity: "fatal", message: "Text Input registry must declare canonical children." })]
    : [];
}

export function collectSchemaAndRegistryFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const schemaSource = getSourceFile(project, PATHS.SCHEMA);
  if (!schemaSource) {
    return [createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Text Input schema file is missing." })];
  }

  return [
    ...collectSchemaDeclarationFindings(schemaSource),
    ...collectSchemaObjectFindings(schemaSource),
    ...collectSchemaInvariantFindings(schemaSource),
    ...collectRegistryFindings(project),
  ];
}