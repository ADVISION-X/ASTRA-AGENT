# Audit-System Static Clause Coverage Mutations

## negative-proof wiring validator removed mutation
- file: scripts/audit/domains/audit-system/components/run-audit-red-line-checks.ts
- expectedNeedle: Audit-system inspector must execute validateNegativeProofWiring inside its Promise.all owner chain.
- beforeHash: sha256:6c6e5814870f1006f835488d224bff321511ff66df8ed898dda968a8f4a6ec8f
- afterHash: sha256:da78324859df30b5e3d67c97c45e5ba3ed94ab0b42bac3f33a49a45b7594668e

## phase gate audit-system removal mutation
- file: scripts/audit/phase-gates/phase-04-full-enforcement.json
- expectedNeedle: Current phase gate must keep audit-system active.
- beforeHash: sha256:5e43ccc91582fea73deddb1cda1c977a7441a7a845e2b26444f8833924e5fc52
- afterHash: sha256:7f0a7cd55ffe9ea09cdf4224c8d19e1ba688d082812c3e3799d957a3755aef98

## generated artifact hand-edit mutation
- file: scripts/audit/generated/audit-plan.generated.json
- expectedNeedle: Generated artifact content drifted away from the rebuild output; generated files must not be hand-edited.
- beforeHash: sha256:ac1d804a1440e7dc7932aceb8f3faefb8994589b81c88a1a76bcc2f3bbf6c733
- afterHash: sha256:8c89a3e6bc1a3a373428d423516a4e35421a06d6dd2366ce90c438ea27ec3ed0

## static-clause-coverage phase removed mutation
- file: scripts/audit/domains/audit-system/components/run-audit-governance-checks.ts
- expectedNeedle: Audit-system inspector must execute validateStaticClauseCoverage inside its Promise.all owner chain.
- beforeHash: sha256:2120b669e69886f2bc7bfe45d618d79d5855bb4a6f2e2c2ebe9604da2c228181
- afterHash: sha256:66d0bd039a50677caf2cf9c7b1011ad222dfdf618d6ba938531d4da9595f90ea

## static-clause-coverage fake ENFORCED mutation
- file: scripts/audit/generated/static-clause-coverage.generated.json
- expectedNeedle: No law may be marked ENFORCED while the global chain is failing.
- beforeHash: sha256:91240482b2ec6698e04ecd61bcd97e0ef9e151c2ff646e0df04e2facff2ce80f
- afterHash: sha256:4283e8466406ac217220a04cf3929ab6843f965e48d9ee595af451c6418da0ec

## ai mutation proof bundle emptied mutation
- file: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-001-V1/proof-summary.md
- expectedNeedle: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-001-V1/proof-summary.md
- beforeHash: sha256:93b2aee4d8696aee37e7ae11f406784935f72e75ec5316d8a0583e81bf105099
- afterHash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

## ai owner binding proof bundle emptied mutation
- file: tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/owner-binding-proof-summary.md
- expectedNeedle: tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/owner-binding-proof-summary.md
- beforeHash: sha256:255b9242f938bca8186170266cb359eb9675ca3c496ed60662b4b7fe83f4631d
- afterHash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

## audit ai script removed mutation
- file: package.json
- expectedNeedle: package.json must keep the owner audit script bound for every governed ability group.
- beforeHash: sha256:3ceec823277bdbc3763e122242b847e54cd139cd9b34b77e598c9c9177050a12
- afterHash: sha256:bc0a99543a8031f367d6b2b9ce2a63aaa809399b0fc90e12a1e43fdec4e8c758

## generated enforcement matrix ai law removed mutation
- file: scripts/audit/generated/enforcement-matrix.generated.json
- expectedNeedle: Generated artifact content drifted away from the rebuild output; generated files must not be hand-edited.
- beforeHash: sha256:b93bfec3c82d47a9f9a00c5f7344529cc7a262aefbbc08c5c4661301187da960
- afterHash: sha256:23619437d194c65da7c9bb711262fb58bba8eed91769161436a0d5ebf6672c86

## static-clause-coverage writer removed mutation
- file: scripts/audit/core/artifact-writers.ts
- expectedNeedle: artifact-writers.ts must write static-clause-coverage to the canonical generated artifact path.
- beforeHash: sha256:64f187a47ebb22266ad16e89354a47340a9cec08bdab885eae8851d1ac3b119f
- afterHash: sha256:19c146ce962e8a7dae1b2d8c3be5ada83292cd10ce162ffd9fd7bd699c961013

## negative-proof invocation removed mutation
- file: scripts/audit/domains/audit-system/inspector.ts
- expectedNeedle: Audit-system inspector must invoke and report the negative-proof harness.
- beforeHash: sha256:e10273e13ae75ecfd7fbf81bb62492d55554be83fc995ea6816c8dce770272d1
- afterHash: sha256:6e3f991a611a0d7ee46fd820c5b7454333297afb7535a1e0edc2059b8205253c
