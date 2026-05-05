BLOCKER-1 mutation: force start-mission command acceptance to await terminal mission execution.

Expected result: commander-console owner inspector must fail because handleStartMission would again couple the command receipt to the long-running mission loop.
