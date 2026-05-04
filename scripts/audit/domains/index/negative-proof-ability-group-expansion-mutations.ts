import type { Mutation } from "./negative-proof-types.js";

export const indexAbilityGroupExpansionMutations: Mutation[] = [
  {
    name: "index ability-group-expansion req001 mutation",
    file: "src/map-plugins/validation/map-capability-registry-validator.ts",
    search: '  `${abilityGroupId}:${childCapabilityId}`;',
    replace: '  `${abilityGroupId}`;',
    expectedNeedle: "Ability-group expansion must keep child capability as the governed growth surface under active ability groups; capability catalog truth or child-capability validation drifted.",
  },
  {
    name: "index ability-group-expansion req002 mutation",
    file: "src/map-plugins/schema/map-plugin-package.schema.ts",
    search: '  operationalMap: OperationalMapPackageSchema,',
    replace: '  operationalMap: z.unknown(),',
    expectedNeedle: "Ability-group expansion must route growth through governed execution maps; map package schema or operational-map validation drifted.",
  },
];