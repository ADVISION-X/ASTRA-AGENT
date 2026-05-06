# Command Rejected After Accepted Proof

Late command results with command/result envelope refs are no longer logged as `COMMAND_REJECTED` when the failure reason is a timeout. They emit `COMMAND_RECEIPT_TIMEOUT_AFTER_ACCEPTED`, preserving mission runtime truth and pointing operators to runtime events.
