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
- beforeHash: sha256:573285605b17ca13a7d3ea1bec813826f586630566cc3fcc791975d990e46024
- afterHash: sha256:c94cbf0f79aae4edbb5de7145f441ee67adbf218543a76678bcef52001d084ab

## static-clause-coverage phase removed mutation
- file: scripts/audit/domains/audit-system/components/run-audit-governance-checks.ts
- expectedNeedle: Audit-system inspector must execute validateStaticClauseCoverage inside its Promise.all owner chain.
- beforeHash: sha256:2120b669e69886f2bc7bfe45d618d79d5855bb4a6f2e2c2ebe9604da2c228181
- afterHash: sha256:66d0bd039a50677caf2cf9c7b1011ad222dfdf618d6ba938531d4da9595f90ea

## static-clause-coverage fake ENFORCED mutation
- file: scripts/audit/generated/static-clause-coverage.generated.json
- expectedNeedle: No law may be marked ENFORCED while the global chain is failing.
- beforeHash: sha256:2ac415ca4789a9c575b289cdf53be09bc67d700d59c31cee12fcb4ed7a40deac
- afterHash: sha256:c01cd882dfae4062c759436691e6f10501e3a28ae116d54a882d8ce216999db5

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
- beforeHash: sha256:17687342afef607080352b3e266560a16d5cfa0c1d09aa8ff299c9e9fb64756b
- afterHash: sha256:da740b972d9f72b5d68ded59631d8e8dc049676435f9a5ec6e0a225a599483f2

## generated enforcement matrix ai law removed mutation
- file: scripts/audit/generated/enforcement-matrix.generated.json
- expectedNeedle: Generated artifact content drifted away from the rebuild output; generated files must not be hand-edited.
- beforeHash: sha256:92a38bd8fd7311e7d1b386a42067f0004a90ea6586c954c85fbbac21624ff14a
- afterHash: sha256:24eb3256b72f4a9644beca03c7bdc3b0c259dfa342ce372590904c58e07520b1

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
