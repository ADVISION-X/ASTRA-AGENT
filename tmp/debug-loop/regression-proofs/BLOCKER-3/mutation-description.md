# BLOCKER-3 Mutation

Changed readBuiltin back to direct MapPackageSchema.parse(JSON.parse(content)). Expected audit:map-plugin-package to fail because packageFile/ownerResponsible/actionableMessage diagnostics would be lost.
