# GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-005-V2 Production Mutation

scenarioId: result-builder-drops-run-id
mutationName: result-builder-drops-run-id
mutatedFile: src/capabilities/post-action-verification/runtime/verification-result-builder.ts
coveredLawIds: GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-005-V2
beforeHash: sha256:0d02fdf3c4f2a04e5c259b08da040b04e5115894eae8624cc5b592622d2c86de
afterMutationHash: sha256:33b1af921a203f980c97366fb219055e96bd369d18d5ddbaccd35aad6d14da93

The mutation removes the governed request runId from the final result builder, proving Post Action Verification results must preserve mission/run chain parity from the governed request.
