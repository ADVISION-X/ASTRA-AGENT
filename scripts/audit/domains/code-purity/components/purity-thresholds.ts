export const FILE_LIMITS = {
  ordinary: 300,
  runtime: 300,
  appHandler: 250,
  orchestrationCoordinator: 300,
  auditInspector: 250,
  auditPhase: 350,
  schemaType: 500,
  jsonContract: 700,
  generatedArtifact: 50000,
} as const;

export const FUNCTION_LIMITS = {
  lines: 40,
  statements: 35,
  parameters: 4,
  returns: 5,
  depth: 3,
  complexity: 8,
  switchCases: 8,
  ifChain: 5,
} as const;

export const CLASS_LIMITS = {
  methods: 12,
  fields: 12,
  totalMembers: 24,
  constructorParameters: 6,
  publicMethods: 10,
} as const;

export const IMPORT_EXPORT_LIMITS = {
  importDeclarations: 15,
  importSources: 12,
  crossOwnerImports: 2,
  ownerBoundaries: 3,
  exports: 8,
} as const;