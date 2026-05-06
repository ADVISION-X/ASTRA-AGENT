# GRASSEYE-TEXT-INPUT-CAPABILITY-002-V2 Production Mutation

scenarioId: text-input-write-only-browser-import
mutationName: child forbidden browser import mutation
mutatedFile: src/capabilities/text-input/children/type-text/implementation.ts
coveredLawIds: GRASSEYE-TEXT-INPUT-CAPABILITY-002-V2
beforeHash: sha256:d4719fc8153fd537f9d7665896d19ca5b53f8bac594d56117a33a9ea6065afd1
afterMutationHash: sha256:5c47464584a91714254206fabf2372bbcfdb26d4102b4c0c39ab970bd44fe449

The mutation imports browser runtime internals into a Text Input child, proving the write-only boundary rejects foreign-owner and browser-internal dependencies.
