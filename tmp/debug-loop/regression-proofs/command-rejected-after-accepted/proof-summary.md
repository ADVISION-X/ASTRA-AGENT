# COMMAND_REJECTED after accepted proof

Commander inspector now checks that accepted observer timeout uses `COMMAND_RECEIPT_TIMEOUT_AFTER_ACCEPTED`, guarded by command/result envelope refs, rather than late `COMMAND_REJECTED`.

Verification:

```txt
npm run audit:commander-console: PASS
```
