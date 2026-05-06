export const AUTHORING_INPUT_PACKAGE_MUTATIONS = [
  {
    name: "remove capabilityCatalog from input package mutation",
    file: "src/map-plugins/authoring/map-authoring-input-package-builder.ts",
    search: 'capabilityCatalog: buildCapabilityGroupsFromCatalog(capabilityCatalog, generatedAt),',
    replace: "",
  },
  {
    name: "remove outputSchemaCatalog from input package mutation",
    file: "src/map-plugins/authoring/map-authoring-input-package-builder.ts",
    search: 'outputSchemaCatalog: buildOutputSchemaCatalog(promptContractEntries),',
    replace: "",
  },
  {
    name: "authoring prompt builder freeform request regression mutation",
    file: "src/map-plugins/authoring/map-authoring-prompt-builder.ts",
    search: '  const inputPackage = MapAuthoringInputPackageSchema.parse(input);\n',
    replace: '  const inputPackage = input as MapAuthoringInputPackage;\n',
  },
  {
    name: "map lab dispatches raw request mutation",
    file: "src/lib/local-runtime/map-lab/map-lab-draft-request.ts",
    search: '    input: inputPackage,\n',
    replace: '    input: request,\n',
  },
  {
    name: "remove exampleMaps from input package mutation",
    file: "src/map-plugins/authoring/map-authoring-input-package-builder.ts",
    search: '  exampleMaps: [],\n',
    replace: "",
  },
  {
    name: "prompt hash placeholder mutation",
    file: "src/capabilities/ai/prompt-contracts/builtins/map.authoring.v1.prompt-contract.json",
    search: '"promptHash": "sha256:',
    replace: '"promptHash": "sha256:map-authoring-v1',
  },
  {
    name: "prompt contract hash mismatch mutation",
    file: "src/capabilities/ai/prompt-contracts/builtins/map.authoring.v1.prompt-contract.json",
    search: '"promptContractHash": "sha256:',
    replace: '"promptContractHash": "sha256:0000000000000000000000000000000000000000000000000000000000000000',
  },
  {
    name: "system prompt template hash mismatch mutation",
    file: "src/capabilities/ai/prompt-contracts/builtins/map.authoring.v1.prompt-contract.json",
    search: '"systemPromptTemplateHash": "sha256:',
    replace: '"systemPromptTemplateHash": "sha256:0000000000000000000000000000000000000000000000000000000000000000',
  },
  {
    name: "user prompt template hash mismatch mutation",
    file: "src/capabilities/ai/prompt-contracts/builtins/map.authoring.v1.prompt-contract.json",
    search: '"userPromptTemplateHash": "sha256:',
    replace: '"userPromptTemplateHash": "sha256:0000000000000000000000000000000000000000000000000000000000000000',
  },
] as const;
