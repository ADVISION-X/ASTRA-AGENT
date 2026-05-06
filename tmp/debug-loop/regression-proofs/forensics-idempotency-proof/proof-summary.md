# Forensics idempotency proof

Forensics write boundary events now include `recordKind` in terminal refs. The Forensics inspector requires source event, record, idempotency, and dedupe refs on write requested/written events.

Current limitation:

```txt
GRASSEYE_SKIP_FORENSICS_NEGATIVE_PROOF=1 npm run audit:forensics-persistence: blocked by pre-existing command flow and startup health findings.
```
