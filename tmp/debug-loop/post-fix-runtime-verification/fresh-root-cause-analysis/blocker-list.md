# Fresh Blocker List

- `BLOCKER-RUNTIME-1`
	- status: retired for current run
	- previous symptom: `prepare-ai-input proof requires scaleMapping`
	- retirement evidence: absent from `current-run-timeline-final.json` for command `commander_command_2617c59a-8d8f-4f8c-bcf9-ee4e3502e19f`

- `BLOCKER-RUNTIME-2`
	- status: active
	- severity: P0
	- current symptom: `Stored image source dimensions must match sourceProof dimensions.`
	- failing step: `prepare-ai-input`
	- first terminal events: `CAPABILITY_CALL_FAILED`, then `MISSION_FAILED`

- `BLOCKER-LOG-1`
	- status: active residual gap
	- severity: P1
	- current symptom: commander task-start response proof still has null correlation fields (`missionId`, `traceId`)
	- runtime impact in this loop: did not stop mission progression, but remains unresolved governance debt
