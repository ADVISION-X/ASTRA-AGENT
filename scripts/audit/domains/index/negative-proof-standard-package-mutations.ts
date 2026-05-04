import type { Mutation } from "./negative-proof-types.js";
import { indexAbilityGroupExpansionMutations } from "./negative-proof-ability-group-expansion-mutations.js";
import { indexDeleteRebuildMutations } from "./negative-proof-delete-rebuild-mutations.js";
import { indexStandardPackageFoundationMutations } from "./negative-proof-standard-package-foundation-mutations.js";
import { indexStandardPackagePrincipleMutations } from "./negative-proof-standard-package-principle-mutations.js";

export const indexStandardPackageMutations: Mutation[] = [
  ...indexAbilityGroupExpansionMutations,
  ...indexStandardPackageFoundationMutations,
  ...indexStandardPackagePrincipleMutations,
  ...indexDeleteRebuildMutations,
];
