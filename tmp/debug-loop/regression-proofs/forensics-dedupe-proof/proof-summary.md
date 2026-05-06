# Forensics Write Summary Proof

Forensics write boundary events now include source event identity and idempotency evidence in terminal refs:

- `sourceEventId`
- `sourceEventType`
- `sourceOwner`
- `pendingRecordId` or `recordId`
- `idempotencyKey`
- `dedupeDecision`

This improves auditability without reducing Forensics persistence.
