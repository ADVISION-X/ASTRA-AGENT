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
] as const;