# GRASSEYE-GEOMETRY-GUARD-CAPABILITY-002-V3 Production Mutation

scenarioId: fallback-mode-result-escape
mutationName: fallback-mode-result-escape
mutatedFile: src/capabilities/geometry-guard/runtime/geometry-result-builder.ts
coveredLawIds: GRASSEYE-GEOMETRY-GUARD-CAPABILITY-002-V3
beforeHash: sha256:092565217be35f4a705cddbc0e0a464484c88c29f2afa1aca938b29179b0eefb
afterMutationHash: sha256:0fe4de8c1bc36e2a63180fccaa172b59abd57e4cff9594616adacef70120b735

The mutation leaks a forbidden fallbackMode field into Geometry Guard result output, proving the public contract must remain clean and geometry-native.
