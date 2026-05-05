# Fresh Law / Blueprint Mapping

| Blocker | Current owner | Law file / lawId | Blueprint file / section | Mapping |
|---|---|---|---|---|
| BLOCKER-POSTFIX-1 | Screenshot capability | `scripts/audit/domains/screenshot-capability/config.ts` / `GRASSEYE-SCREENSHOT-CAPABILITY-004-V2` primary, `GRASSEYE-SCREENSHOT-CAPABILITY-003-V2` secondary | `docs/法案辅助文件/GrassEye Screenshot 能力组施工图.md` / `15. Runtime Proof` | Screenshot runtimeProof validation must stay consistent with governed schema truth. Current runtime behavior violates that consistency by rejecting null `videoVisitId` even though the screenshot runtimeProof schema and blueprint mark it optional for this phase. |

## Fresh elimination of wrong owners

- Local-runtime dispatch adapter is not the current owner.
	- Fresh runtime reached screenshot `CAPABILITY_CALL_STARTED`.
	- The failing message is emitted by screenshot runtimeProof validation, not by local-runtime chain mapping.

- Orchestration dispatch lifecycle is not the current owner.
	- `COMMAND_ACCEPTED` is present.
	- `CAPABILITY_CALL_STARTED` is present before screenshot failure on both missions.

Conclusion: this blocker maps to screenshot proof/schema governance, not to the already repaired local-runtime adapter or the already repaired Orchestration lifecycle event emission.
